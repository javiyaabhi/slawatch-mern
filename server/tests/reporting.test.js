import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReportMonths, cohortStart, fillMonthlyCohorts, slaBreakdown, formatPriorityCompliance, formatAgeBuckets } from '../src/domain/reporting.js';

const now = new Date('2026-11-07T18:00:00.000Z');
test('period defaults to six months', () => assert.equal(parseReportMonths(), 6));
test('only exact supported month periods are accepted', () => {
  assert.equal(parseReportMonths('3'), 3);
  assert.equal(parseReportMonths('12'), 12);
  for (const input of ['1', '0', '90', '06', '3.5', 'x', null, '3months']) assert.throws(() => parseReportMonths(input));
});
test('calendar cohort begins at UTC month boundary and spans year changes', () => {
  assert.equal(cohortStart(3, new Date('2026-01-31T12:00:00Z')).toISOString(), '2025-11-01T00:00:00.000Z');
  assert.equal(cohortStart(6, now).toISOString(), '2026-06-01T00:00:00.000Z');
});
test('missing months have zero-filled opened and resolved values', () => {
  assert.deepEqual(fillMonthlyCohorts([{_id:'2026-10',count:4,resolved:2}],3,now),[
    {month:'2026-09',opened:0,resolved:0},
    {month:'2026-10',opened:4,resolved:2},
    {month:'2026-11',opened:0,resolved:0}
  ]);
});
test('SLA outcomes form a five-way breakdown without inventing data', () => {
  const rows=slaBreakdown({resolvedMet:5,resolvedLate:2,onTrack:3,atRisk:1,breached:4});
  assert.equal(rows.reduce((sum,row)=>sum+row.count,0),15);
  assert.equal(rows.find(x=>x.key==='resolvedLate').label,'Resolved late');
});
test('SLA outcomes on empty cohort are zero', () => {
  assert.equal(slaBreakdown().reduce((sum,row)=>sum+row.count,0),0);
});
test('priority compliance uses resolved denominator not all tickets', () => {
  const result=formatPriorityCompliance([{_id:'high',resolved:4,onTime:3},{_id:'low',resolved:0,onTime:0}]);
  assert.equal(result.find(x=>x.priority==='high').rate,75);
  assert.equal(result.find(x=>x.priority==='high').late,1);
  assert.equal(result.find(x=>x.priority==='low').rate,null);
  assert.equal(result.find(x=>x.priority==='critical').rate,null);
});
test('aging buckets are complete and zero-filled', () => {
  const result=formatAgeBuckets([{_id:'4to24',count:8},{_id:'over3days',count:2}]);
  assert.deepEqual(result.map(x=>x.count),[0,8,0,2]);
});
