'use client';
import {useState} from 'react';
import {ChevronDown,ArrowRight,BriefcaseBusiness,Check} from 'lucide-react';
import {AGENT_TOOLS} from '../lib/agent-tools';
import {AgentActions} from './agent-actions';
import {useCRM} from './context';
import {Badge,Button} from './ui';
const missions:Record<string,{mission:string;steps:string[]}>={
 waz:{mission:'Organize o relacionamento e avance cada oportunidade.',steps:['Use o catálogo e os dados da empresa','Prepare a proposta com itens e desconto','Revise e acompanhe pelo CRM']},
 maky:{mission:'Transforme o contexto da sua marca em conteúdo pronto para revisar.',steps:['Defina o público e o objetivo','Crie o post, artigo ou anúncio','Revise e salve na sua biblioteca']},
 fin:{mission:'Troque anotações soltas por registros financeiros organizados.',steps:['Informe valor, data e categoria','Confira o lançamento pendente','Acompanhe entradas e saídas no caixa']},
 opy:{mission:'Organize os turnos da equipe com visibilidade dos horários.',steps:['Informe colaborador, dia e jornada','Confira conflitos com a escala atual','Salve o turno e acompanhe no calendário']},
 juri:{mission:'Centralize contratos, acompanhe os prazos e prepare a próxima conversa.',steps:['Extraia os dados do texto do contrato','Confira contraparte, valores e vencimento','Prepare a renovação para sua revisão']},
 pipo:{mission:'Organize o conhecimento e dê à equipe respostas com fontes.',steps:['Transforme processos em artigos','Aprove o conhecimento que pode ser consultado','Faça perguntas e confira as fontes utilizadas']}
};
export function AgentCapabilities({agent,onStart}:{agent:string;onStart?:(tool:string)=>void}){
 const {mode,navigate}=useCRM();const [expanded,setExpanded]=useState(false);const mission=missions[agent];const tasks=AGENT_TOOLS.filter(t=>t.agent===agent);
 return <section className="aa-capabilities"><button className="aa-capability-heading" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}><span><BriefcaseBusiness size={16}/><strong>Meu trabalho no seu negócio</strong></span><ChevronDown size={15}/></button>{expanded&&<><p>{mission.mission}</p><div className="aa-workflow">{mission.steps.map((s,i)=><span key={s}><i>{i+1}</i>{s}</span>)}</div><div className="aa-task-grid">{tasks.map(t=><AgentActions key={t.id} agent={agent} initialTool={t.id} asCard onStart={onStart}/>)}</div><div className="aa-capability-footer"><span><Check size={13}/>Você revisa antes de salvar</span><Button variant="ghost" onClick={()=>navigate('ai-center','setup')}>{mode==='demo'?'Conectar minha IA':'Verificar conexão'}<ArrowRight size={13}/></Button></div></>}</section>;
}
