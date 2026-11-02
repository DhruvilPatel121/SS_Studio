# Checkout pages: browser helper, checkout hook and order history

Read this whole file, in one go, before writing any page with a Buy or Subscribe button, the payment result page or the order history. It contains, in order:

- **Browser helper**: [waffo-browser.ts](waffo-browser.ts), copied to `src/lib/waffo.ts`, and what it exports.
- **Checkout hook**: the complete `src/hooks/use-waffo-checkout.ts` and how a page renders it.
- **Result page and order history**: the payment result page, order history and test payments.

## Browser helper

Copy [waffo-browser.ts](waffo-browser.ts) with `mkdir -p src/lib && cp .skills/payment-waffo/references/waffo-browser.ts src/lib/waffo.ts`; do not retype, shorten or rewrite it. Call every Waffo function through it; never call Waffo from the browser and never call `supabase.functions.invoke` for a Waffo function yourself. Every function answers `{ code, message, data }`; the helpers return the inner `data` object or throw the function's message, so never read `status` or `verified` from the envelope itself. It exports:

- `OrderRow`, `SubscriptionRow`, `PaymentState`, `PaymentRef`: type rows of the example tables with these. Orders store `total_amount`, subscriptions `amount`; orders have no `amount` column.
- `formatMoney(amount, currency)`: show every amount with it (`formatMoney(row.total_amount, row.currency)` for orders, `formatMoney(row.amount, row.currency)` for subscriptions). Numeric columns may arrive as numbers or strings.
- `callWaffo(name, body)`: unwraps the envelope; the other helpers use it.
- `waffoReady(retry)`, `startCheckout(body)`, `waitForPayment(ref)`, `confirmPayment(params)`, `resumePending()`, `forgetPending(ref)`: used by the hook and the result page.
- `refreshOrders(rows)`: order history and admin orders pages pass their loaded rows through it before rendering.
- `syncSubscription(id)`, `cancelSubscription(id)`, `WAFFO_CUSTOMER_PORTAL`: membership page, see [subscriptions.md](subscriptions.md).
- `refundOrder(id)`: only from the administrator's Refund click, see [refunds.md](refunds.md).

Never call `waffo_config` or another Waffo function from an effect that depends on the user object or other changing state: a re-render loop floods Waffo with requests and blocks the whole page. A page that needs the user depends on `user?.id` (a string), calls `refreshOrders`, `syncSubscription` or `waffoReady()` once from that effect (they merge calls repeated within 5 seconds, and a successful `waffoReady()` is remembered for the page load), and never re-runs the effect on the rows or states they return.

## Checkout hook

Save as `src/hooks/use-waffo-checkout.ts` as written. Every page with a Buy or Subscribe button uses `useWaffoCheckout()` once and writes no checkout state of its own.

```tsx
// src/hooks/use-waffo-checkout.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/client/supabase";
import {
  forgetPending,
  resumePending,
  startCheckout,
  waffoReady,
  waitForPayment,
  type PaymentRef,
  type PaymentState,
} from "@/lib/waffo";

type Pending = { ref: PaymentRef; checkoutUrl: string | null; opened: boolean };
type CheckoutBody = Parameters<typeof startCheckout>[0];

// Checkout state of a page that has Buy or Subscribe buttons. Use it once in that page and render what it
// returns: `pending` is the "complete your payment" panel, `result` the outcome.
export function useWaffoCheckout() {
  const [ready, setReady] = useState<boolean | null>(null); // null while checking
  const [signInRequired, setSignInRequired] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [result, setResult] = useState<
    (PaymentState & { ref: PaymentRef }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  // Each checkout gets a number; an answer for an older one (a poll still running) is dropped.
  const run = useRef(0);
  const isReady = useRef(false);

  // Never call a Waffo function from an effect that depends on the user, the cart or other state: a re-render
  // loop would flood Waffo with requests. waffoReady() asks once per page load until it succeeds.
  const checkConfig = useCallback(async (retry = false) => {
    setReady(null);
    try {
      await waffoReady(retry);
      isReady.current = true;
      setReady(true);
      setSignInRequired(false);
      setConfigError(null);
    } catch (failure) {
      const status = (failure as { status?: number }).status;
      setReady(false);
      setSignInRequired(status === 401);
      setConfigError(status === 401 ? null : (failure as Error).message);
    }
  }, []);
  const retryConfig = useCallback(() => checkConfig(true), [checkConfig]);

  const show = useCallback(
    (id: number, ref: PaymentRef, state: PaymentState, opened = true) => {
      if (id !== run.current) return;
      setResult({ ...state, ref });
      setPending(
        state.status === "pending"
          ? { ref, checkoutUrl: state.checkoutUrl ?? null, opened }
          : null,
      );
    },
    [],
  );

  // A checkout this tab started earlier and has not seen the end of.
  const resume = useCallback(async () => {
    const id = run.current;
    const found = await resumePending();
    if (found) show(id, found.ref, found.state);
  }, [show]);

  useEffect(() => {
    checkConfig();
    resume();
    // Signing in on this page: ask again. Supabase calls must not run inside the auth callback itself.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" && !isReady.current)
        setTimeout(() => checkConfig(), 0);
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") resume();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      data.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [checkConfig, resume]);

  // Call it directly from the button's onClick, with nothing awaited before it.
  const start = useCallback(
    async (body: CheckoutBody) => {
      const id = ++run.current;
      setStarting(true);
      setError(null);
      setResult(null);
      setPending(null);
      try {
        const started = await startCheckout(body);
        if (id !== run.current) {
          forgetPending(started.ref); // closed while the checkout was being created
          return;
        }
        setPending({
          ref: started.ref,
          checkoutUrl: started.checkoutUrl,
          opened: started.opened,
        });
        setStarting(false);
        // Waffo returns the buyer only after "Done" is pressed there: this page finds out by itself.
        show(
          id,
          started.ref,
          await waitForPayment(started.ref, [5, 8, 13, 21, 34, 55]),
          started.opened,
        );
      } catch (failure) {
        if (id === run.current) setError((failure as Error).message);
      } finally {
        if (id === run.current) setStarting(false);
      }
    },
    [show],
  );

  // "Check payment status" button of the panel.
  const check = useCallback(async () => {
    if (!pending) return;
    const id = run.current;
    try {
      show(
        id,
        pending.ref,
        await waitForPayment(pending.ref, []),
        pending.opened,
      );
    } catch (failure) {
      if (id === run.current) setError((failure as Error).message);
    }
  }, [pending, show]);

  // "Close" button of the panel or the result: the buyer can start again; a late answer is dropped.
  const dismiss = useCallback(() => {
    run.current += 1;
    forgetPending();
    setStarting(false);
    setPending(null);
    setResult(null);
    setError(null);
  }, []);

  return {
    ready,
    signInRequired,
    configError,
    retryConfig,
    start,
    starting,
    pending,
    result,
    error,
    check,
    dismiss,
  };
}
```

