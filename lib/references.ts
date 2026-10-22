import type {Entity} from './types.ts';
export function validateReferences(type:string,data:Record<string,any>,rows:Entity[],existing?:Entity|null):void{
  for(const [ref,targetType] of [['leadId','lead'],['dealId','deal'],['conversationId','conversation'],['productId','product'],['owner','member']] as const){
    if(!data[ref])continue;const target=rows.find(e=>e.id===data[ref]&&e.type===targetType);
    if(!target||(target.deleted&&existing?.data[ref]!==data[ref]))throw new Error('Registro relacionado não encontrado: '+ref);
  }
  if(type==='deal'){
    const pipeline=rows.find(e=>e.id===data.pipelineId&&e.type==='pipeline');
    if(!pipeline||(pipeline.deleted&&existing?.data.pipelineId!==data.pipelineId)||!pipeline.data.stages.some((s:any)=>s.id===data.stageId))throw new Error('Etapa ou pipeline não encontrado.');
  }
  if(type==='pipeline'&&existing){const ids=data.stages.map((s:any)=>s.id);if(rows.some(e=>!e.deleted&&e.type==='deal'&&e.data.pipelineId===existing.id&&!ids.includes(e.data.stageId)))throw new Error('Mova os negócios antes de remover uma etapa utilizada.');}
  if(type==='automation')for(const action of data.actions||[]){if(action.type==='stage'&&!rows.some(e=>!e.deleted&&e.type==='pipeline'&&e.data.stages.some((s:any)=>s.id===action.stageId)))throw new Error('Etapa da automação não encontrada.');}
  if(type==='tag'&&existing&&existing.data.name!==data.name){const name=existing.data.name;if(rows.some(e=>!e.deleted&&(e.data.tags?.includes(name)||e.data.tag===name||e.data.actions?.some((a:any)=>a.type==='tag'&&a.tag===name))))throw new Error('Esta etiqueta está em uso. Crie uma nova etiqueta para preservar os vínculos existentes.');}
}
