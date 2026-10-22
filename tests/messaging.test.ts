import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeMessages,mergeConversations,mergeConversationPage,messagingQuery,validateNewContact,validateNewConversation,createRequestGate,loadMessageWindow} from '../lib/messaging.ts';
test('history merges older pages and polling without dropping old messages or duplicating IDs',()=>{
 const older=[{id:'8',text:'Antiga'},{id:'9',text:'Anterior'}],latest=[{id:'9',text:'Atualizada'},{id:'10',text:'Nova'}];
 assert.deepEqual(mergeMessages(older,latest),[{id:'8',text:'Antiga'},{id:'9',text:'Atualizada'},{id:'10',text:'Nova'}]);
 assert.deepEqual(mergeMessages(latest,older).map(m=>m.id),['8','9','10']);
});
test('refreshing the first page preserves loaded conversations and replaces updated records',()=>{
 assert.deepEqual(mergeConversations([{id:'3',name:'Mais antiga'},{id:'2',name:'B'}],[{id:'1',name:'Nova'},{id:'2',name:'Atualizada'}]).map(c=>[c.id,c.name]),[['1','Nova'],['2','Atualizada'],['3','Mais antiga']]);
});
test('filtered page refresh removes conversations that no longer belong to the filter',()=>{
 assert.deepEqual(mergeConversationPage([{id:'1',status:'pending'},{id:'9',status:'pending'}],[],['1'],'pending').map(c=>c.id),['9']);
});
test('messaging query validates cursors, pages, filters and escaped search',()=>{
 assert.equal(messagingQuery('conversations',{page:'3',status:'pending'}),'/conversations?page=3&status=pending');
 assert.equal(messagingQuery('messages:9',{before:'101'}),'/conversations/9/messages?before=101');
 assert.equal(messagingQuery('messages:9',{after:'101'}),'/conversations/9/messages?after=101');
 assert.throws(()=>messagingQuery('messages:9',{before:'101',after:'90'}));
 assert.equal(messagingQuery('contacts',{q:'Ana & Filhos',page:'2'}),'/contacts?q=Ana+%26+Filhos&page=2');
 for(const [op,args] of [['messages:9',{before:'-1'}],['conversations',{page:'0'}],['conversations',{status:'oops'}],['contacts',{page:'1&tenant=bob'}]] as const)assert.throws(()=>messagingQuery(op,args));
});
test('contact and conversation commands whitelist input and validate channel identifiers',()=>{
 assert.deepEqual(validateNewContact({name:' Ana ',phone:'+55 (11) 99999-1234',tenant:'other',api_key:'secret'}),{name:'Ana',phone:'+5511999991234',email:''});
 assert.deepEqual(validateNewConversation({contactId:'8',inboxId:'2',status:'pending',message:'Não envie'}),{contactId:8,inboxId:2});
 assert.throws(()=>validateNewContact({name:'Ana',email:'invalid'}));
 assert.throws(()=>validateNewContact({name:'Ana',phone:'11999991234'}));
 assert.throws(()=>validateNewConversation({contactId:'8/../../',inboxId:'2'}));
});
test('a delayed poll cannot replace the result of a newer refresh',()=>{
 const gate=createRequestGate();const oldPoll=gate.begin();const newRefresh=gate.begin();
 let status='pending';if(newRefresh())status='open';if(oldPoll())status='pending';
 assert.equal(status,'open');
});
test('polling refreshes delivery status as well as new messages',async()=>{
 const calls:Record<string,string>[]=[];
 const result=await loadMessageWindow(async params=>{calls.push(params);return params.after?{messages:[]}:{messages:[{id:'101',status:'delivered',text:'Olá'}]};},[{id:'101',status:'sent',text:'Olá'}],true);
 assert.equal(result.updates.find(m=>m.id==='101')?.status,'delivered');
 assert.deepEqual(calls,[{after:'101'},{}]);
 assert.equal(result.history,undefined);
});
test('recovering the initial load still exposes older message history',async()=>{
 let attempts=0;
 const fetcher=async()=>{if(!attempts++)throw new Error('offline');return {messages:[{id:'80'}],oldestId:'80',hasMore:true};};
 await assert.rejects(loadMessageWindow(fetcher,[],false));
 const recovered=await loadMessageWindow(fetcher,[],false);
 assert.deepEqual(recovered.history,{oldestId:'80',hasMore:true});
});
