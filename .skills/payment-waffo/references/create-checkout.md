# Create checkout: `create_waffo_checkout`

Read this whole file, in one go, before writing the function that starts a payment. It contains, in order:

- **Rules**: what the function must do, in order. The example follows them.
- **`create_waffo_checkout`**: the complete `create_waffo_checkout/index.ts`, built on [setup.md](setup.md).

## Rules

- Accept the cart (product ids and quantities) or a `plan_id`. Validate each item, load prices and availability from the canonical table, and compute unit prices and the total on the server. Never trust a price or total sent by the browser. The example prices from a `products` table with `id, name, price numeric(12,2), image_url, is_active`; adapt it to the app's catalog.
- With login (`REQUIRE_LOGIN = true`), reject a missing, invalid or anonymous session with HTTP 401 before reading the database, and bind the order to that user. Without login, the order keeps `user_id` null, but a signed-in buyer still owns their order.
- Insert the `pending` `orders` (or `subscriptions`) row BEFORE calling Waffo. The row id is passed as `orderMerchantExternalId` and is the only link between the app and the Waffo order. Close the row (`canceled`) when the checkout could not be opened.
- Create the hosted checkout through the helper with the tax-inclusive price. Amounts sent to Waffo are display strings (`"23.45"`), never minor units.
- Build `successUrl` from the request `Origin` header (https only) plus the success path and the local id (`?order=<id>` or `?subscription=<id>`). Waffo adds no parameters to the success URL and has no cancel URL: an abandoned checkout simply expires after 24 hours.
- Pass the signed-in user's email as `buyerEmail`; the helper drops the placeholder addresses of username logins (`…@miaoda.com`), because Waffo emails the receipt and the subscription notices to the buyer, who then types a real address on the checkout page.
- Store `waffo_session_id`, `checkout_url` and `checkout_expires_at` on the row and return only `checkoutUrl` and the local id.
- Subscriptions (only when the app sells them, see [subscriptions.md](subscriptions.md)): require a signed-in user; refuse a second subscription while one is active, canceling or past due; return the unpaid checkout of the same plan instead of opening another; refuse another plan while a checkout of the first one can still be paid; refuse while a payment for a pending subscription is being processed. Two open subscription checkouts could both be paid and bill the buyer twice. Without subscriptions, keep the `plan_id` branch out of the function.

## `create_waffo_checkout`

Save as `supabase/functions/create_waffo_checkout/index.ts` and deploy it as `create_waffo_checkout`.

