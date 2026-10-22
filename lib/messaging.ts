import {normalizeDialNumber} from './contact-center.ts';

type RecordWithId={id:string;[key:string]:any};
export function createRequestGate(){let sequence=0;return {invalidate(){sequence++;},begin(){const request=++sequence;return ()=>request===sequence;}};}
export async function loadMessageWindow(fetcher:(params:Record<string,string>)=>Promise<any>,known:RecordWithId[],initialized:boolean):Promise<{updates:RecordWithId[];history?:{oldestId:string|null;hasMore:boolean}}>{
 if(!initialized){const r=await fetcher({});return {updates:r.messages,history:{oldestId:r.oldestId,hasMore:r.hasMore}};}
 const newest=known[known.length-1]?.id;
 const [newMessages,recent]=await Promise.all([newest?fetcher({after:newest}):Promise.resolve({messages:[]}),fetcher({})]);
 return {updates:mergeMessages(newMessages.messages,recent.messages)};
}
export function mergeMessages<T extends RecordWithId>(existing:T[],incoming:T[]):T[]{
 const unique=new Map(existing.map(m=>[m.id,m]));for(const m of incoming)unique.set(m.id,m);
 return [...unique.values()].sort((a,b)=>Number(a.id)-Number(b.id));
}
export function mergeConversations<T extends RecordWithId>(existing:T[],incoming:T[]):T[]{
 const next=new Set(incoming.map(c=>c.id));return [...incoming,...existing.filter(c=>!next.has(c.id))];
}
export function mergeConversationPage<T extends RecordWithId>(existing:T[],incoming:T[],previousFirstPage:string[],status:string):T[]{
 const first=new Set(previousFirstPage);return mergeConversations(existing.filter(c=>status==='all'||(!first.has(c.id)&&c.status===status)),incoming);
}
const positive=(value:unknown,max=2147483647)=>{const s=String(value);if(!/^[1-9]\d{0,14}$/.test(s)||Number(s)>max)throw new Error('Identificador ou página inválida.');return Number(s);};
export function messagingQuery(op:string,params:Record<string,string>={}):string{
 const query=new URLSearchParams();let path='';
 if(op==='inboxes')return '/inboxes';
 if(op.startsWith('conversation:'))return '/conversations/'+positive(op.slice(13));
 if(op==='conversations'){
  path='/conversations';query.set('page',String(positive(params.page||'1',10000)));
  const status=params.status||'all';if(!['all','pending','open','resolved'].includes(status))throw new Error('Filtro inválido.');query.set('status',status);
 }else if(op==='contacts'){
  path='/contacts';if(params.q)query.set('q',params.q.slice(0,100));query.set('page',String(positive(params.page||'1',10000)));
 }else if(op.startsWith('messages:')){
  path='/conversations/'+positive(op.slice(9))+'/messages';
  if(params.before&&params.after)throw new Error('Use apenas um cursor de histórico.');
  if(params.before)query.set('before',String(positive(params.before)));if(params.after)query.set('after',String(positive(params.after)));
 }else throw new Error('Operação inválida.');
 return path+(query.size?'?'+query:'');
}
export function validateNewContact(input:any){
 const name=typeof input?.name==='string'?input.name.trim().slice(0,100):'';
 if(!name)throw new Error('Informe o nome do contato.');
 const phone=input.phone?normalizeDialNumber(input.phone):'';const email=typeof input.email==='string'?input.email.trim():'';
 if(email&&(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw new Error('Informe um e-mail válido.');
 if(!phone&&!email)throw new Error('Informe telefone ou e-mail para localizar o contato.');
 return {name,phone,email};
}
export function validateNewConversation(input:any){return {contactId:positive(input?.contactId),inboxId:positive(input?.inboxId)};}
