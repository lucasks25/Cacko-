import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {validateCallCommand} from '../../../lib/contact-center';
import {messagingQuery,validateNewContact,validateNewConversation} from '../../../lib/messaging';
export const dynamic='force-dynamic';
const reply=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const validId=(value:any)=>typeof value==='string'&&/^\d{1,15}$/.test(value);
async function relay(path:string,userId:string,method='GET',body?:any){
 const cfg=env as unknown as Record<string,string>;const base=cfg.CONTACT_CENTER_URL;const credential=cfg.CONTACT_CENTER_TOKEN;
 if(!base||!credential)return reply({error:'A central ainda não foi conectada. Configure o serviço Chatwoot e LiveKit no servidor.',configured:false},503);
 const url=new URL(base);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('Endereço do serviço inválido.');
 const response=await fetch(new URL('/v1'+path,url),{method,headers:{Authorization:'Bearer '+credential,'X-CRM-Tenant':userId,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});
 const data=await response.json().catch(()=>({error:'O serviço não retornou uma resposta válida.'}));
 return reply(data,response.status);
}
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return reply({error:'Entre na sua conta.'},401);
 const params=new URL(request.url).searchParams;const op=params.get('op')||'status';
 try{
  if(op==='status')return await relay('/status',user.userId);
  if(op==='calls')return await relay('/calls',user.userId);
  if(op==='agent')return await relay('/agent',user.userId);
  if(['conversations','contacts','inboxes'].includes(op)||op.startsWith('messages:')||op.startsWith('conversation:')){
   let path;try{path=messagingQuery(op,Object.fromEntries(params));}catch(e){return reply({error:e instanceof Error?e.message:'Parâmetros inválidos.'},400);}
   return await relay(path,user.userId);
  }
  return reply({error:'Operação inválida.'},400);
 }catch{return reply({error:'O serviço de atendimento está indisponível. Tente novamente.'},502);}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return reply({error:'Entre na sua conta.'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return reply({error:'Origem não autorizada.'},403);
 try{
  const raw=await request.text();if(raw.length>90000)return reply({error:'Solicitação muito grande.'},413);
  const input=JSON.parse(raw);
  if(input.op==='create-contact')return await relay('/contacts',user.userId,'POST',validateNewContact(input));
  if(input.op==='create-conversation')return await relay('/conversations',user.userId,'POST',validateNewConversation(input));
  if(input.op==='call'){
   const command=validateCallCommand(input);
   if(command.action==='start'||command.action==='test')return await relay('/calls',user.userId,'POST',command);
   return await relay('/calls/'+command.callId+'/'+command.action,user.userId,'POST',command);
  }
  if(input.op==='message'&&validId(input.conversationId))return await relay('/conversations/'+input.conversationId+'/messages',user.userId,'POST',{text:String(input.text||'').slice(0,10000),private:input.private===true});
  if(input.op==='conversation-status'&&validId(input.conversationId)&&['open','pending','resolved'].includes(input.status))return await relay('/conversations/'+input.conversationId+'/status',user.userId,'POST',{status:input.status});
  if(input.op==='assist'&&validId(input.conversationId)&&['reply','summary'].includes(input.task))return await relay('/assist',user.userId,'POST',{conversationId:input.conversationId,task:input.task});
  if(input.op==='agent-tool')return await relay('/tools',user.userId,'POST',{agent:input.agent,tool:input.tool,prompt:input.prompt,context:input.context});
  if(input.op==='chat'&&['waz','maky','fin','opy','juri','pipo'].includes(input.agent))return await relay('/chat',user.userId,'POST',{agent:input.agent,messages:input.messages,context:input.context});
  if(input.op==='agent')return await relay('/agent',user.userId,'PUT',{name:input.name,instructions:input.instructions,knowledge:input.knowledge,greeting:input.greeting,autoReply:input.autoReply===true,inboxIds:input.inboxIds});
  return reply({error:'Operação inválida.'},400);
 }catch(error){if(error instanceof SyntaxError)return reply({error:'JSON inválido.'},400);return reply({error:error instanceof Error&&/telefone|identificador|chamada|comando/i.test(error.message)?error.message:'Não foi possível concluir a operação. Consulte o serviço.'},400);}
}
