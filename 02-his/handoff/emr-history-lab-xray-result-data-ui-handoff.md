# EMR History — LAB / X-Ray Result Data & UI Handoff

อัปเดต: 24 ตุลาคม 2569 (2026-10-24, Asia/Bangkok)  
สถานะ: พร้อมส่งทีมพร้อม LAB API full replacement แบบ additive; Live API ยังไม่ถูกเปลี่ยนและยังต้องผ่าน UAT  
ขอบเขต: หน้า **ประวัติการเจ็บป่วย / EMR History** เฉพาะผล LAB และ X-Ray แบบ read-only

## 1. เป้าหมายและข้อสรุปที่ทีมต้องยึด

ภาพปัจจุบันแสดงการ์ดชื่อรายการ เวลาสั่ง เลขคำขอ และสถานะ `ส่งแล้ว/ยกเลิก`
แต่ยังไม่ทำให้แพทย์เห็น “ผล” อย่างครบถ้วนในลำดับที่สัมพันธ์กัน

โครงสร้างใหม่ต้องเป็นดังนี้:

```text
Visit
└─ CPOE Order
   ├─ LAB Section / LAB NO.
   │  └─ Ordered Test หรือ Profile
   │     ├─ Result Component 1
   │     ├─ Result Component 2
   │     └─ Comment / Critical / Verification
   └─ X-Ray Exam
      ├─ Reading / ResultText
      ├─ Result status / date / radiologist
      └─ Image / PDF / same-exam history
```

ข้อกำหนดหลัก:

1. Tab ประวัติผลต้องแสดงเฉพาะ Order ที่มีผลจริงหรือมีผลที่ถูกปกปิดตามสิทธิ์แล้วเท่านั้น
   ไม่แสดง Order ที่มีเพียง `sent`, `ready`, `cancelled` หรือไม่มี Result row.
2. LAB ต้องคงลำดับ `Order → Ordered Test/Profile → Result Item`; ห้ามทำทุก Result Item
   เป็นการ์ด Order แยกกัน.
3. Partial ต้องแสดงผลที่ออกแล้วและชื่อรายการที่ยังรอผลใน Profile/Order เดียวกัน.
4. Critical ของ LAB ใช้ `is_critical === true` จาก Agent/LIS เท่านั้น. ห้ามคำนวณจาก
   Ref. Range หรือมี `critical_*_rule` แล้วสรุปเอง.
5. X-Ray ยังไม่มี contract ที่ยืนยันว่า `SeverityUid` ค่าใดคือ critical. ให้แสดงเป็น
   raw severity/status หรือซ่อนจนกว่าจะมี mapping ที่ RIS ยืนยัน; ห้ามเดา.
6. Sensitive LAB ต้องคง re-auth, redaction และ access logging เดิม. สีหรือ UI ใหม่ห้าม
   ทำให้ค่า, comment, previous result, attachment หรือ PDF รั่วก่อนผ่านสิทธิ์.
7. ทุกสถานะต้องมีข้อความ ไม่ใช้สีเป็นตัวสื่อเพียงอย่างเดียว.

## 2. Provenance และระดับความเชื่อมั่น

ข้อมูลในเอกสารนี้ตรวจแบบ read-only เมื่อ 2026-10-24 จาก:

- `his.sdform_manage` — Form ID, collection และ readable `form_db.schema`.
- `his` collections — ตรวจเฉพาะชื่อ field/type/count/schema; ไม่บันทึกข้อมูลผู้ป่วย.
- `his.module_api` — Process name/ID/owner.
- `his.module_report` และ `his.module_sql` — Report/SQL ID, parameter, source collection,
  lookup และ output field.
- local implementation: `emr-lab-board-get.js`, `emr-xray-history-get-v2-REPLACE.js`,
  EMR History v4 replacement และ canonical LAB contract.

ระดับหลักฐาน:

- **ยืนยัน live**: collection, Form/Report/SQL/API ID, field names, current stored types.
- **ยืนยันจาก current implementation**: join/grouping และ response shape ของ API.
- **ยืนยันจาก local replacement + static regression**: LAB response contract ใหม่ใน
  `emr-lab-board-get-v2-REPLACE.js`; ยังไม่ใช่หลักฐาน Live/UAT.
- ไม่ได้เปลี่ยน Live Form/API/Report/SQL หรือข้อมูลผู้ป่วยใด ๆ.

## 3. Identity และ join ที่ห้ามสลับความหมาย

### 3.1 Visit / CPOE

| ความหมาย | Field / join |
|---|---|
| Visit record | `zdata_visit._id` = ObjectId ที่ EMR ส่งเป็น `visit_id` ให้ Process |
| VN ที่ LAB/RIS เก็บ | `zdata_visit.vn` |
| HN | `zdata_visit.pid.hn` |
| Parent CPOE Order | `zdata_cpoe_order._id` |
| CPOE Item | `zdata_cpoe_order_item._id` |
| Item → Parent Order | `zdata_cpoe_order_item.order_id.value` หรือ `xparentx` |
| Parent Order → Visit | `zdata_cpoe_order.vid.value` หรือ `xparentx` |

ข้อควรระวัง: `visit_id` ใน `zdata_lab_*` ปัจจุบันเป็น **VN string** ไม่ใช่ Visit ObjectId.
`zdata_xray_order.VisitNo` ก็เป็น VN. ต้อง resolve Visit ก่อน query เสมอ.

### 3.2 LAB canonical joins

```text
zdata_cpoe_order_item._id
  = zdata_lab_work_item._id                 (canonical single-item case)
  = zdata_lab_result_item.order_no          (result owner / ordered item identity)

zdata_lab_result_item.result_report_id
  หรือ zdata_lab_result_item.xparentx
  -> zdata_lab_report_manual_entry._id

zdata_lab_work_item.lab_no
  = zdata_lab_result_item.filler_order_no
  = Agent filler_order_no / LAB NO.
```

