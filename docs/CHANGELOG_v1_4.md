# v1.4 — professional engineering baseline

- Added transactional, append-only SLA policy change audit log and a manager-only history table.
- Added role-scoped CSV analytics export from the same aggregation logic used by charts, with spreadsheet formula injection mitigation.
- Added generated correlation IDs and sanitized structured request logs, plus separate liveness/readiness endpoints and graceful shutdown.
- Rejected ambiguously formatted page parameters and cross-site browser fetches explicitly.
- Expanded domain tests and optional live API smoke script to cover new functionality.
- Added industry readiness checklist, acceptance criteria and documented operational limits.
- No new external services or non-MERN application layer was introduced.

**Verification boundary:** Node domain tests and syntax checks are executable in the current environment; package installation, Vite production build, Atlas integration and browser QA are not verified here.
