/**
 * Opt-in live API journey. WRITES REAL MONGODB DATA. Run ONLY against a disposable
 * development/test database after starting the Express API.
 *
 * Example:
 *   SMOKE_WRITE_TEST=yes node --env-file=server/.env scripts/smoke-api.mjs
 * Requires SEED_MANAGER_EMAIL and SEED_MANAGER_PASSWORD from the server .env.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const ORIGIN = process.env.SMOKE_CLIENT_ORIGIN || process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const email = process.env.SMOKE_MANAGER_EMAIL || process.env.SEED_MANAGER_EMAIL;
const password = process.env.SMOKE_MANAGER_PASSWORD || process.env.SEED_MANAGER_PASSWORD;

if (process.env.SMOKE_WRITE_TEST !== 'yes' || process.env.NODE_ENV === 'production') {
  console.error('Refusing live writes. Use a disposable database and set SMOKE_WRITE_TEST=yes (not in production).');
  process.exit(1);
}
if (!email || !password) {
  console.error('Set SMOKE_MANAGER_EMAIL / SMOKE_MANAGER_PASSWORD or the SEED_MANAGER_* credentials.');
  process.exit(1);
}

async function send(session, path, method = 'GET', body, expected = 200) {
  const headers = { Origin: ORIGIN };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session?.cookie) headers.Cookie = session.cookie;
  if (!['GET', 'HEAD'].includes(method) && session?.csrfToken) headers['X-CSRF-Token'] = session.csrfToken;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json().catch(() => ({}));
  assert.equal(response.status, expected,
    `${method} ${path}: expected HTTP ${expected}, received ${response.status}: ${JSON.stringify(result)}`);
  return { response, result };
}

async function signIn(address, secret) {
  const { response, result } = await send(null, '/auth/login', 'POST', { email: address, password: secret });
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('slawatch_session='), 'Session cookie missing');
  assert.ok(result.csrfToken, 'CSRF token missing');
  return { cookie, csrfToken: result.csrfToken, user: result.user };
}

let completed = 0;
function checkpoint(label) { completed++; console.log(`  [${completed}] ${label}`); }

try {
  console.log(`Testing ${BASE} against a DISPOSABLE database (this adds persistent audit records).`);
  const manager = await signIn(email, password);
  assert.equal(manager.user.role, 'manager');
  checkpoint('Manager authentication and CSRF cookie');
  // Live readiness only succeeds when the API is connected to MongoDB.
  const live = await fetch(BASE.replace(/\/api$/, '') + '/health/live');
  const ready = await fetch(BASE.replace(/\/api$/, '') + '/health/ready');
  assert.equal(live.status, 200);
  assert.equal(ready.status, 200);
  checkpoint('Liveness and MongoDB readiness');

  await send(null, '/auth/login', 'POST', { email, password: 'not-the-real-password' }, 401);
  await send({ cookie: manager.cookie }, '/users', 'POST', {
    name: 'Should Not Persist', email: 'csrf-test@example.invalid', password: 'ThisIsNotASavedPassword123'
  }, 403);
  await send(manager, '/users', 'POST', {
    name: 'Weak Password', email: 'weak-test@example.invalid', password: 'short'
  }, 400);
  await send(manager, '/unknown-route', 'GET', undefined, 404);
  checkpoint('Invalid login, CSRF, input validation and unknown API routes rejected');

  const id = crypto.randomBytes(7).toString('hex');
  const agentEmail = `smoke-${id}@example.invalid`;
  const agentPassword = crypto.randomBytes(22).toString('base64url');
  const { result: createdAgent } = await send(manager, '/users', 'POST', {
    name: 'API Smoke Test Agent', email: agentEmail, password: agentPassword
  }, 201);
  assert.ok(createdAgent.user._id);
  const agent = await signIn(agentEmail, agentPassword);
  checkpoint('Manager-created support agent and agent authentication');

  await send(agent, '/users', 'GET', undefined, 403);
  await send(agent, '/policies/high', 'PATCH', { targetHours: 999 }, 403);
  checkpoint('Agent cannot administer accounts or SLA policies');
  await send(agent, '/policies/history', 'GET', undefined, 403);
  const { result: policyBefore } = await send(manager, '/policies/history');
  assert.ok(Array.isArray(policyBefore.changes));
  const { result: currentPolicies } = await send(manager, '/policies');
  const oldLow = currentPolicies.policies.find(p => p.priority === 'low').targetHours;
  const temporaryLow = oldLow === 720 ? 719 : oldLow + 1;
  await send(manager, '/policies/low', 'PATCH', { targetHours: temporaryLow });
  const { result: afterChange } = await send(manager, '/policies/history');
  assert.equal(afterChange.changes[0].previousHours, oldLow);
  assert.equal(afterChange.changes[0].newHours, temporaryLow);
  assert.equal(afterChange.changes[0].actorId._id, manager.user._id);
  await send(manager, '/policies/low', 'PATCH', { targetHours: oldLow });
  checkpoint('Policy changes recorded with actor, previous and new target; original target restored');

  const { result: policies } = await send(agent, '/policies');
  assert.equal(policies.policies.length, 4);
  checkpoint('Authenticated SLA policy retrieval');

  const { result: created } = await send(manager, '/tickets', 'POST', {
    title: `Smoke-test network ticket ${id}`,
    description: 'End-to-end test of secure ticket creation, assignment, status changes and audit tracking.',
    category: 'network', priority: 'high', assignedTo: createdAgent.user._id
  }, 201);
  const ticketId = created.ticket._id;
  assert.ok(ticketId);
  const highPolicy = policies.policies.find(p => p.priority === 'high').targetHours;
  assert.equal(created.ticket.slaTargetHours, highPolicy);
  assert.equal(
    new Date(created.ticket.slaDueAt).getTime() - new Date(created.ticket.createdAt).getTime(),
    highPolicy * 3600000
  );
  checkpoint('Manager created ticket, assigned a real agent and persisted exact SLA deadline');

  const { result: assigned } = await send(agent, `/tickets/${ticketId}`);
  assert.equal(String(assigned.ticket.assignedTo._id), String(createdAgent.user._id));
  checkpoint('Agent can read assigned ticket');

  const secondEmail = `smoke-other-${id}@example.invalid`;
  const { result: secondCreated } = await send(manager, '/users', 'POST', {
    name: 'Second Smoke Agent', email: secondEmail, password: agentPassword
  }, 201);
  assert.ok(secondCreated.user._id);
  const otherAgent = await signIn(secondEmail, agentPassword);
  await send(otherAgent, `/tickets/${ticketId}`, 'GET', undefined, 403);
  await send(otherAgent, `/tickets/${ticketId}`, 'PATCH', { status: 'in_progress' }, 403);
  const { result: otherList } = await send(otherAgent, `/tickets?q=${encodeURIComponent(id)}`);
  assert.ok(!otherList.tickets.some(t => t._id === ticketId));
  checkpoint('Ticket detail, mutation and listing are isolated between agents');

  await send(agent, `/tickets/${ticketId}`, 'PATCH', { priority: 'critical' }, 403);
  await send(agent, `/tickets/${ticketId}`, 'PATCH', { status: 'unknown_state' }, 400);
  checkpoint('Agent cannot change priority or submit invalid status');

  await send(agent, `/tickets/${ticketId}`, 'PATCH', { status: 'in_progress' });
  await send(agent, `/tickets/${ticketId}`, 'PATCH', { status: 'resolved' });
  const { result: afterResolve } = await send(manager, `/tickets/${ticketId}`);
  assert.equal(afterResolve.ticket.status, 'resolved');
  assert.ok(afterResolve.ticket.resolvedAt);
  assert.ok(afterResolve.events.filter(x => x.kind === 'status_changed').length >= 2);
  await send(agent, `/tickets/${ticketId}`, 'PATCH', { status: 'in_progress' }, 409);
  checkpoint('Two audited transitions; resolved tickets are immutable');

  await send(agent, `/tickets/${ticketId}/archive`, 'POST', undefined, 403);
  await send(manager, `/tickets/${ticketId}/archive`, 'POST');
  await send(agent, `/tickets/${ticketId}`, 'GET', undefined, 403);
  const { result: archiveDetails } = await send(manager, `/tickets/${ticketId}`);
  assert.ok(archiveDetails.ticket.archivedAt);
  assert.ok(archiveDetails.events.some(x => x.kind === 'archived'));
  checkpoint('Only manager can archive and view preserved audit history');

  const { result: active } = await send(manager, `/tickets?q=${encodeURIComponent(id)}`);
  assert.ok(!active.tickets.some(x => x._id === ticketId));
  const { result: archive } = await send(manager, `/tickets?archived=1&q=${encodeURIComponent(id)}`);
  assert.ok(archive.tickets.some(x => x._id === ticketId));
  await send(agent, '/tickets?archived=1', 'GET', undefined, 403);
  checkpoint('Archive query isolated from operational records and protected by manager role');

  const { result: overview } = await send(manager, '/metrics/overview');
  const { result: analytics } = await send(manager, '/metrics/analytics');
  assert.ok(typeof overview.counts.total === 'number');
  assert.equal(overview.monthly.length, 6);
  assert.equal(analytics.monthly.length, 6);
  assert.equal(analytics.period.months, 6);
  assert.ok(Array.isArray(analytics.categories));
  assert.equal(analytics.slaBreakdown.length, 5);
  assert.equal(analytics.priorityCompliance.length, 4);
  assert.equal(analytics.aging.length, 4);
  const outcomeTotal = analytics.slaBreakdown.reduce((n, row) => n + row.count, 0);
  const categoryTotal = analytics.categories.reduce((n, row) => n + row.count, 0);
  assert.equal(outcomeTotal, categoryTotal, 'SLA distribution and category counts must use the same ticket cohort');
  const { result: quarterly } = await send(manager, '/metrics/analytics?months=3');
  assert.equal(quarterly.monthly.length, 3);
  assert.equal(quarterly.period.months, 3);
  const { result: annual } = await send(manager, '/metrics/analytics?months=12');
  assert.equal(annual.monthly.length, 12);
  await send(manager, '/metrics/analytics?months=24', 'GET', undefined, 400);
  checkpoint('Three report windows, zero-filled monthly series and invalid-period rejection');
  const { result: agentAnalytics } = await send(agent, '/metrics/analytics');
  assert.deepEqual(agentAnalytics.agents, []);
  assert.equal(agentAnalytics.slaBreakdown.reduce((n, row) => n + row.count, 0),
    agentAnalytics.categories.reduce((n, row) => n + row.count, 0));
  checkpoint('MongoDB analytics are internally consistent and team metrics are manager-only');
  // Export uses the same authorized aggregation engine as chart responses.
  const csvResponse = await fetch(`${BASE}/metrics/analytics.csv?months=3`, {
    headers: { Origin: ORIGIN, Cookie: manager.cookie }, signal: AbortSignal.timeout(15000)
  });
  assert.equal(csvResponse.status, 200);
  assert.ok(csvResponse.headers.get('content-type')?.includes('text/csv'));
  const csv = await csvResponse.text();
  assert.ok(csv.includes('Monthly cohort') && csv.includes('Priority SLA'));
  const agentCsvResponse = await fetch(`${BASE}/metrics/analytics.csv?months=3`, {
    headers: { Origin: ORIGIN, Cookie: agent.cookie }, signal: AbortSignal.timeout(15000)
  });
  assert.equal(agentCsvResponse.status, 200);
  const agentCsv = await agentCsvResponse.text();
  assert.ok(!agentCsv.includes('Team workload'));
  await send(manager, '/tickets?page=1abc', 'GET', undefined, 400);
  await send(manager, '/metrics/analytics.csv?months=100', 'GET', undefined, 400);
  checkpoint('Authorized report CSV exports, agent-safe scope and strict query validation');

  await send(manager, '/auth/logout', 'POST');
  await send(manager, '/auth/me', 'GET', undefined, 401);
  checkpoint('Logout revokes the server-side session; the copied cookie is rejected');

  console.log(`PASS: ${completed} live API checks. Test record ${created.ticket.code}; agent ${agentEmail}.`);
  console.log('No cleanup was performed: history is intentionally retained in the disposable database.');
} catch (err) {
  console.error('FAIL:', err.message);
  process.exitCode = 1;
}
