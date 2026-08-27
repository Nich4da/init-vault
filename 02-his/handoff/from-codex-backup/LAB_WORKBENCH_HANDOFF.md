# Lab Workbench — Handoff / Working Memory

Updated: 2026-08-14 (Asia/Bangkok)

## Product Goal

Build **one deployable Lab Workbench app** for every laboratory section. It must not duplicate the same workflow per Lab.

The common workflow is:

```text
LabCen / CPOE order
  → รอรับ
  → รับเข้าแล้ว
  → เริ่มดำเนินการ
  → ลงผล Manual หรือรับผลจาก LIS
  → ออกผลแล้ว

Alternative path: ปฏิเสธ → ยกเลิกรายการ → ตรวจใหม่ → รับเข้าแล้ว
```

Sections such as `BC`, `HEM`, `MICRO` are data/configuration, not separate copies of the app. The active Lab filters every tab and every server-side API operation.

## Non-Negotiable Design Decisions

1. **One app, one set of workflow screens, one set of status APIs.**
2. All inbound LabCen/CPOE orders must carry a trustworthy `lab_section` before entering the workbench. The app must never infer the target Lab from a display name.
3. Every query is filtered by both `lab_section` and `order_status`.
4. APIs receive an Order ID and read the Order's `lab_section` from the database. Do not trust a section passed from UI for authorization/filtering.
5. Lab manager/administrator may switch the active section. Normal users see only their permitted sections. Enforce this server-side as well as in UI.
6. Use a shared Unit Master and shared Result Item store. Test-specific configuration is kept in Result Definition Master.
7. Do not hard-code clinical units, reference ranges, critical limits, or interpretation. These must be approved from the laboratory's LIS/analyzer/reagent validation.

## Shared Data Model

### Order (central worklist record)

Required fields:

```js
{
  _id,
  lab_section: 'BC',             // required routing key
  order_status: 'waiting_receive' | 'received' | 'processing' | 'resulted' | 'rejected',
  lab_no,
  selected_items_json,           // selected CPOE Lab items
  specimen_json,                 // generic future name; legacy Bio uses biochemistry_specimen_json
  received_at,
  received_by,
  rejected_at,
  rejected_by,
  result_source: 'manual' | 'lis'
}
```

Queue filters:

```text
waiting:   lab_section = activeSection AND order_status = waiting_receive
received:  lab_section = activeSection AND order_status = received
processing/result entry: activeSection AND order_status = processing
resulted:  activeSection AND order_status = resulted
rejected:  activeSection AND order_status = rejected
```

### Result Item (one result per ordered test)

Create once per selected test when processing starts. Must preserve snapshots, so later Master changes do not alter historical reports.

```js
{
  order_id,
  lab_section,
  lab_no,
  test_code,
  test_name,
  result_definition_id,
  result_source: 'manual' | 'lis',
  result_status: 'draft' | 'entered' | 'verified' | 'void',
  result_number,
  result_text,
  unit_code_snapshot,
  unit_symbol,
  reference_range_snapshot,
  result_comment,
  is_critical
}
```

LIS matching must use at least `lab_section + lab_no + test_code`; never `lab_no` alone.

## Existing Masters / Forms

### Existing production forms found by read-only inspection

| Purpose | Form | Form ID | Collection |
|---|---|---:|---|
| Lab/Section Master | `[Lab room] ประเภทการตรวจ` | `6a79986bd5218a5b6a26bd15` | `zdata_section_code` |
| CPOE Lab Item Master | `CPOE Lab Item Form` | `6a79e45fd5218a5b6a26be9e` | `zdata_cpoe_lab_order_item` |
| Shared Unit Master | `Lab_Unit_Master` | `6a7aa575935ed08882467368` | `zdata_lab_unit_master` |
| Bio Order | `Lab_Bio_Order` | `6a771f20cc7d0a8451130339` | `zdata_testlab_bio` |
| Bio Rejection form | `ปฏิเสธสิ่งส่งตรวจ-Bio` | `6a7713fdcc7d0a8451130331` | `zdata_lab_receive` |

### Unit Master

