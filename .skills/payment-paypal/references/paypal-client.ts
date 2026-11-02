// Copy to supabase/functions/_shared/paypal.ts. Never import into browser code.
// Exports getPayPalAccessToken() -> { token, baseUrl, clientId, environment } and paypalDebugId(response, body).
// Every PayPal REST call uses this token and baseUrl; never call PayPal with another token or a hardcoded host.
type Environment = "live" | "sandbox";
type Credentials = { clientId: string; clientSecret: string };
type Token = { token: string; expiresAt: number };
type Session = Credentials & {
    environment?: Environment;
    token?: Token;
    pending?: Promise<Token>;
};
const BASES = { live: "https://api-m.paypal.com", sandbox: "https://api-m.sandbox.paypal.com" };
let session: Session | undefined;

function credentials(): Credentials {
    const clientId = Deno.env.get("PAYPAL_CLIENT_ID")?.trim();
    const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET")?.trim();
    if (!clientId || !clientSecret) {
        throw new Error("PayPal is not configured. Save both Client ID and Secret in the app's Skill configuration.");
    }
    return { clientId, clientSecret };
}

// null means exactly invalid_client on this environment; all other failures stop discovery.
async function requestToken(current: Session, environment: Environment): Promise<Token | null> {
    let response: Response;
    try {
        response = await fetch(`${BASES[environment]}/v1/oauth2/token`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${btoa(`${current.clientId}:${current.clientSecret}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
            },
            body: "grant_type=client_credentials",
            signal: AbortSignal.timeout(10000),
        });
    } catch {
        throw new Error("PayPal credential verification is temporarily unavailable. Try again later.");
    }
    const body = await response.json().catch(() => null);
    if (response.status === 401 && body?.error === "invalid_client") return null;
    if (!response.ok) throw new Error(`PayPal credential verification failed (HTTP ${response.status}). Try again later.`);
    if (typeof body?.access_token !== "string" || !body.access_token.trim()
            || !Number.isFinite(body.expires_in) || body.expires_in <= 0) {
        throw new Error("Invalid PayPal credential verification response. Try again later.");
    }
    return { token: body.access_token, expiresAt: Date.now() + Math.max(0, body.expires_in * 1000 - 60000) };
}

async function refresh(current: Session): Promise<Token> {
    // Once identified, renewal only uses this environment. Transaction failures never trigger discovery.
    const environments: Environment[] = current.environment ? [current.environment] : ["live", "sandbox"];
    for (const environment of environments) {
        const token = await requestToken(current, environment);
        if (token) {
            current.environment = environment;
            current.token = token;
            return token;
        }
    }
    throw new Error("PayPal rejected the credentials. Save the matching Client ID and Secret together, then retry.");
}

export async function getPayPalAccessToken() {
    const value = credentials();
    if (!session || session.clientId !== value.clientId || session.clientSecret !== value.clientSecret) {
        session = { ...value };
    }
    const current = session;
    if (!current.token || current.token.expiresAt <= Date.now()) {
        // Coalesce concurrent initialization within this isolate. A replaced credential pair gets its own session.
        if (!current.pending) current.pending = refresh(current).finally(() => { current.pending = undefined; });
        await current.pending;
    }
    return {
        clientId: current.clientId,
        token: current.token!.token,
        environment: current.environment!,
        baseUrl: BASES[current.environment!],
    };
}

export function paypalDebugId(response: Response, body: any): string {
    return body?.debug_id || response.headers.get("paypal-debug-id") || "unknown";
}