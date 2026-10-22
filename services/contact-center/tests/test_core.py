import unittest,tempfile,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.config import Settings,ConfigurationError
from app.store import Store
from app.policy import dial_number,public_message,is_auto_reply_eligible

class CoreTests(unittest.TestCase):
 def test_unmapped_users_never_inherit_another_account(self):
  settings=Settings({'SERVICE_TOKEN':'x'*32,'TENANTS_JSON':'{"alice":{"chatwoot_account_id":1,"chatwoot_api_token":"private","chatwoot_url":"https://support.example.com"}}'})
  self.assertEqual(settings.tenant('alice')['chatwoot_account_id'],1)
  with self.assertRaises(ConfigurationError):settings.tenant('bob')
  self.assertNotIn('private',str(settings.public_status('alice')))
 def test_same_chatwoot_account_cannot_be_shared_by_two_tenants(self):
  with self.assertRaises(ConfigurationError):Settings({'SERVICE_TOKEN':'x'*32,'TENANTS_JSON':'{"alice":{"chatwoot_account_id":1,"chatwoot_url":"https://a.example"},"bob":{"chatwoot_account_id":1,"chatwoot_url":"https://a.example"}}'})
 def test_idempotent_calls_and_scoped_access(self):
  with tempfile.TemporaryDirectory() as d:
   s=Store(str(Path(d)/'test.sqlite'))
   a=s.create_call('alice','request-123456',{'number':'+5511999991234','kind':'ai'})
   self.assertEqual(a['id'],s.create_call('alice','request-123456',{'number':'+5511999991234','kind':'ai'})['id'])
   self.assertIsNone(s.call('bob',a['id']))
   with self.assertRaises(ValueError):s.create_call('alice','request-123456',{'number':'+5511888881234','kind':'ai'})
   self.assertEqual(s.calls('bob'),[])
 def test_terminal_calls_do_not_reactivate_from_late_events(self):
  with tempfile.TemporaryDirectory() as d:
   s=Store(str(Path(d)/'test.sqlite'));a=s.create_call('a','req12345678',{'kind':'ai','number':'+5511999991234'})
   s.update_call('a',a['id'],{'status':'completed'});s.update_call('a',a['id'],{'status':'active'})
   self.assertEqual(s.call('a',a['id'])['status'],'completed')
 def test_late_ringing_event_cannot_downgrade_an_answered_call(self):
  with tempfile.TemporaryDirectory() as d:
   s=Store(str(Path(d)/'test.sqlite'));a=s.create_call('a','req12345678',{'kind':'ai','number':'+5511999991234'})
   s.update_call('a',a['id'],{'status':'active'});s.update_call('a',a['id'],{'status':'ringing'})
   self.assertEqual(s.call('a',a['id'])['status'],'active')
 def test_dialing_requires_explicit_international_number(self):
  self.assertEqual(dial_number('+55 (11) 99999-1234'),'+5511999991234')
  for bad in ['11999991234','+011999991234','sip:a@b','+551199;123']:
   with self.assertRaises(ValueError):dial_number(bad)
 def test_private_notes_and_ai_replies_do_not_trigger_another_ai_reply(self):
  payload={'event':'message_created','message_type':'incoming','private':False,'content':'Olá','id':7,'inbox':{'id':2},'conversation':{'id':9,'status':'pending','meta':{'assignee':None}}}
  config={'autoReply':True,'inboxIds':[2]}
  self.assertTrue(is_auto_reply_eligible(payload,config))
  self.assertFalse(is_auto_reply_eligible({**payload,'private':True},config))
  self.assertFalse(is_auto_reply_eligible({**payload,'message_type':'outgoing'},config))
  self.assertFalse(is_auto_reply_eligible(payload,{**config,'inboxIds':[]}))
  self.assertFalse(is_auto_reply_eligible({**payload,'conversation':{'id':9,'status':'open','meta':{'assignee':{'id':1}}}},config))
 def test_public_messages_do_not_expose_provider_credentials(self):
  out=public_message({'id':4,'content':'Olá','message_type':0,'private':False,'access_token':'secret','sender':{'name':'Ana','email':'private@example.com'},'created_at':1792584000})
  self.assertEqual(out['direction'],'in');self.assertNotIn('access_token',out);self.assertNotIn('email',str(out))

if __name__=='__main__':unittest.main()
