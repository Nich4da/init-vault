# Lab flow — session handoff

อัปเดต: 15 สิงหาคม 2569

## สถานะล่าสุดที่ทำสำเร็จ

- ใช้ `zdata_lab_center_order` เป็นข้อมูล order ต้นทาง และใช้
  `zdata_specimen_collection_status` เป็น canonical queue/status ต่อรายการต่อห้อง Lab
  (ไม่ต้องสร้าง CRUD queue แยกสำหรับแต่ละห้อง)
- Lab UI ใช้ฟอร์มร่วมกันและ filter ตาม organization/section:
  - รายการรวม = แสดงทุกห้อง
  - รอรับ = เฉพาะห้องปลายทางที่เลือก
  - Hematology ครอบคลุม section 20 และ 22
- API `specimen-collection-status-api.js` ทำ Patient Snapshot จาก VN และบันทึกกลับเข้า
  `zdata_specimen_collection_status`: VN, HN, ชื่อ, เพศ, อายุ, รูป, สิทธิ์, ห้องต้นทาง,
  vital/BMI, กรุ๊ปเลือด, allergy (เท่าที่ VN มีข้อมูล)
- ผู้ใช้รัน backfill ล่าสุดสำเร็จแล้ว 3 รายการ:
  `2069000020`, `5069000004`, `7069000002`
- ภาพล่าสุดยืนยันว่า room 70/Biomolecular and Genetics เห็น order `7069000002`
  ในแท็บรอรับ และแสดง HN/ชื่อ/เพศ/อายุ/สิทธิ์/สถานะชำระเงินได้

## เงื่อนไขสำคัญของ flow

- Backfill เติม snapshot ข้อมูลผู้ป่วยเท่านั้น ไม่เปลี่ยนสถานะ specimen
- ปุ่ม `รับ specimen` / `ปฏิเสธ specimen` จะขึ้นเมื่อฝั่ง Specimen ส่งรายการแล้วเท่านั้น:
  `specimen_status = sent` และ `work_status = waiting_receive`
- เมื่อกดรับ specimen ให้เปลี่ยนเป็น `received` และเปิดแท็บรับเข้าโดยอัตโนมัติ
  พร้อม OPD card และ List Order
- ปฏิเสธ specimen ต้องมี reason และเปลี่ยน `work_status` เป็น `rejected`

## ไฟล์หลักใน workspace

- `Lab_Biochem_initCraft_import.json` — หน้า Lab/รายการรวม/รอรับ/รับเข้า
- `Lab_Specimen_Collection_Status_Form_initCraft_import.json` — ฟอร์มสถานะ canonical
- `specimen-collection-status-api.js` — API สร้าง/อัปเดต/เติม VN snapshot/backfill
- `upgrade_lab_received_opd_card.py` — source สำหรับสร้าง OPD card แท็บรับเข้า
- `rewire_lab_biochem_status_form.py` — source สำหรับสร้าง Lab queue UI

## สิ่งที่ต้องทดสอบต่อ

1. ในแอป Specimen ให้ approve/ส่ง order `7069000002` เพื่อให้สถานะเป็น `sent` +
   `waiting_receive`.
2. กลับหน้า Lab เลือก Biomolecular and Genetics แล้วเปิดแท็บ `รอรับ`.
3. วางเมาส์บนแถว: ต้องเห็นปุ่ม `รับ specimen` และ `ปฏิเสธ specimen`.
4. กดรับ: ต้องกระโดดไปแท็บ `รับเข้า` และเห็น OPD card + รายการตรวจ.
5. ทดสอบปฏิเสธ: ต้องถามเหตุผลและย้ายรายการไปแท็บยกเลิก.

## Finding: new VN missing source clinic / benefits (2026-08-16)

- Confirmed against the live read-only database: the newly opened Visit already
  has `visit_clinic` and `inscl_hos`, and the matching Center Lab Order already
  has `visit_id_link`, `xunitx`, and `inscl_hos_json` before the Lab status row
  is created.
