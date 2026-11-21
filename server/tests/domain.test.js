import test from 'node:test';
import assert from 'node:assert/strict';
import { slaDeadline, getSlaState, canChangeStatus, DEFAULT_HOURS } from '../src/domain/sla.js';
import { percent, hoursBetween, slaSummary } from '../src/domain/metrics.js';
const createdAt = new Date('2026-01-10T00:00:00.000Z');
function ticket(overrides = {}) { return { status: 'open', createdAt, slaDueAt: new Date('2026-01-10T08:00:00.000Z'), ...overrides }; }
test('SLA defaults cover every priority', () => assert.deepEqual(Object.keys(DEFAULT_HOURS).sort(), ['critical','high','low','medium']));
test('deadline is calculated in elapsed hours', () => assert.equal(slaDeadline(createdAt, 8).toISOString(), '2026-01-10T08:00:00.000Z'));
test('deadline rejects invalid target', () => assert.throws(() => slaDeadline(createdAt, 0)));
test('open ticket below 80% is on track', () => assert.equal(getSlaState(ticket(), new Date('2026-01-10T06:00:00Z')), 'on_track'));
test('open ticket at 80% is at risk', () => assert.equal(getSlaState(ticket(), new Date('2026-01-10T06:24:00Z')), 'at_risk'));
test('open ticket past deadline breached', () => assert.equal(getSlaState(ticket(), new Date('2026-01-10T09:00:00Z')), 'breached'));
test('resolved before deadline met', () => assert.equal(getSlaState(ticket({ status: 'resolved', resolvedAt: new Date('2026-01-10T07:00:00Z') })), 'met'));
test('resolved after deadline breached', () => assert.equal(getSlaState(ticket({ status: 'resolved', resolvedAt: new Date('2026-01-10T09:00:00Z') })), 'breached'));
test('resolved status cannot reopen', () => assert.equal(canChangeStatus('resolved','open'), false));
test('open can resolve directly', () => assert.equal(canChangeStatus('open','resolved'), true));
test('in progress cannot reopen', () => assert.equal(canChangeStatus('in_progress','open'), false));
test('resolution hours calculate correctly', () => assert.equal(hoursBetween(createdAt, new Date('2026-01-10T01:30:00Z')), 1.5));
test('safe percentage with no denominator', () => assert.equal(percent(3,0), 0));
test('summary separates resolved and active breaches', () => {
  const result = slaSummary([
    ticket(),
    ticket({ status:'resolved', resolvedAt: new Date('2026-01-10T09:00:00Z') }),
    ticket({ status:'resolved', resolvedAt: new Date('2026-01-10T07:00:00Z') })
  ], new Date('2026-01-10T09:00:00Z'));
  assert.deepEqual(result, { total:3, resolved:2, open:1, breachedResolved:1, breachedOpen:1 });
});