User has populated the Unit Master. It is intentionally generic and intended for all Labs. Common stored fields:

```text
unit_code, unit_symbol, unit_name_th, unit_name_en,
unit_dimension, decimal_places_default, is_active, unit_note
```

The default decimal count is only a display fallback. The definitive decimal count belongs to each Result Definition.

### CPOE Lab Item Master

Already contains ~838 records and should be the single master for orderable tests:

```text
item_code, item_name, section_id, c_specimen, service_group,
item_desc, billing codes, sale_price, withdraw_price
```

Do **not** create a duplicate Test Master.

### Pending Result Definition Master redesign

`Lab_Result_Definition_Master.json` exists locally but is an early draft and should be revised before broad use.

It should contain Select By Form references to:

1. `lab_item_id` → CPOE Lab Item Form (`6a79e45fd5218a5b6a26be9e`)
2. `default_unit_id` → Lab Unit Master (`6a7aa575935ed08882467368`)

Keep in this form only reporting configuration: result type, decimal places, approved reference range profiles, approved qualitative options, method/analyzer/version, activation/revision.

Avoid manual duplicate fields for `lab_section_code`, `test_code`, and test names; obtain them from the CPOE Item reference/snapshot.

## Current Bio Workspace Files

- `Lab_Biochem_initCraft_import.json` — Bio workbench UI draft; contains legacy hard-coded `BC` paths that must be generalized before reuse.
- `Lab_Bio_Order_CRUD.json` — Bio order input form.
- `Lab_Bio_Rejection.json` — rejection form JSON draft.
- `Lab_Bio_Receive_Order_API.js` — receive/start-process API source.
- `Lab_Bio_Reject_Specimen_API.js` — reject/recheck API source.
- `Lab_Unit_Master.json` — Unit Master import JSON.
- `Lab_Result_Definition_Master.json` — early Result Definition JSON; redesign as above.
- `Lab_Result_Item.json` — early Result Item JSON; add fields noted above before production use.

## Known Defects / Important Current State

1. The rejection form saves records successfully, but records were duplicated because Submit was repeated while status transition failed.
2. The source Bio Order remained `waiting_receive`; it did not move to rejected.
3. Root cause found: both local APIs originally targeted a wrong collection:

```js
// Wrong
const ORDER_COLLECTION = 'zdata_6a771f20cc7d0a8451130339'

// Correct for current Bio Order
const ORDER_COLLECTION = 'zdata_testlab_bio'
```

4. Local files `Lab_Bio_Reject_Specimen_API.js` and `Lab_Bio_Receive_Order_API.js` have been changed to the correct collection, but the user must paste the exact updated source into API Factory and Save/Publish. Do not claim live behavior is fixed until it is tested.
5. Historical redundant rejection audit rows exist in `zdata_lab_receive`. Do not delete them without explicit user authorization and a reviewed cleanup plan.
6. The current Bio dashboard contains references to `BC`, `biochemistry_specimen_json`, and Bio-specific labels. These must be generalized only after the existing Bio flow works end-to-end.

## Next Implementation Milestones

1. Verify the fixed Reject API in API Factory using one test order, one Submit only.
2. Verify Receive and Start Process API against `zdata_testlab_bio`.
3. Revise/import Result Definition Master to reference CPOE Item Master and Unit Master.
4. Revise/import Result Item, then implement Start Process to create one Result Item per ordered test.
5. Implement manual-result entry with result type/decimal/unit/reference snapshots sourced from Result Definition.
6. Define LIS inbound contract and matching/update rules.
7. Generalize the Bio workbench:
   - active Lab selector/context
   - dynamic section filter in all queues
   - generic specimen data model
   - neutral labels/API names
   - role-based permitted sections
8. Add Lab-specific extension only where workflow genuinely differs (e.g. Microbiology culture/susceptibility).

## Safety / Working Notes

- The user said the separate "form for storing edits" is deprecated; retain audit history within the Order/result workflow instead.
- Use MongoDB only read-only unless explicit write permission is supplied.
- Do not request/store user credentials or put credentials in `.env`. A configured read-only MongoDB connector is already available for schema/data inspection.
- Treat patient/order/results as sensitive data. Avoid copying raw production patient data into workspace notes.

