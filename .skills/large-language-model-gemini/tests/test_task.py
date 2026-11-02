import importlib.util,unittest,json,io,os,argparse
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('task',Path(__file__).parents[1]/'scripts/generate_text.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def frame(text=None,finish=None):
 c={'content':{'parts':[] if text is None else [{'text':text}]}}
 if finish:c['finishReason']=finish
 return 'data: '+json.dumps({'candidates':[c]},ensure_ascii=False)+'\n\n'
class Tests(unittest.TestCase):
 def test_utf8_and_cr_frames(self):
  import codecs
  for nl in ['\n','\r','\r\n']:
   p=m.GeminiSSE();decoder=codecs.getincrementaldecoder('utf-8')('strict');raw=('\ufeff'+frame('你好🚲')+frame('完成','STOP')).replace('\n',nl).encode()
   for b in raw:p.feed(decoder.decode(bytes([b])))
   p.feed(decoder.decode(b'',final=True));self.assertEqual(p.end()['text'],'你好🚲完成')
 def test_missing_stop(self):
  p=m.GeminiSSE();p.feed(frame('partial'));self.assertRaises(m.ProtocolError,p.end)
 def test_max_tokens(self):
  p=m.GeminiSSE()
  with self.assertRaisesRegex(m.ProtocolError,'output_limit'):p.feed(frame('partial','MAX_TOKENS'))
  self.assertEqual(p.text,'partial')
 def test_no_done_required(self):
  p=m.GeminiSSE();p.feed(frame('ok','STOP').rstrip());self.assertEqual(p.end()['text'],'ok')
 def test_error_empty_and_bad_json(self):
  for raw in ['data: {bad}\n\n',frame('','STOP'),'data: {"error":{"message":"x"}}\n\n']:
   with self.assertRaises(m.ProtocolError):p=m.GeminiSSE();p.feed(raw);p.end()
 def test_platform_endpoint_binding(self):
  self.assertEqual(m.ENDPOINT,'https://app-eaujrj6ph0xt-api-oLpZXzgWolda.gateway.appmedo.com/v1/projects/miaoda-us-online/locations/global/publishers/google/models/gemini-3.8-flash:streamGenerateContent?alt=sse')
 def test_cli_missing_configuration_json_stdout(self):
  with patch.dict(os.environ,{},clear=True),patch('sys.stdout',new_callable=io.StringIO) as stdout:
   code=m.run(argparse.Namespace(model=None,prompt='Hi',system='',timeout=30));self.assertEqual(code,2);self.assertEqual(json.loads(stdout.getvalue())['error'],'platform_key_missing')
 def test_cli_actual_caller_with_mock_gateway(self):
  class Response:
   headers={'Content-Type':'text/event-stream'}
   def __enter__(self):self.raw=(frame('你好🚲')+frame('完成','STOP')).encode();return self
   def __exit__(self,*a):pass
   def read1(self,n):chunk=self.raw[:1];self.raw=self.raw[1:];return chunk
  captured=[]
  def urlopen(req,timeout):captured.append(req);return Response()
  with patch.dict(os.environ,{'INTEGRATIONS_API_KEY':'test-platform-key'},clear=True),patch.object(m.urllib.request,'urlopen',urlopen),patch('sys.stdout',new_callable=io.StringIO) as stdout:
   code=m.run(argparse.Namespace(model=None,prompt='Hi',system='',timeout=30));data=json.loads(stdout.getvalue());self.assertEqual(code,0);self.assertEqual(data['text'],'你好🚲完成');self.assertTrue(data['ok']);self.assertIn('X-gateway-authorization',captured[0].headers);self.assertEqual(captured[0].full_url,m.ENDPOINT)
if __name__=='__main__':unittest.main()