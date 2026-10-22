const iso=(d:Date)=>d.toISOString().slice(0,10);
export function contractDecisionDate(data:Record<string,any>):string{
 if(data.decisionDate)return String(data.decisionDate);if(!data.expires||!Number.isFinite(Number(data.noticeDays)))return '';
 const d=new Date(data.expires+'T12:00:00Z');if(!Number.isFinite(d.getTime()))return '';d.setUTCDate(d.getUTCDate()-Number(data.noticeDays));return iso(d);
}
export function contractMatches(data:Record<string,any>,filter:string,today:string,alertDays=30):boolean{
 if(filter==='all')return true;if(filter==='signed')return data.status==='signed';if(filter==='awaiting')return ['awaiting','pending'].includes(data.status);
 const expires=Date.parse(data.expires||'');const days=(expires-Date.parse(today))/86400000;
 if(filter==='expiring')return Number.isFinite(days)&&days>=0&&days<=alertDays;
 if(filter==='attention')return data.requiresAttention===true||(Number.isFinite(days)&&days<0);
 return data.status===filter;
}
export function adTotals(rows:Record<string,any>[],period?:string){
 const withData=rows.filter(r=>r.metrics&&(!period||r.metrics.period===period)&&['spend','returns','results'].every(k=>Number.isFinite(r.metrics[k])&&r.metrics[k]>=0));
 return {hasData:withData.length>0,spend:withData.reduce((n,r)=>n+r.metrics.spend,0),returns:withData.reduce((n,r)=>n+r.metrics.returns,0),results:withData.reduce((n,r)=>n+r.metrics.results,0)};
}
export function monthDays(anchor:string){
 const d=new Date(anchor+'T12:00:00Z');d.setUTCDate(1);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
 const last=new Date(anchor+'T12:00:00Z');last.setUTCMonth(last.getUTCMonth()+1,0);last.setUTCDate(last.getUTCDate()+(7-last.getUTCDay())%7);
 const rows:string[]=[];while(d<=last){rows.push(iso(d));d.setUTCDate(d.getUTCDate()+1);}return rows;
}

export function uncoveredDays(days:string[],shifts:Record<string,any>[],anchor:string,period:string){return days.filter(d=>(period==='week'||d.slice(0,7)===anchor.slice(0,7))&&!shifts.some(s=>s.date===d));}
export function pipelineCycleDays(rows:Record<string,any>[]){const values=rows.filter(r=>r.status==='won'&&r.closedAt&&r.createdAt).map(r=>(Date.parse(r.closedAt)-Date.parse(r.createdAt))/86400000).filter(v=>Number.isFinite(v)&&v>=0);return values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):null;}
