export function proposalTotal(items:{quantity:number;price:number}[],discount=0){
 if(!Number.isFinite(discount)||discount<0||discount>100)throw new Error('Desconto inválido.');
 const cents=items.reduce((sum,i)=>{if(!Number.isFinite(i.quantity)||i.quantity<=0)throw new Error('Quantidade inválida.');if(!Number.isFinite(i.price)||i.price<0)throw new Error('Preço inválido.');return sum+Math.round(i.quantity*i.price*100);},0);
 return Math.round(cents*(100-discount)/100)/100;
}
export function financeTotals(rows:Record<string,any>[]){
 const income=rows.filter(r=>r.direction==='in'&&r.status==='received').reduce((s,r)=>s+Number(r.amount||0),0);
 const expense=rows.filter(r=>r.direction==='out'&&r.status==='paid').reduce((s,r)=>s+Number(r.amount||0),0);
 return {income,expense,balance:income-expense,pending:rows.filter(r=>r.status==='pending').reduce((s,r)=>s+Number(r.amount||0),0)};
}
export function buildChatPayload(agent:string,history:{role:string;content:string}[],message:string,sourceContext:Record<string,any>={}){
 const context:Record<string,string>={};
 for(const key of ['name','company','website','segment','timezone','description'])if(typeof sourceContext[key]==='string')context[key]=sourceContext[key].slice(0,key==='description'?1500:300);
 const messages=[...history.filter(m=>['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-29).map(m=>({role:m.role,content:m.content.slice(0,6000)})),{role:'user',content:message}];
 const payload={agent,messages,context};
 while(messages.length>1&&JSON.stringify({op:'chat',...payload}).length>80000)messages.shift();
 if(JSON.stringify({op:'chat',...payload}).length>80000)throw new Error('Mensagem muito grande. Divida o conteúdo em partes menores.');
 return payload;
}
