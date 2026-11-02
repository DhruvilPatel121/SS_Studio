---
name: payment-paypal
description: Add PayPal one-time checkout, order recovery and admin refunds to Web apps. Use when the user asks for PayPal.
license: MIT
---

# PayPal payments

Use when the user asks for PayPal: "PayPal", "pay with PayPal", "PayPal checkout", "PayPal buttons". Any page that then accepts money, sells goods or services, or stores payment records uses this Skill. Use one payment provider per app.

## Architecture and configuration

Generate Supabase Edge Functions and an application order table. Edge Functions call PayPal Orders v2 directly with the merchant's credentials; payments do not pass through MeDo's API billing gateway. Supabase is the database and the authentication provider. Every PayPal REST call runs in an Edge Function; the browser only loads the public PayPal JS SDK, never calls `api-m.paypal.com` and never sees the Secret.

The official Skill record declares `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. Use the existing application Skill configuration form and credential distribution. Do not hardcode a plugin UUID/key, add platform-specific code, or register duplicate custom secret fields. The platform verifies credentials saved through the form before storing them. Runtime token acquisition and checkout initialization are still required.

The merchant may configure the credentials in the Skill configuration form (preferred; verified with PayPal before saving) or send them in chat. Only when the user has sent real values for BOTH `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in the conversation, write both in one `supabase_bulk_create_secrets` call and do not echo the Secret back. In every other case write nothing: the platform may already have copied the merchant's saved credentials into the app when the Skill was bound, and the configuration form saves its own values, so when the form returns or the user reports that configuration is done the values never reach you. Never write an empty, placeholder, masked or partial value; it replaces the working credentials. Never call `register_secrets` for these two fields, because the Skill record already declares them. Never create `PAYPAL_ENVIRONMENT` or any other PayPal secret. Functions read the credentials only with `Deno.env.get`; never hardcode or invent them.

Copy [paypal-client.ts](references/paypal-client.ts) to the generated app's `supabase/functions/_shared/paypal.ts`; you do not need to read it. It exports `getPayPalAccessToken()`, which returns `{ token, baseUrl, clientId, environment }`, and `paypalDebugId(response, body)`. Every PayPal call uses that token and `baseUrl`; never request a token or hardcode a PayPal host yourself. The helper tries Live first and tries Sandbox only for HTTP 401 with `error=invalid_client`; timeouts, rate limits, service failures and malformed replies fail closed, and a failed transaction never switches the environment.

## Before you build

Rules every app must keep are in this file; each reference starts with the rules for its part, which must hold too, followed by the complete functions or component. Read each reference whole, in one go, before writing the part it covers:

| File                                                | When                              | What it holds                                                                                          |
| --------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [setup.md](references/setup.md)                     | Before the first migration        | `orders` table, row-level security, `complete_paypal_order` with its `revoke`/`grant`; `paypal_config` |
| [create-order.md](references/create-order.md)       | Before `create_paypal_order`      | Server pricing, the pending row, PayPal order creation                                                 |
| [capture-order.md](references/capture-order.md)     | Before `capture_paypal_order`     | Ownership, the success rule, declined, duplicate and uncertain results                                 |
| [checkout-button.md](references/checkout-button.md) | Before any checkout or order page | Button behaviour, recovery of pending payments, order history, `PayPalButton.tsx`                      |
| [refunds.md](references/refunds.md)                 | Apps with login, before refunds   | Administrator gate, idempotent full refunds, `refund_paypal_capture`                                   |

Deploy the shared helper with these functions (`refund_paypal_capture` only when the app has login), then save each one at `supabase/functions/<name>/index.ts` and save the SQL files too:

| Function                | Responsibility                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `paypal_config`         | Verify credentials before enabling checkout; return public configuration only                             |
| `create_paypal_order`   | Authenticate buyer, calculate prices server-side, persist an order and create the PayPal order            |
| `capture_paypal_order`  | Verify ownership, capture/reconcile the same payment, atomically complete the local order and fulfillment |
| `refund_paypal_capture` | Apps with login only: require administrator authorization and reconcile full refunds                      |

## Payment rules

These hold in every app, whatever the references are adapted to:

