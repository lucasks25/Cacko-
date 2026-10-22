import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {prepareWrite,evaluateFlow,validateReferences,resolveOwner} from '../../../lib/domain';
import type {Entity,EntityType} from '../../../lib/types';
export const dynamic='force-dynamic';
const reply=(value:any,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const decode=(r:any):Entity=>({id:r.id,type:r.type,data:JSON.parse(r.data),revision:r.revision,updatedAt:r.updated_at,deleted:!!r.deleted});
async function all(owner:string):Promise<Entity[]> {const r=await env.DB!.prepare('SELECT * FROM crm_records WHERE owner = ? ORDER BY updated_at DESC').bind(owner).all();return r.results.map(decode);}
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
    let mutation;
    if(existing)mutation=await env.DB!.prepare('UPDATE crm_records SET data=?,revision=?,updated_at=?,deleted=? WHERE owner=? AND id=? AND revision=?').bind(JSON.stringify(result.data),result.revision,updatedAt,deleted?1:0,user.userId,id,existing.revision).run();
    else mutation=await env.DB!.prepare('INSERT OR IGNORE INTO crm_records(owner,id,type,data,revision,updated_at,deleted) VALUES(?,?,?,?,?,?,?)').bind(user.userId,id,input.type,JSON.stringify(result.data),result.revision,updatedAt,0).run();
    if(mutation.meta.changes!==1)return reply({error:'Conflito de edição. Atualize e tente novamente.'},409);
    const entity:Entity={id,type:input.type,data:result.data,revision:result.revision,updatedAt,deleted};
    let flowWarning:string|undefined;
    if(action==='save'&&['lead','deal'].includes(input.type)){
      try{await runFlows(user.userId,rows,entity,`${input.type}.${existing?'updated':'created'}`);}catch{flowWarning='Registro salvo; uma automação não concluiu. Consulte o histórico.';}
    }
    return reply({entity,entities:await all(user.userId),warning:flowWarning});
  }catch(error){const message=error instanceof Error?error.message:'Dados inválidos.';if(message.includes('Conflito'))return reply({error:message},409);if(error instanceof SyntaxError)return reply({error:'JSON inválido.'},400);if(/SQL|D1|database/i.test(message))return reply({error:'Falha ao salvar. Seus dados anteriores foram preservados.'},503);return reply({error:message},400);}
}
async function runFlows(owner:string,rows:Entity[],record:Entity,event:string){
  const flows=rows.filter(e=>e.type==='automation'&&!e.deleted&&e.data.active);const statements=[];const now=new Date().toISOString();
  let nextData={...record.data};let modified=false;
  const insert=(type:string,data:any)=>env.DB!.prepare('INSERT INTO crm_records(owner,id,type,data,revision,updated_at,deleted) VALUES(?,?,?,?,1,?,0)').bind(owner,crypto.randomUUID(),type,JSON.stringify(data),now);
  for(const flow of flows){const result=evaluateFlow(flow.data,event,record.data);if(flow.data.trigger!==event)continue;
    for(const a of result.actions){if(a.type==='task')statements.push(insert('task',{title:a.title||'Acompanhar '+record.data.name,type:'task',dueDate:new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),owner:record.data.owner||'',done:false,...(record.type==='lead'?{leadId:record.id}:{dealId:record.id,leadId:record.data.leadId||''})}));
      if(a.type==='stage'&&record.type==='deal'){const p=rows.find(e=>e.type==='pipeline'&&!e.deleted&&e.data.stages?.some((s:any)=>s.id===a.stageId));if(p){nextData.pipelineId=p.id;nextData.stageId=a.stageId;modified=true;}}
      if(a.type==='tag'&&a.tag&&record.type==='lead'){nextData.tags=Array.from(new Set([...(nextData.tags||[]),a.tag]));modified=true;}}
    statements.push(insert('activity',{text:'Automação '+flow.data.name,automationId:flow.id,event,log:result.log,createdAt:now,...(record.type==='lead'?{leadId:record.id}:{dealId:record.id})}));
  }
  if(modified)statements.push(env.DB!.prepare('UPDATE crm_records SET data=?, revision=revision+1,updated_at=? WHERE owner=? AND id=? AND revision=?').bind(JSON.stringify(nextData),now,owner,record.id,record.revision));
  if(statements.length){const results=await env.DB!.batch(statements);if(modified&&results.at(-1)?.meta.changes!==1){await env.DB!.batch(flows.filter(f=>f.data.trigger===event).map(f=>insert('activity',{automationId:f.id,event,text:'Conflito na automação '+f.data.name,log:['A mudança de etapa/etiqueta não foi aplicada: o registro foi editado simultaneamente.'],createdAt:now,failed:true,...(record.type==='lead'?{leadId:record.id}:{dealId:record.id})})));throw new Error('Conflito na automação.');}}
}
