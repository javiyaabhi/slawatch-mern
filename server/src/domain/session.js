/** Shared session lifetime and validation rules for cookie-backed JWT sessions. */
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export function isSessionActive(session, now = new Date()) {
  if (!session || session.revokedAt != null) return false;
  const expiresAt = new Date(session.expiresAt).getTime();
  const nowMs = new Date(now).getTime();
  return Number.isFinite(expiresAt) && Number.isFinite(nowMs) && expiresAt > nowMs;
}
