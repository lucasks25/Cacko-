import test from 'node:test';
import assert from 'node:assert/strict';
import {buildToolContext,prepareToolRecord,AGENT_TOOLS,matchAgentTool,preselectFromPrompt} from '../lib/agent-tools.ts';
import {validateReferences} from '../lib/references.ts';
import {validateEntity} from '../lib/domain.ts';
const entity=(id:string,type:any,data:any)=>({id,type,data,revision:1,updatedAt:'',deleted:false});
test('tool context includes only selected catalogue items and approved wiki records',()=>{
 const rows=[entity('p1','product',{name:'Serviço',price:100,api_key:'secret'}),entity('a1','article',{name:'Política',text:'Aprovado',approved:true}),entity('a2','article',{name:'Privado',text:'Rascunho',approved:false})];
 const proposal=buildToolContext('proposal',rows,{productIds:['p1'],leadId:'l1'});
 assert.equal(proposal.products[0].price,100);assert.ok(!JSON.stringify(proposal).includes('secret'));
 assert.deepEqual(buildToolContext('wiki-answer',rows,{}).articles.map((a:any)=>a.id),['a1']);
 assert.equal(AGENT_TOOLS.filter(t=>t.agent==='juri').length,2);
});
test('generated records cannot publish content, approve wiki or mark money received',()=>{
 assert.equal(prepareToolRecord('content',{name:'Post',text:'Texto',status:'published'},[]).data.status,'draft');
 assert.equal(prepareToolRecord('article',{name:'Artigo',text:'Texto',approved:true},[]).data.approved,false);
 assert.equal(prepareToolRecord('transaction',{name:'Conta',amount:10,direction:'in',date:'2026-10-22',status:'received'},[]).data.status,'pending');
 assert.throws(()=>prepareToolRecord('payment',{name:'Pagar'},[]));
 assert.throws(()=>prepareToolRecord('proposal',{name:'Proposta',items:[{name:'Item',quantity:1,price:100}],discount:101},[]),/desconto/i);
 assert.throws(()=>validateEntity('proposal',{name:'Proposta',items:[{name:'Item',quantity:1,price:100}],discount:101}),/desconto/i);
 assert.throws(()=>prepareToolRecord('contract',{name:'Contrato',value:-100,text:'Texto'},[]),/valor/i);
});
test('wiki retrieval fits the context budget and prioritizes relevant approved sources',()=>{
 const rows=Array.from({length:20},(_,i)=>entity('a'+i,'article',{name:'Processo '+i,text:'x'.repeat(5000),approved:true}));
 rows.push(entity('relevant','article',{name:'Férias da equipe',text:'O pedido de férias deve ser aprovado pelo gestor.',approved:true}));
 const context=buildToolContext('wiki-answer',rows,{prompt:'Como solicitar férias?'});
 assert.ok(JSON.stringify(context).length<35000);assert.equal(context.articles[0].id,'relevant');assert.ok(context.articles.length>1);
});
test('shift drafts reject invalid dates, foreign members and overlapping hours',()=>{
 const rows=[entity('m1','member',{name:'Ana'}),entity('s1','shift',{memberId:'m1',date:'2026-10-22',start:'09:00',end:'12:00'})];
 assert.throws(()=>prepareToolRecord('shift',{memberId:'m1',date:'2026-10-22',start:'11:00',end:'14:00'},rows),/conflito|sobrep|horário/i);
 assert.throws(()=>prepareToolRecord('shift',{memberId:'other',date:'2026-10-22',start:'13:00',end:'14:00'},rows),/colaborador|relacionado/i);
 assert.throws(()=>prepareToolRecord('shift',{memberId:'m1',date:'2026-02-31',start:'13:00',end:'14:00'},rows),/data/i);
 const valid=prepareToolRecord('shift',{memberId:'m1',date:'2026-10-22',start:'12:00',end:'14:00'},rows);assert.equal(valid.type,'shift');
 assert.throws(()=>validateReferences('shift',{memberId:'other',date:'2026-10-22',start:'13:00',end:'14:00'},rows));
});
test('free chat routes requests to the matching task of the current agent only',()=>{
 assert.equal(matchAgentTool('waz','Monte um orçamento com 3 unidades e 10% de desconto'),'proposal');
 assert.equal(matchAgentTool('fin','Registre uma saída de R$ 150 para internet'),'transaction');
 assert.equal(matchAgentTool('opy','Ana fica no turno das 9h às 18h amanhã'),'shift');
 assert.equal(matchAgentTool('juri','Prepare a renovação do contrato da Acme'),'renewal');
 assert.equal(matchAgentTool('juri','Extraia os dados deste contrato'),'contract');
 assert.equal(matchAgentTool('maky','Crie um post para o Instagram'),'content');
 assert.equal(matchAgentTool('pipo','Documente nosso processo de atendimento'),'article');
 assert.equal(matchAgentTool('pipo','Qual é a política de reembolso?'),'wiki-answer');
 assert.equal(matchAgentTool('waz','Registre uma despesa de R$ 50'),null);
 assert.equal(matchAgentTool('fin','Bom dia, tudo bem com você hoje'),null);
 assert.equal(matchAgentTool('waz','oi'),null);
 for(const [agent,tool] of Object.entries({waz:'proposal',maky:'content',fin:'transaction',opy:'shift',juri:'contract',pipo:'article'}))assert.ok(AGENT_TOOLS.some(t=>t.agent===agent&&t.id===tool));
});
test('chat requests preselect only records cited by name for the matching task',()=>{
 const rows=[entity('p1','product',{name:'Plano Growth',price:1200}),entity('p2','product',{name:'Consultoria',price:4800}),entity('l1','lead',{name:'Acme Ltda'}),entity('c1','contract',{name:'Contrato Acme'}),entity('p3','product',{name:'Plano Growth Antigo',price:1},),];
 rows[4].deleted=true;
 assert.deepEqual(preselectFromPrompt('proposal','Proposta do plano growth para a ACME LTDA',rows),{productIds:['p1'],leadId:'l1',contractId:''});
 assert.deepEqual(preselectFromPrompt('renewal','Renovar o contrato acme',rows),{productIds:[],leadId:'',contractId:'c1'});
 assert.deepEqual(preselectFromPrompt('content','Post sobre consultoria',rows),{productIds:[],leadId:'',contractId:''});
});
