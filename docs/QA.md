# Verification and release checklist

## Automated local checks

```bash
npm test
npm run build
```

The Node pure-domain tests cover SLA boundaries, status transitions, percentages, scope checks and archive conditions. The browser/Vite build must be executed on a machine where npm packages can be installed. Tests needing MongoDB cannot be run without a replica set and seeded accounts.

## Manual integration test cases (must run before claiming completion)

| # | Test | Expected result |
|---|---|---|
| 01 | Seed manager twice | First creates, second detects existing account without duplicate |
| 02 | Login with wrong password | 401 with generic error |
| 03 | POST protected route without CSRF | 403 |
| 04 | Create agent with 8-character password | 400 validation error |
| 05 | Manager creates agent | New active agent, passwordHash never sent in response |
| 06 | Agent creates ticket with `assignedTo` set to another user | Service enforces self-assignment |
| 07 | Agent accesses another agent's ticket ID | 403 (must not return ticket content) |
| 08 | Agent accesses `/api/users` or PATCH policies | 403 |
| 09 | Create ticket with missing description | 400 |
| 10 | Manager creates High priority ticket | Due at creation+policy target; history includes creation |
| 11 | Manager changes policy after ticket creation | Existing ticket keeps original SLA deadline |
| 12 | Assigned agent changes open → in_progress → resolved | Each change appears in events with actor/time |
| 13 | Update resolved ticket | 409 (immutable) |
| 14 | Concurrent status changes on same ticket | Exactly one succeeds, other conflict/rollback |
| 15 | Manager archives resolved ticket | Disappears from active list/reports, archive event retained in DB |
| 16 | Archive open ticket | 409 |
| 17 | Filter by status/category/priority/search | Matches only visible records, paginated |
| 18 | Ticket crosses 80% SLA threshold | 'At risk' display and aggregate counters |
| 19 | Ticket exceeds deadline | 'Breached' even when no status change occurs |
| 20 | Resolved late vs resolved on time | Compliance rate based on `resolvedAt` |
| 21 | Empty database / no matching search | Meaningful empty states and zero/null metrics |
| 22 | API backend unavailable | User-readable request error, not infinite loading |
| 23 | Mobile viewport / keyboard-only | Navigation usable, focus visible and table scrollable |
| 24 | Logout / reload | Protected application unavailable without login |
| 25 | Reuse a copied session cookie after logout | API rejects the revoked session with HTTP 401 |
| 26 | Send malformed JSON | API returns stable HTTP 400 JSON error |
| 27 | Send JSON body larger than 64 KiB | API returns HTTP 413 without parser internals |

## Smoke-test sequence

1. Start backend with a reachable Atlas **development** cluster.
2. `npm run seed:manager`; sign in through React.
3. Create agents under Team.
4. Create a High-priority ticket, open details, change status.
5. Resolve it, inspect `tickets` and `ticketevents` in MongoDB Compass.
6. Verify overview/reports move accordingly and display historical metrics.
7. Log in as another agent and attempt to reach the first agent's ticket by URL.
8. Revisit policy page as manager, modify target and create a new ticket.
9. Archive a resolved ticket; prove `archivedAt` and `archived` event remain.

## Submission deliverables

- Git repository with working source, sanitized README and `.env.example`.
- Actual screen recordings or screenshots **after running** the project: login, overview, tickets, history, analytics, policy and team screens.
- ER diagram, architecture, API table and key algorithms (found in `docs/SYSTEM_DESIGN.md`).
- Test evidence captured on the working database. Distinguish passes from unexecuted tests.
- `package-lock.json` after an actual npm install, and `npm audit` output if available.


### Repeatable end-to-end smoke test (not executed here)

After confirming the environment points to a disposable MongoDB replica set, start the API and use `SMOKE_WRITE_TEST=yes npm run smoke:api`. The expanded 18-check script covers invalid credentials, missing CSRF, malformed payloads, exact SLA targets, cross-agent read/write isolation, unauthorized administration, status history, manager archive, and analytical scoping. It leaves records behind; do not run on production.

## Production / mobile-specific regression checks (v1.2)

- With local Vite server, inspect Network: API calls must target `http://localhost:5173/api/...`, not a hard-coded cross-origin port.
- On an HTTPS production host, reload `/tickets/<id>` directly; React should load through the Express SPA fallback.
- `GET /api/does-not-exist` must produce JSON HTTP 404, **not** React index.html.
- Confirm `Set-Cookie` has `HttpOnly`, `Secure` in production, and `SameSite=Lax`.
- At 375px viewport, confirm the sign-out icon in the top bar remains usable with keyboard and touch.
- Verify reverse-proxy HTTPS and `CLIENT_ORIGIN` match actual host; do not deploy a separate frontend domain without re-evaluating cookie and CSRF settings.


### Visual analytics regression checklist (v1.3)

- Reporting period buttons/select for 3 / 6 / 12 months update charts and request filters. Invalid `?months=24` is rejected with HTTP 400.
- Monthly area trend has zero-filled months and labels its second series "Now resolved" (a creation cohort, not closure-by-month).
- SLA donut totals equal category and priority totals in the same cohort; risk and breach are separate from on-time completed tickets.
- Priority SLA compliance excludes unresolved tickets from the denominator; display N/A when no resolutions exist.
- Open-ticket age bars sum to the active ticket count from that same report cohort.
- Stage-duration bars require completed transitions and do not include ongoing stage time.
- Agents cannot view team workload aggregates. Both manager and agent reports exclude archived records.
- All charts work with zero tickets (descriptive empty state), a single ticket, and demo seed data.
- Verify smartphone width 360px, tablet width 768px and desktop width 1440px for legend overflow, labels and hover/focus interactions.


### Session lifecycle regression checks (v1.5)

- Successful login creates one `userSessions` record with the JWT `jti`, user ID and eight-hour expiry.
- `/api/auth/me` succeeds while the matching record is active and unexpired.
- Logout sets `revokedAt` and clears the cookie. Replaying the pre-logout cookie must receive HTTP 401.
- An expired or missing session record is rejected even if the MongoDB TTL monitor has not deleted the document yet.
- Verify the `userSessions.sessionId` unique index and `expiresAt` TTL index exist in MongoDB Atlas.
