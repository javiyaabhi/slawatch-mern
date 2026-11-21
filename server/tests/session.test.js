import test from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_DURATION_MS, isSessionActive } from '../src/domain/session.js';

const now = new Date('2026-11-09T06:00:00.000Z');

test('session lifetime is eight hours', () => {
  assert.equal(SESSION_DURATION_MS, 8 * 60 * 60 * 1000);
});

test('unrevoked session remains active before expiry', () => {
  assert.equal(isSessionActive({ expiresAt: new Date(now.getTime() + 1000), revokedAt: null }, now), true);
});

test('session is inactive at the exact expiry instant', () => {
  assert.equal(isSessionActive({ expiresAt: now, revokedAt: null }, now), false);
});

test('session is inactive after expiry', () => {
  assert.equal(isSessionActive({ expiresAt: new Date(now.getTime() - 1), revokedAt: null }, now), false);
});

test('revoked session is inactive even before expiry', () => {
  assert.equal(isSessionActive({ expiresAt: new Date(now.getTime() + 60_000), revokedAt: now }, now), false);
});

test('missing or malformed session records are inactive', () => {
  assert.equal(isSessionActive(null, now), false);
  assert.equal(isSessionActive({ expiresAt: 'not-a-date', revokedAt: null }, now), false);
});
