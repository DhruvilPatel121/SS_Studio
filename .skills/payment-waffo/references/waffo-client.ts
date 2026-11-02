// Copy to supabase/functions/_shared/waffo.ts. Never import into browser code.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { WaffoPancake, WaffoPancakeError } from "npm:@waffo/pancake-ts@0.25.0";
import { Buffer } from "node:buffer";
import { createHash, createPrivateKey, createSign } from "node:crypto";

// Store currency: must match orders.currency and subscriptions.currency. One of the keys of CURRENCIES below.
export const WAFFO_CURRENCY = "USD";
// Tax category of what the app sells, exactly one of TAX_CATEGORIES below. Waffo refuses every payment for any other value.
export const WAFFO_TAX_CATEGORY = "digital_goods";
// What the buyer sees on the checkout page and the receipt of a one-time order. Set it to "<app name> order".
const WAFFO_ORDER_NAME = "Order";
// Leave empty. Fill in only when the merchant has several Waffo stores and told you which Store ID (STO_...) to use.
const WAFFO_STORE_ID = "";

// Currencies Waffo charges in: the smallest and largest price it accepts and the number of decimals.
const CURRENCIES: Record<string, { min: number; max: number; decimals: number }> = {
    USD: { min: 1, max: 10000, decimals: 2 },
    EUR: { min: 1, max: 9400, decimals: 2 },
    GBP: { min: 1, max: 8150, decimals: 2 },
    HKD: { min: 8, max: 77600, decimals: 2 },
    JPY: { min: 100, max: 1600000, decimals: 0 },
};
const TAX_CATEGORIES = ["digital_goods", "saas", "software", "ebook", "online_course", "consulting", "professional_service"];

// Waffo opens a checkout page with any tax category, then the buyer's payment fails: refuse it before that.
// waffo_config calls this before anything else, so the check after deploying shows a wrong constant.
export function checkWaffoConstants() {
    if (!TAX_CATEGORIES.includes(WAFFO_TAX_CATEGORY)) {
        throw new Error(`WAFFO_TAX_CATEGORY must be one of: ${TAX_CATEGORIES.join(", ")}`);
    }
    currency();
}
// A hosted checkout page stays open for 24 hours.
const CHECKOUT_TTL_SECONDS = 86400;

export const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function ok(data: unknown): Response {
    return new Response(JSON.stringify({ code: "SUCCESS", message: "ok", data }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
    });
}

export function fail(message: string, status = 400): Response {
    return new Response(JSON.stringify({ code: "FAIL", message }), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
    });
}

// Signed-in, non-anonymous user, or null (no session, the anon key, an invalid token or an anonymous session).
export async function currentUser(req: Request) {
    const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!jwt) return null;
    const { data: { user }, error } = await supabase.auth.getUser(jwt);
    return error || !user || user.is_anonymous ? null : user;
}

// Administrator in the role model the login skill establishes (profiles.role). False when the app has no profiles.
export async function isAdmin(userId: string | undefined): Promise<boolean> {
    if (!userId) return false;
    const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    return data?.role === "admin";
}

type Credentials = { merchantId: string; privateKey: string };

function credentials(): Credentials {
    const merchantId = Deno.env.get("WAFFO_MERCHANT_ID")?.trim();
    const privateKey = Deno.env.get("WAFFO_PRIVATE_KEY")?.trim();
    if (!merchantId || !privateKey) {
        throw new Error("Waffo is not configured. Save both Merchant ID and Private Key in the app's Skill configuration.");
    }
    return { merchantId, privateKey };
}

let cached: (Credentials & { client: WaffoPancake; storeId?: string }) | undefined;

// The SDK signs every request and accepts the key as PEM, one line, escaped newlines or bare Base64.
export function waffoClient(): WaffoPancake {
    const { merchantId, privateKey } = credentials();
    if (cached?.merchantId !== merchantId || cached.privateKey !== privateKey) {
        try {
            const client = new WaffoPancake({
                merchantId,
                privateKey,
                // The SDK sets no timeout of its own.
                fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
                    fetch(input, { ...init, signal: AbortSignal.timeout(15000) })) as typeof fetch,
            });
            cached = { merchantId, privateKey, client };
        } catch {
            throw new Error("The Waffo Merchant ID or Private Key is not valid. Save both credentials again.");
        }
    }
    return cached.client;
}