---

## Lab Center / CPOE Master Work — Current Pause Point (2026-08-13)

### Resume trigger

If the user writes **`ทำlabcen ต่อจากเดิม`**, first send this exact reminder before continuing:

> ถูกครับ `room_code` ถูกบันทึกแล้ว — ผมเช็คด้วยชื่อ field ผิดเป็น `room_no` เลยรายงานคลาดเคลื่อน
>
> จากข้อมูลจริงตอนนี้ mapping ห้องของ LAB ถูกต้องเกือบครบ เช่น BB = 50 ตามรูป, BC = 10, HM = 20, HH = 22 เป็นต้น เหลือเพียง Pathology (PA) 1 รายการที่ยังไม่มีเลขห้องครับ

### Product direction agreed

1. **Lab Center** is the single physician CPOE screen: the doctor chooses LAB and Xray items in one place.
2. The central order must route each selected item by its master `order_type`, `section_id`, and `room_code`; each laboratory then works its own workflow/worklist.
3. The established **Bio Order** behavior is the reference pattern: selection must be saved, reopened correctly in CRUD, and specimen must be saved with the order.
4. The catalog in Lab Center must load dynamically from the CPOE master. A later edit to a master record affects future catalog displays; an already-submitted order keeps a snapshot of what was selected.
5. `HM` (Hematology) and `HH` (Hematology-Homeostasis) remain distinct routing codes but display together in one UI tab named **Hematology**.

### Forms and live collections

| Purpose | Form ID / source | Collection / status |
|---|---|---|
| CPOE Item Master (Lab + Xray clone) | `6a7caae774a0be190cc30756` | `zdata_cpoe_order_lab_xray` |
| Center Lab Order test clone | `6a7cbdfc74a0be190cc3206c` | configure/verify after JSON import |
| Lab room / Section Master | `6a79986bd5218a5b6a26bd15` | `zdata_section_code` |
| Specimen Master | `6a79a797d5218a5b6a26bddc` | `zdata_specimen_code` |

The source Lab Center form backup is:

```text
/Users/nichada/Documents/init-vault/HIS/sdform_module/EMR_form/lab_center_order.json
```

### Master data: verified live state

Collection `his.zdata_cpoe_order_lab_xray` has **1,605 active records**, successfully imported:

| `order_type` | Count |
|---|---:|
| `LAB` | 830 |
| `Xray` | 775 |

- No active record is missing `item_code`, `item_name`, `order_type`, or `section_id`.
- Five item codes are intentionally duplicated across different specimen variants: `C25`, `C25.1`, `C25.2`, `C25.3`, `C25.4`. Never identify a selection by `item_code` alone; carry the master record `_id` as `master_id` too.
- LAB specimen (`c_specimen`) is missing in 14 master items. Those items need master-data review before automatic specimen-record generation is considered complete.
- The current master stores room under **`room_code`**, not `room_no`.
- Room mapping is now present for every LAB section except a single Pathology (`PA`) record:

| Section | Room code |
|---|---:|
| BG | 70 |
| BB | 50 |
| MY | 41 |
| MB | 40 |
| MI-OUT | 31 |
| IM | 30 |
| BC | 10 |
| HH | 22 |
| ML | 21 |
| HM | 20 |
| PA | missing for 1 record |

### Master field contract

Use these CPOE master fields in Center Lab Order runtime code:

```js
{
  _id,                 // retain as master_id for each selection
  item_code,
  item_name,
  order_type,          // exact master values: 'LAB' | 'Xray'
  section_id,          // routing code, e.g. BC, HM, HH, CT
  section_name,
  room_code,           // correct field name
  c_specimen,
  service_group,
  item_group,          // deliberately equals service_group in imported data
  item_desc,
  item_nhso_code,
  item_nhso_bkk_code,
  item_csmbs_code,
  tmlt_code,
  item_sub_code,
  sale_price,
  withdraw_price
}
```