Batch เก่าบางชุดเก็บ Result ทุกตัวไว้ใต้ Work Item แรก จึงต้อง resolve เจ้าของผลจาก
`zdata_lab_work_item.selected_items` / `selected_items_json` และ mapping group-code →
result-component; ห้าม join ด้วย `result_item.order_no` เพียงอย่างเดียว.

### 3.3 X-Ray canonical joins

```text
Visit.vn
  -> zdata_xray_order.VisitNo

zdata_cpoe_order_item.accession_no
  = zdata_xray_order.AccessionNo
  = zdata_xray_result.AccessionNo

same-exam history
  = same HN + exact ExamUid + different AccessionNo
```

ห้าม match ประวัติด้วย `ExamName` เพราะชื่อเปลี่ยน/สะกดต่างกันได้.

## 4. LAB — ตาราง/collection และหน้าที่

| Layer | Form ID | Collection | หน้าที่ใน UI |
|---|---|---|---|
| Parent order | `6a6f5cd1265885c2377cc218` | `zdata_cpoe_order` | Order number, เวลา, clinic, ผู้สั่ง, comment, current status |
| Ordered item/profile | `6a6f7db2265885c2377cc222` | `zdata_cpoe_order_item` | รายการที่แพทย์สั่ง, profile identity, pending/completed, visibility |
| Item master | `6a594763d448dfc9d33e2c27` | `zdata_master_item_order` | ชื่อ master, profile parent, result code mapping, sensitive policy |
| LAB work item | `6a95c750422c1ca959829e8a` | `zdata_lab_work_item` | LAB NO., section, specimen, receive/result lifecycle |
| Technical receipt | `6a8b1c03f851000f28e501ef` | `zdata_lab_result_inbound` | inbound audit/idempotency; ไม่ใช่ clinical display row |
| Result report header | `6a8d4334f851000f28e5025b` | `zdata_lab_report_manual_entry` | stage/report metadata, order note, verifier, attachments |
| Clinical result item | `6a8bc91df851000f28e501fb` | `zdata_lab_result_item` | ค่าผลปัจจุบันต่อ observation/component |
| Revision log | `6abbabdcc54b3f93ce799576` | `zdata_lab_result_revision_log` | immutable whole-result revisions; ใช้ timeline/audit |

### 4.1 Parent Order และ CPOE Item fields ที่เกี่ยวกับผล

`zdata_cpoe_order`:

| Field | ใช้ทำอะไร |
|---|---|
| `_id`, `order_number` | identity และเลขใบสั่ง |
| `vid.value`, `vid.vn`, `vid.pid.hn` | Visit ObjectId, VN, HN snapshot |
| `service_type` | ต้องเป็น LAB สำหรับ branch นี้ |
| `order_comment` | comment ตอนสั่ง; เป็นคนละ field กับ result note |
| `order_clinic`, `cosign_user`, `created_at` | clinic, ผู้สั่ง, เวลาสั่ง |
| `current_status`, `status_stage[]` | lifecycle ของ parent order |
| `result_completed_at`, `result_completed_source`, `result_completed_by` | completion summary เมื่อมี |

`zdata_cpoe_order_item`:

| Field | ใช้ทำอะไร |
|---|---|
| `_id`, `order_id.value` | ordered item และ parent order |
| `item_data_id` | link ไป `zdata_master_item_order._id` |
| `item_code`, `item_name` | code/name ของรายการที่สั่ง |
| `pick_master.lab_parent` | snapshot parent profile เมื่อมี |
| `pick_master.lab_item` | snapshot LAB test mapping เมื่อมี |
| `current_status`, `status_stage[]` | pending/completed ของรายการที่สั่ง |
| `comment` | comment ระดับ ordered test; current EMR LAB API ยังไม่ส่งออก |
| `lab_data` | specimen source/collection metadata |
| `lab_no`, `received_at`, `received_by` | lifecycle snapshot ที่ Item เมื่อมี |
| `is_hide_result`, `result_visibility_*` | manual hide/audit; ต้อง fail closed |

`zdata_master_item_order` fields ที่กำหนด Profile/Result:

| Field | ความหมาย |
|---|---|
| `item_code`, `item_name` | master identity/display name |
| `service_type` | LAB/X-Ray/ชนิดอื่น |
| `section` | owning section/modality |
| `lab_parent` | parent profile code/object; ใช้สร้างหัว Profile |
| `lab_group` | grouping metadata; ไม่ใช่ result matching key โดยอัตโนมัติ |
| `lab_item.his_lab_code` | ordered/result group code ที่ API ใช้กับ component allowlist |
| `lab_item.name`, `short_name`, `seq`, `section`, `specimen` | display/sort/source metadata |
| `is_hide_result` | Sensitive result policy |

### 4.2 LAB Work Item fields

Field ใน live Form schema:

`source_order_id`, `source_order_number`, `source_specimen_record_id`, `lab_no`,
`section_code`, `section_name`, `work_status`, `patient_hn`, `patient_name`,
`ward_clinic`, `ordered_at`, `specimen_json`, `selected_items_json`,
`central_checked_at`, `central_checked_by`, `central_forwarded_at`,
`central_forwarded_by`, `received_at`, `received_by`, `processing_at`,
`processing_by`, `resulted_at`, `resulted_by`, `rejected_at`, `rejected_by`,
`reject_reason_code`, `reject_reason_detail`, `visit_id`, `rejection_record_id`,
`cancellation_record_id`, `cancel_type`, `cancel_reason`, `cancelled_at`,
`cancelled_by`, `latest_result_at`.

Field ที่พบใน live documents เพิ่มเติมและเกี่ยวข้องกับการ resolve ผล:

- `selected_items[]`: `seq`, `source_item_id`, `item_code`, `item_name`, `test_code`,
  `specimen_code`.
- `receipt_batch_id`, `batch_item_count` — batch ownership.
- `completed_at`, `completed_by`, `latest_result_at` — completion/result timing.
- `attempt_no`, `is_current_attempt`, retest/replacement fields — ต้องไม่เอา attempt เก่า
  มารวมเป็น current result.

### 4.3 LAB Result Report header fields

`zdata_lab_report_manual_entry` live schema มี:

| กลุ่ม | Fields |
|---|---|
| Identity | `order_no`, `filler_order_no`, `hn`, `visit_id`, `order_status_id`, `report_key`, `result_report_id` |
| Section | `lab_section`, `lab_section_name` |
| Version/stage | `result_uid`, `report_seq`, `stage`, `agent_overall_status`, `internal_overall_status`, `schema_version`, `record_kind`, `result_mode` |
| Timing | `received_at`, `reported_at`, `verified_at`, `processed_at`, `confirmed_at` |
| People | `reported_by_source_id`, `reported_by_source_name`, `verified_by_source_id`, `verified_by_source_name`, `confirmed_by` |
| Counts | `item_count`, `critical_count`, `matched_item_count`, `unmatched_item_count` |
| Result snapshot/audit | `items_json`, `raw_payload_json`, `payload_hash`, `receipt_status`, `source_channel`, `error_message` |
| Display content | `order_note`, `result_attachments[]` |

`order_note` คือหมายเหตุระดับผลทั้ง Order/Report จาก Agent/LIS. ใน current API ค่านี้
มี priority เหนือ `zdata_cpoe_order.order_comment` เมื่อมีค่า.

### 4.4 LAB Result Item fields

Field ใน live Form schema:

| กลุ่ม | Fields |
|---|---|
| Identity/join | `result_report_id`, `result_definition_id`, `order_no`, `filler_order_no`, `hn`, `visit_id`, `lab_section`, `parent_id.*` |
| Ordered/observation | `test_code`, `test_name`, `obs_code`, `obs_name`, `panel_code`, `panel_name`, `group_role`, `organism`, `result_sequence` |
| Clinical display | `result_value`, `unit_symbol_snapshot`, `units`, `reference_range_snapshot`, `ref_range`, `interpretation_code`, `is_critical` |
| Status/version | `result_source`, `result_status`, `result_uid`, `obx_status`, `change_kind`, `receipt_seq`, `result_version`, `previous_value` |
| Critical rule snapshots | `critical_low_rule`, `critical_high_rule` |
| Manual edit audit | `entered_by`, `entered_at`, `last_edited_by`, `last_edited_at`, `edit_history_json` |

Field ที่พบจริงใน live collection แต่ยัง **ไม่มีใน readable live Form schema**:

- `result_comment` — comment ระดับ Result Item/HL7 NTE; current API และ LAB PDF ใช้อยู่.
- Mycology/pathology fields: `actual_site_code`, `actual_site_name`,
  `actual_site_detail`, `ordered_site_code_snapshot`, `ordered_site_name_snapshot`,
  `pathology_row_key`, `pathology_sub_index`, `source_item_id`, `specimen_index`,
  `specimen_code_snapshot`, `specimen_name_snapshot`.
- `verified_at`, `verified_by`, `verified_by_source_id`, `verified_by_source_name`.

นี่เป็น schema drift: read path ทำงานได้จาก collection แต่ Form schema ไม่ประกาศ field.
ถ้าทีมจะ edit/export ผ่าน Form Factory ต้อง formalize schema ก่อน; งาน UI read-only สามารถอ่านได้
ผ่าน API เดิมโดยไม่แก้ live Form.

### 4.5 Technical Receipt และ Revision Log

Technical Receipt (`zdata_lab_result_inbound`) fields:

`receipt_status`, `source_channel`, `schema_version`, `received_at`, `order_no`,
`filler_order_no`, `hn`, `visit_id`, `result_uid`, `report_seq`, `stage`,
`agent_overall_status`, `internal_overall_status`, `reported_at`,
`reported_by_source_id`, `reported_by_source_name`, `verified_at`,
`verified_by_source_id`, `verified_by_source_name`, `item_count`, `critical_count`,
`matched_item_count`, `unmatched_item_count`, `items_json`, `result_report_id`,
`processed_at`, `payload_hash`, `error_message`, `raw_payload_json`, `record_kind`,
`report_key`, `order_status_id`, `lab_section`, `lab_section_name`, `order_note`.

Revision Log (`zdata_lab_result_revision_log`) fields:

`revision_id`, `order_no`, `filler_order_no`, `result_uid`, `report_seq`, `stage`,
`receipt_seq`, `source_reported_at`, `received_at`, `receipt_id`, `report_id`,
`previous_revision_id`, `items_snapshot_json`, `item_count`, `changed_item_count`,
`ingest_status`, `schema_version`, `payload_hash`, `order_note`.

สอง collection นี้ใช้ audit/timeline; ไม่ควรเป็นแหล่งค่าผลปัจจุบันหลัก. ค่าปัจจุบันอ่านจาก
`zdata_lab_result_item`; revision ใช้เมื่อผู้ใช้กดดูประวัติแก้ผล.

## 5. LAB — Profile, Test และ Result semantics

### 5.1 Profile grouping ที่ถูกต้อง

1. เริ่มจาก CPOE Item หนึ่งรายการ.
2. Resolve master ด้วย `item_data_id`; fallback `item_code` เฉพาะเมื่อไม่มี ID.
3. ถ้า master มี `lab_parent`, ใช้ parent master `item_name` เป็นชื่อ Profile และใช้
   `panel:<parentCode>` เป็น group identity.
4. ถ้าไม่มี `lab_parent`, CPOE Item นั้นเป็นหัว Test ของตัวเอง.
5. Result component ที่อยู่ใต้หัวนี้ต้อง resolve ด้วย ordered/result-code allowlist ใน
   `emr-lab-board-get.js` (`RESULT_COMPONENT_CODES_BY_GROUP`).
6. `panel_code` / `panel_name` จาก Agent เป็น display/audit metadata เท่านั้น;
   ห้ามใช้เป็น clinical parent หรือ matching key.

ตัวอย่างเชิงโครงสร้าง:

```text
Liver Function Test                         ← ordered profile
  Albumin            4.1 g/dL   N
  AST                45 U/L     H
  ALT                52 U/L     H
  Comment: ...
```

### 5.2 Critical, abnormal และ unknown

