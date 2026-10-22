import os,json,hmac,hashlib,datetime,asyncio,logging
from weakref import WeakValueDictionary
from contextlib import asynccontextmanager
from fastapi import FastAPI,Header,HTTPException,Depends,Request,BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel,Field,ConfigDict
from .config import Settings,ConfigurationError
from .store import Store,now,TERMINAL
from .policy import dial_number,is_auto_reply_eligible
from .providers import Chatwoot,ProviderError,generate_text

settings=Settings();store=Store(os.environ.get('DATABASE_PATH','data/contact-center.sqlite'))
log=logging.getLogger('contact-center')
call_locks=WeakValueDictionary()
conversation_locks=WeakValueDictionary()
def scoped_lock(collection,key):
 lock=collection.get(key)
 if lock is None:lock=asyncio.Lock();collection[key]=lock
 return lock
app=FastAPI(title='Fluxo Contact — Chatwoot + LiveKit',docs_url=None,redoc_url=None)
@app.exception_handler(ProviderError)
async def provider_error(request,exc):return JSONResponse({'error':str(exc)},status_code=502)
@app.exception_handler(ConfigurationError)
async def config_error(request,exc):return JSONResponse({'error':str(exc)},status_code=503)
@app.exception_handler(ValueError)
async def validation_error(request,exc):return JSONResponse({'error':str(exc)},status_code=400)
@app.exception_handler(HTTPException)
async def http_error(request,exc):return JSONResponse({'error':exc.detail},status_code=exc.status_code)
async def tenant(authorization:str=Header(default=''),x_crm_tenant:str=Header(default='')):
 if not hmac.compare_digest(authorization,'Bearer '+settings.token):raise HTTPException(401,'Serviço não autorizado.')
 settings.tenant(x_crm_tenant);return x_crm_tenant
async def internal_auth(authorization:str=Header(default='')):
 if not hmac.compare_digest(authorization,'Bearer '+settings.token):raise HTTPException(401,'Serviço não autorizado.')
class Message(BaseModel):
 model_config=ConfigDict(extra='forbid')
 text:str=Field(min_length=1,max_length=10000)
 private:bool=False
class AgentConfig(BaseModel):
 model_config=ConfigDict(extra='forbid')
 name:str=Field(min_length=1,max_length=100)
 instructions:str=Field(min_length=10,max_length=20000)
 knowledge:str=Field(default='',max_length=30000)
 greeting:str=Field(default='Olá! Sou o assistente virtual. Como posso ajudar?',max_length=1000)
 autoReply:bool=False
 inboxIds:list[int]=Field(default_factory=list,max_length=100)
class Status(BaseModel):status:str
class CallInput(BaseModel):
 model_config=ConfigDict(extra='forbid')
 action:str
 requestId:str=Field(min_length=8,max_length=100)
 number:str=''
 kind:str='ai'
 leadId:str=''
class CallEdit(BaseModel):
 action:str=''
 callId:str=''
 outcome:str=Field(default='',max_length=80)
 notes:str=Field(default='',max_length=5000)
class Assist(BaseModel):
 conversationId:str=Field(pattern=r'^\d{1,15}$')
 task:str='reply'
@app.get('/health')
async def health():return {'service':'fluxo-contact','status':'ready'}
@app.get('/v1/status')
async def status(t=Depends(tenant)):
 state=settings.public_status(t);state['chatwootOnline']=False
 if state['chatwootConfigured']:
  try:await Chatwoot(settings.tenant(t)).request('GET','/inboxes');state['chatwootOnline']=True
  except ProviderError:pass
 state['configured']=True;return state
@app.get('/v1/conversations')
async def conversations(t=Depends(tenant)):return {'conversations':await Chatwoot(settings.tenant(t)).conversations()}
@app.get('/v1/conversations/{conversation_id}/messages')
async def messages(conversation_id:int,t=Depends(tenant)):return {'messages':await Chatwoot(settings.tenant(t)).messages(conversation_id)}
@app.post('/v1/conversations/{conversation_id}/messages')
async def send_message(conversation_id:int,data:Message,t=Depends(tenant)):
 if not data.text.strip():raise HTTPException(400,'Informe a mensagem.')
 return {'message':await Chatwoot(settings.tenant(t)).send(conversation_id,data.text.strip(),data.private)}
@app.post('/v1/conversations/{conversation_id}/status')
async def change_status(conversation_id:int,data:Status,t=Depends(tenant)):
 if data.status not in ['open','pending','resolved']:raise HTTPException(400,'Status inválido.')
 await Chatwoot(settings.tenant(t)).status(conversation_id,data.status);return {'status':data.status}