`c_specimen` in legacy/master rows can be an object, JSON string, or simple specimen-code string (for example `"CD"`). Runtime normalization must support all three and resolve to a snapshot from `zdata_specimen_code`.

### Current code artifacts

| File | Purpose / status |
|---|---|
| `build_cpoe_item_import.py` | Regenerates the consolidated import workbook. It currently emits `room_no`; update it to emit **`room_code`** before any re-import. |
| `CPOE_Item_Master_Import.xlsx` | Consolidated 1,605-record master import workbook. |
| `build_center_order_master_bound.py` | Generates the dynamic Center Lab Order JSON. Needs the next fix below. |
| `Center_Lab_Order_Master_Bound.json` | Current generated JSON; imported/tested enough to reveal grouping issue below. |

### Open bug to fix next — top-level LAB/Xray separation

The current `Center_Lab_Order_Master_Bound.json` dynamically reads the master and correctly handles section grouping fallbacks, but its catalog loader currently feeds all master rows into `s.sections.lab`. This is why Xray category tabs such as **Computed Tomogram**, **CT scan**, and **General X-ray** appear under **LAB ORDER**.

Fix `build_center_order_master_bound.py` so each order-sheet widget filters dynamically by its own `s.orderType`:

```js
const expectedOrderType = s.orderType === 'xray' ? 'XRAY' : 'LAB'
const actualOrderType = String(row.order_type || '').trim().toUpperCase()
if (actualOrderType !== expectedOrderType) return

// Write into the current widget's catalog, not always lab:
s.sections[s.orderType] = sections
```

The master’s user-facing values are exactly `LAB` and `Xray`; uppercasing them for comparison makes the runtime check safe.

Keep the selected item snapshot including `master_id`, `section_id`, `room_code`, `c_specimen`, prices, and billing codes. The routing code remains HM or HH even though both render under the combined `Hematology` tab.

### Earlier runtime fixes already made in generator

1. Convert potentially numeric group values with `String(row.item_group || '').trim()` to prevent `trim is not a function`.
2. Use the source section code when generating group/item keys to prevent `sectionCode is not defined`.
3. Resolve tab label fallback in this order: `row.section_name` → known Xray name map → source code. This prevents Xray CT items being labelled `ไม่ระบุหมวด` when its section-name field is unavailable.

### Next-session execution order

1. Correct the generator to filter rows on `order_type` and populate `s.sections[s.orderType]`.

---

## Center Specimen Hub — Paused Debugging State (2026-08-13 18:20 ICT)

### Agreed workflow

```text
Center Lab Order saved
  ├─ appears in Center Specimen Hub: “รายการรวมตรวจ specimen”
  └─ will eventually create/show a lab-section work item as “รอ specimen จากศูนย์กลาง”

Center staff presses “ตรวจ specimen”
  → record moves to “ตรวจ specimen”
  → staff checks the specimen/trick sheet
  → presses “Specimen ครบ — ส่งต่อห้อง Lab”
  → record moves to “ส่งต่อห้อง Lab แล้ว”
  → future work-item process releases the target laboratory record as `waiting_receive`
```

Central status fields intended on the Center Order record:

```js
central_specimen_status: 'checking' | 'forwarded'
central_checked_at
central_checked_by
central_forwarded_at
central_forwarded_by
```

Keep `lab_no` on the record. The team is separately implementing Lab No. generation.

### Files and imports

| File | State |
|---|---|
| `build_lab_center_specimen_hub.py` | Original full `vue-ui` prototype. Do **not** use: it produced proxy / `activeTab` render errors. |
| `rebuild_lab_center_specimen_hub_widgets.py` | Generator for the safe widget/ListView-only version. |
| `Lab_Center_Specimen_Hub_WIDGETS_V2.json` | Current import file. Uses Tab + ListView widgets only, no `vue-ui`. |

The user has imported variants creating these live forms:

| Form ID | Type | Table | State |
|---:|---|---|---|
| `6a7da2b48d398c11cf2fe85b` | `form_db` | `zdata_center_approve_specimen` | early import, disabled |
| `6a7da5918d398c11cf2fe862` | `form_db` | generated zdata table | early import, disabled |
| `6a7da6ec8d398c11cf2fe865` | `form_ui` | none | newest app form, enabled; this is the one user was testing |

