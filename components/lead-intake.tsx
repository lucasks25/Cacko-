'use client';
import {useRef,useState} from 'react';
import {ArrowUpRight,Inbox,Sparkles} from 'lucide-react';
import {useCRM} from './context';
import {Badge,Button,ErrorText,Field,Modal} from './ui';
import {planIntake,type Inbound,type IntakePlan} from '../lib/lead-intake';
import {today} from '../lib/types';
import './agent-actions.css';

/** Aplica a entrada única em sequência (lead antes das referências). Reutilizado pelo simulador e pela caixa conectada. */
export function useLeadIntake(){
 const {entities,save}=useCRM();const latest=useRef(entities);latest.current=entities;
 return async(msg:Inbound):Promise<IntakePlan>=>{
  const plan=planIntake(latest.current,msg,{newId:()=>crypto.randomUUID(),today:today()});
  for(const w of plan.writes)await save(w.type,w.data,w.id,w.revision);
  return plan;
 };
}

const SAMPLES:Record<string,Omit<Inbound,'receivedAt'>>={
 WhatsApp:{channel:'Whatsapp',name:'Carla Mendes',phone:'(11) 97777-1234',text:'Oi! Quanto custa o plano para minha empresa? Preciso começar essa semana.'},
 Instagram:{channel:'Instagram',name:'Studio Bia',handle:'@studio.bia',text:'Vi o post de vocês, como funciona?'},
 Site:{channel:'WebWidget',name:'Rafael Costa',email:'rafael@empresa.com.br',text:'Gostaria de receber uma proposta para 10 usuários.'},
 Telefone:{channel:'Telefone',name:'Clínica Bem Estar',phone:'(21) 3333-4444',text:'Ligação perdida — retornar.'}
};