| Field | ความหมาย/UI |
|---|---|
| `is_critical: true` | Critical จริง; แสดง badge/alert ระดับ Order และ row |
| `is_critical: false` | ไม่ Critical; `interpretation_code` อาจยังเป็น H/L/abnormal ได้ |
| `is_critical: null/missing` | ไม่ทราบคำตัดสิน; ห้ามสรุปว่า non-critical หรือ derive จาก rule |
| `interpretation_code` | N/H/L/HH/LL/AA/NEG ฯลฯ ที่ต้นทางส่ง; ใช้แปลผล/สี abnormal แต่ไม่แทน explicit critical |
| `critical_low_rule`, `critical_high_rule` | snapshot กฎสำหรับ audit; ไม่ใช่คำตัดสินของผลครั้งนี้ |

ข้อขัดแย้งใน current UI: `ehLabFlagOf()` ยัง map `HH/LL/CC/CRIT` เป็น `C` แม้
`is_critical` ไม่ใช่ true. Redesign ต้องแก้ contract ให้ Critical ใช้ explicit Boolean เท่านั้น
และแยก “abnormal interpretation” ออกจาก “critical event”.

### 5.3 Comment ทั้งสามระดับ

| ระดับ | Field | ตัวอย่างการวาง UI |
|---|---|---|
| Order ตอนสั่ง | `zdata_cpoe_order.order_comment` | metadata รองใต้หัว Order |
| Result Report / Agent | `zdata_lab_report_manual_entry.order_note` | กล่อง “หมายเหตุผลตรวจ” เหนือ Profile; priority สูงกว่า order comment |
| Ordered test | `zdata_cpoe_order_item.comment` | ใต้หัว Test/Profile; current API ยังไม่ส่ง ต้องเพิ่มถ้าจะใช้ |
| Result item / NTE | `zdata_lab_result_item.result_comment` | ใต้ Result row นั้นโดยตรง; รองรับหลายบรรทัด |

ห้ามรวม comment ทุกระดับเป็นข้อความเดียว เพราะความหมายและเจ้าของข้อมูลต่างกัน.

### 5.4 Current live enum snapshot (ใช้เพื่อออกแบบ state ไม่ใช่ clinical policy)

- Result Item `result_status`: `final`, `entered`, `corrected`.
- Result Item `obx_status`: `F`, `P`, หรือไม่มีค่า.
- Result source: `agent`, `manual`.
- Report `stage`: `preliminary`, `partial`, `final`, `corrected`, หรือไม่มีค่า.
- Work status: `waiting_receive`, `received`, `resulted`, `completed`, `rejected`, `cancelled`.
- Sections ที่พบ: `BC`, `HM`, `HH`, `ML`, `IM`, `MI-OUT`, `MB`, `MY`, `BB`, `BG`.

อย่า hard-code enum เป็นชุดปิด; UI ต้องมี fallback แสดง raw value ที่ไม่รู้จัก.

## 6. LAB API ที่ EMR ใช้อยู่

| Process | ID | Owner | สถานะ |
|---|---|---|---|
| `emr-lab-board-get` | `6ab3be31cec3020e8562a2c9` | Nichada Patcharasumransuk | live, read-only response path |

Input หลัก: `{ visit_id }` โดย `visit_id` เป็น Visit ObjectId.

ไฟล์พร้อม Replace:
`Form-Builder/API/api-factory/processes/emr-lab-board-get-v2-REPLACE.js`.
ไฟล์นี้เป็น **full Process body** สำหรับวางแทน API ID เดิมแบบ additive; `v2-REPLACE`
คือเวอร์ชันของ package ไม่ใช่ Process ID ใหม่. ณ วันที่เอกสารนี้อัปเดต Live API ยังไม่ถูก Save.

Current `lab_orders[]` ส่งข้อมูลระดับ Order:

`order_id`, `source_order_id`, `order_no`, `section`, `section_code`,
`result_report_ids[]`, `lab_no`, `patient_hn`, `patient_name`, `order_comment`,
`specimen_name`, `specimen_names[]`, `ordered_items[]`, `status`, `scope`,
`ordered_at`, `resulted_at`, `received_at`, `collected_at`, `cancel_reason`,
`reported_at`, `reported_by_source_name`, `verified_at`,
`verified_by_source_name`, `attachments[]`, `items[]`.

Current `items[]` ส่ง:

`name`, `code`, `value`, `text`, `unit`, `ref`, `flag`, `critical`,
`result_item_id`, `result_report_id`, `result_comment`, `group_id`, `group_name`,
`result_source`, `result_status`, `reported_at`, `reported_by_source_name`,
`verified_at`, `verified_by_source_name`, `previous`, `previous_values[]`,
`visibility`; MY เพิ่ม pathology/site/specimen fields.

### 6.1 ช่องว่างของ Live และ contract ในไฟล์ Replace

Live payload ยังไม่มี report stage/sequence, OBX status, result version/correction และ
tri-state critical. ไฟล์ Replace ปิดช่องว่างดังกล่าวแบบ additive โดยไม่ลบ field เดิม:

```json
{
  "result_stage": "partial|final|corrected|",
  "report_seq": "2",
  "result_uid": "...",
  "agent_overall_status": "...",
  "internal_overall_status": "...",
  "item_count": 7,
  "critical_count": 1,
  "critical_summary": { "true": 1, "false": 5, "unknown": 1 },
  "critical_summary_complete": true,
  "revision_count": 2,
  "report": {
    "report_id": "...",
    "result_uid": "...",
    "report_seq": "2",
    "stage": "corrected",
    "agent_overall_status": "...",
    "internal_overall_status": "...",
    "receipt_status": "...",
    "source_channel": "...",
    "schema_version": "...",
    "record_kind": "...",
    "received_at": "...",
    "reported_at": "...",
    "reported_by_source_id": "...",
    "reported_by_source_name": "...",
    "verified_at": "...",
    "verified_by_source_id": "...",
    "verified_by_source_name": "...",
    "confirmed_at": "...",
    "confirmed_by": "...",
    "item_count": 7,
    "critical_count": 1,
    "matched_item_count": 7,
    "unmatched_item_count": 0
  },
  "report_history": [],
  "revision_history": [
    {
      "revision_id": "...",
      "previous_revision_id": "...",
      "result_uid": "...",
      "report_seq": "2",
      "receipt_seq": "2",
      "stage": "corrected",
      "source_reported_at": "...",
      "received_at": "...",
      "item_count": 7,
      "changed_item_count": 1,
      "ingest_status": "...",
      "schema_version": "..."
    }
  ],
  "correction_summary": {
    "has_correction": true,
    "revision_count": 2,
    "latest_revision_id": "...",
    "previous_revision_id": "...",
    "changed_item_count": 1
  },
  "cpoe_order_comment": "...",
  "result_order_note": "...",
  "report_order_notes": ["..."],
  "ordered_items": [{ "item_id": "...", "item_code": "...", "item_name": "...", "comment": "..." }],
  "items": [
    {
      "obs_code": "...",
      "obs_name": "...",
      "test_code": "...",
      "test_name": "...",
      "panel_code": "...",
      "panel_name": "...",
      "result_sequence": "1",
      "result_value": "...",
      "units": "...",
      "reference_range": "...",
      "interpretation_code": "H",
      "is_critical": null,
      "critical_state": "unknown",
      "critical_rule_snapshot": { "low": "...", "high": "..." },
      "result_status": "corrected",
      "obx_status": "C",
      "result_version": "2",
      "change_kind": "corrected",
      "receipt_seq": "2",
      "result_uid": "...",
      "previous_value": "...",
      "ordered_item_id": "...",
      "ordered_item_code": "...",
      "ordered_item_name": "...",
      "ordered_item_comment": "...",
      "result_comment": "...",
      "correction": {
        "is_corrected": true,
        "change_kind": "corrected",
        "result_version": "2",
        "receipt_seq": "2",
        "previous_value": "...",
        "last_edited_at": "...",
        "last_edited_by": "..."
      }
    }
  ]
}
```

ไฟล์ Replace คง `items[] + group_id/group_name` เพื่อ backward compatibility และเพิ่ม
ordered/profile identity แทนการสร้าง `profiles[]` ใหม่. `critical` แบบ Boolean เดิมยังอยู่เพื่อไม่ให้
consumer เดิมพัง แต่ UI ใหม่ต้องใช้ `is_critical` หรือ `critical_state`; ค่าไม่ทราบต้องเป็น `null` /
`unknown`. `critical_low_rule`/`critical_high_rule` ถูกส่งใน `critical_rule_snapshot` เพื่อ audit เท่านั้น
ห้ามใช้คำนวณ Critical. Raw LIS payload, payload hash และ revision item snapshot ไม่ถูกส่งออก.

Comment แยก 4 ระดับแล้ว: `cpoe_order_comment`, `result_order_note`,
`ordered_items[].comment`/`items[].ordered_item_comment`, และ `items[].result_comment`.
คีย์ `order_comment` เดิมยังคงพฤติกรรม compatibility เดิม.

## 7. X-Ray — ตาราง/collection และ fields

| Layer | Form ID | Collection | หน้าที่ |
|---|---|---|---|
| Parent order | `6a6f5cd1265885c2377cc218` | `zdata_cpoe_order` | Order/VN/ผู้สั่ง/เวลา/สถานะ |
| CPOE item | `6a6f7db2265885c2377cc222` | `zdata_cpoe_order_item` | Exam ที่สั่ง, Accession No., work status |
| Item master | `6a594763d448dfc9d33e2c27` | `zdata_master_item_order` | section/modality/exam mapping |
| RIS order snapshot | `6a8f1ea97632d182ef6914fd` | `zdata_xray_order` | Request/Accession/Exam/modality/order metadata |
| RIS result | `6aa180f009c1bad08952da58` | `zdata_xray_result` | ผลอ่านและ result metadata |

### 7.1 CPOE Item fields ที่ X-Ray UI ใช้

`_id`, `order_id.value`, `item_data_id`, `item_code`, `item_name`,
`current_status`, `status_stage[]`, `accession_no`, `accession_generated_at`,
`dispatched_at`, `radiographer`, `radiographer_at`, `radiologist`,
`radiologist_at`, `result_completed_at`, `result_completed_by`,
`result_completed_source`, rejection/cancellation fields และ `comment`.

### 7.2 RIS Order fields

Result/history UI ไม่ต้องแสดง PII snapshot ทั้งหมด แต่ source Form มี field ดังนี้:

- Identity: `MessageControlId`, `Hn`, `VisitNo`, `RequestNo`, `QNo`, `AccessionNo`.
- Exam: `ExamUid`, `ExamName`, `ExamTypeUid`, `ExamTypeText`, `Qty`, `ExamRate`,
  `OrderDtlRate`.
- Modality/room: `ModalityUid`, `ModalityName`, `ModalityTypeUid`,
  `ModalityTypeName`, `OrganizationUid`, `OrganizationName`, `OrganizationAlias`.
- Status/context: `Status`, `Priority`, `ClinicalInstruction`, `ScheduleUid`,
  `ImageCapturedDateTime`, `IsDeleted`.
- Referrer: `ReferenceUnitUid`, `ReferenceUnitName`, `ReferringDoctorUid` และ
  `ReferringDoctor*Name/Title` ไทย/อังกฤษ.
- Assigned radiologist snapshot: `RadiologistUid` และ `Radiologist*Name/Title`
  ไทย/อังกฤษ.
- Patient snapshot: `PatientTitle/FName/MName/LName`, English name fields,
  `PatientGender`, `PatientDob`, `PatientSsn`, phone/email/address, `PatientLmp`,
  `PatientClassUid`, `AdmissionNo`, `PatientStatus*`, `InsuranceType*`.

หน้า EMR History ต้องใช้ patient identity จาก Visit/EMR context ไม่ควร render PII snapshot
ซ้ำโดยไม่จำเป็น.

