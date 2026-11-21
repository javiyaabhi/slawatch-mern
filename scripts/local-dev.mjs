/**
 * Standalone Local Development Runner with in-memory replica set and automatic seeding.
 * Runs both MongoDB Replica Set and Express API without requiring MongoDB Atlas or external servers.
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../server/.env');

// Read existing server/.env if present
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.PORT = process.env.PORT || '5000';
process.env.CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
process.env.JWT_SECRET = process.env.JWT_SECRET || '991eb36371fb242fae8073b8bcc44e70c6cb69f8a781c7b78f48143aef8c9e3fa49456146e89663a00be1404ac2f1fc8';
process.env.SEED_MANAGER_EMAIL = process.env.SEED_MANAGER_EMAIL || 'manager@example.com';
process.env.SEED_MANAGER_PASSWORD = process.env.SEED_MANAGER_PASSWORD || 'ManagerPassword123!';
process.env.SEED_MANAGER_NAME = process.env.SEED_MANAGER_NAME || 'Demo Manager';
process.env.ALLOW_DEMO_SEED = process.env.ALLOW_DEMO_SEED || 'yes';
process.env.SEED_DEMO_AGENT_PASSWORD = process.env.SEED_DEMO_AGENT_PASSWORD || 'DemoAgentPassword123!';

console.log('----------------------------------------------------');
console.log(' Starting in-memory MongoDB Replica Set (wiredTiger)...');
console.log('----------------------------------------------------');

const replset = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: 'wiredTiger' }
});

const uri = replset.getUri('slawatch');
console.log(`✓ In-memory MongoDB Replica Set is ready at:`);
console.log(`  ${uri}`);

process.env.MONGO_URI = uri;

// Update server/.env so smoke tests or other scripts can see the active URI
if (fs.existsSync(envPath)) {
  let envText = fs.readFileSync(envPath, 'utf8');
  envText = envText.replace(/^MONGO_URI=.*$/m, `MONGO_URI=${uri}`);
  fs.writeFileSync(envPath, envText, 'utf8');
}

// Connect Mongoose
const { connectDB } = await import('../server/src/config/db.js');
await connectDB();

const User = (await import('../server/src/models/User.js')).default;
const Ticket = (await import('../server/src/models/Ticket.js')).default;
const TicketEvent = (await import('../server/src/models/TicketEvent.js')).default;
const { DEFAULT_HOURS, slaDeadline } = await import('../server/src/domain/sla.js');

// 1. Seed Manager
const managerEmail = process.env.SEED_MANAGER_EMAIL.trim().toLowerCase();
let manager = await User.findOne({ email: managerEmail });
if (!manager) {
  manager = await User.create({
    name: process.env.SEED_MANAGER_NAME,
    email: managerEmail,
    passwordHash: await bcrypt.hash(process.env.SEED_MANAGER_PASSWORD, 12),
    role: 'manager',
    active: true
  });
  console.log(`✓ Manager account seeded: ${manager.email} (${process.env.SEED_MANAGER_PASSWORD})`);
} else {
  console.log(`✓ Manager account found: ${manager.email}`);
}

// 2. Seed Demo Agents & Tickets
if (process.env.ALLOW_DEMO_SEED === 'yes') {
  const agentPassword = process.env.SEED_DEMO_AGENT_PASSWORD;
  const agents = [];
  for (const [name, email] of [
    ['Aarav Mehta', 'aarav.demo@example.invalid'],
    ['Mira Shah', 'mira.demo@example.invalid']
  ]) {
    let agent = await User.findOne({ email });
    if (!agent) {
      agent = await User.create({
        name,
        email,
        role: 'agent',
        passwordHash: await bcrypt.hash(agentPassword, 12),
        active: true
      });
    }
    agents.push(agent);
  }
  console.log(`✓ Demo agents ready: ${agents.map(a => a.email).join(', ')}`);

  const fixtures = [
    ['Wi-Fi intermittently unavailable in north wing', 'network', 'high', 'in_progress', 17],
    ['Finance VPN cannot reach internal portal', 'network', 'critical', 'resolved', 3],
    ['Browser sign-in loop after password reset', 'access', 'medium', 'open', 5],
    ['Printer queue blocked in office 3B', 'hardware', 'low', 'in_progress', 32],
    ['Laptop disk encryption warning', 'hardware', 'high', 'resolved', 12],
    ['CRM export returns an empty CSV', 'software', 'medium', 'resolved', 30],
    ['Access permission mismatch on shared drive', 'access', 'medium', 'resolved', 15],
    ['Conference room display does not detect HDMI', 'hardware', 'low', 'open', 21],
    ['Database admin portal slow during peak usage', 'software', 'high', 'in_progress', 7],
    ['Secure token rejected by internal gateway', 'access', 'critical', 'resolved', 6],
    ['Network switch port unstable on floor 2', 'network', 'high', 'resolved', 4],
    ['Accounting tool crashes when exporting report', 'software', 'medium', 'in_progress', 28],
    ['Service account lockout after rotation', 'access', 'high', 'open', 11],
    ['Headset devices not recognized on workstations', 'hardware', 'low', 'resolved', 44],
    ['Internal docs page fails to load on mobile', 'software', 'low', 'resolved', 10],
    ['VPN DNS resolution fails in remote office', 'network', 'medium', 'resolved', 22]
  ];

  const hoursAgo = h => new Date(Date.now() - h * 3600000);
  let inserted = 0;
  for (let i = 0; i < fixtures.length; i++) {
    const [title, category, priority, status, age] = fixtures[i];
    const code = `SW-DEMO-${String(i + 1).padStart(3, '0')}`;
    if (await Ticket.exists({ code })) continue;
    const createdAt = hoursAgo(age);
    const target = DEFAULT_HOURS[priority];
    const resolvedAt = status === 'resolved'
      ? new Date(createdAt.getTime() + Math.min(age - 0.1, [3, 5, 13, 27, 45][i % 5]) * 3600000)
      : null;
    const ticket = await Ticket.create({
      code,
      title,
      description: `Demo service request: ${title}. Assigned for investigation and used to illustrate real MongoDB-backed reports.`,
      category,
      priority,
      status,
      assignedTo: agents[i % 2]._id,
      createdBy: manager._id,
      slaTargetHours: target,
      slaDueAt: slaDeadline(createdAt, target),
      resolvedAt,
      createdAt,
      updatedAt: resolvedAt || createdAt
    });
    await TicketEvent.create({
      ticketId: ticket._id,
      actorId: manager._id,
      kind: 'created',
      toStatus: 'open',
      detail: 'Ticket opened (demo)',
      createdAt
    });
    if (status !== 'open') {
      const transitionAt = resolvedAt || hoursAgo(Math.max(1, Math.floor(age / 2)));
      await TicketEvent.create({
        ticketId: ticket._id,
        actorId: agents[i % 2]._id,
        kind: 'status_changed',
        fromStatus: 'open',
        toStatus: status,
        detail: 'Status updated for demo',
        createdAt: transitionAt
      });
    }
    inserted++;
  }
  if (inserted > 0) {
    console.log(`✓ Seeded ${inserted} demo tickets across categories and priorities.`);
  }
}

// 3. Start Express App
const { app } = await import('../server/src/app.js');
const port = Number(process.env.PORT || 5000);
const server = app.listen(port, () => {
  console.log('----------------------------------------------------');
  console.log(` SLAWatch API successfully listening on http://localhost:${port}`);
  console.log(` Health check: http://localhost:${port}/health`);
  console.log(` Frontend:     http://localhost:5173`);
  console.log('----------------------------------------------------');
  console.log(` Manager login: ${managerEmail}`);
  console.log(` Password:      ${process.env.SEED_MANAGER_PASSWORD}`);
  console.log('----------------------------------------------------');
});

// Graceful shutdown
const cleanup = async () => {
  console.log('\nShutting down SLAWatch...');
  server.close();
  await mongoose.disconnect();
  await replset.stop();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

