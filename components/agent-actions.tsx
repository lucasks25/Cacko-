'use client';
import {useState,useRef,useEffect} from 'react';
import {ArrowRight,ArrowUpRight,Check,Copy,Plus,Sparkles,Trash2} from 'lucide-react';
import {useCRM} from './context';
import {Button,Modal,Field,ErrorText,Badge} from './ui';
import {AGENT_TOOLS,buildToolContext,prepareToolRecord} from '../lib/agent-tools';
import {contactRequest} from '../lib/contact-center';
import {proposalTotal} from '../lib/workspace';
import {currency,type CRMPage} from '../lib/types';
import './agent-actions.css';

export function AgentActions({agent,initialTool,asCard=false}:{agent:string;initialTool?:string;asCard?:boolean}){
 const [open,setOpen]=useState(false);
 const task=AGENT_TOOLS.find(t=>t.agent===agent&&t.id===initialTool);
 return <>{asCard&&task?<button className="aa-tool-launch" onClick={()=>setOpen(true)}><Sparkles size={18}/><strong>{task.name}</strong><p>{task.description}</p><span>Preparar tarefa<ArrowUpRight size={13}/></span></button>:<Button onClick={()=>setOpen(true)}><Sparkles size={15}/>Executar ferramenta</Button>}{open&&<ActionDialog agent={agent} initialTool={initialTool} onClose={()=>setOpen(false)}/>}</>;
}
function ActionDialog({agent,onClose,initialTool}:{agent:string;onClose:()=>void;initialTool?:string}){
 const {entities,mode,save,navigate,notify}=useCRM();
 const options=AGENT_TOOLS.filter(t=>t.agent===agent);
 const [tool,setTool]=useState(options.some(t=>t.id===initialTool)?initialTool!:options[0].id),[prompt,setPrompt]=useState(''),[selection,setSelection]=useState<any>({productIds:[],leadId:'',kind:'posts',sourceText:'',contractId:''}),[result,setResult]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const requestBusy=useRef(false),mounted=useRef(true),draftId=useRef('');
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const descriptor=options.find(t=>t.id===tool)!;const active=entities.filter(e=>!e.deleted);
 const products=active.filter(e=>e.type==='product'),members=active.filter(e=>e.type==='member'),contracts=active.filter(e=>e.type==='contract'),leads=active.filter(e=>e.type==='lead');
 const choose=(key:string,value:any)=>setSelection((s:any)=>({...s,[key]:value}));
 const change=(key:string,value:any)=>setResult((r:any)=>({...r,data:{...r.data,[key]:value}}));
 const generate=async()=>{
  if(requestBusy.current)return;requestBusy.current=true;setBusy(true);setError('');setResult(null);
  try{
   if(mode!=='live')throw new Error('Use seus dados e conecte a IA antes de gerar um rascunho.');
   const context=buildToolContext(tool,entities,{...selection,prompt:prompt.trim()||descriptor.example});
   const r=await contactRequest('agent-tool',{agent,tool,prompt:prompt.trim()||descriptor.example,context});
   if(r.tool!==tool)throw new Error('A resposta não corresponde à ferramenta solicitada.');
   if(r.type==='text'){if(typeof r.text!=='string'||!r.text.trim())throw new Error('O agente não retornou texto para revisão.');}
   else r.data=prepareToolRecord(tool,r.data,entities).data;
   if(mounted.current){draftId.current=crypto.randomUUID();setResult(r);}
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Não foi possível preparar o rascunho.');}finally{requestBusy.current=false;if(mounted.current)setBusy(false);}
 };
 const apply=async()=>{
  if(requestBusy.current||!result)return;requestBusy.current=true;setBusy(true);setError('');
  try{
   if(result.type==='text')await save('chatTurn',{agent,role:'assistant',text:result.text,tool,createdAt:new Date().toISOString()},draftId.current,0);
   else{const prepared=prepareToolRecord(tool,result.data,entities);await save(prepared.type,prepared.data,draftId.current,0);}
   notify(result.type==='text'?'Rascunho salvo no histórico do agente.':'Registro salvo após sua revisão.');
   onClose();if(result.type!=='text')navigate(descriptor.page as CRMPage,tool==='content'?result.data.kind:undefined);
  }catch(e){if(mounted.current)setError((e as Error).message);}finally{requestBusy.current=false;if(mounted.current)setBusy(false);}
 };
 const d=result?.data||{};
 return <Modal title={result?'Revise o resultado':'Executar ferramenta'} wide onClose={()=>{if(!requestBusy.current)onClose();}}><div className="aa-dialog">
  {!result?<><div className="aa-intro"><span><Sparkles size={23}/></span><div><h3>Do pedido ao registro</h3><p>O agente prepara. Você revisa e salva no módulo correspondente.</p></div></div>
   {mode==='demo'&&<div className="aa-pending"><Badge tone="orange">Demonstração</Badge><p>Para gerar resultados, use seus dados e conecte o motor de IA.</p><Button onClick={()=>{onClose();navigate('ai-center','setup');}}>Ativar minha IA<ArrowRight size={14}/></Button></div>}
   <fieldset disabled={busy}><Field label="Ferramenta"><select value={tool} onChange={e=>{setTool(e.target.value);setError('');setPrompt('');}}>{options.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></Field><p className="aa-description">{descriptor.description}</p>
    {tool==='proposal'&&<><Field label="Cliente"><select value={selection.leadId} onChange={e=>choose('leadId',e.target.value)}><option value="">Sem cliente vinculado</option>{leads.map(l=><option key={l.id} value={l.id}>{l.data.name}</option>)}</select></Field><Field label="Produtos do catálogo"><div className="aa-product-list">{products.length?products.map(p=><label key={p.id}><input type="checkbox" checked={selection.productIds.includes(p.id)} onChange={e=>choose('productIds',e.target.checked?[...selection.productIds,p.id]:selection.productIds.filter((id:string)=>id!==p.id))}/><span>{p.data.name}</span><strong>{currency(Number(p.data.price))}</strong></label>):<p>Cadastre os produtos e preços antes de gerar a proposta.</p>}</div></Field>{!products.length&&<Button onClick={()=>{onClose();navigate('products');}}>Abrir catálogo<ArrowUpRight size={14}/></Button>}</>}
    {tool==='content'&&<Field label="Formato"><select value={selection.kind} onChange={e=>choose('kind',e.target.value)}><option value="posts">Post</option><option value="blog">Artigo / blog</option><option value="ads">Rascunho de anúncio</option><option value="analysis">Análise de referências fornecidas</option></select></Field>}
    {tool==='contract'&&<Field label="Texto do contrato" required><textarea rows={9} maxLength={20000} value={selection.sourceText} onChange={e=>choose('sourceText',e.target.value)} placeholder="Cole o texto para extrair os dados e conferir os prazos."/></Field>}
    {tool==='renewal'&&<Field label="Contrato" required><select value={selection.contractId} onChange={e=>choose('contractId',e.target.value)}><option value="">Selecione</option>{contracts.map(c=><option value={c.id} key={c.id}>{c.data.name} · {c.data.counterparty}</option>)}</select></Field>}
    {tool==='shift'&&!members.length&&<p className="aa-description">Cadastre colaboradores em Configurações → Equipe para montar um turno.</p>}
    {tool==='wiki-answer'&&<div className="aa-source-state"><Badge>{active.filter(e=>e.type==='article'&&e.data.approved===true).length} artigos aprovados</Badge><p>A consulta seleciona as fontes aprovadas mais relevantes para a pergunta. Revise as fontes apresentadas na resposta.</p></div>}
    <Field label={tool==='wiki-answer'?'Sua pergunta':'O que o agente deve preparar?'}><textarea rows={4} maxLength={6000} value={prompt} placeholder={descriptor.example} onChange={e=>setPrompt(e.target.value)}/></Field>
   </fieldset><p className="aa-review-note">Gerar prepara um rascunho. Nenhum registro é salvo e nenhum cliente recebe mensagens nesta etapa.</p>
  </>:<><div className="aa-review-heading"><Badge tone="orange">Aguardando sua revisão</Badge><span>{descriptor.name}</span></div>
   <fieldset disabled={busy}>{result.type==='text'?<><Field label={tool==='wiki-answer'?'Resposta e fontes':'Rascunho do e-mail'}><textarea rows={12} value={result.text} onChange={e=>setResult({...result,text:e.target.value})}/></Field>{result.citations?.length>0&&<div className="aa-citations"><strong>Artigos utilizados</strong>{result.citations.map((id:string)=>{const a=active.find(e=>e.id===id&&e.type==='article');return <details key={id}><summary>{a?.data.name||id}</summary><p>{a?.data.text}</p></details>;})}</div>}</>:<>
    {tool!=='shift'&&<Field label="Nome" required><input maxLength={150} value={d.name||''} onChange={e=>change('name',e.target.value)}/></Field>}
    {tool==='proposal'&&<><div className="aa-items">{d.items?.map((item:any,i:number)=><div key={i}><span>{item.name}</span><input aria-label={'Quantidade do item '+(i+1)} type="number" min="0.01" step="0.01" value={item.quantity} onChange={e=>change('items',d.items.map((v:any,j:number)=>i===j?{...v,quantity:Number(e.target.value)}:v))}/><input aria-label={'Preço do item '+(i+1)} type="number" min="0" step="0.01" value={item.price} onChange={e=>change('items',d.items.map((v:any,j:number)=>i===j?{...v,price:Number(e.target.value)}:v))}/></div>)}</div><Field label="Desconto (%)"><input type="number" min="0" max="100" value={d.discount||0} onChange={e=>change('discount',Number(e.target.value))}/></Field><Field label="Observações"><textarea value={d.notes||''} onChange={e=>change('notes',e.target.value)}/></Field><p className="aa-total">Total: {(()=>{try{return currency(proposalTotal(d.items||[],d.discount||0));}catch{return 'Confira os itens';}})()}</p></>}
    {tool==='transaction'&&<><div className="form-grid two"><Field label="Tipo"><select value={d.direction} onChange={e=>change('direction',e.target.value)}><option value="in">Entrada</option><option value="out">Saída</option></select></Field><Field label="Valor (R$)"><input type="number" step="0.01" min="0.01" value={d.amount} onChange={e=>change('amount',Number(e.target.value))}/></Field><Field label="Vencimento"><input type="date" value={d.date} onChange={e=>change('date',e.target.value)}/></Field><Field label="Categoria"><input value={d.category||''} onChange={e=>change('category',e.target.value)}/></Field></div><Badge tone="orange">Pendente · sem movimentação de dinheiro</Badge></>}
    {tool==='contract'&&<><div className="form-grid two"><Field label="Contraparte"><input value={d.counterparty||''} onChange={e=>change('counterparty',e.target.value)}/></Field><Field label="Vencimento"><input type="date" value={d.expires||''} onChange={e=>change('expires',e.target.value)}/></Field><Field label="Valor (R$)"><input type="number" step="0.01" min="0" value={d.value||0} onChange={e=>change('value',Number(e.target.value))}/></Field><Field label="Multa extraída"><textarea value={d.penalty||''} onChange={e=>change('penalty',e.target.value)}/></Field></div><details><summary>Texto utilizado na extração</summary><p className="aa-source-text">{d.text}</p></details></>}
    {tool==='shift'&&<><Field label="Colaborador"><select value={d.memberId} onChange={e=>change('memberId',e.target.value)}>{members.map(m=><option key={m.id} value={m.id}>{m.data.name}</option>)}</select></Field><div className="form-grid two"><Field label="Data"><input type="date" value={d.date} onChange={e=>change('date',e.target.value)}/></Field><Field label="Equipe"><input value={d.team||''} onChange={e=>change('team',e.target.value)}/></Field><Field label="Entrada"><input type="time" value={d.start} onChange={e=>change('start',e.target.value)}/></Field><Field label="Saída"><input type="time" value={d.end} onChange={e=>change('end',e.target.value)}/></Field></div><p className="aa-review-note">Conflitos com turnos já cadastrados impedem salvar. Confira intervalos e regras de jornada aplicáveis à sua equipe.</p></>}
    {['content','article'].includes(tool)&&<><Field label="Conteúdo"><textarea rows={13} value={d.text||''} onChange={e=>change('text',e.target.value)}/></Field><Badge>{tool==='article'?'Artigo ainda não aprovado':'Rascunho · sem publicação externa'}</Badge></>}
   </>}</fieldset>
  </>}
  <ErrorText error={error}/><div className="aa-actions"><Button disabled={busy} onClick={onClose}>Cancelar</Button>{result?<><Button disabled={busy} onClick={()=>setResult(null)}>Refazer</Button><Button variant="primary" loading={busy} onClick={()=>void apply()}><Check size={15}/>{result.type==='text'?'Salvar no histórico':'Aprovar e salvar'}</Button></>:<Button variant="primary" disabled={mode==='demo'} loading={busy} onClick={()=>void generate()}><Sparkles size={15}/>Gerar rascunho</Button>}</div>
 </div></Modal>;
}