- Buttons are enabled while `ready` is true, and also while `signInRequired` is true: then they read "Sign in to buy" and lead to the sign-in page, so visitors see prices and a way forward without an account. When `configError` is set, show it with a "Retry" button (`retryConfig`) so the merchant knows to configure Waffo.
- A button's `onClick` calls `start({ items })` or `start({ plan_id })` directly, with nothing awaited before it: the hook opens the new tab first and loads the hosted page into it. Do not navigate the app itself to the checkout page and do not embed it in an iframe. Disable the buttons while `starting` or while `pending` is set.
- While `pending` is set, render a "Complete your payment in the new tab" panel (not only a toast): when `pending.checkoutUrl` is set, an "Open the payment page" link to it (`target="_blank"`, the only way to pay when `pending.opened` is false); otherwise "Payment submitted, waiting for confirmation"; a "Check payment status" button (`check`); and a "Close" button (`dismiss`). Waffo returns the buyer to the app only when the buyer presses its "Done" button, so the page that started the checkout finds out by itself: the hook polls, and checks again on load and when the tab becomes visible.
- When `result` is set and not `pending`, show the outcome with a "Close" button (`dismiss`): success only when `result.verified`, "Payment not completed" for `canceled`. `result.ref` names the order or subscription that was paid: use it to show the details or open the result page, `"order_id" in result.ref ? "/payment-success?order=" + result.ref.order_id : "/payment-success?subscription=" + result.ref.subscription_id`; `pending` is already cleared by then. Show `error` when set: the function's own message (for example "You already have a subscription"), never a generic invoke error. Only when it says Waffo is not configured or rejected the credentials, tell the user to check `WAFFO_MERCHANT_ID` and `WAFFO_PRIVATE_KEY` in the Skill configuration.

## Result page and order history

- Payment result page at the success path (`/payment-success?order=<id>` or `?subscription=<id>`): call `confirmPayment` with the URL parameters; Waffo may need a few seconds to record the payment and the helper polls with growing pauses. Show confirmation only when `verified === true`. While the result is `pending`, show "Payment processing" with a "Check again" action that calls `waitForPayment` for the same id and, only when a `checkoutUrl` is returned, a "Continue payment" link to it; never start a second checkout for an order that may still be paid. When the result is `canceled` (declined or expired), say the payment was not completed and let the buyer start a new checkout. Without login this page is also the guest's confirmation: it shows only the order in its URL.
- Show a "Test payment" note when `testMode` is true, and mark order rows whose `test_mode` is true as test payments.
- With login, the app MUST have a purchase history page listing the signed-in user's orders (order number, amount, items, creation time, status). It is also where a payment the buyer never returned from is picked up. After loading the rows it MUST pass them through `refreshOrders(rows)` and render what that returns: it checks `pending`, `refund_pending` and recently `canceled` orders with Waffo (a payment can settle late) and adds `checkoutUrl` to the rows that can still be paid.
- Render the statuses as spelled in the examples: `pending` "Payment Pending" with "Check again" and, when a `checkoutUrl` is returned, "Continue payment"; `completed` "Payment Completed" with details and timestamp; `canceled` "Payment not completed" with a way to buy again; `refund_pending` "Refund processing"; `refunded` "Refunded".
- Without login there is no order history; `resumePending()` (called by the hook) recovers the checkout started in the same tab.
- After a cancel or refund call succeeds, update the page from the state the function returned; the user must not need to refresh to see it. Pages must work on mobile.
