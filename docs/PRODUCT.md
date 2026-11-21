# Product brief — SLAWatch

**Who uses it:** A small internal IT team: one service manager, several support agents.

**Problem:** IT tickets become delayed because responsibility, resolution deadlines and historical bottlenecks are spread across messages and spreadsheets. Managers need a lightweight MIS to see which tickets are at risk, which queues are large, and how long cases take to resolve.

**Value:** One operational ticket register plus reports computed from the same MongoDB records. No invented business metrics in the interface.

## Roles

- **Manager:** Creates agent accounts, creates/assigns/edits tickets, sets SLA policy, views all reports, archives resolved tickets.
- **Agent:** Signs in, creates self-assigned tickets, sees assigned tickets only, updates their statuses and analyzes their own work.

## Functional requirements

1. Authentication required for every business endpoint; manager permission required for team/policies/archive.
2. Required ticket fields: title, description, category, priority, assigned agent.
3. Valid statuses: `open`, `in_progress`, `resolved`. Resolved tickets become read-only.
4. SLA rule: target hours saved on ticket creation. At risk once >=80% consumed; breached if overdue. Resolved tickets are marked met/breached according to actual resolution timestamp.
5. History: every creation, edit, stage change and archive creates `ticketEvents` audit entry.
6. Analytics: total ticket count, backlog, at-risk/open breaches, resolved-within-target %, average resolution hours, creation trends, distribution, stage duration, workload.
7. Filters/pagination on tickets; manager can archive completed records without destroying audit history.

## Non-functional requirements

- Secure passwords, HttpOnly session cookie, explicit CSRF on writes, input validation, role-based authorization, rate-limited logins, constrained CORS.
- Database indexes, paginated ticket list, bounded payload sizes.
- Meaningful loading, empty, error and success states; keyboard navigation and reduced-motion support.
- Works as self-contained MERN application without unrelated frameworks or externally hosted data science services.

## Metrics dictionary

| Metric | Definition | Important caveat |
|---|---|---|
| Active workload | Tickets whose `status != resolved` | Archived excluded |
| Open SLA breaches | Active tickets with `slaDueAt < now` | 24/7 time |
| At risk | Active, not overdue, elapsed >= 80% target | Rule-based alert, not a forecast |
| On-time resolution rate | Resolved tickets closed <= their stored `slaDueAt` / resolved tickets | Null when no resolved tickets |
| Average resolution | Average `resolvedAt - createdAt` for resolved tickets | Not average current age |
| Stage bottleneck | Average duration in a prior status for completed status transitions | Ongoing stages excluded |
| Team active workload | Active tickets grouped by assignee | Workload count does not equal workload complexity |

## Out of scope

External tickets inbox, work-hour calendars, escalation emails, attachments, integrated identity provider, AI/ML predictions, forecasting, public sign-ups. These are future improvements, not missing core requirements.
