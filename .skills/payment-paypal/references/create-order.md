# Checkout pages: PayPal button and order history

Read this whole file, in one go, before writing any page that takes a payment or shows orders. It contains, in order:

- **Rules**: how the button loads, creates and captures orders, what the buyer sees, and the order history page.
- **Component**: the complete `src/components/PayPalButton.tsx`. Adapt the cart shape and the success handling to the actual pages.

## Rules

- PayPal Buttons replace the "Buy" or "Checkout" button. The component calls `paypal_config` first and renders nothing payable until it succeeds. It then loads `https://www.paypal.com/sdk/js?client-id=<clientId>&currency=<currency>&intent=capture` once; Sandbox and Live use the same URL, the Client ID decides. Show Sandbox or Live next to checkout.
- `createOrder` calls `create_paypal_order` with the buyer's current inputs and returns the PayPal order id. Rebuild the buttons when those inputs change, and validate required fields first.
- `onApprove` stores the PayPal order id in sessionStorage BEFORE calling `capture_paypal_order`. On `restart: true` it returns `actions.restart()`. It shows a confirmation only when `verified === true` and then refreshes the order list. For `pending: true` or an error it keeps the id and offers "Check payment status" for the same order; it never starts a replacement checkout.
- `onError` shows a clear error. When configuration fails, tell the user to check that `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are configured.
- Never redirect to PayPal and never call the PayPal REST API from the browser; the SDK popup keeps the buyer on the page. If the buyer closes the popup, the order stays `pending` and they can retry.
- Render the component with a stable `paymentScope` of app plus buyer id (app plus `"guest"` without login), and use the same value as its React `key`, so switching accounts remounts it.
- After success show the order number, amount and capture id. Without login, a confirmation page loads the record only by the order id the buyer's browser already holds; it never reads the payment table directly.
- With login, add a purchase history page listing the buyer's own orders (number, items, amount, time, status): `pending` shows "Payment Pending" and reconciles the existing PayPal order with `capture_paypal_order` before any new checkout; `completed` shows "Payment Completed"; `failed` allows retrying; `refunded` and `cancelled` show their status. Make it work on mobile.
- No mock, demo or simulated payment path, in development too. Sandbox or Live is decided by the credentials, never by code branches.

## Component

```tsx
// src/components/PayPalButton.tsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/client/supabase";

const PAYPAL_SDK_SCRIPT_ID = "paypal-js-sdk";

interface CartItem {
  product_id: string;
  quantity: number;
}

interface CaptureResult {
  verified?: boolean;
  pending?: boolean;
  restart?: boolean;
  orderId: string;
  captureId?: string;
  amount?: string;
  currency?: string;
}

interface PayPalButtonProps {
  items: CartItem[];
  onSuccess?: (result: CaptureResult) => void;
  // App + user ID (or app + "guest" when the app has no login); use the same value as the React key.
  paymentScope: string;
}

declare global {
  interface Window {
    paypal?: any;
  }
}

// Every Edge Function answers { code, message, data }; non-2xx bodies are read from error.context
async function invokeFunction<T>(name: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, {
    body: body ?? {},
  });
  if (error) {
    const text = await error.context?.text?.().catch(() => "");
    let parsed: { message?: string } | null = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    throw new Error(parsed?.message || text || error.message);
  }
  if (data?.code !== "SUCCESS") {
    throw new Error(data?.message || "Request failed");
  }
  return data.data as T;
}

// Sandbox and live use the same SDK URL; the Client ID decides the environment
function loadPayPalSdk(clientId: string, currency: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const expectedSrc =
      `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}` +
      `&currency=${encodeURIComponent(currency)}&intent=capture`;
    let script = document.getElementById(
      PAYPAL_SDK_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if ((script && script.src !== expectedSrc) || (window.paypal && !script)) {
      reject(
        new Error(
          "PayPal configuration changed. Reload the entire page before checkout.",
        ),
      );
      return;
    }
    if (window.paypal) {
      resolve();
      return;
    }
    const existing = !!script;
    if (!script) {
      script = document.createElement("script");
      script.id = PAYPAL_SDK_SCRIPT_ID;
      script.src = expectedSrc;
      script.async = true;
    }
    script.addEventListener(
      "load",
      () => {
        if (window.paypal) resolve();
        else {
          script?.remove();
          reject(new Error("PayPal SDK is unavailable. Reload the page."));
        }
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        script?.remove();
        reject(new Error("Failed to load the PayPal SDK. Reload the page."));
      },
      { once: true },
    );
    if (!existing) document.head.appendChild(script);
  });
}

