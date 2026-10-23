import {env} from 'cloudflare:workers';
import {evaluateFlow,validateEntity,validateReferences} from '../../../lib/domain';
import {recordMutation} from '../../../lib/record-write';
import type {Entity,EntityType} from '../../../lib/types';
import type {IntakeWrite} from '../../../lib/lead-intake';
const decode=(r:any):Entity=>({id:r.id,type:r.type,data:JSON.parse(r.data),revision:r.revision,updatedAt:r.updated_at,deleted:!!r.deleted});
export async function all(owner:string):Promise<Entity[]> {const r=await env.DB!.prepare('SELECT * FROM crm_records WHERE owner = ? ORDER BY updated_at DESC').bind(owner).all();return r.results.map(decode);}
/** Grava um plano automático de forma atômica: valida cada registro com as mesmas regras da tela e aborta tudo se houver conflito. */
export async function applyWrites(owner:string,rows:Entity[],writes:IntakeWrite[]):Promise<Entity[]>{
  if(!writes.length)return [];const now=new Date().toISOString();const known=[...rows];const saved:Entity[]=[];
  const statements=writes.map(w=>{const existing=known.find(e=>e.id===w.id);const data=validateEntity(w.type,w.data);validateReferences(w.type,data,known,existing);
    const entity:Entity={id:w.id,type:w.type as EntityType,data,revision:(existing?.revision??0)+1,updatedAt:now,deleted:false};known.splice(0,known.length,...known.filter(e=>e.id!==w.id),entity);saved.push(entity);
    const m=recordMutation({owner,...entity},existing?existing.revision:null);return env.DB!.prepare(m.sql).bind(...m.parameters);});
  const results=await env.DB!.batch(statements);if(results.some(r=>r.meta.changes!==1))throw new Error('Conflito de edição. Atualize e tente novamente.');
  return saved;
}
export async function runFlows(owner:string,rows:Entity[],record:Entity,event:string){
  const flows=rows.filter(e=>e.type==='automation'&&!e.deleted&&e.data.active);const statements=[];const now=new Date().toISOString();
  const nextData={...record.data};let modified=false;
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
