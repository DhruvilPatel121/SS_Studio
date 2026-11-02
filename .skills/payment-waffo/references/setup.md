# Setup: orders table, shared helper and configuration

Read this whole file, in one go, before the first migration. Every Waffo app needs all three parts. It contains, in order:

- **Orders table and completion function**: `orders`, `waffo_catalog`, their row-level security, and `complete_waffo_order` with its `revoke`/`grant`. Apply as written, then run the policy check in SKILL.md.
- **Shared helper**: where [waffo-client.ts](waffo-client.ts) goes and the constants to set in it.
- **`waffo_config`**: the function that verifies the credentials before checkout is enabled.

## Orders table and completion function

Apply this SQL as written with `supabase_apply_migration`, including the `revoke` on `complete_waffo_order`. Adapt only what the app needs:

- Adapt the item shape to the app; keep the Waffo columns, the statuses (spelled as here, `canceled` with one l) and the policies.
- Inventory, seats, credits and other database effects of a payment go inside `complete_waffo_order`, where the comment says. Only the transition to `completed` applies them, so repeated verification never applies them twice; a business failure raises an exception so neither the status nor the effect commits. Never grant benefits in the browser or after a separate order update.
- Apps with login add the "Admins view all orders" policy from [refunds.md](refunds.md). Apps that sell subscriptions add the tables from [subscriptions.md](subscriptions.md).

```sql
-- One-time orders. Adapt the item shape to the app; keep the Waffo columns, statuses and policies.
-- Statuses are spelled as here ('canceled', one l).
create table public.orders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id),              -- null only for guest checkout
    items jsonb not null,
    total_amount numeric(12,2) not null,
    currency text not null,
    status text not null default 'pending'
        check (status in ('pending', 'completed', 'canceled', 'refund_pending', 'refunded')),
    waffo_session_id text,
    checkout_url text,
    checkout_expires_at timestamptz,
    waffo_order_id text unique,
    waffo_payment_id text unique,
    test_mode boolean,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index idx_orders_user_id on public.orders(user_id);
alter table public.orders enable row level security;
create policy "Users view their own orders" on public.orders for select using (auth.uid() = user_id);
-- No insert/update/delete policy: only Edge Functions (service role) write orders.

-- Ids the app created or resolved at Waffo, per merchant account: the store and the products. Service role only.
create table public.waffo_catalog (
    merchant_id text not null,
    key text not null,
    waffo_id text not null,
    created_at timestamptz not null default now(),
    primary key (merchant_id, key)
);
alter table public.waffo_catalog enable row level security;

-- Completes a paid order exactly once. Put inventory or entitlement changes inside this transaction.
create or replace function public.complete_waffo_order(
    p_order_id uuid, p_waffo_order_id text, p_payment_id text, p_test_mode boolean
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
    v_order public.orders%rowtype;
begin
    if coalesce(p_waffo_order_id, '') = '' or coalesce(p_payment_id, '') = '' then
        return false;
    end if;
    select * into v_order from public.orders where id = p_order_id for update;
    if not found then
        return false;
    end if;
    -- A canceled order completes too: its payment settled after the checkout was given up.
    if v_order.status not in ('pending', 'canceled') then
        -- A repeated call succeeds only for the payment that completed this order.
        return v_order.status = 'completed' and v_order.waffo_payment_id = p_payment_id;
    end if;
    update public.orders
       set status = 'completed', waffo_order_id = p_waffo_order_id, waffo_payment_id = p_payment_id,
           test_mode = p_test_mode, completed_at = now(), updated_at = now()
     where id = p_order_id;
    -- Fulfillment for this order goes here (stock, credits, access).
    return true;
end;
$$;
revoke all on function public.complete_waffo_order(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.complete_waffo_order(uuid, text, text, boolean) to service_role;
```

## Shared helper

Copy [waffo-client.ts](waffo-client.ts) with `mkdir -p supabase/functions/_shared && cp .skills/payment-waffo/references/waffo-client.ts supabase/functions/_shared/waffo.ts` and deploy it with the functions. Do not retype, shorten or rewrite it, even when the app sells no subscriptions or has no refunds: unused functions are harmless, while a retyped helper has called Waffo SDK methods that do not exist. It signs requests through the pinned `npm:@waffo/pancake-ts@0.25.0` SDK; do not change the version, do not reimplement request signing in function files, and do not call Waffo from a function file other than through the helper. Set its constants once, at the top of the file:

- `WAFFO_CURRENCY`: the currency the app's prices are in. Waffo charges in USD, EUR, GBP, HKD and JPY; use USD when the user names no currency or another one. Each payment must be within Waffo's range for the currency (for USD 1 to 10,000); the helper refuses amounts outside it.
- `WAFFO_TAX_CATEGORY`: what the app sells, exactly one of the values in `TAX_CATEGORIES` (for bookings, events or donations use the closest one, such as `professional_service` or `digital_goods`); Waffo refuses every payment for any other value. Prices are tax-inclusive: the price the app shows is what the buyer pays.
- `WAFFO_ORDER_NAME`: "<app name> order". The buyer sees it on the checkout page and the receipt of a one-time order.
- `WAFFO_STORE_ID`: leave empty. The helper uses the merchant's only active store and never creates one; the merchant creates it in the Waffo dashboard, where it also passes Waffo's review. If the account has several stores, checkout fails with a message asking which Store ID to use; set it only after the merchant names it.

Waffo products cannot be deleted, so the helper creates as few as possible: one product for all one-time orders and one per plan, found again by name and mark before a new one is created, with their ids kept in `waffo_catalog`. Never create Waffo products anywhere else and never publish products from code.

The Private Key is used as saved. The Waffo dashboard issues it as one line of Base64; PEM with or without line breaks is also valid. Do not reformat, re-encode or validate its shape in application code. There is no environment setting: a Waffo API key is bound to test or production when it is created, and Waffo reports `testMode` on every order. Never create `WAFFO_ENVIRONMENT`, a store id secret or a product id secret, and never branch code on the environment.

## `waffo_config`

Save as `supabase/functions/waffo_config/index.ts` and deploy it as `waffo_config`. It returns `{ ready, currency }` after asking Waffo for the merchant's store, which verifies both credentials with a signed request, and never returns the Merchant ID or the Private Key. Set `REQUIRE_LOGIN` as described in SKILL.md ("Who may pay, see orders and refund").

```ts
// waffo_config/index.ts
import {
  checkWaffoConstants,
  corsHeaders,
  currentUser,
  fail,
  ok,
  WAFFO_CURRENCY,
  waffoMessage,
  waffoStoreId,
} from "../_shared/waffo.ts";

// true when the app has a login system; false only for apps without login (guest checkout)
const REQUIRE_LOGIN = true;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  try {
    checkWaffoConstants();
    if (REQUIRE_LOGIN && !(await currentUser(req)))
      return fail("Sign in before checkout", 401);
    // Asking Waffo for the store signs a real request, so this verifies both credentials.
    await waffoStoreId(true);
    return ok({ ready: true, currency: WAFFO_CURRENCY });
  } catch (error) {
    console.error("Waffo config failed:", waffoMessage(error));
    return fail(waffoMessage(error), 500);
  }
});
```

After deploying, call `waffo_config` once. Correct answers are only `ready: true`, a message about the Waffo credentials, or exactly "Sign in before checkout" (HTTP 401). A message naming `WAFFO_TAX_CATEGORY` or the currency means that constant is not one of the listed values: fix it and deploy again. Any other message, including "Sign in first", means a function was saved under another function's folder: fix the files and deploy again.
