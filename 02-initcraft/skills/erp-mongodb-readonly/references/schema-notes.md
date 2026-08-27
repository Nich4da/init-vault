# ERP MongoDB Schema Notes

Non-secret notes from read-only inspection. Keep this file concise and update it when live checks reveal stable schema information.

## Database

- Primary ERP database: `erp`
- Navicat connection label observed locally: `ERP`

## Collections Observed 2026-07-02

Live read-only check against database `erp` found 46 collections.

Vehicle / booking related collections:

- `zdata_vms_car_bookin`
- `zdata_vms_car_pdf`
- `zdata_vms_driver`
- `zdata_vms_vehicle`

`vehicle_booking_list` was not present as an exact collection name on 2026-07-02. The likely vehicle booking data collection is `zdata_vms_car_bookin`.

Core/system collections observed in Navicat cache:

- `core_files_manage`
- `core_roles`
- `core_setting`
- `core_user`
- `log_cache`
- `log_migrations`
- `module_api`
- `module_notify`
- `module_packages`
- `module_report`
- `module_sql`
- `sdform_manage`

## Naming Pattern

- `zdata_*` collections appear to hold initCraft/ERP form data.
- Some `zdata_*` collections use readable names, for example `zdata_employee`, `zdata_vms_vehicle`.
- Some `zdata_*` collections use generated IDs, for example `zdata_6a44774268ca67d64ac42595`.

## sdform_manage Notes Observed 2026-07-06

- `sdform_manage` had 70 form records: 42 `form_db`, 20 `form_ui`, and 8 `form_only`.
- 27 records had `form_enable: true`.
- 36 records had readable `form_db.schema`.
- `form_model` is stored as an encrypted payload with `key`, `iv`, and `data`; do not expect to read canvas/layout fields directly from MongoDB without the app decrypt path.
- Read field keys from `form_db.schema`, not `form_model`.
- Main reservation/vehicle mappings:
  - `แบบฟอร์มการขอใช้ห้องประชุม` (`6a3e20f9f9ccb9fc4c96ea72`) -> `zdata_reservation_room`
  - `การจัดการห้องประชุม` (`6a3e2bdcf9ccb9fc4c96ea73`) -> `zdata_manage_room`
  - `user_requester` (`6a461e0bb41b518466f63b0d`) -> `zdata_user_requester`
  - `แบบฟอร์มจองรถ` (`6a3dfc3ef9ccb9fc4c96ea60`) -> `zdata_vms_car_bookin`
  - `มาสเตอร์ยานพาหนะ` (`6a3dfb5ff9ccb9fc4c96ea5d`) -> `zdata_vms_vehicle`
  - `มาสเตอร์พนักงานขับรถ` (`6a3dfbb4f9ccb9fc4c96ea5e`) -> `zdata_vms_driver`
  - `มาสเตอร์พนักงาน` (`6a3dfbebf9ccb9fc4c96ea5f`) -> `zdata_employee`
- Meeting request form status field from schema: `approval_status`, label `สถานะการอนุมัติ - Hide`, component `select-input`, default `pending_supervisor`.
- Live data in `zdata_reservation_room` on 2026-07-06 had `approval_status` values `1`, `2`, `approved`, and `rejected`; no stored `pending_supervisor` records were found at that time.

## Vehicle Booking Dashboard Form

- Form name: `รายการจองรถของฉัน`
- Form id: `6a3b618dd4d096df7248fb0f`
- Builder URL: `https://softmax-one.com/sdform/form-builder?form_id=6a3b618dd4d096df7248fb0f`
- Data collection: `zdata_6a3b618dd4d096df7248fb0f`
- Form type/category: `form_db`, `Reserve a car`
- Updated at: `2026-07-05 14:46:27`
- This collection had no stored data when inspected on 2026-07-06; the form behaves like a dashboard/list screen that reads vehicle booking records from another form/table.
- Source vehicle booking form/table observed from related work: form id `6a3dfc3ef9ccb9fc4c96ea60`, data collection `zdata_vms_car_bookin`.
- Readable schema fields:
  - `selectyear_meeting`, `selecttype_meeting`: hidden `select-input` fields with static options `1`, `2`, `3`.
  - `total_count`, `pending_count`, `approved_count`, `completed_count`, `cancelled_count`, `draft_count`, `returned_count`: text count fields.
  - `filter_booking_status`: hidden text field used by list filters.
  - `text_input68837`, `text_input98553`: visible text inputs/placeholders.