- The missing fields are **not** an eventual-consistency or Lab refresh issue.
  API `on-center-lab-order-insert` (`6a7d847e74a0be190cc32843`) directly inserts
  a Status row with only `patient_hn`, `patient_name`, and `visit_vn`; it bypasses
  `specimen-collection-status` snapshot hydration entirely.
- Replacement source is `on-center-lab-order-insert-v2.js`. Paste it into that
  API Factory process and save/publish; keep it bound to `insert` only.
- The live Status form schema currently lacks the hidden snapshot fields even
  though its export `Lab_Specimen_Collection_Status_Form_initCraft_import.json`
  includes them. Import/update that schema before relying on manual Status-form
  edits to preserve the snapshot fields.
- Existing incomplete rows can be repaired once through the existing API
  `specimen-collection-status` (`6a7e787e8d398c11cf2fe8b8`) action
  `hydrate_visit_context`; do not edit MongoDB directly.

## Temporary parallel-development Lab receive/reject (2026-08-16)

- The Specimen team has not yet delivered approve/send.  The Lab team may
  continue its UI and workflow development from newly created `waiting` or
  `collected` status rows.
- `specimen-collection-status-api.js` has a clearly marked temporary switch:
  `DEV_ALLOW_EARLY_LAB_ACTIONS=true`.  It permits `received` and `rejected`
  transitions before the upstream row is `sent`.
- `Lab_Biochem_initCraft_import.json` now uses the matching UI switch; on the
  room-scoped **รอรับ** tab, hover a waiting/collected row to see รับ specimen
  and ปฏิเสธ.  It labels the row `รอ specimen · โหมดพัฒนา`.
- When the Specimen approve/send flow is published, set both switches to
  `false` and re-import/update the Lab form.  The server also prevents a late
  `sent` event from rewinding a record already received/processing/rejected.

## ข้อความตอบล่าสุดที่ต้องส่งซ้ำเมื่อผู้ใช้พิมพ์ว่า “ทำต่อ”

> เรียบร้อยครับ ทั้ง 3 รายการถูกบันทึก Patient Snapshot ลง `zdata_specimen_collection_status` แล้ว ตามข้อมูลที่มีใน VN เช่น เพศ อายุ สิทธิ์ ห้องต้นทาง vital/BMI และ allergy
>
> ขั้นต่อไป:
>
> 1. รีโหลดหน้า Lab แบบ hard reload
> 2. เลือกห้องปลายทางของรายการ แล้วดูข้อมูลใน “รายการรวม”
> 3. เมื่อฝั่ง Specimen เปลี่ยนรายการเป็น `ส่ง specimen` ระบบจะแสดงในแท็บ “รอรับ” ของห้องนั้น
> 4. วางเมาส์บนแถว จะเห็นปุ่ม รับ specimen / ปฏิเสธ specimen
> 5. กดรับแล้วระบบจะพาไปแท็บ “รับเข้า” พร้อม OPD card และรายการตรวจของ order นั้น
>
> หมายเหตุ: Backfill นี้เติมข้อมูลผู้ป่วย แต่ไม่เปลี่ยนสถานะ specimen เอง จึงต้องให้รายการผ่านการอนุมัติ/ส่งจากฟอร์ม Specimen ก่อน ปุ่มรับจึงจะปรากฏครับ

## UI / flow update — receive queue and EMR OPD card (2026-08-16)

- `lab_waiting_center_specimen` no longer reuses the wide all-orders table.
  It is now a responsive, EMR-like row (`lab-waiting-row`), so the Lab screen
  does not need a horizontal scrollbar.  The patient block is first, then
  source/payment/benefit chips immediately beside it, then specimen/Lab/time/
  order/status.  Receive/reject buttons occupy a fixed right slot but appear
  only when the row is hovered or keyboard-focused.
- Receive now calls `lab_received_component.openForReceive(orderId)` when the
  target tab is mounted and also leaves `$labReceivedOrderId` for lazy tabs.
  It switches to `tab-pane-lab-received` immediately and once on next tick.
- The received component intentionally clears `selectedId` when the user
  leaves its tab.  Returning to "รอรับ" therefore clears the patient card;
  entering "รับเข้าแล้ว" manually does not retain the prior patient detail.
  A new Receive action selects and opens the new card.
