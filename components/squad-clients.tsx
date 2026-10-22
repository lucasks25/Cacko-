'use client';
import {useState,useEffect,useRef} from 'react';
import {Plus,Search,MoreHorizontal,MessageSquare,Sparkles,Pencil,Archive,Phone,Mail} from 'lucide-react';
import {useCRM} from './context';
import {Avatar,Badge,Button,Empty,ErrorText,Modal,PageHeader} from './ui';
import {LeadForm} from './contacts';
import {contactRequest} from '../lib/contact-center';
import type {Entity} from '../lib/types';
import './squad-reference-pages.css';
export function SquadClientsPage(){
 const {entities,focusId,navigate}=useCRM();const [query,setQuery]=useState(''),[selected,setSelected]=useState<string|null>(null),[editing,setEditing]=useState<Entity|'new'|null>(null);
 const clients=entities.filter(e=>e.type==='lead'&&!e.deleted);const list=clients.filter(e=>`${e.data.name} ${e.data.email||''} ${e.data.phone||''}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>String(a.data.name).localeCompare(String(b.data.name)));
 useEffect(()=>{if(focusId)setSelected(focusId);},[focusId]);const lead=clients.find(e=>e.id===selected);
 return <div className="sq-workspace sr-clients"><PageHeader title="Clientes" actions={<><button className="sq-round-btn" aria-label="Gerenciar base de clientes" onClick={()=>navigate('contacts-admin')}><MoreHorizontal size={18}/></button><Button variant="primary" aria-label="Novo cliente" onClick={()=>setEditing('new')}><Plus size={19}/></Button></>}/><div className="sq-search"><Search size={17}/><input aria-label="Pesquisar um cliente" placeholder="Pesquisar um cliente" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="sr-clients-table"><div className="sr-clients-head"><span>Nome do Cliente</span><span>Telefone</span><span>E-mail</span><span>Origem</span></div>{list.map(c=><button key={c.id} onClick={()=>setSelected(c.id)}><span><Avatar name={c.data.name} size={42}/><strong>{c.data.name}</strong></span><span>{c.data.phone||'—'}</span><span>{c.data.email||'—'}</span><span>{c.data.source||'—'}</span></button>)}</div>{!list.length&&<Empty title="Nenhum cliente encontrado" description="Adicione um cliente ou ajuste a busca."/>}{lead&&!editing&&<ClientProfile key={lead.id} lead={lead} onClose={()=>setSelected(null)} onEdit={()=>setEditing(lead)}/>}{editing&&<LeadForm lead={editing==='new'?undefined:editing} onClose={()=>setEditing(null)} onSaved={id=>{setEditing(null);setSelected(id);}}/>}</div>;
}
function ClientProfile({lead,onClose,onEdit}:{lead:Entity;onClose:()=>void;onEdit:()=>void}){
 const {entities,mode,navigate,save,archive,notify}=useCRM();const [menu,setMenu]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const inFlight=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const conversations=entities.filter(e=>e.type==='conversation'&&!e.deleted&&e.data.leadId===lead.id);const remoteId=String(lead.data.chatwootContactConversationId||'');
 const summary=async()=>{if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');try{
  if(mode==='demo')throw new Error('Use seus dados e conecte a IA para gerar um resumo real.');
  let text='';if(remoteId){const r=await contactRequest('assist',{conversationId:remoteId,task:'summary'});text=r.text;}else{
   const history=entities.filter(e=>e.type==='message'&&!e.deleted&&conversations.some(c=>c.id===e.data.conversationId)).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)).slice(-25).map(e=>e.data.text).join('\n').slice(-5000);
   if(!history)throw new Error('Vincule uma conversa com histórico antes de gerar o resumo.');
   const r=await contactRequest('chat',{agent:'waz',messages:[{role:'user',content:'Resuma somente este histórico de atendimento: necessidade, decisões e próximo passo. Não invente informação.\n'+history}],context:{}});text=r.text;
  }
  if(typeof text!=='string'||!text.trim())throw new Error('O agente não retornou um resumo.');
  await save('lead',{...lead.data,aiSummary:text,aiSummaryUpdatedAt:new Date().toISOString()},lead.id,lead.revision);notify('Resumo do cliente atualizado.');
 }catch(e){if(alive.current)setError((e as Error).message);}finally{inFlight.current=false;if(alive.current)setBusy(false);}};
 return <Modal title={lead.data.name} onClose={onClose}><div className="sr-client-profile"><button className="sr-profile-more" aria-label="Mais ações do cliente" onClick={()=>setMenu(!menu)}><MoreHorizontal size={20}/></button>{menu&&<div className="sr-client-menu"><button onClick={()=>navigate('contacts-admin',lead.id)}><MessageSquare size={13}/>Histórico completo</button><button onClick={onEdit}><Pencil size={13}/>Editar cadastro</button><button onClick={async()=>{try{await archive(lead);onClose();}catch(e){setError((e as Error).message);}}}><Archive size={13}/>Arquivar cliente</button></div>}<Avatar name={lead.data.name} size={86}/>{mode==='demo'&&<Badge>Demonstração</Badge>}<div className="sr-client-summary"><span>Resumo com IA</span><p>{lead.data.aiSummary||'Ainda não há resumo deste atendimento. Gere um resumo a partir de uma conversa vinculada.'}</p><Button variant="ghost" loading={busy} onClick={()=>void summary()}><Sparkles size={13}/>{lead.data.aiSummary?'Atualizar resumo':'Gerar resumo'}</Button></div><ErrorText error={error}/><div className="sr-client-interactions"><strong>Interações</strong><button onClick={()=>{if(mode==='demo'&&!conversations.length){notify('Este cliente ainda não tem uma conversa vinculada.','info');return;}navigate('inbox',mode==='demo'?conversations[0]?.id:remoteId||undefined);}}><MessageSquare size={16}/>Chat de Whatsapp</button></div></div></Modal>;
}
