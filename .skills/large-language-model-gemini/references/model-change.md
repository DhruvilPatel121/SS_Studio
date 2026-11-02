# Complete Web integration

## Copy exact files

Browser: copy `assets/gemini-client.mjs`, `assets/gemini-client.d.mts` and optionally `assets/GeminiChat.tsx` together into the same `src/lib/gemini/` directory. The runtime is self-contained and has no relative runtime imports. TypeScript's `.mjs` import resolves its sibling `.d.mts` declaration; do not rename extensions or use ts-nocheck.

Server: deploy `assets/index.ts`, `assets/server.mjs` and `assets/model-config.json` together as Edge Function **large-language-model-gemini**. Do not copy server code/configured gateway or platform key into the browser. The client sends only model, contents and optional systemInstruction; budget and routing remain server-managed.

Follow the existing overseas `Large Language Model` integration: the server code contains the exact API-ID annotated endpoint. The platform applies its existing API binding mechanism during generation/deployment. Read only `INTEGRATIONS_API_KEY` server-side. Do not add an app-specific gateway URL secret, invent a gateway hostname or ask users to configure one. Preserve the API-ID annotation for platform processing; do not replace it with a bare supplier URL or strip the API ID to satisfy a local fetch error.

The annotation is a MeDo platform identifier, not a normal public HTTP URL to use outside MeDo. Local tests mock its transport and do not prove platform rewriting or deployed routing. Verify the actual generated server route after the platform processes it. No new URL resolver or fallback is provided. CORS preflight is handled explicitly, without a custom origin environment variable. Keep existing platform public app/Supabase configuration intact.

## UI reference

```tsx
import { GeminiChat } from "./lib/gemini/GeminiChat";
import modelConfig from "./lib/gemini/model-config.json";

// Copy the nonsecret source model-config.json here for UI's current model label.
// supabase is the application's existing configured client.
<GeminiChat
  endpoint={`${supabaseUrl}/functions/v1/large-language-model-gemini`}
  anonKey={publicAnonKey}
  modelName={modelConfig.model}
/>;
```

Use the app's actual configured public Supabase URL/key. The overseas managed Skill supports stateless generation: send the public anon key in `apikey` and as the Supabase Edge bearer token. If the app has an existing Supabase user session, pass its access token instead; do not invent a login provider or treat a MeDo workspace login as an app user session. Add user authentication separately before storing account-scoped history or private data.

For an account-based product only, also pass `userId`, `getAccessToken` and an optional `onSignIn` using the application's real auth implementation. When `userId` is present, an absent/expired token stops the request; the component does not silently issue an anon call. Add server-side session enforcement and owner-scoped database policies for that product. The default `index.ts` is intentionally stateless and does not validate `/auth/v1/user`.

The public anon key is not proof of a signed-in user, and CORS is not access control. A stateless endpoint may be callable by anyone who has the public app configuration. Verify platform quotas/rate limits before public release; use real authentication and server-side limits when restricted or billable access requires them. Never disable the platform gateway's own validation or put its private credential in browser code.

The supplied component sends actual `onText` updates to the screen, offers Stop while waiting/streaming, blocks duplicate clicks, cancels on unmount/account changes, ignores stale callbacks and isolates in-memory history by account. It sends explicit user/model turns; only complete answers enter history. It does not implement persistent/cloud history or claim refreshing restores conversations. Add persistence only if requested, using user-scoped access controls. Never generate a paid welcome response automatically.

## Incomplete answers and continuations

On output_limit_reached or interruption, retain visible partial text and the error, stop LIVE/loading, preserve the user's input, and offer manual recovery. Do not execute incomplete code or accept broken JSON as a finished result. No automatic retry, fallback or continuation is provided.

If the product requires continuation, ask whether to send another potentially charged request first; include original instructions, relevant history, partial answer and continuation instruction explicitly, using the original model. Do not silently append partial output to completed history or auto-resend after a 401.

## Verification gates

1. Build actual Web application with these imports and declarations; check first screen
2. Stateless generation with the configured anon key succeeds; if user authentication is added, verify signed-in and expired-session behavior separately
3. Actual configured model reaches server validation and correct upstream route; response identity checked when reported
4. First visible text appears before completion and subsequent output progresses; verify supplier, gateway, Edge and browser separately
5. STOP completion, thought-only/empty output, MAX_TOKENS, invalid JSON, SSE errors, disconnects, timeout and cancellation all finish loading and preserve appropriate partial text
6. Account/conversation changes do not leak old text; history restore does not trigger generation
7. Verify actual platform billing separately; usage is not a charge receipt

This package targets Web and Tasks. Do not claim Expo native or WeChat mini-program support from a Web stream implementation; those require separately tested transports.
