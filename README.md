# SLAWatch

**A focused IT Service Performance & Bottleneck Analytics MIS** built using MongoDB, Express.js, React.js and Node.js.

Built as an MCA Semester 1 project. It is deliberately small: the system manages service requests, measures how quickly they are resolved, highlights items nearing their deadlines and shows managers which steps slow down service delivery. No AI API, Python backend, relational database or paid third-party service is required.

## Industry-style implementation — v1.5

The product remains deliberately **single-organization** and Semester-1-sized. It adds engineering controls used in professional internal tools:

- **Auditability:** SLA policy edits and ticket state changes have actor-attributed, append-only records. Policy changes use a MongoDB transaction with their audit event.
- **Decision-ready reporting:** dashboards and CSV exports share one MongoDB aggregation engine and one selected reporting period. Aggregate exports contain no ticket descriptions or account credentials, and escape spreadsheet formulas.
- **Operations:** request correlation IDs (`X-Request-ID`), sanitized structured server request logs (no request bodies, passwords or query strings), and separate `/health/live` and `/health/ready` checks.
- **Security boundaries:** server-enforced manager/agent permissions, CSRF checks, bounded input, conservative caching, and revocable cookie-based sessions. Sensitive actions are not guarded merely by hiding frontend controls.
- **Testability:** pure-function tests, optional live API smoke test and a starter CI workflow. Live integration, browser and accessibility verification are mandatory before any production claim.

### Important limits

This is **industry-informed engineering, not certified enterprise software**. It has not been penetration tested or load tested; there is no multi-tenant isolation, SSO, corporate IAM integration, audit log tamper-evidence, alert delivery service, backup/restore runbook, or formal SLA support-hours calendar. It must not be used with real corporate or personal data until reviewed, tested, and appropriately hosted.

## What works in the source

- JWT session authentication in HttpOnly cookies (8-hour expiration) backed by revocable `userSessions` records; logout invalidates the server-side session, and a TTL index expires old records. A manager account is seeded explicitly.
- Audit history for SLA target changes, visible to managers only.
- Downloadable CSV export of role-scoped analytics with spreadsheet formula injection mitigation.
- Request IDs for troubleshooting, JSON access logs and graceful process shutdown.
- Two roles: **manager** (all tickets, user accounts, SLA policies) and **agent** (assigned tickets, ticket statuses, own analytics).
- Ticket creation, search, pagination, status updates and manager-only editing.
- Full audit history stored as separate `ticketEvents` documents.
- Rule-based SLA risk: at risk >= 80% of the time used, breached after target; historical breaches remain measurable on resolved tickets.
- Six MongoDB collections (`users`, `userSessions`, `tickets`, `ticketEvents`, `slaPolicies`, `policyChanges`), with compound indexes and real aggregation pipelines for analytics.
- Manager-only soft archiving of resolved tickets, preserving audit history in the database.
- Responsive interface with real loading, error, and empty states; no placeholder KPIs.
- Optional demo fixture seeding, explicitly disabled by default.
- Pure-domain Node test suite; see QA.md for checks requiring a running server.

## Requirements

- Node.js 20.19+ or compatible newer Node LTS (Vite 6 can also run on many Node 18+ versions, but use an actively supported LTS for security).
- npm.
- MongoDB Atlas cluster or another MongoDB **replica set**. The application uses MongoDB multi-document transactions for audit-safe ticket mutations; a default standalone local mongod without replica-set support is insufficient.

## Quick start

```bash
unzip SLAWatch_MERN_v1_4_Industry_Baseline.zip
cd slawatch-mern
npm install
cp server/.env.example server/.env
cp client/.env.example client/.env
```

On Windows, manually duplicate each `.env.example` if the `cp` command is unavailable. Edit `server/.env`:

- `MONGO_URI` — MongoDB Atlas connection string for a **development** database.
- `JWT_SECRET` — secure random string with at least 32 characters. Generate it locally using `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- `CLIENT_ORIGIN` — exact frontend origin, default `http://localhost:5173`.
- `SEED_MANAGER_EMAIL`, `SEED_MANAGER_PASSWORD` (minimum 12 characters), `SEED_MANAGER_NAME` — your first manager credentials.

The frontend uses `VITE_API_URL=/api` by default. **Keep this relative URL**: in development Vite proxies `/api` to Express, and for production Express serves the built React app on the same origin. This is simpler and more reliable for session cookies and CSRF.

**Create the first manager:**

```bash
npm run seed:manager
```

**Start the full MERN app:**

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API (through Vite): `http://localhost:5173/api` (also directly at `http://localhost:5000/api`)
- Health check: `http://localhost:5000/health` (503 when MongoDB disconnected)

Sign in with the manager credentials from `server/.env`. Visit **Team** to create agent accounts. You can then create and assign tickets.

### Optional sample tickets

Only for a *disposable development database*, set these values in `server/.env`:

```dotenv
ALLOW_DEMO_SEED=yes
SEED_DEMO_AGENT_PASSWORD=A_UNIQUE_DEMO_PASSWORD_AT_LEAST_12_CHARACTERS
```

