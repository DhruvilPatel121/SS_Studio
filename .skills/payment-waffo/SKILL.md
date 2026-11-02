---
name: payment-waffo
description: Add Waffo Pancake hosted checkout, subscriptions, payment verification and admin refunds to Web apps. Use only when the user names Waffo or Waffo Pancake.
license: MIT
---

# Waffo Pancake payments

Use only when the user names Waffo or Waffo Pancake: "Waffo", "Waffo Pancake", "pay with Waffo", "Waffo checkout". Any page that then accepts money, sells goods, services or memberships, or stores payment records uses this Skill. Use one payment provider per app.

Waffo Pancake is a merchant of record: Waffo is the seller on the buyer's receipt, is responsible for sales tax, emails the receipt to the buyer and pays the merchant out. The buyer pays on a Waffo-hosted checkout page with cards, digital wallets and local payment methods.

## Architecture and configuration

Generate Supabase Edge Functions and application order tables. Edge Functions call Waffo directly with the merchant's credentials; payments do not pass through MeDo's API billing gateway. Supabase is the database and the authentication provider. Every Waffo call runs in an Edge Function; requests are signed with the merchant's RSA Private Key, the browser never calls `api.waffo.ai`, never sees the key and only opens the hosted checkout page the server returns.

The official Skill record declares `WAFFO_MERCHANT_ID` and `WAFFO_PRIVATE_KEY`. Use the existing application Skill configuration form and credential distribution. Do not hardcode a plugin UUID/key, add platform-specific code, or register duplicate custom secret fields. The platform verifies credentials saved through the form with Waffo before storing them.

The merchant may configure the credentials in the Skill configuration form (preferred; verified before saving) or send them in chat. Only when the user has sent real values for BOTH `WAFFO_MERCHANT_ID` and `WAFFO_PRIVATE_KEY` in the conversation, write both in one `supabase_bulk_create_secrets` call and do not echo the Private Key back. In every other case write nothing: the platform may already have copied the merchant's saved credentials into the app when the Skill was bound, and the configuration form saves its own values, so when the form returns or the user reports that configuration is done the values never reach you. Never write an empty, placeholder, masked or partial value; it replaces the working credentials. Never call `register_secrets` for these two fields, because the Skill record already declares them. Never create a Waffo environment, store or product secret. Functions read the credentials only with `Deno.env.get`; never hardcode or invent them.

A Waffo API key belongs to either the test or the production environment, chosen when the key is created; the same code serves both. Test keys work immediately. Production payments require the merchant's Waffo store to pass Waffo's business review first; until then a production key is refused at checkout with a message that says so. The two environments keep separate orders, subscriptions and products: records made with a test key stay in the app as test records after the merchant switches to the production key.

Copy [waffo-client.ts](references/waffo-client.ts) with `mkdir -p supabase/functions/_shared && cp .skills/payment-waffo/references/waffo-client.ts supabase/functions/_shared/waffo.ts` (and [waffo-browser.ts](references/waffo-browser.ts) to `src/lib/waffo.ts` the same way), then change only the constants setup.md names; never retype, shorten or rewrite these two files. It signs requests through the pinned `npm:@waffo/pancake-ts` SDK, resolves the merchant's store, finds or creates the few Waffo products the app needs, and looks orders up by the app's own order id.

There is no Webhook receiver: Waffo cannot attach the `Authorization` header that Supabase Edge Functions require. The app learns about payments, renewals, failed renewals and refunds only when `verify_waffo_payment` runs, so the rules in checkout-pages.md on when pages call it are part of payment correctness, not presentation.

## Before you build

Rules every app must keep are in this file; each reference starts with the rules for its part, which must hold too, followed by the complete functions, tables or hook. Read each reference whole, in one go, before writing the part it covers:

