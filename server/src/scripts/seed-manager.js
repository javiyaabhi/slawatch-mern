import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

const { SEED_MANAGER_EMAIL: email, SEED_MANAGER_PASSWORD: password, SEED_MANAGER_NAME: name = 'Service Manager' } = process.env;
if (!email || !password || password.length < 12 || password.includes('CHOOSE')) {
  console.error('Set SEED_MANAGER_EMAIL and SEED_MANAGER_PASSWORD (at least 12 characters) in server/.env');
  process.exit(1);
}
try {
  await connectDB();
  const existing = await User.findOne({ email: email.trim().toLowerCase() });
  if (existing) { console.log('Account already exists. No changes made.'); }
  else {
    await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'manager' });
    console.log('Manager account created.');
  }
} finally { await mongoose.disconnect(); }
