import unittest,os,json,tempfile,sys,asyncio
from pathlib import Path
os.environ.update({'SERVICE_TOKEN':'test-'+('x'*40),'TENANTS_JSON':json.dumps({'alice':{'chatwoot_url':'https://cw.example','chatwoot_account_id':1,'chatwoot_api_token':'secret-one'},'bob':{'chatwoot_url':'https://cw.example','chatwoot_account_id':2,'chatwoot_api_token':'secret-two'}}),'DATABASE_PATH':str(Path(tempfile.mkdtemp())/'api.sqlite')})
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app.main import app,store,settings,start_call,finish,CallInput,CallEdit,auto_reply,call_event
from app.providers import Chatwoot,generate_text
from app.config import Settings
import httpx
from unittest.mock import AsyncMock,patch
import jwt
client=TestClient(app)
headers={'Authorization':'Bearer '+os.environ['SERVICE_TOKEN'],'X-CRM-Tenant':'alice'}
class APITests(unittest.TestCase):
 def test_requests_require_service_auth_and_mapped_tenant(self):
  self.assertEqual(client.get('/v1/calls').status_code,401)
  self.assertEqual(client.get('/v1/calls',headers={**headers,'X-CRM-Tenant':'unknown'}).status_code,503)
 def test_calls_are_scoped_to_server_authenticated_tenant(self):
  call=store.create_call('alice','api-req123456',{'kind':'ai','number':'+5511999991234'})
  self.assertEqual(client.post('/v1/calls/'+call['id']+'/classify',headers={**headers,'X-CRM-Tenant':'bob'},json={'outcome':'X'}).status_code,404)
 def test_no_credentials_never_fabricate_a_call(self):
  r=client.post('/v1/calls',headers=headers,json={'action':'test','requestId':'api-test-1234'})
  self.assertEqual(r.status_code,503)
 def test_voice_tokens_are_short_lived_and_limited_to_one_room(self):
  fake=AsyncMock()
  values={'LIVEKIT_URL':'wss://test.livekit.invalid','LIVEKIT_API_KEY':'test-api-key','LIVEKIT_API_SECRET':'test-'+('s'*40)}
  with patch.dict(os.environ,values),patch.dict(settings.values,values),patch('app.main.livekit',return_value=fake):
   r=client.post('/v1/calls',headers=headers,json={'action':'test','requestId':'voice-room-scope-123'})
   self.assertEqual(r.status_code,200,r.text)
   data=r.json();claims=jwt.decode(data['token'],values['LIVEKIT_API_SECRET'],algorithms=['HS256'])
   self.assertEqual(claims['video']['room'],data['call']['room']);self.assertTrue(claims['video']['roomJoin'])
   self.assertFalse(claims['video'].get('roomAdmin',False));self.assertLessEqual(claims['exp']-claims['nbf'],900)
   again=client.post('/v1/calls',headers=headers,json={'action':'test','requestId':'voice-room-scope-123'})
   self.assertEqual(again.json()['call']['id'],data['call']['id']);self.assertEqual(fake.room.create_room.await_count,1)
 def test_forged_livekit_webhooks_are_rejected(self):
  self.assertEqual(client.post('/webhooks/livekit',json={'event':'room_finished','room':{'name':'foreign'}}).status_code,401)
 def test_cancellation_during_dispatch_never_dials_after_finish_returns(self):
  async def run():
   fake=AsyncMock();dispatched=asyncio.Event();release=asyncio.Event()
   async def block_dispatch(*args,**kwargs):dispatched.set();await release.wait()
   fake.agent_dispatch.create_dispatch.side_effect=block_dispatch
   values={'LIVEKIT_URL':'wss://test.livekit.invalid','LIVEKIT_API_KEY':'test-key','LIVEKIT_API_SECRET':'s'*40}
   cfg={**settings.tenants['alice'],'allow_pstn':True,'sip_trunk_id':'test-trunk'}
   with patch.dict(os.environ,values),patch.dict(settings.values,values),patch.dict(settings.tenants,{'alice':cfg}),patch('app.main.livekit',return_value=fake):
    start=asyncio.create_task(start_call(CallInput(action='start',number='+5511999991234',kind='ai',requestId='cancel-during-dispatch-test'),'alice'))
    await asyncio.wait_for(dispatched.wait(),2)
    record=next(c for c in store.calls('alice') if c['number']=='+5511999991234' and c['status']=='starting')
    end=asyncio.create_task(finish(record['id'],CallEdit(),'alice'))
    await asyncio.sleep(0)
    try:self.assertFalse(end.done(),'finish returned while dispatch could still dial')
    finally:release.set();await asyncio.gather(start,end,return_exceptions=True)
    self.assertEqual(fake.sip.create_sip_participant.await_count,0)
    self.assertEqual(store.call('alice',record['id'])['status'],'cancelled')
  asyncio.run(run())
 def test_new_incoming_message_supersedes_an_inflight_automatic_reply(self):
  async def run():
   fake=AsyncMock();started=asyncio.Event();release=asyncio.Event();history=[{'id':'401','text':'Primeira dúvida','direction':'in','status':'received'}];delivered=[]
   fake.request.return_value={'id':9,'status':'pending','meta':{'assignee':None}}
   async def messages(*args):return list(history)
   fake.messages.side_effect=messages
   async def generate(*args,**kwargs):
    if not started.is_set():started.set();await release.wait()
    return 'Resposta atualizada'
   async def send(*args):delivered.append(args)
   fake.send.side_effect=send
   old=store.agent('alice');store.save_agent('alice',{**old,'autoReply':True,'inboxIds':[2]})
   payload={'event':'message_created','id':401,'inbox':{'id':2},'message_type':'incoming','private':False,'content':'Primeira dúvida','conversation':{'id':9,'status':'pending','meta':{'assignee':None}}}
   try:
    with patch('app.main.Chatwoot',return_value=fake),patch('app.main.generate_text',side_effect=generate):
     first=asyncio.create_task(auto_reply('alice',payload));await asyncio.wait_for(started.wait(),2)
     history.append({'id':'402','text':'Outra dúvida','direction':'in','status':'received'})
     second=asyncio.create_task(auto_reply('alice',{**payload,'id':402,'content':'Outra dúvida'}));release.set()
     await asyncio.gather(first,second)
    self.assertEqual(delivered,[(9,'Resposta atualizada')])
   finally:store.save_agent('alice',old)
  asyncio.run(run())
 def test_agent_failure_during_dispatch_prevents_later_sip_dial(self):
  async def run():
   from starlette.requests import Request
   fake=AsyncMock();dispatched=asyncio.Event();release=asyncio.Event()
   async def block_dispatch(*args,**kwargs):dispatched.set();await release.wait()
   fake.agent_dispatch.create_dispatch.side_effect=block_dispatch
   values={'LIVEKIT_URL':'wss://test.livekit.invalid','LIVEKIT_API_KEY':'test-key','LIVEKIT_API_SECRET':'s'*40}
   cfg={**settings.tenants['alice'],'allow_pstn':True,'sip_trunk_id':'test-trunk'}
   with patch.dict(os.environ,values),patch.dict(settings.values,values),patch.dict(settings.tenants,{'alice':cfg}),patch('app.main.livekit',return_value=fake):
    start=asyncio.create_task(start_call(CallInput(action='start',number='+5511999992234',kind='ai',requestId='failure-during-dispatch-test'),'alice'))
    await asyncio.wait_for(dispatched.wait(),2)
    record=next(c for c in store.calls('alice') if c['number']=='+5511999992234')
    async def receive():return {'type':'http.request','body':json.dumps({'tenant':'alice','callId':record['id'],'status':'failed'}).encode()}
    failure=asyncio.create_task(call_event(Request({'type':'http'},receive)))
    await asyncio.sleep(0)
    try:self.assertFalse(failure.done(),'failure returned while dispatch could still dial')
    finally:release.set();await asyncio.gather(start,failure,return_exceptions=True)
    self.assertEqual(fake.sip.create_sip_participant.await_count,0)
    self.assertEqual(store.call('alice',record['id'])['status'],'failed')
  asyncio.run(run())
 def test_chatwoot_adapter_scopes_every_provider_request(self):
  requests=[]
  def respond(request):
   requests.append(request)
   return httpx.Response(200,json={'id':8,'content':'Olá','message_type':1,'created_at':1792584000,'private':False,'status':'sent'})
  async def run():
   async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
    cw=Chatwoot({'chatwoot_url':'https://cw.example','chatwoot_account_id':7,'chatwoot_api_token':'private'},http)
    result=await cw.send(9,'Olá')
    self.assertEqual(result['text'],'Olá')
    self.assertEqual(str(requests[0].url),'https://cw.example/api/v1/accounts/7/conversations/9/messages')
    self.assertEqual(requests[0].headers['api_access_token'],'private')
  asyncio.run(run())
 def test_copilot_generation_is_a_draft_not_automatic_delivery(self):
  sent=[]
  def respond(request):
   sent.append(json.loads(request.content));return httpx.Response(200,json={'choices':[{'message':{'content':'Posso ajudar com sua dúvida.'}}]})
  async def run():
   config=Settings({'SERVICE_TOKEN':'x'*32,'TENANTS_JSON':'{}','LLM_BASE_URL':'http://local.test/v1','LLM_MODEL':'test-model'})
   async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
    result=await generate_text(config,{'instructions':'Atenda bem.','knowledge':'Horário: 9h às 18h.'},[{'text':'Olá','direction':'in'}],client=http)
    self.assertEqual(result,'Posso ajudar com sua dúvida.');self.assertEqual(len(sent),1)
  asyncio.run(run())
 def test_auto_reply_cannot_be_enabled_by_leaking_a_secret_in_form(self):
  r=client.put('/v1/agent',headers=headers,json={'name':'A','instructions':'Seja objetivo.','api_key':'secret'})
  self.assertEqual(r.status_code,422)
 def test_webhook_without_per_tenant_secret_is_rejected(self):
  self.assertEqual(client.post('/webhooks/chatwoot/alice',json={'event':'message_created'}).status_code,401)
if __name__=='__main__':unittest.main()
