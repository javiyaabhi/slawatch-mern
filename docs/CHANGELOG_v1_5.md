# SLAWatch v1.5 — Security hardening

## Added
- Server-side `userSessions` collection linked to `users`.
- Eight-hour session records with a unique JWT `jti`, explicit expiry, revocation timestamp and TTL cleanup index.
- Authentication now requires a valid JWT and a matching non-revoked, unexpired database session.
- Logout revokes the server-side record before clearing the cookie.
- Live API smoke script now attempts to reuse the copied cookie after logout and expects HTTP 401.
- Stable JSON error responses for malformed request bodies (400) and oversized JSON bodies (413).
- Pure unit tests for session lifetime, expiry boundary, revocation and invalid session data.

## Verification
- 53/53 Node unit tests passed.
- Backend source and live smoke script pass `node --check`.
- Full Vite production build, live MongoDB smoke test and browser testing remain unverified because npm dependencies could not be downloaded and no disposable replica-set database is connected in this environment.

## Scope
No new product modules were added. This release improves authentication lifecycle and request-boundary reliability while preserving the MCA Semester 1 scope.