Then run `npm run seed:demo`. This seeds five fictional agents (`aarav.demo@example.invalid`, `mira.demo@example.invalid`, `rohan.demo@example.invalid`, `priya.demo@example.invalid`, and `kavita.demo@example.invalid`) and 60 realistic demo tickets (`SW-CLASS-001` through `SW-CLASS-060`) backed by `data/dataset.csv` and `data/dataset.json`. It includes 45 resolved tickets (with single and two-stage workflow histories), 7 in-progress tickets, and 8 open tickets across all 5 categories and 4 priority levels. Do not run it against real or production records. These fixtures populate your overview, dashboard, reports, and agent workload analytics with realistic distributions.

## App map

| Page | Role | Purpose |
| --- | --- | --- |
| `/login` | Public | Account login |
| `/` | Signed-in | Overview, at-risk tickets, completion metrics |
| `/tickets` | Signed-in | Search, filter, paginate |
| `/tickets/new` | Signed-in | Create ticket (agents self-assign) |
| `/tickets/:id` | Assigned agent / manager | Ticket details, history, stage updates; manager edit/archive |
| `/reports` | Signed-in | Downloadable CSV export plus filtered 3/6/12-month cohort analysis: monthly inflow, SLA outcome donut, category/priority/aging distributions, stage duration, priority compliance, manager workloads |
| `/team` | Manager | List/create agents |
| `/policies` | Manager | Configure targets for new tickets and inspect policy change audit history |

## Tests and delivery checks

```bash
npm test
npm run build
```

Use the deployment and manual test checklist in [`docs/QA.md`](docs/QA.md). For a complete integration test, start a real Atlas development database and exercise the test cases under both manager and agent accounts. Never represent a successful unit test as proof that every React screen or database transaction has been verified.

## Additional documents

- [`docs/TEAM.md`](docs/TEAM.md) — eight specialist workstreams and deliverables.
- [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md) — architecture, ER diagram, data flow and endpoint contracts.
- [`docs/PRODUCT.md`](docs/PRODUCT.md) — scope, requirements, use cases, meaningful analytics definitions.
- [`docs/DESIGN.md`](docs/DESIGN.md) — interface design rationale, accessibility and animation constraints.
- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model, middleware, limitations and production hardening.
- [`docs/QA.md`](docs/QA.md) — test scenarios and release gates.

## Single-origin production deployment (v1.2)

This project now supports hosting React and Express from **one Node.js service** instead of relying on cross-domain cookies. Build the frontend before starting the production API:

```bash
npm install
npm run build
# Set NODE_ENV=production, CLIENT_ORIGIN=https://your-app.example, real JWT_SECRET,
# and MONGO_URI in server/.env (or your host's secret configuration).
npm run start -w server
```

The server serves `client/dist` for frontend routes and the same-origin `/api` for backend routes. Configure your host to terminate HTTPS and forward requests to the Node process. Set `CLIENT_ORIGIN` to the **exact HTTPS origin** shown in your browser address bar, with no trailing slash. Do not use the sample secrets or Atlas credentials in production. Confirm `https://your-app.example/health` returns 200 only when MongoDB is connected.

With Vite development server, the browser sends API requests to `http://localhost:5173/api`, and Vite proxies them to Express on port 5000. This means the browser's session cookie stays on the same origin. The `server/.env` development value `CLIENT_ORIGIN=http://localhost:5173` is still correct.

## Limitations (transparent)

- SLA targets count continuous elapsed hours, **not business hours or holidays**.
- No real-time alerts, chat, automatic ticket assignment, ticket reopen, file uploads or trained ML.
- Review controls and reporting assumptions with your faculty before final submission.
- Source was authored here and validated with backend Node syntax checks, frontend JavaScript/JSX parsing, CSS parsing, and pure-domain tests. **npm dependencies could not be installed and MongoDB could not be connected in this environment**, so the Vite production bundle, integrated API smoke test and browser QA still require verification on your computer.

## Semester demonstration scenario

1. Sign in as the seeded manager; create two agents.
2. Set High priority SLA to 8 hours.
3. Create and assign a High ticket; show its MongoDB document and deadline.
4. Sign in as the assigned agent and mark it in progress, then resolved.
5. Show the application-maintained ticket-events timeline and explain the transaction.
6. Open Analytics; demonstrate aggregation-derived trends and stage durations.
7. Try viewing a colleague's ticket as an agent (expect denial); try accessing `/team` (expect denial).
8. Show a manager archiving a resolved ticket while retaining its history in MongoDB.


## Historical ticket register (v1.1)

Managers can open **Tickets → View archive** to inspect archived, resolved tickets and their audit history. The endpoint is `GET /api/tickets?archived=1`; agents receive HTTP 403. Archived records remain read-only and are not included in SLA dashboards or active reporting. Regular `GET /api/tickets` never returns archived records.


## Live API smoke test (explicit opt-in; v1.1)

**This test WRITES to MongoDB. Run only on a disposable development database.** It creates a temporary agent, an assigned ticket, a sequence of status events and an archive record. It intentionally does not remove audit records.