export function LeadIntakeButton(){
 const {entities,navigate}=useCRM();const intake=useLeadIntake();
 const [open,setOpen]=useState(false),[form,setForm]=useState<Omit<Inbound,'receivedAt'>>(SAMPLES.WhatsApp),[busy,setBusy]=useState(false),[error,setError]=useState(''),[plan,setPlan]=useState<IntakePlan|null>(null);
 const set=(key:string,value:string)=>setForm(f=>({...f,[key]:value}));
 const run=async()=>{setBusy(true);setError('');try{setPlan(await intake({...form,receivedAt:new Date().toISOString()}));}catch(e){setError(e instanceof Error?e.message:'Não foi possível registrar o lead.');}finally{setBusy(false);}};
 const owner=plan&&entities.find(e=>e.id===plan.owner)?.data.name;
 return <><Button onClick={()=>{setPlan(null);setOpen(true);}}><Inbox size={14}/>Simular lead recebido</Button>
  {open&&<Modal title="Simular mensagem recebida" onClose={()=>setOpen(false)}>
   {plan?<div className="aa-saved" role="status"><span><Sparkles size={22}/></span><h3>{plan.created?'Lead criado e organizado':'Contato já existia — atualizado sem duplicar'}</h3>
    <p>Responsável: <b>{owner||'sem equipe cadastrada'}</b> · Qualificação: <b>{plan.label} ({plan.score})</b>{plan.stageName&&<> · Funil: <b>{plan.stageName}</b></>}</p>
    <small>{plan.writes.some(w=>w.type==='task')?'Tarefa de resposta criada para hoje. ':'Já existe uma tarefa de resposta aberta. '}A mensagem ficou no histórico do cliente.</small>
    <div><Button onClick={()=>setPlan(null)}>Simular outra</Button><Button variant="primary" onClick={()=>{setOpen(false);navigate('pipelines',plan.dealId||undefined);}}>Ver no funil<ArrowUpRight size={14}/></Button></div></div>
   :<div className="aa-dialog"><div className="aa-pending"><Badge tone="orange">Modo de teste</Badge><p>Simula a chegada de uma mensagem. Quando os canais estiverem conectados, as mensagens reais seguem este mesmo caminho.</p></div>
    <fieldset disabled={busy}><Field label="Canal"><select value={Object.keys(SAMPLES).find(k=>SAMPLES[k].channel===form.channel)} onChange={e=>setForm(SAMPLES[e.target.value])}>{Object.keys(SAMPLES).map(k=><option key={k}>{k}</option>)}</select></Field>
     <div className="form-grid two"><Field label="Nome"><input value={form.name} onChange={e=>set('name',e.target.value)}/></Field>
      {form.channel==='Instagram'?<Field label="@ do Instagram"><input value={form.handle||''} onChange={e=>set('handle',e.target.value)}/></Field>:form.channel==='WebWidget'?<Field label="E-mail"><input value={form.email||''} onChange={e=>set('email',e.target.value)}/></Field>:<Field label="Telefone"><input value={form.phone||''} onChange={e=>set('phone',e.target.value)}/></Field>}</div>
     <Field label="Mensagem"><textarea rows={3} value={form.text||''} onChange={e=>set('text',e.target.value)}/></Field></fieldset>
    <div className="aa-actions"><Button disabled={busy} onClick={()=>setOpen(false)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={()=>void run()}><Inbox size={14}/>Receber mensagem</Button></div></div>}
   <ErrorText error={error}/>
  </Modal>}</>;
}

/** Formulário do site → mesma entrada única. A chave identifica a conta; o formulário não envia credenciais. */
export function SiteFormCard(){
 const {entities,save,mode,notify}=useCRM();const setting=entities.find(e=>e.type==='setting'&&!e.deleted&&e.data.key==='siteForm');
 const [busy,setBusy]=useState(false);const key=setting?.data.formKey as string|undefined;
 const generate=async()=>{setBusy(true);try{const formKey=Array.from(crypto.getRandomValues(new Uint8Array(18)),b=>b.toString(16).padStart(2,'0')).join('');await save('setting',{...(setting?.data||{}),key:'siteForm',formKey},setting?.id,setting?.revision);notify(key?'Nova chave gerada. Atualize o código no seu site.':'Formulário ativado.');}catch(e){notify(e instanceof Error?e.message:'Não foi possível gerar a chave.','error');}finally{setBusy(false);}};
 const endpoint=typeof window!=='undefined'?window.location.origin+'/api/crm/intake':'/api/crm/intake';
 const snippet=key?`<form id="fluxo-lead">\n  <input name="name" placeholder="Nome" required>\n  <input name="email" type="email" placeholder="E-mail">\n  <input name="phone" placeholder="WhatsApp">\n  <textarea name="message" placeholder="Como podemos ajudar?"></textarea>\n  <input name="website" style="display:none" tabindex="-1" autocomplete="off">\n  <button>Enviar</button>\n</form>\n<script>\ndocument.getElementById('fluxo-lead').addEventListener('submit',async e=>{e.preventDefault();\n const body=Object.fromEntries(new FormData(e.target));body.formKey='${key}';\n const r=await fetch('${endpoint}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});\n e.target.innerHTML=r.ok?'Recebemos sua mensagem!':'Não foi possível enviar. Tente novamente.';});\n</script>`:'';
 return <section className="aa-dialog" style={{border:'1px solid #eee',borderRadius:14,padding:22,margin:'0 0 28px'}}><h3 style={{fontSize:15,fontWeight:550,marginBottom:6}}>Formulário do site → CRM</h3>
  <p className="aa-description">Quem preencher o formulário vira lead automaticamente, com origem "Site", responsável, negócio no funil e tarefa de resposta.</p>
  {mode!=='live'?<div className="aa-pending"><Badge tone="orange">Modo de teste</Badge><p>Para gerar a chave do seu site, use seus dados. No teste, use “Simular lead recebido” no CRM com o canal Site.</p></div>
  :<>{key&&<Field label="Código para colar no site"><textarea readOnly rows={9} value={snippet} onFocus={e=>e.target.select()}/></Field>}
   <div className="aa-actions"><Button variant={key?undefined:'primary'} loading={busy} onClick={()=>void generate()}>{key?'Gerar nova chave':'Ativar formulário'}</Button>{key&&<Button onClick={()=>{void navigator.clipboard?.writeText(snippet);notify('Código copiado.');}}>Copiar código</Button>}</div>
   <p className="aa-review-note">O site precisa conseguir acessar este endereço. Com o acesso privado atual da publicação, o envio externo fica bloqueado até a URL de recepção ser liberada.</p></>}
 </section>;
}
