# Interface design direction — SLAWatch

This is a work tool for support staff and managers, not a marketing landing page. The visual system should express **clarity, urgency, traceability and restraint**.

### Design influences

- **Taste Skill** (https://www.tasteskill.dev/docs): hierarchy, spacing rhythm and meaningful visual density, instead of repeating generic card grids.
- **Impeccable** (https://github.com/pbakaus/impeccable): avoids AI-template tells such as purple gradients, decorative floating icons, over-rounded widgets and random large hero text.
- **Emil Kowalski's design engineering skills** (https://emilkowal.ski/skill): small purposeful transitions, predictable interaction, and reduced-motion consideration.

These external skill packages were **not installed or executed** in this environment. Their publicly documented principles informed the design decisions. Future editors may install them if their coding tools support skill files.

### Tokens

- Sidebar: graphite-green `#17292e`, so operational content stays visually foregrounded.
- Work area: warm near-white `#f7f7f4`, panels white with hairline borders.
- Accent: deep muted teal `#285b54`, used for primary actions and focused states.
- Risk: amber for near deadline, red for breach; green for fulfilled SLA.
- Headline: Georgia serif with deliberately lower display weight; body: native UI sans for fast scanning.
- Low corner radius (3–4px), no glassmorphism, no gradients, no fake testimonials, no decorative AI illustrations.
- Dense tables are the primary working surface; empty states are written for service operators.

### Interaction requirements

- Each form uses persistent visible labels, not placeholder-only prompts.
- Status changes show confirmations and audit entries; irreversible resolution requires confirmation.
- Real failure and loading states; no fake sample KPI values in production screens.
- Mobile navigation becomes a horizontal scrollable strip, reports stack vertically and tables retain horizontal scroll where needed.
- `prefers-reduced-motion` suppresses transitions/animation.

### UI polish checklist

1. Verify focus order using Tab/Shift+Tab.
2. Test 360px and 1280px screen widths.
3. Test long ticket titles and empty MongoDB collections.
4. Avoid dense pale-gray text; adjust colors for accessible contrast.
5. Do not overanimate a serious operations interface.
