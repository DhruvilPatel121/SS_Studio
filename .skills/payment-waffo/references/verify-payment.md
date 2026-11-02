# Verify payment: `verify_waffo_payment`

Read this whole file, in one go, before writing the function that confirms a payment. Copy its state handling as written: a simplified version loses payments or refunds twice. It contains, in order:

- **Rules**: ownership, the success rule, and what happens to expired, failed, late and refunded payments and to subscriptions. The example follows them.
- **`verify_waffo_payment`**: the complete `verify_waffo_payment/index.ts`, built on [setup.md](setup.md).

## Rules

- Accept `order_id` or `subscription_id`, load the row and check that it belongs to the caller. An order with a `user_id` accepts only its owner, also when guest checkout is enabled; an order without one is open only when `REQUIRE_LOGIN = false`, identified by the order id only the buyer's browser holds. Administrators may check any order (the admin orders page). It only reads Waffo and never opens a refund, so it is safe to call for any row at any time.
- Look the Waffo order up by the local id (`orderMerchantExternalId`) through the helper. Never accept a Waffo order id, payment id, amount or status from the client.
- One-time order: the payment succeeded ONLY when the Waffo order status is `completed`, it has a payment with status `succeeded`, AND the order `total.display` and `currency` equal the order row's amount and currency. Only then call `complete_waffo_order`; the order is paid only when it returns `true`.
- Keep the order `pending` while Waffo has no completed order for it and the checkout has not expired. Mark it `canceled` when the checkout expired with no payment under way, Waffo closed it, or every payment attempt on it failed. While a submitted payment is still on its way at Waffo, keep the order `pending` even after the checkout expired. A `canceled` order whose payment settles later is still completed when it is verified again, through the same amount and currency check.
- Return `checkoutUrl` only while Waffo has no order for the checkout and it has not expired. Once the buyer submitted a payment, opening the same page again does not continue that order.
- An order in `refund_pending` becomes `refunded` when Waffo reports the whole payment refunded, and returns to `completed` when the refund failed, was rejected or cancelled, or covered only part of the payment.
- Subscription (only when the app sells them): copy Waffo's status, `currentPeriodEnd` and `willRenew` onto the row. A pending subscription becomes active only with a succeeded first payment for the plan's currency and amount. A subscription the app holds as live that Waffo does not know (it was sold with another API key, for example a test key before the production key) becomes `canceled`. Without subscriptions, keep the subscription branch out of the function.
- There is no Webhook: this function is the only way payments, renewals, failed renewals and refunds reach the app. The pages call it as described in [checkout-pages.md](checkout-pages.md).

## `verify_waffo_payment`

Save as `supabase/functions/verify_waffo_payment/index.ts` and deploy it as `verify_waffo_payment`.

