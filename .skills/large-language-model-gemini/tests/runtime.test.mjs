import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGeminiParser,generateGemini} from '../assets/gemini-client.mjs';
import {createHandler} from '../assets/server.mjs';
const enc=new TextEncoder();
const frame=(text,finish)=>({candidates:[{index:0,content:{role:'model',parts:text===undefined?[]:[{text}]},...(finish?{finishReason:finish}:{})}]});
const event=obj=>'data: '+JSON.stringify(obj)+'\n\n';
const good=event(frame('你好🚲'))+event(frame('完成','STOP'));
function consume(raw,n=1){const p=createGeminiParser();const bytes=enc.encode(raw);for(let i=0;i<bytes.length;i+=n)p.push(bytes.slice(i,i+n));return p.end()}
for(const [label,raw] of [
 ['UTF8 byte splitting',good],['BOM','\ufeff'+good],['CRLF',good.replaceAll('\n','\r\n')],['CR',good.replaceAll('\n','\r')],
 ['comments/id/event',': ping\nid: 1\nevent: message\n'+good],['trailing event without delimiter',good.trimEnd()],
 ['empty data','data:\n\n'+good],['usage only',good+event({usageMetadata:{totalTokenCount:3},modelVersion:'gemini-3.8-flash'})],
 ['thought skipped',event({candidates:[{content:{parts:[{thought:true,text:'private thought'}]}}]})+good]
])test(label,()=>assert.equal(consume(raw).text,'你好🚲完成'));
test('multiple events one chunk',()=>assert.equal(consume(good,100000).text,'你好🚲完成'));
test('multiline data',()=>assert.equal(consume('data: {"candidates":\ndata: [{"content":{"parts":[{"text":"ok"}]},"finishReason":"STOP"}]}\n\n').text,'ok'));
for(const [label,raw,code] of [
 ['missing STOP',event(frame('partial')),'missing_stop_or_truncated'],['empty visible output',event(frame('','STOP')),'empty_output'],
 ['bad JSON','data: {bad}\n\n','invalid_sse_json'],['native does not accept OpenAI sentinel',good+'data: [DONE]\n\n','unexpected_openai_protocol'],
 ['SSE error',good+event({error:{message:'error'}}),'upstream_stream_error'],['prompt blocked',event({promptFeedback:{blockReason:'SAFETY'}}),'content_filtered'],
 ['MAX_TOKENS',event(frame('partial','MAX_TOKENS')),'output_limit_reached'],['filtered',event(frame('partial','SAFETY')),'incomplete_or_filtered'],
 ['earlier failure not erased',event(frame('partial','MAX_TOKENS'))+event(frame('later','STOP')),'output_limit_reached'],
 ['unsupported tool output',event({candidates:[{content:{parts:[{functionCall:{name:'x'}}]},finishReason:'STOP'}]}),'unsupported_output_part']
])test(label,()=>assert.throws(()=>consume(raw),e=>e.code===code));
test('invalid UTF8',()=>{const p=createGeminiParser();assert.throws(()=>{p.push(new Uint8Array([0xff]));p.end()},e=>e.code==='invalid_utf8')});
test('partial output retained on truncation',()=>{const p=createGeminiParser();p.push(enc.encode(event(frame('partial'))));assert.throws(()=>p.end(),e=>e.partialText==='partial')});
const endpoint='https://app.example.test/functions/v1/large-language-model-gemini';
const params={endpoint,accessToken:'test-user-token',anonKey:'test-public-key',contents:[{role:'user',parts:[{text:'Hello'}]}]};
test('client shows partial text before EOF and passes own-app gateway headers',async()=>{
 let wire,close,finish;const states=[],texts=[];
 const promise=generateGemini({...params,onState:s=>states.push(s),onText:(_,full)=>texts.push(full),fetchImpl:async(url,opts)=>{
  assert.equal(url,endpoint);assert.equal(opts.headers.Authorization,'Bearer test-user-token');assert.equal(opts.headers.apikey,'test-public-key');assert.ok(!('X-Gateway-Authorization' in opts.headers));
  return new Response(new ReadableStream({start(c){wire=c;close=()=>c.close()}}),{headers:{'Content-Type':'text/event-stream; charset=utf-8'}})
 }}).then(r=>{finish=true;return r});
 await new Promise(r=>setImmediate(r));wire.enqueue(enc.encode(event(frame('early'))));await new Promise(r=>setImmediate(r));
 assert.deepEqual(texts,['early']);assert.ok(states.includes('streaming'));assert.ok(!finish);
 wire.enqueue(enc.encode(event(frame(' later','STOP'))));close();assert.equal((await promise).text,'early later');assert.equal(states.at(-1),'completed');
});
test('client JSON fallback rejected',async()=>assert.rejects(()=>generateGemini({...params,fetchImpl:async()=>Response.json({text:'wrong'})}),e=>e.code==='stream_protocol_mismatch'));
test('client can use the public anon key for stateless overseas calls',async()=>{
 let auth;
 const result=await generateGemini({...params,accessToken:null,fetchImpl:async(_u,o)=>{auth=o.headers.Authorization;return new Response(good,{headers:{'Content-Type':'text/event-stream'}})}});
 assert.equal(auth,'Bearer test-public-key');assert.equal(result.text,'你好🚲完成');
});
test('HTTP 401 remains auth failure',async()=>assert.rejects(()=>generateGemini({...params,fetchImpl:async()=>Response.json({}, {status:401})}),e=>e.code==='authentication_required'));
test('abort clears active state',async()=>{
 const abort=new AbortController(),states=[];
 const p=generateGemini({...params,signal:abort.signal,onState:s=>states.push(s),fetchImpl:async(_u,o)=>new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))});abort.abort();await assert.rejects(p,e=>e.code==='cancelled');assert.equal(states.at(-1),'cancelled');
});
test('timeout clears active state',async()=>assert.rejects(()=>generateGemini({...params,timeoutMs:1000,fetchImpl:async(_u,o)=>new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))}),e=>e.code==='timeout'));
const platformEndpoint='https://app-eaujrj6ph0xt-api-oLpZXzgWolda.gateway.appmedo.com/v1/projects/miaoda-us-online/locations/global/publishers/google/models/gemini-3.8-flash:streamGenerateContent?alt=sse';
const config={model:'gemini-3.8-flash',maxOutputTokens:8192,requestType:'offpeak'};
function request(body={contents:[{role:'user',parts:[{text:'Hi'}]}]},headers={}){return new Request('https://edge.example.test',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)})}
const settings={getKey:()=> 'test-platform-key',modelConfig:config};
test('missing platform key fails before network',async()=>{let calls=0;const h=createHandler({...settings,getKey:()=>'',fetchImpl:async()=>{calls++;throw Error()}});const r=await h(request());assert.equal(r.status,500);assert.equal((await r.json()).error,'platform_key_missing');assert.equal(calls,0)});
test('fixed model route and active model must match',async()=>{const h=createHandler({...settings,modelConfig:{...config,model:'gemini-4-argon'}});assert.equal((await h(request())).status,503)});
test('model mismatch and invalid roles rejected before network',async()=>{
 let calls=0;const h=createHandler({...settings,fetchImpl:()=>{calls++;throw Error()}});
 assert.equal((await h(request({model:'gemini-4-argon',contents:[{role:'user',parts:[{text:'Hi'}]}]}))).status,400);
 assert.equal((await h(request({contents:[{role:'assistant',parts:[{text:'Hi'}]}]}))).status,400);assert.equal(calls,0);
});
test('unverified client controls rejected',async()=>{const h=createHandler(settings);assert.equal((await h(request({contents:[{role:'user',parts:[{text:'hi'}]}],generationConfig:{maxOutputTokens:65535}}))).status,400)});
test('overseas stateless calls need no extra origin setup',async()=>{
 const h=createHandler({...settings,fetchImpl:async()=>new Response(good,{headers:{'Content-Type':'text/event-stream'}})});
 const r=await h(request(undefined,{Origin:'https://qa.medo.dev'}));
 assert.equal(r.status,200);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://qa.medo.dev');
 assert.equal(await r.text(),good);
});
test('QA preflight succeeds without invoking the supplier',async()=>{
 let calls=0;const h=createHandler({...settings,fetchImpl:async()=>{calls++;throw Error('unexpected network')}});
 const r=await h(new Request('https://edge.example.test',{method:'OPTIONS',headers:{Origin:'https://qa.medo.dev','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type'}}));
 assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://qa.medo.dev');
 assert.match(r.headers.get('Access-Control-Allow-Headers'),/authorization/);assert.equal(calls,0);
});
test('bundled Edge entry supports stateless QA calls without auth-user lookup (Deno shim)',async()=>{
 const previousDeno=globalThis.Deno,previousFetch=globalThis.fetch;
 let handler,calls=0;
 const env={INTEGRATIONS_API_KEY:'test-platform-key'},envReads=[];
 try{
  globalThis.Deno={env:{get:key=>{envReads.push(key);return env[key]}},serve:fn=>{handler=fn}};
  globalThis.fetch=async(url,o)=>{calls++;assert.equal(url,platformEndpoint);assert.equal(o.headers['X-Gateway-Authorization'],'Bearer test-platform-key');return new Response(good,{headers:{'Content-Type':'text/event-stream'}})};
  await import('../assets/index.ts');
  const preflight=await handler(new Request('https://edge.example.test',{method:'OPTIONS',headers:{Origin:'https://qa.medo.dev'}}));
  assert.equal(preflight.status,204);assert.equal(calls,0);
  const result=await handler(request(undefined,{Origin:'https://qa.medo.dev',Authorization:'Bearer test-public-key',apikey:'test-public-key'}));
  assert.equal(result.status,200);assert.equal(await result.text(),good);assert.equal(calls,1);assert.deepEqual(envReads,['INTEGRATIONS_API_KEY']);
 }finally{globalThis.fetch=previousFetch;if(previousDeno===undefined)delete globalThis.Deno;else globalThis.Deno=previousDeno}
});
test('server auth/budget isolation and pass-through streaming',async()=>{
 let captured;const h=createHandler({...settings,fetchImpl:async(url,o)=>{captured={url,o};return new Response(good,{headers:{'Content-Type':'text/event-stream'}})}});
 const r=await h(request());assert.equal(r.status,200);assert.equal(captured.url,platformEndpoint);assert.equal(captured.o.headers['X-Gateway-Authorization'],'Bearer test-platform-key');assert.equal(captured.o.headers['X-Vertex-AI-LLM-Shared-Request-Type'],'offpeak');
 assert.deepEqual(JSON.parse(captured.o.body).generationConfig,{maxOutputTokens:8192});assert.equal(JSON.parse(captured.o.body).model,undefined);assert.equal(await r.text(),good);
});
test('server rejects JSON on successful streaming request',async()=>{const h=createHandler({...settings,fetchImpl:async()=>Response.json({candidates:[]})});assert.equal((await h(request())).status,502)});
test('server HTTP429 preserved without retry',async()=>{let calls=0;const h=createHandler({...settings,fetchImpl:async()=>{calls++;return Response.json({}, {status:429})}});assert.equal((await h(request())).status,429);assert.equal(calls,1)});
test('wrong reported model is not accepted as a silent model switch',async()=>{
 const raw=good+event({modelVersion:'gemini-4-argon'});
 await assert.rejects(()=>generateGemini({...params,model:'gemini-3.8-flash',fetchImpl:async()=>new Response(raw,{headers:{'Content-Type':'text/event-stream'}})}),e=>e.code==='reported_model_mismatch'&&e.partialText==='你好🚲完成');
});

test('final MAX_TOKENS frame retains its partial text',()=>{
 const p=createGeminiParser();assert.throws(()=>p.push(enc.encode(event(frame('last partial','MAX_TOKENS')))),e=>e.code==='output_limit_reached'&&e.partialText==='last partial');
});

test('browser input cannot choose an upstream endpoint',async()=>{
 let calls=0;const h=createHandler({...settings,fetchImpl:async()=>{calls++;throw Error()}});
 const r=await h(request({contents:[{role:'user',parts:[{text:'Hi'}]}],endpoint:'https://untrusted.example.test'}));
 assert.equal(r.status,400);assert.equal(calls,0);
});
test('upstream failures retain numeric status without leaking supplier details',async()=>{
 const h=createHandler({...settings,fetchImpl:async()=>Response.json({message:'private supplier details'},{status:404})});
 const r=await h(request());assert.equal(r.status,502);assert.deepEqual(await r.json(),{error:'upstream_http_error',upstream_status:404});
});