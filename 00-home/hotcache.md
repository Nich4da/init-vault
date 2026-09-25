---
type: meta
title: Hot Cache
updated: 2026-09-25
---

# 🔥 Hot Cache — read this first

## LAB result visibility — draft for confirmation

- Reviewed local code and live HIS schema read-only; **no production change/deploy**. LAB's daily Item result list uses top-level CPOE Item `is_hide_result`; the API requires the same Section, an eligible received/result status, a persisted result, and a reason. It remains hidden until manual unhide and is not result-version scoped.
- `emr-lab-board-get` reads Result Items directly and does not join that flag, so EMR can still expose a LAB-hidden result.
- Live CPOE master form has `is_hide_result` (`ปกปิดผล`, default false). Only 3 masters store false and none true. Order Item snapshots expose `pick_master.is_hide_result` (326 exist: 4 false, none true; others null). No runtime top-level flag is deployed.
- Interactive prototype: `02-his/ui/lab-result-visibility-policy-mockup.html`. Revised to model one accepted LIS callback as one immutable whole-bundle revision: Technical Receipt (`zdata_lab_result_inbound`) → proposed `zdata_lab_result_revision_log` → current projection (`zdata_lab_result_item`). LAB has no send/retest button; LIS resends the same LAB No./codes as a full bundle and ingestion creates the next revision automatically.
- Temporary LAB hold is bound to `held_revision_id` versus `active_revision_id`, not individual item versions. A newer accepted revision auto-releases the old hold while retaining history. Sensitive master policy remains independent and requires server-side EMR re-auth; hold wins when both apply. Revision timeline, old snapshots, full-bundle callback, Sensitive re-auth, precedence, desktop/mobile, and console were verified. Awaiting confirmation before production edits.

## EMR History — separate LAB result card

- Implemented locally, **not deployed**. In vue-ui `emr_view`, the existing Lab order card remains unchanged; the complete LAB result card is a separate sibling after it.
- Paste-ready: `02-his/form-factory/emr-history-template-FULL-v1.html` and `Form-Builder/API/form-factory/events/emr-history-onCreated-FULL-v1.js`.
- Loads through `emr-lab-board-get` `6ab3be31cec3020e8562a2c9`; restored `emr-history-get` was not edited. Join only by exact Order ID and exclude `scope: today`.
- Static/regression tests pass; Builder/Preview confirmation remains. Do not replace the whole EMR History Form.

## CPOE cancellation + finance gate — ready, not deployed

- Implemented in `lab_cpoe_worklist_api.js`, generated `lab-cpoe-worklist-waiting-v1.json`, source `update_lab_cpoe_worklist_ui.js`. HIS-only; never cancels through Agent/LIS and preserves sent outbound audit.
- Server rechecks Finance: no Bill Item or refund/terminal bill permits cancellation; unpaid items become cancelled; active paid/receipt blocks all writes. Work Item/CPOE Item become cancelled; parent Order stays read-only. Regression/validator pass; runtime import/UAT remains.

## LAB result attachments

- Local only: PDF/JPG/JPEG/PNG, 10 files, 10 MB/file, 50 MB total; metadata unlink confirmed, no blob delete. Re-import Worklist JSON and runtime-check.

## Source / safety

- Immutable export: `Form-Builder/SDForm/backup/emr-history-6a96557e422c1ca959829eae-export-2026-09-24_18-03-01.json`.
- Mongo is read-only. Commit `03f9b5d` carries the X-ray/LAB/EMR checkpoint. `origin` is public (`Nich4da/init-vault`): never commit the localhost print-agent token. Related X-ray/LAB files remain uncommitted until sanitized; existing dirty worktree belongs to other work.
