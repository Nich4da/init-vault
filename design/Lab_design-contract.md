# LAB Design Contract — Decision Record

Updated: 2026-08-30

## Goal and target artifact

Create a reusable, implementation-ready contract for converting the approved LAB one-page HTML mockup into initCraft/SDForm components without losing clinical data, workflow rules or the established compact visual pattern.

Audience: product owner, initCraft Form Builder implementer, API/Agent implementer, QA and future coding agents.

Target artifacts:

- LAB Workbench SDForm
- Result viewer and Manual-result editor
- Reject/cancel/retest dialogs
- Agent/API data bindings and status synchronization

## Evidence

| Evidence | Confidence | Use |
|---|---|---|
| `02-his/ui/lab-workbench-stock-pattern-mockup.html` | observed | Canonical current layout, tokens, component sizes and mock interactions |
| User-confirmed conversation requirements through 2026-08-30 | provided | Business flow, wording, filtering, per-test receipt/rejection, Manual result and PDF rules |
| Drug & Stock screenshots supplied by the user | provided | Compact filter/control/table density pattern only |
| User-maintained draw.io layout | provided, not re-read for this document | Original intent; current HTML is the implementation baseline until the diagram is supplied/reviewed again |
| `lab-che` LAB and HIS-LIS references | observed | Operational/integration safeguards and unresolved contract gaps |
| `02-his/handoff/lab-result-api-readiness.md` | observed | Current UAT-candidate evidence and production blockers |
| Responsive behavior below 680px | observed/inferred | Preserve access through horizontal scrolling; not a separate mobile redesign |

## Keep / Change / Do not copy

| Keep | Change/adapt | Do not copy |
|---|---|---|
| Dense desktop worklist, compact filters, neutral Element-style palette | Replace mock values with master/API bindings | Drug & Stock domain labels, data, navigation or branding |
| One-page Order expansion pattern | Convert native HTML behavior into supported SDForm/list-ui/openForm patterns | Literal screenshot pixels or proprietary surrounding shell |
| Existing patient/order/specimen/doctor/diagnosis fields | Drive columns and results from normalized records | Mock patient names, result values, units and reference ranges |
| Searchable specimen dropdown and in-page dialogs | Use runtime user/org/lab section and master reason sources | Hard-coded user identity, organization or Lab section |
| Readonly result popup with pencil toggle | Add production validation, audit, permissions, concurrency and persistence | Native browser confirm for clinical actions |
| Status colors and sizes | Bind status calculation to Agent/API contract | Inferring criticality/completeness in presentation code |

## Final design stance

Build a calm, high-density clinical worklist: predominantly white and neutral gray, with blue reserved for selection/action and pastel semantic colors for state. The Order row is the primary unit, expanded details remain tabular, and dialogs preserve the same spacing/token system. Clinical completeness and criticality are supplied by contracts, not guessed by the UI.

## Risks and explicit unknowns

1. Current Agent submission requires Lab No. and treats the payload as one Order; per-test incremental receipt is not yet an approved transport contract.
2. Partial receipt and all-items-rejected need final derived Order-state behavior.
3. Manual verification, fallback reconciliation and item-level recollection are not fully confirmed.
4. Order code, observation code, specimen code and required result components are not confirmed equivalent mappings.
5. Current HTML is a prototype; EMR/PDF/Report/Create actions are not production integrations.
6. Exact current draw.io source was not re-read in this task; any later diagram change must be compared against `Lab_design.md` before implementation.

## Quality gate

- [x] Target artifact and audience are explicit
- [x] Evidence is classified as observed, provided or inferred
- [x] Keep/change/do-not-copy boundaries are explicit
- [x] One coherent visual direction is selected
- [x] Binding colors, typography, spacing and dimensions are documented
- [x] Responsive and accessibility requirements are documented
- [x] Exact anti-patterns are documented
- [x] Business rules and open decisions are separated
- [ ] Product owner confirms decisions D1–D9 in `Lab_design.md`
- [ ] First SDForm passes static validation and Builder/Preview verification
- [ ] Agent/LIS integration passes real end-to-end UAT before production claim
