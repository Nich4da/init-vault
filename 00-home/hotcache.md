---
type: meta
title: Hot Cache
updated: 2026-09-25
---

# 🔥 Hot Cache — read this first

## EMR History — separate LAB result card

- Implemented locally, **not deployed**. In vue-ui `emr_view`, the existing Lab order card remains unchanged; the complete LAB result card is a separate sibling after it.
- Paste-ready: `02-his/form-factory/emr-history-template-FULL-v1.html` and `Form-Builder/API/form-factory/events/emr-history-onCreated-FULL-v1.js`.
- Loads through `emr-lab-board-get` `6ab3be31cec3020e8562a2c9`; restored `emr-history-get` was not edited. Join only by exact Order ID and exclude `scope: today`.
- Static/regression tests pass; Builder/Preview confirmation remains. Do not replace the whole EMR History Form.

## CPOE cancellation + finance gate — ready to replace, not deployed

- Implemented locally in `lab_cpoe_worklist_api.js` and generated `lab-cpoe-worklist-waiting-v1.json`; source generator is `update_lab_cpoe_worklist_ui.js`.
- Cancellation is HIS-only: never sends cancellation to Agent/LIS. A sent Outbound row remains unchanged for audit; only a never-sent queue row is stopped locally.
- Popup calls read-only `check_cancel_finance`; `cancel_order` repeats the check server-side before writes. No Bill Item means immediate cancel. Unpaid Bill Items become `item_status: cancelled`. Active `paid`/receipt blocks all writes and instructs staff to call Finance; `is_refund:true` or terminal bill status permits cancellation.
- Successful cancellation writes Work Item and CPOE Item `current_status: cancelled` with audit metadata; CPOE parent Order remains read-only to avoid changing unrelated section/item behavior.
- Verified live schema read-only: Bill Item joins through `order_item.value` and `bill_id.value`; Bill fields are `bill_status`, `receipt_number`, `is_refund`. Observed `issued`/no receipt and `paid`/receipt; no refund sample exists, so Builder/UAT must confirm the Finance withdrawal action writes `is_refund:true` as its form label indicates.
- Regression: cancellation API/Form tests, Worklist API, receive, reject, retest, result output, Agent submit, LAB NO., JSON parse/diff check all pass. SDForm validator exit 0. Runtime import/UAT remains.

## LAB result attachments

- Implemented locally: PDF/JPG/JPEG/PNG, maximum 10 files, 10 MB/file, 50 MB total; editable Worklist has confirmed metadata unlink via red cross. No physical blob delete.
- Native multi-select persists multiple files. Element Plus `file-list`/`limit` bindings were removed because they crashed initCraft after upload; custom validation remains. Re-import only the Worklist Form JSON and runtime-check.

## Source / safety

- Immutable export: `Form-Builder/SDForm/backup/emr-history-6a96557e422c1ca959829eae-export-2026-09-24_18-03-01.json`.
- NALO LAB/image: HN `6900023`, visit `6900317`; X-ray: HN `6900031`, visit `6900256`.
- Mongo is read-only. Commit `03f9b5d` on `origin/main` carries the X-ray/LAB/EMR checkpoint; `tmp/` is now gitignored. Staged-tree suite baseline: 33 pass / 10 pre-existing fails.
- `origin` is a **PUBLIC** repo (`Nich4da/init-vault`) — never commit the localhost print-agent token. Held back on disk, uncommitted: `build_xray_cpoe_worklist_ui.js`, `xray-cpoe-worklist-v1.json`, `lab-cpoe-worklist-waiting-v1.json`, `test_xray_cpoe_worklist_form.js`, the 6 tests that read them, and the finance-gate edits in `update_lab_cpoe_worklist_ui.js`. Sanitize the token to a placeholder/env before committing them.
