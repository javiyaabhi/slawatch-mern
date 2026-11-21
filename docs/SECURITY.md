# Security architecture and threat model

## Primary concerns

| Threat | Defense in current source | Remaining work |
| --- | --- | --- |
| Stolen password database | bcryptjs salted password hashes, 12 rounds | Add password reset and breach detection before real deployment |
| Stolen or replayed session cookie | JWT signature plus active server-side `userSessions` record; logout revokes the record and protected requests reject it | Add session rotation, device/session management and live integration tests before broader deployment |
| Agent views other agents' records | Server-side owner filter for lists, detail checks, scoped analytics | Add integration tests against real database |
| Agent creates manager / edits policy | Manager-only routes, manager bootstrapped via seed script | Policy changes are audited; account provisioning audit remains future work |
| Cross-site request forgery | `X-CSRF-Token` HMAC-bound to JWT `jti`, exact CORS and Origin checks | Confirm cookies/origins in real deployment |
| Cross-site scripting | React escapes text, no `dangerouslySetInnerHTML`; strict API validation | Test CSP for final deployment, do not render arbitrary HTML |
| Brute-force sign-in | 12 attempts / IP / 15 minutes | Add per-account rate limiting and monitoring for real use |
| Mass assignment | Strict Zod schemas, explicit role checks; server controls ticket state & assignment | Continue reviewing newly added endpoints |
| Concurrent updates | Transaction + optimistic `__v` condition; audit written in same transaction | Test simultaneous updates against replica set |
| Excessive payloads | 64 KiB JSON limit, length and enum checks, paginated list | Body/file upload risks if added later |
| Data leakage | No password hash in JSON, consistent error responses | Avoid leaking secrets to logs; add log redaction |

## Session behavior

- Session is a signed HS256 JWT in an HttpOnly cookie lasting 8 hours. `Secure` is enabled when `NODE_ENV=production`, `SameSite=Lax`.
- Each JWT `jti` has a corresponding `userSessions` MongoDB record containing the user, expiry and optional revocation timestamp. Protected requests require both a valid JWT and a non-revoked, unexpired database session.
- Logout revokes the server-side session and clears the browser cookie. A copied cookie is rejected on the next protected request after revocation.
- An expiry TTL index removes old session documents asynchronously; authorization checks compare `expiresAt` directly and do not rely on TTL cleanup timing.
- No session token is stored in browser localStorage. Read-only `/api/auth/me` returns a per-session CSRF token for use in the `X-CSRF-Token` header on writes.
- Remaining production work: session listing/revocation UI, session rotation, integration testing during concurrent logout, and centralized monitoring.
- `CLIENT_ORIGIN` is an exact allowed browser origin. Protect cookies and secrets with TLS.

## Route checks

Login route accepts public credentials, is rate-limited, and checks `Origin` when present. Business routes use `requireAuth` then `protectMutations`. Team creation, policy editing and archiving additionally use `requireManager`. Agent visibility is checked in query filters and detail endpoints; UI navigation alone is never relied on for security.

## Audit and deletion

Ticket creation/edits/status changes are paired with events inside a MongoDB transaction. Archive is an explicit manager action on an already resolved ticket; its event is retained. Archived records remain manager-readable as historical evidence; agents cannot view archives. Audit records are ordinary MongoDB documents, not a tamper-evident compliance-grade log. For legally binding audit requirements, add append-only infrastructure, tamper detection and retention policy.

## Deployment reminders

1. Never commit actual `.env` or credentials.
2. Never use the seeded demonstration account in production.
3. Use separate database users with minimum required permissions, and Atlas network access restrictions.
4. Use HTTPS and rotate secret keys in a documented manner.
5. Run `npm audit` after installing dependencies and pin a reviewed lock file for final submission.
6. Review unexpected traffic and rate-limit behavior behind your actual reverse proxy; only enable Express `trust proxy` for known infrastructure.
7. Add a security test that proves an agent cannot see another agent's ticket or global workload report.
8. Observe that this is a **classroom-grade secure baseline**, not a formal penetration-tested enterprise product.

## Single-origin hardening (v1.2)

- The preferred release configuration now serves React assets and the Express API from the same HTTPS origin, so sessions do not depend on cross-site cookies. In development, Vite proxies `/api` while retaining the `localhost:5173` browser origin.
- The API adds `Cache-Control: no-store` to avoid storing personalized ticket and user responses in intermediary caches.
- Unknown `/api` requests receive JSON 404 before the React catch-all route, preventing accidental HTML responses to API consumers.
- Full HTTP security verification still requires a running Express server: inspect cookies, CORS, CSRF, security headers, and reverse-proxy configuration before public deployment.


## v1.4 controls and gaps

- Every SLA policy edit records `{priority, previousHours, newHours, actorId, createdAt}` atomically with the update in MongoDB. Policy changes are manager-readable only and ordinary application routes never delete these records.
- `GET /api/metrics/analytics.csv` exports role-scoped aggregates using the same reporting engine as React charts. Spreadsheet formula-like names are escaped; report exports do not contain user passwords, ticket descriptions or unscoped personal data.
- `X-Request-ID` and JSON response logs enable basic incident diagnostics, with no bodies, auth tokens or query strings logged.
- Distinct process liveness and MongoDB readiness endpoints support container or host monitoring.
- A cross-site fetch metadata guard and strict page validation were added as defense in depth.
- **Still required:** live endpoint authorization tests, session rotation and session management UI, shared login throttling, TLS/proxy verification, formal security and restore testing. Do not call this application enterprise-certified.


## v1.5 session and request-boundary controls

- `userSessions` is a server-side session registry. Its unique `sessionId` is the JWT `jti`; records are linked to a user and expire after eight hours.
- Authentication checks the database record on every protected request. Logout marks it revoked before returning success. The TTL index is storage cleanup only, not the authorization mechanism.
- JSON parser failures and oversized payloads receive stable 400/413 JSON responses.
- The live API smoke test includes a replay attempt after logout; this test must be run against a disposable MongoDB replica set before deployment.
