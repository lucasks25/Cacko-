import type {Entity,EntityType} from './types.ts';
/** Entrada única de leads: qualquer canal vira lead organizado, negócio no funil, tarefa de resposta e histórico — sem duplicar contatos. */
export type Inbound={channel:string;name:string;phone?:string;email?:string;handle?:string;text?:string;conversationId?:string;receivedAt:string};
export type IntakeWrite={type:EntityType;data:Record<string,any>;id:string;revision?:number};
export type IntakePlan={leadId:string;dealId:string;created:boolean;owner:string;score:number;label:string;stageName:string;writes:IntakeWrite[]};
const CHANNELS:Record<string,string>={whatsapp:'WhatsApp',instagram:'Instagram',facebookpage:'Facebook',facebook:'Facebook',webwidget:'Site',site:'Site',email:'E-mail','e-mail':'E-mail',sms:'SMS',twiliosms:'SMS',telefone:'Telefone',phone:'Telefone',api:'API'};
export const channelLabel=(raw:string)=>CHANNELS[String(raw||'').toLowerCase().replace(/^channel::/,'')]||(raw?String(raw):'Outro');
const norm=(s:unknown)=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
export const phoneKey=(v:unknown)=>String(v||'').replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,'');
const handleKey=(v:unknown)=>String(v||'').trim().replace(/^@/,'').toLowerCase();

export function qualify(text:string,{phone,email}:{phone?:string;email?:string}={}):{score:number;label:'Quente'|'Morno'|'Frio';reasons:string[]}{
 const t=norm(text);const reasons:string[]=[];let score=0;
 if(/\b(preco|valor|quanto custa|quanto fica|orcamento|proposta|comprar|contratar|fechar|assinar|planos?)\b/.test(t)){score+=40;reasons.push('Pediu preço ou demonstrou intenção de compra');}
 if(/\b(urgente|hoje|agora|amanha|essa semana|esta semana|o quanto antes|rapido)\b/.test(t)){score+=20;reasons.push('Indicou urgência');}
 if(/\b(empresa|cnpj|equipe|funcionarios|loja|clinica|escritorio|filiais?)\b/.test(t)){score+=15;reasons.push('Perfil de empresa');}
 if(phoneKey(phone).length>=10){score+=10;reasons.push('Telefone informado');}
 if(email){score+=10;reasons.push('E-mail informado');}
 if(t.trim().length>40)score+=5;
 score=Math.min(100,score);return {score,label:score>=60?'Quente':score>=30?'Morno':'Frio',reasons};
}
export function findLead(rows:Entity[],msg:Inbound):Entity|undefined{
 const leads=rows.filter(e=>e.type==='lead'&&!e.deleted);const phone=phoneKey(msg.phone),email=String(msg.email||'').trim().toLowerCase(),handle=handleKey(msg.handle);
 return leads.find(l=>msg.conversationId&&l.data.chatwootContactConversationId===msg.conversationId)
  ||(phone.length>=8?leads.find(l=>phoneKey(l.data.phone)===phone):undefined)
  ||(email?leads.find(l=>String(l.data.email||'').toLowerCase()===email):undefined)
  ||(handle?leads.find(l=>handleKey(l.data.instagram)===handle):undefined);
}
/** Rodízio equilibrado: quem tem menos leads abertos recebe o próximo. */
export function pickOwner(rows:Entity[]):string{
 const members=rows.filter(e=>e.type==='member'&&!e.deleted&&e.data.active!==false);if(!members.length)return '';
 const closed=new Set(rows.filter(e=>e.type==='deal'&&!e.deleted&&['won','lost'].includes(e.data.status)).map(e=>e.data.leadId));
 const load=(id:string)=>rows.filter(e=>e.type==='lead'&&!e.deleted&&e.data.owner===id&&!closed.has(e.id)).length;
 return members.map((m,i)=>({id:m.id,i,n:load(m.id)})).sort((a,b)=>a.n-b.n||a.i-b.i)[0].id;
}
export function planIntake(rows:Entity[],msg:Inbound,{newId,today}:{newId:()=>string;today:string}):IntakePlan{
 const name=String(msg.name||'').trim().slice(0,150)||(msg.handle?'@'+handleKey(msg.handle):msg.phone||'Novo contato');
 const source=channelLabel(msg.channel);const text=String(msg.text||'').slice(0,2000);const existing=findLead(rows,msg);
 const q=qualify(text,{phone:msg.phone||existing?.data.phone,email:msg.email||existing?.data.email});
 const writes:IntakeWrite[]=[];const leadId=existing?.id||newId();const owner=existing?.data.owner||pickOwner(rows);
 const tags=Array.from(new Set([...(existing?.data.tags||[]),source,...(q.label==='Quente'?['Quente']:[])]));
 const score=Math.max(q.score,Number(existing?.data.score)||0);
 const contact={...(msg.phone&&!existing?.data.phone?{phone:String(msg.phone).slice(0,40)}:{}),...(msg.email&&!existing?.data.email?{email:String(msg.email).trim().toLowerCase()}:{}),...(msg.handle&&!existing?.data.instagram?{instagram:'@'+handleKey(msg.handle)}:{}),...(msg.conversationId?{chatwootContactConversationId:msg.conversationId}:{})};
 if(existing)writes.push({type:'lead',id:existing.id,revision:existing.revision,data:{...existing.data,...contact,tags,score,lastContactAt:msg.receivedAt}});
 else writes.push({type:'lead',id:leadId,revision:0,data:{name,company:'',source,owner,tags,score,scoreReasons:q.reasons,notes:'',createdAt:today,lastContactAt:msg.receivedAt,...contact}});
 const pipelines=rows.filter(e=>e.type==='pipeline'&&!e.deleted&&e.data.stages?.length);const pipeline=pipelines.find(p=>norm(p.data.name).includes('comercial'))||pipelines[0];
 let deal=rows.find(e=>e.type==='deal'&&!e.deleted&&e.data.leadId===leadId&&(e.data.status||'open')==='open');let dealId=deal?.id||'';
 let stageName=deal&&pipeline?pipeline.data.stages.find((s:any)=>s.id===deal!.data.stageId)?.name||'':'';
 if(!deal&&pipeline){
  const stage=pipeline.data.stages[q.label==='Quente'&&pipeline.data.stages.length>1?1:0];dealId=newId();stageName=stage.name;
  writes.push({type:'deal',id:dealId,revision:0,data:{name:existing?.data.name||name,leadId,pipelineId:pipeline.id,stageId:stage.id,value:0,owner,status:'open',source,createdAt:today,tags:[source]}});
 }
 const pendingReply=rows.some(e=>e.type==='task'&&!e.deleted&&!e.data.done&&e.data.leadId===leadId&&e.data.autoReply===true);
 if(!pendingReply)writes.push({type:'task',id:newId(),revision:0,data:{title:`Responder ${existing?.data.name||name} (${source})`,type:'task',dueDate:today,dueTime:'',owner,done:false,leadId,...(dealId?{dealId}:{}),autoReply:true,description:text.slice(0,500)}});
 writes.push({type:'activity',id:newId(),revision:0,data:{text:`Mensagem recebida via ${source}${existing?'':' · lead criado automaticamente'}`,message:text,leadId,...(dealId?{dealId}:{}),score:q.score,log:q.reasons,createdAt:msg.receivedAt}});
 return {leadId,dealId,created:!existing,owner,score,label:score>=60?'Quente':score>=30?'Morno':'Frio',stageName,writes};
}
