#!/usr/bin/env python3
"""Standalone task: native Gemini SSE via the assigned platform gateway, JSON stdout.
Environment: INTEGRATIONS_API_KEY (platform-managed). Run inside the MeDo platform; no supplier-key fallback.
"""
import argparse,codecs,json,os,re,sys,time,urllib.request,urllib.error,urllib.parse
from pathlib import Path
CONFIG=json.loads((Path(__file__).resolve().parents[1]/'assets/model-config.json').read_text())
def emit(obj):print(json.dumps(obj,ensure_ascii=False,separators=(',',':')))
# Platform API-ID annotation, identical to the existing managed Skill convention.
ENDPOINT='https://app-eaujrj6ph0xt-api-oLpZXzgWolda.gateway.appmedo.com/v1/projects/miaoda-us-online/locations/global/publishers/google/models/gemini-3.8-flash:streamGenerateContent?alt=sse'
class ProtocolError(ValueError):pass
class GeminiSSE:
 def __init__(self):
  self.line='';self.data=[];self.kind='';self.cr=False;self.started=False;self.text='';self.finish=None;self.model=None;self.usage=None
 def dispatch(self):
  payload='\n'.join(self.data);kind=self.kind;self.data=[];self.kind=''
  if not payload.strip():return
  if payload.strip()=='[DONE]':raise ProtocolError('unexpected_openai_protocol')
  try:d=json.loads(payload)
  except ValueError:raise ProtocolError('invalid_sse_json')
  if kind=='error' or d.get('error'):raise ProtocolError('upstream_stream_error')
  if d.get('promptFeedback',{}).get('blockReason'):raise ProtocolError('content_filtered')
  self.model=d.get('modelVersion',self.model);self.usage=d.get('usageMetadata',self.usage)
  candidates=d.get('candidates',[])
  if not isinstance(candidates,list):raise ProtocolError('invalid_candidates')
  for c in candidates:
   if c.get('index',0)!=0:continue
   for part in c.get('content',{}).get('parts',[]):
    if part.get('thought') is True:continue
    if any(k in part for k in ['functionCall','inlineData','fileData']):raise ProtocolError('unsupported_output_part')
    text=part.get('text','')
    if not isinstance(text,str):raise ProtocolError('invalid_text')
    self.text+=text
    if len(self.text)>1000000:raise ProtocolError('output_too_large')
   if c.get('finishReason'):
    self.finish=c['finishReason']
    if self.finish!='STOP':raise ProtocolError('output_limit_reached' if self.finish=='MAX_TOKENS' else 'incomplete_or_filtered')
 def endline(self):
  if self.line=='':self.dispatch()
  elif self.line.startswith('data:'):self.data.append(self.line[5:].removeprefix(' '))
  elif self.line=='data':self.data.append('')
  elif self.line.startswith('event:'):self.kind=self.line[6:].strip()
  self.line=''
 def feed(self,s):
  for ch in s:
   if not self.started:
    self.started=True
    if ch=='\ufeff':continue
   if self.cr:
    self.cr=False
    if ch=='\n':continue
   if ch=='\r':self.endline();self.cr=True
   elif ch=='\n':self.endline()
   else:
    self.line+=ch
    if len(self.line)>2000000:raise ProtocolError('sse_line_too_large')
 def end(self):
  if self.line:self.endline()
  self.dispatch()
  if self.finish!='STOP':raise ProtocolError('missing_stop_or_truncated')
  if not self.text.replace('\ufeff','').strip():raise ProtocolError('empty_output')
  return {'ok':True,'text':self.text,'model':self.model,'finishReason':self.finish,'usage':self.usage}
def run(args):
 key=os.environ.get('INTEGRATIONS_API_KEY','')
 if not key:emit({'ok':False,'error':'platform_key_missing'});return 2
 if CONFIG['model']!='gemini-3.8-flash':emit({'ok':False,'error':'invalid_model_configuration'});return 2
 if args.model and args.model!=CONFIG['model']:emit({'ok':False,'error':'unsupported_model'});return 2
 if not args.prompt.strip():emit({'ok':False,'error':'empty_prompt'});return 2
 body={'contents':[{'role':'user','parts':[{'text':args.prompt}]}],'generationConfig':{'maxOutputTokens':CONFIG['maxOutputTokens']}}
 if args.system:body['systemInstruction']={'parts':[{'text':args.system}]}
 parser=GeminiSSE();decoder=codecs.getincrementaldecoder('utf-8')('strict');start=time.monotonic()
 try:
  req=urllib.request.Request(ENDPOINT,data=json.dumps(body,ensure_ascii=False).encode(),headers={'Content-Type':'application/json','Accept':'text/event-stream','X-Gateway-Authorization':'Bearer '+key,'X-Vertex-AI-LLM-Shared-Request-Type':CONFIG['requestType']},method='POST')
  with urllib.request.urlopen(req,timeout=args.timeout) as r:
   if not re.match(r'^text/event-stream(?:\s*;|$)',r.headers.get('Content-Type',''),re.I):raise ProtocolError('stream_protocol_mismatch')
   while True:
    b=r.read1(4096)
    if not b:break
    parser.feed(decoder.decode(b))
    if time.monotonic()-start>args.timeout:raise TimeoutError()
   parser.feed(decoder.decode(b'',final=True));result=parser.end()
   if result['model'] and result['model']!=CONFIG['model']:raise ProtocolError('reported_model_mismatch')
  emit(result);return 0
 except urllib.error.HTTPError as e:emit({'ok':False,'error':'upstream_http_error','status':e.code,'partialText':parser.text});return 1
 except ProtocolError as e:emit({'ok':False,'error':str(e),'partialText':parser.text});return 1
 except UnicodeDecodeError:emit({'ok':False,'error':'invalid_utf8','partialText':parser.text});return 1
 except Exception:emit({'ok':False,'error':'network_or_runtime_error','partialText':parser.text});return 1
if __name__=='__main__':
 a=argparse.ArgumentParser(description=__doc__,epilog='Run in MeDo with platform-managed INTEGRATIONS_API_KEY; API-ID endpoint is bundled; output is JSON; never log credentials.')
 a.add_argument('--prompt',required=True);a.add_argument('--system',default='');a.add_argument('--model',default=None);a.add_argument('--timeout',type=int,default=180)
 args=a.parse_args()
 if not 1<=args.timeout<=300:emit({'ok':False,'error':'invalid_timeout'});sys.exit(2)
 sys.exit(run(args))