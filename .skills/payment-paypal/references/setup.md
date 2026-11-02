# Setup: orders table and configuration

Read this whole file, in one go, before the first migration. Every PayPal app needs both parts. It contains, in order:

- **Orders table and completion function**: the `orders` table, its row-level security, and `complete_paypal_order` with its `revoke`/`grant`. Apply as written, then run the policy check in SKILL.md.
- **`paypal_config`**: the function that verifies the credentials before checkout appears and returns only public configuration.

## Orders table and completion function

Apply this SQL as written with `supabase_apply_migration`, including the `revoke` on `complete_paypal_order`. Adapt only what the app needs:

- Guest checkout (`REQUIRE_LOGIN = false`): drop `not null` on `orders.user_id`; guest orders keep it null.
- Use one currency here, in `paypal_config` and in `create_paypal_order`.
- Inventory, seats, entitlements and other database effects of a payment go inside `complete_paypal_order`, where the comment says. Only the pending-to-completed transition applies them, so a retry never applies them twice; a business failure raises an exception so neither the status nor the effect commits. Never grant benefits in the browser or after a separate order update. External delivery uses the app's existing durable, idempotent delivery mechanism.
- Keep every check in `complete_paypal_order`: an empty capture id, an amount or currency that differs from the row, or a status other than `pending` returns `false`; a completed row returns whether its stored `paypal_capture_id` equals the supplied capture id. Never simplify it to return `true` for a completed row.
- A table with another name that carries a payment (bookings, registrations, tickets) gets the same payment columns, the same two policies, and a completion function with the same checks and its own `revoke`/`grant`.

```sql
-- Order status enum
create type order_status as enum ('pending', 'completed', 'failed', 'cancelled', 'refunded');

-- Orders table (amounts are stored in major currency units, e.g. 19.99)
create table public.orders (
    id uuid primary key default gen_random_uuid(),
    -- not null when the app has login; drop "not null" only for guest checkout (REQUIRE_LOGIN = false)
    user_id uuid not null references auth.users(id),
    items jsonb not null,
    total_amount numeric(12,2) not null,
    currency text not null default 'USD',
    status order_status not null default 'pending'::order_status,
    paypal_order_id text unique,
    paypal_capture_id text unique,
    paypal_capture_request_id uuid not null default gen_random_uuid(),
    paypal_refund_id text,
    paypal_debug_id text,
    -- PayPal account that paid; keep the contact details the buyer enters in the app in their own columns
    payer_email text,
    payer_name text,
    completed_at timestamptz,
    refunded_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Indexes for faster lookups (the unique constraints already index paypal_order_id / paypal_capture_id)
create index idx_orders_user_id on public.orders(user_id);
create index idx_orders_status on public.orders(status);

-- RLS Policies
alter table public.orders enable row level security;

-- Users can view their own orders
create policy "Users can view own orders"
    on public.orders for select
    using (auth.uid() = user_id);

-- Only edge functions (service role) can insert/update orders
create policy "Service role can manage orders"
    on public.orders for all
    using (auth.jwt()->>'role' = 'service_role');

-- Server-only payment finalization: the row lock serializes concurrent callbacks.
create or replace function public.complete_paypal_order(
    p_order_id uuid, p_capture_id text, p_amount numeric, p_currency text,
    p_payer_email text, p_payer_name text
) returns boolean
language plpgsql security invoker set search_path = public
as $$
declare
    current_order public.orders%rowtype;
begin
    select * into current_order from public.orders where id = p_order_id for update;
    if not found then return false; end if;
    if p_capture_id is null or p_capture_id = ''
       or p_amount is distinct from current_order.total_amount
       or p_currency is distinct from upper(current_order.currency) then
        return false;
    end if;
    if current_order.status = 'completed' then
        return current_order.paypal_capture_id = p_capture_id;
    end if;
    if current_order.status <> 'pending' then return false; end if;

    -- Add the application's inventory / entitlement mutations HERE, in this transaction.
    -- Any business failure must raise an exception so neither state nor benefits commit.
    update public.orders set status = 'completed', paypal_capture_id = p_capture_id,
        payer_email = p_payer_email, payer_name = p_payer_name, completed_at = now(), updated_at = now()
        where id = p_order_id;
    return true;
end;
$$;
revoke all on function public.complete_paypal_order(uuid, text, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_paypal_order(uuid, text, numeric, text, text, text) to service_role;
```

## `paypal_config`

Returns `{ clientId, environment, currency }` so the browser can load the PayPal JS SDK. It obtains a token through the shared helper first, so checkout appears only for credentials PayPal accepted; `environment` is `live` or `sandbox`, resolved by the helper. The Client ID is public; the Secret and the token are never returned. Set `REQUIRE_LOGIN` as SKILL.md describes. When configuration fails, checkout stays unavailable; reopening or reloading the component retries after the merchant saves both credentials again.

```ts
// paypal_config/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
// Store currency: must match orders.currency and the value used in create_paypal_order
const PAYPAL_CURRENCY = "USD";
// true when the app has a login system; false only for apps without login (guest checkout)
const REQUIRE_LOGIN = true;

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

    if (REQUIRE_LOGIN) {
      const bearer = req.headers
        .get("Authorization")
        ?.replace(/^Bearer\s+/i, "");
      if (!bearer) return fail("Sign in before checkout", 401);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(bearer);
      if (authError || !user || user.is_anonymous)
        return fail("Sign in before checkout", 401);
    }
    // Validate before exposing checkout configuration; never return the token or Secret.
    const { clientId, environment } = await getPayPalAccessToken();

    return ok({ clientId, environment, currency: PAYPAL_CURRENCY });
  } catch (error) {
    console.error("PayPal config failed:", error);
    return fail(
      error instanceof Error ? error.message : "PayPal is not configured",
      500,
    );
  }
});
```
