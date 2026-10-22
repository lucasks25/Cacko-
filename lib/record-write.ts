export function recordMutation(record:{owner:string;id:string;type:string;data:Record<string,any>;revision:number;updatedAt:string;deleted:boolean},previousRevision:number|null):{sql:string;parameters:(string|number)[]}{
 const r=record;const update=previousRevision!==null;
 let sql=update?'UPDATE crm_records SET data=?,revision=?,updated_at=?,deleted=? WHERE owner=? AND id=? AND revision=?':'INSERT OR IGNORE INTO crm_records(owner,id,type,data,revision,updated_at,deleted) SELECT ?,?,?,?,?,?,?';
 const parameters:(string|number)[]=update?[JSON.stringify(r.data),r.revision,r.updatedAt,r.deleted?1:0,r.owner,r.id,previousRevision]:[r.owner,r.id,r.type,JSON.stringify(r.data),r.revision,r.updatedAt,r.deleted?1:0];
 if(r.type==='shift'&&!r.deleted){
  sql+=(update?' AND ':' WHERE ')+"NOT EXISTS (SELECT 1 FROM crm_records WHERE owner=? AND id<>? AND type='shift' AND deleted=0 AND json_extract(data,'$.memberId')=? AND json_extract(data,'$.date')=? AND json_extract(data,'$.start')<? AND json_extract(data,'$.end')>?)";
  parameters.push(r.owner,r.id,r.data.memberId,r.data.date,r.data.end,r.data.start);
 }
 return {sql,parameters};
}
