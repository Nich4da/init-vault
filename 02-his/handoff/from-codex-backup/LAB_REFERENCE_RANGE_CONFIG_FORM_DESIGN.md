# Lab Reference Range Configuration — Form Design

อัปเดต: 2026-08-26 (Asia/Bangkok)

สถานะ: แบบออกแบบเท่านั้น ยังไม่ได้สร้าง SDForm JSON หรือทดสอบใน Builder/runtime

> **Superseded 2026-08-26:** ผู้ใช้เลือกโครง **ฟอร์มเดียว 3 Tabs แบบ CPOE** แล้ว
> ไฟล์ที่ใช้ต่อคือ `Lab_Reference_Range_Config_OneForm_Tabs_v1.json` และ
> `Lab_Reference_Range_Config_SETUP.md`; แนวคิด 2 ฟอร์มด้านล่างเก็บไว้เป็นประวัติเท่านั้น

## 1. Scope และหลักการ

- ชุดข้อมูลปัจจุบันเป็น reference range ของห้อง `Biochemistry` (`BC`)
- โครงสร้างต้องรองรับ Lab อื่นในอนาคต โดยไม่ hard-code ว่าทุก rule เป็น Biochemistry
- หนึ่ง test มีได้หลาย rule ตามเพศ อายุ method และ `rangeType`
- Normal, Critical และ Custom ต้องเก็บแยก rule; ห้ามรวมเป็นข้อความเดียว
- ไม่แก้ Lab Workbench / Result Viewer UI ที่ถูกพักไว้

ข้อมูลต้นทางมี 602 `NormalNumeric`, 51 `CriticalNumeric` และ 6 `CustomNumeric`
ดังนั้นถึงชุดข้อมูลนี้ใช้เป็น reference ของ Biochemistry ก็ห้ามจัดทุกแถวเป็น “ค่าปกติ”
โดยไม่อ่าน `rangeType`

## 2. Data model ที่แนะนำ

```text
Section Master ── 1:N ── Lab_Reference_Range_Set
                              │ 1
                              │
                              │ N
Lab Test / Result Test ── 1:N ── Lab_Reference_Range_Rule
                                  │
                                  └── N:1 ── Lab_Unit_Master

CPOE Lab Item ──► Lab_Result_Definition_Master ──► Lab Test / Result Test
```

Reference range ควรผูกกับ “รายการผลตรวจ” (Lab Test / Result Test) เพราะหนึ่ง CPOE item
อาจแตกเป็นหลายรายการผลได้ ไม่ควรผูก range กับ CPOE order item โดยตรงเพียงตัวเดียว

### 2.1 `Lab_Reference_Range_Set`

เก็บ metadata ของข้อมูลหนึ่งชุด เช่น ชุด Biochemistry จากไฟล์วันที่ 13 July 2026

| Field name | Widget | Required | หมายเหตุ |
|---|---|---:|---|
| `set_code` | Text Input | yes | รหัสชุดข้อมูลที่ไม่ซ้ำ |
| `set_name` | Text Input | yes | ชื่อชุดข้อมูล |
| `section` | Select By Form | yes | อ้าง Section Master Form ID `6a58f4dfd448dfc9d33e2bf2` |
| `section_code_snapshot` | Text Input, readonly | yes | เช่น `BC`; snapshot สำหรับ query |
| `section_name_snapshot` | Text Input, readonly | yes | เช่น `Biochemistry` |
| `source_document_name` | Text Input | no | ชื่อไฟล์/เอกสารต้นทาง |
| `version_no` | Number Input | yes | revision ของทั้งชุด |
| `effective_from` | Date Time | no | วันที่เริ่มใช้ |
| `effective_to` | Date Time | no | วันที่สิ้นสุด |
| `set_status` | Select Input | yes | `draft`, `active`, `retired` |
| `change_reason` | Textarea | conditional | บังคับเมื่อแก้ชุดที่เคย active |
| `is_active` | Switch | yes | ใช้ค้นชุดที่เปิดใช้งาน |

ไม่ควรใส่ 659 rules เป็น Sub Form ใน record เดียว เพราะแก้ไขยาก เสี่ยงบันทึกทับทั้งก้อน
และตรวจ duplicate/audit ราย rule ได้ไม่ดี

### 2.2 `Lab_Reference_Range_Rule`

หนึ่ง record ต่อหนึ่งแถวเชิงกฎจาก Excel โดย Join Parent Form กับ
`Lab_Reference_Range_Set`

#### A. Test และที่มา