- `upgrade_lab_received_opd_card.py` now lays out the received patient card
  with the same hierarchy as EMR: avatar, name/HN/age/gender/blood, benefits,
  VN/service-type/visit time/phone, BMI/BSA, and BP/PR/Temp/RR on the right.
  Unknown clinical snapshot values remain `-`, never mock data.
- Added hidden Status snapshot field `visit_type`.  Both
  `on-center-lab-order-insert-v2.js` and `specimen-collection-status-api.js`
  persist it; the card maps the EMR codes 1–5, including `4 = ตรวจรักษา`.
- Regeneration order for the current exports is:
  `python3 upgrade_specimen_status_visit_context.py`,
  `python3 upgrade_lab_received_opd_card.py`, then
  `python3 rewire_lab_biochem_status_form.py`.

## Receive selection repair (2026-08-16 15:34)

- Live read-only check verified `1069000004` remains in
  `zdata_specimen_collection_status` with `work_status: received`,
  `received_at: 2026-08-16 15:34:34`, section `10 / Biochemistry`.  It has
  not been deleted or lost; it correctly no longer belongs in the waiting
  queue.
- The received tab header could load that row but leave its OPD card blank:
  the client carried a row `_id` to the lazy received tab, and that returned
  row's id representation did not compare equal after `crudGetAll`.
- `rewire_lab_biochem_status_form.py` now carries the canonical
  `order_number` as `receiveKey`; `upgrade_lab_received_opd_card.py` selects
  by LAB NO. first and retains `_id` only as a fallback.  This preserves the
  requested clear-on-leave behavior while ensuring a newly received order is
  selected immediately when its tab opens.

## Corrected EMR-style receive navigation (2026-08-16 15:54)

- User clarified that the waiting row must remain visible after pressing
  `รับ specimen`; the button is a development-stage navigation/select action,
  not the durable `work_status: received` transition used in the future
  Specimen workflow.
- Verified EMR's exact hand-off from `EMR.json`: `goEmr(row)` stores the whole
  queue row at `form.$examTran`, passes it directly to a mounted `opd_card`
  state method, and switches `main_app.activeTabName`.  It does not remove the
  source queue row.
- Lab now mirrors that pattern with `form.$labReceiveTran` and
  `lab_received_component.setReceiveRow(row)`.  The received tab reads the
  full snapshot even if lazy-mounted, renders its OPD card/List Order, and
  clears this transient context only after leaving the received tab.
- `DEV_EMR_STYLE_RECEIVE_NAVIGATION=true` keeps waiting/collected (and the one
  existing legacy `received` test record) visible in `รอรับ` in this dev
  mode.  The receive click no longer calls `update_work_status: received`.
  `ปฏิเสธ` remains a real status transition.

## Tab navigation correction (2026-08-16 16:32)

- The waiting-list status caption is exactly `รอรับ` again; the temporary
  development wording was removed without changing any workflow behavior.
- The form export had two initial Tab panes marked `active` (`รายการรวม` and
  `รอรับ`).  It now has only `รอรับ` active at startup.
- `รับ specimen` still uses EMR's normal `activeTabName` assignment, and also
  applies the same target to the mounted Tab editor/reactive state at 0, 120,
  and 360 ms to cover the lazy received pane.  No durable specimen status is
  written by this button.

## Correct Tab pane key (2026-08-16 16:39)

- The actual Lab Tab selection key is the pane option name `lab_received`,
  not its JSON node id `tab-pane-lab-received`.  EMR's example did not expose
  this distinction because it uses a pane name that resembles its id.
- Both the receive click and the received-card leave watcher now use
  `lab_received`, preventing the lazy pane from flashing and then resetting
  to another tab.

## Full EMR OPD card in Lab (2026-08-16 16:47)

- User supplied the current EMR export at
  `/Users/nichada/Documents/emr-current`.  Its `opd_card` is now cloned into
  `lab_received_component`, including the Patient, BMI, Vital Sign, history,
  and BMI/Vital-Sign graph controls.
