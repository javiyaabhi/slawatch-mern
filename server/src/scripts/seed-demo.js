/** Optional sample dataset for classroom demonstrations. NEVER run against production. */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Ticket from '../models/Ticket.js';
import TicketEvent from '../models/TicketEvent.js';
import { DEFAULT_HOURS, slaDeadline } from '../domain/sla.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.env.ALLOW_DEMO_SEED !== 'yes') {
  console.log('ALLOW_DEMO_SEED is not set to "yes". Skipping demo dataset seeding.');
  process.exit(0);
}
const password = process.env.SEED_DEMO_AGENT_PASSWORD || 'DemoAgentPassword123!';
if (password.length < 12) {
  console.warn('SEED_DEMO_AGENT_PASSWORD must have at least 12 characters. Skipping demo seed.');
  process.exit(0);
}

// Load dataset from data/dataset.json or fallback
let dataset = [];
const datasetPath = path.resolve(__dirname, '../../../data/dataset.json');
if (fs.existsSync(datasetPath)) {
  dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
} else {
  console.error(`Cannot find dataset at ${datasetPath}`);
  process.exit(1);
}

const hoursAgo = h => new Date(Date.now() - h * 3600000);

try {
  await connectDB();
  const manager = await User.findOne({ role: 'manager', active: true });
  if (!manager) throw new Error('Seed a manager first (npm run seed:manager).');

  // 1. Ensure 5 Demo Agents exist
  const agentDefs = [
    { name: 'Aarav Mehta', email: 'aarav.demo@example.invalid' },
    { name: 'Mira Shah', email: 'mira.demo@example.invalid' },
    { name: 'Rohan Sharma', email: 'rohan.demo@example.invalid' },
    { name: 'Priya Patel', email: 'priya.demo@example.invalid' },
    { name: 'Kavita Nair', email: 'kavita.demo@example.invalid' }
  ];

  const agents = [];
  const hashedPassword = await bcrypt.hash(password, 12);
  for (const def of agentDefs) {
    let agent = await User.findOne({ email: def.email });
    if (!agent) {
      agent = await User.create({
        name: def.name,
        email: def.email,
        role: 'agent',
        passwordHash: hashedPassword,
        active: true
      });
    }
    agents.push(agent);
  }
  console.log(`✓ 5 Demo agents ready: ${agents.map(a => a.email).join(', ')}`);

  // 2. Clean up old demo tickets (SW-DEMO-* and SW-CLASS-*) to ensure exact 60-ticket dataset
  const oldDemoTickets = await Ticket.find({ code: { $regex: /^SW-(DEMO|CLASS)-/ } }, '_id');
  const oldIds = oldDemoTickets.map(t => t._id);
  if (oldIds.length) {
    await TicketEvent.deleteMany({ ticketId: { $in: oldIds } });
    await Ticket.deleteMany({ _id: { $in: oldIds } });
    console.log(`✓ Cleaned up ${oldIds.length} previous demo records.`);
  }

  // 3. Insert 60 Tickets with realistic lifecycle events
  let inserted = 0;
  for (let i = 0; i < dataset.length; i++) {
    const item = dataset[i];
    const assignedAgent = agents[i % agents.length];
    const createdAt = hoursAgo(item.ageHours);
    const target = DEFAULT_HOURS[item.priority];
    const slaDueAt = slaDeadline(createdAt, target);
    const resolvedAt = item.status === 'resolved' && item.resolutionHours != null
      ? new Date(createdAt.getTime() + item.resolutionHours * 3600000)
      : null;

    const ticket = await Ticket.create({
      code: item.code,
      title: item.title,
      description: item.description,
      category: item.category,
      priority: item.priority,
      status: item.status,
      assignedTo: assignedAgent._id,
      createdBy: manager._id,
      slaTargetHours: target,
      slaDueAt,
      resolvedAt,
      createdAt,
      updatedAt: resolvedAt || createdAt
    });

    // Event 1: Creation (Open)
    await TicketEvent.create({
      ticketId: ticket._id,
      actorId: manager._id,
      kind: 'created',
      toStatus: 'open',
      detail: 'Ticket opened (demo)',
      createdAt
    });

    if (item.status === 'resolved' && resolvedAt) {
      if (item.twoStageHistory) {
        // Two-stage transition: open -> in_progress -> resolved
        const midpoint = new Date(createdAt.getTime() + (resolvedAt.getTime() - createdAt.getTime()) * 0.55);
        await TicketEvent.create([
          {
            ticketId: ticket._id,
            actorId: assignedAgent._id,
            kind: 'status_changed',
            fromStatus: 'open',
            toStatus: 'in_progress',
            durationInPreviousStatusMs: midpoint.getTime() - createdAt.getTime(),
            detail: 'Status changed: open → in progress (demo)',
            createdAt: midpoint
          },
          {
            ticketId: ticket._id,
            actorId: assignedAgent._id,
            kind: 'status_changed',
            fromStatus: 'in_progress',
            toStatus: 'resolved',
            durationInPreviousStatusMs: resolvedAt.getTime() - midpoint.getTime(),
            detail: 'Status changed: in progress → resolved (demo)',
            createdAt: resolvedAt
          }
        ]);
      } else {
        // Direct transition: open -> resolved
        await TicketEvent.create({
          ticketId: ticket._id,
          actorId: assignedAgent._id,
          kind: 'status_changed',
          fromStatus: 'open',
          toStatus: 'resolved',
          durationInPreviousStatusMs: resolvedAt.getTime() - createdAt.getTime(),
          detail: 'Status changed: open → resolved (demo)',
          createdAt: resolvedAt
        });
      }
    } else if (item.status === 'in_progress') {
      // In-progress transition: open -> in_progress
      const transitionAt = hoursAgo(Math.max(0.5, item.ageHours / 2));
      await TicketEvent.create({
        ticketId: ticket._id,
        actorId: assignedAgent._id,
        kind: 'status_changed',
        fromStatus: 'open',
        toStatus: 'in_progress',
        durationInPreviousStatusMs: Math.max(0, transitionAt.getTime() - createdAt.getTime()),
        detail: 'Status changed: open → in progress (demo)',
        createdAt: transitionAt
      });
    }

    inserted++;
  }

  console.log(`\n====================================================`);
  console.log(` Successfully seeded ${inserted} demo tickets into SLAWatch!`);
  console.log(`====================================================`);
  console.log(` Breakdown:`);
  console.log(`   - Total tickets:     ${inserted}`);
  console.log(`   - Resolved tickets:  ${dataset.filter(d => d.status === 'resolved').length}`);
  console.log(`   - In progress:       ${dataset.filter(d => d.status === 'in_progress').length}`);
  console.log(`   - Open tickets:      ${dataset.filter(d => d.status === 'open').length}`);
  console.log(`   - Demo agents:       ${agents.length}`);
  console.log(`   - Categories:        ${new Set(dataset.map(d => d.category)).size}`);
  console.log(`   - Priority levels:   ${new Set(dataset.map(d => d.priority)).size}`);
  console.log(`====================================================`);
  console.log(` Demo Agent Accounts (Password: ${password}):`);
  agents.forEach(a => console.log(`   - ${a.name} <${a.email}>`));
  console.log(`====================================================\n`);

} catch (err) {
  console.error('Error during demo seed:', err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
