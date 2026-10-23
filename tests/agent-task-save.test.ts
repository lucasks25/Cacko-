import test from 'node:test';
import assert from 'node:assert/strict';
import {saveAgentTaskResult} from '../lib/agent-task-save.ts';
import type {Entity,CRMContextValue} from '../lib/types.ts';
const draft={tool:'content',type:'content',data:{name:'Post revisado',text:'Texto aprovado pelo usuário',kind:'posts'}};
const fixture=(fail?:string)=>{const records:Entity[]=[];const save:CRMContextValue['save']=async(type,data,id)=>{if(type===fail)throw new Error('Falha de rede');const e={id:id||'generated',type,data,revision:1,updatedAt:'',deleted:false};records.push(e);return e;};return {records,save};};
test('saving an agent draft also preserves the reviewed result in its conversation',async()=>{
 const f=fixture();const receipt=await saveAgentTaskResult({agent:'maky',tool:'content',result:draft,draftId:'draft1',entities:[],save:f.save});
 assert.equal(receipt.historySaved,true);assert.deepEqual(f.records.map(r=>r.type),['content','chatTurn']);assert.equal(f.records[0].data.status,'draft');
 assert.equal(f.records[1].data.agent,'maky');assert.equal(f.records[1].data.recordId,'draft1');assert.match(f.records[1].data.text,/Texto aprovado pelo usuário/);assert.equal(f.records[1].id,'draft1_history');
});
test('a failed record write never creates a success message; a failed history write does not invalidate the saved record',async()=>{
 const failed=fixture('content');await assert.rejects(()=>saveAgentTaskResult({agent:'maky',tool:'content',result:draft,draftId:'draft1',entities:[],save:failed.save}));assert.equal(failed.records.length,0);
 const partial=fixture('chatTurn');const receipt=await saveAgentTaskResult({agent:'maky',tool:'content',result:draft,draftId:'draft1',entities:[],save:partial.save});assert.equal(receipt.historySaved,false);assert.equal(partial.records.length,1);assert.equal(receipt.id,'draft1');
});
test('text-only tasks save once in history, and another agent cannot claim the tool',async()=>{
 const f=fixture();await saveAgentTaskResult({agent:'pipo',tool:'wiki-answer',result:{type:'text',tool:'wiki-answer',text:'Resposta revisada'},draftId:'answer1',entities:[],save:f.save});assert.equal(f.records.length,1);assert.equal(f.records[0].type,'chatTurn');
 await assert.rejects(()=>saveAgentTaskResult({agent:'fin',tool:'content',result:draft,draftId:'wrong',entities:[],save:f.save}),/agente|ferramenta/i);assert.equal(f.records.length,1);
});
test('conversation context keeps structured prices and contract fields even when notes or source text exist',async()=>{
 const p=fixture();await saveAgentTaskResult({agent:'waz',tool:'proposal',result:{tool:'proposal',type:'proposal',data:{name:'Oferta',items:[{name:'Serviço',quantity:2,price:250}],discount:10,notes:'Condição combinada'}},draftId:'proposal1',entities:[],save:p.save});
 const proposal=p.records[1].data.text;assert.match(proposal,/250/);assert.match(proposal,/discount.*10/);assert.match(proposal,/Condição combinada/);
 const c=fixture();await saveAgentTaskResult({agent:'juri',tool:'contract',result:{tool:'contract',type:'contract',data:{name:'Contrato',counterparty:'Empresa ABC',value:900,expires:'2027-02-10',penalty:'Multa de 5%',text:'Texto extenso '.repeat(1500)}},draftId:'contract1',entities:[],save:c.save});
 const contract=c.records[1].data.text;for(const term of ['Empresa ABC','900','2027-02-10','Multa de 5%'])assert.ok(contract.includes(term));assert.ok(contract.length<=6000);assert.match(contract,/resumo|limitad/i);
});