- The Lab row's `visit_id` is used to read the real Visit Tran through form
  `6a461235e521219e514d1c4b`; that EMR-shaped record is passed to the copied
  card.  A small status snapshot is only the immediate fallback during load
  or for an older record without a visit link.
- Existing Patient (`6a37d3bd4cfbfdbe257fc912`), BMI
  (`6a4689ef39179670f85ba2a2`), and Vital Sign
  (`6a470b4939179670f85ba2d8`) forms are reused.  They are not duplicated.
- Future export regeneration order is now
  `python3 rewire_lab_biochem_status_form.py` then
  `python3 upgrade_lab_received_opd_card.py`; the second generator must run
  last because it replaces the received pane with the current EMR card.

## First-receive time + original Center order link (2026-08-16 17:00)

- User supplied the current Center Lab export at
  `/Users/nichada/Documents/lab-center.json`.  Its `selected_items_json`
  retains a per-section `order_number` when the order sheet is edited, so it
  is the reliable link from a Lab Status row back to the originating order.
- The waiting row now labels its field `เวลารับ` and displays `received_at`.
  Its Receive action calls `mark_received_once`: it stamps only the first
  click, keeps the row visible under `รอรับ`, and opens the transient received
  workspace exactly as before.  Later clicks reuse the saved first timestamp.
- `specimen-collection-status-api.js` now resolves a Center order from a
  persisted `center_order_id`, with an exact LAB NO. fallback for legacy rows.
  The received-card `แก้ไขรายการส่งตรวจ` action opens the actual current
  Center Lab form (`6a75a7810796231c653df996`) using that id, never the
  derived Status record.
- Future Center Lab inserts now copy `center_order_id` to their Status rows
  in `on-center-lab-order-insert-v2.js`.  The Status form export contains the
  corresponding hidden `center_order_id` field.
- Regenerate in this order after modifying sources:
  `python3 -B upgrade_specimen_status_visit_context.py`,
  `python3 -B rewire_lab_biochem_status_form.py`, then
  `python3 -B upgrade_lab_received_opd_card.py`.

## Center Lab order-edit synchronization (2026-08-16 17:20)

- Center Lab is the source of truth.  Its standard submit writes the complete
  current `selected_items_json`; it must not be edited through the Status
  record.
- Added `sync_center_order_edit` to `specimen-collection-status-api.js`.
  For every section group with a LAB NO., it updates the matching Status
  record's `selected_items` and `specimens`, compares the previous and new
  item IDs/codes, and appends only true add/remove deltas to
  `order_change_history_json`.  The server `userInfo` supplies `changed_by`;
  no reason input is collected.
- `on-center-lab-order-update-v1.js` must be bound to the **update** event of
  Center Lab Order.  It awaits the Status sync so the parent form's save
  callback runs only after Status has the new data.
- The received-card edit popup calls `refreshSelectedOrder()` after Center
  save.  It fetches the freshly synchronized Status row so the List Order and
  green/red audit history update immediately without leaving the Lab tab.
- The Status schema now also has hidden `order_change_history_json`; import
  `Lab_Specimen_Collection_Status_Form_initCraft_import.json` before testing
  edit history.

## Edit history + popup-close repair (2026-08-16 18:00)

- The Lab received card now always exposes the “ประวัติการแก้ไขรายการส่งตรวจ”
  area.  It renders canonical `added` / `removed` audit records (and safely
  reads the legacy alias keys), with the green/red rows requested by the user.
- When no audit row reaches the card, it explicitly says “ยังไม่มีประวัติการเพิ่ม/ลบรายการ”
  instead of silently omitting the whole section.  This distinguishes a real
  empty audit from a rendering issue.
- The received-card `afterSaveCallback` now calls `form.subFormClose()` after
  a successful Center Lab Submit, following the working EMR popup pattern.
  It also reloads the derived Status row immediately, after 300 ms, and after
  900 ms to cover runtimes whose nested update event completes late.
