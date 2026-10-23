import test from 'node:test';
import assert from 'node:assert/strict';
import {planWonDeal,planFollowUps} from '../lib/pipeline-automation.ts';
import {validateReferences} from '../lib/references.ts';
import {validateEntity} from '../lib/domain.ts';
const entity=(id:string,type:any,data:any,updatedAt='2026-10-20T10:00:00Z')=>({id,type,data,revision:1,updatedAt,deleted:false});
const ids=()=>{let n=0;return ()=>'n'+(++n);};
const opts={today:'2026-10-23'};
test('a won deal creates one pending receipt and one contract draft, linked and valid',()=>{
 const lead=entity('l1','lead',{name:'Carla',company:'Acme'});const open=entity('d1','deal',{name:'Acme',leadId:'l1',value:5000,status:'open'});const won={...open,data:{...open.data,status:'won'}};
 const rows:any[]=[lead,won];const writes=planWonDeal(rows,won,open,{...opts,newId:ids()});
 assert.deepEqual(writes.map(w=>w.type),['transaction','contract','activity']);
 assert.equal(writes[0].data.amount,5000);assert.equal(writes[0].data.status,'pending');assert.equal(writes[1].data.counterparty,'Acme');
 for(const w of writes){const clean=validateEntity(w.type,w.data);validateReferences(w.type,clean,rows);rows.push(entity(w.id,w.type,clean));}
 assert.deepEqual(planWonDeal(rows,won,open,{...opts,newId:ids()}),[]);
 assert.deepEqual(planWonDeal(rows,won,won,{...opts,newId:ids()}),[]);
 assert.deepEqual(planWonDeal([lead],{...won,data:{...won.data,value:0}},open,{...opts,newId:ids()}).map(w=>w.type),['contract','activity']);
});
test('follow-ups are created only for silent open deals without a pending task',()=>{
 const now='2026-10-23T12:00:00Z';
 const rows:any[]=[entity('d1','deal',{name:'Parado',status:'open',owner:'m1'},'2026-10-18T10:00:00Z'),entity('d2','deal',{name:'Recente',status:'open'},'2026-10-23T08:00:00Z'),entity('d3','deal',{name:'Com tarefa',status:'open'},'2026-10-01T10:00:00Z'),entity('t3','task',{dealId:'d3',done:false}),entity('d4','deal',{name:'Ganho',status:'won'},'2026-10-01T10:00:00Z'),
  entity('d5','deal',{name:'Lead falou',status:'open',leadId:'l5'},'2026-10-01T10:00:00Z'),entity('l5','lead',{name:'X',lastContactAt:'2026-10-23T09:00:00Z'},'2026-10-01T10:00:00Z')];
 const writes=planFollowUps(rows,now,{...opts,newId:ids()});
 assert.deepEqual(writes.map(w=>w.data.dealId),['d1']);assert.equal(writes[0].data.title,'Follow-up: Parado (sem contato há 5 dias)');assert.equal(writes[0].data.owner,'m1');
});