@app.get('/v1/agent')
async def agent(t=Depends(tenant)):return {'agent':store.agent(t)}
@app.put('/v1/agent')
async def save_agent(data:AgentConfig,t=Depends(tenant)):return {'agent':store.save_agent(t,data.model_dump())}
@app.post('/v1/assist')
async def assist(data:Assist,t=Depends(tenant)):
 if data.task not in ['reply','summary']:raise HTTPException(400,'Operação inválida.')
 messages=await Chatwoot(settings.tenant(t)).messages(data.conversationId)
 return {'text':await generate_text(settings,store.agent(t),messages,data.task),'sent':False}
class AgentChat(BaseModel):
 agent:str
 messages:list[dict]=Field(max_length=40,min_length=1)
 context:dict=Field(default_factory=dict)
@app.post('/v1/chat')
async def chat(data:AgentChat,t=Depends(tenant)):
 roles={'waz':'Vendas e atendimento comercial','maky':'Marketing e criação de rascunhos','fin':'Organização de registros financeiros','opy':'Organização de operações e escalas','juri':'Organização de documentos e prazos contratuais','pipo':'Organização de vagas e conhecimento da equipe'}
 if data.agent not in roles:raise HTTPException(400,'Agente inválido.')
 messages=[]
 for m in data.messages:
  if m.get('role') not in ['user','assistant'] or not isinstance(m.get('content'),str) or len(m['content'])>10000:raise HTTPException(400,'Histórico inválido.')
  messages.append({'direction':'in' if m['role']=='user' else 'out','text':m['content']})
 agent=store.agent(t)
 agent['instructions']='Você auxilia com '+roles[data.agent]+'. Responda em português brasileiro. Produza rascunhos e orientações operacionais. Não tome decisões jurídicas, médicas, financeiras ou de contratação. Não realize ações externas nem diga que realizou ações. Dados do negócio: '+json.dumps(data.context,ensure_ascii=False)[:10000]+'\n'+agent['instructions']
 return {'text':await generate_text(settings,agent,messages),'sent':False}
@app.get('/v1/calls')
async def calls(t=Depends(tenant)):return {'calls':store.calls(t)}
def own_call(t,call_id):
 record=store.call(t,call_id)
 if not record:raise HTTPException(404,'Chamada não encontrada.')
 return record
async def livekit():
 from livekit import api
 return api.LiveKitAPI(url=os.environ['LIVEKIT_URL'],api_key=os.environ['LIVEKIT_API_KEY'],api_secret=os.environ['LIVEKIT_API_SECRET'])
def join_token(t,record):
 from livekit import api
 return api.AccessToken(os.environ['LIVEKIT_API_KEY'],os.environ['LIVEKIT_API_SECRET']).with_identity('operator_'+hashlib.sha256(t.encode()).hexdigest()[:16]).with_name('Operador').with_ttl(datetime.timedelta(minutes=15)).with_grants(api.VideoGrants(room_join=True,room=record['room'],can_publish=True,can_subscribe=True,can_publish_data=False)).to_jwt()
async def close_provider_room(client,t,record,force=False):
 from livekit import api
 if record.get('roomCreated') or force:
  try:await client.room.delete_room(api.DeleteRoomRequest(room=record['room']))
  except Exception as exc:
   if getattr(exc,'code',None)!='not_found':
    store.update_call(t,record['id'],{'status':'cancelling','error':'O provedor ainda não confirmou o encerramento.'})
    raise HTTPException(502,'O provedor não confirmou o encerramento. Atualize e tente encerrar novamente.')
 return store.update_call(t,record['id'],{'status':record.get('cancelReason') if record.get('cancelReason') in TERMINAL else record['status'] if record['status'] in TERMINAL else 'completed' if record.get('startedAt') else 'cancelled','endedAt':now(),'roomCreated':False})
