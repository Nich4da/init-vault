---
type: source
title: HIS — Specimen → Work Item bridge (finalized shared-queue architecture)
created: 2026-08-16
updated: 2026-08-16
tags: [his, lab, lis, active-build]
source_file: "codex-backup/LAB_WORKBENCH_HANDOFF.md ('Current Resume Point' section, 2026-08-14) + Lab_Work_Item_CRUD.json + Lab_Center_Specimen_To_Work_Item_API.js + lab_center_specimen.json + wire_lab_center_specimen_to_work_item.py + Lab_Result_Definition_Master.json + Lab_Result_Item.json"
source_type: note
source_date: 2026-08-14
author: user + codex agent (parallel development workspace)
---

# HIS — Specimen → Work Item bridge (finalized shared-queue architecture)

> This section of the handoff **explicitly supersedes** the unresolved Center Specimen Hub
> debugging in [[his-lab-center-specimen-hub]] — instead of continuing to debug the stuck
> `form_ui` screen, the team re-architected around a canonical status collection plus one shared
> Work Item queue. This is the architecture [[his-lab-specimen-status-session-aug16]]'s Aug
> 15–16 work then builds on directly. Ingested 2026-08-16.

## Finalized architecture

```text
Lab Center Specimen App (source/status screen)  →  zdata_specimen_collection_status
  waiting → collected → sent
       │ only when sent
       ▼
Lab Work Item CRUD (shared operational queue)  →  zdata_lab_cen_crud
  one record per source specimen record × lab section
       ▼
Native ListView in each Lab Workbench, filtered by section_code + work_status
```

**One shared Work Item CRUD form for all lab rooms** — explicitly not one CRUD per room.
`section_code` is the routing key. Hematology's UI shows both `HM` and `HH`; the two source codes
are retained separately in data (matches the `HM`/`HH`→`HEM` tab-merge rule already established
in [[his-lab-center-cpoe-master]]).

## Live IDs and collections

| Purpose | ID / collection | Role |
|---|---|---|
| Lab Center Specimen App | `6a7da6ec8d398c11cf2fe865` | `form_ui` source/status screen — not itself a ListView provider |
| Specimen-status API | `6a7e787e8d398c11cf2fe8b8` | Lists/changes `waiting/collected/sent` in `zdata_specimen_collection_status` |
| Work Item CRUD form | `6a7e818b8d398c11cf2fe8d4` | Shared persisted queue, `zdata_lab_cen_crud` |
| Work Item bridge API | `6a7e82ba8d398c11cf2fe8d5` | Idempotently creates/updates a Work Item from a `sent` source record |

## `Lab_Work_Item_CRUD.json` — the shared queue's fields

| field | label | required | hidden |
|---|---|---|---|
| `lab_no`, `section_code`, `section_name`, `work_status`, `patient_hn`, `patient_name` | LAB NO. / รหัสห้อง Lab / ห้องปฏิบัติการ / สถานะงาน Lab / HN / ชื่อ-สกุลผู้ป่วย | ✓ | visible |
| `ward_clinic`, `ordered_at` | Ward/Clinic, เวลาสั่งตรวจ | – | visible |
| `source_order_id`, `source_order_number`, `source_specimen_record_id` | trace-back to the originating Center order/specimen record | – | hidden |
| `specimen_json`, `selected_items_json` | order/specimen snapshots | – | hidden |
| `central_checked_at/by`, `central_forwarded_at/by` | central-hub audit | – | hidden |
| `received_at/by`, `processing_at/by`, `resulted_at/by` | per-stage audit trail | – | hidden |
| `rejected_at/by`, `reject_reason_code`, `reject_reason_detail` | rejection audit | – | hidden |

`work_status` values: `waiting_receive → received → processing → resulted → completed`, with a
side-branch `waiting_receive → rejected / cancelled`.

## `Lab_Center_Specimen_To_Work_Item_API.js` — the bridge API (form `6a7e82ba...`)

Input: `{ source_record: <one row from Lab Center Specimen action:list> }`. Logic:

1. Authorization check (`app.isAuth`) before anything else.
2. Requires `source_record._id` and a non-empty `section_code` (falls back to `lab_section`,
   uppercased) — rejects otherwise with a Thai error message.
3. **Idempotency key**: queries the Work Item form for an existing row matching
   `source_specimen_record_id = :id AND section_code = :code`. If found, updates that row instead
   of inserting — a retry can never create a duplicate queue row for the same
   specimen-record × section pair.