const CREDENTIALS_MESSAGE = "Waffo rejected the credentials. Save the Merchant ID and Private Key again.";
const BUSY_MESSAGE = "Waffo is receiving too many requests. Try again in a minute.";
const authFailure = (message: string) => /authentication (required|failed)|invalid signature|unauthorized/i.test(message);

// Never log the error object of a Waffo call together with request headers or credentials.
export function waffoMessage(error: unknown): string {
    if (error instanceof WaffoPancakeError) {
        const detail = error.errors?.[0]?.message ?? "request rejected";
        if (error.status === 401 || authFailure(detail)) return CREDENTIALS_MESSAGE;
        if (error.status === 429) return BUSY_MESSAGE;
        if (/not approved for production/i.test(detail)) {
            return "This Waffo key is a production key, but the store has not passed Waffo's review yet. "
                + "Finish the review in the Waffo dashboard, or save a test key to try payments.";
        }
        if (error.status === 403) return `Waffo refused the request: ${detail}`;
        return `Waffo request failed (${error.status}): ${detail}`;
    }
    return error instanceof Error ? error.message : "Waffo request failed";
}

async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const result = await waffoClient().graphql.query<T>({ query, variables });
    if (!result.data || result.errors?.length) {
        const message = result.errors?.[0]?.message ?? "empty response";
        if (authFailure(message)) throw new Error(CREDENTIALS_MESSAGE);
        if (/too many requests|rate limit/i.test(message)) throw new Error(BUSY_MESSAGE);
        throw new Error(`Waffo query failed: ${message}`);
    }
    return result.data;
}

// Ids the app keeps per merchant account in public.waffo_catalog (service role only): the store and the products.
async function catalogGet(key: string): Promise<string | null> {
    const { data } = await supabase.from("waffo_catalog")
        .select("waffo_id").eq("merchant_id", credentials().merchantId).eq("key", key).maybeSingle();
    return data?.waffo_id ?? null;
}

async function catalogSet(key: string, waffoId: string) {
    const { error } = await supabase.from("waffo_catalog")
        .upsert({ merchant_id: credentials().merchantId, key, waffo_id: waffoId }, { onConflict: "merchant_id,key" });
    if (error) throw new Error("Failed to store the Waffo catalog entry");
}

// One store per app. One active store: use it. Several: only the Store ID the merchant named.
// Stores are created by the merchant in the Waffo dashboard, where they also pass Waffo's review.
// verify = true always asks Waffo, which also proves both credentials; otherwise the stored id is reused.
export async function waffoStoreId(verify = false): Promise<string> {
    waffoClient();
    if (!verify) {
        if (cached?.storeId) return cached.storeId;
        const stored = WAFFO_STORE_ID || await catalogGet("store");
        if (stored) return (cached!.storeId = stored);
    }
    const { stores } = await graphql<{ stores: { id: string; status: string }[] }>(
        "query { stores(limit: 50) { id status } }",
    );
    const active = stores.filter((store) => store.status === "active");
    let storeId: string;
    if (WAFFO_STORE_ID) {
        if (!active.some((store) => store.id === WAFFO_STORE_ID)) {
            throw new Error("The configured Waffo store does not belong to this merchant account.");
        }
        storeId = WAFFO_STORE_ID;
    } else if (active.length === 1) {
        storeId = active[0].id;
    } else if (active.length === 0) {
        throw new Error("This Waffo account has no active store. Create one in the Waffo dashboard, then try again.");
    } else {
        throw new Error("This Waffo account has several stores. Tell the app builder which Store ID to use.");
    }
    cached!.storeId = storeId;
    await catalogSet("store", storeId);
    return storeId;
}

type CatalogProduct = { id: string; status: string; metadata: unknown };

// The mark the app puts on the products it creates. Waffo returns product metadata as a JSON string.
function appKey(metadata: unknown): unknown {
    try {
        return (typeof metadata === "string" ? JSON.parse(metadata) : metadata)?.app_key;
    } catch {
        return undefined;
    }
}

