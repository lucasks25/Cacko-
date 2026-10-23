import {env} from 'cloudflare:workers';
import {all,applyWrites,runFlows} from '../server-store';
import {planIntake,type Inbound} from '../../../../lib/lead-intake';
import {today} from '../../../../lib/types';
export const dynamic='force-dynamic';
// Entrada de leads sem sessão: serviço de atendimento (segredo de servidor) ou formulário do site (chave pública do formulário).
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
const reply=(value:any,status=200,headers:Record<string,string>={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});
const str=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
function sameSecret(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export function OPTIONS(){return new Response(null,{status:204,headers:cors});}
export async function POST(request:Request){
  const raw=await request.text();if(raw.length>20000)return reply({error:'Mensagem muito grande.'},413,cors);
  let input:any;try{input=JSON.parse(raw);}catch{return reply({error:'JSON inválido.'},400,cors);}
  const secret=env.CRM_INTAKE_SECRET||'';const bearer=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  let owner='',msg:Inbound,headers:Record<string,string>={},messageId='';
  if(bearer){
    if(secret.length<32||!sameSecret(bearer,secret))return reply({error:'Não autorizado.'},401);
    owner=str(input.owner,200);const m=input.message||{};messageId=str(m.messageId,100);
    msg={channel:str(m.channel,40),name:str(m.name,150),phone:str(m.phone,40),email:str(m.email,200),handle:str(m.handle,100),text:str(m.text,2000),conversationId:str(m.conversationId,100),receivedAt:new Date().toISOString()};
  }else{
    headers=cors;if(str(input.website,200))return reply({accepted:true},200,cors);
    const formKey=str(input.formKey,100);if(formKey.length<24)return reply({error:'Formulário não configurado.'},401,cors);
    const row:any=await env.DB!.prepare("SELECT owner FROM crm_records WHERE type='setting' AND deleted=0 AND json_extract(data,'$.key')='siteForm' AND json_extract(data,'$.formKey')=? LIMIT 1").bind(formKey).first();
    if(!row)return reply({error:'Formulário não configurado.'},401,cors);owner=row.owner;
    msg={channel:'Site',name:str(input.name,150),phone:str(input.phone,40),email:str(input.email,200).toLowerCase(),text:str(input.message,2000),receivedAt:new Date().toISOString()};
    if(!msg.name||(!msg.email&&!msg.phone))return reply({error:'Informe nome e e-mail ou telefone.'},400,cors);
  }
  if(!owner)return reply({error:'Conta não informada.'},400,headers);
  try{
    const rows=await all(owner);
    if(messageId&&rows.some(e=>e.type==='activity'&&e.data.sourceMessageId===messageId))return reply({accepted:true,duplicate:true},200,headers);
    const plan=planIntake(rows,msg,{newId:()=>crypto.randomUUID(),today:today()});
    const activity=plan.writes.at(-1);if(activity&&messageId)activity.data.sourceMessageId=messageId;
    const saved=await applyWrites(owner,rows,plan.writes);
    const lead=saved.find(e=>e.type==='lead');
    if(lead){try{await runFlows(owner,await all(owner),lead,plan.created?'lead.created':'lead.updated');}catch{}}
    return reply({accepted:true,created:plan.created,leadId:plan.leadId},200,headers);
  }catch(error){const message=error instanceof Error?error.message:'';return reply({error:/Conflito/.test(message)?message:'Não foi possível registrar o contato.'},/Conflito/.test(message)?409:503,headers);}
}
