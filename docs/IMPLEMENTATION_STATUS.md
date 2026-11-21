# Implementation status at handoff — 25 October 2026

## Continued development (v1.1)

- Added manager-only historical ticket register and read-only ticket history, while keeping archived tickets excluded from operational analytics.
- Ensured agents cannot list or inspect archived tickets; managers cannot edit or re-archive an archived record.
- Extended role/scoping regression suite to 32 automated tests.
- Added opt-in Node.js live HTTP smoke script that checks 10 real API stages on a disposable MongoDB database (not executed here).

## Completed source work

- MERN monorepo folder structure and package manifests.
- React pages for sign-in, overview, ticket list, new ticket, detail/audit history, reports, team and SLA policies.
- Express API, controllers/services, route middleware, JWT session cookies, CSRF token checks, role restrictions, input validation, login throttling and error handling.
- Mongoose schemas and relationships: users, tickets, ticketEvents, slaPolicies.
- SLA rules and report aggregation pipeline source, including stage bottleneck analysis.
- Ticket update/archive logic with MongoDB transactions and optimistic concurrency checks.
- Optional disabled-by-default demo seed and bootstrap manager creation.
- Product/system/security/design/QA documentation and eight specialist role assignments.

## Checks executed in this environment

- `node --check` on all server JS source: **pass**.
- `npm test`: **32 passed, 0 failed**, recorded in `TEST_RESULTS.txt`.
- React `npm run build`: **unable to execute** — Vite package absent in this container; see `BUILD_ATTEMPT.txt`.
- `npm view react version` / package installation: registry unreachable (`EAI_AGAIN`).
- Real MongoDB + Express integration: **not executed**; requires an accessible MongoDB replica set and package installation.
- Visual browser QA: **not executed**; requires a running Vite UI.

This is a complete authored MVP source package, **not a verified production deployment**. Follow `QA.md` before final MCA submission. Do not describe unexecuted integration scenarios as tested.

## v1.2 additions

- Added unified same-origin browser API path and local Vite proxy to address potential cross-site session-cookie failures.
- Added Express production frontend hosting and API-specific JSON 404, plus API no-store cache headers.
- Added accessible mobile sign-out control.
- Extended opt-in API smoke-test script; **not yet executed against MongoDB**.
- Verified existing 32/32 domain tests and JS/JSX/CSS syntax. React bundle remains blocked until npm install succeeds.


## v1.3 analytics continuation (2026-11-07)

- Added MongoDB-backed monthly overview chart and seven complementary reporting visualizations with managers-only team workload chart.
- Added cohort and SLA formatters plus validated 3/6/12-month report windows.
- Updated demonstration fixture generator to include 36 fictional service tickets across several months.
- Added eight unit tests, bringing the local suite to **40 passing tests**.
- npm dependency installation timed out; therefore frontend production build and live MongoDB integration are still unverified.
- See `RELEASE_CHECK_v1_3.md` for release verification and reporting limitations.

## v1.4 industry baseline (2026-11-07)

- Added policy-change audit history, role-scoped CSV analytics, request IDs, structured access logs, health/readiness endpoints and expanded security documentation.
- Local domain tests reached 47 passing; frontend bundle and live MongoDB integration remained unverified.

## v1.5 session hardening (2026-11-09)

- Added `userSessions` as a server-side registry for JWT `jti` values. Protected requests now require an active, unexpired database record as well as a valid JWT.
- Logout revokes the record before clearing the cookie; a copied cookie should be rejected on subsequent requests.
- Added TTL index creation at startup and stable JSON parser error responses for malformed/oversized payloads.
- Added six pure unit tests for session expiry and revocation, bringing the suite to **53 passing tests**.
- Expanded the opt-in live API smoke script to 18 checkpoints, including logout/replay rejection. It has not been run against MongoDB here.
- Backend syntax checks pass. `npm install` timed out and `npm run build` reports `vite: not found`; the production React build, MongoDB integration and browser QA remain unverified.
