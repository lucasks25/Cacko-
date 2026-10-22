import asyncio,json,unittest
from unittest.mock import patch,AsyncMock
from test_api import client,headers,settings
from app.agent_tools import run_tool,ToolInput
from app.providers import ProviderError

class AgentToolTests(unittest.TestCase):
 def run_tool(self,agent,tool,result,context=None):
  with patch('app.agent_tools.generate_text',new=AsyncMock(return_value=json.dumps(result))):
   return asyncio.run(run_tool(ToolInput(agent=agent,tool=tool,prompt='Prepare um rascunho para revisão.',context=context or {}),settings,{}))
 def test_tools_are_bound_to_the_right_agent(self):
  with self.assertRaises(ValueError):self.run_tool('maky','proposal',{'name':'P'})
 def test_proposal_uses_catalog_prices_instead_of_model_supplied_prices(self):
  context={'products':[{'id':'p1','name':'Serviço','price':19.99}],'leadId':'lead-1'}
  r=self.run_tool('waz','proposal',{'name':'Proposta','items':[{'productId':'p1','quantity':3}],'discount':10,'notes':'Revisar'},context)
  self.assertEqual(r['data']['items'],[{'name':'Serviço','quantity':3.0,'price':19.99}]);self.assertEqual(r['data']['status'],'draft');self.assertEqual(r['data']['leadId'],'lead-1');self.assertFalse(r['sent'])
  with self.assertRaises(ProviderError):self.run_tool('waz','proposal',{'name':'P','items':[{'productId':'foreign','quantity':1}]},context)
 def test_financial_tool_never_claims_a_payment_was_made(self):
  r=self.run_tool('fin','transaction',{'name':'Internet','direction':'out','amount':100,'date':'2026-10-22','category':'Operação'})
  self.assertEqual(r['data']['status'],'pending')
  with self.assertRaises(ProviderError):self.run_tool('fin','transaction',{'name':'Internet','direction':'out','amount':100,'date':'2026-10-22','status':'paid'})
 def test_article_starts_unapproved_and_content_is_always_a_draft(self):
  r=self.run_tool('pipo','article',{'name':'Guia','text':'Conteúdo para revisão.'})
  self.assertFalse(r['data']['approved'])
  r=self.run_tool('maky','content',{'name':'Post','text':'Rascunho'}, {'kind':'blog'})
  self.assertEqual(r['data']['kind'],'blog');self.assertEqual(r['data']['status'],'draft')
 def test_wiki_answer_rejects_unapproved_or_missing_citations(self):
  with patch('app.agent_tools.generate_text',new=AsyncMock()) as generate:
   with self.assertRaises(ValueError):asyncio.run(run_tool(ToolInput(agent='pipo',tool='wiki-answer',prompt='Qual o horário?',context={'articles':[{'id':'a','approved':False,'text':'Privado'}]}),settings,{}))
   generate.assert_not_awaited()
  context={'articles':[{'id':'a','approved':True,'name':'Horário','text':'9h às 18h.'}]}
  r=self.run_tool('pipo','wiki-answer',{'text':'9h às 18h.','articleIds':['a']},context)
  self.assertEqual(r['citations'],['a'])
  with self.assertRaises(ProviderError):self.run_tool('pipo','wiki-answer',{'text':'Resposta','articleIds':['other']},context)
 def test_shift_requires_existing_member_and_chronological_hours(self):
  ctx={'members':[{'id':'m1','name':'Ana'}]}
  r=self.run_tool('opy','shift',{'memberId':'m1','date':'2026-10-22','start':'09:00','end':'18:00','team':'Vendas'},ctx)
  self.assertEqual(r['data']['start'],'09:00')
  for patch_ in [{'memberId':'other'},{'end':'08:00'}]:
   with self.assertRaises(ProviderError):self.run_tool('opy','shift',{'memberId':'m1','date':'2026-10-22','start':'09:00','end':'18:00',**patch_},ctx)
 def test_contract_extract_validates_dates_and_preserves_source_text(self):
  source='Contrato de teste. Vencimento 22/10/2027.'
  r=self.run_tool('juri','contract',{'name':'Contrato','counterparty':'Empresa','expires':'2027-10-22','value':1200}, {'sourceText':source})
  self.assertEqual(r['data']['text'],source);self.assertEqual(r['data']['expires'],'2027-10-22');self.assertEqual(r['data']['status'],'imported')
 def test_result_rejects_unknown_fields_and_invalid_json(self):
  with self.assertRaises(ProviderError):self.run_tool('maky','content',{'name':'Post','text':'X','url':'https://attacker.invalid','published':True})
  with patch('app.agent_tools.generate_text',new=AsyncMock(return_value='Não é JSON')):
   with self.assertRaises(ProviderError):asyncio.run(run_tool(ToolInput(agent='maky',tool='content',prompt='Um post'),settings,{}))
 def test_routes_require_auth_and_do_not_fake_ai_without_a_provider(self):
  self.assertEqual(client.post('/v1/tools',json={}).status_code,401)
  self.assertEqual(client.post('/v1/tools',headers=headers,json={'agent':'maky','tool':'content','prompt':'Crie um post','context':{}}).status_code,502)
  self.assertEqual(client.post('/v1/tools',headers=headers,json={'agent':'waz','tool':'content','prompt':'Crie um post'}).status_code,400)
