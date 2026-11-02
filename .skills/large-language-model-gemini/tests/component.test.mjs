import React from 'react';
import {create,act} from 'react-test-renderer';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GeminiChat} from './GeminiChat.bundle.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const props={endpoint:'https://app.example.test/functions/v1/large-language-model-gemini',anonKey:'test-public-key',modelName:'gemini-3.8-flash'};
const enc=new TextEncoder();
const frame=(text,finish)=>'data: '+JSON.stringify({candidates:[{content:{parts:[{text}]},...(finish?{finishReason:finish}:{})}]})+'\n\n';
const flush=()=>new Promise(r=>setImmediate(r));
const button=(view,label)=>view.root.findAllByType('button').find(b=>b.children.includes(label));
async function mount(extra={}){let view;await act(async()=>{view=create(React.createElement(GeminiChat,{...props,...extra}))});await act(async()=>{view.root.findByType('textarea').props.onChange({target:{value:'Hello'}})});return view}
async function run(extra,callback){const original=globalThis.fetch;let view;try{view=await mount(extra);await callback(view)}finally{if(view)await act(async()=>view.unmount());globalThis.fetch=original}}
test('stateless UI generates without login and displays real partial output before completion',async()=>run({},async view=>{
 let wire,request,count=0,pending,finished=false;
 globalThis.fetch=async(_url,o)=>{count++;request=o;return new Response(new ReadableStream({start(c){wire=c}}),{headers:{'Content-Type':'text/event-stream'}})};
 assert.equal(button(view,'Generate').props.disabled,false);assert.equal(button(view,'Sign in'),undefined);
 await act(async()=>{pending=button(view,'Generate').props.onClick().then(()=>{finished=true});await flush()});
 assert.equal(count,1);assert.equal(request.headers.Authorization,'Bearer test-public-key');assert.equal(JSON.parse(request.body).model,props.modelName);
 assert.equal(view.root.findByProps({role:'status'}).children.join(''),'Waiting for reply');
 assert.equal(button(view,'Generate').props.disabled,true);assert.equal(button(view,'Stop').props.disabled,false);
 await act(async()=>{wire.enqueue(enc.encode(frame('early ')));await flush()});
 assert.equal(finished,false);assert.equal(view.root.findByType('div').children.join(''),'early ');assert.equal(view.root.findByProps({role:'status'}).children.join(''),'LIVE');
 await act(async()=>{wire.enqueue(enc.encode(frame('done','STOP')));wire.close();await pending});
 assert.equal(view.root.findByType('div').children.join(''),'early done');assert.equal(view.root.findByProps({role:'status'}).children.join(''),'completed');assert.equal(button(view,'Stop').props.disabled,true);
}));
test('account-based UI blocks an expired session without anon fallback',async()=>run({userId:'test-user',getAccessToken:async()=>null},async view=>{
 let count=0;globalThis.fetch=async()=>{count++;throw Error('unexpected fetch')};
 await act(async()=>{await button(view,'Generate').props.onClick()});assert.equal(count,0);assert.match(view.root.findByProps({role:'alert'}).children.join(''),/authentication_required/);assert.equal(view.root.findByType('textarea').props.value,'Hello');
}));
test('account-based UI passes its current user token',async()=>run({userId:'test-user',getAccessToken:async()=>'test-user-token'},async view=>{
 let request;globalThis.fetch=async(_url,o)=>{request=o;return new Response(frame('ok','STOP'),{headers:{'Content-Type':'text/event-stream'}})};
 await act(async()=>{await button(view,'Generate').props.onClick()});assert.equal(request.headers.Authorization,'Bearer test-user-token');assert.equal(view.root.findByType('div').children.join(''),'ok');
}));
test('Stop cancels an in-flight stateless request and preserves input',async()=>run({},async view=>{
 let pending;globalThis.fetch=async(_url,o)=>new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
 await act(async()=>{pending=button(view,'Generate').props.onClick();await flush()});await act(async()=>{button(view,'Stop').props.onClick();await pending});
 assert.equal(view.root.findByProps({role:'status'}).children.join(''),'cancelled');assert.equal(view.root.findByType('textarea').props.value,'Hello');assert.equal(button(view,'Generate').props.disabled,false);
}));
test('account switch clears old output and ignores the interrupted request',async()=>run({},async view=>{
 let wire,pending;globalThis.fetch=async()=>new Response(new ReadableStream({start(c){wire=c}}),{headers:{'Content-Type':'text/event-stream'}});
 await act(async()=>{pending=button(view,'Generate').props.onClick();await flush();wire.enqueue(enc.encode(frame('old account')));await flush()});
 assert.equal(view.root.findByType('div').children.join(''),'old account');
 await act(async()=>{view.update(React.createElement(GeminiChat,{...props,userId:'another-user',getAccessToken:async()=>'another-token'}));await flush()});
 await act(async()=>{wire.enqueue(enc.encode(frame(' stale','STOP')));wire.close();await pending});assert.equal(view.root.findByType('div').children.join(''),'');assert.equal(view.root.findByProps({role:'status'}).children.join(''),'idle');
}));