1. Start the API and ensure MongoDB Atlas (replica set) is connected.
2. Seed the manager using the `seed:manager` script; make sure `server/.env` contains the same `SEED_MANAGER_EMAIL` and `SEED_MANAGER_PASSWORD`.
3. From the project root run:

```bash
SMOKE_WRITE_TEST=yes npm run smoke:api
```

On Windows PowerShell, run `$env:SMOKE_WRITE_TEST='yes'; npm run smoke:api`. The script checks 18 API stages (login, agent creation, ticket creation, permissions, status history, archive access, active/archive isolation, and analytics). The script requires an already running API and does **not** fake MongoDB results. `SMOKE_BASE_URL` and `SMOKE_CLIENT_ORIGIN` override local defaults. Never aim it at a production database.

## v1.2 verification and handoff

- New deployment architecture: same-origin `/api` in local development and production (Vite proxy + Express static frontend).
- Mobile sign-out remains accessible even when the desktop sidebar account section is hidden.
- Extended opt-in API smoke check exercises authentication failures, missing CSRF token, invalid payloads, agent isolation, SLA deadline correctness, archive isolation and analytics scoping. It is **not** counted as a passed live test until MongoDB is connected.
- Local tests: 32/32 passing. Frontend source parse: 14 JS/JSX files, 0 syntax diagnostics; stylesheet parsed. Full Vite build still unverified due unavailable npm packages. See [`docs/RELEASE_CHECK_v1_2.md`](docs/RELEASE_CHECK_v1_2.md).

## v1.3: Multi-chart decision dashboard

The **Overview** now includes a six-month area chart of ticket inflow, populated by an authenticated MongoDB aggregation. The **Analytics** page has an adjustable **3 / 6 / 12 calendar-month** report window and these complementary views:

| Visualization | Question answered | Calculation / denominator |
| --- | --- | --- |
| Area chart | When was demand highest? | Tickets by UTC creation month; second series shows how many from each month are resolved *now* |
| Donut chart | How healthy are SLA outcomes? | Five disjoint categories: resolved on time, resolved late, open on track, open at risk, open overdue |
| Horizontal bar | Which issue categories dominate? | Ticket counts by category |
| Horizontal bar | How urgent is the workload? | Ticket counts by priority |
| Horizontal bar | Which workflow stage takes longer? | Mean hours from completed status transitions only |
| Horizontal bar | Which priorities meet their SLAs? | Tickets resolved on time ÷ **resolved tickets** for that priority; no data shown as not available |
| Horizontal bar | How old is the backlog? | Unresolved tickets grouped into 0–4h, 4–24h, 1–3d and >3d |
| Stacked bar (manager only) | How is work distributed? | Assigned active + resolved tickets, by employee |
| Table (manager only) | How does the team resolve cases? | Assigned/active/resolved counts and average resolution time |

**Metric definitions:** The filter selects tickets **created** within the past 3, 6 or 12 calendar months including the current UTC month. All reports exclude archived records, use the same reporting cohort, and only include records permitted by the logged-in user's role. "Now resolved" is a creation-month cohort outcome; it is **not** a count of closures occurring within that month. No empty group is presented as 0% compliance. SLA windows are continuous 24/7 elapsed hours, not business hours. These are descriptive statistics, not machine-learning predictions.

To demonstrate several months of trends, the optional development-only demo seed now provides 36 explicitly fictional support tickets spread across approximately six months. The seed remains **disabled by default** and must never run against live organizational data.

### v1.3 verification scope

- Node domain tests: **40 passing** (including 8 report-calculation tests).
- Backend JavaScript syntax: checked locally.
- CSS syntax: parsed locally.
- Live browser/build/MongoDB integration: **not yet verified**, because npm package downloads timed out in this execution environment. Follow `docs/RELEASE_CHECK_v1_3.md` for the remaining steps.


### Operational endpoints and new reporting export

- `GET /health/live`: process is alive, regardless of MongoDB status.
- `GET /health/ready`: `200` only when MongoDB is connected; use for deployment readiness.
- `GET /api/metrics/analytics.csv?months=3|6|12`: authenticated, role-scoped CSV analytics report.
- `GET /api/policies/history`: manager-only last 30 immutable policy-change entries.
- Each API response includes an `X-Request-ID`; correlate this with server JSON logs without exposing sensitive request bodies.

The existing `/health` endpoint remains available for older deployment checks. Use a limited-retention, access-controlled log collector in a real deployment; the source only writes structured log lines to standard output.


## v1.5: revocable sessions and safer request errors

- Each successful login creates a `userSessions` record linked to the user, with an eight-hour expiry. Protected requests verify both the signed JWT and its active server-side session record.
- Logout marks the server-side session revoked before clearing the cookie; reusing a copied cookie after logout is rejected. A MongoDB TTL index removes expired session records asynchronously (expiry checks do not depend on TTL cleanup).
- Malformed JSON returns a stable HTTP 400 response; oversized JSON bodies return a stable HTTP 413 response without exposing parser internals.
- The opt-in live API smoke script now includes a logout/replay check. It has not been run until a disposable replica-set database and API are available.
- Current local verification: 53 Node unit tests and backend syntax checks pass. The Vite production build, live MongoDB smoke test and browser checks remain pending.
