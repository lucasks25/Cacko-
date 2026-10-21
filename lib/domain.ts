import { TYPES } from './types.ts';
import type { Entity } from './types.ts';

export function validateEntity(type: string, input: any): Record<string,any> {
  if (!(TYPES as readonly string[]).includes(type)) throw new Error('Tipo de registro inválido.');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Dados inválidos.');
  if((type==='deal'||type==='product')&&!Number.isFinite(Number(input.value??input.price??0)))throw new Error('Valor inválido.');
  if (JSON.stringify(input).length>100000) throw new Error('Registro muito grande.');
  const data=JSON.parse(JSON.stringify(input));
  for(const key of Object.keys(data)) if(/token|password|secret|apiKey/i.test(key)) throw new Error('Credenciais devem ser configuradas no servidor.');
  const named=['lead','deal','pipeline','automation','agent','campaign','product','connection','integration','member','tag','field','lossReason'];
  if(named.includes(type)) {
    if(typeof data.name!=='string'||!data.name.trim()) throw new Error('Informe o nome.');
    data.name=data.name.trim().slice(0,200);
  }
  if(type==='lead') {
    if(data.email){data.email=String(data.email).trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw new Error('E-mail inválido.');}
    if(data.phone)data.phone=String(data.phone).trim().slice(0,40);
  }
  if(type==='deal'||type==='product') {
    const value=Number(data.value??data.price??0);if(!Number.isFinite(value)||value<0)throw new Error('Valor inválido.');
    if(type==='deal') {data.value=value;if(!data.pipelineId||!data.stageId)throw new Error('Selecione pipeline e etapa.');if(!['open','won','lost'].includes(data.status??'open'))throw new Error('Status inválido.');data.status??='open';}
    else data.price=value;
  }
  if(type==='pipeline') {
    if(!Array.isArray(data.stages)||data.stages.length<1||data.stages.length>30)throw new Error('Adicione de 1 a 30 etapas.');
    const ids=new Set<string>();for(const s of data.stages){if(!s.id||typeof s.name!=='string'||!s.name.trim()||ids.has(s.id))throw new Error('Etapas inválidas.');ids.add(s.id);}
  }
  if(type==='task'&&(!data.title||!String(data.title).trim()))throw new Error('Informe o título da atividade.');
  if(type==='message'&&(!data.text||!data.conversationId))throw new Error('Informe a mensagem e a conversa.');
  if(type==='connection'&&data.status==='connected')throw new Error('Conexão real requer autenticação com o provedor.');
  if(type==='integration'&&data.status==='connected')throw new Error('Integração real requer autenticação com o provedor.');
  if(type==='message'&&data.direction==='out'&&!['draft','scheduled','note'].includes(data.status))throw new Error('Envio externo requer uma conexão autenticada.');
  if(type==='campaign'&&['sent','sending'].includes(data.status))throw new Error('Disparo requer uma conexão autenticada.');
  return data;
}
export function prepareWrite(input:{type:string;data:any;revision?:number;deleted?:boolean}, existing?:Entity|null) {
  if(existing && (existing.type!==input.type||existing.revision!==input.revision))throw new Error('Conflito de edição. Atualize a página e tente novamente.');
  if(!existing && input.revision && input.revision!==0)throw new Error('Conflito: registro não encontrado.');
  return {data:validateEntity(input.type,input.data),revision:(existing?.revision??0)+1};
}
export function parseCSV(input:string):Record<string,string>[] {
  const text=input.replace(/^\uFEFF/,'');const delimiter=text.split(/\r?\n/)[0].includes(';')?';':',';
  const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw new Error('CSV inválido: aspas não fechadas.');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
  if(rows.length<2)return[];const keys=rows.shift()!.map(x=>x.trim().toLowerCase());
  return rows.map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]?.trim()??''])));
}
export function exportCSV(rows:Record<string,any>[],keys:string[]):string {
  const escape=(v:any)=>{let s=String(v??'');if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
  return '\uFEFF'+[keys.map(escape).join(','),...rows.map(r=>keys.map(k=>escape(r[k])).join(','))].join('\r\n');
}
export function downloadCSV(filename:string,rows:Record<string,any>[],keys:string[]) {
  const blob=new Blob([exportCSV(rows,keys)],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function getMetrics(entities:Entity[]) {
  const rows=entities.filter(e=>!e.deleted);const deals=rows.filter(e=>e.type==='deal');const won=deals.filter(e=>e.data.status==='won');const lost=deals.filter(e=>e.data.status==='lost');const open=deals.filter(e=>e.data.status==='open');
  const sum=(es:Entity[])=>es.reduce((n,e)=>n+Number(e.data.value||0),0);
  return {leads:rows.filter(e=>e.type==='lead').length,deals:deals.length,revenue:sum(won),openValue:sum(open),lostValue:sum(lost),won:won.length,lost:lost.length,open:open.length,conversion:won.length+lost.length?won.length/(won.length+lost.length)*100:0,ticket:won.length?sum(won)/won.length:0,tasks:rows.filter(e=>e.type==='task'&&!e.data.done).length};
}
export function evaluateFlow(flow:any,event:string,record:Record<string,any>):{actions:any[];log:string[]} {
  const log:string[]=[];if(flow.trigger!==event)return{actions:[],log:['Gatilho não corresponde ao evento.']};log.push('Gatilho reconhecido: '+event);
  const c=flow.condition;if(c?.field){const val=record[c.field];const ok=c.operator==='gte'?Number(val)>=Number(c.value):c.operator==='contains'?String(val??'').toLowerCase().includes(String(c.value).toLowerCase()):String(val??'')===String(c.value);log.push(ok?'Condição atendida.':'Condição não atendida.');if(!ok)return{actions:[],log};}
  const actions=[];for(const a of flow.actions??[]){if(['task','stage','tag'].includes(a.type)){actions.push(a);log.push('Ação interna: '+a.type);}else log.push('Ação externa aguardando conexão autenticada: '+a.type);}
  return{actions,log};
}