| Field name | Widget | Required | หมายเหตุ |
|---|---|---:|---|
| `reference_set_id` / parent | Parent relation | yes | ชุด reference range |
| `section` | Select By Form | yes | ใช้ Section Master เดียวกับ CPOE; inherit/lock จาก Set เมื่อเปิดผ่าน parent |
| `result_test_id` | Select By Form | yes | อ้าง Lab Test Form ID `6a597647d448dfc9d33e2d39` และกรองตาม Section |
| `result_definition_id` | Select By Form | no | mapping เสริมไป `Lab_Result_Definition_Master`; ไม่ใช่เจ้าของ range หลัก |
| `source_test_code` | Text Input, readonly | yes | snapshot `code` จาก `result_test_id`/ต้นฉบับ |
| `source_test_reference` | Text Input, readonly | yes | snapshot reference/name จากต้นฉบับ |
| `priority` | Number Input | yes | ลำดับจากต้นฉบับ; ไม่ใช่ unique key |
| `method_code` | Select/Text | no | เว้นได้สำหรับไฟล์ปัจจุบันที่ไม่มี method |
| `source_sheet` | Text Input, readonly | no | trace กลับต้นฉบับ |
| `source_row_no` | Number Input, readonly | no | trace กลับแถวต้นฉบับ |

ห้ามถือว่า `source_test_code`, `source_test_reference`, CPOE item id และ LIS `obs_code`
เป็น identifier เดียวกันจนกว่าจะมี mapping ที่ยืนยันแล้ว

### 2.3 Select By Form linkage ที่ยืนยันจาก `refrange-.json`

ไฟล์ `/Users/nichada/Documents/refrange-.json` เป็น form config ของ CPOE/Lab item และให้
รูปแบบเชื่อมที่นำมาใช้กับ Reference Range ได้ดังนี้:

#### Section

```text
component    = select-form-input
formId       = 6a58f4dfd448dfc9d33e2bf2
valueField   = _id
labelField   = [name]
searchField  = [code, name]
refField     = [modality_type, name, st_id.label, st_id.value, code]
where        = `enable` = true
valueObjectId = true
```

ค่า Section จึงเป็น Select By Form object และมีทั้ง ObjectId กับ `code` ที่ใช้กรองรายการ Lab

#### Lab Test / Result Test

```text
component    = select-form-input
formId       = 6a597647d448dfc9d33e2d39
valueField   = code
labelField   = [code, name, flag]
searchField  = [code, name]
refField     = [code, name, short_name, flag, is_show_chart, section, specimen, seq]
where        = `code` IS NOT NULL :xqLabSection
```

เมื่อเลือก Section ให้สร้าง filter จาก `section.code` แล้ว reload/clear cache ของ
`result_test_id` เพื่อไม่ให้เห็น Lab Test ของ Section เก่าค้างอยู่

ห้ามคัดลอก `section.onChange` จากไฟล์เดิมไปใช้ตรง ๆ เพราะ script เดิมชี้ไปที่
`sub_order` และ Sub Form `lab_item`; ฟอร์มใหม่นี้ต้องชี้ไปที่ `result_test_id`

#### B. กลุ่มผู้ป่วยและช่วงอายุ

| Field name | Widget | Required | Dropdown values/behavior |
|---|---|---:|---|
| `physiological_type` | Select Input | yes | `ALL`, `M`, `F` |
| `all_ages` | Switch | yes | ถ้าเปิด ให้ซ่อน age boundary ทั้งหมด |
| `initial_age` | Number Input | conditional | ต้องไม่ติดลบ |
| `initial_age_unit` | Select Input | conditional | `DAYS`, `WEEKS`, `MONTHS`, `YEARS` |
| `final_age` | Number Input | conditional | ต้องไม่ติดลบ |
| `final_age_unit` | Select Input | conditional | `DAYS`, `WEEKS`, `MONTHS`, `YEARS` |

ไม่ควรแปลง MONTHS/YEARS เป็นจำนวนวันแบบเดา ๆ ในฟอร์ม การ match อายุ runtime ควรใช้
วันเกิด + calendar unit หลังยืนยันนโยบายเรื่อง boundary แล้ว

#### C. นิยามกฎ

