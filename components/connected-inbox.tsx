'use client';
import {useState,useEffect,useRef,useCallback} from 'react';
import {MessageSquare,Search,RefreshCw,Bot,Send,FileText,CheckCheck,Phone,Headphones,Sparkles,ArrowLeft,Plus,Users} from 'lucide-react';
import {useCRM} from './context';
import {Avatar,Badge,Button,Empty,ErrorText,PageHeader,Modal,Field} from './ui';
import {contactRequest} from '../lib/contact-center';
import {mergeConversations,mergeConversationPage,mergeMessages,validateNewContact,createRequestGate,loadMessageWindow} from '../lib/messaging';
import {ConnectionNotice} from './contact-center';
import './engagement.css';
import './connected-inbox.css';

type Row={id:string;[key:string]:any};
const errorText=(e:unknown)=>e instanceof Error?e.message:'Não foi possível concluir.';
export function ConnectedInboxPage(){
 const {notify,navigate,save,entities,focusId}=useCRM();
 const [conversations,setConversations]=useState<Row[]>([]),[current,setCurrent]=useState<Row|null>(null),[messages,setMessages]=useState<Row[]>([]);
 const [search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[text,setText]=useState(''),[note,setNote]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[suggestion,setSuggestion]=useState(''),[ready,setReady]=useState(false),[create,setCreate]=useState(false);
 const [page,setPage]=useState(1),[more,setMore]=useState(false),[paging,setPaging]=useState(false),[older,setOlder]=useState<string|null>(null),[hasOlder,setHasOlder]=useState(false),[loadingOlder,setLoadingOlder]=useState(false);
 const currentRef=useRef(current);currentRef.current=current;
 const messagesRef=useRef(messages);messagesRef.current=messages;
 const actionRef=useRef(false),listGeneration=useRef(0),messageGeneration=useRef(0),listBusy=useRef(false),historyBusy=useRef(false);
 const listGate=useRef(createRequestGate()),messageGate=useRef(createRequestGate()),historyInitialized=useRef(false);
 const firstPageIds=useRef<string[]>([]),focusGate=useRef(createRequestGate());const [linkLeadId,setLinkLeadId]=useState('');
 useEffect(()=>{if(!focusId||!/^\d+$/.test(focusId))return;let active=true;const isCurrent=focusGate.current.begin();contactRequest('conversation:'+focusId).then(r=>{if(active&&isCurrent()){setCurrent(r.conversation);setConversations(previous=>mergeConversations(previous,[r.conversation]));}}).catch(e=>{if(active)setError(errorText(e));});return()=>{active=false;};},[focusId]);
 const refreshMessages=useCallback(async(id:string,generation:number,initial=false)=>{
  const isCurrent=messageGate.current.begin();
  const r=await loadMessageWindow(params=>contactRequest('messages:'+id,undefined,params),messagesRef.current,historyInitialized.current);
  if(!isCurrent()||currentRef.current?.id!==id||messageGeneration.current!==generation)return;
  setMessages(previous=>mergeMessages(previous,r.updates));
  if(r.history){historyInitialized.current=true;setOlder(r.history.oldestId);setHasOlder(r.history.hasMore);}
 },[]);
 const refreshList=useCallback(async(generation:number)=>{
  const isCurrent=listGate.current.begin();
  const r=await contactRequest('conversations',undefined,{page:'1',status:filter});
  if(!isCurrent()||generation!==listGeneration.current)return;
  const oldFirst=firstPageIds.current;firstPageIds.current=r.conversations.map((c:Row)=>c.id);
  setConversations(previous=>mergeConversationPage(previous,r.conversations,oldFirst,filter));setReady(true);setError('');
  setCurrent(previous=>previous?(r.conversations.find((c:Row)=>c.id===previous.id)||previous):null);
  return r;
 },[filter]);
 useEffect(()=>{
  const generation=++listGeneration.current;firstPageIds.current=[];setConversations([]);setPage(1);setMore(false);setReady(false);listBusy.current=false;setPaging(false);
  const poll=async()=>{try{const r=await refreshList(generation);if(generation===listGeneration.current&&r)setMore(Boolean(r.hasMore));}catch(e){if(generation===listGeneration.current)setError(errorText(e));}};
  void poll();const t=setInterval(()=>void refreshList(generation).catch(e=>{if(generation===listGeneration.current)setError(errorText(e));}),12000);
  return()=>{listGeneration.current++;clearInterval(t);};
 },[refreshList]);
 useEffect(()=>{
  const generation=++messageGeneration.current;historyInitialized.current=false;setLinkLeadId('');setText('');setNote(false);setSuggestion('');setMessages([]);messagesRef.current=[];setOlder(null);setHasOlder(false);historyBusy.current=false;setLoadingOlder(false);
  const id=current?.id;if(!id)return;
  const load=(initial=false)=>refreshMessages(id,generation,initial).catch(e=>{if(generation===messageGeneration.current)setError(errorText(e));});
  void load(true);const t=setInterval(()=>void load(),6000);
  return()=>{messageGeneration.current++;clearInterval(t);};
 },[current?.id,refreshMessages]);
 const refresh=async()=>{try{await refreshList(listGeneration.current);const id=currentRef.current?.id;if(id)await refreshMessages(id,messageGeneration.current);}catch(e){setError(errorText(e));}};
 const loadMore=async()=>{
  if(listBusy.current)return;listBusy.current=true;setPaging(true);const generation=listGeneration.current;
  try{const r=await contactRequest('conversations',undefined,{page:String(page+1),status:filter});if(generation!==listGeneration.current)return;setConversations(previous=>mergeConversations(r.conversations,previous));setPage(page+1);setMore(r.hasMore);}catch(e){if(generation===listGeneration.current)setError(errorText(e));}finally{if(generation===listGeneration.current){listBusy.current=false;setPaging(false);}}
 };
 const loadOlder=async()=>{
  const id=current?.id;if(!id||!older||historyBusy.current)return;historyBusy.current=true;setLoadingOlder(true);const generation=messageGeneration.current;
  try{const r=await contactRequest('messages:'+id,undefined,{before:older});if(generation!==messageGeneration.current)return;setMessages(previous=>mergeMessages(r.messages,previous));setOlder(r.oldestId);setHasOlder(r.hasMore);}catch(e){if(generation===messageGeneration.current)setError(errorText(e));}finally{if(generation===messageGeneration.current){historyBusy.current=false;setLoadingOlder(false);}}
 };
 const action=async(fn:()=>Promise<void>)=>{
  if(actionRef.current)return;actionRef.current=true;setBusy(true);setError('');try{await fn();}catch(e){setError(errorText(e));}finally{actionRef.current=false;setBusy(false);}
 };
 const filtered=conversations.filter(c=>(filter==='all'||c.status===filter)&&`${c.name} ${c.phone}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="engagement-page cc-connected-inbox">
  <PageHeader title="Conversas" description="Suas mensagens e atendimentos em um só lugar." actions={<><Button onClick={()=>void refresh()}><RefreshCw size={15}/>Atualizar</Button><Button onClick={()=>navigate('ai-center','setup')}><Bot size={16}/>Ativar atendimento</Button><Button variant="primary" disabled={!ready} onClick={()=>setCreate(true)}><Plus size={16}/>Nova conversa</Button></>}/>
  {error&&!ready?<ConnectionNotice message={error}/>:null}
  <div className="inbox-shell">
   <section className={`conversation-list ${current?'has-selection':''}`}>
    <div className="conversation-tools"><div className="eng-search"><Search size={16}/><input placeholder="Buscar nas conversas carregadas" aria-label="Pesquisar uma conversa" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
    <div className="inbox-status-tabs">{[['all','Todas'],['pending','Aguardando'],['open','Em atendimento'],['resolved','Finalizadas']].map(([s,l])=><button key={s} className={filter===s?'active':''} onClick={()=>setFilter(s)}>{l}</button>)}</div>
    <div className="conversation-scroll">{filtered.length?filtered.map(c=><button className={`conversation-item ${current?.id===c.id?'selected':''}`} key={c.id} onClick={()=>{focusGate.current.invalidate();setCurrent(c);}}><Avatar name={c.name} size={42}/><div className="conversation-summary"><div><strong>{c.name}</strong>{c.unread>0&&<Badge tone="blue">{c.unread}</Badge>}</div><p>{c.lastMessage||'Conversa iniciada'}</p><div className="conversation-meta"><span>{c.channel||'Chatwoot'}</span><span>{c.assignee||'Sem atendente'}</span></div></div></button>):<Empty title={ready?'Nenhuma conversa':'Conecte seus canais'} description={ready?'As conversas dos canais conectados aparecerão aqui.':'Ative o atendimento para reunir seus canais nesta caixa.'} icon={<MessageSquare size={29}/>}/>} {more&&<div className="ci-load-more"><Button loading={paging} onClick={()=>void loadMore()}>Carregar mais conversas</Button></div>}</div>
    <div className="inbox-connection-state"><span/>{ready?`${conversations.length} conversas carregadas`:'Aguardando conexão'}</div>
   </section>
   <section className={`chat-column ${current?'selected':''}`}>
    {current?<>
     <div className="chat-heading"><button aria-label="Voltar às conversas" className="icon-btn mobile-chat-back" onClick={()=>{focusGate.current.invalidate();setCurrent(null);}}><ArrowLeft size={18}/></button><Avatar name={current.name} size={38}/><div className="chat-person"><strong>{current.name}</strong><span>{current.channel} · {current.phone}</span></div><div className="chat-heading-actions"><Button disabled={busy} onClick={()=>void action(async()=>{const id=current.id;const status=current.status==='resolved'?'open':'resolved';await contactRequest('conversation-status',{conversationId:id,status});setCurrent(c=>c?.id===id?{...c,status}:c);setConversations(rows=>rows.map(c=>c.id===id?{...c,status}:c));await refresh();})}><CheckCheck size={15}/>{current.status==='resolved'?'Reabrir':'Finalizar'}</Button></div></div>
     <div className="chat-assignment"><Headphones size={14}/><span>{current.assignee||'Sem atendente atribuído'}</span>{current.status==='pending'&&<Button disabled={busy} onClick={()=>void action(async()=>{const id=current.id;await contactRequest('conversation-status',{conversationId:id,status:'open'});setCurrent(c=>c?.id===id?{...c,status:'open'}:c);setConversations(rows=>rows.map(c=>c.id===id?{...c,status:'open'}:c));await refresh();notify('Atendimento assumido. A IA não enviará novas respostas automáticas.');})}>Assumir atendimento</Button>}</div>
     <div className="chat-messages">{hasOlder&&<div className="ci-load-more"><Button loading={loadingOlder} onClick={()=>void loadOlder()}>Carregar mensagens anteriores</Button></div>}{messages.map(m=><div key={m.id} className={`message-row ${m.direction==='out'?'outgoing':'incoming'} ${m.status==='note'?'internal-note':''}`}><div className="message-bubble">{m.status==='note'&&<div className="message-label"><FileText size={12}/>Nota interna</div>}<p>{m.text}</p>{m.attachments?.length>0&&<small>{m.attachments.length} anexo(s) disponível(is) no Chatwoot</small>}<div className="message-footer"><span>{m.createdAt?new Date(m.createdAt).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):''}</span><span>{m.direction==='out'?m.status:''}</span></div></div></div>)}</div>
     {suggestion&&<div className="cc-message-ai"><p>{suggestion}</p><Button onClick={()=>{setText(suggestion);setSuggestion('');}}>Usar no editor</Button><Button variant="ghost" onClick={()=>setSuggestion('')}>Dispensar</Button></div>}
     <form className="composer-area" onSubmit={e=>{e.preventDefault();if(!text.trim())return;void action(async()=>{const id=current.id;await contactRequest('message',{conversationId:id,text,private:note});if(currentRef.current?.id===id)setText('');await refresh();notify(note?'Nota registrada no Chatwoot.':'Mensagem aceita pelo Chatwoot.');});}}>
      <ErrorText error={error}/><div className="composer-tabs"><button type="button" className={!note?'active':''} onClick={()=>setNote(false)}><MessageSquare size={14}/>Mensagem</button><button type="button" className={note?'active note-tab':''} onClick={()=>setNote(true)}><FileText size={14}/>Nota interna</button><span>{note?'Somente sua equipe':'Envio pelo canal conectado'}</span></div>
      <textarea disabled={busy} maxLength={10000} aria-label="Escrever mensagem" placeholder={note?'Escreva uma nota para a equipe...':'Escreva sua mensagem...'} value={text} onChange={e=>setText(e.target.value)} rows={3}/>
      <div className="composer-bottom"><div className="cc-remote-head"><Button type="button" variant="ghost" disabled={busy} onClick={()=>void action(async()=>{const id=current.id;const r=await contactRequest('assist',{conversationId:id,task:'reply'});if(currentRef.current?.id===id)setSuggestion(r.text);})}><Sparkles size={14}/>Sugerir resposta</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>void action(async()=>{const id=current.id;const r=await contactRequest('assist',{conversationId:id,task:'summary'});if(currentRef.current?.id===id)setSuggestion(r.text);})}>Resumir</Button></div><Button type="submit" variant="primary" disabled={!text.trim()} loading={busy}><Send size={14}/>{note?'Adicionar nota':'Enviar mensagem'}</Button></div>
     </form>
    </>:<><ErrorText error={ready?error:''}/><Empty title="Conversas" description="Selecione uma conversa ou inicie um novo atendimento." icon={<MessageSquare size={45}/>}/></>}
   </section>
   {current&&<aside className="contact-panel cc-remote-sidebar"><Avatar name={current.name} size={66}/><h3>{current.name}</h3><p>{current.phone||'Sem telefone informado'}</p><Badge tone={current.status==='resolved'?'green':'blue'}>{current.status==='pending'?'Aguardando':current.status==='open'?'Em atendimento':'Finalizado'}</Badge><Button disabled={!current.phone||busy} onClick={()=>void action(async()=>{const existing=entities.find(e=>e.type==='lead'&&!e.deleted&&e.data.phone===current.phone);const lead=existing?await save('lead',{...existing.data,chatwootContactConversationId:current.id},existing.id,existing.revision):await save('lead',{name:current.name,phone:current.phone,source:'Chatwoot',tags:[],owner:'',chatwootContactConversationId:current.id});navigate('calls',lead.id);})}><Phone size={15}/>Ligar para contato</Button><Button onClick={()=>navigate('leads')}><Users size={15}/>Abrir clientes</Button><div className="ci-link-client"><Field label="Vincular cliente do CRM"><select value={linkLeadId} onChange={e=>setLinkLeadId(e.target.value)}><option value="">Selecione um cliente</option>{entities.filter(e=>e.type==='lead'&&!e.deleted).map(l=><option key={l.id} value={l.id}>{l.data.name}</option>)}</select></Field><Button disabled={!linkLeadId||busy} onClick={()=>void action(async()=>{const lead=entities.find(e=>e.type==='lead'&&!e.deleted&&e.id===linkLeadId);if(!lead)throw new Error('Cliente não encontrado.');await save('lead',{...lead.data,chatwootContactConversationId:current.id},lead.id,lead.revision);notify('Conversa vinculada ao cliente. Resumo e histórico disponíveis no perfil.');})}>Vincular conversa</Button></div></aside>}
  </div>
  {create&&<NewConversation onClose={()=>setCreate(false)} onCreated={c=>{focusGate.current.invalidate();setConversations(previous=>mergeConversations(previous,[c]));setCurrent(c);setCreate(false);setFilter('all');notify('Conversa criada. Escreva a primeira mensagem no editor.');}}/>}
 </div>;
}

function NewConversation({onClose,onCreated}:{onClose:()=>void;onCreated:(conversation:Row)=>void}){
 const [inboxes,setInboxes]=useState<any[]>([]),[contacts,setContacts]=useState<Row[]>([]),[query,setQuery]=useState(''),[selected,setSelected]=useState<Row|null>(null),[inbox,setInbox]=useState(''),[isNew,setIsNew]=useState(false),[form,setForm]=useState({name:'',phone:'',email:''}),[page,setPage]=useState(1),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const saving=useRef(false),mounted=useRef(true),searchGeneration=useRef(0);
 useEffect(()=>{mounted.current=true;contactRequest('inboxes').then(r=>{if(mounted.current)setInboxes(r.inboxes);}).catch(e=>{if(mounted.current)setError(errorText(e));});return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  const generation=++searchGeneration.current;setLoading(true);setPage(1);setContacts([]);setMore(false);
  const timer=setTimeout(()=>{contactRequest('contacts',undefined,{q:query,page:'1'}).then(r=>{if(generation===searchGeneration.current){setContacts(r.contacts);setMore(r.hasMore);}}).catch(e=>{if(generation===searchGeneration.current)setError(errorText(e));}).finally(()=>{if(generation===searchGeneration.current)setLoading(false);});},250);
  return()=>{searchGeneration.current++;clearTimeout(timer);};
 },[query]);
 const moreContacts=async()=>{if(loading)return;setLoading(true);const generation=searchGeneration.current;try{const r=await contactRequest('contacts',undefined,{q:query,page:String(page+1)});if(generation!==searchGeneration.current)return;setContacts(previous=>mergeConversations(r.contacts,previous));setPage(page+1);setMore(r.hasMore);}catch(e){if(generation===searchGeneration.current)setError(errorText(e));}finally{if(generation===searchGeneration.current)setLoading(false);}};
 const submit=async()=>{
  if(saving.current)return;saving.current=true;setBusy(true);setError('');
  try{
   let contact=selected;
   if(isNew&&!contact){const r=await contactRequest('create-contact',validateNewContact(form));contact=r.contact;setSelected(contact);setIsNew(false);}
   if(!contact||!inbox)throw new Error('Selecione o contato e o canal.');
   const r=await contactRequest('create-conversation',{contactId:contact.id,inboxId:inbox});if(mounted.current)onCreated(r.conversation);
  }catch(e){if(mounted.current)setError(errorText(e)+' Se houve falha de conexão, atualize a lista antes de tentar novamente.');}finally{saving.current=false;if(mounted.current)setBusy(false);}
 };
 return <Modal title="Nova conversa" onClose={()=>{if(!saving.current)onClose();}}><form className="ci-new-form" onSubmit={e=>{e.preventDefault();void submit();}}>
  <p>Escolha o contato e o canal. A primeira mensagem será enviada apenas pelo editor do atendimento.</p>
  <fieldset disabled={busy}>
   <div className="ci-contact-tabs"><Button type="button" variant={!isNew?'primary':'secondary'} onClick={()=>setIsNew(false)}>Contato existente</Button><Button type="button" variant={isNew?'primary':'secondary'} onClick={()=>{setIsNew(true);setSelected(null);}}>Novo contato</Button></div>
   {isNew?<div className="ci-contact-fields"><Field label="Nome" required><input required maxLength={100} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field><Field label="Telefone internacional"><input placeholder="+55 11 99999-1234" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></Field><Field label="E-mail"><input type="email" maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field><small>Informe telefone ou e-mail conforme o canal escolhido.</small></div>:<><Field label="Buscar contato"><input value={query} maxLength={100} placeholder="Nome, telefone ou e-mail" onChange={e=>setQuery(e.target.value)}/></Field>{selected&&<div className="ci-selected-contact"><CheckCheck size={17}/><span>{selected.name} · {selected.phone||selected.email}</span></div>}<div className="ci-contact-results">{contacts.map(c=><button type="button" key={c.id} className={selected?.id===c.id?'selected':''} onClick={()=>setSelected(c)}><Avatar name={c.name} size={32}/><span><strong>{c.name}</strong><small>{c.phone||c.email||'Sem telefone ou e-mail'}</small></span></button>)}{!contacts.length&&!loading&&<p>Nenhum contato encontrado. Você pode cadastrar um novo.</p>}{loading&&<p>Buscando contatos...</p>}</div>{more&&<Button type="button" loading={loading} onClick={()=>void moreContacts()}>Mais contatos</Button>}</>}
   <Field label="Canal de atendimento" required><select required value={inbox} onChange={e=>setInbox(e.target.value)}><option value="">Selecione um canal conectado</option>{inboxes.map(i=><option key={i.id} value={i.id} disabled={!i.canStart}>{i.name} · {i.channel}{!i.canStart?' — aguarde o cliente iniciar':''}</option>)}</select></Field>
  </fieldset>
  <small>WhatsApp e outros canais aplicam suas próprias janelas e regras de envio. Criar a conversa não confirma a entrega de uma mensagem.</small><ErrorText error={error}/><div className="ci-modal-actions"><Button type="button" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" variant="primary" disabled={!inbox||(!isNew&&!selected)} loading={busy}>Abrir atendimento</Button></div>
 </form></Modal>;
}
