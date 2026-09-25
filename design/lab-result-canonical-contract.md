---
type: design
title: LAB Result Canonical Contract
created: 2026-09-01
updated: 2026-09-24
status: working
---

# LAB Result Canonical Contract

## Scope

This contract removes the split between the current CPOE Worklist result path and
the Agent callback result path. The current local candidate also stores External
LAB attachment metadata on the canonical Result Report; deployed runtime UAT is pending.

## Canonical forms

| Layer | Form ID | Collection / role |
|---|---|---|
| Work Item | `6a95c750422c1ca959829e8a` | `zdata_lab_work_item`; one operational row per CPOE LAB Item |
| Technical Receipt | `6a8b1c03f851000f28e501ef` | `zdata_lab_result_inbound`; one row per Order identity + Agent `result_uid`, reused for an unchanged failed retry |
| Result Report | `6a8d4334f851000f28e5025b` | `zdata_lab_report_manual_entry`; technical header for one inbound stage or Manual workspace |
| Result Item | `6a8bc91df851000f28e501fb` | `zdata_lab_result_item`; normalized latest clinical row per Work Item + observation |
| Viewer | `6a8d5620f851000f28e50270` | `form_ui`; presentation only, no collection |

Legacy Result Item Form `6a7aa641935ed08882467374` is read-only fallback for old
Manual data. No new writes may target it.

## Stable identities

- Work Item `_id` equals the source CPOE Item `_id`.
- Outbound and inbound `order_no` equals the Work Item `_id`.
- `filler_order_no` / `labno` equals `Work Item.lab_no`.
- Callback matching requires all of: `order_no`, LAB NO., HN, and Visit ID.
- Receipt idempotency uses those four Order identity fields together with `result_uid`.
  An unchanged retry reprocesses the same unprocessed Receipt; a changed payload under
  the same composite identity is rejected. A new UID on the same Order is allowed only
  when report sequence/stage and item versions represent a valid next result message.
  If the failed attempt already created its Report, the retry resumes that Report.
- `Work Item.selected_items_json[].test_code` is compared with inbound `items[].obs_code`
  only under the current Agent contract; this mapping remains a production contract gap.
- One ordered Work Item may own multiple normalized Result Items. The receiver and Worklist
  use the same ordered/group-code to result-component allowlist so existing child rows remain
  visible in Item and Order result views. `panel_code`/`panel_name` are optional source
  display/audit metadata only; they are not trusted as the clinical parent or matching key.
- A normalized Result Item points to the latest Report that updated it through both
  `xparentx` and `result_report_id`. Older Receipt/Report payloads remain the
  technical audit/idempotency trail and are not clinical result history.

## Write ownership

- `lab_no_generate_api`: creates the Work Item identity and LAB NO.
- `lab_cpoe_receive_api`: records receipt, backfills callback identity, and creates Outbound Order.
- `hl7_result_upsert`: writes Agent Receipt → Report → Items, advances Work/CPOE Item,
  reconciles the matching Outbound from a verified callback, and completes the Parent CPOE
  Order only after every active child Item is completed.
- `lab_cpoe_worklist_api`: reads the Worklist, writes Manual LAB Report → Item after receipt,
  corrects existing canonical Agent/LIS Result Items, and saves current attachment metadata.
- `prepare_manual_lab_results_api`: legacy reference only; do not deploy for this flow.

## Status rules

- Uploading a file never completes a result or changes LAB/CPOE status.
- Agent partial result advances Work Item to `resulted`; final/corrected advances it to `completed`.
- A verified partial/final callback advances its matching Outbound to `in_progress`/`resulted`,
  clears active retry/error state and preserves failed-send history. An unchanged callback for a
  processed Receipt may rerun only this operational reconciliation without duplicating data;
  an unchanged callback for an unprocessed Receipt may replay clinical processing on that same Receipt.
- Parent CPOE Order completes only when every active child CPOE Item is completed; a single LAB NO.
  must not close a multi-item Parent while siblings are pending.
- Manual entry in any authorized LAB Section advances only its Work Item to `resulted`.
- Agent partial/final/corrected messages preserve immutable Receipts and stage
  Report headers, but update the same normalized Result Item rather than appending
  a new clinical row for every `result_version`.
- Result Item keeps the latest value only. An Agent corrected resend sets
  `change_kind=corrected` and replaces that observation's current value, but it
  does not write `last_edited_by`/`last_edited_at` and does not preserve the prior
  Agent value in `previous_value` or `edit_history_json`.
- Optional Agent `items[].comment` carries the observation-level HL7 NTE text into
  Result Item `result_comment`. Multiple NTE entries arrive joined by `\n`; the
  current normalized row is cleared when the latest observation omits `comment`.
- `corrected_at` and `corrected_by` are not Agent contract fields. Only the HIS
  manual-pencil flow writes `last_edited_by` and `last_edited_at` from the logged-in
  HIS user; a later Agent resend preserves that existing manual audit.
- `ผลก่อนหน้า` is not correction history. It is the latest final/corrected result
  for the same HN + observation from a different, earlier Order/Visit. The UI
  displays it immediately before `ผลปัจจุบัน`.
- Legacy duplicate Result Items may remain read-only after deployment; current
  lookup de-duplicates them by observation/version. A separate approved migration
  is required before retiring old rows.
- Result attachments are Report-level, not per observation. The Order popup uses a stable special
  Report keyed `attachment-order|<orderId>|<sectionCode>` and permits upload before specimen receipt;
  it keeps the current `result_attachments` plus latest `confirmed_by`/`confirmed_at` without changing status.
- The Worklist pencil works at both Item and Order scope after receipt. Order scope keeps rows tied
  to their source CPOE Item and saves only changed Items; it can create Manual rows or correct
  multiple existing canonical Result Items in one confirmation.
  It updates only value/unit/interpretation/reference range and latest editor/time; it does not
  recalculate or clear the Agent/LIS source, result status, or explicit critical decision.

## Deployment order

1. Re-import `Lab_Work_Item_CRUD.json` so `visit_id` exists in the live schema.
2. Deploy LAB NO. and Receive changes, then retry Receive once to backfill an existing received Work Item.
3. Deploy `lab_cpoe_worklist_api` and verify Manual Mycology creates/updates one
   canonical Item and resolves previous encounter results.
4. Give Agent the v2 schema without HIS manual-editor fields, then deploy
   `hl7_result_upsert` and test Gateway metadata separation, unmatched, partial,
   final, corrected-without-corrector, duplicate, and stale-version callbacks.
5. Re-import the canonical Result Report, deploy `lab_cpoe_worklist_api`, then replace/publish the
   Worklist Form. Verify pencil corrections and attachment persistence in Builder/runtime before
   treating the local attachment layer as deployed.

## Remaining blockers

- The first fresh Agent callback verified one LAB NO./one Work Item persistence and identity mapping.
  Multi-item final, critical alert workflow and deployed reconciliation remain pending.
- The new result-dialog pencil/upload UI has passed static/offline checks only; Builder/Preview,
  deployed file gateway/MIME enforcement, reopen persistence and permissions remain unverified.
- Outbound `test_code` versus inbound `obs_code` equivalence needs final confirmation from the integration contract owner.
