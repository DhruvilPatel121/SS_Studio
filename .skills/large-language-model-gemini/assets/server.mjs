const cors = origin => ({'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
  'Access-Control-Allow-Methods': 'POST,OPTIONS', Vary: 'Origin'});
function validate(body, config) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('invalid_body');
  if (Object.keys(body).some(k => !['contents','systemInstruction','model'].includes(k))) throw Error('unsupported_request_field');
  if (body.model !== undefined && body.model !== config.model) throw Error('unsupported_model');
  const validateParts = parts => Array.isArray(parts) && parts.length > 0 && parts.every(p =>
    p && Object.keys(p).length === 1 && typeof p.text === 'string' && p.text.trim());
  if (!Array.isArray(body.contents) || !body.contents.length || body.contents.length > 100 ||
      body.contents.some(c => !c || !['user','model'].includes(c.role) || !validateParts(c.parts))) throw Error('invalid_contents');
  if (body.contents.at(-1).role !== 'user') throw Error('last_turn_must_be_user');
  if (body.systemInstruction !== undefined && !validateParts(body.systemInstruction?.parts)) throw Error('invalid_system_instruction');
  return {contents: body.contents, ...(body.systemInstruction ? {systemInstruction: body.systemInstruction} : {}),
    generationConfig: {maxOutputTokens: config.maxOutputTokens}};
}
// Same API-ID annotation convention as the existing overseas Large Language Model.
// MeDo resolves this identifier when binding the Skill to an application.
// Do not strip the API ID, insert supplier credentials or invent a gateway host.
export function createHandler({getKey, modelConfig, fetchImpl = globalThis.fetch,
    timeoutMs = 180000}) {
  return async req => {
    const origin = req.headers.get('origin') || '';
    const headers = cors(origin);
    const reply = (error, status) => Response.json({error}, {status, headers});
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers});
    if (req.method !== 'POST') return reply('method_not_allowed', 405);
    if (!modelConfig || modelConfig.model !== 'gemini-3.8-flash' ||
        !Number.isInteger(modelConfig.maxOutputTokens) || modelConfig.maxOutputTokens < 128 || modelConfig.maxOutputTokens > 16384)
      return reply('invalid_model_configuration', 503);
    const key = getKey();
    if (!key) return reply('platform_key_missing', 500);
    const controller = new AbortController();
    const abort = () => controller.abort(); req.signal.addEventListener('abort', abort, {once: true});
    if (req.signal.aborted) controller.abort();
    const timer = setTimeout(abort, timeoutMs);
    let reader;
    const cleanup = () => { clearTimeout(timer); req.signal.removeEventListener('abort', abort); };
    try {
      const bytes = await req.text();
      if (bytes.length > 200000) { cleanup(); return reply('request_too_large', 413); }
      let body; try { body = validate(JSON.parse(bytes), modelConfig); }
      catch (e) { cleanup(); return reply(e.message === 'Unexpected end of JSON input' ? 'invalid_json' : 'invalid_request', 400); }
      const response = await fetchImpl(
        'https://app-eaujrj6ph0xt-api-oLpZXzgWolda.gateway.appmedo.com/v1/projects/miaoda-us-online/locations/global/publishers/google/models/gemini-3.8-flash:streamGenerateContent?alt=sse', {method: 'POST', headers: {
        'Content-Type': 'application/json', Accept: 'text/event-stream',
        'X-Gateway-Authorization': 'Bearer ' + key,
        'X-Vertex-AI-LLM-Shared-Request-Type': modelConfig.requestType},
        body: JSON.stringify(body), signal: controller.signal});
      if (!response.ok) { await response.body?.cancel(); cleanup(); return Response.json({error: 'upstream_http_error', upstream_status: response.status}, {status: [400,401,402,403,408,429].includes(response.status) ? response.status : 502, headers}); }
      if (!/^text\/event-stream(?:\s*;|$)/i.test(response.headers.get('content-type') || '') || !response.body) {
        await response.body?.cancel(); cleanup(); return reply('stream_protocol_mismatch', 502);
      }
      reader = response.body.getReader();
      const bodyStream = new ReadableStream({
        async pull(target) {
          try { const item = await reader.read(); if (item.done) { cleanup(); reader.releaseLock(); target.close(); } else target.enqueue(item.value); }
          catch { cleanup(); target.error(new Error('upstream_stream_interrupted')); }
        },
        async cancel() { controller.abort(); cleanup(); try { await reader.cancel(); } catch {} }
      });
      return new Response(bodyStream, {status: 200, headers: {...headers,
        'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform',
        'X-Accel-Buffering': 'no', 'X-Gemini-Model': modelConfig.model}});
    } catch {
      cleanup(); try { await reader?.cancel(); } catch {}
      return reply(controller.signal.aborted ? 'request_cancelled_or_timeout' : 'network_or_runtime_error', controller.signal.aborted ? 504 : 502);
    }
  };
}