- Prices and totals come from the database, computed in `create_paypal_order`; never from the browser. Products can be changed only by administrators.
- `create_paypal_order` inserts the `pending` row before calling PayPal and uses its id as `PayPal-Request-Id`. `capture_paypal_order` reuses the persisted `paypal_capture_request_id` on retries.
- A payment succeeded only when PayPal answers HTTP 200 or 201, the order and the capture are both `COMPLETED`, and the captured value and currency equal the order row. The browser approval callback only asks the server to capture; it never grants success.
- Unknown results (timeouts, HTTP 5xx, pending captures, database failures) keep the order `pending`; the buyer rechecks the same PayPal order. Never start a second payment while the first may have succeeded.
- The order becomes `completed`, and inventory or entitlements change, only inside the row-locked `complete_paypal_order` from setup.md, applied as written with its `revoke`. Only Edge Functions (service role) insert or update records that carry a payment.
- Refunds: `PayPal-Request-Id` is the order row id and the body stays `{}` on every retry; store `paypal_refund_id` as soon as it exists and query it on retry instead of creating a second refund; mark the order `refunded` only when the refund status is `COMPLETED`.
- Never log or return the Secret, the Basic authorization header or the access token; log PayPal's `debug_id` instead.
- No mock, demo, simulated or fallback payment path, in development too; Sandbox or Live is decided by the credentials, never by code branches. When configuration, the SDK or capture fails, show the error, and for configuration failures tell the user to check that `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are configured.

This release covers Web one-time payments and admin full refunds. It has no subscriptions, billing agreements, vaulting, partial refunds, Webhook receiver, or unattended background reconciliation. Buyer-initiated recovery and merchant reconciliation handle uncertain results. Before replacing a merchant account or environment, resolve existing payments and arrange old-order refunds; historical credentials are not bound to orders.

## Who may pay, see orders and refund

Login is recommended for payment apps. If the app has a login system, set `REQUIRE_LOGIN = true` in `paypal_config`, `create_paypal_order` and `capture_paypal_order`: they reject missing, invalid and anonymous sessions with HTTP 401, bind every order to the buyer, and capture rejects another buyer's order with HTTP 403 (including already completed orders). If no login/authentication exists, set `REQUIRE_LOGIN = false` for guest checkout: guest orders keep `user_id` null and are captured by their PayPal order id, which only the buyer's browser holds; an order with a `user_id` still accepts only its owner. Guests have no order history; the merchant reconciles anything else in the PayPal account. A game without login gets a trial area for visitors.

Payment records hold buyers' contact details. Buyers read only their own rows (`auth.uid() = user_id`); without login there is no SELECT policy on these tables. Without login, the confirmation page loads the record only by the order id the buyer's browser already holds (the local order id or PayPal order id). Do not add an order lookup page unless the user asked for one. If they did, an Edge Function requires the complete reference number and the email together, matches both exactly (no partial or fuzzy search) and returns only that record; never look a record up by email, phone, name or any other single value the buyer typed. A booking, ticket, donation or receipt number that the app generates and shows the buyer counts as such a single value: a short or date-based number can be guessed, so a function that returns buyers' details never accepts it alone. Public information such as taken time slots or remaining seats comes from an Edge Function that returns only those columns. Every function you write that runs without login and returns buyers' records (orders, bookings, contact details) requires the identifier it reads by (the order id, or the reference number and email for a lookup) and answers HTTP 400 when it is missing; it never returns a list, the most recent rows or every row instead. Functions for public information return only public columns and may return lists. The example functions already follow this. When a function call fails, show the error; do not fall back to reading the table from the browser.

Refunds belong to the administrator. With login, the app needs roles: follow the login setup's "roles/admin" step (example administrator account, `get_user_role`, profile policies) right after the auth migration, and use those roles: `profiles.role` (`user_role` enum), the example administrator account it creates, and its profile policies, under which users edit their own row except `role`. Do not add another role table, role column or trigger on `auth.users`. `refund_paypal_capture` checks `profiles.role = 'admin'` with the service role client before reading the order, so a user who could change their own role could refund any order; the policy check below judges that. Tell the owner in your closing summary which account is the administrator. The same holds for every function you write, beyond the example functions, that changes an order after it is created (shipping, fulfillment, cancellation, status): it checks `profiles.role = 'admin'` first, like `refund_paypal_capture`. Without login there is no administrator: do not build admin pages or functions that list, change or delete records (orders, bookings, registrations, products), even when they would be convenient; the merchant handles orders in the PayPal account and asks MeDo to change the catalog. When the user asks for an owner or admin area, add login with the login setup's "roles/admin" step and set `REQUIRE_LOGIN = true` instead of dropping the feature. Buyers never cancel an order themselves, with or without login, because it may already be paid. Never guard a function with a hardcoded key, passcode or password; only `profiles.role = 'admin'` identifies an administrator.

### Policy check right after the migrations

Run this check with `supabase_execute_sql` as soon as the migrations are applied, before writing the Edge Functions and pages, and again after any later schema change. It reads every table, view, policy and browser-callable function in `public`, so tables named differently from the examples are covered, and marks each row:

```sql
with t as (
  select c.relname as tbl, c.relkind as kind, c.relrowsecurity as rls,
         coalesce(array_to_string(c.reloptions, ','), '') ~ 'security_invoker=(true|on|1)' as invoker,
         bool_or(a.attname ~* '(paypal|payment|paid|capture|refund)')
           or (c.relname ~* '(order|book|reserv|regist|ticket|enrol|appoint|signup)'
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
            when p.proname = 'get_user_role' then 'ok' else 'REVIEW' end,
       'browser can run', p.proname, 'EXECUTE', ''
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype
  and (has_function_privilege('anon', p.oid, 'EXECUTE')
       or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
order by verdict, item, name;
```

- `FIX`: a browser can write payment records, read other buyers' payment or contact details (through a table or a view), change its own role, or run a function that completes a payment, changes payment status or grants what was bought; or a table holding such data has no row level security. Apply a migration that removes or rewrites it, then run the check again: writes on payment records only through the service role; owner reads as their own policy, `auth.uid() = <owner column>`; administrator reads as a separate policy using `get_user_role(auth.uid()) = 'admin'` or `exists (select 1 from profiles where id = auth.uid() and role = 'admin')`; the role kept unchanged on self-updates; `revoke` on a function that changes data (a function that only reads gets `stable` instead of a revoke, so pages and policies can still call it); `security_invoker = true` on the view, or no view. Do not continue while any `FIX` row remains, and never rename columns or drop row level security to make a row disappear.
- `REVIEW`: judge it against "Who may pay, see orders and refund". A rule that lets anyone read rows by status, such as `true` or `payment_status = 'completed'`, fails even when the page selects only harmless columns. A function that changes orders, inventory, credits or entitlements is a `FIX`.
- `ok` only means no payment, contact or role column was found; an order, booking, registration or ticket table with a status column and buyer contact columns counts as a payment record. Tables or columns holding what buyers paid for (credits, premium flags, enrollments, tickets, bookings whose status or amount columns are named differently) follow the same rules as payment records: browsers never write them.

## Build steps

1. Set up Supabase and the login system with the login components MeDo provides, when the app has login, including its "roles/admin" step right after the auth migration, because refunds need an administrator.
2. Read setup.md and apply the migrations with `supabase_apply_migration`. Immediately run the policy check from the Skill ("Policy check right after the migrations") with `supabase_execute_sql` and fix every `FIX` row, rerunning the check, before writing Edge Functions.
3. Read create-order.md and capture-order.md (and refunds.md with login), then write and deploy the functions with `supabase_deploy_edge_function`. Right after deploying any function that is not one of the examples (lookups, availability, admin actions), check it against "Who may pay, see orders and refund" and the completion list before writing the next one.
4. Credentials. If the user has provided BOTH real PayPal credentials in chat, use the `supabase_bulk_create_secrets` tool once to add `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` together. If credentials not provided, write nothing and add reminder in user summary.
5. Read checkout-button.md, then build the checkout, confirmation and order pages (and the admin refund button with login).
6. Generate the app before asking the merchant to configure it. When the configuration form returns, continue with the code; do not save, re-save or test credentials by writing secrets.

## Completion

If the user has not provided credentials, remind them in the final summary to configure PayPal through the existing Skill configuration button or the PayPal card in the application Skill panel; do not invent a settings route or promise a button after every response. Never send the merchant to a Supabase dashboard or an Edge Function secrets page; merchants have no access to one. Tell them to open the PayPal Developer Dashboard → **Apps & Credentials**, create or open a REST app, and paste its **Client ID** and **Secret** into the configuration form (or send both in chat); a Sandbox app is for testing with sandbox buyer accounts, a Live app accepts real payments. Copied apps configure their own credentials through the same flow.

Before finishing, check the generated code against this list. Fix anything that fails, then check again:

- No mock, demo, simulated or fallback payment path. When configuration, the SDK or capture fails, show the error and keep the record pending.
- Prices and totals are computed in `create_paypal_order` from the database; nothing the browser sends sets an amount.
- An order is paid only after HTTP 200 or 201, `COMPLETED` order and capture, and a captured value and currency equal to the order row; unknown results stay `pending` and never lead to a second payment.
- No Secret, Basic authorization header or access token in logs, responses or browser code.
- Only Edge Functions create or update records that carry a payment (orders, bookings, registrations, tips, donations): these tables have no browser INSERT or UPDATE policy, and `create_paypal_order` creates the record.
- Browsers never read other buyers' contact details. Without login there is no public SELECT policy on these tables; pages show the result returned by `capture_paypal_order`, and the confirmation page loads the record only by the order id the buyer's browser already holds. No order lookup page unless the user asked for one, and then only by the complete reference number and email together; a booking or ticket number the app generated is never enough on its own.
- PayPal payer details (name, email) go to their own columns; never overwrite contact details the buyer entered in the app.
- The SQL in setup.md is applied as written, including the `revoke` on `complete_paypal_order`.
- The policy check under "Policy check right after the migrations" shows no `FIX` row after the last schema change.
- Every function you wrote that is callable without login and returns buyers' records rejects a missing identifier with HTTP 400 and never returns a list.
- Functions you wrote, beyond the example functions, that change an order after creation (shipping, fulfillment, cancellation, status) exist only with login and reject non-administrators first. Without login there is no admin page or admin function at all (an owner area the user asked for means adding login), and no function is guarded by a hardcoded key or password.
- With login, `refund_paypal_capture` rejects non-administrators before reading the order, nobody can change their own role, and a retried refund queries the stored `paypal_refund_id` instead of refunding again. Without login, do not deploy it; the merchant refunds in the PayPal account.
- `createOrder` sends the buyer's current inputs: rebuild the buttons when they change, and validate required fields before creating the order.
- The closing summary says whether checkout needs sign-in, who can refund, and, if credentials are missing, how to configure PayPal.
