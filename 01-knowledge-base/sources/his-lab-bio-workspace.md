---
type: source
title: HIS — Bio (Biochemistry) workspace — order/receive/reject lifecycle
created: 2026-08-16
updated: 2026-08-27
tags: [his, lab, lis, active-build, known-issue]
source_file: "codex-backup/Lab_Bio_Order_CRUD.json + Lab_Bio_Rejection.json + Lab_Bio_Receive.json + Lab_Bio_Order_Edit_Log.json + Lab_Bio_Receive_Order_API.js + Lab_Bio_Reject_Specimen_API.js + Lab_Biochem_workflow.json + Lab_Biochem_initCraft_import.json"
source_type: note
source_date: 2026-08-16
author: user + codex agent (parallel development workspace)
---

# HIS — Bio (Biochemistry) workspace — order/receive/reject lifecycle

> The **legacy/reference flow** that the whole [[his-lab-workbench-handoff]] initiative is
> generalizing into the shared Lab Workbench — Biochemistry (`BC`) is the one lab section with a
> complete, working order → receive/reject → result lifecycle today. Ingested 2026-08-16.

## Forms

**`Lab_Bio_Order_CRUD.json`** (form `6a771f20cc7d0a8451130339`, collection `zdata_testlab_bio`) —
30 fields. Visible: `patient_hn` (autonumber), `patient_first_name`*, `patient_last_name`*,
`ward_clinic`. Hidden state/audit: `selected_items_json`, `order_change_history_json`,
`biochemistry_specimen_json`, `order_status` (default `waiting_receive`), `order_group_id`,
`revision_no` (default `1`), `resubmitted_from_order_id`, `latest_rejection_id`, `rejected_at/by`,
**`lab_section` (default `'BC'`)**, `patient_name`, `patient_photo`, `ordered_at`, `requested_at`,
`order_count`, `total_sale_price`/`total_withdraw_price`/`total_effective_price`, `price_mode`
(default `sale`), `received_at/by`, `test_started_at`, `resulted_at/by`, `reject_reason`.

**`Lab_Bio_Rejection.json`** — 17 fields: visible `patient_display`, `reject_reason_code`*
(select), `reject_reason_detail` (textarea); hidden `source_order_id`, `order_group_id`,
`patient_hn/name`, `ward_clinic`, `lab_section` (`'BC'`), `selected_items_json`,
`biochemistry_specimen_json`, `treatment_right`, `payment_status`, `revision_no`, `rejected_at/by`,
`rejection_status` (default `recorded`).

**`Lab_Bio_Receive.json`** — 17 fields: visible `patient_display`, `lab_no`, `receive_note`
(textarea); hidden `source_order_id`, `order_group_id`, `patient_hn/name`, `ward_clinic`,
`lab_section` (`'BC'`), `selected_items_json`, `biochemistry_specimen_json`, `treatment_right`,
`payment_status`, `revision_no`, `received_at/by`, `receive_status` (default `received`).

**`Lab_Bio_Order_Edit_Log.json`** — 17 fields, confirmed to be exactly **the "form for storing
edits" the handoff calls deprecated**: `patient_display`, `change_summary`, `change_reason`,
`changed_by_display`, `changed_at_display` (visible); `source_order_id`, `order_group_id`,
`patient_hn/name`, `ward_clinic`, `lab_section` (`'BC'`), `action_type` (default `item_edit`),
`changed_at/by`, `before_items_json`, `after_items_json`, `changed_items_json` (hidden, all
default `[]`). A standalone audit form — superseded by `order_change_history_json` living directly
on the Order/Status record, which already exists as a hidden field on `Lab_Bio_Order_CRUD.json`
itself and is the pattern generalized in [[his-lab-work-item-bridge]] /
[[his-lab-specimen-status-session-aug16]].

## API scripts (read in full — local files already correct)

**`Lab_Bio_Receive_Order_API.js`** — process for `Lab_Bio_Order` (`6a771f20cc7d0a8451130339`).
`ORDER_COLLECTION = 'zdata_testlab_bio'` — **the correct collection is already present in this
local file**; the wrong-collection bug the handoff describes
(`zdata_6a771f20cc7d0a8451130339`) is **not** in this copy. Guards: rejects if `xrstatx === 3`
(soft-deleted), `lab_section !== 'BC'`, or the order is already `rejected`/`resulted`. Two
actions: `receive` (default — sets `order_status: 'received'`, `received_at/by`, optional
`lab_no`/`receive_note`) and `start_process` (only from `received` — sets `order_status:
'resulted'`, `result_started_at/by`).

**⚠ State-machine inconsistency found:** despite its name, `start_process` jumps straight from
`received` to **`resulted`**, skipping a `processing` state — this contradicts the
`waiting_receive → received → processing → resulted` model stated in
[[his-lab-workbench-handoff]] and enforced by [[his-lab-work-item-bridge]]'s `WORK_TRANSITIONS`.
This legacy Bio API predates that state machine and has not been reconciled with it.

**`Lab_Bio_Reject_Specimen_API.js`** — same `ORDER_COLLECTION = 'zdata_testlab_bio'`, also already
correct locally. Two actions: `reject` (default — blocks if status is
`received`/`testing`/`resulted`; sets `order_status: 'rejected'`, `rejected_at/by`) and `recheck`
(only from `rejected` — back to `received`, sets `rechecked_at/by`).

