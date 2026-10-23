import test from 'node:test';
import assert from 'node:assert/strict';
import {planIntake,qualify,channelLabel,pickOwner,findLead} from '../lib/lead-intake.ts';
import {validateReferences} from '../lib/references.ts';
import {validateEntity} from '../lib/domain.ts';
const entity=(id:string,type:any,data:any,deleted=false)=>({id,type,data,revision:1,updatedAt:'',deleted});
const base=()=>[entity('m1','member',{name:'Lucas'}),entity('m2','member',{name:'Marina'}),entity('pipe','pipeline',{name:'Pipeline comercial',stages:[{id:'s0',name:'Novos leads'},{id:'s1',name:'Em qualificação'}]}),entity('l0','lead',{name:'Antigo',owner:'m1',phone:'(11) 98888-0000'})];
const ids=()=>{let n=0;return ()=>'new'+(++n);};
const opts={today:'2026-10-23'};
test('channels and qualification are normalized',()=>{
 assert.equal(channelLabel('Channel::Whatsapp'),'WhatsApp');assert.equal(channelLabel('WebWidget'),'Site');assert.equal(channelLabel('Instagram'),'Instagram');
 assert.equal(qualify('Quanto custa o plano? Preciso urgente para minha empresa',{phone:'11999990000'}).label,'Quente');
 assert.equal(qualify('oi').label,'Frio');
});
test('a new WhatsApp contact becomes an organized lead, deal, reply task and history entry',()=>{
 const rows=base();const plan=planIntake(rows,{channel:'Whatsapp',name:'Carla Dias',phone:'+55 11 97777-1234',text:'Quanto custa o plano para minha empresa? Preciso urgente',conversationId:'c9',receivedAt:'2026-10-23T12:00:00Z'},{...opts,newId:ids()});
 assert.equal(plan.created,true);assert.equal(plan.owner,'m2');assert.equal(plan.label,'Quente');assert.equal(plan.stageName,'Em qualificação');
 assert.deepEqual(plan.writes.map(w=>w.type),['lead','deal','task','activity']);
 const lead=plan.writes[0].data;assert.equal(lead.source,'WhatsApp');assert.deepEqual(lead.tags,['WhatsApp','Quente']);assert.equal(lead.chatwootContactConversationId,'c9');
 const all:any[]=[...rows];for(const w of plan.writes){const clean=validateEntity(w.type,w.data);validateReferences(w.type,clean,all);all.push(entity(w.id,w.type,clean));}
});
test('a returning contact is matched by phone, Instagram handle or conversation without duplicates',()=>{
 const rows=base();const msg={channel:'Whatsapp',name:'Outro nome',phone:'11988880000',text:'oi de novo',receivedAt:'2026-10-23T12:00:00Z'};
 const plan=planIntake(rows,msg,{...opts,newId:ids()});assert.equal(plan.created,false);assert.equal(plan.leadId,'l0');assert.equal(plan.owner,'m1');
 assert.equal(plan.writes.filter(w=>w.type==='lead').length,1);assert.equal(plan.writes[0].revision,1);
 const withDeal:any[]=[...rows,entity('d0','deal',{leadId:'l0',status:'open',pipelineId:'pipe',stageId:'s0'}),entity('t0','task',{leadId:'l0',done:false,autoReply:true})];
 assert.deepEqual(planIntake(withDeal,msg,{...opts,newId:ids()}).writes.map(w=>w.type),['lead','activity']);
 const insta=[...rows,entity('l1','lead',{name:'Bia',instagram:'@bia.loja'})];assert.equal(findLead(insta as any,{channel:'Instagram',name:'',handle:'Bia.Loja',receivedAt:''})?.id,'l1');
});
test('round robin skips archived members and leads with closed deals',()=>{
 const rows:any[]=[...base(),entity('m3','member',{name:'Arquivado'},true),entity('l2','lead',{owner:'m2'}),entity('l3','lead',{owner:'m2'}),entity('d','deal',{leadId:'l2',status:'won'}),entity('l4','lead',{owner:'m1'})];
 assert.equal(pickOwner(rows),'m2');
});
