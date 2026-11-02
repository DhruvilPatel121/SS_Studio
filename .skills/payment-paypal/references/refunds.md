# Refunds: `refund_paypal_capture`

Read this whole file, in one go, before building refunds. Only apps with login get this function; without login the merchant refunds in the PayPal account. It contains, in order:

- **Rules**: the administrator gate, idempotent full refunds, and the admin refund button.
- **Function**: the complete `refund_paypal_capture/index.ts`, built on [setup.md](setup.md) and the roles of the login setup.

## Rules

- Reject callers who are not signed in (HTTP 401) or whose `profiles.role` is not `admin` (HTTP 403) before reading the order. Read the role with the service role client.
- Call `POST {base}/v2/payments/captures/{captureId}/refund` with `PayPal-Request-Id: <orders row id>`, `Prefer: return=representation` and the same `{}` body on every retry. Full refunds only.
- Store `paypal_refund_id` as soon as the refund exists. A retry queries `GET /v2/payments/refunds/{id}` instead of creating a second refund. Mark the order `refunded` only when the refund status is `COMPLETED`.
- In the admin area, put a "Refund" button on completed orders that asks the administrator to confirm, calls `refund_paypal_capture`, and shows the resulting status.

## Function

```ts
// refund_paypal_capture/index.ts
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

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const { orderId } = await req.json();
    if (!orderId) throw new Error("Missing orderId parameter");

    // Admin gate: public.profiles stores each user's role (user_role enum 'user' | 'admin').
    // If the app has no admin concept, this profiles.role = 'admin' check is still the only gate for refunds.
    const authHeader = req.headers.get("Authorization");
    const jwt = authHeader?.replace("Bearer ", "");
    const {
      data: { user },
    } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } };
    if (!user) return fail("Unauthorized", 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") return fail("Forbidden: admin only", 403);

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select(
        "id, status, total_amount, currency, paypal_capture_id, paypal_refund_id",
      )
      .eq("id", orderId)
      .single();

    if (fetchError || !order) throw new Error("Order not found");
    if (order.status === "refunded") {
      // Idempotent: the refund already completed
      return ok({
        refunded: true,
        status: "COMPLETED",
        orderId: order.id,
        refundId: order.paypal_refund_id,
      });
    }
    if (order.status !== "completed" || !order.paypal_capture_id) {
      throw new Error(`Order status is ${order.status}, cannot refund`);
    }

    const { token, baseUrl } = await getPayPalAccessToken();
    const response = order.paypal_refund_id
      ? await fetch(
          `${baseUrl}/v2/payments/refunds/${order.paypal_refund_id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        )
      : await fetch(
          `${baseUrl}/v2/payments/captures/${order.paypal_capture_id}/refund`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "PayPal-Request-Id": order.id,
              Prefer: "return=representation",
            },
            // Full refund only; the body must remain identical on every retry.
            body: "{}",
          },
        );
    const body = await response.json().catch(() => ({}));

    if (!(response.status === 200 || response.status === 201) || !body.id) {
      const debugId = paypalDebugId(response, body);
      console.error(
        `PayPal refund failed (debug_id=${debugId}, http=${response.status}):`,
        body.name,
        body.message,
      );
      throw new Error("PayPal refund failed");
    }

    const patch =
      body.status === "COMPLETED"
        ? {
            status: "refunded",
            paypal_refund_id: body.id,
            refunded_at: new Date().toISOString(),
          }
        : { paypal_refund_id: body.id };
    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", order.id)
      .eq("status", "completed")
      .select("id")
      .maybeSingle();
    if (updateError || !updated) {
      throw new Error(
        "Refund confirmation is pending. Refresh this order before retrying.",
      );
    }
    if (body.status !== "COMPLETED") {
      return ok({
        refunded: false,
        status: body.status,
        orderId: order.id,
        refundId: body.id,
      });
    }

    return ok({
      refunded: true,
      status: "COMPLETED",
      orderId: order.id,
      refundId: body.id,
      amount: body.amount?.value,
      currency: body.amount?.currency_code,
    });
  } catch (error) {
    console.error("Refund PayPal capture failed:", error);
    return fail(error instanceof Error ? error.message : "Refund failed", 500);
  }
});
```
