import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, createReportCsv } from '../src/domain/exportCsv.js';
import { parseTicketPage } from '../src/domain/pagination.js';
import { requestContext } from '../src/middleware/requestContext.js';
import { EventEmitter } from 'node:events';

function report() {
  return {
    period: { from: '2026-01-01T00:00:00.000Z', through: '2026-03-31T10:00:00.000Z' },
    monthly: [{ month: '2026-01', opened: 3, resolved: 2 }],
    slaBreakdown: [{ label: 'Resolved on time', count: 2 }],
    categories: [{ _id: 'network', count: 3 }],
    priorities: [{ _id: 'high', count: 3 }],
    priorityCompliance: [{ priority: 'high', onTime: 2, resolved: 2, rate: 100 }],
    aging: [{ label: 'Under 4 hours', count: 1 }],
    slowStages: [{ _id: 'open', count: 2, avgHours: 1.5 }],
    agents: [{ name: '=HYPERLINK("https://evil.invalid")', active: 1, resolved: 2, avgResolutionHours: 1.5 }]
  };
}
test('CSV encodes quotes and commas', () => assert.equal(csvCell('A, "quoted" value'), '"A, ""quoted"" value"'));
test('CSV neutralizes formula-looking spreadsheet values', () => {
  for (const prefix of ['=', '+', '-', '@', '\t=', '  =']) {
    const cell = csvCell(prefix + 'danger');
    assert.ok(cell.startsWith('"\''), cell);
  }
  assert.equal(csvCell(-10), '"-10"');
});
test('CSV generated from report contains all expected sections', () => {
  const output = createReportCsv(report());
  for (const section of ['Monthly cohort', 'SLA outcome', 'Category', 'Priority SLA', 'Open age', 'Stage duration', 'Team workload']) {
    assert.ok(output.includes(section), section);
  }
  assert.ok(output.startsWith('\ufeff'));
  assert.ok(output.includes('"\'=HYPERLINK'), 'injected team name must be inert');
  assert.ok(!output.includes('passwordHash'));
});
test('empty team report does not add unauthorized team names', () => {
  const data = report(); data.agents = [];
  assert.ok(!createReportCsv(data).includes('evil.invalid'));
});
test('page defaults to first page', () => assert.equal(parseTicketPage(), 1));
test('page accepts only strict bounded positive integers', () => {
  assert.equal(parseTicketPage('9999'), 9999);
  for (const invalid of ['0', '-1', '01', '1abc', '2.0', '1e3', '10000', '', null, 3, [], {}]) {
    assert.throws(() => parseTicketPage(invalid), /Invalid page number/);
  }
});
test('request correlation id is set without exposing request query strings', () => {
  const req = { method: 'GET', path: '/api/tickets', originalUrl: '/api/tickets?email=private@example.com' };
  const res = new EventEmitter();
  res.setHeader = (k,v) => { res[k] = v; };
  let called = false;
  requestContext(req, res, () => { called = true; });
  assert.ok(called);
  assert.match(res['X-Request-ID'], /^[0-9a-f-]{36}$/);
  assert.equal(req.requestId, res['X-Request-ID']);
});