### Verified live data (read-only Mongo check)

Use database **`his`**, not `erp`.

| Item | Verified value |
|---|---|
| Center Order form | `6a75a7810796231c653df996` — `Center Lab Order Test` |
| Collection | `his.zdata_lab_center_order` |
| Existing records | **52** at 2026-08-13 18:20 ICT |
| Form table | `zdata_lab_center_order` |
| Sharing | Center Order form has `data_sharing: public`; it is enabled |

The V2 ListViews already point to this correct provider:

```js
formId: '6a75a7810796231c653df996'
providerType: 'FORM'
where: '' // first tab intentionally unfiltered
```

Therefore the user report **“รายการรวมตรวจยังเป็น 0” is not caused by no data or the first-tab filter.**

### Why this remains unresolved

The new App (`form_ui`, id `6a7da6ec...`) shows the ListView UI correctly but its runtime ListView query returns zero. Earlier builder preview of a prior version displayed 33 rows, so the issue is likely a runtime/provider configuration incompatibility of the imported `form_ui` screen, not the Center Order collection.

Potential checks / next actions:

1. Compare the persisted model of the working old preview against the current `form_ui` App model. In particular, ListView provider needs to match the platform's exact `providerType`/`formId` representation in an App Factory `form_ui` screen.
2. Confirm the App Viewer user has read access to the Center Order **form provider** (not just public data sharing). The Center Order provider is public in DB but App runtime may require the source form to be shared/assigned to the app user/role.
3. In the live new App, click ListView reload and inspect browser Console/Network response for its `crudGetAll` provider call. Do not guess a new filter; provider response is the missing evidence.
4. If form-ui ListView cannot cross-read FORM providers in this build, use a small ListView-compatible `onMounted`/widget adapter only after confirming the stable platform pattern. Avoid returning to the old global `vue-ui` implementation because it caused:

```text
SDCustomContent render error:
'getOwnPropertyDescriptor' on proxy: trap returned descriptor for property 'activeTab'...
```

### Field/display notes

`selected_items_json` is populated in Center Order records and each item contains `c_specimen` data (e.g. specimen code/label). Some historical records have `patient_hn` and `patient_name` as null because the orders were created before patient context was connected; this affects display only and does not explain a zero count.

The V2 generator uses `customValue` simple mustache bindings (`{{patientNameLabel}}`, etc.). This was intentional: ListView templates render `{{fieldName}}` but do not evaluate JavaScript expressions inside `{{ ... }}`. Do not restore expressions such as `{{patient_name||'-'}}`, which display literally.

### Important workflow gap (not yet implemented)

Center approval currently only intends to update the Center Order status. It does **not** yet create/update real per-lab work items. The next architecture step after the UI query is fixed:

```text
Center Order × distinct lab section
  → Lab Work Item
  → status `awaiting_central_specimen`
  → central forwarded
  → `waiting_receive` for that lab section
```

The existing Lab Workbench still reads legacy Bio mock orders (`Lab_Bio_Order`, id `6a771f20cc7d0a8451130339`) for its full workflow; it has not yet been migrated to the Work Item model.
2. Regenerate and import `Center_Lab_Order_Master_Bound.json` into the Center Lab Order test clone.
3. Preview: LAB ORDER must show only LAB sections; Xray ORDER only Xray sections. Confirm Hematology combines HM/HH only visually.
4. Test selecting items, submitting, and reopening CRUD: selected items and normalized specimen records must persist as order snapshots.
5. Review the 14 LAB master items without `c_specimen` and the single PA record without `room_code` before downstream worklist automation.

---

## Current Resume Point — Center Specimen → Shared Lab Work Queue (2026-08-14)

This section supersedes the older statement above that a work-item process was still unimplemented.

### Finalized architecture

```text
Lab Center Specimen App (source/status screen)
  zdata_specimen_collection_status
  waiting → collected → sent
       │ only when sent
       ▼
Lab Work Item CRUD (shared operational queue)
  zdata_lab_cen_crud
  one record per source specimen record × lab section
       ▼
Native ListView in each Lab Workbench
  filtered by top-level section_code + work_status
```

