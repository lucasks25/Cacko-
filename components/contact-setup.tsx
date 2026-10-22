'use client';
import {useEffect,useState,useRef} from 'react';
import {ArrowUpRight,Check,ChevronDown,Download,Headphones,MessageSquare,Mic,Phone,RefreshCw,Sparkles,UserRound} from 'lucide-react';
import {useCRM} from './context';
import {Badge,Button,ErrorText} from './ui';
import {contactRequest} from '../lib/contact-center';
import './contact-setup.css';

export function ContactSetup(){
 const {mode,startLive,loading,navigate}=useCRM();
 const [state,setState]=useState<any>(null),[checking,setChecking]=useState(false),[error,setError]=useState(''),[expanded,setExpanded]=useState('messages');
 const alive=useRef(true);
 const verify=async()=>{
  if(mode==='demo')return;setChecking(true);setError('');
  try{const r=await contactRequest('status');if(alive.current)setState(r);}catch(e){if(alive.current){setState(null);setError(e instanceof Error?e.message:'Não foi possível verificar a central.');}}finally{if(alive.current)setChecking(false);}
 };
 useEffect(()=>{alive.current=true;setState(null);setError('');if(mode==='live')void verify();return()=>{alive.current=false;};},[mode]);
 const steps=[
  {id:'messages',title:'Conectar as mensagens',subtitle:'Chatwoot reúne seus canais e o histórico de cada cliente.',icon:MessageSquare,status:state?.chatwootOnline?'Conectado':state?.chatwootConfigured?'Verificar conexão':'Pendente',done:Boolean(state?.chatwootOnline),body:'Crie sua conta no Chatwoot ou instale a edição Community no seu servidor. Depois conecte o WhatsApp, e-mail ou outro canal e vincule essa conta ao CRM.',url:'https://developers.chatwoot.com/self-hosted/deployment/docker',label:'Guia oficial do Chatwoot'},
  {id:'text',title:'Preparar a IA de atendimento',subtitle:'Respostas sugeridas, resumos e atendimento automático.',icon:Sparkles,status:state?.textConfigured?'Configurado':'Pendente',done:false,body:'Configure um motor de texto no servidor. Em seguida, preencha as instruções e o conhecimento da empresa na aba O assistente. Teste as sugestões antes de ativar respostas automáticas.',action:()=>navigate('assistant','waz'),label:'Abrir o agente de atendimento'},
  {id:'voice',title:'Ativar a voz da IA',subtitle:'Converse com o assistente pelo microfone do navegador.',icon:Mic,status:state?.voiceConfigured?'Configurado':'Pendente',done:false,body:'Crie um projeto LiveKit, configure as credenciais no servidor e inicie o worker de voz entregue com o CRM. Depois faça um teste no navegador para conferir áudio, português e transcrição.',url:'https://docs.livekit.io/agents/start/voice-ai/',label:'Guia oficial de voz'},
  {id:'phone',title:'Conectar um número de telefone',subtitle:'Chamadas para clientes pelo discador do CRM.',icon:Phone,status:state?.pstnEnabled?'Configurado':'Pendente',done:false,body:'Escolha um provedor de telefonia com número e tronco SIP compatíveis com sua região. Vincule o tronco ao LiveKit e habilite a conta no servidor. A contratação e os créditos do provedor são separados.',url:'https://docs.livekit.io/telephony/',label:'Guia oficial de telefonia'}
 ];
 return <div className="cs-setup">
  <div className="cs-heading"><div className="cs-icon"><Headphones size={24}/></div><div><span>COMECE POR AQUI</span><h2>Ative sua central de atendimento</h2><p>Você pode preparar uma etapa por vez. Cada conexão mostra seu estado real.</p></div></div>
  <div className="cs-workspace"><UserRound size={20}/><div><strong>{mode==='demo'?'Você está na demonstração':'Seu workspace está selecionado'}</strong><p>{mode==='demo'?'Use seus dados para verificar as conexões da sua conta.':'Os registros são salvos na sua conta. Os canais precisam ser conectados separadamente.'}</p></div>{mode==='demo'?<Button loading={loading} onClick={()=>void startLive().catch(()=>{})}>Usar meus dados</Button>:<Badge tone="green">Meus dados</Badge>}</div>
  <div className="cs-check-header"><strong>Conexões necessárias</strong><Button disabled={mode==='demo'} loading={checking} onClick={()=>void verify()}><RefreshCw size={14}/>Verificar conexões</Button></div>
  <ErrorText error={error}/>
  <div className="cs-steps">{steps.map((step,index)=><section key={step.id} className={expanded===step.id?'expanded':''}><button type="button" className="cs-step-title" aria-expanded={expanded===step.id} onClick={()=>setExpanded(expanded===step.id?'':step.id)}><span className={`cs-number ${step.done?'done':''}`}>{step.done?<Check size={16}/>:index+1}</span><step.icon size={20}/><span><strong>{step.title}</strong><small>{step.subtitle}</small></span><Badge tone={step.done?'green':step.status==='Configurado'?'blue':'neutral'}>{mode==='demo'?'Não verificado':step.status}</Badge><ChevronDown size={15}/></button>{expanded===step.id&&<div className="cs-step-body"><p>{step.body}</p>{step.url?<a href={step.url} target="_blank" rel="noreferrer">{step.label}<ArrowUpRight size={14}/></a>:<Button onClick={step.action}>{step.label}</Button>}</div>}</section>)}</div>
  <div className="cs-final"><div><strong>Configure, depois teste</strong><p>“Configurado” confirma os dados de conexão; a operação precisa de teste real. Nenhuma conta ou número foi contratado automaticamente.</p></div><Button onClick={()=>navigate('calls')}><Mic size={15}/>Abrir teste de voz</Button></div>
  <a className="cs-guide" href="/guia-atendimento.md" download><Download size={15}/>Baixar guia de ativação</a>
 </div>;
}
