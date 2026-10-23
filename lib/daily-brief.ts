import {contractDecisionDate} from './squad-views.ts';
import type {Entity} from './types.ts';
export type BriefItem={id:string;kind:'task'|'deal'|'contract'|'transaction';tone:'red'|'orange';title:string;detail:string;page:string;focus?:string};
const days=(from:string,to:string)=>Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000);
const br=(d:string)=>d.split('-').reverse().join('/');
/** O que precisa de atenção hoje: só registros existentes, sem inferir pagamentos, vendas ou prazos que não foram informados. */
export function dailyBrief(rows:Entity[],today:string,{staleDays=14,horizon=15}:{staleDays?:number;horizon?:number}={}):BriefItem[]{
 const active=rows.filter(e=>!e.deleted);const items:BriefItem[]=[];
 for(const t of active.filter(e=>e.type==='task'&&!e.data.done&&e.data.dueDate&&e.data.dueDate<=today)){
  const late=days(t.data.dueDate,today);items.push({id:t.id,kind:'task',tone:late>0?'red':'orange',title:String(t.data.title||'Tarefa'),detail:late>0?`Atrasada há ${late} dia${late>1?'s':''}`:`Hoje${t.data.dueTime?' às '+t.data.dueTime:''}`,page:'tasks',focus:t.id});
 }
 for(const d of active.filter(e=>e.type==='deal'&&(e.data.status||'open')==='open')){
  if(d.data.expectedDate&&d.data.expectedDate<today)items.push({id:d.id,kind:'deal',tone:'red',title:String(d.data.name||'Negócio'),detail:`Previsão de fechamento passou em ${br(d.data.expectedDate)}`,page:'pipelines',focus:d.id});
  else if(d.updatedAt&&days(d.updatedAt.slice(0,10),today)>=staleDays)items.push({id:d.id,kind:'deal',tone:'orange',title:String(d.data.name||'Negócio'),detail:`Sem atualização há ${days(d.updatedAt.slice(0,10),today)} dias`,page:'pipelines',focus:d.id});
 }
 for(const c of active.filter(e=>e.type==='contract'&&e.data.status!=='ended')){
  const decision=contractDecisionDate(c.data);const expires=c.data.expires;
  if(expires&&expires<today)items.push({id:c.id,kind:'contract',tone:'red',title:String(c.data.name||'Contrato'),detail:`Venceu em ${br(expires)}`,page:'contracts',focus:c.id});
  else if(decision&&days(today,decision)<=horizon)items.push({id:c.id,kind:'contract',tone:decision<=today?'red':'orange',title:String(c.data.name||'Contrato'),detail:decision<=today?`Prazo de decisão passou em ${br(decision)}`:`Decidir renovação até ${br(decision)}`,page:'contracts',focus:c.id});
  else if(expires&&days(today,expires)<=horizon)items.push({id:c.id,kind:'contract',tone:'orange',title:String(c.data.name||'Contrato'),detail:`Vence em ${br(expires)}`,page:'contracts',focus:c.id});
 }
 for(const t of active.filter(e=>e.type==='transaction'&&e.data.status==='pending'&&e.data.date&&days(today,e.data.date)<=7)){
  items.push({id:t.id,kind:'transaction',tone:t.data.date<today?'red':'orange',title:String(t.data.name||'Lançamento'),detail:`${t.data.direction==='in'?'Entrada':'Saída'} pendente · ${t.data.date<today?'venceu':'vence'} em ${br(t.data.date)}`,page:'finance'});
 }
 return items.sort((a,b)=>(a.tone===b.tone?0:a.tone==='red'?-1:1));
}
