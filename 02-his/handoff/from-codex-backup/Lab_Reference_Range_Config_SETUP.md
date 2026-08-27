# Lab Reference Range Config — Builder Setup

ใช้คู่กับไฟล์ `Lab_Reference_Range_Config_OneForm_Tabs_v1.json`

สถานะ: JSON ผ่าน static validator แล้ว แต่ยังไม่ได้ยืนยันการแสดงผลใน Builder/Preview/runtime

## จำนวนฟอร์ม

ใช้ **1 ฟอร์ม** ชื่อแนะนำ `Lab_Reference_Range_Config`

- หนึ่ง record ต่อหนึ่ง `Section + Result Test/Lab Test`
- Reference range หลายช่วงอยู่ใน Sub Form `reference_ranges`
- ข้อมูล Excel 132 test groups จะเป็นประมาณ 132 parent records
- 659 data rows จะเป็น rows ภายใน `reference_ranges` ของ test ที่เกี่ยวข้อง

## การทำงานของแต่ละ Tab

### Tab 1 — รายละเอียดรายการตรวจ

- `service_type`: Select By Form จาก CPOE; เลือกประเภทบริการ Lab
- `section`: Select By Form ตัวเดียวกับ CPOE
  - Form ID `6a58f4dfd448dfc9d33e2bf2`
  - `valueField = _id`
  - `labelField = [name]`
  - `searchField = [code, name]`
  - `where = enable = true`
- `lab_item`: Result Test/Lab Test Select By Form ตัวเดียวกับ CPOE
  - Form ID `6a597647d448dfc9d33e2d39`
  - `valueField = code`
  - `labelField = [code, name, flag]`
  - `searchField = [code, name]`
  - `where = code IS NOT NULL :xqLabSection`
- `source_test_code`, `source_test_reference`: snapshot จากไฟล์ต้นทาง
- `method`: เว้นว่างได้สำหรับข้อมูล Biochemistry ปัจจุบัน
- `source_document_name`, `source_sheet`: trace กลับไฟล์ต้นทาง
- `revision_no`, `effective_from`, `effective_to`, `is_active`: version และช่วงใช้งาน

### Tab 2 — Reference Range

Sub Form `reference_ranges` เก็บหนึ่งแถวต่อหนึ่ง rule:

```text
priority
physiological_type
initial_age
initial_age_unit
final_age
final_age_unit
range_unit_id
numeric_range_operator
range_type
first_value
second_value
min_result_status_id
max_result_status_id
```

### Tab 3 — ประวัติและหมายเหตุ

- `change_reason`: เหตุผลการเปลี่ยน clinical configuration
- `notes`: หมายเหตุอื่น
- ใช้ audit fields ของระบบ (`created_at`, `created_by`, `updated_at`, `updated_by`)

## Select Input ที่ต้องตั้งใน Builder

JSON ใช้ Select Input object จาก export จริงเป็น placeholder เพื่อให้ `options` ครบและไม่ทำให้
canvas ว่าง ก่อนใช้งานต้องลบ Option Items เดิมของ placeholder แล้วตั้งค่าต่อไปนี้

### 1. `physiological_type`

Label: `Physiological Type`

| Label | Value |
|---|---|
| ทุกเพศ | `ALL` |
| ชาย | `M` |
| หญิง | `F` |

ตั้ง `Required = true`, `Multiple = false`, `Clearable = true`

### 2. `initial_age_unit`

Label: `Initial Age Unit`

| Label | Value |
|---|---|
| วัน | `DAYS` |
| สัปดาห์ | `WEEKS` |
| เดือน | `MONTHS` |
| ปี | `YEARS` |

ตั้ง `Required = false` เพื่อรองรับ 18 แถวในไฟล์ที่ไม่มี age boundary จนกว่าจะยืนยันว่าเป็น
all ages จริงหรือไม่

### 3. `final_age_unit`

ใช้ Option Items ชุดเดียวกับ `initial_age_unit`

| Label | Value |
|---|---|
| วัน | `DAYS` |
| สัปดาห์ | `WEEKS` |
| เดือน | `MONTHS` |
| ปี | `YEARS` |

ตั้ง `Required = false`

### 4. `numeric_range_operator`

Label: `Numeric Range Operator`

| Label | Value |
|---|---|
| Inclusive limits | `Inclusive limits` |
| Exclusive limits | `Exclusive limits` |
| น้อยกว่า | `<` |
| มากกว่า | `>` |
| น้อยกว่าหรือเท่ากับ | `<=` |
| มากกว่าหรือเท่ากับ | `>=` |