| Field name | Widget | Required | Dropdown values/behavior |
|---|---|---:|---|
| `range_value_type` | Select Input | yes | เริ่มต้น `number`; รองรับ `text`, `select`, `date` ในอนาคต |
| `range_type` | Select Input | yes | `NormalNumeric`, `CriticalNumeric`, `CustomNumeric` จากไฟล์ปัจจุบัน |
| `numeric_range_operator` | Select Input | yes | `Inclusive limits`, `Exclusive limits`, `<`, `>`, `<=`, `>=` |
| `first_value` | Dynamic Input | yes | `number` สำหรับ Biochemistry; เปลี่ยนตาม `range_value_type` |
| `second_value` | Dynamic Input | conditional | แสดงเมื่อ operator ต้องใช้สองค่า |
| `range_unit_id` | Select By Form | conditional | อ้าง `Lab_Unit_Master` |
| `range_unit_snapshot` | Text Input, readonly | conditional | เก็บ symbol ตอน rule ถูก activate |
| `alpha_numeric_operator` | Select Input | future | ซ่อนสำหรับ numeric rule ปัจจุบัน |
| `allowed_values` | Tags/Textarea | future | ใช้กับ qualitative/text rule ใน Lab อื่น |
| `min_result_status_id` | Select/Text | conditional | แสดงเฉพาะ Custom/Advanced; ไฟล์มี `VRH` 6 แถว |
| `max_result_status_id` | Select/Text | conditional | แสดงเฉพาะ Custom/Advanced |
| `rule_preview` | Text Input, readonly | yes | แปลกฎเป็นภาษาคนก่อนบันทึก |

`first_value` และ `second_value` ใช้ Dynamic Input ตามความต้องการ แต่การสร้าง SDForm JSON
ต้องมี export ของ `dynamic-input` จาก Builder เป็นแม่แบบก่อน เพราะใน workspace ยังไม่มี
golden widget object ของ component นี้

#### D. Version และสถานะ

| Field name | Widget | Required | หมายเหตุ |
|---|---|---:|---|
| `rule_uid` | Auto Number/Text readonly | yes | stable identity ของ rule |
| `revision_no` | Number Input | yes | เริ่ม 1 และเพิ่มเมื่อแก้ rule ที่ใช้งานแล้ว |
| `effective_from` | Date Time | no | เริ่มใช้ rule |
| `effective_to` | Date Time | no | สิ้นสุด rule |
| `rule_status` | Select Input | yes | `draft`, `active`, `retired` |
| `change_reason` | Textarea | conditional | บังคับเมื่อแก้/retire rule ที่ active |
| `is_active` | Switch | yes | สำหรับ query rule ปัจจุบัน |

ใช้ audit fields ของระบบ (`created_at`, `created_by`, `updated_at`, `updated_by`) ร่วมด้วย
และไม่เขียนทับ revision ที่เคยใช้กับผลตรวจเก่าโดยไม่มีประวัติ

## 3. Layout ของ Rule Editor

ใช้ `card`/`grid` จากฟอร์มแม่แบบที่ Builder export แล้ว:

```text
Card 1 — ชุดข้อมูลและรายการตรวจ
  [Reference Set] [Section — Select By Form]
  [Result Test — Select By Form filtered by Section]
  [Test Code] [Test Reference] [Priority]

Card 2 — เงื่อนไขผู้ป่วย
  [Physiological Type] [All ages]
  [Initial age] [Unit] [Final age] [Unit]

Card 3 — กฎ Reference Range
  [Value type] [Range type] [Numeric operator]
  [First value] [Second value] [Range unit]
  [Rule preview — readonly เต็มแถว]

Card 4 — การใช้งานและประวัติ
  [Revision] [Effective from] [Effective to] [Status]
  [Change reason]
```

## 4. Dynamic behavior

### 4.1 Operator → จำนวน value inputs

| Operator | First value | Second value |
|---|---|---|
| `Inclusive limits` | show + required | show + required |
| `Exclusive limits` | show + required | show + required |
| `<`, `>`, `<=`, `>=` | show + required | hide + clear value |

เมื่อเปลี่ยนจาก two-value เป็น one-value ต้อง clear `second_value` เพื่อไม่ให้ค่าค้างถูกบันทึก

### 4.2 Value type → Dynamic Input

| `range_value_type` | Dynamic input type | ตัวอย่างการใช้ |
|---|---|---|
| `number` | Number | Biochemistry ปัจจุบัน |
| `text` | Text | ผลข้อความใน Lab อื่น |
| `select` | Select | Positive/Negative หรือ controlled values |
| `date` | Date | เก็บไว้รองรับอนาคตเมื่อมี requirement จริง |

ห้ามเปิด type ที่ยังไม่มี test/use case จริงใน production เพียงเพราะ component รองรับ

### 4.3 Range type → Advanced fields

- `NormalNumeric`: แสดง normal-rule preview
- `CriticalNumeric`: แสดง critical-rule preview และคำเตือนว่านี่เป็น configuration
- `CustomNumeric`: แสดง `min_result_status_id` / `max_result_status_id`
- การเห็น threshold ไม่ได้แปลว่า machine LIS result เป็น critical; machine result ยังต้องใช้
  explicit critical decision จาก integration contract

