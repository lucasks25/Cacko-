'use client';
import {useState,useEffect,useRef,useCallback} from 'react';
import {LayoutDashboard,Filter,Users,GitBranch,MessageSquare,CalendarDays,BarChart3,Settings,HelpCircle,Search,Bell,ChevronDown,ChevronRight,Plus,PanelLeftClose,PanelLeftOpen,Command,Package,Plug,Zap,Bot,Send,Check,X,ArrowUpRight,LogOut,RefreshCw,Menu,Phone,Headphones} from 'lucide-react';
import {CRMContext} from '../components/context';
import type {Entity,EntityType,CRMPage,CRMContextValue} from '../lib/types';
import {validateEntity,evaluateFlow,validateReferences,resolveOwner} from '../lib/domain';
import {makeDemo,defaultPipeline} from '../lib/demo';
import {Avatar,Button,Modal,Badge} from '../components/ui';
import {PipelinesPage} from '../components/pipelines';
import {DashboardPage,ReportsPage} from '../components/dashboard';
import {LeadsPage,TasksPage} from '../components/contacts';
import {InboxPage} from '../components/engagement';
import {ContactOverview,CallsPage,ContactAIPage} from '../components/contact-center';
import {ConnectedInboxPage} from '../components/connected-inbox';
import {SquadSidebar} from '../components/squad-shell';
import {SquadPipelinePage} from '../components/squad-pipeline';
import {SquadHomePage,SquadToolsPage,SquadAssistantPage,SquadRecordsPage,SquadShiftsPage} from '../components/squad-workspace';
import '../components/squad.css';
import {AutomationsPage,AgentsPage,CampaignsPage} from '../components/automation';
import {ProductsPage,ConnectionsPage,IntegrationsPage,SettingsPage,HelpPage} from '../components/admin';

