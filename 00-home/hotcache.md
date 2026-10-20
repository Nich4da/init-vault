---
type: meta
title: Hot Cache
updated: 2026-10-21
---

# 🔥 Hot Cache — read this first

## Current task — shared EMR LAB result popup

- Approved prototype: `02-his/ui/lab-result-history-table-popup-confirmation.html`.
- User-owned live UI form exists as `lab_popup_result`, Form ID `6ad789a39291822e416c02e7`, Created By `Nichada Patcharasumransuk` (verified in live SDForm list 2026-10-21).
- Root cause of the reported old popup/double scrollbar: EMR History and EMR Treatment Summary still opened their old inline LAB dialogs (`ehLabDialog` / `tsLabDialog`). The new form existed but the “ดูผลทั้งใบ” buttons were never wired to it.
- Local replacement now routes only LAB “ดูผลทั้งใบ” in both EMR surfaces to `lab_popup_result` via `openForm`, passing `visit_id`, `source_order_id`, `section_code`, and `lab_no`, read-only. X-ray buttons and LAB/X-ray Worklist forms were not changed.
- Paste-ready event files:
  - `02-his/form-factory/emr-history-onCreated-FULL-v2-REPLACE.txt`
  - `02-his/form-factory/treat-summary-onCreated-FULL-v3-REPLACE.txt`
- Matching templates that must also be replaced:
  - `02-his/form-factory/emr-history-template-FULL-v1.txt`
  - `02-his/form-factory/treat-summary-template-FULL-v1.txt`
- Canonical event sources are under `Form-Builder/API/form-factory/events/`; HTML/TXT template pairs remain byte-identical.
- Verification passed: new popup wiring regression, popup API/form contract (standard table, MB, MY, Sensitive), EMR History LAB card, EMR LAB legacy regression, X-ray regression, Sensitive re-auth regression, SDForm validator, and `git diff --check`.
- No live EMR Form was edited. User previously chose to replace live content herself. After replacement, hard reload and test one BC order from both EMR History and the EMR card. Expected: shared long-table form, dropdown 1/5/10, no row-level “ผลก่อนหน้า” buttons, and no old nested dialog scrollbar.
- Fixed local replacement for `Cannot read properties of undefined (reading 'userState')`: `lab_popup_result` no longer probes the parent Form or loads LAB data in vue-ui `onCreated`. `onMounted` waits up to 10 × 50 ms for a guarded Form/API connector, then synchronizes the Sensitive username and loads once. Full form: `Form-Builder/SDForm/form-factory/forms/lab-emr-result-history-popup-v1.json`. Paste-ready events: `02-his/form-factory/lab-popup-result-onCreated-FULL-v2-REPLACE.txt` and `lab-popup-result-onMounted-FULL-v1-REPLACE.txt`. No EMR live Form, LAB/X-ray Worklist, template, or API contract was changed in this lifecycle fix. Validator passed; lifecycle/API/table/MB/MY/Sensitive plus EMR LAB/X-ray regressions passed. Runtime Builder verification remains for the user after replacing both event boxes.

## LAB UAT seed safety/state

- User-owned seed API `test_lab_uat` ID `6ad79a3d9291822e416c03d5`; never call Agent/LIS, receive specimen, or mutate finance.
- BC seed order `R2610210005` on test visit `6ad6daa7481c196fbb33ab1b` has 5 LAB NOs and 9 final results (Liver Function + Electrolyte). Transport attempt 0; `agent_called=false`, `lis_called=false`; no finance rows.
- All-room `create_suite` remains prepared but not run.
- Worktree is dirty with unrelated/user-owned changes. Never broad-stage, revert, or commit.