### 7.3 RIS Result fields — ครบทุก field ของ live Form

| Field | ใช้ใน UI/ความหมาย |
|---|---|
| `MessageControlId` | technical message identity; audit only |
| `Hn` | patient scope defense-in-depth |
| `RequestNo` | RIS request/order reference |
| `QNo` | queue reference เมื่อมี |
| `AccessionNo` | primary join ไป Order/Image/PDF |
| `Status` | result status raw; live พบ `F` และ `C` |
| `ExamUid` | exact exam identity; ใช้ same-exam history |
| `ExamName` | display name |
| `ImageCapturedDateTime` | เวลาได้ภาพ |
| `RadiologistUid` | reporter identifier; ยังไม่ใช่ชื่ออ่านง่าย |
| `ResultText` | รายงานผลอ่านฉบับเต็ม; source หลักของ content |
| `ResultDateTime` | เวลาออก/แก้ผล |
| `SeverityUid` | raw severity; mapping clinical meaning ยังไม่ยืนยัน |
| `SentDateTime` | เวลาต้นทางส่ง |
| `ReceivedDateTime` | เวลา HIS รับ |

System fields ที่พบจริง: `_id`, `created_at/by`, `updated_at/by`, `xrstatx` และ
initCraft metadata. ไม่ใช่ clinical display fields.

### 7.4 X-Ray status/severity boundary

- Live Result `Status`: `F` และ `C`; current API ถือ `F/FINAL` เป็น Final และถือ
  non-`P` ที่มี `ResultText` เป็น final-like. UI ควรแสดง `C` เป็น “Corrected” เมื่อ RIS
  ยืนยัน mapping นี้ แทนการเปลี่ยนเป็นคำว่า Final อย่างเดียว.
- Live `SeverityUid` ที่พบ: `NORMAL`, ว่าง หรือ null. ยังไม่มีค่า critical ที่พิสูจน์แล้ว.
- ไม่มี field แยก Findings / Impression / Result comment ใน live schema;
  ปัจจุบันมีเพียง `ResultText`. ห้าม parse narrative เพื่อสร้าง Impression เอง.
- ไม่มี human-readable radiologist name ใน Result row. `RadiologistUid` ต้อง map ผ่าน
  master/user contract ที่ยืนยันก่อนจะแสดงชื่อ/ลายเซ็น; report ปัจจุบันยัง fallback เป็น UID.

## 8. X-Ray API ที่ EMR ใช้อยู่

| Process | ID | Owner | สถานะ |
|---|---|---|---|
| `emr-xray-history-get` | `6ad58d76481c196fbb339ae8` | Nichada Patcharasumransuk | live, read-only |

Input: `{ visit_id }` = Visit ObjectId.

Output hierarchy:

```text
orders[]
  order_id, order_number, ordered_at, ordered_by, order_status,
  item_count, is_final
  rooms[]
    room_code, room_name, modality, modality_label, item_count
    items[]
      item_id, item_code, item_name,
      exam_code, exam_name, accession_no, current_status,
      result_id, result_form_id, result_status, result_text, resulted_at,
      radiologist_uid, severity_uid, image_captured_at, is_final,
      history_count, same_exam_history[]
```

`same_exam_history[]` คืนล่าสุดไม่เกิน 10 รายการ โดย exact HN + exact `ExamUid`,
ตัด current Accession No. ออก และต้องมี `ResultText`.

ช่องว่างของ current payload:

- ไม่ส่ง `RequestNo`, `QNo`, `SentDateTime`, `ReceivedDateTime`.
- ไม่ส่ง `ClinicalInstruction`, referrer/clinic และ readable radiologist name.
- ไม่แยก `corrected` จาก `final` เป็น UI contract ที่ยืนยันแล้ว.
- ไม่มี severity dictionary/critical contract.

`PROPOSED` additive fields:

`request_no`, `queue_no`, `sent_at`, `received_at`, `clinical_instruction`,
`referring_unit`, `referring_doctor`, `result_stage`, `is_corrected`,
`radiologist_display`, `severity_code`, `severity_label` (เมื่อ RIS ยืนยัน mapping เท่านั้น).

## 9. Report / PDF matrix — อันไหนใช้ตัวไหน

### 9.1 Report ที่ current EMR History v4 เรียกอยู่

| Use | Report ID / name | SQL ID / name | Param | Source |
|---|---|---|---|---|
| LAB ทั่วไป 1 Result Report | `6aa8f5a8b92813319a86ea11` · `Lab result` | `6ab0a1c4d0c3ef2e97911e55` · `lab_result_slip` | `xparentx = zdata_lab_report_manual_entry._id`; sensitive เพิ่ม `grant_token` ที่ provider gate | Result Report + Result Item |
| LAB Microbiology/MB 1 Result Report | `6ab1c2d3e4f5061728394a5b` · `Lab result - microbiology` | `6ac2f1a0d0c3ef2e97912a01` · `lab_micro_slip` | `xparentx = Result Report ID` | Result Report + narrative Result Item |
| X-Ray 1 reading | `6ab2d3e4f5061728394a5b6c` · `Xray result` | `6ab2d3e4f5061728394a5b6d` · `xray_result_slip` | `dataid = zdata_xray_result._id` | X-Ray Result + Order lookup |

ข้อจำกัด current EMR:

- LAB แสดง PDF เฉพาะเมื่อ Order resolve ได้ Result Report ID เดียว; หลาย Report IDs จะไม่เดาเลือก.
- MB ใช้ report แยกเพราะ `ResultText` เป็น narrative/culture body.
- X-Ray PDF ใช้ Result record ID ไม่ใช่ Accession No.
- `ดูภาพ` ใช้ Accession No. เป็นหลัก และ HN เป็น fallback ตาม RIS viewer contract.

### 9.2 Report ระดับทั้ง Visit ที่มีอยู่แล้ว แต่ v4 ยังไม่ได้เรียก

