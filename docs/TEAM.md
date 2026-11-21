# Eight specialist workstreams — SLAWatch

These are eight **expert-role assignments for the development process**, not eight independently spawned background agents. Work is coordinated within this deliverable; each role has explicit acceptance criteria. Workstream ownership below is a planning convention, not a claim about autonomous agent execution.

| # | Role / expertise | Responsibilities | Evidence in repository | Definition of done |
|---|---|---|---|---|
| 01 | Product Research & MIS Analyst | Research how service desks measure SLA, define exact scope/metrics | `docs/PRODUCT.md`, analytics explanations | Business problem, actor stories and formulas described clearly |
| 02 | Product UI/UX Designer | Consistent typography, dense readable tables, accessibility, responsive screens | `docs/DESIGN.md`, `client/src/styles.css` | Legible mobile + desktop, no decorative filler, human-written labels |
| 03 | Solution Architect | ER/data-flow diagrams, API contracts, role matrix, transaction boundaries | `docs/SYSTEM_DESIGN.md` | Every UI page maps to a documented API and collection |
| 04 | React Frontend Engineer | Login, dashboard, ticket register/detail/new, reports, policies/team | `client/src` | Functional navigation, forms, loading/error/empty states |
| 05 | Express/Node Backend Engineer | Routes, controllers, services, valid state transitions | `server/src/routes`, `controllers`, `services` | Consistent HTTP errors and route separation |
| 06 | MongoDB Data Engineer | Schemas, indexes, aggregation pipelines, transactions, audit events | `server/src/models`, `controllers/metrics.js` | Strong relationships, coherent history, accurate metrics |
| 07 | Security Engineer | Access control, authentication, cookies, CSRF, input checks, rate limits | `server/src/middleware`, `docs/SECURITY.md` | No cross-agent data exposure or unauthorized updates |
| 08 | QA & Release Engineer | Unit tests, manual scenario checklist, environment templates, seed tooling | `server/tests`, `docs/QA.md`, README | Evidence-backed tests and honest release notes |

## Dependency order

01 Research → 03 Architecture → 05 Backend & 06 Database → 07 Security audit → 04 Frontend integration → 08 QA. Role 02 develops the design language in parallel after product scope is known.

## Project scope freeze

Do not add AI-generated ticket summaries, predictive ML, emailing, websocket chat, OCR or bloated admin modules to Version 1. Focus on working calculations, proper permissions and a dependable interface. Student submission quality depends on demonstrated functionality, not the count of features.
