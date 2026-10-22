import {validateEntity} from './domain.ts';
import {validateReferences} from './references.ts';
import type {Entity,EntityType} from './types.ts';
export const AGENT_TOOLS=[
 {id:'proposal',agent:'waz',name:'Montar proposta comercial',description:'Crie uma proposta com o catálogo e revise os itens antes de salvar.',example:'Proposta com 3 unidades do serviço selecionado e 10% de desconto.',page:'proposals'},
 {id:'content',agent:'maky',name:'Criar conteúdo',description:'Prepare posts, artigos e rascunhos de campanhas com o contexto da empresa.',example:'Crie um post sobre nosso serviço para pequenos negócios, com uma chamada para conversar.',page:'marketing'},
 {id:'transaction',agent:'fin',name:'Organizar lançamento',description:'Transforme sua anotação em uma entrada ou saída pendente.',example:'Registre uma saída de R$ 150 para internet, vencimento 25/10/2026.',page:'finance'},
 {id:'shift',agent:'opy',name:'Montar turno',description:'Prepare um turno e confira os horários e conflitos antes de salvar.',example:'Ana trabalhará dia 25/10/2026, das 09h às 18h, no time de atendimento.',page:'shifts'},
 {id:'contract',agent:'juri',name:'Extrair dados do contrato',description:'Extraia contraparte, valor e vencimento do texto fornecido.',example:'Extraia os dados do contrato fornecido, sem inventar informações ausentes.',page:'contracts'},
 {id:'renewal',agent:'juri',name:'Preparar renovação',description:'Gere o rascunho de e-mail com o contexto do contrato selecionado.',example:'Prepare um e-mail cordial para conversar sobre a renovação deste contrato.',page:'contracts'},
 {id:'article',agent:'pipo',name:'Organizar conhecimento',description:'Transforme um processo em artigo para revisão e aprovação da equipe.',example:'Organize nosso processo de atendimento: receber, entender a necessidade e registrar o próximo passo.',page:'wiki'},
 {id:'wiki-answer',agent:'pipo',name:'Consultar wiki aprovada',description:'Responda uma dúvida usando apenas os artigos aprovados.',example:'Qual é o nosso processo de atendimento?',page:'wiki'}
];
export function buildToolContext(tool:string,rows:Entity[],selection:Record<string,any>={}):Record<string,any>{
 const active=rows.filter(e=>!e.deleted);const company=active.find(e=>e.type==='setting'&&e.data.key==='company')?.data||{};
 const context:Record<string,any>={company:{}};for(const key of ['name','company','website','segment','description'])if(typeof company[key]==='string')context.company[key]=company[key].slice(0,1200);
 if(tool==='proposal'){context.leadId=selection.leadId||'';context.products=active.filter(e=>e.type==='product'&&selection.productIds?.includes(e.id)).slice(0,50).map(e=>({id:e.id,name:e.data.name,price:Number(e.data.price)}));}
 if(tool==='content')context.kind=selection.kind||'posts';
 if(tool==='shift')context.members=active.filter(e=>e.type==='member').slice(0,100).map(e=>({id:e.id,name:e.data.name}));
 if(tool==='contract')context.sourceText=String(selection.sourceText||'').slice(0,20000);
 if(tool==='renewal'){const c=active.find(e=>e.type==='contract'&&e.id===selection.contractId)?.data||{};context.contract={};for(const key of ['name','counterparty','expires','value','text'])if(c[key]!==undefined)context.contract[key]=String(c[key]).slice(0,1200);}
 if(tool==='wiki-answer'){
  const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const terms=normalize(String(selection.prompt||'')).split(/[^a-z0-9]+/).filter(t=>t.length>2);
  const ranked=active.filter(e=>e.type==='article'&&e.data.approved===true&&e.data.text).map(e=>({entity:e,score:terms.reduce((n,t)=>n+(normalize(String(e.data.name)).includes(t)?5:0)+(normalize(String(e.data.text)).includes(t)?1:0),0)})).sort((a,b)=>b.score-a.score);
  const sources:any[]=[];let budget=26000;
  for(const {entity:e} of ranked){if(sources.length>=20||budget<500)break;const item={id:e.id,name:String(e.data.name).slice(0,150),text:String(e.data.text).slice(0,Math.min(5000,budget-300)),approved:true};budget-=JSON.stringify(item).length;sources.push(item);}
  context.articles=sources;
 }
 if(JSON.stringify(context).length>35000)throw new Error('Reduza o texto ou a quantidade de registros selecionados.');return context;
}
const validDate=(value:any)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;};
export function prepareToolRecord(tool:string,input:Record<string,any>,rows:Entity[]){
 const fields:Record<string,string[]>={proposal:['name','leadId','items','discount','notes'],content:['name','text','kind','date'],transaction:['name','direction','amount','date','category'],shift:['memberId','date','start','end','team'],contract:['name','counterparty','expires','value','text','penalty'],article:['name','text']};
 if(!fields[tool])throw new Error('Ferramenta inválida.');
 const data:Record<string,any>={};for(const key of fields[tool])if(input[key]!==undefined)data[key]=input[key];
 if(['proposal','content'].includes(tool))data.status='draft';if(tool==='transaction')data.status='pending';if(tool==='article'){data.approved=false;data.status='draft';}if(tool==='contract')data.status='imported';
 if((tool==='shift'||tool==='transaction')&&!validDate(data.date))throw new Error('Informe uma data válida.');
 if(tool==='contract'&&data.expires&&!validDate(data.expires))throw new Error('Confira a data de vencimento.');
 if(tool==='shift'&&(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(data.start)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(data.end)))throw new Error('Confira os horários.');
 const clean=validateEntity(tool,data);validateReferences(tool,clean,rows);return {type:tool as EntityType,data:clean};
}