// Waffo products cannot be deleted and exist per environment: a test key and a production key each see their own.
// So the app reuses the product it already created for this key (found by name and its app_key mark) and creates
// one only when there is none. `skip` is a stored id Waffo just refused.
async function catalogProduct(
    key: string, kind: "onetimeProducts" | "subscriptionProducts", name: string,
    create: (storeId: string) => Promise<string>, skip?: string,
): Promise<string> {
    if (!skip) {
        const stored = await catalogGet(key);
        if (stored) return stored;
    }
    const storeId = await waffoStoreId();
    const data = await graphql<Record<string, CatalogProduct[]>>(
        `query($store: String!, $name: String!) {
            ${kind}(storeId: $store, filter: { name: { eq: $name } }, limit: 50) { id status metadata }
        }`,
        { store: storeId, name },
    );
    const existing = data[kind].find((product) =>
        product.status === "active" && product.id !== skip && appKey(product.metadata) === key);
    const productId = existing?.id ?? await create(storeId);
    await catalogSet(key, productId);
    return productId;
}

// The single one-time product every cart checkout reuses; the charged amount comes from priceSnapshot.
function onetimeProduct(skip?: string): Promise<string> {
    const key = "onetime";
    return catalogProduct(key, "onetimeProducts", WAFFO_ORDER_NAME, async (storeId) => {
        const { product } = await waffoClient().onetimeProducts.create({
            storeId,
            name: WAFFO_ORDER_NAME,
            description: "Created by the app for its checkout. The amount of each order is set at checkout.",
            prices: { [WAFFO_CURRENCY]: { amount: amountText(currency().min), taxIncluded: true, taxCategory: WAFFO_TAX_CATEGORY } },
            metadata: { app_key: key },
        } as never);
        return product.id;
    }, skip);
}

export type Plan = { id: string; name: string; price: number | string; billing_period: string };

// One Waffo subscription product per plan, price and billing period. billing_period: weekly | monthly | quarterly | yearly.
// A plan whose price or period changes gets a new product; subscriptions already sold keep theirs.
function subscriptionProduct(plan: Plan, skip?: string): Promise<string> {
    const key = `plan:${plan.id}:${plan.billing_period}:${amountText(plan.price)}`;
    const name = plan.name.slice(0, 64);
    return catalogProduct(key, "subscriptionProducts", name, async (storeId) => {
        const { product } = await waffoClient().subscriptionProducts.create({
            storeId,
            name,
            billingPeriod: plan.billing_period,
            prices: { [WAFFO_CURRENCY]: { amount: amountText(plan.price), taxIncluded: true, taxCategory: WAFFO_TAX_CATEGORY } },
            metadata: { app_key: key },
        } as never);
        return product.id;
    }, skip);
}

function currency() {
    const settings = CURRENCIES[WAFFO_CURRENCY];
    if (!settings) throw new Error(`Waffo does not charge in ${WAFFO_CURRENCY}. Use one of: ${Object.keys(CURRENCIES).join(", ")}`);
    return settings;
}

// The amount as Waffo expects it ("23.45"; no decimals for JPY), refused when outside the range Waffo accepts.
export function amountText(value: number | string): string {
    const { min, max, decimals } = currency();
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
    if (amount < min || amount > max) {
        throw new Error(`Waffo accepts ${WAFFO_CURRENCY} amounts from ${min} to ${max} per payment`);
    }
    return amount.toFixed(decimals);
}

// Waffo display amounts ("23.45") against a local numeric(12,2) amount.
export function sameAmount(display: string | undefined, local: number | string): boolean {
    return display !== undefined && Math.round(Number(display) * 100) === Math.round(Number(local) * 100);
}

// Waffo emails the receipt and the subscription notices to the buyer. Username logins carry a placeholder
// address (…@miaoda.com): never prefill that one, so the buyer types a real address on the checkout page.
const realEmail = (email?: string | null) => (email && !/@miaoda\.com$/i.test(email) ? email : undefined);

// A stored product id this key cannot use: deleted, from another store, or from the other environment.
const staleProduct = (error: unknown) => error instanceof WaffoPancakeError
    && /product (not found|does not belong)|not active for this environment/i.test(error.errors?.[0]?.message ?? "");

type Checkout = { sessionId: string; checkoutUrl: string; expiresAt: string };
type CheckoutInput = {
    localId: string; // orders.id or subscriptions.id (a UUID); becomes orderMerchantExternalId and the idempotency key
    amount: number | string;
    successUrl: string; // absolute https URL
    buyerEmail?: string | null;
    plan?: Plan; // set for a subscription checkout
};

