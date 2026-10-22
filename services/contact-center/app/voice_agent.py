"""Voice worker built on livekit/agents (Apache-2.0).
Reference: https://github.com/livekit/agents/blob/main/examples/voice_agents/basic_agent.py
No messages or calls are simulated. A configured LiveKit Inference account is required.
"""
import os,json,asyncio
import httpx
from livekit import agents,rtc
from livekit.agents import Agent,AgentSession,AgentServer,inference,room_io,RunContext,function_tool
from livekit.plugins import silero

server=AgentServer()
async def report(metadata,**changes):
 async with httpx.AsyncClient(timeout=10) as client:
  r=await client.post(os.environ.get('SERVICE_INTERNAL_URL','http://contact-center:8090')+'/internal/calls/event',headers={'Authorization':'Bearer '+os.environ['SERVICE_TOKEN']},json={'tenant':metadata['tenant'],'callId':metadata['callId'],**changes})
  r.raise_for_status()

class Assistant(Agent):
 def __init__(self,config,metadata):
  self.metadata=metadata
  super().__init__(instructions=config.get('instructions','Atenda em português brasileiro.')+'\nBase de conhecimento: '+config.get('knowledge','')+'\nVocê é um assistente virtual. Responda em português brasileiro. Não invente ações, preços nem confirmações. Se o cliente pedir uma pessoa, use solicitar_humano.')
 @function_tool
 async def solicitar_humano(self,context:RunContext):
  """Registra que o cliente deseja atendimento humano. Não afirma que uma transferência já ocorreu."""
  await report(self.metadata,status='handoff')
  return 'A solicitação de atendimento humano foi registrada no CRM. A equipe precisa entrar nesta ligação. Não afirme que já foi transferida.'

@server.rtc_session(agent_name='fluxo-atendimento')
async def entrypoint(ctx:agents.JobContext):
 metadata=json.loads(ctx.job.metadata or ctx.room.metadata or '{}')
 if not metadata.get('tenant') or not metadata.get('callId'):raise ValueError('Dispatch sem tenant/callId. Configure o serviço de integração.')
 config=metadata.get('agent',{});pending=set();answered=False;handed_off=False
 async def emit(**changes):
  try:await report(metadata,**changes)
  except Exception:ctx.log_context_fields={'call_event_delivery':'failed'}
 def enqueue(**changes):
  task=asyncio.create_task(emit(**changes));pending.add(task);task.add_done_callback(pending.discard)
 session=AgentSession(vad=silero.VAD.load(),stt=inference.STT(os.getenv('VOICE_STT_MODEL','deepgram/nova-3'),language='multi'),llm=inference.LLM(os.getenv('VOICE_LLM_MODEL','google/gemma-4-31b-it')),tts=inference.TTS(os.getenv('VOICE_TTS_MODEL','cartesia/sonic-3'),voice=os.getenv('VOICE_TTS_VOICE','9626c31c-bec5-4cca-baa8-f8ba9e84c8bc'),language='pt'))
 @session.on('conversation_item_added')
 def transcript(event):
  if event.item.text_content:enqueue(transcript={'id':event.item.id,'role':event.item.role,'text':event.item.text_content})
 @session.on('error')
 def error(event):
  if not event.error.recoverable:enqueue(status='failed')
 async def handoff():
  nonlocal handed_off
  handed_off=True;session.interrupt();await session.aclose();await emit(status='handoff')
 @ctx.room.on('participant_connected')
 def participant_connected(participant):
  nonlocal answered
  if participant.identity.startswith('operator_'):
   if any(p.identity.startswith('phone_') for p in ctx.room.remote_participants.values()):
    task=asyncio.create_task(handoff());pending.add(task);task.add_done_callback(pending.discard)
   else:answered=True;enqueue(status='active')
 @ctx.room.on('participant_attributes_changed')
 def attributes(changed,participant):
  nonlocal answered
  if participant.identity.startswith('phone_') and participant.attributes.get('sip.callStatus')=='active':answered=True;enqueue(status='active')
 @ctx.room.on('participant_disconnected')
 def disconnected(participant):
  if participant.identity.startswith('phone_'):enqueue(status='completed' if answered else 'missed')
 async def shutdown():
  if not handed_off:await emit(status='completed' if answered else 'missed')
  if pending:await asyncio.gather(*list(pending),return_exceptions=True)
 ctx.add_shutdown_callback(shutdown)
 await ctx.connect()
 await session.start(room=ctx.room,agent=Assistant(config,metadata),room_options=room_io.RoomOptions(close_on_disconnect=True,delete_room_on_close=False))
 participant=await ctx.wait_for_participant()
 if participant.identity.startswith('operator_'):answered=True;await emit(status='active')
 elif participant.attributes.get('sip.callStatus')=='active':answered=True;await emit(status='active')
 # Generate speech only after a client/operator is present in the room.
 await session.generate_reply(instructions='Cumprimente em português com esta saudação: '+config.get('greeting','Olá! Sou o assistente virtual. Como posso ajudar?'))

if __name__=='__main__':agents.cli.run_app(server)
