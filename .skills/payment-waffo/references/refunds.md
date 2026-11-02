# Refunds: `refund_waffo_payment` and the admin orders page

Read this whole file, in one go, before building refunds or an admin orders page. Only apps with login get them; without login the merchant refunds in the Waffo dashboard. Copy the refund-state handling as written: a simplified version can refund twice. It contains, in order:

- **Rules**: the administrator gate, one refund per payment, and the admin orders page.
- **Admin policy**: the "Admins view all orders" policy.
- **`refund_waffo_payment`**: the complete `refund_waffo_payment/index.ts`, built on [setup.md](setup.md) and the roles of the login setup.

## Rules

- Reject callers who are not signed in (HTTP 401) or whose `profiles.role` is not `admin` (HTTP 403) before reading the order. The helper's `isAdmin` reads the role with the service role client.
- Full refunds of completed one-time orders only. Use the order id as `refundTicketMerchantExternalId` and the payment's own `amount.display` as the refund amount.
- Read the payment's refund state from Waffo before opening a refund: Waffo keeps one refund per payment, so a repeated call reports the existing refund and never opens a second one.
- Set the order to `refund_pending`; Waffo executes refunds asynchronously and `verify_waffo_payment` moves the order to `refunded` once Waffo reports it. Surface Waffo's refusal message (for example a payment older than 14 days) and leave the order `completed`. When Waffo could not complete the refund, or part of the payment was already refunded outside the app, keep the order `completed` and tell the administrator to handle it in the Waffo dashboard.
- It is an action, not a status check: call it ONLY from the administrator's click on the "Refund" button of one order. NEVER call `refund_waffo_payment` automatically, in a loop, or to refresh statuses: for a completed order it opens a refund.
- Admin orders page: lists every order through the "Admins view all orders" policy. `orders.user_id` references `auth.users`, not `profiles`, so never embed `profiles` in the orders query (the request fails for lack of a relationship); load buyer names with a separate `profiles` query by id. After loading the rows it passes them through `refreshOrders(rows)`, which administrators may use for any order; this is how a refund in progress becomes `refunded`.
- The "Refund" button of one completed order asks the administrator to confirm, calls `refundOrder`, updates that row from the returned status right away and shows "Refund processing" while it is `refund_pending`. When the call fails, show its message; the order stays `completed`.
- A refund made in the Waffo dashboard is not copied back by itself: the order stays `completed` until an administrator presses Refund for it, which then only records the refund Waffo already holds.

## Admin policy

Apply with the orders table when the app has login (the `profiles` table of the login setup exists):

```sql
-- Administrators list every order on the admin orders page.
create policy "Admins view all orders" on public.orders for select
    using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
```

## `refund_waffo_payment`

Save as `supabase/functions/refund_waffo_payment/index.ts` and deploy it as `refund_waffo_payment`.

```ts
// refund_waffo_payment/index.ts
import {
  corsHeaders,
  currentUser,
  fail,
  findPayment,
  isAdmin,
  ok,
  refundState,
  requestFullRefund,
  supabase,
  waffoMessage,
} from "../_shared/waffo.ts";

// An action, not a status check: for a completed order it opens a full refund. Call it only from the
// administrator's click on "Refund" for that one order; lists are refreshed with verify_waffo_payment.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  try {
    const user = await currentUser(req);
    if (!user) return fail("Sign in first", 401);
    // Refunds are an administrator action; the role model is the one the login skill establishes.
    if (!(await isAdmin(user.id))) return fail("Administrator only", 403);

    const { order_id } = await req.json();
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .maybeSingle();
    if (!order) return fail("Order not found", 404);
    if (order.status === "refunded") return ok({ status: "refunded" });
    if (
      !["completed", "refund_pending"].includes(order.status) ||
      !order.waffo_payment_id
    ) {
      return fail("Only completed orders can be refunded", 409);
    }

    // Waffo keeps one refund per payment: read what exists before opening one.
    let state = await refundState(order.id, order.waffo_payment_id);
    if (
      order.status === "completed" &&
      (state === "none" || state === "failed")
    ) {
      const payment = await findPayment(order.waffo_payment_id);
      if (!payment) return fail("Payment not found at Waffo", 404);
      const result = await requestFullRefund(
        order.id,
        payment,
        "Refund requested by the merchant",
      );
      if (result.status === 200) {
        state = "pending";
      } else {
        // HTTP 409: Waffo already holds a refund for this payment. Anything else is a refusal, for example
        // "Refund period expired (… days, max 14)". The order stays completed unless a refund is on its way.
        if (result.status === 409)
          state = await refundState(order.id, order.waffo_payment_id);
        if (state !== "pending" && state !== "refunded") {
          return fail(
            result.message || `Waffo refused the refund (${result.status})`,
            409,
          );
        }
      }
    }
    if (state === "partial") {
      await supabase
        .from("orders")
        .update({ status: "completed" })
        .eq("id", order.id)
        .eq("status", "refund_pending");
      return fail(
        "Part of this payment was refunded outside the app. Waffo allows one refund per payment: handle the rest in the Waffo dashboard.",
        409,
      );
    }
    if (state === "failed") {
      await supabase
        .from("orders")
        .update({ status: "completed" })
        .eq("id", order.id)
        .eq("status", "refund_pending");
      return fail(
        "Waffo did not complete this refund. Refund the payment in the Waffo dashboard, then press Refund here again to update the order.",
        409,
      );
    }
    // Waffo executes refunds asynchronously: the order is refund_pending until Waffo reports the refund.
    const status = state === "refunded" ? "refunded" : "refund_pending";
    await supabase
      .from("orders")
      .update({ status })
      .eq("id", order.id)
      .in("status", ["completed", "refund_pending"]);
    return ok({ status });
  } catch (error) {
    console.error("Waffo refund failed:", waffoMessage(error));
    return fail(waffoMessage(error), 500);
  }
});
```
