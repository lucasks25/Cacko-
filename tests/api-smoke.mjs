import assert from 'node:assert/strict';
const base=process.env.CRM_TEST_URL||'http://127.0.0.1:5173';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))throw new Error('O teste só aceita o servidor local.');
const anon=await fetch(base+'/api/crm');assert.equal(anon.status,401);console.log('PASS: anonymous API rejected');
const signin=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});const cookie=signin.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');assert.ok(cookie);
const call=async(payload,headers={})=>{const res=await fetch(base+'/api/crm',{method:payload?'POST':'GET',headers:{Cookie:cookie,...(payload?{'Content-Type':'application/json',Origin:base}:{}),...headers},body:payload?JSON.stringify(payload):undefined});const text=await res.text();let data;try{data=JSON.parse(text);}catch{data={error:text};}return{status:res.status,data};};
const prefix='qa-'+Date.now();const created=[];
async function create(type,data){const r=await call({type,data,id:prefix+'-'+created.length,revision:0});assert.equal(r.status,200,JSON.stringify(r.data));created.push(r.data.entity);return r.data.entity;}
const p=await create('pipeline',{name:'QA pipeline',stages:[{id:'qa-s1',name:'Entrada',color:'#4770f6'},{id:'qa-s2',name:'Proposta',color:'#ab64d9'}]});
const flow=await create('automation',{name:'QA fluxo',active:true,trigger:'lead.created',actions:[{type:'task',title:'QA: primeiro contato'}]});
const lead=await create('lead',{name:'QA contato',email:prefix+'@example.com',phone:'11900009999',createdAt:new Date().toISOString()});
let r=await call();assert.ok(r.data.entities.some(e=>e.type==='task'&&e.data.leadId===lead.id&&e.data.title==='QA: primeiro contato'));console.log('PASS: lead creation triggers persisted task');
const deal=await create('deal',{name:'QA negócio',value:1500,leadId:lead.id,pipelineId:p.id,stageId:'qa-s1',status:'open'});
r=await call({type:'deal',id:deal.id,data:{...deal.data,stageId:'qa-s2'},revision:deal.revision});assert.equal(r.status,200);let updated=r.data.entity;console.log('PASS: deal move persisted');
r=await call({type:'deal',id:deal.id,data:{...deal.data,value:999},revision:deal.revision});assert.equal(r.status,409);console.log('PASS: stale revision rejected');
r=await call({type:'deal',data:{...deal.data,leadId:'foreign-owner-id'},revision:0});assert.equal(r.status,400);console.log('PASS: inaccessible reference rejected');
r=await call({type:'connection',data:{name:'Fake connected',status:'connected'},revision:0});assert.equal(r.status,400);
r=await call({type:'message',data:{text:'Fake delivery',conversationId:'x',direction:'out',status:'sent'},revision:0});assert.equal(r.status,400);console.log('PASS: fabricated connection and outbound delivery rejected');
r=await call({type:'lead',data:{name:'Blocked'},revision:0},{Origin:'https://untrusted.example'});assert.equal(r.status,403);console.log('PASS: cross-origin write rejected');
r=await call({action:'archive',type:'deal',id:updated.id,data:updated.data,revision:updated.revision});assert.equal(r.status,200);assert.equal(r.data.entity.deleted,true);updated=r.data.entity;
r=await call({action:'restore',type:'deal',id:updated.id,data:updated.data,revision:updated.revision});assert.equal(r.status,200);assert.equal(r.data.entity.deleted,false);console.log('PASS: recoverable archive and restore');
const forged=await fetch(base+'/api/crm',{headers:{'oai-authenticated-user-id':'foreign','oai-authenticated-user-email':'foreign@example.com'}});assert.equal(forged.status,401);console.log('PASS: anonymous identity spoof rejected by local adapter');
const final=await call();for(const e of final.data.entities.filter(e=>e.id.startsWith(prefix)||(e.type==='task'&&e.data.leadId===lead.id)||(e.type==='activity'&&e.data.leadId===lead.id))){if(!e.deleted){const out=await call({action:'archive',type:e.type,id:e.id,data:e.data,revision:e.revision});assert.equal(out.status,200);}}
console.log('PASS: temporary QA records archived; all API smoke checks passed');
