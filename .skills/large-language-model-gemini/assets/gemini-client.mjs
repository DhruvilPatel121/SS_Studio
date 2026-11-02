/** Native Gemini SSE. Self-contained; no OpenAI [DONE] requirement or SDK. */
export class GeminiError extends Error {
  constructor(code, partialText = '') { super(code); this.name = 'GeminiError'; this.code = code; this.partialText = partialText; }
}
export function createGeminiParser({onText = () => {}, onUsage = () => {}} = {}) {
  const decoder = new TextDecoder('utf-8', {fatal: true});
  let line = '', data = [], eventType = '', afterCR = false, started = false;
  let text = '', finish = null, usage = null, model = null, ended = false;
  function fail(code) { throw new GeminiError(code, text); }
  function dispatch() {
    const payload = data.join('\n'); const kind = eventType; data = []; eventType = '';
    if (!payload.trim()) return;
    if (payload.trim() === '[DONE]') fail('unexpected_openai_protocol');
    let obj; try { obj = JSON.parse(payload); } catch { fail('invalid_sse_json'); }
    if (kind === 'error' || obj.error) fail('upstream_stream_error');
    if (obj.promptFeedback?.blockReason) fail('content_filtered');
    if (obj.modelVersion) model = obj.modelVersion;
    if (obj.usageMetadata) { usage = obj.usageMetadata; onUsage(usage); }
    if (obj.candidates !== undefined && !Array.isArray(obj.candidates)) fail('invalid_candidates');
    const candidate = obj.candidates?.find(c => (c.index ?? 0) === 0);
    if (!candidate) return;
    const parts = candidate.content?.parts ?? [];
    if (!Array.isArray(parts)) fail('invalid_parts');
    for (const part of parts) {
      if (part.thought === true) continue;
      if (part.functionCall || part.inlineData || part.fileData) fail('unsupported_output_part');
      if (part.text !== undefined && typeof part.text !== 'string') fail('invalid_text');
      if (part.text) {
        if (text.length + part.text.length > 1000000) fail('output_too_large');
        text += part.text; onText(part.text, text);
      }
    }
    if (candidate.finishReason) {
      if (candidate.finishReason !== 'STOP') {
        finish = candidate.finishReason;
        fail(finish === 'MAX_TOKENS' ? 'output_limit_reached' : 'incomplete_or_filtered');
      }
      finish = 'STOP';
    }
  }
  function endLine() {
    if (line === '') dispatch();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    else if (line === 'data') data.push('');
    else if (line.startsWith('event:')) eventType = line.slice(6).trim();
    line = '';
  }
  function consume(s) {
    for (const ch of s) {
      if (!started) { started = true; if (ch === '\ufeff') continue; }
      if (afterCR) { afterCR = false; if (ch === '\n') continue; }
      if (ch === '\r') { endLine(); afterCR = true; }
      else if (ch === '\n') endLine();
      else { line += ch; if (line.length > 2000000) fail('sse_line_too_large'); }
    }
  }
  return {
    push(bytes) {
      if (ended) fail('stream_already_ended');
      let s; try { s = decoder.decode(bytes, {stream: true}); } catch { fail('invalid_utf8'); }
      consume(s);
    },
    end() {
      if (ended) fail('stream_already_ended'); ended = true;
      let tail; try { tail = decoder.decode(); } catch { fail('invalid_utf8'); }
      consume(tail); if (line) endLine(); dispatch();
      if (finish !== 'STOP') fail('missing_stop_or_truncated');
      if (!text.replace(/\ufeff/g, '').trim()) fail('empty_output');
      return {text, usage, model, finishReason: finish};
    },
    get text() { return text; }
  };
}

/** Browser -> own Edge Function. Supplier/gateway keys never enter here. */
export async function generateGemini({endpoint, accessToken, anonKey, contents, systemInstruction,
    model, onText, onUsage, onState = () => {}, signal, timeoutMs = 180000, fetchImpl = globalThis.fetch}) {
  let u; try { u = new URL(endpoint); } catch { throw new GeminiError('invalid_function_url'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash ||
      !u.pathname.endsWith('/functions/v1/large-language-model-gemini')) throw new GeminiError('invalid_function_url');
  // Match the overseas managed Skill convention: a stateless app call may use
  // the public Supabase anon key as the Edge bearer token. If an app has its
  // own Supabase user session, its access token takes precedence.
  const bearerToken = accessToken || anonKey;
  if (!bearerToken || !anonKey) throw new GeminiError('authentication_required');
  if (!(timeoutMs >= 1000 && timeoutMs <= 300000)) throw new GeminiError('invalid_timeout');
  const controller = new AbortController(); let timedOut = false, reader;
  const relay = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', relay, {once: true});
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const parser = createGeminiParser({onText(delta, full) { onState('streaming'); onText?.(delta, full); }, onUsage});
  try {
    onState('waiting');
    const response = await fetchImpl(endpoint, {method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + bearerToken, apikey: anonKey},
      body: JSON.stringify({contents, ...(systemInstruction ? {systemInstruction} : {}), ...(model ? {model} : {})}),
      signal: controller.signal});
    if (!response.ok) throw new GeminiError(response.status === 401 ? 'authentication_required' : 'http_' + response.status);
    if (!/^text\/event-stream(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) throw new GeminiError('stream_protocol_mismatch');
    if (!response.body?.getReader) throw new GeminiError('stream_transport_unavailable');
    reader = response.body.getReader();
    while (true) {
      const {value, done} = await reader.read();
      if (done) break; parser.push(value);
    }
    const result = parser.end();
    const expectedModel = model || response.headers.get('x-gemini-model');
    if (result.model && expectedModel && result.model !== expectedModel) throw new GeminiError('reported_model_mismatch', result.text);
    onState('completed'); return result;
  } catch (error) {
    const code = timedOut ? 'timeout' : controller.signal.aborted ? 'cancelled' : error.code || 'network_or_runtime_error';
    onState(code === 'cancelled' ? 'cancelled' : 'failed');
    throw new GeminiError(code, parser.text);
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', relay);
    try { await reader?.cancel(); } catch {}
    try { reader?.releaseLock(); } catch {}
  }
}