const navigation:{id:CRMPage;label:string;icon:typeof Users;group:string}[]=[
 {id:'home',label:'Home',icon:LayoutDashboard,group:'Workspace'},
 {id:'tools',label:'Ferramentas',icon:Package,group:'Workspace'},
 {id:'business',label:'Seu Negócio',icon:Settings,group:'Workspace'},
 {id:'assistant',label:'Agentes',icon:Bot,group:'Workspace'},
 {id:'proposals',label:'Propostas',icon:Package,group:'Workspace'},
 {id:'finance',label:'Fluxo de caixa',icon:BarChart3,group:'Workspace'},
 {id:'contracts',label:'Contratos',icon:Package,group:'Workspace'},
 {id:'shifts',label:'Escalas',icon:CalendarDays,group:'Workspace'},
 {id:'recruiting',label:'Triagem de CVs',icon:Users,group:'Workspace'},
 {id:'marketing',label:'Marketing',icon:Send,group:'Workspace'},
 {id:'wiki',label:'Wiki interno',icon:HelpCircle,group:'Workspace'},
 {id:'central',label:'Central de atendimento',icon:Headphones,group:'Operação'},
 {id:'inbox',label:'Caixa de entrada',icon:MessageSquare,group:'Operação'},
 {id:'calls',label:'Ligações',icon:Phone,group:'Operação'},
 {id:'ai-center',label:'Assistente de IA',icon:Bot,group:'Operação'},
 {id:'leads',label:'Clientes',icon:Users,group:'Relacionamento'},
 {id:'pipelines',label:'Pipelines',icon:Filter,group:'Relacionamento'},
 {id:'tasks',label:'Agenda e retornos',icon:CalendarDays,group:'Relacionamento'},
 {id:'automations',label:'Automações',icon:GitBranch,group:'Relacionamento'},
 {id:'reports',label:'Relatórios comerciais',icon:BarChart3,group:'Gestão'},
 {id:'connections',label:'Canais e conexões',icon:Plug,group:'Gestão'},
 {id:'products',label:'Produtos',icon:Package,group:'Gestão'},
 {id:'settings',label:'Configurações',icon:Settings,group:'Gestão'},
 {id:'help',label:'Central de ajuda',icon:HelpCircle,group:'Gestão'},
];
export default function CRM({userName,userEmail}:{userName:string;userEmail:string}){
 const [entities,setEntities]=useState<Entity[]>(makeDemo);const entitiesRef=useRef(entities);const [mode,setMode]=useState<'demo'|'live'>('demo');const modeRef=useRef(mode);const [page,setPage]=useState<CRMPage>('pipelines');const [focusId,setFocusId]=useState<string|null>(null);const [loading,setLoading]=useState(false);const [reloadKey,setReloadKey]=useState(0);const [toast,setToast]=useState<{text:string;kind:string}|null>(null);const [query,setQuery]=useState('');const [searchOpen,setSearchOpen]=useState(false);const [sidebar,setSidebar]=useState(true);const [mobileMenu,setMobileMenu]=useState(false);const [notifications,setNotifications]=useState(false);const [quick,setQuick]=useState(false);
 const replace=(rows:Entity[])=>{entitiesRef.current=rows;setEntities(rows);};
 const notify=useCallback((text:string,kind='success')=>{setToast({text,kind});},[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),5000);return()=>clearTimeout(t);},[toast]);
 const navigate=useCallback((next:CRMPage,id?:string)=>{setPage(next);setFocusId(id||null);setQuery('');setSearchOpen(false);setMobileMenu(false);window.history.replaceState(null,'','#'+next+(id?'/'+id:''));},[]);
 const request=async(input?:any)=>{const res=await fetch('/api/crm',{method:input?'POST':'GET',headers:input?{'Content-Type':'application/json'}:undefined,body:input?JSON.stringify(input):undefined});const body:any=await res.json();if(!res.ok)throw new Error(body.error||'Não foi possível concluir.');return body;};
 const refresh=async()=>{if(modeRef.current==='demo')return;setLoading(true);try{const data=await request();replace(data.entities);setReloadKey(k=>k+1);}catch(e){notify((e as Error).message,'error');}finally{setLoading(false);}};
 const startLive=async()=>{setLoading(true);try{let data=await request();if(!data.entities.some((e:Entity)=>e.type==='pipeline'&&!e.deleted)){data=await request({type:'pipeline',data:defaultPipeline,revision:0});}replace(data.entities);modeRef.current='live';setMode('live');localStorage.setItem('fluxo:mode','live');notify('Seu ambiente está pronto. Os registros serão salvos na sua conta.');}catch(e){notify((e as Error).message,'error');throw e;}finally{setLoading(false);}};
 const startDemo=()=>{replace(makeDemo());modeRef.current='demo';setMode('demo');localStorage.setItem('fluxo:mode','demo');notify('Demonstração carregada. Seus registros reais continuam na sua conta.','info');};
 useEffect(()=>{const hash=window.location.hash.slice(1).split('/');if(navigation.some(n=>n.id===hash[0])){setPage(hash[0] as CRMPage);setFocusId(hash[1]||null);}if(localStorage.getItem('fluxo:mode')==='live')void startLive().catch(()=>{});const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setSearchOpen(s=>!s);}if(e.key==='Escape')setSearchOpen(false);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 const save=async(type:EntityType,data:Record<string,any>,id?:string,expectedRevision?:number):Promise<Entity>=>{
   const clean=validateEntity(type,data);if(clean.owner)clean.owner=resolveOwner(clean.owner,entitiesRef.current);const existing=id?entitiesRef.current.find(e=>e.id===id):undefined;
   if(modeRef.current==='live'){const result=await request({type,data:clean,id,revision:expectedRevision??existing?.revision??0});replace(result.entities);if(result.warning)notify(result.warning,'info');return result.entity;}
   if(existing&&expectedRevision!==undefined&&expectedRevision!==existing.revision)throw new Error('Conflito de edição. Feche e reabra o registro atualizado.');validateReferences(type,clean,entitiesRef.current,existing);const now=new Date().toISOString();let record:Entity={id:id||crypto.randomUUID(),type,data:clean,revision:(existing?.revision??0)+1,updatedAt:now,deleted:false};let rows=[...entitiesRef.current.filter(e=>e.id!==record.id),record];
   if(type==='lead'||type==='deal'){for(const flow of rows.filter(e=>e.type==='automation'&&e.data.active&&!e.deleted)){const event=type+'.'+(existing?'updated':'created');const result=evaluateFlow(flow.data,event,clean);if(flow.data.trigger!==event)continue;for(const action of result.actions){if(action.type==='task')rows.push({id:crypto.randomUUID(),type:'task',data:{title:action.title||'Acompanhar '+clean.name,type:'task',dueDate:new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),owner:clean.owner||'',done:false,...(type==='lead'?{leadId:record.id}:{dealId:record.id})},revision:1,updatedAt:now,deleted:false});if(action.type==='tag'&&type==='lead'){record={...record,data:{...record.data,tags:Array.from(new Set([...(record.data.tags||[]),action.tag]))}};rows=rows.map(e=>e.id===record.id?record:e);}if(action.type==='stage'&&type==='deal'&&rows.some(e=>e.type==='pipeline'&&!e.deleted&&e.data.stages.some((s:any)=>s.id===action.stageId))){record={...record,data:{...record.data,pipelineId:rows.find(e=>e.type==='pipeline'&&!e.deleted&&e.data.stages.some((s:any)=>s.id===action.stageId))!.id,stageId:action.stageId}};rows=rows.map(e=>e.id===record.id?record:e);}}rows.push({id:crypto.randomUUID(),type:'activity',data:{text:'Automação '+flow.data.name,automationId:flow.id,event,log:result.log,createdAt:now,...(type==='lead'?{leadId:record.id}:{dealId:record.id})},revision:1,updatedAt:now,deleted:false});}}
   replace(rows);return record;
 };
 const changeDeleted=async(entity:Entity,deleted:boolean)=>{if(modeRef.current==='live'){const result=await request({type:entity.type,id:entity.id,data:entity.data,revision:entity.revision,action:deleted?'archive':'restore'});replace(result.entities);}else replace(entitiesRef.current.map(e=>e.id===entity.id?{...e,deleted,revision:e.revision+1}:e));notify(deleted?'Registro movido para a lixeira.':'Registro restaurado.');};
 const context:CRMContextValue={entities,mode,loading,page,focusId,save,saveMany:async(values)=>{for(const value of values)await save(value.type,value.data,value.id);},archive:e=>changeDeleted(e,true),restore:e=>changeDeleted(e,false),refresh,notify,navigate,startLive,startDemo,query};
 const active=entities.filter(e=>!e.deleted);const openChats=active.filter(e=>e.type==='conversation'&&e.data.status!=='resolved').length;const overdue=active.filter(e=>e.type==='task'&&!e.data.done&&e.data.dueDate<=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}));
 const company=active.find(e=>e.type==='setting'&&e.data.key==='company')?.data;
 const matches=query.trim()?active.filter(e=>['lead','deal','task','automation','product'].includes(e.type)&&JSON.stringify(e.data).toLowerCase().includes(query.toLowerCase())).slice(0,9):[];
 const renderPage=()=>{switch(page){case 'home':return <SquadHomePage/>;case 'tools':return <SquadToolsPage/>;case 'business':return <SettingsPage/>;case 'assistant':return <SquadAssistantPage/>;case 'proposals':return <SquadRecordsPage key="proposal" kind="proposal"/>;case 'finance':return <SquadRecordsPage key="transaction" kind="transaction"/>;case 'contracts':return <SquadRecordsPage key="contract" kind="contract"/>;case 'recruiting':return <SquadRecordsPage key="vacancy" kind="vacancy"/>;case 'marketing':return <SquadRecordsPage key={focusId||'posts'} kind="content"/>;case 'wiki':return <SquadRecordsPage key="article" kind="article"/>;case 'shifts':return <SquadShiftsPage/>;case 'central':return <ContactOverview/>;case 'calls':return <CallsPage/>;case 'ai-center':return <ContactAIPage/>;case 'dashboard':return <DashboardPage/>;case 'pipelines':return <SquadPipelinePage/>;case 'leads':return <LeadsPage/>;case 'tasks':return <TasksPage/>;case 'inbox':return mode==='demo'?<InboxPage/>:<ConnectedInboxPage/>;case 'automations':return <AutomationsPage/>;case 'agents':return <AgentsPage/>;case 'campaigns':return <CampaignsPage/>;case 'products':return <ProductsPage/>;case 'reports':return <ReportsPage/>;case 'connections':return <ConnectionsPage/>;case 'integrations':return <IntegrationsPage/>;case 'settings':return <SettingsPage/>;default:return <HelpPage/>;}};
 return <CRMContext.Provider value={context}><div className={`app-shell sq-app ${sidebar?'':'sq-collapsed'}`}>
  <SquadSidebar collapsed={!sidebar} onCollapse={()=>setSidebar(!sidebar)} onSearch={()=>setSearchOpen(true)}/>
  <div className="main-frame"><main key={mode+reloadKey} className={`page-content page-${page}`}>{renderPage()}</main></div>
  {toast&&<div className={`toast ${toast.kind}`} role={toast.kind==='error'?'alert':'status'}>{toast.kind==='error'?<X size={17}/>:<Check size={17}/>}<span>{toast.text}</span><button aria-label="Dispensar" onClick={()=>setToast(null)}><X size={14}/></button></div>}
  {notifications&&<div className="notifications panel"><div className="flex-between"><strong>Seu dia de vendas</strong><button className="icon-btn" aria-label="Fechar notificações" onClick={()=>setNotifications(false)}><X size={16}/></button></div>{overdue.length?overdue.slice(0,5).map(e=><button key={e.id} onClick={()=>{navigate('tasks',e.id);setNotifications(false);}}><CalendarDays size={16}/><span>{e.data.title}<small>{e.data.dueDate}</small></span><ChevronRight size={14}/></button>):<p>Nenhuma atividade pendente por aqui.</p>}</div>}
  {searchOpen&&<Modal title="Buscar no workspace" onClose={()=>setSearchOpen(false)}><div className="command-search"><Search size={18}/><input autoFocus placeholder="Busque leads, negócios, atividades..." value={query} onChange={e=>setQuery(e.target.value)}/><kbd>ESC</kbd></div><div className="search-results">{query?matches.length?matches.map(e=><button key={e.id} onClick={()=>navigate(({lead:'leads',deal:'pipelines',task:'tasks',automation:'automations',product:'products'} as any)[e.type],e.id)}><Avatar name={e.data.name||e.data.title}/><span><strong>{e.data.name||e.data.title}</strong><small>{{lead:'Lead',deal:'Negócio',task:'Atividade',automation:'Automação',product:'Produto'}[e.type as 'lead']}</small></span><ChevronRight size={15}/></button>):<p>Nenhum resultado encontrado.</p>:navigation.slice(0,7).map(n=><button key={n.id} onClick={()=>navigate(n.id)}><n.icon size={18}/><span>{n.label}</span><ChevronRight size={15}/></button>)}</div></Modal>}
 </div></CRMContext.Provider>;
}
