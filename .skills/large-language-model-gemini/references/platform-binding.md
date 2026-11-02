# Platform binding record

This package is updated from the supplied overseas MeDo backend definition

| Field            | Supplied value                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| Skill name       | `large-language-model-gemini`                                                                                    |
| Display title    | `Large Language Model (Gemini)`                                                                                  |
| Skill ID         | `00621805-74a2-47ee-b782-30b31c36f235`                                                                           |
| Platform API ID  | `api-oLpZXzgWolda`                                                                                               |
| API title        | `Native Gemini Text Streaming API`                                                                               |
| Method           | `POST`                                                                                                           |
| Supplier domain  | `app-eaujrj6ph0xt-api-oLpZXzgWolda.gateway.appmedo.com`                                                          |
| Model route      | `/v1/projects/miaoda-us-online/locations/global/publishers/google/models/gemini-3.8-flash:streamGenerateContent` |
| Query mapping    | `alt=sse`                                                                                                        |
| Header mappings  | `Content-Type=application/json`, `Accept=text/event-stream`, `X-Vertex-AI-LLM-Shared-Request-Type=offpeak`       |
| Input mapping    | `[]`                                                                                                             |
| Retry            | `0`                                                                                                              |
| Billing          | `enable_billing=false`, `need_count_calls=true`                                                                  |
| Displayed prices | discount `0.64`, original `0.80`                                                                                 |

The prices above are copied as metadata from the definition. Because billing is disabled, they are not an active charge configuration.

## Platform invocation (aligned with the reference Skill)

```text
POST https://app-eaujrj6ph0xt-api-oLpZXzgWolda.gateway.appmedo.com/v1/projects/miaoda-us-online/locations/global/publishers/google/models/gemini-3.8-flash:streamGenerateContent?alt=sse
```

Use this same API-ID annotation convention as the existing overseas `large-language-model` Skill. The native supplier URL in the definition is unchanged. The platform binds the annotation to this Skill's assigned API; do not borrow the reference Skill's API ID, invent a host, remove the API ID, or create an extra URL secret. The only existing server-side credential used by the package is `INTEGRATIONS_API_KEY`, sent as `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`.

The annotated string is platform integration source, not a standard URL for standalone direct supplier calls. Verify platform processing and the deployed route separately from mocked tests. Existing applications need an explicit integration update or regeneration after the new package is uploaded; replacing the ZIP does not update deployed functions.

The API ID is not a supplier credential. Keep it stable when making a compatible model update. Update the native route in the definition, annotated paths in server/Task code and active model configuration together unless the platform later supplies a verified model router.