- `upgrade_lab_received_opd_card.py` was regenerated successfully.  Before
  retesting, import/update both `Lab_Specimen_Collection_Status_Form_initCraft_import.json`
  (the hidden `order_change_history_json` field must exist in the live schema)
  and `Lab_Biochem_initCraft_import.json`.
- A history entry cannot be reconstructed safely for an edit made before the
  live Status schema had the audit field.  Test a new add/remove after import;
  each subsequent Submit should display the exact added and removed items.

### Live test finding (2026-08-16 18:05)

- User imported both JSON files.  The received card now renders the audit
  section and the Center edit popup closes correctly, confirming the UI fix.
- A fresh Center edit changed the List Order but still rendered “ยังไม่มี
  ประวัติการเพิ่ม/ลบรายการ”.  Therefore the remaining fault is not either
  JSON form: the live `specimen-collection-status` API is syncing
  `selected_items` without appending `order_change_history_json` (most likely
  it is an older published source).
- Next required live action: replace/publish the full local
  `specimen-collection-status-api.js` in API Factory process
  `6a7e787e8d398c11cf2fe8b8`, then save/publish the Update-event wrapper from
  `on-center-lab-order-update-v1.js`.  Retest one true add and one true remove.

## Persisted audit reopening + compact filter (2026-08-16 18:12)

- Live retest after publishing the APIs displayed a persisted green audit row
  for C61, so `order_change_history_json` is being stored correctly.  It is a
  hidden Status-form field and therefore is not a normal CRUD-list column.
- One audit field is intentional: every edit event stores its timestamp/user
  plus both `added[]` and `removed[]` in the same immutable record.  Do not
  create two independent fields, which could separate additions/removals from
  the same Submit.
- The apparent loss on leaving the received tab is a stale waiting-queue row,
  not a database loss.  `rewire_lab_biochem_status_form.py` now has the
  Receive action fetch `get_order` from Status by LAB NO. before reopening the
  transient received workspace, then replaces the cached waiting row.
- `upgrade_lab_received_opd_card.py` now fixes the history heading to one line
  and constrains the Element Plus filter to 160 px.  Regenerated and validated
  `Lab_Biochem_initCraft_import.json`; only this Lab UI import needs updating
  for these final UI/reopen changes.

## Verified Center Lab Form Event binding (2026-08-16 17:47)

- User opened **Center Lab Order Test → Form Event** and confirmed the event
  configuration is already correct:
  - `Insert` → `on-center-lab-order-insert`
  - `Update` → `on-center-lab-order-update`
- `Event Enable` is on and `selected_items_json` is included in **Property
  (Fields Name)**, so the Update API receives the edited selection payload.
- `Update Children Enable` requires no change for this work.
- The next immediate action is simply to click the form configuration's
  **Submit** button, then test an existing Center Lab record through Lab:
  click `แก้ไขรายการส่งตรวจ` → add/remove items → Submit.  The updated
  `selected_items_json` should sync the matching Specimen Status row and add
  green/red history using the current editor's name.
- If the user opens a new session and says **“ทำต่อ”**, first reply with this
  exact operational summary (concise Thai):
  “ใช่ครับ ถูกต้องแล้ว — ผูกเรียบร้อยครบทั้งสอง event:
  - `Insert` → `on-center-lab-order-insert`
  - `Update` → `on-center-lab-order-update`
  และ `selected_items_json` อยู่ใน Property ด้วย จึงส่งรายการที่แก้ไขไปให้
  API ได้
  กด **Submit** ด้านล่างเพื่อบันทึก config นี้ได้เลย แล้วทดสอบแก้รายการจาก
  ปุ่ม ‘แก้ไขรายการส่งตรวจ’ ในหน้า Lab: เพิ่ม/ลบ → Submit ควร sync รายการ
  และประวัติไปที่ Specimen Status ทันทีครับ”

## Center Lab Insert/Update status materialization repair (2026-08-16 22:xx)

- User confirmed the live form continues to use the original two API Factory
  processes; do **not** bind the separate
  `on-center-lab-order-materialize-status` process:
  - Insert -> `on-center-lab-order-insert` (`6a7d847e74a0be190cc32843`)
  - Update -> `on-center-lab-order-update` (`6a7edf818d398c11cf2fe93c`)