// Creates the hosted checkout page. taxIncluded makes the price the app shows the price the buyer is charged.
export async function createWaffoCheckout(input: CheckoutInput): Promise<Checkout> {
    checkWaffoConstants();
    const client = waffoClient();
    const open = async (skip?: string): Promise<Checkout> => {
        const productId = input.plan ? await subscriptionProduct(input.plan, skip) : await onetimeProduct(skip);
        try {
            return await client.checkout.createSession({
                productId,
                currency: WAFFO_CURRENCY,
                // The SDK type omits taxIncluded; the API accepts it.
                priceSnapshot: { amount: amountText(input.amount), taxIncluded: true, taxCategory: WAFFO_TAX_CATEGORY } as never,
                buyerEmail: realEmail(input.buyerEmail),
                successUrl: input.successUrl,
                expiresInSeconds: CHECKOUT_TTL_SECONDS,
                orderMerchantExternalId: input.localId,
                metadata: { local_id: input.localId },
                // Waffo accepts only a UUID as idempotency key. The local id makes a repeated first attempt return the same session.
            }, { idempotencyKey: skip ? crypto.randomUUID() : input.localId });
        } catch (error) {
            // Only a product this key cannot use is replaced, once. Every other refusal (store not approved for
            // production, no payment method, ...) is reported as it is: creating another product would not help.
            if (!skip && staleProduct(error)) return await open(productId);
            throw error;
        }
    };
    return await open();
}

type Money = { display: string; currency: string };
export type WaffoPayment = {
    id: string; status: string; amount: Money; refundStatus: string; isFullyRefunded: boolean; periodNumber: number | null;
};
export type WaffoOnetimeOrder = {
    id: string; status: string; currency: string; testMode: boolean; total: Money; payments: WaffoPayment[];
};
export type WaffoSubscriptionOrder = {
    id: string; status: string; currency: string; testMode: boolean; willRenew: boolean;
    currentPeriodEnd: string | null; createdAt: string; payments: WaffoPayment[];
};

const PAYMENT_FIELDS = "id status amount { display currency } refundStatus isFullyRefunded periodNumber";

// Waffo orders created from the checkout of one local order, looked up by the local id. A test key sees only
// test orders and a production key only production orders.
export async function findOnetimeOrders(localId: string): Promise<WaffoOnetimeOrder[]> {
    const data = await graphql<{ onetimeOrders: WaffoOnetimeOrder[] }>(
        `query($store: String!, $ref: String!) {
            onetimeOrders(storeId: $store, filter: { orderMerchantExternalId: { eq: $ref } }, limit: 20) {
                id status currency testMode total { display currency } payments { ${PAYMENT_FIELDS} }
            }
        }`,
        { store: await waffoStoreId(), ref: localId },
    );
    return data.onetimeOrders;
}

export async function findSubscriptionOrders(localId: string): Promise<WaffoSubscriptionOrder[]> {
    const data = await graphql<{ subscriptionOrders: WaffoSubscriptionOrder[] }>(
        `query($store: String!, $ref: String!) {
            subscriptionOrders(storeId: $store, filter: { orderMerchantExternalId: { eq: $ref } }, limit: 20) {
                id status currency testMode willRenew currentPeriodEnd createdAt payments { ${PAYMENT_FIELDS} }
            }
        }`,
        { store: await waffoStoreId(), ref: localId },
    );
    return data.subscriptionOrders;
}

export async function findPayment(paymentId: string): Promise<WaffoPayment | null> {
    const data = await graphql<{ payment: WaffoPayment | null }>(
        `query($id: String!) { payment(id: $id) { ${PAYMENT_FIELDS} } }`,
        { id: paymentId },
    );
    return data.payment;
}

type CheckoutState = { checkout_expires_at: string | null };
type RemoteOrder = { status: string; payments: { status: string }[] };

export const expired = (row: CheckoutState) =>
    !!row.checkout_expires_at && new Date(row.checkout_expires_at).getTime() < Date.now();

// Every attempt on the order failed, or Waffo closed it. The page it was opened from no longer takes a payment.
export const unpayable = (item: RemoteOrder) =>
    item.status === "canceled" || (item.status === "pending" && item.payments.length > 0
        && item.payments.every((payment) => payment.status === "failed" || payment.status === "canceled"));

// A payment the buyer already submitted may settle after the checkout page expired: wait for it. A succeeded
// payment counts too, until Waffo reports its order as completed.
export const inFlight = (items: RemoteOrder[]) =>
    items.some((item) => item.payments.some((payment) => payment.status === "pending" || payment.status === "succeeded"));