| Use | Report ID / name | SQL ID / name | Param | หมายเหตุ |
|---|---|---|---|---|
| LAB ทุกห้องของ Visit | `6adb696c41ac687aac3f3cc2` · `Lab result - visit` | `6adb696c41ac687aac3f3cc0` · `lab_result_visit` | `vn` | redacts sensitive rows; available live 2026-10-23 |
| X-Ray หลายผลอ่าน | `6adb696c41ac687aac3f3cc3` · `Xray result - visit` | `6adb696c41ac687aac3f3cc1` · `xray_result_visit` | `ids` = comma-separated X-Ray Result IDs | available live 2026-10-23 |

ถ้า redesign ต้องการปุ่ม “PDF ทั้ง Visit” ให้ใช้สอง report นี้โดยส่ง parameter ตาม contract;
อย่าเปลี่ยนปุ่ม PDF ต่อ Order เดิมโดยไม่ตัดสิน UX ชัดเจน.

### 9.3 Output fields ของ report providers

`lab_result_slip` / `lab_result_visit` ส่งให้ Report:

`hn`, `patient_name`, `age`, `sex`, `ward`, `lno`, `specimen`, `collected`,
`received`, `reported`, `reported_by`, `approved_by`, `lab_section_name`,
`lab_section_no`, `lab_section_name_th`, `lab_section_line`, `section_detail`,
`printed`, `order_date`, `approve_date`, `reported_lic`, `approve_lic`, `dob`,
`clinic`, `test_name`, `result_value`, `unit`, `result_unit`, `interpretation`,
`ref_range`, `comment_row`, `sensitive_redacted`, `site`, layout helper fields และ
`order_note_block`; visit version เพิ่ม section-first marker/VN.

`lab_micro_slip` ส่ง:

`hn`, `patient_name`, `age`, `sex`, `ward`, `lno`, `specimen`, `collected`,
`received`, `reported`, `reported_by`, `approved_by`, `printed`,
`lab_section_name`, `section_detail`, `culture_rows`, `abx_html`, `lab_no`,
`page_no`, `mlab_version`.

`xray_result_slip` / `xray_result_visit` ส่ง:

`hn`, `patient_name`, `gender`, `age`, `exam_date`, `exam_time`, `ref_doc`,
`reporter_name`, `exam_name`, `xn`, `an`, `ref_dept`, `result_text`.

## 10. UI information architecture ที่แนะนำ

### 10.1 LAB card

Order header:

- วันที่/เวลาออกผลเป็น primary; เวลาสั่งเป็น secondary.
- Section + LAB NO. + result stage (`Partial`, `Final`, `Corrected`).
- Critical summary แบบข้อความ เช่น `Critical 1 · Abnormal 2 · Pending 1`.
- `order_note` เป็นกล่องแยกเมื่อมี.

Profile/Test body:

- Profile header: ordered name/code + status + pending count.
- Result rows: `ชื่อ/รหัส | ผล | หน่วย | Ref. Range | แปลผล`.
- Critical badge ต้องอยู่ทั้งที่ Result row และสรุประดับ Order.
- `result_comment` อยู่ใต้ Result row; test/order comment อยู่คนละ block.
- Narrative result (MB/MLab) ใช้ 2 คอลัมน์/เต็มความกว้างและรักษา line breaks.
- Partial แสดง placeholder `รอผล` เฉพาะ ordered component ที่พิสูจน์ mapping ได้;
  ห้ามสร้าง component ที่ไม่มีใน contract.
- Corrected แสดง badge และ action “ดูประวัติการแก้ไข”; ไม่แสดงค่าก่อนหน้าแทนค่าปัจจุบัน.

Progressive disclosure:

- Default card สรุปเฉพาะ abnormal/critical + จำนวน normal.
- `ดูผลทั้งหมด` เปิด shared LAB popup ที่มีทุก Profile/Result/Comment/previous values.
- `ผลก่อนหน้า` คือ earlier encounter same observation; ไม่ใช่ correction history.
- `ประวัติแก้ผล` อ่าน Revision/Edit Log แยกจาก previous encounter.

### 10.2 X-Ray card

Order header:

- Order number, ordered time, ordered by, result state.
- ไม่ต้องซ้ำ room/type label หากไม่มี value เพิ่มเติมต่อการตัดสินใจ.

Exam row:

- Exam name/code, Accession No., image captured time, result time.
- Status text: Preliminary/Final/Corrected เมื่อ mapping ยืนยัน; fallback raw code.
- Reading preview 2–4 บรรทัด; action `ดูผลอ่าน`, `ดูภาพ`, `PDF`.
- Result popup แสดง raw `ResultText` ครบ ไม่ parse เป็น Findings/Impression.
- Same-exam history อยู่ใน popup เดียวกันและเลือก 1/5/10 ได้.
- ถ้าไม่มี result record ให้ไม่แสดงใน History result tab; งานค้างอยู่ใน current-visit
  tracking surface ไม่ใช่ผลย้อนหลัง.

## 11. Empty/loading/error/security states

| State | ข้อความ/พฤติกรรม |
|---|---|
| Loading | skeleton ต่อ tab; ห้ามโชว์ข้อมูล Visit ก่อนหน้าค้างอยู่ |
| No result | `ยังไม่มีผล LAB` / `ยังไม่มีผล X-Ray` |
| Partial LAB | แสดงผลที่มี + `รอผล N รายการ` |
| Sensitive locked | แสดงชื่อรายการที่อนุญาต + `ต้องยืนยันตัวตนเพื่อดูผล`; ไม่ส่งค่า/comment/previous |
| Manually hidden | `ปกปิดผลโดยห้องปฏิบัติการ` ตามตำแหน่งเดิม; ไม่เผยค่า |
| Unknown critical | `ยังไม่ได้รับสถานะ Critical` ถ้าจำเป็นต้องสื่อ; ห้ามใช้เขียวว่า “ปกติ” |
| Multiple LAB report IDs | ปิด PDF ต่อ Order พร้อมข้อความว่าไม่เลือกบางชุดให้อัตโนมัติ |
| API error | แสดง error ต่อ tab และปุ่ม reload; SOAP/ยา/ส่วนอื่นต้องไม่ล้มตาม |