class CallCancelled(Exception):pass
@app.post('/v1/calls')
async def start_call(data:CallInput,t=Depends(tenant)):
 cfg=settings.tenant(t);state=settings.public_status(t)
 if data.action not in ['start','test'] or data.kind not in ['ai','human']:raise HTTPException(400,'Tipo de chamada inválido.')
 if not state['voiceConfigured']:raise HTTPException(503,'Configure LiveKit no servidor antes de iniciar áudio.')
 number=''
 if data.action=='start':
  number=dial_number(data.number)
  if not state['pstnEnabled']:raise HTTPException(503,'Telefonia externa desativada. Configure um tronco SIP e habilite-o para esta conta.')
  allowed=cfg.get('allowed_numbers',[])
  if allowed and number not in allowed:raise HTTPException(403,'Número fora da lista permitida para esta conta.')
 record=store.create_call(t,data.requestId,{'number':number,'kind':data.kind,'leadId':data.leadId,'direction':'out','test':data.action=='test'})
 lock=scoped_lock(call_locks,(t,record['id']))
 async with lock:
  if store.claim_start(t,record['id']):
   from livekit import api
   client=await livekit()
   async def check_cancel():
    current=store.call(t,record['id'])
    if current.get('cancelRequested') or current['status'] in TERMINAL or current['status']=='cancelling':
     await close_provider_room(client,t,current);raise CallCancelled()
   try:
    await check_cancel()
    metadata=json.dumps({'tenant':t,'callId':record['id'],'agent':store.agent(t)})
    await client.room.create_room(api.CreateRoomRequest(name=record['room'],empty_timeout=60,departure_timeout=20,metadata=metadata))
    store.update_call(t,record['id'],{'roomCreated':True});await check_cancel()
    if data.kind=='ai':await client.agent_dispatch.create_dispatch(api.CreateAgentDispatchRequest(agent_name='fluxo-atendimento',room=record['room'],metadata=metadata))
    await check_cancel()
    if number:await client.sip.create_sip_participant(api.CreateSIPParticipantRequest(sip_trunk_id=cfg['sip_trunk_id'],sip_call_to=number,room_name=record['room'],participant_identity='phone_'+record['id'],participant_name='Cliente',wait_until_answered=False))
    await check_cancel()
    store.update_call(t,record['id'],{'status':'ringing'})
   except CallCancelled:pass
   except HTTPException:raise
   except Exception:
    await close_provider_room(client,t,store.call(t,record['id']),force=True)
    store.update_call(t,record['id'],{'status':'failed','endedAt':now(),'error':'O provedor não iniciou a chamada.'})
    raise HTTPException(502,'O provedor não iniciou a chamada. Confira o histórico antes de tentar novamente.')
   finally:await client.aclose()
  record=store.call(t,record['id'])
 result={'call':record}
 if record['status'] not in TERMINAL and not record.get('cancelRequested') and (data.action=='test' or data.kind=='human'):result.update({'url':os.environ['LIVEKIT_URL'],'token':join_token(t,record)})
 return result
@app.post('/v1/calls/{call_id}/join')
async def join(call_id:str,data:CallEdit,t=Depends(tenant)):
 record=own_call(t,call_id)
 if record['status'] in TERMINAL:raise HTTPException(409,'Esta chamada já terminou.')
 return {'call':record,'url':os.environ['LIVEKIT_URL'],'token':join_token(t,record)}
@app.post('/v1/calls/{call_id}/finish')
async def finish(call_id:str,data:CallEdit,t=Depends(tenant)):
 record=own_call(t,call_id)
 if record['status'] in TERMINAL and not record.get('roomCreated'):return {'call':record}
 store.update_call(t,call_id,{'cancelRequested':True})
 lock=scoped_lock(call_locks,(t,call_id))
 async with lock:
  record=own_call(t,call_id)
  if record['status'] in TERMINAL and not record.get('roomCreated'):return {'call':record}
  client=await livekit()
  try:record=await close_provider_room(client,t,record)
  finally:await client.aclose()
 return {'call':record}
@app.post('/v1/calls/{call_id}/classify')
async def classify(call_id:str,data:CallEdit,t=Depends(tenant)):
 own_call(t,call_id);return {'call':store.update_call(t,call_id,{'outcome':data.outcome,'notes':data.notes})}
@app.post('/internal/calls/event',dependencies=[Depends(internal_auth)])
async def call_event(request:Request):
 data=await request.json();t=data.get('tenant');settings.tenant(t);record=own_call(t,data.get('callId',''))
 if data.get('transcript'):
  item=data['transcript'];store.append_transcript(t,record['id'],{'id':str(item.get('id',''))[:100],'role':'assistant' if item.get('role')=='assistant' else 'user','text':str(item.get('text',''))[:10000],'at':now()})
 if data.get('status')=='failed':
  store.update_call(t,record['id'],{'cancelRequested':True,'cancelReason':'failed'})
  lock=scoped_lock(call_locks,(t,record['id']))
  async with lock:
   current=own_call(t,record['id'])
   if current.get('roomCreated'):
    client=await livekit()
    try:await close_provider_room(client,t,current)
    finally:await client.aclose()
   store.update_call(t,record['id'],{'status':'failed','endedAt':now()})
  return {'ok':True}
 if data.get('status') in ['active','completed','failed','missed','handoff']:
  state=data['status'];changes={'status':state}
  if state=='active' and not record.get('startedAt'):changes['startedAt']=now()
  if state in TERMINAL:changes['endedAt']=now()
  store.update_call(t,record['id'],changes)
 return {'ok':True}