There is **one** shared Work Item CRUD form for all Lab rooms; do not create one CRUD form per room.  `section_code` is the routing key.  Hematology’s UI includes both `HM` and `HH`; retain the two source codes in data.

### Live IDs and collections

| Purpose | ID / collection | Role |
|---|---|---|
| Lab Center Specimen App | `6a7da6ec8d398c11cf2fe865` | `form_ui` source/status screen; it is not a ListView provider |
| Existing specimen-status API | `6a7e787e8d398c11cf2fe8b8` | Lists and changes `waiting` / `collected` / `sent` in `zdata_specimen_collection_status` |
| Work Item CRUD form | `6a7e818b8d398c11cf2fe8d4` | Shared persisted queue, `zdata_lab_cen_crud` |
| Work Item bridge API | `6a7e82ba8d398c11cf2fe8d5` | Idempotently creates/updates a Work Item from a sent source record |

### What is currently wired

Local file `lab_center_specimen.json` has been modified and JSON-validated.  Its `send(row)` action:

1. calls status API `6a7e787e8d398c11cf2fe8b8` with `{ action: 'update', status: 'sent' }`;
2. then calls bridge API `6a7e82ba8d398c11cf2fe8d5` with `{ source_record: {...row, specimen_status: 'sent'} }`.

The first API and the bridge API are **not duplicate APIs**:

- status API owns the Center Specimen lifecycle;
- bridge API owns the creation/update of the target Lab queue record.

“Wired” currently means the exported local JSON contains both process calls.  It takes effect in the hosted App only after importing/publishing that JSON.  The original status API source does **not** yet invoke the bridge internally.

### Recommended cleanup (next implementation task)

Keep both APIs, but make the status API the sole process called by the App:

```text
App → status API → (if nextStatus === 'sent') subProcess(bridge API) → Work Item CRUD
```

Then remove the direct second process call from `lab_center_specimen.json`.  This keeps the client simple and makes the API flow reusable.  The bridge must preserve idempotency using `source_specimen_record_id + section_code`, so a retry never creates duplicate queue rows.

Do not release a row to a Lab workbench at `collected`: it must appear only after the Center has marked it `sent`.

### Work Item fields/statuses

Essential fields include `source_order_id`, `source_order_number`, `source_specimen_record_id`, `lab_no`, `section_code`, `section_name`, patient snapshot, order/specimen JSON snapshots, and audit timestamps/users.

`work_status` values:

```text
waiting_receive → received → processing → resulted → completed
                         └→ rejected / cancelled
```

### Next session — exact order

1. Decide/implement the API cleanup above: add the bridge `subProcess` to status API `6a7e787e...`, then simplify and re-import `lab_center_specimen.json`.
2. Test a known Hematology source record: `waiting → collected → sent`; verify exactly one `zdata_lab_cen_crud` record with `section_code` `HM` or `HH` and `work_status: waiting_receive`.
3. Convert `Lab_Biochem_initCraft_import.json` from temporary Components adapters back to native ListViews using Work Item form ID `6a7e818b8d398c11cf2fe8d4` as `FORM` provider.
4. Apply Lab-section filters on every tab; Hematology filter is `section_code IN ('HM','HH')`.  A native ListView is now appropriate because the target is a `form_db` CRUD form, unlike the old `form_ui` source App.
5. Add row action “รับสิ่งส่งตรวจ” to update the Work Item (`work_status: received`, fresh `received_at`, `received_by`), not the source Center record.

### Local source files

| File | State |
|---|---|
| `Lab_Work_Item_CRUD.json` | import source for shared CRUD form |
| `Lab_Center_Specimen_To_Work_Item_API.js` | source for bridge API `6a7e82ba...` |
| `lab_center_specimen.json` | current App export with client-side two-process wiring |
| `wire_lab_center_specimen_to_work_item.py` | generator/patch script that made the current wiring |
| `Lab_Biochem_initCraft_import.json` | needs native ListView migration to Work Item CRUD |
