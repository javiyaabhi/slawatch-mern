import bcrypt from 'bcryptjs';
import { z } from 'zod';
import User from '../models/User.js';
import UserSession from '../models/UserSession.js';
import { asyncHandler, clearSession, csrfForSession, HttpError, signSession } from '../middleware/http.js';

export const loginSchema = z.object({ email: z.string().email().max(180).transform(s => s.trim().toLowerCase()), password: z.string().min(1).max(128) });
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated;
  const user = await User.findOne({ email, active: true }).select('+passwordHash');
  const valid = user && await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new HttpError(401, 'Email or password is incorrect');
  const csrfToken = await signSession(res, user);
  res.json({ user: user.toJSON(), csrfToken });
});
export const me = asyncHandler(async (req, res) => res.json({ user: req.user, csrfToken: csrfForSession(req.sessionId) }));
export const logout = asyncHandler(async (req, res) => {
  try {
    await UserSession.updateOne(
      { sessionId: req.sessionId, userId: req.user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  } finally {
    // Clear the browser cookie even if the revocation write fails; the error is still returned.
    clearSession(res);
  }
  res.json({ message: 'Signed out' });
});

export const createAgentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().max(180).transform(s => s.trim().toLowerCase()),
  password: z.string().min(12).max(128)
});
export const listAgents = asyncHandler(async (_req, res) => {
  const users = await User.find({ role: 'agent', active: true }).select('name email role').sort({ name: 1 });
  res.json({ users });
});
export const createAgent = asyncHandler(async (req, res) => {
  const { name, email, password } = req.validated;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role: 'agent' });
  res.status(201).json({ user });
});
