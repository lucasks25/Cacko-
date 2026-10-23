import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {prepareWrite,validateReferences,resolveOwner} from '../../../lib/domain';
import type {Entity,EntityType} from '../../../lib/types';
import {recordMutation} from '../../../lib/record-write';
import {all,runFlows,applyWrites} from './server-store';
import {planWonDeal} from '../../../lib/pipeline-automation';
import {today} from '../../../lib/types';
export const dynamic='force-dynamic';
const reply=(value:any,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){const user=await getChatGPTUser();if(!user)return reply({error:'Entre na sua conta para acessar os dados.'},401);try{return reply({entities:await all(user.userId)});}catch{return reply({error:'Não foi possível carregar seus dados. Tente novamente.'},503);}}
export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return reply({error:'Entre na sua conta para salvar.'},401);
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin&&new URL(origin).host!==request.headers.get('host'))return reply({error:'Origem da solicitação não autorizada.'},403);
  try{
    const raw=await request.text();if(raw.length>150000)return reply({error:'Registro excede o limite de tamanho.'},413);
    const input=JSON.parse(raw);const id=input.id||crypto.randomUUID();if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return reply({error:'Identificador inválido.'},400);
    const rows=await all(user.userId);const existing=rows.find(e=>e.id===id);const result=prepareWrite(input,existing);const action=input.action||'save';
    if(!['save','archive','restore'].includes(action))return reply({error:'Ação inválida.'},400);
    if(action!=='save'&&!existing)return reply({error:'Registro não encontrado.'},404);
    if(action==='save'){if(result.data.owner)result.data.owner=resolveOwner(result.data.owner,rows);validateReferences(input.type,result.data,rows,existing);}
    const updatedAt=new Date().toISOString();const deleted=action==='archive'?true:action==='restore'?false:existing?.deleted??false;
    const write=recordMutation({owner:user.userId,id,type:input.type,data:result.data,revision:result.revision,updatedAt,deleted},existing?.revision??null);
    const mutation=await env.DB!.prepare(write.sql).bind(...write.parameters).run();
    if(mutation.meta.changes!==1)return reply({error:'Conflito de edição. Atualize e tente novamente.'},409);
    const entity:Entity={id,type:input.type,data:result.data,revision:result.revision,updatedAt,deleted};
    let flowWarning:string|undefined;
    if(action==='save'&&['lead','deal'].includes(input.type)){
      try{await runFlows(user.userId,rows,entity,`${input.type}.${existing?'updated':'created'}`);}catch{flowWarning='Registro salvo; uma automação não concluiu. Consulte o histórico.';}
    }
    if(action==='save'&&input.type==='deal'){
      try{await applyWrites(user.userId,await all(user.userId),planWonDeal(rows,entity,existing,{newId:()=>crypto.randomUUID(),today:today()}));}catch{flowWarning='Negócio salvo; o lançamento ou o contrato automático não foi criado. Crie manualmente se necessário.';}
    }
    return reply({entity,entities:await all(user.userId),warning:flowWarning});
  }catch(error){const message=error instanceof Error?error.message:'Dados inválidos.';if(message.includes('Conflito'))return reply({error:message},409);if(error instanceof SyntaxError)return reply({error:'JSON inválido.'},400);if(/SQL|D1|database/i.test(message))return reply({error:'Falha ao salvar. Seus dados anteriores foram preservados.'},503);return reply({error:message},400);}
}
