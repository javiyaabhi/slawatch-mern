import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import User from '../models/User.js';
import UserSession from '../models/UserSession.js';
import { SESSION_DURATION_MS, isSessionActive } from '../domain/session.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const validate = schema => (req, _res, next) => {
  try { req.validated = schema.parse(req.body); next(); }
  catch (err) { next(err); }
};

export async function requireAuth(req, _res, next) {
  try {
    const token = req.cookies?.slawatch_session;
    if (!token) throw new HttpError(401, 'Please sign in to continue');
    const claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'slawatch' });
    const [user, session] = await Promise.all([
      User.findById(claims.sub),
      UserSession.findOne({ sessionId: claims.jti, userId: claims.sub }).lean()
    ]);
    if (!user || !user.active) throw new HttpError(401, 'Account is unavailable');
    if (!isSessionActive(session)) throw new HttpError(401, 'Session is no longer active; sign in again');
    req.user = user;
    req.sessionId = claims.jti;
    next();
  } catch (err) {
    next(err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError ? new HttpError(401, 'Session expired; sign in again') : err);
  }
}

export const requireManager = (req, _res, next) => {
  if (req.user?.role !== 'manager') return next(new HttpError(403, 'Manager access required'));
  next();
};

export async function signSession(res, user) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  // Persist before issuing the cookie so every accepted JWT has a revocable server record.
  await UserSession.create({ sessionId, userId: user._id, expiresAt });
  const token = jwt.sign({}, process.env.JWT_SECRET, {
    algorithm: 'HS256', subject: String(user._id), jwtid: sessionId, expiresIn: Math.floor(SESSION_DURATION_MS / 1000), issuer: 'slawatch'
  });
  res.cookie('slawatch_session', token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/', maxAge: SESSION_DURATION_MS
  });
  return csrfForSession(sessionId);
}
export function clearSession(res) {
  res.clearCookie('slawatch_session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
}
export function csrfForSession(sessionId) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`csrf:${sessionId}`).digest('hex');
}
export function protectMutations(req, _res, next) {
  if (req.get('sec-fetch-site') === 'cross-site') return next(new HttpError(403, 'Cross-site requests are not allowed'));
  const origin = req.get('origin');
  const allowed = (process.env.CLIENT_ORIGIN || '').trim().replace(/\/+$/, '');
  if (origin && origin !== allowed) return next(new HttpError(403, 'Untrusted origin'));
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Login is unauthenticated; its origin is still verified above.
  if (req.originalUrl.split('?')[0] === '/api/auth/login') return next();
  if (!req.sessionId) return next(); // Authentication middleware owns 401 for protected routes.
  const submitted = req.get('x-csrf-token') || '';
  const expected = csrfForSession(req.sessionId);
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return next(new HttpError(403, 'Invalid request token. Refresh and retry.'));
  next();
}

export function errorHandler(err, _req, res, _next) {
  if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400 && Object.hasOwn(err, 'body'))) {
    return res.status(400).json({ message: 'Malformed JSON request body' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large' });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Invalid input', errors: err.issues.map(e => ({ path: e.path.join('.'), message: e.message })) });
  }
  if (err?.name === 'CastError') return res.status(400).json({ message: 'Invalid identifier' });
  if (err?.code === 11000) return res.status(409).json({ message: 'A record with those details already exists' });
  if (err?.name === 'ValidationError') return res.status(400).json({ message: 'Validation failed' });
  if (err?.name === 'VersionError' || err?.code === 112 || err?.codeName === 'WriteConflict') return res.status(409).json({ message: 'Record was updated concurrently. Refresh and retry.' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({ message: status >= 500 ? 'Unexpected server error' : err.message });
}