- Live read-only evidence: Center records created at 21:44 and 21:49 contain
  valid grouped `selected_items_json` for section 10, but no corresponding
  new rows exist in `zdata_specimen_collection_status`.  The last derived
  Status row was created at 17:20.
- The current Status schema contains only its core fields and does not contain
  `center_order_id` or the snapshot fields.  Therefore the form-provider
  create must use schema-safe core fields first; the canonical Status process
  enriches/routs the raw row by id afterward.
- Local `on-center-lab-order-insert-v2.js` and
  `on-center-lab-order-update-v1.js` now keep those original API names but act
  as small adapters: each sends only the saved `center_order_id` to
  `specimen-collection-status` action `materialize_center_order`.  That action
  reloads the durable Center record and creates/updates one Status per section.
- Local `specimen-collection-status-api.js` now handles EJSON/ObjectId values
  robustly and no longer sends the schema-absent `center_order_id` through the
  initial `sdformSetOne`; it persists that source link in the raw enrichment.
- Mock verification passed for one Center record containing sections 10 and
  20: exactly two Status rows were created and routed to `xunitx.code` 10 and
  20.  Deploy by replacing the source inside the existing Insert, Update, and
  `specimen-collection-status` APIs; Form Event bindings remain unchanged.

### Live resubmit finding (2026-08-16 22:08)

- The three missing Center records were resubmitted and their `updated_at`
  changed around 22:08, but Status still contained only the two older section
  10 records.  The section-10 counter also did not advance, proving the
  id-only adapter stopped before materialization.
- Keep the existing Insert/Update API bindings, but both adapters must pass
  `center_record: params` together with `center_order_id`; this installation
  cannot rely on reloading the just-saved Center record inside the subprocess.
- The live grouped Center JSON can have a blank group `order_number` while all
  nested selected items carry the same LAB NO. (observed `1069000012`).
  `normalizeCenterOrderGroups` now safely promotes that number only when all
  non-empty nested values agree, preserving the original LAB NO. during
  Status recovery.
- Local syntax and integrated mock tests pass for nested subprocess responses,
  existing LAB NO. preservation, and destination routing to section 10.

## Stable LabCen materialization + audit repair (2026-08-17 00:xx)

- A post-publish test order had a valid LAB NO. and Visit link in
  `zdata_lab_center_order`, but no matching
  `zdata_specimen_collection_status` row.  The referenced Visit itself had
  complete age and source-clinic data, proving the UI/filter was not the root
  cause; the derived Status materialization had stopped.
- Deploy the canonical `specimen-collection-status-api.js` to process
  `6a7e787e8d398c11cf2fe8b8`, not the shortened rollback source.  It retains
  the original list/create/update/work-status actions and adds Visit snapshot,
  Center materialization, reconciliation, routing repair, and audit actions.
- Insert/Update wrappers now merge the durable Center record with Form Event
  params, normalize BSON/ObjectId variants, require an explicit successful
  subprocess result, and retry idempotently with the durable row when needed.
- The materializer now normalizes section mnemonic to Organization room code,
  reuses a legacy Status by LAB NO. before creating a duplicate, and always
  persists destination `xunitx` on update.
- Fixed the audit overwrite bug: `nonEmptySnapshotPatch()` previously copied
  the pre-edit history over the newly appended add/remove entry.  The new
  history is now assigned last.  Integrated mock coverage passed for one
  create followed by an item add, including VN, age, source unit, room route,
  single-row idempotency, and persisted audit.

## Multi-Lab workflow checkpoint (2026-08-17)

- Live Center Lab submit was verified to create the derived Status row again:
  Center order `6a81ee2debe955d6977ec9b1` created LAB NO. `1069000017` for
  section `10 / Biochemistry` with no failed section.
- New Center Lab orders are expected to materialize in
  `zdata_specimen_collection_status`, retain VN/patient snapshot, preserve
  LAB NO., and route by the selected Organization/Lab section. Do not replace
  the working Insert/Update flow or refactor unrelated receive/edit/history
  functions.
