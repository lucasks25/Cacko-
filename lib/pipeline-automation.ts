import type {Entity} from './types.ts';
import type {IntakeWrite} from './lead-intake.ts';
type Opts={newId:()=>string;today:string};
const leadOf=(rows:Entity[],deal:Entity)=>rows.find(e=>e.type==='lead'&&e.id===deal.data.leadId);
/** Negócio ganho → entrada pendente no financeiro e rascunho de contrato. Não movimenta dinheiro nem assina nada; só prepara para revisão. */
export function planWonDeal(rows:Entity[],deal:Entity,previous:Entity|undefined,{newId,today}:Opts):IntakeWrite[]{
 if(deal.type!=='deal'||deal.deleted||deal.data.status!=='won'||previous?.data.status==='won')return [];
 const active=rows.filter(e=>!e.deleted);const value=Number(deal.data.value)||0;const lead=leadOf(active,deal);const writes:IntakeWrite[]=[];
 const link={dealId:deal.id,...(lead?{leadId:lead.id}:{})};
 if(value>0&&!active.some(e=>e.type==='transaction'&&e.data.dealId===deal.id))writes.push({type:'transaction',id:newId(),revision:0,data:{name:`Venda — ${deal.data.name}`.slice(0,150),direction:'in',amount:value,date:today,category:'Vendas',status:'pending',...link}});
 if(!active.some(e=>e.type==='contract'&&e.data.dealId===deal.id))writes.push({type:'contract',id:newId(),revision:0,data:{name:`Contrato — ${deal.data.name}`.slice(0,150),counterparty:String(lead?.data.company||lead?.data.name||deal.data.name||'').slice(0,250),value,expires:'',folder:'Comercial',status:'pending',text:'Rascunho criado automaticamente quando o negócio foi ganho. Complete as cláusulas e revise antes de enviar ou assinar.',...link}});
 if(writes.length)writes.push({type:'activity',id:newId(),revision:0,data:{text:'Negócio ganho · '+[writes.some(w=>w.type==='transaction')&&'entrada pendente no financeiro',writes.some(w=>w.type==='contract')&&'rascunho de contrato'].filter(Boolean).join(' e ')+' criados automaticamente',...link,createdAt:new Date().toISOString()}});
 return writes;
}
/** Negócio aberto sem contato há mais de `hours` horas → tarefa de follow-up para o responsável (uma por vez). */
export function planFollowUps(rows:Entity[],nowIso:string,{newId,today,hours=48}:Opts&{hours?:number}):IntakeWrite[]{
 const active=rows.filter(e=>!e.deleted);const limit=Date.parse(nowIso)-hours*3600000;const writes:IntakeWrite[]=[];
 for(const deal of active.filter(e=>e.type==='deal'&&(e.data.status||'open')==='open')){
  if(writes.length>=50)break;
  const ids=new Set([deal.id,deal.data.leadId].filter(Boolean));
  if(active.some(e=>e.type==='task'&&!e.data.done&&(ids.has(e.data.dealId)||ids.has(e.data.leadId))))continue;
  const lead=leadOf(active,deal);
  const touches=[deal.updatedAt,deal.data.createdAt,lead?.data.lastContactAt,lead?.updatedAt,...active.filter(e=>(e.type==='activity'||e.type==='task')&&(ids.has(e.data.dealId)||ids.has(e.data.leadId))).map(e=>e.data.createdAt||e.updatedAt)].map(v=>Date.parse(String(v||''))).filter(Number.isFinite);
  const last=touches.length?Math.max(...touches):NaN;if(!Number.isFinite(last)||last>limit)continue;
  const days=Math.floor((Date.parse(nowIso)-last)/86400000);
  writes.push({type:'task',id:newId(),revision:0,data:{title:`Follow-up: ${deal.data.name} (sem contato há ${days} dia${days===1?'':'s'})`.slice(0,150),type:'task',dueDate:today,dueTime:'',owner:deal.data.owner||'',done:false,dealId:deal.id,...(lead?{leadId:lead.id}:{}),followUp:true,description:'Criada automaticamente: nenhum contato registrado no período definido.'}});
 }
 return writes;
}