```ts
// create_waffo_checkout/index.ts
import {
  amountText,
  corsHeaders,
  createWaffoCheckout,
  currentUser,
  expired,
  fail,
  findSubscriptionOrders,
  ok,
  type Plan,
  supabase,
  unpayable,
  WAFFO_CURRENCY,
  waffoMessage,
} from "../_shared/waffo.ts";

// true when the app has a login system; false only for apps without login (guest checkout)
const REQUIRE_LOGIN = true;
// Page the buyer returns to after paying. Waffo has no cancel URL: an abandoned checkout simply expires.
const successPath = "/payment-success";

interface CartItem {
  product_id: string;
  quantity: number;
}

// Prices always come from the canonical products table, never from the client
async function priceCart(items: CartItem[]) {
  if (!Array.isArray(items) || !items.length)
    throw new Error("Items cannot be empty");
  for (const item of items) {
    if (
      !item.product_id ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    )
      throw new Error("Invalid item data");
  }
  const ids = [...new Set(items.map((item) => item.product_id))];
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, price, image_url, is_active")
    .in("id", ids);
  if (error) throw new Error("Failed to load products");
  const priced = items.map((item) => {
    const product = products?.find((row) => row.id === item.product_id);
    if (!product || !product.is_active)
      throw new Error("Product is not available");
    return {
      product_id: product.id,
      name: product.name,
      price: Number(product.price),
      quantity: item.quantity,
      image_url: product.image_url,
    };
  });
  const total =
    priced.reduce(
      (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
      0,
    ) / 100;
  return { priced, total };
}

// Opens the hosted checkout for a pending row and stores its link. A row whose checkout could not be opened
// is closed, so it never stays pending without a page to pay on.
async function openCheckout(
  table: "orders" | "subscriptions",
  id: string,
  input: {
    amount: number | string;
    successUrl: string;
    buyerEmail?: string | null;
    plan?: Plan;
  },
) {
  try {
    const session = await createWaffoCheckout({ localId: id, ...input });
    const { error } = await supabase
      .from(table)
      .update({
        waffo_session_id: session.sessionId,
        checkout_url: session.checkoutUrl,
        checkout_expires_at: session.expiresAt,
      })
      .eq("id", id);
    if (error) throw new Error("Failed to store the checkout");
    return session;
  } catch (error) {
    await supabase
      .from(table)
      .update({ status: "canceled" })
      .eq("id", id)
      .eq("status", "pending");
    throw error;
  }
}

// Waffo sends the buyer back to an absolute https address; with any other address the payment is refused.
function appOrigin(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  if (!/^https:\/\//.test(origin))
    throw new Error("Checkout must be started from an https page");
  return origin;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  try {
    const user = await currentUser(req);
    const body = await req.json();
    const origin = appOrigin(req);

    if (body.plan_id) {
      if (!user) return fail("Sign in before subscribing", 401);
      const { data: plan } = await supabase
        .from("plans")
        .select("id, name, price, billing_period, is_active")
        .eq("id", body.plan_id)
        .maybeSingle();
      if (!plan || !plan.is_active) return fail("Plan is not available", 404);

      // One subscription and one open checkout per user: a second page could be paid as well and bill twice.
      const { data: mine } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["pending", "active", "canceling", "past_due"])
        .order("created_at", { ascending: false })
        .limit(5);
      if (mine?.some((row) => row.status !== "pending"))
        return fail("You already have a subscription", 409);
      for (const row of mine ?? []) {
        const remote = await findSubscriptionOrders(row.id);
        if (remote.length && !remote.every(unpayable)) {
          return fail(
            "A payment for your subscription is being processed. Check its status before starting another.",
            409,
          );
        }
        if (!remote.length && !expired(row) && row.checkout_url) {
          if (row.plan_id === plan.id)
            return ok({
              checkoutUrl: row.checkout_url,
              subscriptionId: row.id,
            });
          // Its page stays payable at Waffo until it expires: closing it here could leave a paid
          // subscription the app never sees.
          return fail(
            "Your checkout for another plan is still open. Choose that plan again to reopen its payment page, or choose this one after it expires (24 hours).",
            409,
          );
        }
        await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("id", row.id)
          .eq("status", "pending");
      }

      const { data: subscription, error } = await supabase
        .from("subscriptions")
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          amount: amountText(plan.price),
          currency: WAFFO_CURRENCY,
          status: "pending",
        })
        .select()
        .single();
      if (error) throw new Error("Failed to create the subscription");
      const session = await openCheckout("subscriptions", subscription.id, {
        amount: plan.price,
        plan,
        buyerEmail: user.email,
        successUrl: `${origin}${successPath}?subscription=${subscription.id}`,
      });
      return ok({
        checkoutUrl: session.checkoutUrl,
        subscriptionId: subscription.id,
      });
    }

    if (REQUIRE_LOGIN && !user) return fail("Sign in before checkout", 401);
    const { priced, total } = await priceCart(body.items);
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        user_id: user?.id ?? null,
        items: priced,
        total_amount: amountText(total),
        currency: WAFFO_CURRENCY,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error("Failed to create the order");
    const session = await openCheckout("orders", order.id, {
      amount: total,
      buyerEmail: user?.email,
      successUrl: `${origin}${successPath}?order=${order.id}`,
    });
    return ok({ checkoutUrl: session.checkoutUrl, orderId: order.id });
  } catch (error) {
    console.error("Waffo checkout failed:", waffoMessage(error));
    return fail(waffoMessage(error), 500);
  }
});
```
