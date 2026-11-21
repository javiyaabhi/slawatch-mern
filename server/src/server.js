import 'dotenv/config';
import { app } from './app.js';
import { connectDB } from './config/db.js';
import mongoose from 'mongoose';
import UserSession from './models/UserSession.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('REPLACE')) throw new Error('JWT_SECRET must have at least 32 characters');
if (process.env.CLIENT_ORIGIN) process.env.CLIENT_ORIGIN = process.env.CLIENT_ORIGIN.trim().replace(/\/+$/, '');
if (!process.env.CLIENT_ORIGIN) throw new Error('CLIENT_ORIGIN is required');
if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_ORIGIN.startsWith('https://')) throw new Error('Production CLIENT_ORIGIN must use HTTPS');
try {
  await connectDB();
  // Ensure the unique session identifier and TTL cleanup indexes exist before serving requests.
  await UserSession.createIndexes();
  const port = Number(process.env.PORT || 5000);
  const server = app.listen(port, () => console.log(`SLAWatch API listening on ${port}`));
  let stopping = false;
  const stop = async (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`${signal} received, shutting down HTTP and MongoDB`);
    server.close(async () => {
      try { await mongoose.disconnect(); process.exit(0); }
      catch (error) { console.error('Shutdown error', error); process.exit(1); }
    });
    // Do not keep the process alive indefinitely after a failed connection drain.
    setTimeout(() => { console.error('Shutdown timed out'); process.exit(1); }, 10000).unref();
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
} catch (err) {
  console.error('Unable to start SLAWatch API:', err.message);
  process.exit(1);
}
