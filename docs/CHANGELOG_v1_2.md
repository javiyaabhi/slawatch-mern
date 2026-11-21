# SLAWatch v1.2 — verification and deployment hardening

- **Architecture:** Changed client API default to `/api` and added Vite `/api` + `/health` development proxies.
- **Release:** Express serves `client/dist` in production and returns JSON 404 for unknown API routes.
- **Security:** API responses marked `Cache-Control: no-store`; same-origin session/cookie flow preferred; fixed mobile sign-out access.
- **QA:** Expanded write-gated smoke test to 13 checkpoints, including CSRF rejection, invalid input, cross-agent record isolation and exact SLA policy snapshots.
- **Documentation:** Added browser, reverse-proxy, static frontend and smoke-test checklists.

## What was verified here

- 32 / 32 pure-domain and permissions tests passed.
- Backend and smoke-test JavaScript syntax passed.
- React JavaScript/JSX syntax parsed (14 files, 0 diagnostics) with a local TypeScript transpilation check; CSS parsed with PostCSS. This does **not** validate React imports or app behavior.
- Vite build **did not complete** because npm package installation was unavailable.
- Live MongoDB, deployed HTTPS and browser tests **not executed**.
