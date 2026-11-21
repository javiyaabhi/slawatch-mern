# Release and verification checklist — SLAWatch v1.3

## Changes in this iteration

- Added a 6-month ticket-inflow area chart to Overview.
- Redesigned Analytics with **area, donut, horizontal bar and stacked bar** visualizations plus a workload detail table.
- Added an authenticated and validated 3/6/12-calendar-month reporting parameter (`GET /api/metrics/analytics?months=6`).
- Calculated SLA outcome breakdown, compliance per priority, and ticket age distribution through MongoDB aggregations; no hardcoded chart values.
- Scopes charts to the logged-in agent or all team tickets for managers, always excluding archived records.
- Added indexes for dashboard/report cohort queries.
- Expanded the optional demo-only seed to 36 fictional tickets across several months.
- Added 8 pure reporting tests and extended the opt-in smoke script to 14 checkpoints.

## Verified in the current execution environment

- `node --test server/tests/*.test.js`: **40 passing, 0 failing**.
- Backend JavaScript `node --check`: **passed**.
- CSS parsed with a CSS parser: **passed**.
- ZIP archive integrity: **passed**.

## Not yet verified

- `npm install` timed out because npm dependencies could not be downloaded here.
- `npm run build` (Vite / React JSX production compile) requires successful dependency installation.
- Live MongoDB Atlas queries and 14-step integration smoke test require an accessible MongoDB replica set.
- Manual chart rendering, browser tooltip behavior, layout and accessibility still need testing on a running app.

## Live database and browser verification

1. Install a current Node.js LTS version, then `npm install`.
2. Create `.env` files from the included examples and configure a **disposable** MongoDB Atlas development database.
3. `npm run seed:manager`, then optionally `ALLOW_DEMO_SEED=yes` plus a safe development-only `SEED_DEMO_AGENT_PASSWORD` in `server/.env`, and `npm run seed:demo`.
4. `npm test`, `npm run build`, `npm run dev`.
5. Sign in as manager; inspect Overview and Reports with 3, 6, 12 months. Confirm labels, empty states, hover tooltips, legends and all bar/donut/area charts.
6. Sign in as agent; confirm no full-team chart/table appears and only assigned ticket analytics are visible.
7. Create an urgent ticket, resolve it, change statuses and verify chart metrics change after refresh.
8. Archive an eligible resolved ticket; verify it disappears from active analytics but remains visible in the archive register.
9. Against the **disposable database only**, run `SMOKE_WRITE_TEST=yes npm run smoke:api` and confirm 14 checkpoints pass.
10. Verify phone/tablet/desktop layouts; collect actual screenshots for faculty. Never label seeded demo records as real corporate data.

## Interpretation and limitations

- All report panels use a creation-time cohort, not a separate period filter for closure date.
- The second area-series means **now resolved among tickets opened in that month**; it does not measure monthly closures.
- At-risk means >=80% SLA time elapsed while unresolved and not yet overdue.
- Compliance by priority uses only resolved tickets in its denominator; if none are resolved, no percentage is displayed.
- Stage-duration averages use completed transitions only; ongoing stage time is not included.
- SLA time is continuous and includes nights/weekends; there is no business-hours calendar.
- Charts show genuine database aggregations once connected. Optional demo records are fictional and marked as such in the seed code/docs.