4. Builds the Work Item payload by copying/normalizing fields from the source record
   (`selected_items`/`specimens` parsed defensively via a local `asArray` that tolerates a JSON
   string, an array, or garbage → `[]`), always setting `work_status: 'waiting_receive'` on
   create/update.
5. Saves via `app.sdformSetOne(WORK_ITEM_FORM_ID, existingId, data, 2, userInfo)` and returns
   `action: 'created' | 'updated'`.

## `lab_center_specimen.json` + `wire_lab_center_specimen_to_work_item.py` — current client wiring

The generator patches the Lab Center Specimen App's `onCreated` script so its `send(row)` handler
does **two sequential API calls**, confirmed directly in code:

1. `s.updateStatus(row, 'collected', ...)` / `s.updateStatus(row, 'sent', ...)` — calls the
   specimen-status API (`action:'update'`) with the new `specimen_status`.
2. **Only on `send` success**, and only client-side: calls `api.runProcess(WORK_ITEM_PROCESS_ID,
   {source_record: {...row, specimen_status:'sent'}}, ...)` — the bridge API above — inside the
   same button handler.

Both `s.receive` (→ `collected`) and `s.send` (→ `sent`) go through the same generic
`s.updateStatus` helper, keyed by `order_number` (not `_id`) and guarded against double-submit via
an `updatingIds` map keyed by row id.

**This is explicitly a temporary pattern**, per the handoff: *"Wired" currently means the exported
local JSON contains both process calls... The original status API source does not yet invoke the
bridge internally.* The recommended (not yet done as of 2026-08-14) cleanup is to move the bridge
call **server-side**, inside the status API itself, as a `subProcess` triggered when
`nextStatus === 'sent'` — so the App only ever calls one process, and the flow stays reusable from
any other caller. The bridge's idempotency (`source_specimen_record_id + section_code`) is
designed to make that refactor safe.

**Do not release a row to a lab workbench at `collected`** — it must appear only after the Center
marks it `sent`. (Note: this "must" was later loosened by a temporary dev-mode switch — see
[[his-lab-specimen-status-session-aug16]]'s `DEV_ALLOW_EARLY_LAB_ACTIONS`.)

## `Lab_Result_Definition_Master.json` — revised master (fields confirmed)

`lab_item_id` (→ CPOE Lab Item Form, required) · `default_unit_id` (→ Lab Unit/measurement-unit
Master) · `result_type` (required) · `decimal_places` (required) · `reference_range_text` ·
`allowed_text_options` · `is_active`. Matches the handoff's design instruction: reference CPOE
Item + Unit Master by ID; keep only reporting config here, not duplicated test identity fields.

## `Lab_Result_Item.json` — one row per ordered test (fields confirmed)

`order_id`, `lab_section`, `lab_no`, `patient_hn` (context) · `test_code`, `test_name` (required,
identity) · `result_definition_id`, `result_source` (context) · `result_type` (required) ·
`result_number` / `result_text` (mutually exclusive by type) · `unit_code_snapshot`, `unit_symbol`,
`reference_range_snapshot` (**snapshotted at result-entry time**, matching the "Master changes
must not rewrite historical reports" rule from [[his-lab-workbench-handoff]]) · `result_comment` ·
`result_status` (required) · `is_critical` · `entered_at/by`, `verified_at/by`.

## Key takeaways

- The **idempotency-by-composite-key** pattern (`source_specimen_record_id + section_code`) here
  is the concrete mechanism finally answering how the system avoids duplicate queue rows — a gap
  [[his-lab-module-plan]] never worked out.
- The **temporary client-side two-call wiring**, with an explicit server-side cleanup already
  planned, is a good template for how this parallel workspace documents its own technical debt —
  worth mirroring in this vault's own notes rather than treating "it works" as "it's finished."

## Entities & concepts touched
- [[his-lab-center-specimen-hub]] — the debugging dead-end this architecture replaced.
- [[his-lab-specimen-status-session-aug16]] — the next day's work building directly on this.
- [[his-lab-workbench-handoff]] — parent handoff and the Result Item/Order data model this
  extends.

## Contradictions / open questions
- The bridge call is still wired **client-side as of this source's date** — confirm in a future
  ingest pass whether the server-side `subProcess` cleanup was ever completed (Aug 15–16 files
  digested in [[his-lab-specimen-status-session-aug16]] do not mention it directly).
