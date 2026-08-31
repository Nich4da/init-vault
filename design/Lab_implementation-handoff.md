# LAB SDForm Implementation Handoff

Updated: 2026-08-30

## Read first

1. `design/Lab_design.md`
2. `design/Lab_design-contract.md`
3. `02-his/ui/lab-workbench-stock-pattern-mockup.html`
4. `design/lab-cpoe-integration-checklist.md`
5. `02-his/handoff/lab-result-api-readiness.md`
6. Before any JSON edit: `02-initcraft/governance/from-codex-backup/SDFORM_JSON_RULES.md`

## Build constraints

- Working location: `Form-Builder/SDForm/Lab/`; do not edit `backup/` or promoted best practices.
- Preserve the one-page, expandable Order worklist and every existing information field.
- Reuse the exact palette/type/spacing/component dimensions in `Lab_design.md`.
- Keep four primary filters only; organization/lab section comes from authenticated context.
- Separate Order, specimen, Receipt, Report and Result Item data.
- Drive Manual/machine/fallback behavior from the Order Item snapshot.
- Never embed real patient data, credentials, URIs or environment-specific secrets.
- Do not wire unconfirmed Agent behavior for decisions D1–D9 as if final.

## First artifact should prove

1. Worklist query and four filters render real-shaped mock records.
2. Order row expands without losing columns; responsive view scrolls horizontally.
3. Checkbox receipt records per-test state/time and defers Lab No. to the server event.
4. Reject and whole-Order cancel remain separate audited actions.
5. Result viewer renders multi-component, pending and long-text results.
6. Manual entry opens after receipt, saves through an in-page confirmation and recalculates partial/complete state.
7. Every popup/action receives stable Order/Lab/Test identifiers rather than reading shared mock DOM state.

## Verification

- Run `python3 Form-Builder/seed/tests-tools/validators/check_sdform_json.py <candidate.json>`.
- Static validation is not runtime proof. Verify Builder/Preview for layout and deployed runtime for workflow/data persistence.
- Before production claim, run a real HIS → Agent → LIS → Agent → HIS Order including partial, final, corrected and duplicate callbacks.
