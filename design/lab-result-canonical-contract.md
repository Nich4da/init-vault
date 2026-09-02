---
type: design
title: LAB Result Canonical Contract
created: 2026-09-01
updated: 2026-09-02
status: working
---

# LAB Result Canonical Contract

## Scope

This contract removes the split between the current CPOE Worklist result path and
the Agent callback result path. It does not implement External LAB attachments.

## Canonical forms

| Layer | Form ID | Collection / role |
|---|---|---|
| Work Item | `6a95c750422c1ca959829e8a` | `zdata_lab_work_item`; one operational row per CPOE LAB Item |
| Technical Receipt | `6a8b1c03f851000f28e501ef` | `zdata_lab_result_inbound`; append one row per Agent `result_uid` |
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
- `Work Item.selected_items_json[].test_code` is compared with inbound `items[].obs_code`
  only under the current Agent contract; this mapping remains a production contract gap.
- A normalized Result Item points to the latest Report that updated it through both
  `xparentx` and `result_report_id`. Older Receipt/Report payloads remain the
  technical audit/idempotency trail and are not clinical result history.

## Write ownership

- `lab_no_generate_api`: creates the Work Item identity and LAB NO.
- `lab_cpoe_receive_api`: records receipt, backfills callback identity, and creates Outbound Order.
- `hl7_result_upsert`: writes Agent Receipt → Report → Items and advances Work Item status.
- `lab_cpoe_worklist_api`: reads the Worklist and writes Manual Mycology Report → Item.
- `prepare_manual_lab_results_api`: legacy reference only; do not deploy for this flow.

## Status rules

- Uploading a file is outside this checkpoint and cannot complete a result.
- Agent partial result advances Work Item to `resulted`; final/corrected advances it to `completed`.
- Manual Mycology entry currently advances Work Item to `resulted`.
- Agent partial/final/corrected messages preserve immutable Receipts and stage
  Report headers, but update the same normalized Result Item rather than appending
  a new clinical row for every `result_version`.
- Result Item keeps the latest value only. A correction sets `change_kind`,
  `last_edited_by`, and `last_edited_at`; it does not preserve old values in
  `previous_value` or `edit_history_json`.
- Corrected callbacks require explicit `corrected_at` and `corrected_by`.
  `verified_by` remains the verifier and must not be inferred as the editor.
- `ผลก่อนหน้า` is not correction history. It is the latest final/corrected result
  for the same HN + observation from a different, earlier Order/Visit. The UI
  displays it immediately before `ผลปัจจุบัน`.
- Legacy duplicate Result Items may remain read-only after deployment; current
  lookup de-duplicates them by observation/version. A separate approved migration
  is required before retiring old rows.

## Deployment order

1. Re-import `Lab_Work_Item_CRUD.json` so `visit_id` exists in the live schema.
2. Deploy LAB NO. and Receive changes, then retry Receive once to backfill an existing received Work Item.
3. Deploy `lab_cpoe_worklist_api` and verify Manual Mycology creates/updates one
   canonical Item and resolves previous encounter results.
4. Give Agent the v2 schema addition (`corrected_at`, `corrected_by`), then deploy
   `hl7_result_upsert` and test unmatched, partial, final, corrected, duplicate,
   stale-version, and missing-corrector callbacks.
5. Only after this passes, add External LAB attachment persistence to Report + Viewer + Worklist API.

## Remaining blockers

- API Factory still has no network route to the hospital-private Agent.
- A real end-to-end callback has not yet verified the new Work Item identity fields.
- Outbound `test_code` versus inbound `obs_code` equivalence needs final confirmation from the integration contract owner.