| File                                                | When                                                                             | What it holds                                                                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [setup.md](references/setup.md)                     | Before the first migration                                                       | `orders` and `waffo_catalog` tables, row-level security, `complete_waffo_order` with its `revoke`/`grant`; helper constants; `waffo_config` |
| [create-checkout.md](references/create-checkout.md) | Before `create_waffo_checkout`                                                   | Server pricing, the pending row, the hosted checkout and its success URL                                                                    |
| [verify-payment.md](references/verify-payment.md)   | Before `verify_waffo_payment`                                                    | Ownership, the success rule, expired, failed and late payments, refunds in progress, subscription sync                                      |
| [checkout-pages.md](references/checkout-pages.md)   | Before any page with a Buy or Subscribe button, the result page or order history | The browser helper [waffo-browser.ts](references/waffo-browser.ts), the `useWaffoCheckout` hook, page rules                                 |
| [subscriptions.md](references/subscriptions.md)     | Apps that sell subscriptions, before adding plans                                | `plans`, `subscriptions`, `has_active_subscription`, `cancel_waffo_subscription`, the membership page                                       |
| [refunds.md](references/refunds.md)                 | Apps with login, before the first migration's admin policy and before refunds    | Administrator gate, the admin policy, `refund_waffo_payment`, the Refund button                                                             |

Deploy the shared helper with these functions, then save each one at `supabase/functions/<name>/index.ts`, the helper at `supabase/functions/_shared/waffo.ts`, and save the SQL files too:

| Function                    | Responsibility                                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `waffo_config`              | Verify credentials before enabling checkout                                                                                                                                   |
| `create_waffo_checkout`     | Authenticate the buyer, calculate prices server-side, persist a pending order or subscription and open a hosted checkout page for it                                          |
| `verify_waffo_payment`      | Verify ownership, read the payment or subscription state from Waffo by the local id, check amount and currency, complete the order atomically, and keep subscriptions in sync |
| `cancel_waffo_subscription` | Only when the app sells subscriptions: the owner cancels at period end                                                                                                        |
| `refund_waffo_payment`      | Apps with login only: require administrator authorization and request a full refund                                                                                           |

## Payment rules

These hold in every app, whatever the references are adapted to:

- Prices and totals come from the database, computed in `create_waffo_checkout`; never from the browser. Products and plans can be changed only by administrators or the merchant.
- `create_waffo_checkout` inserts the `pending` row before calling Waffo; its id is the Waffo reference (`orderMerchantExternalId`) and the only link between the app and the Waffo order. Waffo redirects the buyer to the success URL only when the buyer presses its "Done" button and adds no parameter, so the success URL carries that id.
- A one-time payment succeeded only when the Waffo order looked up by that id is `completed`, has a `succeeded` payment, and its total and currency equal the order row. The success redirect and the browser never grant success; `verify_waffo_payment` decides.
- Unknown results (a checkout still open, a payment still on its way, Waffo or database failures) keep the order `pending`. Never start a second checkout while the first may still be paid.
- The order becomes `completed`, and inventory or entitlements change, only inside the row-locked `complete_waffo_order` from setup.md, applied as written with its `revoke`. Only Edge Functions (service role) insert or update records that carry a payment.
- Refunds: Waffo keeps one refund per payment; `refund_waffo_payment` reads the existing refund before opening one, marks the order `refund_pending`, and only `verify_waffo_payment` marks it `refunded` once Waffo reports the whole payment refunded. Waffo accepts refunds only within 14 days of the payment.
- Paid features of subscriptions are gated on the server with `has_active_subscription`, not only in the UI.
- Never log or return the Private Key, request signatures or request headers.
- No mock, demo, simulated or fallback payment path, in development too; test or production is decided by the configured API key, never by code branches. The same holds for what follows a payment: no demo or simulator that advances an order, shipping, tracking or delivery status. Pages show the status the database holds; when the user wants buyers to see shipping, the merchant's updates come from an admin page (with login) or are added on request. When the credentials are missing or rejected, every function returns a clear error telling the merchant to configure Waffo; when a function fails, the page shows the message it returned.

This release covers Web one-time payments, subscriptions with cancellation at period end, and admin full refunds of one-time orders. It has no Webhook receiver, partial refunds, refunds of subscription payments, plan switching, trials or usage-based billing.

## Who may pay, see orders and refund

