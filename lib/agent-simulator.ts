/** Rascunhos simulados para o modo de teste: interpretam o pedido localmente, sem IA e sem custo. Mesmo formato da resposta do serviço. */
type Result={tool:string;type:string;data?:Record<string,any>;text?:string;citations?:string[];simulated:true;sent:false;requiresReview:true};
const norm=(s:unknown)=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const iso=(d:Date)=>d.toISOString().slice(0,10);
const two=(n:number)=>String(n).padStart(2,'0');
export function parseMoney(text:string):number|null{
 const m=text.match(/r\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/i)||text.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*reais/i);
 if(!m)return null;const value=Number(m[1].replace(/\./g,'')+'.'+(m[2]||'0'));return Number.isFinite(value)&&value>0?value:null;
}
export function parseDate(text:string,today:string):string|null{
 const t=norm(text);const base=new Date(today+'T12:00:00Z');
 const full=t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
 if(full){const year=full[3]?(full[3].length===2?2000+Number(full[3]):Number(full[3])):base.getUTCFullYear();const d=new Date(Date.UTC(year,Number(full[2])-1,Number(full[1]),12));if(d.getUTCDate()===Number(full[1]))return iso(d);}
 if(/\bdepois de amanha\b/.test(t)){base.setUTCDate(base.getUTCDate()+2);return iso(base);}
 if(/\bamanha\b/.test(t)){base.setUTCDate(base.getUTCDate()+1);return iso(base);}
 if(/\bhoje\b/.test(t))return today;
 return null;
}
export function parseTimes(text:string):{start:string;end:string}|null{
 const m=norm(text).match(/(\d{1,2})(?:[:h](\d{2}))?\s*h?\s*(?:as|a|ate|-)\s*(\d{1,2})(?:[:h](\d{2}))?\s*h?/);
 if(!m)return null;const [sh,sm,eh,em]=[Number(m[1]),Number(m[2]||0),Number(m[3]),Number(m[4]||0)];
 if(sh>23||eh>23||sm>59||em>59||sh*60+sm>=eh*60+em)return null;return {start:`${two(sh)}:${two(sm)}`,end:`${two(eh)}:${two(em)}`};
}
const sentences=(text:string)=>text.split(/(?<=[.!?])\s+|\n+/).map(s=>s.trim()).filter(Boolean);
const capitalize=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
const title=(prompt:string,fallback:string)=>{const first=sentences(prompt)[0]||fallback;return capitalize(first.replace(/[.!?:]+$/,'')).slice(0,150);};