// The stored checkout link, while the buyer can still pay on it: Waffo has no order for it yet (opening the page
// again after an attempt does not continue that order) and it has not expired.
export const payableUrl = (row: CheckoutState & { checkout_url: string | null }, remote: RemoteOrder[]) =>
    remote.length === 0 && !expired(row) ? row.checkout_url : null;

// Owner cancels at period end. HTTP 400 means Waffo already holds a cancellation or a final state; the caller
// reads the resulting state from Waffo either way.
export async function cancelWaffoSubscription(waffoOrderId: string) {
    try {
        await waffoClient().orders.cancelSubscription({ orderId: waffoOrderId });
    } catch (error) {
        if (!(error instanceof WaffoPancakeError) || error.status !== 400) throw error;
    }
}

// Refund tickets still on their way, and tickets that ended without a refund (Waffo's own spelling).
const REFUND_OPEN = ["pending", "under_review", "approved", "returned", "processing"];
const REFUND_CLOSED = ["rejected", "failed", "cancelled"];

export type RefundState = "refunded" | "partial" | "pending" | "failed" | "none";

// Refund state of one payment, whoever opened the refund.
// refunded: the whole payment went back. partial: a part was refunded outside the app; Waffo allows one refund
// per payment, so the rest is handled in the Waffo dashboard. pending: a refund is on its way.
// failed: every refund ended without one. none: no refund was requested.
export async function refundState(localId: string, paymentId: string): Promise<RefundState> {
    const { payment, refundTickets } = await graphql<{
        payment: { refundStatus: string; isFullyRefunded: boolean } | null;
        refundTickets: { status: string; refundTicketMerchantExternalId: string | null }[];
    }>(
        `query($id: String!) {
            payment(id: $id) { refundStatus isFullyRefunded }
            refundTickets(filter: { subjectId: { eq: $id } }, limit: 20) { status refundTicketMerchantExternalId }
        }`,
        { id: paymentId },
    );
    const succeeded = refundTickets.filter((ticket) => ticket.status === "succeeded");
    // The app's own refund always asks for the whole payment.
    if (payment?.isFullyRefunded || succeeded.some((ticket) => ticket.refundTicketMerchantExternalId === localId)) return "refunded";
    if (refundTickets.some((ticket) => REFUND_OPEN.includes(ticket.status))) return "pending";
    if (succeeded.length || payment?.refundStatus === "refunded") return "partial";
    if (refundTickets.some((ticket) => REFUND_CLOSED.includes(ticket.status)) || payment?.refundStatus === "failed") return "failed";
    return "none";
}

function privateKeyObject(raw: string) {
    const text = raw.replace(/\\n/g, "\n").trim();
    const pkcs1 = text.includes("BEGIN RSA PRIVATE KEY");
    const der = Buffer.from(text.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""), "base64");
    return createPrivateKey({ key: der, format: "der", type: pkcs1 ? "pkcs1" : "pkcs8" });
}

// Merchant API Key request for an endpoint the SDK does not expose on the merchant client.
async function merchantPost(path: string, body: unknown): Promise<{ status: number; message: string }> {
    const { merchantId, privateKey } = credentials();
    const text = JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyHash = createHash("sha256").update(text).digest("base64");
    const signature = createSign("sha256")
        .update(`POST\n${path}\n${timestamp}\n${bodyHash}`)
        .sign(privateKeyObject(privateKey), "base64");
    const response = await fetch(`https://api.waffo.ai${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Merchant-Id": merchantId,
            "X-Timestamp": timestamp,
            "X-Signature": signature,
        },
        body: text,
        signal: AbortSignal.timeout(15000),
    });
    const json = await response.json().catch(() => null);
    return { status: response.status, message: json?.errors?.[0]?.message ?? "" };
}

// Full refund of one payment. Waffo keeps one refund per payment and answers HTTP 409 when one exists.
export async function requestFullRefund(localId: string, payment: WaffoPayment, reason: string) {
    return await merchantPost("/v1/actions/refund-ticket/create-ticket", {
        paymentId: payment.id,
        reason,
        requestedAmount: { amount: payment.amount.display, currency: payment.amount.currency },
        refundTicketMerchantExternalId: localId,
    });
}