Login is recommended for payment apps. If the app has a login system, set `REQUIRE_LOGIN = true` in `waffo_config`, `create_waffo_checkout` and `verify_waffo_payment`: they reject missing, invalid and anonymous sessions with HTTP 401, bind every order to the buyer, and verification rejects another buyer's order and an order without an owner with HTTP 403. If no login/authentication exists, set `REQUIRE_LOGIN = false` for guest checkout of one-time orders: guest orders keep `user_id` null and are verified by their order id, which only the buyer's browser holds (in the success URL and the tab's session storage); an order with a `user_id` still accepts only its owner. Guests have no order history; the merchant reconciles anything else in the Waffo dashboard. Subscriptions need an account: an app that sells subscriptions must have login.

Payment records hold buyers' contact details. Buyers read only their own rows (`auth.uid() = user_id`); without login there is no public SELECT policy on these tables. Without login, the result page loads the record only by the order id the buyer's browser already holds. Do not add an order lookup page unless the user asked for one. If they did, an Edge Function requires the complete reference number and the email together, matches both exactly (no partial or fuzzy search) and returns only that record; never look a record up by email, phone, name or any other single value the buyer typed. A booking, ticket, donation or receipt number that the app generates and shows the buyer counts as such a single value: a short or date-based number can be guessed, so a function that returns buyers' details never accepts it alone. Public information such as taken time slots or remaining seats comes from an Edge Function that returns only those columns. Every function you write that runs without login and returns buyers' records (orders, bookings, contact details) requires the identifier it reads by (the order id, or the reference number and email for a lookup) and answers HTTP 400 when it is missing; it never returns a list, the most recent rows or every row instead. Functions for public information return only public columns and may return lists. The example functions already follow this. When a function call fails, show the error; do not fall back to reading the table from the browser.

Refunds belong to the administrator. With login, the app needs roles: follow the login setup's "roles/admin" step (example administrator account, `get_user_role`, profile policies) right after the auth migration, and use those roles: `profiles.role` (`user_role` enum), the example administrator account it creates, and its profile policies, under which users edit their own row except `role`. Do not add another role table, role column or trigger on `auth.users`. `refund_waffo_payment` checks `profiles.role = 'admin'` with the service role client before reading the order, so a user who could change their own role could refund any order; the policy check below judges that. Tell the owner in your closing summary which account is the administrator. The same holds for every function you write, beyond the example functions, that changes an order after it is created (shipping, fulfillment, cancellation, status): it first checks, with the service role client, that the caller has an app role allowed to do it (`profiles.role = 'admin'`, or a staff or seller value the app adds to the `user_role` enum; such staff read orders through an Edge Function that checks the role, not through a new row-level security policy), like `refund_waffo_payment`. Without login there is no administrator: do not build admin pages or functions that list, change or delete records (orders, bookings, registrations, products), including shipping, tracking or status updates, even when they would be convenient; the merchant handles orders in the Waffo dashboard and asks MeDo to change the catalog. When the user asks for an owner or admin area, add login with the login setup's "roles/admin" step and set `REQUIRE_LOGIN = true` instead of dropping the feature. Buyers never cancel an order themselves, with or without login, because it may already be paid; subscribers cancel only the renewal, through `cancel_waffo_subscription`. Never guard a function with a hardcoded key, passcode or password; only `profiles.role = 'admin'` identifies an administrator.

### Policy check right after the migrations

Run this check with `supabase_execute_sql` as soon as the migrations are applied, before writing the Edge Functions and pages, and again after any later schema change. It reads every table, view, policy and browser-callable function in `public`, so tables named differently from the examples are covered, and marks each row:

```sql
with t as (
  select c.relname as tbl, c.relkind as kind, c.relrowsecurity as rls,
         coalesce(array_to_string(c.reloptions, ','), '') ~ 'security_invoker=(true|on|1)' as invoker,
         bool_or(a.attname ~* '(waffo|checkout|payment|paid|capture|refund)')
           or (c.relname ~* '(order|book|reserv|regist|ticket|enrol|appoint|signup|subscri)'
               and bool_or(a.attname ~* 'status') and bool_or(a.attname ~* '(email|phone)')) as pay,
         bool_or(a.attname ~* '(email|phone)') as contact,
         bool_or(a.attname = 'role') as roles
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')
  group by c.relname, c.relkind, c.relrowsecurity, c.reloptions
), p as (
  select t.*, pol.policyname, pol.cmd, pol.roles::text as grantees,
         regexp_replace(coalesce(pol.qual, ''), '\( SELECT auth\.uid\(\) AS uid\)', 'auth.uid()', 'g') as q,
         regexp_replace(coalesce(pol.with_check, ''), '\( SELECT auth\.uid\(\) AS uid\)', 'auth.uid()', 'g') as w
  from pg_policies pol join t on t.tbl = pol.tablename
  where pol.schemaname = 'public'
)
select case
         when (grantees like '%service_role%' or q || w like '%service_role%') and q || w !~* '\mor\M' then 'ok'
         when cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL') and pay then 'FIX'
         when cmd = 'SELECT' and q ~ '^\((auth\.uid\(\) = \w+|\w+ = auth\.uid\(\))\)$' then 'ok'
         when q ~ 'auth\.uid\(\)' and q ~* 'role(\(auth\.uid\(\)\))? = ''admin''' and q !~* '\mor\M' and w in ('', q) then 'ok'
         when cmd in ('SELECT', 'ALL') and (pay or contact) then 'FIX'
         when roles and cmd = 'UPDATE' and q ~ '^\((auth\.uid\(\) = id|id = auth\.uid\(\))\)$' and w ~ 'role' then 'ok'
         when roles and cmd in ('INSERT', 'UPDATE') and w !~ 'role' then 'FIX'
         when pay or contact or roles then 'REVIEW'
         else 'ok'
       end as verdict,
       'policy' as item, tbl || '.' || policyname as name, cmd, regexp_replace(q || ' | ' || w, '\s+', ' ', 'g') as rule
from p
union all
select 'FIX', 'table without row level security', tbl, '', ''
from t where kind = 'r' and not rls and (pay or contact or roles)
union all
select case when (pay or contact) and not invoker then 'FIX' else 'REVIEW' end,
       'browser can read view', tbl, 'SELECT', ''
from t where kind in ('v', 'm')
  and (has_table_privilege('anon', 'public.' || quote_ident(tbl), 'SELECT')
       or has_table_privilege('authenticated', 'public.' || quote_ident(tbl), 'SELECT'))
union all
select case when p.provolatile = 'v' and p.proname ~* '(complete|paid|payment|refund|capture|status|fulfil|credit|entitle|premium|subscri)' then 'FIX'
            when p.proname in ('get_user_role', 'has_active_subscription') then 'ok' else 'REVIEW' end,
       'browser can run', p.proname, 'EXECUTE', ''
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype
  and (has_function_privilege('anon', p.oid, 'EXECUTE')
       or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
order by verdict, item, name;
```

- `FIX`: a browser can write payment or subscription records, read other buyers' payment or contact details (through a table or a view), change its own role, or run a function that completes a payment, changes payment status or grants what was bought; or a table holding such data has no row level security. Apply a migration that removes or rewrites it, then run the check again: writes on payment records only through the service role; owner reads as their own policy, `auth.uid() = <owner column>`; administrator reads as a separate policy using `get_user_role(auth.uid()) = 'admin'` or `exists (select 1 from profiles where id = auth.uid() and role = 'admin')`; the role kept unchanged on self-updates; `revoke` on a function that changes data (a function that only reads gets `stable` instead of a revoke, so pages and policies can still call it); `security_invoker = true` on the view, or no view. Do not continue while any `FIX` row remains, and never rename columns or drop row level security to make a row disappear.
- `REVIEW`: judge it against "Who may pay, see orders and refund". A rule that lets anyone read rows by status, such as `true` or `payment_status = 'completed'`, fails even when the page selects only harmless columns. A function that changes orders, inventory, credits or entitlements is a `FIX`.
- `ok` only means no payment, contact or role column was found; an order, booking, registration, ticket or subscription table with a status column and buyer contact columns counts as a payment record. Tables or columns holding what buyers paid for (credits, premium flags, enrollments, tickets, bookings whose status or amount columns are named differently) follow the same rules as payment records: browsers never write them.

## Build steps

1. Set up Supabase and the login system with the login components MeDo provides, when the app has login, including its "roles/admin" step right after the auth migration, because refunds need an administrator.
2. Read setup.md (and subscriptions.md when the app sells subscriptions, refunds.md when it has login) and apply the migrations with `supabase_apply_migration`. Immediately run the policy check from the Skill ("Policy check right after the migrations") with `supabase_execute_sql` and fix every `FIX` row, rerunning the check, before writing Edge Functions.
3. Copy the shared helper and set its constants. Read create-checkout.md and verify-payment.md (refunds.md with login), then write and deploy the functions one by one with `supabase_deploy_edge_function`. The first line of every `index.ts` names its own folder (`// waffo_config/index.ts` in `supabase/functions/waffo_config/`): a function saved under another function's name answers with that function's errors and breaks checkout. After deploying, call `waffo_config` once as setup.md says. Right after deploying any function that is not one of the examples (lookups, availability, shipping or status updates, admin actions), check it against "Who may pay, see orders and refund" and the completion list before writing the next one.
4. Credentials. If the user has provided BOTH real Waffo credentials in chat, use the `supabase_bulk_create_secrets` tool once to add `WAFFO_MERCHANT_ID` and `WAFFO_PRIVATE_KEY` together. If credentials not provided, write nothing and add reminder in user summary.
5. Read checkout-pages.md, then copy the browser helper and the hook and build the checkout, result and order pages (the membership page with subscriptions, the admin orders page and Refund button with login).
6. Generate the app before asking the merchant to configure it. When the configuration form returns, continue with the code; do not save, re-save or test credentials by writing secrets.

## Completion

If the user has not provided credentials, remind them in the final summary to configure Waffo through the existing Skill configuration button or the Waffo card in the application Skill panel; do not invent a settings route or promise a button after every response. Never send the merchant to a Supabase dashboard or an Edge Function secrets page; merchants have no access to one. Tell them to:

1. Sign in to the Waffo Pancake dashboard, create a store there if the account has none yet, and open **API & Development**.
2. Copy the **Merchant ID** shown above the key list, then create an API key. Choose **Test mode** to try payments with test cards, or **Production mode** for real payments. The Private Key is shown only once.
3. Paste both values into the Skill configuration form (or send both in chat). New or changed credentials are verified with Waffo before saving.

Real payments need a production key AND the merchant's Waffo store to pass Waffo's review; until then a production key is refused at checkout. Test mode needs no review; in test mode use the test cards on the checkout page. For the review Waffo expects the published app to be reachable without signing in, to show its prices before checkout, to have Terms and Privacy pages, to show a support email, and the merchant to verify that email and the app's domain in the Waffo dashboard. Mention this once and offer to add the Terms and Privacy pages, the support email and Waffo's domain verification tag when the merchant is ready to go live. Before the merchant replaces a test key with the production key, remind them that test orders and subscriptions stay in the app as test records. Copied apps configure their own credentials through the same flow.

Before finishing, check the generated code against this list. Fix anything that fails, then check again:

- No mock, demo, simulated or fallback payment path, and no demo function that advances order, shipping or delivery status. When configuration, checkout or verification fails, show the function's message and keep the record pending.
- Prices and totals are computed in `create_waffo_checkout` from the database; nothing the browser sends sets an amount.
- An order is paid only after `verify_waffo_payment` finds a `completed` Waffo order with a `succeeded` payment whose total and currency equal the order row; the success page shows success only when `verified === true`, and an order that may still be paid never gets a second checkout.
- No Private Key, request signature or request header in logs, responses or browser code; the browser calls Waffo functions only through `src/lib/waffo.ts`.
- Only Edge Functions create or update records that carry a payment (orders, subscriptions, bookings, registrations, tips, donations): these tables have no browser INSERT or UPDATE policy, and `create_waffo_checkout` creates the record.
- Browsers never read other buyers' contact details. Without login there is no public SELECT policy on these tables, and the result page loads the record only by the order id the buyer's browser already holds. No order lookup page unless the user asked for one, and then only by the complete reference number and email together.
- The SQL in setup.md is applied as written, including the `revoke` on `complete_waffo_order`.
- The policy check under "Policy check right after the migrations" shows no `FIX` row after the last schema change.
- Every function you wrote that is callable without login and returns buyers' records rejects a missing identifier with HTTP 400 and never returns a list.
- Functions you wrote, beyond the example functions, that change an order after creation (shipping, fulfillment, cancellation, status) exist only with login and reject callers without an allowed role first. Without login there is no admin page or admin function at all (an owner area the user asked for means adding login), and no function is guarded by a hardcoded key or password.
- With login, `refund_waffo_payment` rejects non-administrators before reading the order, nobody can change their own role, and the Refund button is the only caller. Without login, do not deploy it; the merchant refunds in the Waffo dashboard.
- No Waffo function is called from an effect that depends on the user object or other changing state; pages with Buy or Subscribe buttons use `useWaffoCheckout()` and order lists pass through `refreshOrders(rows)`.
- The closing summary says whether checkout needs sign-in, who can refund, and, if credentials are missing, how to configure Waffo.
