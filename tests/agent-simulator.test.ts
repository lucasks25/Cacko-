import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateToolResult,parseMoney,parseDate,parseTimes} from '../lib/agent-simulator.ts';
import {prepareToolRecord,buildToolContext} from '../lib/agent-tools.ts';
const entity=(id:string,type:any,data:any)=>({id,type,data,revision:1,updatedAt:'',deleted:false});
const today='2026-10-23';
test('parsers read Brazilian money, dates and time ranges',()=>{
 assert.equal(parseMoney('saída de R$ 1.250,50 para aluguel'),1250.5);assert.equal(parseMoney('150 reais de internet'),150);assert.equal(parseMoney('sem valor'),null);
 assert.equal(parseDate('vence 25/10/2026',today),'2026-10-25');assert.equal(parseDate('dia 05/11',today),'2026-11-05');assert.equal(parseDate('amanhã',today),'2026-10-24');assert.equal(parseDate('31/02/2026',today),null);
 assert.deepEqual(parseTimes('das 9h às 18h'),{start:'09:00',end:'18:00'});assert.deepEqual(parseTimes('13:30 - 22:00'),{start:'13:30',end:'22:00'});assert.equal(parseTimes('das 18h às 9h'),null);
});
test('simulated drafts pass the same validation as real AI drafts',()=>{
 const rows=[entity('p1','product',{name:'Plano Growth',price:1200}),entity('m1','member',{name:'Ana Souza'}),entity('m2','member',{name:'Bruno Lima'}),entity('c1','contract',{name:'Contrato Acme',counterparty:'Acme',expires:'2026-12-01'}),entity('a1','article',{name:'Atendimento',text:'Receber o cliente, entender a necessidade e registrar o próximo passo.',approved:true})];
 const run=(tool:string,prompt:string,selection:any={})=>simulateToolResult(tool,prompt,buildToolContext(tool,rows,{...selection,prompt}),today);
 const proposal=run('proposal','Proposta com 3 unidades e 10% de desconto',{productIds:['p1']});
 assert.deepEqual(proposal.data!.items,[{name:'Plano Growth',quantity:3,price:1200}]);assert.equal(proposal.data!.discount,10);assert.equal(proposal.simulated,true);
 const transaction=prepareToolRecord('transaction',run('transaction','Registre uma saída de R$ 150 para internet, vencimento 25/10/2026').data!,rows).data;
 assert.equal(transaction.amount,150);assert.equal(transaction.direction,'out');assert.equal(transaction.date,'2026-10-25');assert.equal(transaction.category,'Internet');assert.equal(transaction.status,'pending');
 assert.throws(()=>run('transaction','Registre uma despesa de internet'),/valor/);
 const shift=prepareToolRecord('shift',run('shift','Bruno trabalha amanhã das 13h às 22h no time de suporte').data!,rows).data;
 assert.deepEqual([shift.memberId,shift.date,shift.start,shift.end,shift.team],['m2','2026-10-24','13:00','22:00','Suporte']);
 const contract=prepareToolRecord('contract',run('contract','Extraia',{sourceText:'Contratada: Beta Serviços Ltda, valor mensal de R$ 3.000,00. Vigência até 31/12/2027. Multa de 20% em caso de rescisão.'}).data!,rows).data;
 assert.deepEqual([contract.counterparty,contract.value,contract.expires],['Beta Serviços Ltda',3000,'2027-12-31']);assert.match(contract.penalty,/Multa de 20%/);
 assert.match(run('renewal','Prepare a renovação',{contractId:'c1'}).text!,/Contrato Acme[\s\S]*01\/12\/2026/);
 assert.ok(prepareToolRecord('article',run('article','Processo de atendimento: receber, entender a necessidade e registrar').data!,rows).data.text.includes('3. Registrar'));
 assert.ok(prepareToolRecord('content',run('content','Crie um post sobre consultoria',{kind:'posts'}).data!,rows).data.text.length>20);
 const answer=run('wiki-answer','Como é o processo de atendimento?');assert.deepEqual(answer.citations,['a1']);assert.match(answer.text!,/Atendimento/);
});
