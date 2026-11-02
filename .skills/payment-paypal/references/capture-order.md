# Capture order: `capture_paypal_order`

Read this whole file, in one go, before writing the function that confirms a payment. It contains, in order:

- **Rules**: ownership, the success rule, and what to do with declined, duplicate and uncertain results. The example follows them.
- **Function**: the complete `capture_paypal_order/index.ts`, built on [setup.md](setup.md).

## Rules

- Accept the PayPal order id, load the matching row, and check that it belongs to the caller. An order with a `user_id` accepts only its owner, also when it is already completed (HTTP 403). Guest orders (`user_id` null) exist only when `REQUIRE_LOGIN = false` and are identified by the PayPal order id only the buyer's browser holds.
- Call `POST {base}/v2/checkout/orders/{id}/capture` with `Prefer: return=representation` and `PayPal-Request-Id: <orders.paypal_capture_request_id>`. Reuse that persisted id after timeouts and HTTP 5xx; rotate it with a conditional update only after a confirmed `INSTRUMENT_DECLINED`.
- Success only when the HTTP status is 200 or 201 AND the order and capture `status` are both `COMPLETED` AND `purchase_units[0].payments.captures[0].amount` (value and currency_code) equals the row's amount and currency. Only then call `complete_paypal_order`; the order is paid only when it returns `true`.
- HTTP 422 with `details[].issue` `INSTRUMENT_DECLINED`: keep the order `pending`, rotate the request id, and return `{ restart: true }` so the browser calls `actions.restart()` and the buyer picks another funding source.
- HTTP 422 with `ORDER_ALREADY_CAPTURED` (a repeated capture): fetch `GET {base}/v2/checkout/orders/{id}` and apply the same success rule to it instead of failing.
- A `PENDING` capture with a matching amount returns `{ pending: true }`; it is not a success.
- Uncertain outcomes (timeouts, HTTP 5xx, database write failures) keep the order `pending` and return an error; the buyer retries the status check of the same order. Never invite a second payment while the first may have succeeded. Log the PayPal `debug_id`.
- PayPal payer details go to `payer_email` and `payer_name`; never overwrite contact details the buyer entered in the app.
- Return the capture result with `verified: true`, the capture id, amount and currency.

## Function