```ts
// verify_waffo_payment/index.ts
import {
  corsHeaders,
  currentUser,
  expired,
  fail,
  findOnetimeOrders,
  findSubscriptionOrders,
  inFlight,
  isAdmin,
  ok,
  payableUrl,
  refundState,
  sameAmount,
  supabase,
  unpayable,
  waffoMessage,
} from "../_shared/waffo.ts";

// true when the app has a login system; false only for apps without login (guest checkout)
const REQUIRE_LOGIN = true;

// One-time order: completed only when Waffo reports a succeeded payment with the same total and currency.
// This function only reads Waffo and never opens a refund, so it is safe to call for any row at any time.
async function verifyOrder(order: any) {
  // A canceled order is checked too: a payment that settled late still completes it.
  if (order.status === "pending" || order.status === "canceled") {
    const remote = await findOnetimeOrders(order.id);
    const completed = remote.filter(
      (item) =>
        item.status === "completed" &&
        item.payments.some((payment) => payment.status === "succeeded"),
    );
    if (completed.length > 1) {
      console.error(
        "Waffo holds several paid orders for order",
        order.id,
        "- refund the extra ones in the Waffo dashboard",
      );
    }
    const paid = completed[0];
    if (paid) {
      const payment = paid.payments.find(
        (item) => item.status === "succeeded",
      )!;
      if (
        !sameAmount(paid.total.display, order.total_amount) ||
        paid.currency !== order.currency
      ) {
        console.error("Waffo amount mismatch for order", order.id);
        throw new Error("Payment does not match the order. Contact support.");
      }
      // Row-locked: only the transition to completed applies fulfillment.
      const { data: done, error } = await supabase.rpc("complete_waffo_order", {
        p_order_id: order.id,
        p_waffo_order_id: paid.id,
        p_payment_id: payment.id,
        p_test_mode: paid.testMode,
      });
      if (error || done !== true)
        throw new Error("Failed to complete the order");
      return { status: "completed", verified: true, testMode: paid.testMode };
    }
    if (order.status === "canceled")
      return { status: "canceled", verified: false };
    // The checkout page expired with no payment under way, or every attempt on it failed.
    if (
      (expired(order) && !inFlight(remote)) ||
      (remote.length && remote.every(unpayable))
    ) {
      await supabase
        .from("orders")
        .update({ status: "canceled" })
        .eq("id", order.id)
        .eq("status", "pending");
      return { status: "canceled", verified: false };
    }
    return {
      status: "pending",
      verified: false,
      checkoutUrl: payableUrl(order, remote),
    };
  }
  if (order.status === "refund_pending") {
    const state = await refundState(order.id, order.waffo_payment_id);
    if (state === "refunded") {
      await supabase
        .from("orders")
        .update({ status: "refunded" })
        .eq("id", order.id)
        .eq("status", "refund_pending");
      return { status: "refunded", verified: false };
    }
    if (state === "failed" || state === "partial") {
      await supabase
        .from("orders")
        .update({ status: "completed" })
        .eq("id", order.id)
        .eq("status", "refund_pending");
      return {
        status: "completed",
        verified: true,
        refundFailed: true,
        testMode: order.test_mode,
      };
    }
  }
  return {
    status: order.status,
    verified: order.status === "completed",
    testMode: order.test_mode,
  };
}

const LIVE_STATUSES = ["active", "trialing", "canceling", "past_due"];
const SUBSCRIPTION_STATUS: Record<string, string> = {
  active: "active",
  trialing: "active",
  canceling: "canceling",
  past_due: "past_due",
  canceled: "canceled",
  closed: "canceled",
  expired: "canceled",
};

// Subscription: copy Waffo's current state. Called on return from checkout and whenever the membership is shown,
// which is how renewals, failed renewals and changes the buyer made in Waffo's customer portal reach the app.
async function syncSubscription(subscription: any) {
  const remote = (await findSubscriptionOrders(subscription.id)).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  // Prefer the order that still grants or can regain access; otherwise the latest finished one.
  const current =
    remote.find((item) => LIVE_STATUSES.includes(item.status)) ??
    remote.find((item) => SUBSCRIPTION_STATUS[item.status]);
  if (!current) {
    const stale = ["active", "canceling", "past_due"].includes(
      subscription.status,
    )
      ? // Waffo no longer knows a subscription the app holds as live: it was sold with another API key
        // (a test key replaced by the production key). It must not block a new subscription.
        remote.length === 0
      : subscription.status === "pending" &&
        ((expired(subscription) && !inFlight(remote)) ||
          (remote.length > 0 && remote.every(unpayable)));
    if (stale) {
      await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("id", subscription.id);
      return { status: "canceled", verified: false };
    }
    return {
      status: subscription.status,
      verified: false,
      checkoutUrl: payableUrl(subscription, remote),
    };
  }
  const status = SUBSCRIPTION_STATUS[current.status];
  if (subscription.status === "pending" || subscription.status === "canceled") {
    // A subscription starts only with its first payment, for the plan's amount and currency.
    const first = current.payments.find(
      (payment) => payment.status === "succeeded",
    );
    if (!first && status !== "canceled")
      return {
        status: subscription.status,
        verified: false,
        checkoutUrl: null,
      };
    // A buyer charged in another currency shows the converted amount; the order currency is the plan's.
    if (
      first &&
      (current.currency !== subscription.currency ||
        (first.amount.currency === subscription.currency &&
          !sameAmount(first.amount.display, subscription.amount)))
    ) {
      console.error("Waffo amount mismatch for subscription", subscription.id);
      throw new Error("Payment does not match the plan. Contact support.");
    }
  }
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status,
      waffo_order_id: current.id,
      current_period_end: current.currentPeriodEnd,
      will_renew: current.willRenew,
      test_mode: current.testMode,
    })
    .eq("id", subscription.id);
  if (error) throw new Error("Failed to update the subscription");
  return {
    status,
    verified: status === "active" || status === "canceling",
    currentPeriodEnd: current.currentPeriodEnd,
    willRenew: current.willRenew,
    testMode: current.testMode,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  try {
    const user = await currentUser(req);
    const { order_id, subscription_id } = await req.json();

    if (subscription_id) {
      if (!user) return fail("Sign in first", 401);
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("id", subscription_id)
        .maybeSingle();
      if (!subscription) return fail("Subscription not found", 404);
      if (subscription.user_id !== user.id)
        return fail("Not your subscription", 403);
      return ok(await syncSubscription(subscription));
    }

    if (!order_id) return fail("Missing order_id");
    if (REQUIRE_LOGIN && !user) return fail("Sign in first", 401);
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .maybeSingle();
    if (!order) return fail("Order not found", 404);
    // An order that has an owner accepts only its owner, also when guest checkout is enabled; an order without
    // one is open only in guest mode. Administrators may check any order (the admin orders page).
    const allowed = order.user_id ? order.user_id === user?.id : !REQUIRE_LOGIN;
    if (!allowed && !(await isAdmin(user?.id)))
      return fail("Not your order", 403);
    return ok(await verifyOrder(order));
  } catch (error) {
    console.error("Waffo verification failed:", waffoMessage(error));
    return fail(waffoMessage(error), 500);
  }
});
```
