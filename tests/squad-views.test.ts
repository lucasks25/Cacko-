import test from 'node:test';
import assert from 'node:assert/strict';
import {contractMatches,contractDecisionDate,adTotals,monthDays,uncoveredDays,pipelineCycleDays} from '../lib/squad-views.ts';
test('contract filters use recorded signature and real expiration dates',()=>{
 assert.equal(contractMatches({status:'signed'},'signed','2026-10-22',30),true);
 assert.equal(contractMatches({status:'imported'},'signed','2026-10-22',30),false);
 assert.equal(contractMatches({expires:'2026-11-01'},'expiring','2026-10-22',30),true);
 assert.equal(contractMatches({expires:'2026-10-01'},'attention','2026-10-22',30),true);
 assert.equal(contractDecisionDate({expires:'2026-11-01',noticeDays:10}),'2026-10-22');
});
test('ads do not fabricate performance when no metrics are available',()=>{
 assert.deepEqual(adTotals([{status:'draft'}]),{hasData:false,spend:0,returns:0,results:0});
 assert.deepEqual(adTotals([{metrics:{spend:40,returns:100,results:3}},{metrics:{spend:10,returns:20,results:2}}]),{hasData:true,spend:50,returns:120,results:5});
 assert.deepEqual(adTotals([{metrics:{period:'2026-09',spend:40,returns:100,results:3}},{metrics:{period:'2026-10',spend:10,returns:20,results:2}},{metrics:{spend:1,returns:999,results:8}}],'2026-10'),{hasData:true,spend:10,returns:20,results:2});
});
test('month view starts on Monday and includes every date of the selected month',()=>{
 const days=monthDays('2026-10-22');assert.equal(new Date(days[0]+'T12:00:00').getDay(),1);
 assert.ok(days.includes('2026-10-01'));assert.ok(days.includes('2026-10-31'));assert.equal(days.length%7,0);
});
test('weekly coverage includes dates in the next month',()=>{
 assert.deepEqual(uncoveredDays(['2026-10-31','2026-11-01'],[{date:'2026-10-31'}],'2026-10-31','week'),['2026-11-01']);
});
test('pipeline cycle uses recorded won dates and does not infer closure from edits',()=>{
 assert.equal(pipelineCycleDays([{status:'won',createdAt:'2026-10-01',closedAt:'2026-10-09'},{status:'open',createdAt:'2026-10-01'}]),8);
 assert.equal(pipelineCycleDays([{status:'won',createdAt:'2026-10-01'}]),null);
});