export function simulateToolResult(tool:string,prompt:string,context:Record<string,any>,today:string):Result{
 const base={tool,type:tool,simulated:true as const,sent:false as const,requiresReview:true as const};
 const company=context.company?.name||context.company?.company||'nossa empresa';const t=norm(prompt);
 if(tool==='proposal'){
  if(!context.products?.length)throw new Error('Selecione ao menos um produto com preço no catálogo.');
  const qty=Number(t.match(/(\d+(?:[.,]\d+)?)\s*(?:unidades?|un\b|x\b|licencas?|itens?|vagas?|horas?|meses?)/)?.[1]?.replace(',','.')||1);
  const discount=Math.min(100,Number(t.match(/(\d+(?:[.,]\d+)?)\s*%/)?.[1]?.replace(',','.')||0));
  return {...base,data:{name:`Proposta — ${context.products.map((p:any)=>p.name).join(', ')}`.slice(0,150),leadId:context.leadId||'',items:context.products.map((p:any)=>({name:p.name,quantity:qty,price:p.price})),discount,notes:`Proposta preparada para revisão. Condições e prazos a confirmar com o cliente.`,status:'draft'}};
 }
 if(tool==='transaction'){
  const direction=/\b(entrada|receita|receber|recebiment|recebi|venda)/.test(t)?'in':'out';
  const category=prompt.match(/\bpara\s+(?:o\s+|a\s+|os\s+|as\s+)?([^,.;\d]{3,40}?)(?:\s*(?:,|\.|;|venc|com|no dia|dia|$))/i)?.[1]?.trim();
  const amount=parseMoney(prompt);if(!amount)throw new Error('Informe o valor no pedido, por exemplo: R$ 150.');
  return {...base,data:{name:category?capitalize(category):direction==='in'?'Entrada':'Saída',direction,amount,date:parseDate(prompt,today)??today,category:category?capitalize(category):'Geral',status:'pending'}};
 }
 if(tool==='shift'){
  const members=context.members||[];if(!members.length)throw new Error('Cadastre um colaborador para montar a escala.');
  const member=members.find((m:any)=>norm(m.name).split(/\s+/).some((part:string)=>part.length>2&&new RegExp('\\b'+part+'\\b').test(t)))||members[0];
  const times=parseTimes(prompt)||{start:'09:00',end:'18:00'};const team=prompt.match(/\b(?:time|equipe|setor)\s+(?:de\s+|do\s+|da\s+)?([^\s,.;]+)/i)?.[1];
  return {...base,data:{memberId:member.id,date:parseDate(prompt,today)??today,...times,team:team?capitalize(team):'Equipe'}};
 }
 if(tool==='contract'){
  const source=String(context.sourceText||'');if(!source.trim())throw new Error('Cole o texto do contrato para extrair os dados.');
  const counterparty=source.match(/\b(?:[Cc]ontratad[ao]|[Cc]ontratante|[Cc]liente|[Ff]ornecedor)\s*:?\s*([A-ZÀ-Ú][^,\n.;]{2,80})/)?.[1]?.trim()||'';
  const expiry=source.match(/(?:vig[eê]ncia|vencimento|v[aá]lido|t[eé]rmino)[^\d]{0,40}(\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1];
  const penalty=sentences(source).find(s=>/multa/i.test(s))||'';
  return {...base,data:{name:counterparty?`Contrato ${counterparty}`.slice(0,150):'Contrato importado',counterparty,expires:expiry?parseDate(expiry,today)||'':'',value:parseMoney(source)??0,penalty:penalty.slice(0,2000),text:source,status:'imported'}};
 }
 if(tool==='renewal'){
  const c=context.contract;if(!c?.name)throw new Error('Selecione um contrato para preparar a renovação.');
  const due=c.expires?` com vencimento em ${String(c.expires).split('-').reverse().join('/')}`:'';
  return {...base,type:'text',text:`Renovação — ${c.name}\n\nOlá${c.counterparty?', equipe '+c.counterparty:''},\n\nO contrato "${c.name}"${due} está chegando ao fim do período atual. Gostaríamos de conversar sobre a renovação e entender se há ajustes de escopo, prazos ou condições que façam sentido para vocês.\n\nPodemos agendar uma conversa nos próximos dias?\n\nAtenciosamente,\n${company}`};
 }
 if(tool==='article'){
  const body=prompt.includes(':')?prompt.slice(prompt.indexOf(':')+1):prompt;const steps=body.split(/,|;|\n|\be\b(?=\s)/).map(s=>s.trim().replace(/\.$/,'')).filter(s=>s.length>2);
  return {...base,data:{name:title(prompt.split(':')[0],'Novo artigo'),text:`Objetivo\n${capitalize(sentences(prompt)[0]||prompt)}\n\nPasso a passo\n${steps.map((s,i)=>`${i+1}. ${capitalize(s)}`).join('\n')}\n\nResponsável e revisão\nDefina quem mantém este processo e revise o artigo antes de aprovar.`,approved:false,status:'draft'}};
 }
 if(tool==='content'){
  const kind=context.kind||'posts';const theme=prompt.replace(/^(crie|faca|faça|escreva|prepare|gere)\s+(um|uma)?\s*/i,'').replace(/\.$/,'');
  const text=kind==='blog'?`${capitalize(theme)}\n\nIntrodução\nApresente o problema que o leitor enfrenta e por que ele importa.\n\nComo a ${company} ajuda\nExplique a solução com um exemplo concreto.\n\nPróximo passo\nConvide o leitor para uma conversa.`:kind==='ads'?`Título: ${capitalize(theme).slice(0,30)}\nDescrição: Conheça como a ${company} pode ajudar. Fale com a gente.\nChamada: Saiba mais`:kind==='analysis'?`Análise solicitada: ${theme}\n\nPontos fortes observados:\n- \n\nOportunidades:\n- \n\nPreencha com as referências fornecidas antes de usar.`:`${capitalize(theme)} ✨\n\nNa ${company}, a gente acredita que cada negócio merece atenção de perto.\n\nQuer saber como? Chama a gente para conversar. 👇\n\n#negocios #atendimento`;
  return {...base,data:{name:title(theme,'Novo conteúdo'),text,kind,status:'draft',date:''}};
 }
 if(tool==='wiki-answer'){
  const articles=context.articles||[];if(!articles.length)throw new Error('Não há artigos aprovados para responder. Aprove o conhecimento na Wiki primeiro.');
  const terms=t.split(/[^a-z0-9]+/).filter(w=>w.length>3);const relevant=articles.filter((a:any)=>terms.some(w=>norm(a.name+' '+a.text).includes(w)));
  if(!relevant.length)return {...base,type:'text',text:'Não encontrei essa informação nos artigos aprovados da wiki.',citations:[articles[0].id]};
  const top=relevant.slice(0,2);return {...base,type:'text',text:top.map((a:any)=>`Segundo "${a.name}":\n${String(a.text).slice(0,600)}`).join('\n\n'),citations:top.map((a:any)=>a.id)};
 }
 throw new Error('Ferramenta inválida.');
}