async def auto_reply(t,payload):
 lock=scoped_lock(conversation_locks,(t,payload['conversation']['id']))
 async with lock:await auto_reply_locked(t,payload)
async def auto_reply_locked(t,payload):
 event_id='cw_message_'+str(payload['id'])
 if not store.claim_event(t,event_id):return
 cw=Chatwoot(settings.tenant(t));cid=payload['conversation']['id']
 try:
  # Recheck ownership by a human just before generation and delivery.
  conversation=await cw.request('GET',f'/conversations/{int(cid)}')
  check={**payload,'conversation':conversation}
  if not is_auto_reply_eligible(check,store.agent(t)):store.finish_event(t,event_id,'skipped');return
  history=await cw.messages(cid)
  incoming=[m for m in history if m['direction']=='in' and m['status']!='note']
  if not incoming or str(max(incoming,key=lambda m:int(m['id']))['id'])!=str(payload['id']):store.finish_event(t,event_id,'skipped');return
  text=await generate_text(settings,store.agent(t),history)
  conversation=await cw.request('GET',f'/conversations/{int(cid)}')
  if not is_auto_reply_eligible({**payload,'conversation':conversation},store.agent(t)):store.finish_event(t,event_id,'skipped');return
  latest=[m for m in await cw.messages(cid) if m['direction']=='in' and m['status']!='note']
  if not latest or str(max(latest,key=lambda m:int(m['id']))['id'])!=str(payload['id']):store.finish_event(t,event_id,'skipped');return
  await cw.send(cid,text);store.finish_event(t,event_id,'sent')
 except Exception:
  # No automatic resend after an uncertain network response: prevent duplicate external messages.
  store.finish_event(t,event_id,'failed');log.warning('Falha na resposta automática; evento preservado para auditoria.')
@app.post('/webhooks/chatwoot/{tenant_id}')
async def chatwoot_hook(tenant_id:str,request:Request,background:BackgroundTasks):
 cfg=settings.tenant(tenant_id);expected=cfg.get('webhook_secret','')
 if len(expected)<32 or not hmac.compare_digest(request.query_params.get('key',''),expected):raise HTTPException(401,'Webhook não autorizado.')
 raw=await request.body()
 if len(raw)>200000:raise HTTPException(413,'Evento muito grande.')
 data=json.loads(raw)
 if str(data.get('account',{}).get('id'))!=str(cfg.get('chatwoot_account_id')):raise HTTPException(403,'Conta não corresponde ao tenant.')
 if is_auto_reply_eligible(data,store.agent(tenant_id)):background.add_task(auto_reply,tenant_id,data)
 return {'accepted':True}

@app.post('/webhooks/livekit')
async def livekit_hook(request:Request):
 from livekit import api
 raw=await request.body()
 if len(raw)>200000:raise HTTPException(413,'Evento muito grande.')
 try:event=api.WebhookReceiver(api.TokenVerifier(os.environ['LIVEKIT_API_KEY'],os.environ['LIVEKIT_API_SECRET'])).receive(raw.decode(),request.headers.get('Authorization',''))
 except Exception:raise HTTPException(401,'Assinatura de webhook inválida.')
 match=store.call_by_room(event.room.name)
 if not match:return {'accepted':True}
 t,record=match
 if not store.claim_event(t,'lk_'+event.id):return {'accepted':True}
 participant=event.participant
 changes={}
 if event.event=='participant_joined' and participant.identity.startswith('phone_') and participant.attributes.get('sip.callStatus')=='active':changes={'status':'active','startedAt':record.get('startedAt') or now()}
 if event.event=='room_finished' or (event.event=='participant_left' and participant.identity.startswith('phone_')):changes={'status':'completed' if record.get('startedAt') else 'missed','endedAt':now()}
 if changes:store.update_call(t,record['id'],changes)
 store.finish_event(t,'lk_'+event.id,'processed');return {'accepted':True}
