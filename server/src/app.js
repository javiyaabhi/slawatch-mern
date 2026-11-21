import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './routes/index.js';
import { errorHandler, HttpError } from './middleware/http.js';
import { requestContext } from './middleware/requestContext.js';

export const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(requestContext);
app.use(helmet());

if (process.env.CLIENT_ORIGIN) {
  process.env.CLIENT_ORIGIN = process.env.CLIENT_ORIGIN.trim().replace(/\/+$/, '');
}

app.use(cors({
  origin: process.env.CLIENT_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token']
}));
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.get('/health/live', (_req, res) => res.json({ status: 'alive' }));
app.get('/health/ready', (_req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503)
  .json({ status: mongoose.connection.readyState === 1 ? 'ready' : 'database_unavailable' }));
app.get('/health', (_req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503)
  .json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'database_unavailable' }));

// API data and auth responses must never be stored by browser/shared caches.
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api', routes);
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'API route not found')));

// Production: serve the pre-built React client and the API from ONE HTTPS origin.
// This keeps HttpOnly SameSite=Lax cookies and CSRF checks predictable.
if (process.env.NODE_ENV === 'production') {
  const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  app.use(express.static(frontend, { index: false }));
  app.get('*', (req, res, next) => {
    if (!req.accepts('html')) return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(frontend, 'index.html'), err => { if (err) next(err); });
  });
}
app.use((_req, _res, next) => next(new HttpError(404, 'Route not found')));
app.use(errorHandler);
