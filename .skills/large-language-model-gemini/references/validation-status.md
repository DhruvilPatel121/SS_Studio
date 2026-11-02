# Validation status — 2026-10-15, reference-aligned routing

## Current change

The package now follows the overseas `large-language-model` API-ID endpoint convention. The custom gateway-address and origin environment dependencies and their URL/origin validators were removed. The Edge entry reads only the existing platform-managed `INTEGRATIONS_API_KEY`. The same assigned API ID, native model route and gateway header are used by Web and Task code. Supplier credentials remain exclusively in the definition's private authentication configuration.

The frontend still uses the app public anon key for stateless calls. Native Gemini SSE parsing, partial-output retention, Stop, input/model validation and no automatic retry are preserved. Upstream failures now retain their numeric HTTP status without returning raw supplier details.

## Reference and evidence

- Reference: `managed-en/large-language-model`, checked against the cloud repository on 2026-10-15; its subtree matched the local reference
- Reference integration: API-ID annotated endpoint, server-side platform credential, anon-key browser calls and direct SSE pass-through
- The reference Skill's model and supplier are different; this package keeps its own Gemini 3.8 native Vertex route and its own API ID
- The reference's abbreviated parser is not copied over the tested native parser; malformed/truncated streams must still fail
- On the prior revision, the three generated apps reproduced two local configuration failures and one upstream HTTP failure. Those results diagnose the prior deployed code, not this new package

## Checks for this revision

| Layer                      | Status and boundary                                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node runtime               | 43 tests: parser, incremental output, cancellation, fixed assigned endpoint, only existing platform credential in the Deno-entry shim, QA preflight and safe upstream status |
| Python Task                | 8 test methods: native SSE, assigned API-ID endpoint and mocked caller using only the existing platform credential                                                           |
| React component            | 5 interaction tests with mocked network; strict TypeScript check and browser bundle                                                                                          |
| Definition and app sources | Unchanged; verified by pre/post SHA-256 comparison                                                                                                                           |
| ZIP                        | Re-extract, re-run regressions, compare file bytes, scan credentials and check Skill/frontmatter layout                                                                      |
| New platform-generated app | Not tested; requires loading this new package and verifying platform route processing                                                                                        |
| Deployed browser streaming | Not tested for this revision; mocks and an SSE header are not end-to-end evidence                                                                                            |
| Actual billing/production  | Not tested; token usage is not a billing receipt                                                                                                                             |

Run under Node 24+ and Python 3:

```sh
node --test tests/runtime.test.mjs
python3 -m unittest discover -s tests -p test_task.py -v
```

For the optional component tests, use a temporary test workspace with React 19.2.0, react-test-renderer 19.2.0 and esbuild 0.25.11. Bundle `assets/GeminiChat.tsx` there as `GeminiChat.bundle.mjs` with browser/esm, automatic JSX and external React imports; copy `tests/component.test.mjs` alongside and run `node --test component.test.mjs`. These tests mock the network.

The platform API-ID annotation is not a standard URL for ordinary local fetch/urllib execution. Local network calls are not used to pretend to validate platform binding. No custom resolver or supplier fallback is introduced. After uploading the changed ZIP, explicitly update/regenerate the app and verify the platform-resolved route, existing credential injection, real first/last text timing, completion, errors and cancellation. Old applications do not update automatically.