- Runtime/list references observed from scripts and conversation:
  - List/component ref: `vehicle_booking_list`
  - Hidden filter ref: `filter_booking_status`
  - Base list filter generally excludes drafts: `booking_status != 'draft'`
  - Status filter values used: `pending`, `approved`, `completed`, `cancelled`, `returned`.
- Count refresh script uses process id `6a44800568ca67d64ac42597` via `/v1/process/...` and maps response `data.data` to the count fields.
- `form_model` is encrypted, so exact canvas layout, field-level event scripts, list-ui config, and template code are not recoverable from MongoDB alone.
- Full exported model was inspected from `C:\Users\marni\Downloads\model_sdform\.json` on 2026-07-06.
- Exported model component counts: 2 `card`, 3 `grid`, 9 `grid-col`, 10 `text-input`, 2 `text-ui`, 2 `button-ui`, 4 `vue-ui`, 2 `select-input`, 1 `list-ui`.
- Main title text refs:
  - `head_meeting`: `รายการจองรถของฉัน`
  - `subhead_meeting`: `รายการคำขอจองรถทั้งหมดของคุณ`
- Top action button:
  - `pagebutton_car` button label `จองรถ`
  - Calls `this.getFormRef().openForm("6a3dfc3ef9ccb9fc4c96ea60", "", "", null, {})`.
- Dashboard count cards are `vue-ui` components:
  - `total_requests` displays `{{ total_count || 0 }}`
  - `pending_requests` displays `{{ pending_count || 0 }}`
  - `approved_requests` displays `{{ approved_count || 0 }}`
  - `cancelled_requests` displays `{{ cancelled_count || 0 }}`
- Count fetch script is attached to `text_input68837.options.onMounted`, inside hidden card `card119748`; the field itself is not hidden, but its parent card is hidden.
- `vehicle_booking_list` settings from exported model:
  - `formId: "6a3dfc3ef9ccb9fc4c96ea60"`
  - `providerType: "FORM"`
  - `where: "booking_status != 'draft'"`
  - `searchField: ["purpose", "doc_no"]`
  - `limitRow: 30`
  - `actionEnable: true`, add/view/update/reload enabled, delete disabled
  - `listType: "listview"`, `listColumn: 4`, `totalEnable: true`
  - `reportList` includes PDF report `6a420efb9fb904582e3f6119` label `ดูเอกสาร`
  - `buttonsRow` includes `ดูเอกสารแนบ` but its `onClick` is empty in the export.
- `vehicle_booking_list.detailContent` displays `purpose`, `vehicle_type`, `origin`, `destination`, `doc_no`, `doc_date`, and status chip using `status_bg`, `status_color`, `status_text`.
- `vehicle_booking_list.customValue` derives:
  - `status_text`: maps `pending`, `assigned`, `completed`, `cancelled`, `draft`, `approved`, `returned` to Thai labels.
  - `status_bg`: maps status to tag background colors.
  - `status_color`: maps status to tag text colors.
- Status filter buttons live in `statusbutton_meeting` despite the name, and set `filter_booking_status` before mutating `vehicle_booking_list` editor state:
  - `ทั้งหมด`: clears hidden filter and applies base `booking_status != 'draft'`.
  - `รออนุมัติ`: `pending`
  - `อนุมัติแล้ว`: `approved`
  - `ยกเลิก`: `cancelled`
  - `จัดรถแล้ว`: `assigned`
  - `เสร็จสิ้น`: `completed`
  - `ตีกลับ`: `returned`
- The status filter script pattern sets `list.setFieldOption("where", where)`, ensures `editor.dpFormData.options`, assigns `editor.defaultWhere` and `editor.dpFormData.options.where`, then calls `editor.handleRefresh()`.

## Room Reservation

- Form: `แบบฟอร์มการขอใช้ห้องประชุม`
- Form id: `6a3e20f9f9ccb9fc4c96ea72`
- Data collection: `zdata_reservation_room`
- SQL config observed: `module_sql.sql_name = "reserve_meeting_room "`
- Status field: `status`
- Form schema label: `Status - Hide`
- Status field type/component: `String|Array`, `select-input`
- Default value: `"1"`
- API mapping observed in `module_api.api_name = "apirequeststatus"`:
  - `status == 1` -> `pending_requests` (รออนุมัติ)
  - `status == 2` -> `approved_requests` (อนุมัติ)
  - `status == 3` -> `cancelled_requests` (ยกเลิก)
- Live values observed 2026-07-02: `1` = 13 records, `2` = 2 records, `3` = 0 records.