- Reject is connected to the existing reject API/form:
  API `6a79ff46d5218a5b6a26bebc`, form `6a7713fdcc7d0a8451130331`, collection
  `zdata_lab_receive`. A live rejection record was saved successfully.
- Rejected orders belong in the same original Lab room's cancellation tab and
  need a `ตรวจซ้ำ` action that returns them to waiting receive and stamps the
  current receive time. Room filtering must happen before rendering to avoid a
  wrong-room flash. This UI path was iterated during the session; re-verify it
  before declaring it completely stable.

## Manual Lab result architecture checkpoint (2026-08-17 13:xx)

- The authoritative order-item master is the newer CPOE form
  `6a7c7c2974a0be190cc303e0` / collection
  `zdata_6a7c7c2974a0be190cc303e0`, source export
  `/Users/nichada/Documents/cpoe-item-lab.json`.
- The legacy/LIS test catalog remains form `6a597647d448dfc9d33e2d39` /
  collection `zdata_lab_test`, source export
  `/Users/nichada/Documents/lab-test.json`.
- `Lab_Result_Definition_Master` is the bridge from the exact CPOE master
  `_id` to one reportable/LIS test, plus result format, default unit, decimals,
  reference description, text choices, and active/revision metadata. A panel
  may therefore have multiple definition rows for the same CPOE item.
- The imported Definition form shown by the user has id
  `6a7aa5f4935ed08882467373`.
- Unit Master is form `6a7aa575935ed08882467368`, collection
  `zdata_lab_unit_master`. Its dropdown can legitimately remain empty until
  unit master records are imported.
- Current editable export is
  `Lab_Result_Definition_Master.json` in this workspace.

### Latest dropdown repair — pending live verification

- User imported the Definition form but the `รายการตรวจ (CPOE)` and
  `รายการผลตรวจ` Select By Form dropdowns displayed no records.
- The latest local JSON was corrected without touching other Lab functions:
  - removed the hidden `xrstatx NOT IN (0, 3)` filters from those two fields;
  - changed their inherited Text Input schema to the real Select By Form
    schema (`fieldType: Object|Array`, `defaultValue: null`, filterable,
    single-select, proper array label/search/ref fields);
  - retained CPOE form id `6a7c7c2974a0be190cc303e0`, Lab Test form id
    `6a597647d448dfc9d33e2d39`, `_id` value, and ObjectId storage;
  - normalized the Unit Select By Form schema as well.
- `jq empty` and the local configuration inspection passed. Browser runtime
  loading has not yet been verified. The next action is to import the updated
  `Lab_Result_Definition_Master.json` as a new test form and open the first two
  dropdowns. Do not claim success until records appear.
- If the first two dropdowns are still empty, inspect their `getdata-all`
  Network response before changing any more fields. The next planned work
  after dropdown verification is preparing/importing Unit Master data (likely
  Excel), then creating initial Result Definition mapping records.

## คำตอบล่าสุดเมื่อผู้ใช้พิมพ์ว่า “ทำต่อ”

ให้เริ่มด้วยการทวนสั้น ๆ ว่า:

> ตอนล่าสุดเราอยู่ที่ `Lab_Result_Definition_Master` ค่ะ คุณ Import ฟอร์มแล้ว
> แต่ dropdown รายการ CPOE และรายการผลตรวจไม่แสดงข้อมูล ฉันแก้ไฟล์
> `Lab_Result_Definition_Master.json` ให้เป็น Select By Form schema ที่ถูกต้อง
> และเอา hidden WHERE ที่ทำให้ได้ 0 รายการออกแล้ว ขั้นถัดไปคือ Import ไฟล์ที่
> แก้ใหม่และตรวจว่า dropdown สองช่องแสดงข้อมูลจริง ส่วนหน่วยจะยังว่างได้ถ้ายัง
> ไม่ได้ Import Unit Master หลังจาก dropdown ผ่านแล้วเราจะทำข้อมูล Unit Master/
> Excel และเริ่ม mapping Result Definition ต่อค่ะ
