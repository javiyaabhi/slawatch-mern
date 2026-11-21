# SLAWatch v1.1 — continuation changelog

## Delivered

1. Added manager-only archived ticket register (`/tickets?archived=1`). Historical records remain in MongoDB and are intentionally excluded from live reporting.
2. Changed ticket read permissions: archived tickets remain readable to managers only, but **never editable**.
3. Added archive navigation, archived-status labels, archival timestamp, and read-only history in React.
4. Added nine regression checks around archived-ticket scope and access; total: 32 pure domain tests.
5. Added an explicitly opt-in live API smoke test covering two roles, session cookies, CSRF, ticket creation, status changes, audit events, archive isolation, and analytical responses. Requires an actual running Express API and a disposable MongoDB replica set.
6. Updated README, system design, security notes, QA and implementation status.

## Eight-role workstreams / code ownership

- **Research & MIS:** Archived tickets excluded from operational measures; history retained for audit use.
- **UX Design:** Compact archive navigation, no additional decorative screens.
- **Architecture:** Archive read versus active write permissions separated in business rules.
- **React:** Manager archive interface and read-only record detail.
- **Express:** Archive query parameter, validation and role enforcement.
- **MongoDB:** Database scopes retain historical records, existing audit events stay linked.
- **Security:** Archive endpoints require manager identity; agent access blocked.
- **QA:** Regression tests and a repeatable live API journey.

## Verification and limits

- Executed locally: 32/32 pure-domain tests passed; server JavaScript syntax checks passed; local ES module import references verified.
- Not verified here: production React build, browser visuals, actual database transactions, and smoke-test runtime. npm registry access is unavailable in this environment.
- Must finish before submission: `npm install`, `npm run build`, `npm test`, live API smoke test on a disposable Atlas database, mobile/desktop browser QA, and deployment verification.
