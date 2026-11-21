# SLAWatch — industry-readiness review (v1.5)

This is a pragmatic engineering standard for an **MCA first-semester, single-organization** MERN application. It is not a claim of production certification.

## Product boundaries

- Audience: IT support agents and one organization’s managers. No registration or public customer portal.
- Decision metrics: monthly ticket cohort, mean resolved duration, 24/7 SLA compliance, at-risk counts, stage-duration bottlenecks, priority and category distribution, open backlog age, agent workload.
- SLA targets are snapshots at ticket creation; editing policies affects future tickets only. Changing a ticket's priority explicitly recalculates that ticket's deadline. Archived tickets do not appear in active MIS.
- No AI predictions, SSO, multi-tenancy or paid services.

## Controls already in source

1. **AuthN/AuthZ:** 8h HttpOnly JWT cookie backed by a revocable MongoDB session record, CSRF token and origin checks, manager/assigned-agent permission checks on individual records and analytics queries.
2. **Input boundary:** Zod strict schemas, bounded ticket search/page, whitelisted periods, controlled state transitions.
3. **Integrity:** MongoDB transactions for ticket updates with an event; SLA policy update + audit change event in a transaction; status updates use optimistic concurrency.
4. **Observability:** no-cache API responses, request ID and structured request outcome logs, separate process liveness and DB readiness, graceful HTTP+MongoDB shutdown.
5. **Export:** role-scoped CSV rendered from the *same* backend calculations as charts; spreadsheet formula-like values are neutralized. Exports do not include description text or password hashes.
6. **Product ergonomics:** empty, loading, error states, meaningful analytics labels, manager-only workflows, simple responsive styling.

## Risk register / blockers before hosting real users

| Priority | Risk | Required next action |
|---|---|---|
| Blocker | React build not run in this execution environment | On a networked machine run `npm install && npm run build` and fix any errors |
| Blocker | No connected MongoDB was available | Run smoke script against a **disposable Atlas dev replica set**, then manually test all roles |
| Blocker | Browser interactions unverified | Test desktop/mobile, keyboard navigation, accessible names, charts and CSV download |
| High | No reproducible committed dependency lockfile | Generate and commit `package-lock.json` after npm install, switch CI to `npm ci` |
| High | Session revocation is now server-side, but no user-facing session inventory or rotation | Add session management and rotation if deploying beyond a small internal tool |
| High | API rate limiting uses process memory | Adopt shared store and controlled proxy trust when deployed behind multiple processes |
| High | No backup/restore test | Configure Atlas backups and test restoring from a disposable snapshot |
| High | No formal pentest/load test | Conduct OWASP API authorization checks and representative load tests |
| Medium | One organization only | Explicitly limit deployment to one organization; do not promise multi-tenant isolation |
| Medium | Policy audit is append-only at application layer | Restrict DB write permissions; external tamper-evidence is future scope |
| Medium | Logs written to stdout only | Use access-controlled log collection and a documented retention policy |

## Acceptance criteria for academic demonstration

- Manager logs in, creates two agents, creates a ticket, sees deadline.
- Assigned agent sees only their ticket and can change only status.
- Other agent cannot read or update that ticket, even by manipulating a URL or ID.
- Manager modifies an SLA policy and sees the old/new target and actor in history; existing ticket retains its snapshot.
- Agent resolves a ticket; manager archives it; history remains readable only by manager.
- Reports across 3/6/12 months show mathematically consistent totals; CSV export matches chart metrics; agent CSV contains no team-wide records.
- Network failure and bad input yield understandable error messages without exposing server secrets.
- Unit tests, API smoke tests and Vite build pass on a system with installed dependencies.

## OWASP-oriented checklist

Check object-level permissions for every `:id` API route, deny object-property mass assignment, reject cross-site unsafe requests, protect login from automated guessing, do not log credentials, validate untrusted input, and use HTTPS with HttpOnly/Secure cookies. These controls align with the categories in the OWASP API Security Top 10 and can be tested with ASVS 5.0 as a requirements guide. **No OWASP certification is implied.**


## v1.5 changes

- `userSessions` records bind JWT `jti` values to active users and explicit expiry timestamps. Logout revokes the matching record; the API checks revocation on every authenticated request.
- A TTL index is used only for cleanup. Expiry authorization is checked against `expiresAt` at request time.
- Malformed JSON and oversized request bodies return stable client errors.
- Unit tests cover session lifetime, exact expiry, revocation, and malformed records. A live smoke-test step verifies that a copied cookie is rejected after logout; that step remains unverified until run against a disposable MongoDB replica set.