Both APIs hard-code a `lab_section !== 'BC'` guard — exactly the generalization work still pending
per [[his-lab-workbench-handoff]]'s milestone list.

**On the handoff's "known defect":** both local `.js` files are already fixed to the correct
collection. This only confirms the *local source* — whether the fix has actually been pasted into
API Factory and Save/Published live is unverified from files alone; do not claim the live bug is
fixed without a test.

## `Lab_Biochem_workflow.json` — early planning artifact (2026-08-08), stale IDs

A workflow spec (`schema_version 1.0`) derived from a draw.io diagram + HTML mockup, states
`waiting/received/resulted/rejected` with transitions and required fields per state — conceptually
consistent with what was actually built. **Uses IDs that don't match the live system**: `center_lab_order`
form `6a6c4d28265885c2377cc12e` / collection `zdata_center_lab_order`, and `lab_che_order` form
`6a6c242c265885c2377cc127` — neither matches the real Center Lab Order
(`6a75a7810796231c653df996` / `zdata_lab_center_order`, confirmed in
[[his-lab-center-cpoe-master]]). Treat as historical planning only, not a current reference.

## `Lab_Biochem_initCraft_import.json` — the live-ish workbench UI (189KB, updated 2026-08-16)

Structure: `create_biochemistry_order` (vue-ui) → `lab_biochem_tabs` with 5 panes:
`lab_all_orders` (รายการรวม), `lab_waiting` (รอรับ — sub-components `lab_waiting_orders` +
`lab_waiting_center_specimen`), `lab_received` (รับเข้าแล้ว — `lab_received_styles` +
`lab_received_component`), `lab_resulted` (ออกผลแล้ว), `lab_cancelled` (ยกเลิกรายการ). Matches
the tab structure narrated in [[his-lab-specimen-status-session-aug16]].

**Hard-coded `'BC'`: 9 occurrences**, all in `where`-clauses routing by section, e.g.:

```sql
(section_code = '10' OR section_code = 'BC') AND specimen_status = 'sent'
  AND (work_status = 'waiting_receive' OR work_status IS NULL)
```

Biochemistry is routed by **both** its numeric `section_code` (`'10'`) and its legacy letter code
(`'BC'`) in every query — the concrete shape of the "generalize the Bio workbench" milestone: these
need to become a data-driven active-section filter, not per-query hard-coded literals.

## Relationship to the older `his-lab-che-order-component.md` page

⚠ **`01-knowledge-base/sources/his-lab-che-order-component.md` (created 2026-07-31) is now outdated.** It
documents `Form-Builder/SDForm/sdform_module/Lab_CHE_Order_Component.json` — a 3-field prototype (patient banner +
hidden `selected_items_json` + a hard-coded 25-group/90-item tick sheet, `price: 0` everywhere, no
specimen/LAB NO./doctor/ward capture, and explicitly **no save process at all** — its own
"Contradictions" section says *"nothing writes the order anywhere yet."*

`Lab_Bio_Order_CRUD.json` is a **materially more complete successor**, not a parallel duplicate: it
adds a real save target (`order_status`, `lab_section`, price totals, audit fields, rejection
linkage) plus the full receive/reject/recheck lifecycle documented above — resolving exactly what
the old page flagged as missing. The tick-sheet UI itself (`create_biochemistry_order` inside
`Lab_Biochem_initCraft_import.json`) likely supersedes the old component's UI too, but exact
group/item/pricing content was not independently re-diffed against the old page in this pass.
**Recommend updating `his-lab-che-order-component.md` with a pointer to this page** rather than
leaving both to be read as independent, current descriptions.

## Key takeaways

- Biochemistry is the only lab section with an end-to-end lifecycle actually working today —
  every other section's workflow is generalized *from* this one, not built independently.
- The `start_process`→`resulted` state-machine mismatch (skipping `processing`) is a concrete,
  unresolved inconsistency between the legacy Bio APIs and the newer shared work-item state
  machine — worth flagging to the user directly, since fixing it either means changing the legacy
  Bio API or accepting that Bio, uniquely, has no `processing` state.

## Entities & concepts touched
- [[his-lab-che-order-component]] — the older, now-superseded prototype for the same screen.
- [[his-lab-workbench-handoff]] — the shared data model and "generalize the Bio workbench"
  milestone this whole page is evidence for.
- [[his-lab-work-item-bridge]] — the `work_status` state machine the legacy Bio API doesn't match.
- [[his-lab-specimen-status-session-aug16]] — the tab structure and `DEV_ALLOW_EARLY_LAB_ACTIONS`
  switch that also touch this same import file.

## Contradictions / open questions
- The `start_process: received → resulted` (skips `processing`) mismatch above — needs a decision:
  fix the legacy Bio API to match the shared state machine, or treat Bio as an intentional
  exception.
- Whether the "known defect" (wrong collection in API Factory) has actually been published live is
  unconfirmed from local files alone.
- `his-lab-che-order-component.md` has not yet been edited to point here — flagged, not yet done,
  to keep this ingest pass's scope to new pages per the user's instruction.
