# Native Gemini text streaming API

## Current supplier route

POST `https://app-eaujrj6ph0xt-api-oLpZXzgWolda.gateway.appmedo.com/v1/projects/miaoda-us-online/locations/global/publishers/google/models/gemini-3.8-flash:streamGenerateContent?alt=sse`

- Content-Type: `application/json`
- Accept: `text/event-stream`
- Preserve `X-Vertex-AI-LLM-Shared-Request-Type: offpeak` from the tested supplier configuration. It is a routing hint, not a verified discount. Measured traffic types have differed by model/run
- Supplier API-key authentication is platform-admin configuration, separate from app authentication. The earlier test used the native `key` query parameter; configure the actual supplier auth privately in the platform, never in example URLs, package code or prompts
- Assigned Platform API ID: `api-oLpZXzgWolda`
- Assigned Skill ID: `00621805-74a2-47ee-b782-30b31c36f235`
- The supplied definition has one POST interface, `inputMap: []`, retry `0`, `enable_billing: false`, and `need_count_calls: true`. Its displayed discount/original prices are `0.64`/`0.80`; these values do not activate billing.
- MeDo invocation uses the same API-ID annotation convention as the reference Skill; see the platform invocation below. This is a separate interface; do not reuse the reference Skill's API ID

## Native request body

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "Explain reusable components in simple terms" }]
    }
  ],
  "generationConfig": { "maxOutputTokens": 8192 }
}
```

- `contents`: nonempty ordered turns. `role` is `user` or `model`, never `assistant`
- `parts`: initial product accepts nonempty text parts only. Empty `parts` failed with HTTP 400 in an earlier supplier test
- `systemInstruction`: optional object containing text `parts`, separate from conversation roles
- `generationConfig.maxOutputTokens`: developer budget, default 8192 in this package; range 128–16384 is a product guard, not a model context-limit claim. Reasoning can consume output budget
- Do not explicitly disable safety settings, or copy unverified thinking/sampling/tool parameters from SDK examples
- No native JSON `model` field. Model is selected in the route. The app's optional `model` field is validated by our Edge adapter and removed before the native supplier request
- The upstream route is streaming; no extra JSON-mode platform API is created for Tasks. Task script consumes SSE to one final JSON stdout record

## Native SSE response

Illustrative frames, not test results:

```text
data: {"candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"Reusable components "}]}}]}

data: {"candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"reduce repeated work."}]},"finishReason":"STOP"}],"modelVersion":"gemini-3.8-flash"}

```

Read only candidate index 0. Concatenate non-thought text parts in arrival order, handle usage-only frames, and preserve `usageMetadata` and `modelVersion` when reported. A native stream ends normally after STOP; no OpenAI `[DONE]` is needed or synthesized. `MAX_TOKENS` is incomplete; all other non-STOP terminal reasons, prompt blocking, empty output, bad UTF-8/JSON and early disconnects are errors. A later STOP cannot erase an earlier failure.

Usage fields may include `promptTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`, `totalTokenCount`, `trafficType`. Do not sum incompatible token categories or treat usage as a billing receipt.

## Three authentication layers

1. Browser -> its own Edge: public app `apikey` plus `Authorization: Bearer <SUPABASE_ANON_KEY>` for stateless overseas Skill calls, or a current app user access token when the app has one
2. Edge/Task -> assigned platform gateway: `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`, read only server-side
3. Platform -> Google: privately managed supplier credential and native route; platform injects actual supplier auth

Do not forward a browser token to the supplier. Do not use the platform token as a Google key. Reject user-provided endpoints, model paths, credentials or generation-control fields in application input. A public anon key only authorizes the app's own Edge/Supabase gateway; it is not a supplier credential.

## Platform invocation and deployment

```text
POST https://app-eaujrj6ph0xt-api-oLpZXzgWolda.gateway.appmedo.com/v1/projects/miaoda-us-online/locations/global/publishers/google/models/gemini-3.8-flash:streamGenerateContent?alt=sse
```

Use the API-ID annotated endpoint exactly as provided, following the existing overseas `Large Language Model` Skill. MeDo handles its normal binding/rewriting process; this notation is not a standard public URL for local direct supplier requests. Do not introduce a custom URL environment variable, an alternate resolver, a guessed app gateway hostname or supplier credentials in app code. The definition's native supplier route remains unchanged.

Required server environment: only the existing platform-managed `INTEGRATIONS_API_KEY`. The browser retains the existing public app Supabase URL and anon key. The default Edge entry does not look up `/auth/v1/user`, and CORS OPTIONS is handled without additional environment settings. Account-based/private-data products must add real user validation and owner-scoped access separately.

On non-success upstream responses, return the generic `upstream_http_error` plus numeric `upstream_status`; never forward raw supplier bodies, credentials or response headers. HTTP 400/401/402/403/408/429 are preserved; other failures use 502 with the actual upstream status retained in JSON. Missing platform credentials return 500 with `platform_key_missing`. Preserve partial output and require explicit user action for a new request; no automatic retry.
