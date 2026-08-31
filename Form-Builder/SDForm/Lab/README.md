# LAB SDForm Working Area

This directory is the user-approved working location for the new LAB Workbench SDForm implementation.

## Current working artifact

- `lab-cpoe-worklist-waiting-v1.json` — local read-only CPOE worklist candidate.
- Bound to API Factory Process ID `6a9434c3422c1ca959829d5e` through the
  authenticated `runProcess` connector.
- Uses the compact structural pattern from Drug & Stock > Stock: small search
  toolbar, status chips, aligned list header, expandable Order rows and a
  borderless nested Item grid. LAB content and actions remain specific to the LAB design.
- The visible list summary is intentionally limited to `แสดง X Order จากทั้งหมด Y`;
  routing sections and implementation-state notes are not shown in the user UI.
- Search/date filters, Order-level pagination and Item-level selection remain
  connected to the read-only worklist process. There is no room/Section picker
  in this Form: the authenticated App Organization determines the allowed
  sections, and changing Organization reloads the worklist automatically.
- The API filters CPOE Items by allowed section before grouping them back into
  Orders. The same Order No. can therefore appear in Bio and Hemato while each
  room sees only its own Items.
- Age is displayed exactly from the patient snapshot (for example `3y 3m 3d`),
  and specimen is an Element Plus dropdown with local-only selection until the
  receive/write API exists.
- Doctor display removes an email suffix and shows only the available person name.
- Create opens CPOE Order App `6a927860422c1ca959829d26` in manual-VN mode;
  the CPOE source now searches Visit by VN and reuses its patient card. EMR opens
  Form `6a4f64e7f8cdfc54cec16488` at the Order Visit through a read-only deep link.
- These are updates to the existing main CPOE and EMR Form IDs, not new LAB-only
  Forms. Do not import either JSON as a duplicate Form; apply the manual-VN and
  Visit deep-link changes to those existing Forms in place.
- Receive, reject and cancel remain visibly blocked until their write APIs exist.
- Static JSON/event/binding checks and SDForm validation pass; Builder/Preview
  and deployed runtime evidence are still required.

## Canonical design inputs

- `../../../design/Lab_design.md`
- `../../../design/Lab_design-contract.md`
- `../../../design/Lab_implementation-handoff.md`
- `../../../02-his/ui/lab-workbench-stock-pattern-mockup.html`

## Guardrails

- Read `../../../02-initcraft/governance/from-codex-backup/SDFORM_JSON_RULES.md` before creating or editing SDForm JSON.
- Validate every candidate with `../../seed/tests-tools/validators/check_sdform_json.py`.
- Keep working JSON here; do not edit existing files under `../backup/` or `../best-practices/`.
- Do not include credentials, environment URIs, production patient identifiers or real clinical results.
- Static validation does not prove Builder/Preview/runtime behavior.
