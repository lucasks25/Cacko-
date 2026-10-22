import asyncio,json,unittest
from unittest.mock import patch
import httpx
from test_api import client,headers,settings
from app.providers import Chatwoot,ProviderError

class MessagingTests(unittest.TestCase):
 def run_provider(self,respond,operation):
  async def run():
   async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
    cw=Chatwoot({'chatwoot_url':'https://cw.example','chatwoot_account_id':7,'chatwoot_api_token':'server-secret'},http)
    return await operation(cw)
  return asyncio.run(run())
 def test_conversations_page_and_status_are_forwarded_without_exposing_provider_fields(self):
  def respond(request):
   self.assertEqual(request.url.params['page'],'3');self.assertEqual(request.url.params['status'],'pending')
   return httpx.Response(200,json={'data':{'meta':{'all_count':62},'payload':[{'id':31,'status':'pending','meta':{'sender':{'name':'Ana'}},'access_token':'secret'}]}})
  page=self.run_provider(respond,lambda cw:cw.conversation_page(3,'pending'))
  self.assertEqual(page['conversations'][0]['id'],'31');self.assertTrue(page['hasMore']);self.assertNotIn('secret',str(page))
 def test_old_messages_use_a_before_cursor_and_preserve_chronological_order(self):
  def respond(request):
   self.assertEqual(request.url.path,'/api/v1/accounts/7/conversations/9/messages');self.assertEqual(request.url.params['before'],'101')
   return httpx.Response(200,json={'payload':[{'id':90,'content':'Antiga','message_type':0},{'id':100,'content':'Mais recente','message_type':1}]})
  messages=self.run_provider(respond,lambda cw:cw.messages(9,before=101))
  self.assertEqual([m['id'] for m in messages],['90','100'])
 def test_polling_new_messages_uses_after_cursor_so_busy_conversations_do_not_skip_messages(self):
  def respond(request):
   self.assertEqual(request.url.params['after'],'100')
   return httpx.Response(200,json={'payload':[{'id':101,'content':'Nova','message_type':0}]})
  result=self.run_provider(respond,lambda cw:cw.messages(9,after=100))
  self.assertEqual(result[0]['id'],'101')
 def test_inboxes_are_sanitized_and_unsupported_channels_cannot_start_conversations(self):
  data={'payload':[{'id':1,'name':'WhatsApp','channel_type':'Channel::Whatsapp','api_key':'secret'},{'id':2,'name':'Instagram','channel_type':'Channel::Instagram','access_token':'secret'}]}
  result=self.run_provider(lambda _:httpx.Response(200,json=data),lambda cw:cw.inboxes())
  self.assertTrue(result[0]['canStart']);self.assertFalse(result[1]['canStart']);self.assertNotIn('secret',str(result))
 def test_contact_search_escapes_query_and_preserves_pagination(self):
  def respond(request):
   self.assertEqual(request.url.params['q'],'Ana & Filhos');self.assertEqual(request.url.params['page'],'2')
   return httpx.Response(200,json={'meta':{'has_more':True},'payload':[{'id':8,'name':'Ana','phone_number':'+5511999991234','access_token':'secret'}]})
  result=self.run_provider(respond,lambda cw:cw.contacts('Ana & Filhos',2))
  self.assertEqual(result['contacts'][0]['id'],'8');self.assertTrue(result['hasMore']);self.assertNotIn('secret',str(result))
 def test_create_contact_uses_account_scoped_api_and_sanitizes_response(self):
  def respond(request):
   self.assertEqual(request.url.path,'/api/v1/accounts/7/contacts')
   self.assertEqual(json.loads(request.content),{'name':'Ana','phone_number':'+5511999991234'})
   return httpx.Response(200,json={'payload':{'contact':{'id':8,'name':'Ana','phone_number':'+5511999991234','access_token':'secret'}}})
  result=self.run_provider(respond,lambda cw:cw.create_contact({'name':'Ana','phone_number':'+5511999991234'}))
  self.assertEqual(result['id'],'8');self.assertNotIn('secret',str(result))
 def test_loading_a_linked_conversation_keeps_account_scope_and_sanitizes_metadata(self):
  def respond(request):
   self.assertEqual(request.url.path,'/api/v1/accounts/7/conversations/55')
   return httpx.Response(200,json={'id':55,'status':'open','meta':{'sender':{'name':'Ana'},'access_token':'secret'}})
  result=self.run_provider(respond,lambda cw:cw.conversation(55))
  self.assertEqual(result['name'],'Ana');self.assertNotIn('secret',str(result))
 def test_new_conversation_validates_channel_and_contact_and_does_not_send_a_message(self):
  requests=[]
  def respond(request):
   requests.append(request)
   if request.url.path.endswith('/inboxes'):return httpx.Response(200,json={'payload':[{'id':2,'name':'WhatsApp','channel_type':'Channel::Whatsapp'}]})
   if request.url.path.endswith('/contacts/8'):return httpx.Response(200,json={'payload':{'id':8,'name':'Ana','phone_number':'+5511999991234'}})
   self.assertEqual(json.loads(request.content),{'inbox_id':2,'contact_id':8,'status':'open'})
   return httpx.Response(200,json={'id':55,'inbox_id':2,'status':'open','meta':{'sender':{'name':'Ana','phone_number':'+5511999991234'}}})
  result=self.run_provider(respond,lambda cw:cw.create_conversation(8,2))
  self.assertEqual(result['id'],'55');self.assertEqual(sum(r.method=='POST' for r in requests),1)
  self.assertFalse(any('/messages' in str(r.url) for r in requests))
 def test_unsupported_channel_or_missing_contact_phone_never_creates_a_conversation(self):
  for channel in ['Channel::Instagram','Channel::Whatsapp']:
   requests=[]
   def respond(request):
    requests.append(request)
    if request.url.path.endswith('/inboxes'):return httpx.Response(200,json={'payload':[{'id':2,'name':'Canal','channel_type':channel}]})
    return httpx.Response(200,json={'payload':{'id':8,'name':'Ana'}})
   with self.assertRaises(ProviderError):self.run_provider(respond,lambda cw:cw.create_conversation(8,2))
   self.assertFalse(any(r.method=='POST' for r in requests))
 def test_messaging_routes_reject_invalid_cursors_and_client_supplied_tenant(self):
  for path in ['/v1/conversations?page=0','/v1/conversations?status=invalid','/v1/conversations/9/messages?before=-1','/v1/contacts?page=0']:
   self.assertEqual(client.get(path,headers=headers).status_code,422,path)
  self.assertEqual(client.post('/v1/conversations',headers=headers,json={'contactId':8,'inboxId':2,'tenant':'bob'}).status_code,422)
  self.assertEqual(client.post('/v1/contacts',headers=headers,json={'name':'Ana','phone':'11999991234'}).status_code,400)
  self.assertEqual(client.post('/v1/contacts',headers=headers,json={'name':'Ana','email':'invalid'}).status_code,400)
 def test_messages_endpoint_reports_cursor_and_older_history_availability(self):
  from unittest.mock import AsyncMock
  cw=AsyncMock();cw.messages.return_value=[{'id':str(i),'direction':'in','text':'Olá'} for i in range(80,100)]
  with patch('app.messaging.Chatwoot',return_value=cw):
   r=client.get('/v1/conversations/9/messages?before=100',headers=headers)
  self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['oldestId'],'80');self.assertTrue(r.json()['hasMore'])
  cw.messages.assert_awaited_once_with(9,before=100)
