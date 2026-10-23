import {AGENT_TOOLS,prepareToolRecord} from './agent-tools.ts';
import type {Entity,CRMContextValue} from './types.ts';
type Input={agent:string;tool:string;result:Record<string,any>;draftId:string;entities:Entity[];save:CRMContextValue['save']};
export async function saveAgentTaskResult({agent,tool,result,draftId,entities,save}:Input):Promise<{id:string;historySaved:boolean}>{
 const descriptor=AGENT_TOOLS.find(t=>t.agent===agent&&t.id===tool);
 if(!descriptor||result.tool!==tool)throw new Error('Esta ferramenta não pertence ao agente selecionado.');
 const history={agent,role:'assistant',tool,createdAt:new Date().toISOString()};
 if(['renewal','wiki-answer'].includes(tool)){
  if(result.type!=='text'||typeof result.text!=='string'||!result.text.trim())throw new Error('Resultado de texto inválido.');
  await save('chatTurn',{...history,text:result.text.slice(0,10000)},draftId,0);
  return {id:draftId,historySaved:true};
 }
 const prepared=prepareToolRecord(tool,result.data,entities);
 await save(prepared.type,prepared.data,draftId,0);
 const {text:sourceText,notes,...fields}=prepared.data;
 const full=`${descriptor.name} — resultado revisado e salvo.\n${prepared.data.name||''}\n\nDados revisados: ${JSON.stringify(fields)}\n\n${sourceText||notes||''}`;
 const text=full.length<=5900?full:full.slice(0,5650)+'\n[Resumo limitado. Consulte o registro salvo para conferir o conteúdo completo.]';
 try{
  await save('chatTurn',{...history,text,displayText:`${descriptor.name} — resultado revisado e salvo.\n${prepared.data.name||''}\n\n${String(sourceText||notes||'Os dados revisados estão disponíveis no registro salvo.').slice(0,2000)}`,recordId:draftId,recordType:prepared.type},draftId+'_history',0);
  return {id:draftId,historySaved:true};
 }catch{return {id:draftId,historySaved:false};}
}
