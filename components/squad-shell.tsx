'use client';
import {useState} from 'react';
import {Home,LayoutGrid,Store,PanelLeftClose,PanelLeftOpen,ChevronDown,MoreHorizontal,FileText,Wallet,CalendarDays,MessageSquare,Phone,Columns3,Settings,Search,FlaskConical,LogOut,BookOpen,Users,Megaphone,Globe,HelpCircle} from 'lucide-react';
import {useCRM} from './context';
import type {CRMPage} from '../lib/types';
export const SQUAD_AGENTS=[
 {id:'pipo',name:'Pipo',role:'Recursos Humanos',color:'#efd897',avatar:'https://squad.com/assets/avatar-pipo-new-0gDB_p02.png'},
 {id:'waz',name:'Waz',role:'Vendas e Atendimento',color:'#bde6ae',avatar:'https://squad.com/assets/avatar-waz-CQx0zSnG.png'},
 {id:'maky',name:'Maky',role:'Marketing',color:'#edbbd0',avatar:'https://squad.com/assets/avatar-maky-OPwPkfWq.png'},
 {id:'fin',name:'Fin',role:'Finanças',color:'#a8caf4',avatar:'https://squad.com/assets/avatar-fin-VWHrjsF6.png'},
 {id:'opy',name:'Opy',role:'Operações',color:'#b8e6db',avatar:'https://squad.com/assets/avatar-opy-new-C48KX9Lu.png'},
 {id:'juri',name:'Juri',role:'Jurídico',color:'#c6b1e8',avatar:'https://squad.com/assets/avatar-juri-new-Cnb5kZtP.png'}
];
const favorites:{id:CRMPage;label:string;icon:typeof Home}[]=[
 {id:'pipelines',label:'CRM',icon:Columns3},{id:'inbox',label:'Conversas',icon:MessageSquare},{id:'proposals',label:'Gestão de propostas',icon:FileText},
 {id:'calls',label:'Ligações com IA',icon:Phone},{id:'finance',label:'Fluxo de caixa',icon:Wallet},{id:'marketing',label:'Criador de posts',icon:LayoutGrid}
];
export function SquadSidebar({collapsed,onCollapse,onSearch}:{collapsed:boolean;onCollapse:()=>void;onSearch:()=>void}){
 const {page,focusId,navigate,entities,mode,startLive,startDemo,loading}=useCRM();const [more,setMore]=useState(false),[moreTools,setMoreTools]=useState(false);
 const company=entities.find(e=>e.type==='setting'&&!e.deleted&&e.data.key==='company')?.data;
 const item=(id:CRMPage,label:string,Icon:typeof Home,focus?:string)=><button title={label} className={`sq-nav-item ${page===id?'selected':''}`} key={id} onClick={()=>navigate(id,focus)}><Icon size={17}/><span>{label}</span></button>;
 return <aside className={`sq-sidebar ${collapsed?'collapsed':''}`}><div className="sq-company"><button className="sq-company-avatar" aria-label="Seu negócio" onClick={()=>navigate('business')}><FlaskConical size={20}/><small>ACME</small></button><button className="sq-company-name" onClick={()=>navigate('business')}>{company?.company||company?.name||'Sua empresa'}</button><button aria-label={collapsed?'Expandir menu':'Recolher menu'} onClick={onCollapse} className="sq-collapse">{collapsed?<PanelLeftOpen size={15}/>:<PanelLeftClose size={15}/>}</button></div>
  <div className="sq-sidebar-scroll"><nav className="sq-main-nav">{item('home','Home',Home)}{item('tools','Ferramentas',LayoutGrid)}{item('business','Seu Negócio',Store)}</nav>
  <div className="sq-nav-label">Seu time<ChevronDown size={11}/></div><nav className="sq-agent-nav">{SQUAD_AGENTS.slice(0,more?6:3).map(a=><button key={a.id} title={a.name} className={`sq-nav-item sq-agent-link ${page==='assistant'&&focusId===a.id?'selected':''}`} onClick={()=>navigate('assistant',a.id)}><img src={a.avatar} alt=""/><span>{a.name}</span>{a.id==='waz'&&entities.filter(e=>e.type==='conversation'&&!e.deleted&&e.data.status==='waiting').length>0&&<b>{entities.filter(e=>e.type==='conversation'&&!e.deleted&&e.data.status==='waiting').length}</b>}</button>)}<button className="sq-nav-item" onClick={()=>setMore(!more)} title="Mais agentes"><MoreHorizontal size={17}/><span>{more?'Menos':'Mais'}</span></button></nav>
  <div className="sq-nav-label sq-favorites-label">Favoritas<ChevronDown size={11}/></div><nav className="sq-favorites">{favorites.map(f=>item(f.id,f.label,f.icon))}{moreTools&&<>{item('contracts','Gestão de contratos',FileText)}{item('shifts','Gestão de escalas',CalendarDays)}{item('recruiting','Triagem de CVs',Users)}{item('wiki','Wiki interno',BookOpen)}{item('campaigns','Disparos de WhatsApp',Megaphone)}{item('central','Central de atendimento',Phone)}</>}<button className="sq-nav-item" onClick={()=>setMoreTools(!moreTools)} title="Mais ferramentas"><MoreHorizontal size={17}/><span>{moreTools?'Menos':'Mais'}</span></button></nav>
  </div><div className="sq-sidebar-bottom"><button className="sq-nav-item" title="Buscar" onClick={onSearch}><Search size={16}/><span>Buscar<kbd>⌘ K</kbd></span></button>{item('ai-center','Ativar atendimento',Phone,'setup')}{item('settings','Configurações',Settings)}<div className="sq-mode"><i className={mode}/><span>{mode==='demo'?'Demonstração':'Meu workspace'}</span><button disabled={loading} onClick={()=>mode==='demo'?void startLive().catch(()=>{}):startDemo()}>{mode==='demo'?'Usar meus dados':'Ver demo'}</button></div><small className="sq-reference-note">Prévia independente · referência Squad</small></div>
 </aside>;
}
