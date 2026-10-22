import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDialNumber,contactMetrics,callDuration,callLabel,validateCallCommand} from '../lib/contact-center.ts';
import {validateEntity} from '../lib/domain.ts';
const call=(id:string,data:any,deleted=false):any=>({id,type:'call',data,deleted,revision:1,updatedAt:'2026-10-21T12:00:00Z'});
test('dialer requires an explicit international phone number and rejects extensions',()=>{
 assert.equal(normalizeDialNumber('+55 (11) 99999-1234'),'+5511999991234');
 for(const number of ['11999991234','+011999991234','+55119999;1234','sip:agent@example.com','+123'])assert.throws(()=>normalizeDialNumber(number),/internacional|telefone/i);
});
test('call commands cannot spoof tenant, cost, provider state or room identifiers',()=>{
 assert.deepEqual(validateCallCommand({action:'start',number:'+5511999991234',kind:'ai',requestId:'request-12345678',tenant:'victim',room:'other',status:'completed'}),{action:'start',number:'+5511999991234',kind:'ai',requestId:'request-12345678',leadId:''});
 assert.throws(()=>validateCallCommand({action:'start',number:'+5511999991234',kind:'ai'}),/identificador/i);
 assert.throws(()=>validateCallCommand({action:'finish',callId:'../victim'}),/chamada/i);
});
test('metrics derive from real records and separate missed from completed calls',()=>{
 const data=[call('1',{status:'completed',startedAt:'2026-10-21T12:00:00Z',endedAt:'2026-10-21T12:02:00Z',kind:'ai'}),call('2',{status:'missed'}),call('3',{status:'active'}),call('4',{status:'completed'},true)];
 assert.deepEqual(contactMetrics(data),{total:3,completed:1,missed:1,active:1,ai:1,totalSeconds:120,averageSeconds:120,answerRate:33});
 assert.equal(callDuration({startedAt:'invalid',endedAt:'invalid'}),0);
 assert.equal(callDuration({startedAt:'2026-10-21T12:00:00Z',endedAt:'2026-10-21T11:00:00Z'}),0);
 assert.equal(callLabel('provider_unknown'),'Desconhecido');
});
test('generic CRUD cannot mark a provider call or a sent message as real',()=>{
 assert.throws(()=>validateEntity('call',{number:'+5511999991234',status:'completed',provider:'livekit'}),/servidor|provedor/i);
 assert.throws(()=>validateEntity('message',{conversationId:'c',direction:'out',status:'sent',text:'Olá'}),/envio/i);
});