ตั้ง `Required = true`, `Multiple = false`, `Clearable = true`

อย่าตีความเครื่องหมายด้วยคณิตศาสตร์ทั่วไปเอง การแสดงผล/ประเมินค่าต้องยึด semantics ที่ผู้ใช้
ยืนยันไว้ เช่น source operator `>= 8` หมายถึงค่าปกติน้อยกว่าหรือเท่ากับ 8

### 5. `range_type`

Label: `Range Type`

| Label | Value |
|---|---|
| ค่าปกติตัวเลข | `NormalNumeric` |
| ค่าวิกฤตตัวเลข | `CriticalNumeric` |
| กฎตัวเลขแบบกำหนดเอง | `CustomNumeric` |

ตั้ง `Required = true`, `Multiple = false`, `Clearable = true`

## Dynamic Input ที่ต้องแทนใน Builder

ภาพจากผู้ใช้ยืนยันว่า Builder มี `Dynamic Input` แต่ไฟล์ export ที่ให้มายังไม่มี widget object
ชนิดนี้ จึงใช้ Number Input ที่ผ่าน validator เป็น placeholder สองช่อง

ใน Sub Form `reference_ranges`:

1. ลาก `Dynamic Input` ลงใน Sub Form
2. ตั้งช่องแรก:
   - Name: `first_value`
   - Label: `First Value`
   - Input Type: `Number`
   - Required: `true`
   - Column Span: `6`
3. ตั้งช่องที่สอง:
   - Name: `second_value`
   - Label: `Second Value`
   - Input Type: `Number`
   - Required: `false`
   - Column Span: `6`
4. ลบ Number Input placeholder ที่มี label `[แทนด้วย Dynamic Input]`
5. Export JSON กลับมาอีกครั้งเพื่อเก็บ Dynamic Input object เป็นแม่แบบที่ยืนยันแล้ว

สำหรับ Biochemistry ใช้ `Number`; Lab อื่นค่อยเพิ่ม input type เมื่อมี requirement จริง

## Operator กับ First/Second Value

| Operator | First Value | Second Value |
|---|---|---|
| `Inclusive limits` | ต้องมี | ต้องมี |
| `Exclusive limits` | ต้องมี | ต้องมี |
| `<`, `>`, `<=`, `>=` | ต้องมี | เว้นว่าง |

JSON รุ่นนี้ยังไม่ใส่ event ซ่อน/แสดง Second Value เพราะไม่มี event export ที่ยืนยันใน Sub Form
ให้แสดงทั้งสองช่องไว้ก่อนและตรวจตามตารางนี้ตอนกรอก

## วิธีนำข้อมูล Excel เข้า

1. เมื่อพบ `Test code` ใหม่ ให้สร้าง parent record ใหม่
2. เลือก `service_type = Lab` และ Section `Biochemistry/BC`
3. เลือก `lab_item` ที่ตรงกับ Test code โดยไม่สมมติว่า CPOE id และ LIS code เป็น id เดียวกัน
4. ใส่ Test code/reference snapshot
5. แถวถัดไปที่ Test code ว่างให้เพิ่มเป็น row ใน `reference_ranges` ของ parent เดิม
6. เก็บ `range_type` แยกทุกแถว; Normal/Critical/Custom อาจอยู่ใต้ Test เดียวกัน
7. เก็บหน่วยตามต้นฉบับและเลือก `range_unit_id` ที่ตรงกับ Unit Master

## การตรวจหลัง Import

1. Import แล้วดู canvas ทันทีโดยไม่คลิก widget
2. ต้องเห็น 3 Tabs และ Sub Form ใน Tab Reference Range
3. ตั้ง Select Input ทั้ง 5 ช่องตามคู่มือนี้
4. แทน First/Second Value ด้วย Dynamic Input
5. Preview และสร้าง record ทดสอบหนึ่ง Test ที่มีหลายช่วงอายุ
6. เปลี่ยน Section แล้วตรวจว่า Lab Test เก่าถูกล้างและรายการใหม่ถูกกรองจริง
7. เปิด record เดิมใหม่และตรวจว่า Sub Form rows ยังอยู่ครบ

Static validator ผ่านไม่ได้ยืนยัน Builder/Preview/runtime จนกว่าผู้ใช้จะทดสอบในระบบจริง
