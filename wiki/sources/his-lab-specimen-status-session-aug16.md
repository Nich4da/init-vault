---
type: source
title: HIS — Specimen status live session (VN snapshot, EMR-style receive, edit audit)
created: 2026-08-16
updated: 2026-08-16
tags: [his, lab, lis, active-build, known-issue]
source_file: "codex-backup/LAB_SESSION_MEMORY.md + specimen-collection-status-api.js + specimen_collection_status_api_v2.js + on-center-lab-order-insert-v2.js + on-center-lab-order-update-v1.js + upgrade_specimen_status_visit_context.py + upgrade_lab_received_opd_card.py + rewire_lab_biochem_status_form.py + upgrade_center_lab_visit_context.py + refactor_lab_received_emr.py + refresh_lab_listview_ui.py + revise_lab_result_forms.py + switch_lab_workbench_to_center_specimen.py + Lab_Specimen_Collection_Status_Form_initCraft_import.json"
source_type: note
source_date: 2026-08-16
author: user + codex agent (parallel development workspace)
---

# HIS — Specimen status live session (VN snapshot, EMR-style receive, edit audit)

> A dense, same-week sequence of fixes (2026-08-15/16 — the days immediately before this ingest)
> building directly on [[his-lab-work-item-bridge]]'s finalized architecture. This is the
> **freshest and most detailed** material in the whole `codex-backup` ingest. Ingested 2026-08-16.

## What's working end to end (as of 15 Aug)

