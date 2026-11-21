# SLAWatch v1.2 — release acceptance sheet

**Run date:** 2026-10-25. **Status:** source revision, not a verified production release.

| Verification | Result | Explanation |
|---|---|---|
| Node domain + authorization tests | PASS (32/32) | `npm test` |
| Backend JavaScript syntax | PASS | `node --check` on server source files |
| API smoke-script syntax | PASS | `node --check scripts/smoke-api.mjs` |
| Frontend JS/JSX syntax | PASS (14 parsed) | Locally available TypeScript parser; no Vite linking or module resolution |
| CSS parse | PASS | Locally available PostCSS parser |
| React Vite build | BLOCKED | npm packages not available; `vite: not found` |
| MongoDB end-to-end API checks | NOT RUN | No live replica set / seeded test accounts |
| Browser accessibility / mobile inspection | NOT RUN | Requires running frontend in a browser |
| HTTPS production deployment | NOT RUN | Requires hosting and configured secrets |

## Required steps on a development machine

1. `npm install` in the root with Node.js 20.19+; keep the generated `package-lock.json`.
2. `npm test` and `npm run build` (must both succeed).
3. Prepare a **disposable MongoDB Atlas development database** and local `.env` files using `.env.example`.
4. `npm run seed:manager`; `npm run dev`; sign in.
5. Run `SMOKE_WRITE_TEST=yes npm run smoke:api` on the disposable database. This writes permanent test records.
6. Manually test two different agents; capture screenshots and verify complete ticket lifecycle and analytics against MongoDB.
7. Inspect layout at 375px, 768px and desktop widths; test keyboard navigation and sign-out on mobile.
8. Confirm static frontend SPA fallback and `/api` JSON 404 in single-origin HTTPS production preview.
9. Rotate demo secrets, limit Atlas access, inspect `npm audit`, and capture final Git commit/README/report.

Do not claim all tests passed until the blocked and unrun cases have been completed.
