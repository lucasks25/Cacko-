import type {Entity} from './types.ts';

export const CALL_LABELS:Record<string,string>={starting:'Iniciando',cancelling:'Encerrando',queued:'Na fila',ringing:'Chamando',active:'Em ligação',completed:'Concluída',missed:'Não atendida',failed:'Falhou',cancelled:'Cancelada',manual:'Registro manual',handoff:'Solicitou humano'};
export const callLabel=(status:string)=>CALL_LABELS[status]||'Desconhecido';
export function normalizeDialNumber(value:string):string {
  if(typeof value!=='string'||!/^[+\d\s().-]+$/.test(value))throw new Error('Telefone inválido. Use o formato internacional, como +55 11 99999-1234.');
  const number=value.replace(/[\s().-]/g,'');
  if(!/^\+[1-9]\d{7,14}$/.test(number))throw new Error('Informe o telefone com código internacional, começando por +.');
  return number;
}
export function validateCallCommand(input:any):Record<string,any>{
  if(!input||typeof input!=='object')throw new Error('Comando inválido.');
  if(input.action==='start'){
    if(!['ai','human'].includes(input.kind))throw new Error('Selecione o tipo de chamada.');
    if(typeof input.requestId!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(input.requestId))throw new Error('Identificador de solicitação inválido.');
    return {action:'start',number:normalizeDialNumber(input.number),kind:input.kind,requestId:input.requestId,leadId:typeof input.leadId==='string'?input.leadId.slice(0,100):''};
  }
  if(input.action==='finish'||input.action==='classify'||input.action==='join'){
    if(typeof input.callId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(input.callId))throw new Error('Chamada inválida.');
    return {action:input.action,callId:input.callId,...(input.action==='classify'?{outcome:String(input.outcome||'').slice(0,80),notes:String(input.notes||'').slice(0,5000)}:{})};
  }
  if(input.action==='test')return{action:'test',requestId:crypto.randomUUID()};
  throw new Error('Comando de chamada inválido.');
}
export function callDuration(data:Record<string,any>):number{
  const start=Date.parse(data.startedAt||'');const end=Date.parse(data.endedAt||'');
  return Number.isFinite(start)&&Number.isFinite(end)?Math.max(0,Math.floor((end-start)/1000)):0;
}
export function contactMetrics(entities:Entity[]){
  const calls=entities.filter(e=>e.type==='call'&&!e.deleted);const completed=calls.filter(e=>e.data.status==='completed');
  const totalSeconds=completed.reduce((s,e)=>s+callDuration(e.data),0);
  return {total:calls.length,completed:completed.length,missed:calls.filter(e=>['missed','failed'].includes(e.data.status)).length,active:calls.filter(e=>['active','ringing','queued','starting','cancelling'].includes(e.data.status)).length,ai:calls.filter(e=>e.data.kind==='ai').length,totalSeconds,averageSeconds:completed.length?Math.round(totalSeconds/completed.length):0,answerRate:calls.length?Math.round(completed.length/calls.length*100):0};
}
export const durationLabel=(seconds:number)=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;

export async function contactRequest(op:string,data?:Record<string,any>){
  const response=await fetch('/api/contact-center'+(data?'':'?op='+encodeURIComponent(op)),{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify({op,...data}):undefined});
  const body=await response.json() as any;
  if(!response.ok)throw new Error(body.error||'Não foi possível acessar a central.');
  return body;
}