export function PayPalButton({
  items,
  onSuccess,
  paymentScope,
}: PayPalButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "completed">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const pendingStorageKey = `paypal-pending:v1:${paymentScope}`;
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(pendingStorageKey);
    } catch {
      return null;
    }
  });
  const rememberPendingOrder = (id: string | null) => {
    // Persist BEFORE capture; a refresh must not make an uncertain payment disappear.
    if (id) sessionStorage.setItem(pendingStorageKey, id);
    else sessionStorage.removeItem(pendingStorageKey);
    setPendingOrderId(id);
  };
  const [checking, setChecking] = useState(false);

  const checkPendingOrder = async () => {
    if (!pendingOrderId || checking) return;
    setChecking(true);
    try {
      const result = await invokeFunction<CaptureResult>(
        "capture_paypal_order",
        { paypalOrderId: pendingOrderId },
      );
      if (result.verified === true) {
        rememberPendingOrder(null);
        setError(null);
        setStatus("completed");
        onSuccess?.(result);
      } else if (result.restart) {
        rememberPendingOrder(null);
        setError(
          "The funding source was declined. Choose another payment method.",
        );
      } else {
        setError(
          "Payment is still processing. Check again before paying again.",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to confirm this payment yet.",
      );
    } finally {
      setChecking(false);
    }
  };

  const [paymentEnvironment, setPaymentEnvironment] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    let buttons: any;

    (async () => {
      try {
        const config = await invokeFunction<{
          clientId: string;
          environment: string;
          currency: string;
        }>("paypal_config");
        if (cancelled) return;
        setPaymentEnvironment(config.environment);
        await loadPayPalSdk(config.clientId, config.currency);
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = "";
        buttons = window.paypal.Buttons({
          createOrder: async () => {
            const order = await invokeFunction<{ paypalOrderId: string }>(
              "create_paypal_order",
              { items },
            );
            return order.paypalOrderId;
          },
          onApprove: async (
            data: { orderID: string },
            actions: { restart: () => Promise<void> },
          ) => {
            // Retain the order even if the request times out after money moved.
            rememberPendingOrder(data.orderID);
            const result = await invokeFunction<CaptureResult>(
              "capture_paypal_order",
              {
                paypalOrderId: data.orderID,
              },
            );
            if (result.restart) {
              // Funding source declined: let the buyer choose another one
              rememberPendingOrder(null);
              return actions.restart();
            }
            if (result.verified !== true) {
              rememberPendingOrder(data.orderID);
              setError(
                "Payment is processing. Check this order's status before paying again.",
              );
              return;
            }
            rememberPendingOrder(null);
            setError(null);
            setStatus("completed");
            onSuccess?.(result);
          },
          onError: (err: unknown) => {
            setError(
              err instanceof Error
                ? err.message
                : "PayPal payment failed. Please try again.",
            );
          },
        });
        await buttons.render(containerRef.current);
        setStatus("ready");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "PayPal is unavailable. Check that PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are configured.",
        );
      }
    })();

    return () => {
      cancelled = true;
      buttons?.close?.();
    };
  }, [JSON.stringify(items), onSuccess]);

  return (
    <div>
      <p role="status">
        {paymentEnvironment === "sandbox"
          ? "PayPal Sandbox — test payments only"
          : paymentEnvironment === "live"
            ? "PayPal Live"
            : "Checking PayPal configuration…"}
      </p>
      <div
        ref={containerRef}
        hidden={pendingOrderId !== null || status === "completed"}
      />
      {pendingOrderId && (
        <button type="button" disabled={checking} onClick={checkPendingOrder}>
          {checking ? "Checking payment..." : "Check payment status"}
        </button>
      )}
      {status === "loading" && !error && <p>Loading PayPal...</p>}
      {status === "completed" && <p>Payment completed. Thank you!</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```
