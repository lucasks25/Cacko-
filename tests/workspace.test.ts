import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEntity} from '../lib/domain.ts';
import {proposalTotal,financeTotals,buildChatPayload} from '../lib/workspace.ts';
test('proposal totals round in cents and apply a bounded discount',()=>{
 assert.equal(proposalTotal([{quantity:3,price:19.99}],10),53.97);
 assert.throws(()=>proposalTotal([{quantity:-1,price:10}],0),/quantidade/i);
 assert.throws(()=>proposalTotal([{quantity:1,price:10}],101),/desconto/i);
});
test('financial totals count recorded receipts and expenses without fabricating payments',()=>{
 assert.deepEqual(financeTotals([{direction:'in',amount:100,status:'received'},{direction:'out',amount:40,status:'paid'},{direction:'in',amount:1000,status:'pending'}]),{income:100,expense:40,balance:60,pending:1000});
 assert.throws(()=>validateEntity('transaction',{name:'Inválido',amount:-1,direction:'in',status:'received',date:'2026-10-21'}),/valor/i);
});
test('ad drafts cannot claim that an unconnected provider published them',()=>{
 assert.throws(()=>validateEntity('content',{name:'Campanha',status:'published',platform:'Google Ads'}),/publica|provedor/i);
});

test('chat history fits the HTTP budget while retaining the latest message',()=>{
 const history=Array.from({length:35},(_,i)=>({role:i%2?'assistant':'user',content:'"\\\n'.repeat(2000)}));
 const payload=buildChatPayload('waz',history,'Minha pergunta atual',{company:'Minha empresa',description:'x'.repeat(90000),cpf:'private-id'});
 assert.ok(JSON.stringify({op:'chat',...payload}).length<=80000);
 assert.equal(payload.messages.at(-1)?.content,'Minha pergunta atual');
 assert.ok(payload.messages.length<=30);assert.ok(!JSON.stringify(payload.context).includes('private-id'));
});
