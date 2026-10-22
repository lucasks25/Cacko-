import type {Entity,EntityType} from './types';
import {STAGE_COLORS} from './types';
export const defaultPipeline={name:'Pipeline comercial',description:'',stages:['Novos leads','Em qualificação','Pronto para compra','Negociação','Venda'].map((name,i)=>({id:'stage-'+i,name,color:['#8071df','#8071df','#8071df','#dca65d','#62996d'][i]}))};
export function makeDemo():Entity[]{
  const rows:Entity[]=[];const now=new Date();
  const day=(offset=0)=>{const d=new Date(now);d.setDate(d.getDate()+offset);return d.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});};
  const add=(type:EntityType,id:string,data:any)=>{rows.push({id,type,data,revision:1,updatedAt:now.toISOString(),deleted:false});};
  add('pipeline','pipeline-main',defaultPipeline);
  add('pipeline','pipeline-onboarding',{name:'Onboarding',description:'Uma boa venda é só o começo.',stages:[{id:'on-0',name:'Boas-vindas',color:'#4c79f7'},{id:'on-1',name:'Implantação',color:'#ab64d9'},{id:'on-2',name:'Acompanhamento',color:'#48a180'}]});
  const owners=['Lucas Martins','Marina Costa','Rafael Lima'];
  owners.forEach((name,i)=>add('member','member-'+i,{name,email:['lucas','marina','rafael'][i]+'@exemplo.com',role:i?'Vendedor':'Administrador'}));
  [{name:'Potencial alto',color:'#ab64d9'},{name:'Inbound',color:'#4c79f7'},{name:'Indicação',color:'#48a180'},{name:'Prioridade',color:'#e3a849'}].forEach((d,i)=>add('tag','tag-'+i,d));
  const names=['Camila Rodrigues','Pedro Almeida','Juliana Santos','Bruno Ferreira','Fernanda Oliveira','Gabriel Souza','Isabela Costa','Ricardo Mendes','Beatriz Lima','André Carvalho','Mariana Rocha','Thiago Pereira','Larissa Gomes','Felipe Ribeiro','Amanda Martins','Rafael Dias','Sofia Barros','Diego Nunes'];
  const companies=['Studio Aurora','Vértice Digital','Clínica Essência','Grupo Horizonte','Casa Nativa','Forma Arquitetura','Verde & Cia','Atlas Consultoria','Escola Raízes','Movi Saúde','Lume Design','Norte Logística','Soma Educação','Órbita Tech','Flora Boutique','Vista Imóveis','Cora Estética','Prisma Soluções'];
  names.forEach((name,i)=>add('lead','lead-'+i,{name,company:companies[i],email:name.split(' ')[0].toLowerCase()+'@exemplo.com',phone:'(11) 90000-'+String(1000+i),source:['WhatsApp','Instagram','Site','Indicação'][i%4],owner:'member-'+i%3,tags:i%3===0?['Potencial alto','Inbound']:i%3===1?['Inbound']:['Indicação'],createdAt:day(-i%14),notes:''}));
  const values=[4800,12500,3200,8600,7400,24900,5200,18000,9600,6800,15000,4200,32000,8200,11500,5600,2800,19400];
  names.forEach((name,i)=>add('deal','deal-'+i,{name:companies[i],leadId:'lead-'+i,pipelineId:'pipeline-main',stageId:'stage-'+(i===15||i===16?4:i===17?3:i%5),value:values[i],owner:'member-'+i%3,status:i===15||i===16?'won':i===17?'lost':'open',productId:'product-'+i%3,expectedDate:day(3+i),createdAt:day(-i%14),tags:i%3===0?['Potencial alto']:['Inbound'],description:'Oportunidade de demonstração para '+companies[i]}));
  ['Consultoria estratégica','Plano Growth','Implantação completa'].forEach((name,i)=>add('product','product-'+i,{name,price:[4800,1200,8500][i],sku:'PRD-00'+(i+1),description:'Produto de demonstração',active:true}));
  ['Apresentar proposta para Camila','Ligar para Pedro Almeida','Reunião com Clínica Essência','Follow-up com Grupo Horizonte','Enviar apresentação comercial','Revisar proposta Vértice','Alinhamento de onboarding','Retomar contato com Beatriz'].forEach((title,i)=>add('task','task-'+i,{title,type:i%3===0?'meeting':'call',leadId:'lead-'+i,dealId:'deal-'+i,dueDate:day(i<2?-1:i<5?0:1),dueTime:['09:00','10:30','11:00','14:00','15:30','16:00','17:00','09:30'][i],owner:'member-'+i%3,done:i===6,description:''}));
  const texts=['Olá! Gostaria de conhecer melhor a consultoria.','Consegue me enviar a proposta atualizada?','Podemos agendar uma conversa para amanhã?','Obrigada pelo atendimento! Vou conversar com o time.','Tenho interesse no plano Growth.','Qual o prazo de implantação?'];
  names.slice(0,6).forEach((name,i)=>{add('conversation','conv-'+i,{name,channel:i%3===1?'instagram':'whatsapp',status:i<3?'open':i<5?'waiting':'resolved',leadId:i===4?'':'lead-'+i,owner:'member-'+i%3,protocol:'AT-2026-'+(1021+i),robotPaused:false,createdAt:day()});add('message','msg-'+i+'-0',{conversationId:'conv-'+i,text:i?'Oi, tudo bem?':'Bom dia! Encontrei vocês pelo Instagram.',direction:'in',status:'received',createdAt:day()+'T09:30:00'});add('message','msg-'+i+'-1',{conversationId:'conv-'+i,text:texts[i],direction:'in',status:'received',createdAt:day()+'T09:32:00'});});
  add('automation','auto-0',{name:'Boas-vindas ao novo lead',description:'Cria uma atividade para o primeiro contato.',trigger:'lead.created',active:true,condition:null,actions:[{type:'task',title:'Realizar primeiro contato'}]});
  add('automation','auto-1',{name:'Follow-up de oportunidades',description:'Acompanhe negócios com valor acima de R$ 5 mil.',trigger:'deal.created',active:true,condition:{field:'value',operator:'gte',value:5000},actions:[{type:'task',title:'Agendar reunião de diagnóstico'}]});
  add('automation','auto-2',{name:'Enviar proposta pelo WhatsApp',description:'Aguardando uma conexão autenticada.',trigger:'deal.updated',active:false,condition:{field:'stageId',operator:'eq',value:'stage-3'},actions:[{type:'message',text:'Olá! Sua proposta está pronta.'}]});
  add('agent','agent-0',{name:'Assistente comercial',instructions:'Você é um assistente comercial. Entenda o objetivo do cliente, responda com clareza e transfira ao vendedor quando houver intenção de compra.',model:'gpt-4.1-mini',knowledge:'Nossa consultoria ajuda empresas a organizar o processo comercial.',status:'draft'});
  add('campaign','campaign-0',{name:'Reativação de oportunidades',text:'Olá, {{nome}}! Vamos retomar nossa conversa?',tag:'Inbound',status:'draft'});
  add('setting','setting-company',{key:'company',name:'Sua empresa',company:'Sua empresa',timezone:'America/Sao_Paulo',currency:'BRL'});
  names.slice(0,4).forEach((name,i)=>add('activity','activity-'+i,{leadId:'lead-'+i,dealId:'deal-'+i,text:['Negócio criado no funil de vendas','Reunião de diagnóstico agendada','Proposta comercial em preparação','Primeiro contato realizado'][i],createdAt:now.toISOString()}));
  names.slice(0,16).forEach((name,i)=>{
    const created=new Date(now);created.setHours(8+Math.floor(i/2),[5,18,32,47][i%4],0,0);
    const seconds=[182,294,95,326,147,230,0,168][i%8];const status=i===0?'active':i%7===6?'missed':'completed';
    const start=new Date(created.getTime()+12000);const end=new Date(start.getTime()+seconds*1000);
    add('call','call-demo-'+i,{name,leadId:'lead-'+i,number:'+551190000'+String(1000+i),kind:i%3?'ai':'human',direction:i%4===0?'in':'out',status,createdAt:created.toISOString(),...(status==='completed'?{startedAt:start.toISOString(),endedAt:end.toISOString()}:{}),outcome:status==='completed'?['Interesse em comprar','Retornar depois','Resolvido'][i%3]:'',notes:'',transcript:status==='completed'?[
      {role:'assistant',text:'Olá! Sou o assistente virtual da equipe. Como posso ajudar?'},
      {role:'user',text:'Quero entender como funciona o atendimento e os planos disponíveis.'},
      {role:'assistant',text:'Claro. Qual é o principal objetivo da sua empresa neste momento?'},
      {role:'user',text:'Organizar os contatos e conseguir responder aos clientes mais rápido.'},
      {role:'assistant',text:'Entendi. Posso encaminhar esse contexto para um especialista apresentar as opções.'}
    ]:[]});
  });
  [
    {name:'Consultoria de implantação',leadId:'lead-0',items:[{name:'Implantação completa',quantity:1,price:8500}],discount:0,status:'draft'},
    {name:'Plano de atendimento mensal',leadId:'lead-1',items:[{name:'Plano Growth',quantity:1,price:1200}],discount:0,status:'draft'}
  ].forEach((d,i)=>add('proposal','proposal-'+i,{...d,createdAt:day(-i),notes:'Proposta de demonstração.'}));
  [{name:'Consultoria recebida',amount:4800,direction:'in',status:'received',category:'Clientes'},
   {name:'Licenças de ferramentas',amount:390,direction:'out',status:'paid',category:'Software'},
   {name:'Locação do escritório',amount:1800,direction:'out',status:'paid',category:'Despesas'},
   {name:'Plano Growth',amount:1200,direction:'in',status:'pending',category:'Clientes'}
  ].forEach((d,i)=>add('transaction','transaction-'+i,{...d,date:day(-i)}));
  ['Contrato de prestação de serviços','Contrato de locação comercial'].forEach((name,i)=>add('contract','contract-'+i,{name,status:'imported',counterparty:companies[i],value:values[i],expires:day(30+i*30),text:'Contrato de demonstração. Substitua pelo conteúdo real do seu contrato.'}));
  ['Analista de Atendimento','Executivo de Vendas','Analista de Marketing Digital','Coordenador(a) de Operações'].forEach((name,i)=>add('vacancy','vacancy-'+i,{name,location:['São Paulo','Remoto'][i%2],regime:i%2?'PJ':'CLT',status:'open',candidates:[],description:'Vaga de demonstração. Edite os requisitos para a sua empresa.'}));
  for(let i=0;i<7;i++)owners.forEach((_,j)=>{if(i<5||j===1)add('shift','shift-'+i+'-'+j,{memberId:'member-'+j,date:day(i),start:'09:00',end:'18:00',team:j?'Atendimento':'Comercial'});});
  add('article','article-0',{name:'Como funciona nosso atendimento',text:'Atendemos de segunda a sexta, das 9h às 18h. Dúvidas comerciais devem ser encaminhadas ao time de vendas.',approved:true});
  add('content','content-0',{name:'Conheça nossa consultoria',kind:'posts',platform:'Instagram',status:'draft',text:'Organize seu processo comercial e aproxime sua empresa de cada cliente.',date:day(2)});
  return rows;
}