## 12. Acceptance criteria สำหรับทีมออกแบบ/พัฒนา

### Data correctness

- [ ] Query เริ่มจาก server-resolved Visit; client ห้ามส่ง HN/VN มาเป็น authority.
- [ ] LAB แสดงเฉพาะ Order ที่มี result/protected-result; ไม่มีการ์ด sent/cancelled ที่ไม่มีผล.
- [ ] Profile หนึ่งรายการรวม Result components ถูกชุดและคง `result_sequence`.
- [ ] Partial แสดง available + pending โดยไม่ปิด Parent ก่อน sibling completed.
- [ ] Final/Corrected ไม่ทับ revision/audit trail.
- [ ] Critical ใช้ explicit `is_critical`; null เป็น unknown.
- [ ] `order_comment`, `order_note`, item `comment`, `result_comment` ไม่ถูกรวมผิดระดับ.
- [ ] Frontend ใช้ `result_stage`/`report_seq` ระดับ Report และ `obx_status` ระดับ Result Item;
      ห้ามใช้แทนกัน.
- [ ] Corrected แสดงจาก `result_version`/`change_kind` และเปิด revision timeline จาก
      `revision_history`; ห้ามอ่าน raw payload หรือ snapshot มา render.
- [ ] X-Ray join result ด้วย Accession No.; history ใช้ exact HN + ExamUid.
- [ ] X-Ray ไม่ infer critical/severity หรือ Impression จาก narrative.

### UI/EMR v2

- [ ] ใช้ Element Plus vocabulary และ visual hierarchy ของ EMR v2.
- [ ] ทุก status มี text; สีเป็นเพียง reinforcement.
- [ ] รองรับ empty/loading/error/partial/final/corrected/locked/hidden states.
- [ ] ไม่มี horizontal scrollbar ใน EMR card; popup ตารางกว้างอาจ scroll เฉพาะภายใน.
- [ ] current visit กับ historical result แยก scope ชัดเจน.
- [ ] keyboard focus, `aria-expanded`, dialog title/close และ readable contrast ผ่าน QA.

### Regression/security

- [ ] Re-auth/access log/PDF sensitive gate เดิมยังผ่าน.
- [ ] No-result filtering ไม่ลบ protected placeholder ที่มีผลจริง.
- [ ] `ดูภาพ` ยังใช้ Accession No.; PDF ยังใช้ Result ID/Result Report ID ตามชนิด.
- [ ] Medicine/SOAP/finance/navigation/current order flows ไม่เปลี่ยน.
- [ ] ไม่มี PHI อยู่ใน mockup, fixture, screenshot หรือเอกสารส่งทีม.

## 13. Ownership และ delivery boundary

- EMR History Form `6a96557e422c1ca959829eae` owner: `QSNICH Admin` — read-only สำหรับ Codex;
  เอกสารนี้ไม่อนุญาตให้ Save/Publish live Form.
- `emr-lab-board-get` และ `emr-xray-history-get` owner เป็นผู้ใช้ แต่การแก้ live API
  ยังต้องถาม delivery mode สำหรับ artifact/action นั้นก่อนทุกครั้ง.
- X-Ray Order/Result Forms owner: `theerawat sangyoka` — read-only.
- LAB result/work forms ส่วนใหญ่ owner เป็นผู้ใช้; Report/SQL บางตัว owner เป็น
  `Parinya Tumchay` หรือ `SuperAdmin InitAPI`. ให้ตรวจ owner ราย artifact ก่อนเปลี่ยน.
- Recommended delivery: ทีมออกแบบจาก handoff นี้ก่อน; จากนั้นทำ local API/UI replacement
  แบบ additive และให้ owner ที่ได้รับอนุญาตนำไป UAT/Publish.

## 14. Decisions / open decisions

1. **ตัดสินใจแล้ว 2026-10-24:** ใช้ full replacement แบบ additive กับ
   `emr-lab-board-get` ID เดิม. Package คือ `emr-lab-board-get-v2-REPLACE.js`; ยังไม่ลง Live.
2. RIS ยืนยัน mapping ของ X-Ray `Status` (`F`, `C`, `P`, อื่น ๆ) และ `SeverityUid` อย่างไร.
3. แหล่ง human-readable radiologist name/signature คือ collection/master ใด.
4. ต้องแสดง `ClinicalInstruction` และ CPOE Item `comment` ใน History หรือเฉพาะ popup.
5. ปุ่ม PDF หลักจะเป็นต่อ Order เดิม, ทั้ง Visit, หรือมีทั้งสองแบบ.
6. Schema drift ของ `result_comment`/MY fields จะ formalize ใน Form schema เมื่อใด.
7. Critical null จะใช้ข้อความใดใน UI และต้องแจ้ง integration-monitoring หรือไม่.

## 15. ไฟล์อ้างอิงสำหรับทีมพัฒนา

- `Form-Builder/API/api-factory/processes/emr-lab-board-get-v2-REPLACE.js` — full Process body
  ที่พร้อมวางแทน API ID เดิม; static regression ผ่าน แต่ยังต้อง UAT.
- `Form-Builder/API/api-factory/processes/emr-lab-board-get.js`
- `Form-Builder/API/api-factory/processes/emr-xray-history-get-v2-REPLACE.js`
- `02-his/form-factory/emr-history-onCreated-FULL-v4-REPLACE.txt`
- `02-his/form-factory/emr-history-template-FULL-v4-REPLACE.txt`
- `design/lab-result-canonical-contract.md`
- `02-his/handoff/emr-history-lab-result-cards-v2-import.md`
- `02-his/handoff/emr-xray-result-history-v1-import.md`
- `02-his/handoff/lab-result-pdf-profile-group-v4/`

ภาพอ้างอิงจากผู้ใช้ใช้เพื่อวิเคราะห์ gap เท่านั้นและไม่ได้คัดลอกเข้า repository เพื่อหลีกเลี่ยง
การเก็บข้อมูลทางคลินิก/ข้อมูลระบุตัวตนโดยไม่จำเป็น.