- `zdata_lab_center_order` = source order data; `zdata_specimen_collection_status` = the
  **canonical queue/status, one row per order × destination lab section** — no per-room CRUD queue
  needed (confirms [[his-lab-work-item-bridge]]'s design actually shipped).
- Lab UI shares one form, filtered by organization/section: "รายการรวม" shows every room,
  "รอรับ" filters to the chosen destination room; Hematology covers org codes `20` and `22`.
- The status API does **VN → patient snapshot hydration** (name, sex, age, photo, สิทธิ์, source
  room, vitals/BMI, blood group, allergy) written back onto the Status row.
- A backfill run succeeded on 3 real orders (`2069000020`, `5069000004`, `7069000002`); confirmed
  visually that room 70 (Biomolecular and Genetics) shows order `7069000002` in its "รอรับ" tab
  with HN/name/sex/age/สิทธิ/payment status populated.

## Two files named similarly — only one is current

`specimen-collection-status-api.js` (no suffix, **1,438 lines**, last modified 2026-08-16 20:39 —
after this ingest's other files) is the **live/authoritative** API. `specimen_collection_status_api_v2.js`
(254 lines, modified 2026-08-14 12:06) is the **earlier, smaller draft** it superseded — despite the
"v2" name suggesting the opposite. The v2 draft has only `list/create/migrate_one/update/
update_work_status`, with `create` calling `routeToLabUnit` inline; it has no visit-snapshot
hydration, no `center_order_id`, no edit-audit history, and no dev-mode switch. **Naming is
misleading — do not assume "v2" means newer for this pair of files.**

## `specimen-collection-status-api.js` — the live API (form process `6a7e787e8d398c11cf2fe8b8`)

Constants: `STATUS_FORM_ID='6a7daa3e8d398c11cf2fe869'`; collections `zdata_specimen_collection_status`,
`zdata_lab_center_order`, `zdata_lab_order_number_counter`; also reads Visit Tran
(`6a461235e521219e514d1c4b`), Visit (`6a40fdec4b6dfdf45acbfbce`), Vital Sign
(`6a470b4939179670f85ba2d8`), BMI (`6a4689ef39179670f85ba2a2`) forms.

**Actions:** `list`, `create`, `migrate_one`, `hydrate_visit_context`, `inspect_visit_benefits`,
`inspect_order_context` (read-only diagnostic), `backfill_visit_context` (two-step
preview/`confirm:true`, batched, **skips ambiguous HN/section matches** rather than guessing),
`update` (specimen_status `waiting→collected→sent`; a late `sent` event can never rewind a
`work_status` already past `waiting_receive`), `mark_received_once` (stamps the *first* receive
timestamp only — does **not** change `work_status`; this is the dev-mode "select but don't
transition" action), `resolve_center_order`, `get_order`, `materialize_center_order` (the
canonical, idempotent-per-`center_order_id`+section Center→Status materializer),
`sync_center_orders` (bulk reconcile, preview/confirm), **`sync_center_order_edit`** (diffs
`selected_items` before/after by key `master_id||id||item_id||code||item_code`, appends
`{changed_at, changed_by, added[], removed[]}` to `order_change_history_json` — **one immutable
record per edit event; added and removed are always stored together, never split**),
`update_work_status` (enforces the `WORK_TRANSITIONS` state machine documented in
[[his-lab-work-item-bridge]]).

`hydrateVisitSnapshot()` is the core snapshot builder: resolves Visit Tran/Visit/Vital/BMI by
`visit_id`, falling back to VN then HN lookup **only if the match is unique**
(`resolveVisitReference` never guesses on an ambiguous HN). Explicit invariant in the code: the
Status row's `xunitx` is the *destination* lab, so `source_unit`/`source_unit_name` must come from
Center's `xunitx` or the Visit's `visit_clinic` — never confuse the two.

**Dev-only switch:** `DEV_ALLOW_EARLY_LAB_ACTIONS = true` — while on, `mark_received_once` and
`update_work_status` accept `specimen_status` of `waiting`/`collected` (not just `sent`) as valid
for a `received`/downstream transition, so the Lab team can build/test before the Specimen team's
approve/send flow ships. Per the code's own comment, turning it off requires flipping the matching
UI switch in `rewire_lab_biochem_status_form.py` in the **same commit** — "neither alone is
sufficient." The server also independently blocks a late `sent` from rewinding a record already
`received/processing/rejected`, so the dev switch cannot un-receive something.

## Insert/Update event bindings on Center Lab Order

`on-center-lab-order-insert-v2.js` (bound to **Insert only**) — per its own docstring, "never
writes directly to the Center Lab collection; the only Center write-back is `xformDatax`."
Normalizes `selected_items_json` into per-section groups, assigns `order_number` via
`nextOrderNumber` (counter collection, format `<2-digit section><2-digit BE year><6-digit seq>`)
if missing, and — for each **new** section — creates a Status row by copying patient/visit fields
**directly from `params`**, not by calling the hydrate API. This confirms the finding logged
2026-08-16: Center Lab Order already carries `visit_id_link`, `visit_vn`, `inscl_hos_json` etc. at
insert time; the *original* (pre-v2) insert API simply never read them, inserting a Status row
with only `patient_hn`/`patient_name`/`visit_vn` and skipping hydration entirely. v2 is the fix —
paste it into API Factory, bind to Insert only, save/publish.

`on-center-lab-order-update-v1.js` (bound to **Update**, 51 lines) — calls
`app.subProcess('6a7e787e8d398c11cf2fe8b8', {action:'sync_center_order_edit', center_order_id,
selected_items_json})` and **awaits** it, per its own comment, so it "must finish before the
Center form's afterSaveCallback asks the received Lab card to reload." Center Lab Order is
explicitly the source of truth — its Update must never be replaced by editing the Status record
directly.

## Generator scripts (produce the live form JSON exports)

- **`upgrade_specimen_status_visit_context.py`** — idempotent patcher on
  `Lab_Specimen_Collection_Status_Form_initCraft_import.json`. Adds a hidden card
  (`visit_patient_snapshot`) with 18 hidden fields: `center_order_id, visit_id, visit_vn,
  visit_time, visit_type, person_id, patient_birth_date, patient_age, patient_gender,
  blood_group, patient_phone, patient_photo, allergy_tags_json, source_unit_code,
  source_unit_name, inscl_hos_json, vital_signs_json, bmi_json, order_change_history_json`.
  Confirmed present with `hidden=True` in the current export; `section_code`/`specimen_status`/
  `work_status` stay visible.
- **`upgrade_lab_received_opd_card.py`** (313 lines) — clones the **current live EMR OPD card**
  (source path `/Users/nichada/Documents/emr-current`, outside this vault) into
  `lab_received_component` inside `Lab_Biochem_initCraft_import.json`; reuses the existing
  Patient/BMI/Vital-Sign forms by ID rather than duplicating them. Selection key
  `s.receivedKey = row => order_number || lab_no || _id || id` **prefers the human LAB NO. over
  `_id`** — this is the fix for the "receive selection repair" bug (a queue row's `_id`
  representation didn't compare equal after `crudGetAll`, leaving the OPD card blank). Adds
  `List Order` and a filterable (all/added/removed) edit-history panel rendered from
  `order_change_history_json`, plus action buttons `ปฏิเสธสิ่งส่งตรวจ` / `แก้ไขรายการส่งตรวจ` /
  `เริ่มดำเนินการ` (the last calls `update_work_status: 'processing'`).
- **`rewire_lab_biochem_status_form.py`** (269 lines) — builds the Lab worklist UI in the same
  import file. `SECTION_BY_ORG` maps organization codes to section codes: `10→BC, 20→HM, 21→ML,
  22→HH, 30→IM, 31→MI-OUT, 40→MB, 41→MY, 50→BB, 70→BG` — the live section-routing table,
  consistent with the `room_code` table in [[his-lab-workbench-handoff]]. Mirrors
  `DEV_ALLOW_EARLY_LAB_ACTIONS` (with a comment to keep both files in sync). Hard-codes the tab
  pane selection key as `'lab_received'` — **the pane's option *name*, not its JSON node id**
  `tab-pane-lab-received` — and retries the tab switch at `[0, 120, 360]` ms to catch lazy
  mounting.
- **`upgrade_center_lab_visit_context.py`** (77 lines) — patches `Center_Lab_Order_Master_Bound.json`
  (not the Status form): adds 3 hidden fields (`visit_vn`, `source_unit_code`,
  `source_unit_name`) via an `onFormMounted` script reading `this.formParams`. Explicit comment:
  the source unit is deliberately **not** `xunitx` (that gets overwritten downstream with the
  destination lab) — the true originating room comes from `formParams.visit_clinic`.
- **`refactor_lab_received_emr.py`** — an earlier, simpler received-tab patient-card template
  (photo, HN, ward/coverage/payment chips, LAB NO./specimen/received time). Reads as a predecessor
  draft to the fuller EMR-card clone above, not something chained after it — the confirmed
  regeneration order below never invokes it.
- **`refresh_lab_listview_ui.py`** — patches ListView `customValue` mustache bindings for the
  worklist row (`labNoLabel`, `patientInitial`, date/time labels, ward/coverage/payment badge
  HTML, specimen/order-count labels, a status-badge mapper for `central_specimen_status`/
  `order_status` → Thai label + CSS class).
- **`revise_lab_result_forms.py`** — references `CPOE_ITEM_FORM_ID='6a79e45fd5218a5b6a26be9e'` and
  `UNIT_FORM_ID='6a7aa575935ed08882467368'` — the same IDs as the CPOE Lab Item Master / Shared
  Unit Master in [[his-lab-workbench-handoff]] — confirming it's the generator behind
  [[his-lab-work-item-bridge]]'s Result Definition/Result Item forms.
- **`switch_lab_workbench_to_center_specimen.py`** — confirms the Lab Workbench's aggregate
  "รายการสั่ง Lab ทั้งหมด" tab now reads from the specimen-status API process
  (`6a7e787e8d398c11cf2fe8b8`) rather than legacy Bio mock orders, via the `form_ui`'s published
  API process (not a `FORM` ListView provider, because Lab Center Specimen is a `form_ui` app, not
  `form_db`).

**Confirmed regeneration order** (matches `LAB_SESSION_MEMORY.md`'s stated sequence exactly):
`upgrade_specimen_status_visit_context.py` (schema first) → `rewire_lab_biochem_status_form.py`
(worklist UI) → `upgrade_lab_received_opd_card.py` **last**, since its own docstring says it
"replaces the received pane with the current EMR card" and depends on hidden fields the first
script adds.

## Narrative timeline of same-day fixes (2026-08-16, chronological)

1. **17:00 — first-receive time + Center order link.** `mark_received_once` stamps only the first
   click and keeps the row visible under "รอรับ"; later clicks reuse the saved timestamp. The
   received card's "แก้ไขรายการส่งตรวจ" now opens the real Center Lab form
   (`6a75a7810796231c653df996`) via a persisted `center_order_id`, never the derived Status
   record — future Center inserts copy `center_order_id` onto their Status rows.
2. **17:20 — order-edit synchronization.** Center Lab is confirmed source of truth; its Submit
   writes the full current `selected_items_json`. `sync_center_order_edit` computes true
   add/remove deltas per section and appends them to `order_change_history_json`; `changed_by`
   comes from server `userInfo`, no reason field collected.
3. **17:47 — Form Event binding verified live** on Center Lab Order Test: `Insert →
   on-center-lab-order-insert`, `Update → on-center-lab-order-update`, both enabled,
   `selected_items_json` included in the event's Property list. (Note: the saved reply text in
   `LAB_SESSION_MEMORY.md` names the bound processes without the `-v2`/`-v1` file suffixes —
   assume those refer to the same v2/v1 sources above unless contradicted live.)
4. **18:00 — edit history + popup-close repair.** The received card now always shows the "ประวัติ
   การแก้ไขรายการส่งตรวจ" section, explicitly stating "ยังไม่มีประวัติการเพิ่ม/ลบรายการ" when empty
   instead of hiding the section (distinguishes real-empty from a rendering bug).
   `afterSaveCallback` now calls `form.subFormClose()` after a successful Center Submit, and
   reloads the Status row at 0/300/900 ms to cover late-completing nested update events.
5. **18:05 — live test finding.** UI fix confirmed working, but a fresh Center edit still showed
   no history — root-caused to the **live published** `specimen-collection-status` API being an
   older version that doesn't append `order_change_history_json` yet. Action: publish the current
   local `specimen-collection-status-api.js` and `on-center-lab-order-update-v1.js` to API
   Factory, then retest.
6. **18:12 — persisted audit confirmed after publishing.** A green audit row for test code `C61`
   persisted correctly after the publish above. One audit design rule stated explicitly: **each
   edit event stores one immutable record with both `added[]` and `removed[]` together** — never
   split into two independent fields. A separate "lost on leaving tab" report was traced to a
   stale cached waiting-queue row, not a DB loss; `rewire_lab_biochem_status_form.py`'s Receive
   action now re-fetches `get_order` by LAB NO. before reopening the transient received workspace.

## Key takeaways

- **VN/HN patient-snapshot hydration**, done carefully (unique-match-only fallback, explicit
  destination-vs-source unit disambiguation), is the concrete mechanism that finally makes the Lab
  queue self-sufficient without re-querying EMR/Visit on every render — a capability
  [[his-lab-module-plan]] never reached.
- The **edit-audit trail** (`order_change_history_json`, add/remove always paired, one record per
  edit) directly satisfies the old plan's unresolved worry about order lines needing to be
  queryable documents, not an opaque JSON string.
- **Two dev-only switches exist in parallel** (`DEV_ALLOW_EARLY_LAB_ACTIONS` in the JS/py pair
  above, and a prose-only "`DEV_EMR_STYLE_RECEIVE_NAVIGATION`" in session memory that doesn't
  appear as an actual named constant in any file read here — see open question below) — both must
  be tracked and turned off together before this ships to real users, or the workbench will accept
  actions before the upstream Specimen approve/send flow is real.

## Entities & concepts touched
- [[his-lab-work-item-bridge]] — the architecture this session builds directly on top of.
- [[his-lab-workbench-handoff]] — parent data model / non-negotiable decisions.
- [[his-emr-form]] — the EMR OPD card this session clones into the Lab received tab.

## Contradictions / open questions
- `specimen_collection_status_api_v2.js`'s "v2" name is misleading — it is the **older** draft,
  not a successor. Flag this if anyone (human or future agent) reaches for "the v2 file" expecting
  the newer one.
- `DEV_EMR_STYLE_RECEIVE_NAVIGATION`, named explicitly in `LAB_SESSION_MEMORY.md`'s 2026-08-16
  15:54 entry, was **not found as an actual code constant** in any file read for this page — its
  described behavior (waiting row stays visible on Receive; Receive is select-only, not a durable
  transition) matches `mark_received_once` + `s.receivedKey` + the `lab_received` tab-key fix
  above, so it may be a prose label for that combined behavior rather than a literal flag. Confirm
  directly with the user or a future grep of the live (not local) published API source.
- The 17:47 Form Event confirmation names bound processes as `on-center-lab-order-insert` /
  `on-center-lab-order-update` without the `-v2`/`-v1` suffix seen on the local files — assumed
  equivalent but not verified against the live API Factory process list.
