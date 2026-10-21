import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEntity, parseCSV, exportCSV, getMetrics, evaluateFlow, prepareWrite } from '../lib/domain.ts';
import type {Entity} from '../lib/types.ts';
const entity = (type:Entity['type'],data:any,id='e1'):Entity=>({id,type,data,revision:1,updatedAt:'2026-10-21T12:00:00Z',deleted:false});
test('rejects empty lead and invalid deal values',()=>{
  assert.throws(()=>validateEntity('lead',{name:' '}),/nome/i);
  assert.throws(()=>validateEntity('deal',{name:'Venda',value:-2,pipelineId:'p',stageId:'s'}),/valor/i);
  assert.throws(()=>validateEntity('deal',{name:'Venda',value:Infinity,pipelineId:'p',stageId:'s'}),/valor/i);
});
test('normalizes lead fields and rejects unknown record types',()=>{
  assert.equal(validateEntity('lead',{name:' Ana ',email:'ANA@EXAMPLE.COM'}).email,'ana@example.com');
  assert.throws(()=>validateEntity('admin',{name:'X'}),/tipo/i);
  assert.throws(()=>validateEntity('connection',{name:'WhatsApp',status:'connected'}),/conexão/i);
});
test('CSV preserves quoted commas, newlines and prevents spreadsheet formula injection',()=>{
  const csv='nome,email,empresa\r\n"Ana, Silva",ana@example.com,"Linha 1\nLinha 2"';
  const rows=parseCSV(csv); assert.equal(rows[0].nome,'Ana, Silva'); assert.equal(rows[0].empresa,'Linha 1\nLinha 2');
  const out=exportCSV([{nome:'=HYPERLINK(1)',empresa:'A,B'}],['nome','empresa']);
  assert.ok(out.includes("'=HYPERLINK(1)")); assert.equal(parseCSV(out)[0].empresa,'A,B');
});
test('metrics exclude archived records and compute real conversion',()=>{
  const archived={...entity('deal',{value:999,status:'won'},'gone'),deleted:true};
  const result=getMetrics([entity('lead',{name:'A'}),entity('deal',{value:100,status:'won'},'d1'),entity('deal',{value:300,status:'open'},'d2'),entity('deal',{value:50,status:'lost'},'d3'),archived]);
  assert.equal(result.revenue,100);assert.equal(result.openValue,300);assert.equal(result.conversion,50);assert.equal(result.deals,3);
});
test('flow conditions gate actions and never claim external delivery',()=>{
  const flow={trigger:'deal.created',condition:{field:'value',operator:'gte',value:1000},actions:[{type:'task',title:'Ligar'},{type:'message',text:'Olá'}]};
  assert.equal(evaluateFlow(flow,'deal.created',{value:20}).actions.length,0);
  const r=evaluateFlow(flow,'deal.created',{value:2000});assert.equal(r.actions.length,1);assert.ok(r.log.some((s:string)=>s.includes('conexão')));
});
test('revision conflicts do not silently overwrite data',()=>{
  const e=entity('lead',{name:'Ana'});assert.throws(()=>prepareWrite({type:'lead',data:{name:'Bia'},revision:0},e),/conflito/i);
  const out=prepareWrite({type:'lead',data:{name:'Bia'},revision:1},e);assert.equal(out.revision,2);assert.equal(out.data.name,'Bia');
});
