import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyBrief} from '../lib/daily-brief.ts';
const entity=(id:string,type:any,data:any,updatedAt='2026-10-22T10:00:00Z',deleted=false)=>({id,type,data,revision:1,updatedAt,deleted});
test('daily brief lists only what needs attention, most urgent first',()=>{
 const rows=[
  entity('t1','task',{title:'Ligar Acme',dueDate:'2026-10-20',done:false}),entity('t2','task',{title:'Reunião',dueDate:'2026-10-23',dueTime:'14:00',done:false}),entity('t3','task',{title:'Feita',dueDate:'2026-10-01',done:true}),entity('t4','task',{title:'Futura',dueDate:'2026-10-30',done:false}),
  entity('d1','deal',{name:'Beta',status:'open',expectedDate:'2026-10-10'}),entity('d2','deal',{name:'Gama',status:'open'},'2026-09-01T10:00:00Z'),entity('d3','deal',{name:'Ganho',status:'won',expectedDate:'2026-10-01'}),entity('d4','deal',{name:'Ativo',status:'open'}),
  entity('c1','contract',{name:'Contrato A',expires:'2026-11-30',noticeDays:30}),entity('c2','contract',{name:'Contrato B',expires:'2027-06-01'}),entity('c3','contract',{name:'Contrato C',expires:'2026-10-01'}),
  entity('f1','transaction',{name:'Internet',status:'pending',direction:'out',date:'2026-10-25'}),entity('f2','transaction',{name:'Pago',status:'paid',direction:'out',date:'2026-10-25'}),entity('f3','transaction',{name:'Longe',status:'pending',direction:'in',date:'2026-12-25'}),
  entity('x','task',{title:'Arquivada',dueDate:'2026-10-01',done:false},'2026-10-22T10:00:00Z',true)
 ];
 const brief=dailyBrief(rows as any,'2026-10-23');
 assert.deepEqual(brief.map(i=>i.id).sort(),['c1','c3','d1','d2','f1','t1','t2']);
 assert.ok(brief.findIndex(i=>i.tone==='orange')>brief.findLastIndex(i=>i.tone==='red'));
 assert.equal(brief.find(i=>i.id==='t1')!.detail,'Atrasada há 3 dias');assert.equal(brief.find(i=>i.id==='t2')!.detail,'Hoje às 14:00');
 assert.equal(brief.find(i=>i.id==='c1')!.detail,'Decidir renovação até 31/10/2026');assert.equal(brief.find(i=>i.id==='d2')!.detail,'Sem atualização há 52 dias');
});
