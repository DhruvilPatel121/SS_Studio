# Subscriptions: plans, membership and `cancel_waffo_subscription`

Read this whole file, in one go, before adding plans. Only apps that sell subscriptions need it, and they must have login: a subscription needs an account to attach access to. It contains, in order:

- **Rules**: what subscriptions cover, how paid access is gated, and the membership page.
- **Plans and subscriptions tables**: `plans`, `subscriptions`, their row-level security and `has_active_subscription`. Apply after the orders table from [setup.md](setup.md), then run the policy check in SKILL.md again.
- **`cancel_waffo_subscription`**: the complete `cancel_waffo_subscription/index.ts`.

## Rules

- Subscriptions renew each period with cancellation at period end. There is no plan switching, trial, usage-based billing or refund of subscription payments.
- Plans are changed only by administrators or the merchant. Do not edit the price or billing period of a plan that has been offered: deactivate it and add a new plan.
- Gate paid features on the server with `has_active_subscription(auth.uid())` in row-level security policies or Edge Functions, not only in the UI. Access comes from the subscription state alone; do not hand out per-period benefits (credits, quotas) from an Edge Function, because no event tells the app that a renewal happened.
- `create_waffo_checkout` and `verify_waffo_payment` already contain the subscription branches; keep them.
- `cancel_waffo_subscription`: the owner cancels their subscription. Waffo moves it to `canceling`: it stays active until the paid period ends and does not renew. Never revoke access at the cancel time. A repeated call reads the current state instead of failing; when Waffo did not cancel, report the failure instead of success.
- Membership page: shows the plan, status and "Renews on" / "Access until" date, a "Cancel subscription" action that calls `cancelSubscription` and renders the state it returns right away, and a "Manage billing at Waffo" link to `WAFFO_CUSTOMER_PORTAL` (payment method, invoices, resuming a canceled renewal; the buyer signs in with the email used at checkout). For `past_due`, say that the last renewal payment failed and point to the same link.
- Whenever the membership page opens, and on app load when the user's latest subscription is `pending`, `past_due` or its `current_period_end` is in the past, call `syncSubscription(subscription.id)` from an effect that depends on `user?.id`, and render what it returns. This is how renewals, failed renewals and changes the buyer made at Waffo reach the app.
- One subscription per user: while the user's subscription is `active`, `canceling` or `past_due`, do not offer "Subscribe" on any plan (the function answers HTTP 409). Mark the current plan, disable the other plans' buttons and say that switching plans is not available; a new plan can be chosen after the current one ends.

## Plans and subscriptions tables

```sql
create table public.plans (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    price numeric(12,2) not null,
    billing_period text not null check (billing_period in ('weekly', 'monthly', 'quarterly', 'yearly')),
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);
alter table public.plans enable row level security;
create policy "Anyone views active plans" on public.plans for select using (is_active);
-- Do not edit the price or billing period of a plan that has been offered: deactivate it and add a new plan row.

create table public.subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    plan_id uuid not null references public.plans(id),
    amount numeric(12,2) not null,
    currency text not null,
    status text not null default 'pending'
        check (status in ('pending', 'active', 'canceling', 'past_due', 'canceled')),
    waffo_session_id text,
    checkout_url text,
    checkout_expires_at timestamptz,
    waffo_order_id text unique,
    current_period_end timestamptz,
    will_renew boolean,
    test_mode boolean,
    created_at timestamptz not null default now()
);
create index idx_subscriptions_user_id on public.subscriptions(user_id);
alter table public.subscriptions enable row level security;
create policy "Users view their own subscriptions" on public.subscriptions for select using (auth.uid() = user_id);

-- Paid access: a subscription whose paid period has not ended. One extra day covers the hours between the end of
-- a period and the renewal reaching the app, and the day Waffo retries a failed renewal (past_due).
create or replace function public.has_active_subscription(p_user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from public.subscriptions
         where user_id = p_user_id and status in ('active', 'canceling', 'past_due')
           and current_period_end + interval '1 day' > now()
    );
$$;
```

## `cancel_waffo_subscription`

Save as `supabase/functions/cancel_waffo_subscription/index.ts` and deploy it as `cancel_waffo_subscription`.

```ts
// cancel_waffo_subscription/index.ts
import {
  cancelWaffoSubscription,
  corsHeaders,
  currentUser,
  fail,
  findSubscriptionOrders,
  ok,
  supabase,
  waffoMessage,
} from "../_shared/waffo.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  try {
    const user = await currentUser(req);
    if (!user) return fail("Sign in first", 401);
    const { subscription_id } = await req.json();
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", subscription_id)
      .maybeSingle();
    if (!subscription) return fail("Subscription not found", 404);
    if (subscription.user_id !== user.id)
      return fail("Not your subscription", 403);
    if (!subscription.waffo_order_id)
      return fail("Subscription is not active yet", 409);

    await cancelWaffoSubscription(subscription.waffo_order_id);
    const remote = (await findSubscriptionOrders(subscription.id)).find(
      (item) => item.id === subscription.waffo_order_id,
    );
    if (!remote) throw new Error("Subscription not found at Waffo");
    // "canceling" keeps access until the paid period ends; never revoke access at the cancel time.
    const status =
      remote.status === "canceling"
        ? "canceling"
        : ["canceled", "closed", "expired"].includes(remote.status)
          ? "canceled"
          : null;
    if (!status)
      return fail(
        "Waffo did not cancel the subscription. Try again, or cancel it in the Waffo customer portal.",
        409,
      );
    await supabase
      .from("subscriptions")
      .update({
        status,
        will_renew: remote.willRenew,
        current_period_end: remote.currentPeriodEnd,
      })
      .eq("id", subscription.id);
    return ok({
      status,
      verified: status === "canceling",
      currentPeriodEnd: remote.currentPeriodEnd,
      willRenew: remote.willRenew,
    });
  } catch (error) {
    console.error("Waffo cancel failed:", waffoMessage(error));
    return fail(waffoMessage(error), 500);
  }
});
```
