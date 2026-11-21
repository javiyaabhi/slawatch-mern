# SLAWatch v1.3 — Analytics refinement

## Product / MIS analytics

- Replaced four near-identical reporting bars with meaningful complementary chart types: monthly area trend, SLA donut, severity and category bar plots, stage-duration bar chart, age distributions, priority-level compliance, stacked team workloads, and a detailed table.
- Introduced a 3/6/12-calendar-month reporting window with a consistent creation-date cohort across panels.
- Exposed a small six-month inflow chart on the home dashboard.
- Added quantitative metric definitions and explicit chart no-data states (no invented business numbers).

## Backend / database

- Added cohort period validation, zero-filled month buckets and reusable report formatters with tests.
- Added SLA state partitions, per-priority resolved-ticket compliance and open-ticket age buckets using MongoDB aggregation.
- Preserved manager/agent record scoping and historical archive exclusion in all report panels.
- Added compound indexes for analytical creation-date queries.

## QA / demo

- Added 8 report-unit tests; total now 40 passing.
- Updated optional demo-only seed to distribute fictional service tickets over approximately six months and add realistic stage history for some tickets.
- Expanded the opt-in integration smoke check for 3/6/12 windows, invalid-period response, and cross-panel data consistency.
- npm install / Vite build / live MongoDB tests **not completed** in this environment.