```ts
// capture_paypal_order/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function ok(data: any): Response {
  return new Response(
    JSON.stringify({ code: "SUCCESS", message: "ok", data }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
}

function fail(msg: string, code = 400): Response {
  return new Response(JSON.stringify({ code: "FAIL", message: msg }), {
    status: code,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

import { getPayPalAccessToken, paypalDebugId } from "../_shared/paypal.ts";

// true when the app has a login system; false only for apps without login (guest checkout)
const REQUIRE_LOGIN = true;

// Returns the signed-in, non-anonymous buyer, or null (no session, the anon key, an invalid token or an anonymous session)
async function currentBuyer(req: Request) {
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(jwt);
  return error || !user || user.is_anonymous ? null : user;
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const { paypalOrderId } = await req.json();
    if (!paypalOrderId) throw new Error("Missing paypalOrderId parameter");

    const user = await currentBuyer(req);
    if (REQUIRE_LOGIN && !user) return fail("Please sign in to purchase", 401);

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select(
        "id, user_id, status, total_amount, currency, paypal_capture_id, paypal_capture_request_id",
      )
      .eq("paypal_order_id", paypalOrderId)
      .single();

    if (fetchError || !order) throw new Error("Order not found");
    // Account orders: only their owner. Guest orders (user_id null) exist only when REQUIRE_LOGIN = false and
    // are identified by the PayPal order id the buyer's browser holds.
    if (order.user_id ? order.user_id !== user?.id : REQUIRE_LOGIN)
      return fail("Forbidden", 403);

    if (order.status === "completed") {
      // Idempotent: the capture already succeeded
      return ok({
        verified: true,
        status: "COMPLETED",
        orderId: order.id,
        paypalOrderId,
        captureId: order.paypal_capture_id,
      });
    }
    if (order.status !== "pending") {
      throw new Error(
        `Order status is ${order.status}, cannot capture payment`,
      );
    }

    if (!order.paypal_capture_request_id)
      throw new Error("Missing persisted capture request ID");
    const { token, baseUrl } = await getPayPalAccessToken();
    const response = await fetch(
      `${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          // Persisted per funding attempt; network retries must reuse this ID.
          "PayPal-Request-Id": order.paypal_capture_request_id,
          Prefer: "return=representation",
        },
      },
    );
    let body = await response.json().catch(() => ({}));
    let httpStatus = response.status;

    const issues: string[] = Array.isArray(body.details)
      ? body.details.map((detail: any) => detail.issue)
      : [];

    // The buyer's funding source was declined: keep the order pending and let the client call actions.restart()
    if (httpStatus === 422 && issues.includes("INSTRUMENT_DECLINED")) {
      const { data: rotated, error } = await supabase
        .from("orders")
        .update({ paypal_capture_request_id: crypto.randomUUID() })
        .eq("id", order.id)
        .eq("status", "pending")
        .eq("paypal_capture_request_id", order.paypal_capture_request_id)
        .select("id")
        .maybeSingle();
      if (error || !rotated)
        throw new Error(
          "Payment attempt changed; refresh order status before retrying",
        );
      return ok({ restart: true, orderId: order.id, paypalOrderId });
    }

    // Duplicate capture call (e.g. a retried request): reconcile from the order itself instead of failing
    if (httpStatus === 422 && issues.includes("ORDER_ALREADY_CAPTURED")) {
      const lookup = await fetch(
        `${baseUrl}/v2/checkout/orders/${paypalOrderId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      body = await lookup.json().catch(() => ({}));
      httpStatus = lookup.status;
    }

    // Success rule: HTTP 200/201 AND status COMPLETED AND the captured amount/currency equals the order row
    const capture = body.purchase_units?.[0]?.payments?.captures?.[0];
    const amountMatches =
      !!capture &&
      Number(capture.amount?.value).toFixed(2) ===
        Number(order.total_amount).toFixed(2) &&
      capture.amount?.currency_code === order.currency.toUpperCase();
    if (
      (httpStatus === 200 || httpStatus === 201) &&
      capture?.status === "PENDING" &&
      amountMatches
    ) {
      return ok({
        verified: false,
        pending: true,
        status: "PENDING",
        orderId: order.id,
        paypalOrderId,
      });
    }
    const succeeded =
      (httpStatus === 200 || httpStatus === 201) &&
      body.status === "COMPLETED" &&
      capture?.status === "COMPLETED" &&
      !!capture.id &&
      amountMatches;

    if (!succeeded) {
      const debugId = paypalDebugId(response, body);
      console.error(
        `PayPal capture failed (debug_id=${debugId}, http=${httpStatus}, status=${body.status}):`,
        body.name,
        body.message,
      );
      // Keep uncertain outcomes recoverable; a later retry reconciles this same order.
      throw new Error(
        "PayPal payment is not confirmed. Retry the status check for this order.",
      );
    }

    const payer = body.payer;
    // The RPC locks the order and applies payment + app-specific database effects once.
    const { data: completed, error: updateError } = await supabase.rpc(
      "complete_paypal_order",
      {
        p_order_id: order.id,
        p_capture_id: capture.id,
        p_amount: capture.amount.value,
        p_currency: capture.amount.currency_code,
        // PayPal account details are stored apart from the contact details the buyer entered.
        p_payer_email: payer?.email_address || null,
        p_payer_name:
          [payer?.name?.given_name, payer?.name?.surname]
            .filter(Boolean)
            .join(" ") || null,
      },
    );
    if (updateError || completed !== true) {
      throw new Error(
        "Payment received but order confirmation is pending. Retry this order's status check.",
      );
    }

    return ok({
      verified: true,
      status: "COMPLETED",
      orderId: order.id,
      paypalOrderId,
      captureId: capture.id,
      amount: capture.amount.value,
      currency: capture.amount.currency_code,
      payerEmail: payer?.email_address,
    });
  } catch (error) {
    console.error("Capture PayPal order failed:", error);
    return fail(
      error instanceof Error ? error.message : "Payment capture failed",
      500,
    );
  }
});
```