### 4.4 Rule preview

Preview ต้องแสดง “ความหมายที่ระบบจะใช้” ไม่แสดงแต่เครื่องหมาย เช่น:

```text
Normal · อายุ 5 วัน–6 เดือน · ชาย · ค่า 10–84 U/L
Critical · ทุกเพศ · ค่านอกช่วง 40–200 mg/dL
Normal · ทุกเพศ · ค่าน้อยกว่าหรือเท่ากับ 8 mg/dL (source operator >=)
```

ตัวอย่างสุดท้ายยึด semantics ที่ผู้ใช้ยืนยัน แม้ไม่ตรงกับการอ่านเครื่องหมายทางคณิตศาสตร์ทั่วไป

## 5. Validation ก่อนบันทึก

1. ต้องเลือก Reference Set, Section, Result Test, physiological type, range type และ operator
2. Age ต้องไม่ติดลบ; ส่วน numeric range value ห้ามบังคับว่าเป็นบวกเสมอ เพราะ Lab อื่น
   อาจมี reference boundary ติดลบได้
3. Two-value operator ต้องมีทั้ง `first_value` และ `second_value`
4. Two-value operator ต้องตรวจ `first_value < second_value`
5. One-value operator ต้องไม่มี `second_value`
6. `all_ages=false` ต้องมี age boundary ครบทั้ง value และ unit
7. ก่อน activate ต้องมี Result Test และ Unit ที่ถูกต้อง; mapping ไป
   `Lab_Result_Definition_Master` ตรวจเพิ่มเมื่อ rule นี้จะถูกใช้ผ่าน CPOE/result flow
8. ตรวจ duplicate ด้วย stable rule key; ห้ามใช้ `priority` ตัวเดียว เพราะ Normal/Critical/Custom
   อาจมี priority ซ้ำใน test และช่วงอายุเดียวกัน
9. แก้ rule ที่เคย active ต้องมี `change_reason` และ revision ใหม่

## 6. Config management screen

ใช้ `Data Grid Form` หรือ `List View` แสดง `Lab_Reference_Range_Rule` แล้วเปิด Rule Editor
เป็น popup ไม่ใช้ Sub Form ขนาดใหญ่

Filters:

- Lab section / Reference Set
- Test code / Test reference
- Physiological type
- Age unit
- Range type
- Operator
- Active/retired

Columns หลัก:

```text
Test | Sex | Age range | Range type | Operator | First | Second | Unit | Revision | Status
```

Actions:

- เพิ่ม rule
- ดู/แก้ rule
- Duplicate เป็น revision/ช่วงอายุใหม่
- Retire rule พร้อมเหตุผล
- ดูประวัติ

การ import Excel ควรทำเป็นกระบวนการแยก: parse → preview → validate → import draft →
ผู้ดูแลตรวจ → activate ไม่ควรเขียนทับ active rules โดยตรง

## 7. เรื่องที่ต้องยืนยันก่อนสร้าง JSON/runtime

1. ยืนยันว่า Section Form ID `6a58f4dfd448dfc9d33e2bf2` เป็น live master ที่จะใช้จริง
2. การ map `Test code` / `Test reference` จาก Result Test ไป `Lab_Result_Definition_Master`
3. semantics ของ `<=`, `>` และค่าที่เท่ากับ boundary ของ `Exclusive limits`
4. วิธี match อายุที่รอยต่อระหว่างช่วง
5. แถวต้นทาง 18 แถวที่ไม่มี age boundary หมายถึง all ages จริงหรือไม่
6. ความหมายของ `VRH` และ status master ที่ต้องอ้าง
7. policy การ activate/approve และผู้มีสิทธิ์แก้ clinical configuration
8. ต้องลาก `Dynamic Input` จาก Builder แล้ว export template เพื่อใช้เป็น golden widget

## 8. SDForm delivery constraints

- Token ที่โหลดแล้ว: `SDFORM-RULES-OK-2026-08-25`
- ห้ามเขียน widget `options` จากศูนย์
- ต้องใช้ container จากแม่แบบและเก็บลูกใน `.fields` ตาม export จริง
- ก่อนส่ง JSON ต้องรัน `python3 check_sdform_json.py <file.json>` และได้ exit code 0
- Static validator ไม่ใช่ Builder/runtime test; ต้องให้ผู้ใช้ import และยืนยันว่า canvas/preview
  แสดงครบก่อนเรียกว่าใช้งานได้
