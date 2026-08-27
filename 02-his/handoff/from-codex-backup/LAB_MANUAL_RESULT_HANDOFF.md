# Manual Lab Result — Persistent Handoff / Working Memory

อัปเดตล่าสุด: 19 สิงหาคม 2569 (Asia/Bangkok)

## Resume trigger

เมื่อผู้ใช้เปิด session ใหม่ใน workspace นี้แล้วพิมพ์ว่า **“ทำต่อ”**, **“ทำผลแลปต่อ”**, **“กรอกผล manual ต่อ”** หรือพูดถึง `Lab_Result_Item`, `Result_Report_Manual_Entry`, ผล Manual/LIS หรือค่าวิกฤต ให้ทำดังนี้ก่อนเสมอ:

1. อ่านไฟล์นี้ทั้งไฟล์
2. อ่าน `MEMORY.md`
3. ตรวจไฟล์ JSON ล่าสุดที่ระบุในหัวข้อ **ไฟล์ที่ถือเป็นตัวล่าสุด**
4. ทวน checkpoint สั้น ๆ ให้ผู้ใช้ก่อนแก้ไฟล์หรือเปลี่ยน flow

ข้อความทวนเริ่มต้นที่แนะนำ:

> ตอนล่าสุดเราออกแบบระบบกรอกผล Lab ให้ใช้ Result Report หนึ่งชุดต่อหนึ่ง Lab Work Item และมี Result Item หลายรายการอยู่ใต้ Report ค่ะ ผู้ใช้กรอกเฉพาะผล หน่วย และหมายเหตุ ส่วนสถานะ ความครบ ค่าวิกฤต และข้อมูล LIS ให้ระบบคำนวณ/รับเข้าอัตโนมัติ Unit Master ทำเสร็จแล้ว ขั้นถัดไปคือผูก Parent Form สองชั้น ทดสอบการสร้าง Report/Item จากปุ่มดูผล และทำการบันทึกซ้ำลง record เดิมจนผลครบค่ะ

## เป้าหมายที่ตกลงกันแล้ว

สร้าง flow ลงผลตรวจที่รองรับทั้ง:

- กรอกผลด้วยเจ้าหน้าที่แบบ Manual
- รับผลจาก LIS ตาม `his-result-sample.json`
- ผลออกทีละบางรายการได้
- บันทึกซ้ำแล้วอัปเดต record เดิม ไม่สร้างรายการซ้ำทุกครั้ง
- แสดงสถานะระดับใบสั่งเป็น `กำลังตรวจ` → `ออกผลไม่ครบ` → `ออกผลครบ`
- เมื่อผลครบแล้วเปิดดูแบบ read-only และต้องกด `แก้ไขผลตรวจ` จึงจะแก้ไข/ทำ correction ได้
- รองรับค่าวิกฤตจาก LIS และรองรับการคำนวณจากเกณฑ์ที่ Lab อนุมัติในอนาคต

## หลัก UX ที่ห้ามเปลี่ยนโดยไม่ถามผู้ใช้

1. หน้ากรอกผลต้องเรียบง่าย เน้นฟังก์ชัน ไม่เน้น CSS
2. ใช้ widget มาตรฐานของ initCraft เป็นหลัก
3. หลีกเลี่ยง Sub Form และ advanced/custom widget ที่เคยทำให้ Preview/ฟอร์ม blank
4. ผู้ใช้ควรเห็นเฉพาะ:
   - รายการผลตรวจ
   - ช่องกรอกผล ซึ่งเปลี่ยนชนิดตาม `result_type`
   - หน่วย
   - หมายเหตุ (ถ้ามี)
   - การแจ้งเตือนค่าวิกฤตแบบอ่านอย่างเดียว
5. ห้ามแสดง ID, rule, version, integration fields หรือ switch ภายในให้ผู้ใช้กรอกเอง
6. ไม่ต้องมีปุ่ม `บันทึกร่าง` และ `บันทึกผล` ซ้ำกับปุ่มระบบ ให้ใช้ปุ่ม **Submit ของ initCraft ปุ่มเดียว** เพื่อบันทึก
7. เปิด/ปิดฟอร์มได้แม้ยังไม่กรอกผล การเปิดฟอร์มไม่ควรเปลี่ยนสถานะเอง
8. ก่อนผลครบ ผู้ใช้ Submit ซ้ำเพื่ออัปเดต record เดิมได้
9. หลังผลครบ ฟอร์มเป็น read-only; การแก้ไขภายหลังต้องเข้าทาง `แก้ไขผลตรวจ` และเก็บ correction/audit
10. การแก้ไขเพิ่มใหม่ต้องไม่ลบหรือทำฟังก์ชัน Lab เดิมที่ใช้งานได้เสียหาย

## สถานะและกติกาความครบ

สถานะระดับ Lab Work Item / Result Report:

| เงื่อนไข | สถานะที่แสดง |
|---|---|
| ยังไม่มีผลที่ใช้ได้ | `กำลังตรวจ` |
| มีผลแล้วบางรายการ แต่รายการที่จำเป็นยังไม่ครบ | `ออกผลไม่ครบ` |
| รายการที่กำหนดว่าจำเป็นมีผลครบทั้งหมด | `ออกผลครบ` |

กติกา:

- ค่าเริ่มต้นของ Result Item คือ `ผลยังไม่ออก`/`pending`
- `required_for_completion` เป็น configuration ใน Result Definition Master ไม่ใช่ switch ให้ผู้ใช้กดในหน้ากรอกผล
- `expected_count`, `resulted_count`, `final_count` เป็นค่าที่ระบบคำนวณ ไม่ต้องแสดงเป็นช่องให้กรอก
- `resulted_at` หรือคอลัมน์ `เวลาออก` แสดงเมื่อรายการที่จำเป็นออกผลครบเท่านั้น
- การบันทึกผลบางส่วนต้องไม่ปิดงานและไม่ทำเวลาออกผลสุดท้าย
- ถ้า Result Definition บางรายการกำหนดว่าไม่จำเป็นต่อความครบ รายการนั้นไม่ควรขวางสถานะ `ออกผลครบ`

## การออกแบบค่าวิกฤต

- LIS สามารถส่งค่าวิกฤตมาโดยตรง ให้มี field รอรับ แต่ไม่ให้เจ้าหน้าที่เปิด/ปิดเอง
- ใช้ `interpretation_code` รองรับค่าประเภท `N`, `L`, `H`, `LL`, `HH`, `AA`
- ใช้ `is_critical` เป็น Boolean ภายใน/อ่านอย่างเดียว
- เมื่อ `interpretation_code` เป็น `LL`, `HH` หรือ `AA` ให้ระบบตั้ง `is_critical = true`
- ถ้าเป็น Manual และ Definition มีเกณฑ์ `critical_low_rule` / `critical_high_rule` ระบบสามารถคำนวณ flag ได้
- หน้ากรอกผลแสดง Alert/ข้อความสีแดงเมื่อเป็น critical แต่ห้ามให้ผู้ใช้ใช้ switch เปลี่ยนเอง
- การแจ้งผู้เกี่ยวข้องและการรับทราบค่าวิกฤตเป็น milestone ภายหลัง ต้องมี audit หากนำขึ้น production

## ERD ที่ตกลงกันแล้ว

```text
Center Lab Order
      │  API เดิมสร้างรายการ
      ▼
Lab_Work_Item_CRUD
      │ 1 : 1
      ▼
Result_Report_Manual_Entry
      │ 1 : N
      ▼
Lab_Result_Item

CPOE Lab Item ───────► Lab_Result_Definition_Master
Lab_Unit_Master ─────► Lab_Result_Definition_Master
Lab_Result_Definition_Master ─► Lab_Result_Item
Lab_Unit_Master ───────────────► Lab_Result_Item
```

### Parent Form ที่ต้องตั้งจริง

| ฟอร์มลูก | Join Parent Form | ความสัมพันธ์ |
|---|---|---|
| `Result_Report_Manual_Entry` | `Lab_Work_Item_CRUD` | งาน Lab หนึ่งรายการมีรายงานผลหนึ่งชุด |
| `Lab_Result_Item` | `Result_Report_Manual_Entry` | รายงานหนึ่งชุดมีผลตรวจหลายรายการ |

ฟอร์มที่ **ไม่ต้องตั้ง Parent Form**:

- `Lab_Unit_Master`
- `Lab_Result_Definition_Master`
- CPOE Lab Item Master
- Center Lab Order เดิม

Master ทั้งหมดให้อ้างอิงด้วย Select By Form/ID ไม่ใช่ Join Parent Form

### Select By Form references

| ฟอร์ม/field | อ้างอิง |
|---|---|
| `Lab_Result_Definition_Master.cpoe_item_id` | CPOE Lab Item Master |
| `Lab_Result_Definition_Master.result_test_id` | Legacy/LIS Lab Test master ถ้ายังใช้อยู่ |
| `Lab_Result_Definition_Master.default_unit_id` | `Lab_Unit_Master` |
| `Lab_Result_Item.result_definition_id` | `Lab_Result_Definition_Master` |
| `Lab_Result_Item.unit_id` | `Lab_Unit_Master` |

ค่าที่แนะนำสำหรับ Select By Form:

- `valueField = _id`
- Unit ใช้ `labelField = unit_symbol`
- Result Definition ใช้ชื่อรายการผลตรวจเป็น label
- ถ้า Select By Form บันทึก `{ value, label }` เวลาค้นต้องใช้เส้นทางเช่น `unit_id.value`

### Runtime parentId

เปิด Report จากปุ่ม `ดูผล`:

```js
openForm(resultReportFormId, reportId || null, workItemId, initData)
```

เปิด Result Item จาก Report:

```js
openForm(resultItemFormId, resultItemId || null, resultReportId, initData)
```

initCraft ใช้ `parentId`/`xparentx` เชื่อม child record กับ parent; อย่าส่ง `null` ในตำแหน่ง parentId เมื่อสร้าง child

## คำตอบ ERD ล่าสุดที่ผู้ใช้ขอให้จำ

> ในหน้าตามภาพ `Lab_Unit_Master` ปล่อย Parent Form ว่างไว้ถูกต้องแล้ว ไม่ต้องกด Join Parent Form เพราะ Unit เป็น Master กลางที่หลายฟอร์มนำไปใช้ร่วมกัน
>
> ตั้ง Parent แค่ 2 คู่ คือ `Lab_Work_Item_CRUD → Result_Report_Manual_Entry → Lab_Result_Item` ส่วน Unit, Definition และ CPOE ใช้ Select By Form อ้างอิงกันเท่านั้น
>
> `Result_Report_Manual_Entry` ให้ Join Parent Form เป็น `Lab_Work_Item_CRUD` และ `Lab_Result_Item` ให้ Join Parent Form เป็น `Result_Report_Manual_Entry`
>
> Center Lab Order → Lab Work Item ใช้ API/materialization เดิม ห้ามเปลี่ยน flow เดิมเป็น Parent Form โดยไม่ตรวจผลกระทบ

## ฟอร์มและ ID ที่ทราบแน่นอน

| ฟอร์ม | Form ID | หมายเหตุ |
|---|---|---|
| CPOE Lab Item Master ปัจจุบัน | `6a7c7c2974a0be190cc303e0` | รายการสั่งตรวจต้นทาง |
| Legacy/LIS Lab Test | `6a597647d448dfc9d33e2d39` | รายการผล/OBS เดิม |
| `Lab_Unit_Master` | `6a7aa575935ed08882467368` | Unit Master กลาง; ผู้ใช้ Import records แล้ว |
| `Lab_Result_Definition_Master` | `6a7aa5f4935ed08882467373` | mapping CPOE → รายการผล/OBS/หน่วย |
| `Result_Report_Manual_Entry` | `6a8478abf851000f28e44a16` | Result Report/header + manual entry workspace |
| `Lab_Result_Item` | `6a7aa641935ed08882467374` | หนึ่ง record ต่อหนึ่งรายการผล |

อย่าเดา Form ID ที่ไม่อยู่ในตารางนี้ ให้ตรวจ Form Manage หรือฐานข้อมูลแบบ read-only ก่อนใช้งาน

## Field contract ที่จำเป็น

### `Lab_Unit_Master`

ผู้ใช้ต้องการให้ Master เล็กที่สุด:

```text
unit_code
unit_symbol
unit_name_en
unit_name_th
is_active       // เก็บได้แต่ไม่ต้องโชว์ถ้าไม่จำเป็น
```

ไม่ต้อง Join Parent Form; `unit_code` ควร unique

### `Lab_Result_Definition_Master`

หน้าที่คือ mapping จาก CPOE item ไปยังผลรายตัวและกติกาการรายงาน ไม่ใช่ transaction result

Core configuration:

```text
cpoe_item_id
result_test_id / lis_obs_code
result_sequence
result_type
default_unit_id
decimal_places
reference_range_text
allowed_text_options
required_for_completion
allow_manual_entry
revision_no
is_active
```

เกณฑ์ critical ให้เก็บเฉพาะเมื่อ Lab ยืนยันแล้ว ห้ามสร้างค่าคลินิกขึ้นเอง

### `Result_Report_Manual_Entry`

หน้าที่คือ header ต่อหนึ่ง Lab Work Item และเป็นหน้ารวมรายการผล

Core data:

```text
order_status_id / parentId
lab_no
patient_hn snapshot
patient_name snapshot
lab_section snapshot
specimen snapshot
source_mode          // manual | lis | mixed
overall_status      // processing | partial | completed
resulted_at
```

จำนวน expected/resulted/final ให้คำนวณ ไม่ต้องให้ผู้ใช้กรอก

### `Lab_Result_Item`

หนึ่ง record ต่อหนึ่ง Result Definition ต่อหนึ่ง Report

Core functional data:

```text
result_report_id / parentId
result_definition_id
result_sequence
test_code / obs_code
test_name snapshot
result_type
result_value
unit_id
unit_symbol_snapshot
reference_range_snapshot
result_comment
result_source          // manual | lis
result_status          // pending | entered | final | corrected
interpretation_code
is_critical
```

LIS/audit fields เช่น `result_uid`, `obx_status`, `receipt_seq`, `result_version`, `change_kind` เก็บเป็น internal fields เมื่อ integration ต้องใช้ แต่ไม่แสดงในหน้ากรอก Manual

Visible widgets ของหน้ากรอกผลควรเหลือเพียง:

```text
รายการผลตรวจ (readonly)
ผลตรวจ (Dynamic Input หรือ Basic widget ตาม result_type)
หน่วย (Select By Form)
หมายเหตุ
Critical alert (readonly เฉพาะเมื่อเกิด)
```

## Result type / widget behavior

- `number` → Number Input
- `text` → Text Input/Textarea
- `select`/qualitative → Select Input จาก `allowed_text_options`
- `date`/`datetime` → Date Time widget ถ้ามี test ที่ต้องใช้จริง
- ค่าเริ่มต้นเมื่อยังไม่มีผลให้ถือเป็น `pending`/`ผลยังไม่ออก` ไม่บังคับกรอกทุกครั้งที่เปิด
- Unit default มาจาก Definition แต่ผู้ใช้แก้ได้เฉพาะหน่วยที่อนุญาต

## Manual save behavior

1. กด `ดูผล` จาก Lab Work Item
2. ระบบค้น Report ของ Work Item นี้ก่อน
3. ถ้าไม่พบ ให้สร้าง Report หนึ่ง record และสร้าง Result Item จาก ordered CPOE items + Result Definitions
4. ถ้าพบ ให้เปิด Report เดิมและโหลด Result Items เดิม
5. Submit ต้อง upsert/update Result Item เดิม โดย key อย่างน้อย `result_report_id + result_definition_id`
6. หลังบันทึกให้คำนวณความครบใหม่ทุกครั้ง
7. บันทึกบางส่วน → `ออกผลไม่ครบ`
8. ครบรายการที่จำเป็น → `ออกผลครบ`, stamp `resulted_at`, update Lab Work Item
9. หลังครบ → readonly; การแก้ใช้ correction flow ไม่เขียนทับโดยไม่มี audit

## LIS inbound behavior

ไฟล์ตัวอย่างที่ผู้ใช้เคยให้ศึกษา:

```text
/Users/nichada/Downloads/his-order-sample.json
/Users/nichada/Downloads/his-result-sample.json
```

หลัก mapping:

- Header/order/result message → Result Report
- `items[]`/OBX แต่ละรายการ → Result Item
- ใช้ `lab_no + section + obs_code/test_code` หรือ stable result UID ในการ match; ห้าม match ด้วย `lab_no` เพียงอย่างเดียว
- `obs_code` ใช้ค้น `Lab_Result_Definition_Master`
- หน่วยจาก LIS ใช้หา `Lab_Unit_Master` แล้ว snapshot symbol ไว้กับ Result Item
- LIS อาจส่งผลมาไม่ครบในครั้งเดียว ให้ upsert item เดิมและคำนวณสถานะใหม่
- LIS critical flag/interpretation ต้องถูกเก็บโดยไม่ให้ผู้ใช้แก้ switch เอง

## ข้อมูลที่ต้อง Import และไม่ต้อง Import

ต้อง Import/เตรียมล่วงหน้า:

1. `Lab_Unit_Master` records — ผู้ใช้ทำเสร็จแล้ว
2. `Lab_Result_Definition_Master` mapping records — ต้องทำให้ครบตาม CPOE/LIS ที่ใช้งานจริง

ไม่ต้อง Import เป็น seed:

- Result Report
- Result Item

สองฟอร์มนี้เป็น transaction records ที่สร้าง runtime เมื่อมี order/เปิดดูผลหรือเมื่อ LIS ส่งผลมา

## Index / duplicate protection

- Unit Master: unique `unit_code`
- Result Report: หนึ่ง Report ต่อหนึ่ง Work Item; ใช้ unique key ที่ `order_status_id` หรือ parent relation ตาม implementation
- Result Item: หนึ่ง Item ต่อ `result_report_id + result_definition_id`
- หากหน้า DB Schema ทำได้แค่ single-field index ให้ยังไม่เดา compound index; บังคับ idempotency ใน API ก่อน แล้วค่อยสร้าง compound index ด้วยวิธีที่ platform รองรับ

## ไฟล์ที่ถือเป็นตัวล่าสุด

| วัตถุประสงค์ | ไฟล์ |
|---|---|
| Unit Master | `Lab_Unit_Master.json` |
| Result Definition รุ่นล่าสุด | `Lab_Result_Definition_Master_V2.json` |
| Manual Result Report/Entry | `Lab_Result_Report_Manual_Entry.json` |
| Result Item แบบ widget/minimal/critical ล่าสุด | `Lab_Result_Item_Minimal_Widget_Critical.json` |
| Lab Work Item data form | `Lab_Work_Item_CRUD.json` |

ไฟล์ `Lab_Result_Item.json` และ `Lab_Result_Item_V2.json` เป็นรุ่นก่อนหน้า อย่าถือเป็นตัวล่าสุดโดยอัตโนมัติ

## สิ่งที่ทำเสร็จแล้ว

- ตกลง architecture Manual/LIS/result completeness แล้ว
- Unit Master schema และ records ถูกผู้ใช้เตรียมเสร็จแล้ว
- มี Result Definition form และ mapping design แล้ว
- มี JSON สำหรับ Result Report Manual Entry
- มี JSON สำหรับ Result Item รุ่น minimal/widget/critical
- ตกลงไม่ใช้ custom CSS เป็นเงื่อนไขหลักของฟอร์มผล
- ตกลงไม่ใช้ Sub Form ที่เคย render blank เป็นแกนหลัก
- ตกลงใช้ Submit ปุ่มเดียวและอัปเดต record เดิม
- ตกลง critical flag เป็น system/LIS-driven ไม่ใช่ user switch
- ตกลง ERD/Parent Form สองชั้นแล้ว

## ยังไม่ควรกล่าวว่าสำเร็จจนกว่าจะทดสอบจริง

- Parent Form ทั้งสองคู่ยังต้องยืนยันว่าได้ตั้งและบันทึกใน live Form Manage แล้ว
- ต้องยืนยันว่า `openForm(..., parentId, ...)` สร้าง `xparentx` ถูกต้อง
- Result Item minimal JSON เคยมีประวัติ Preview blank/field hide จาก JSON รุ่นก่อน ต้อง Import เป็นฟอร์มทดสอบและตรวจทุก widget ก่อนแทนฟอร์มจริง
- ต้องยืนยันว่า Select By Form ของ Unit/Definition แสดง records จริง
- ยังไม่มีหลักฐาน end-to-end ว่าปุ่ม `ดูผล` สร้าง Report + Items, Submit partial, Submit complete และ LIS upsert ได้ครบ
- ห้าม claim ว่า Manual Result production-ready จนผ่าน test cases ด้านล่าง

## Test cases ที่ต้องผ่าน

1. เปิด Work Item ที่ยังไม่มี Report → สร้าง Report เดียวและ Items ครบตาม Definition
2. ปิดฟอร์มโดยไม่กรอก → ไม่มี duplicate และสถานะยัง `กำลังตรวจ`
3. กรอกหนึ่งรายการแล้ว Submit → record เดิมถูก update และสถานะ `ออกผลไม่ครบ`
4. เปิดใหม่ → เห็นค่าที่บันทึกไว้เดิม
5. กรอกครบ required items → `ออกผลครบ` และมี `resulted_at`
6. `เวลาออก` ไม่แสดงก่อนผลครบ
7. หลังผลครบเปิด read-only และปุ่ม `แก้ไขผลตรวจ` เข้าสู่ correction ได้
8. LIS ส่งบางรายการสองรอบ → upsert item เดิม ไม่สร้าง duplicate
9. LIS ส่ง critical → `interpretation_code`/`is_critical` ถูกต้องและแสดง Alert
10. Unit/Reference snapshot ของผลเก่าไม่เปลี่ยนตาม Master ที่แก้ภายหลัง

## ขั้นตอนถัดไปที่ควรทำ

1. ตั้ง Parent Form ใน live Form Manage ตาม ERD สองคู่
2. ตรวจ DB Schema หลัง Submit ว่า parent relation ถูกบันทึก
3. Import/ตรวจ `Lab_Result_Item_Minimal_Widget_Critical.json` ในฟอร์มทดสอบก่อน
4. ตรวจ field visibility: เห็นเฉพาะ result, unit, comment และ critical alert
5. ทำ API `get-or-create result report` แบบ idempotent
6. ทำ materialization: ordered CPOE items → Result Definitions → Result Items
7. ผูกปุ่ม `ดูผล` ในหน้า Lab โดยไม่แก้ฟังก์ชันหลักอื่น
8. ทำ save/recalculate status และ stamp `resulted_at` เมื่อครบ
9. ทำ LIS adapter จาก sample JSON
10. ทดสอบ Manual partial/complete/critical และ LIS partial/upsert ก่อนปรับ UI เพิ่ม

## Safety / non-regression rules

- ห้ามลบหรือย่อฟังก์ชัน receive/reject/specimen/status เดิมเพียงเพื่อเพิ่ม Manual Result
- แก้เฉพาะ scope ที่ผู้ใช้ขอในแต่ละรอบ
- ก่อนแก้ JSON รุ่นที่ใช้งานจริง ให้สร้างไฟล์รุ่นใหม่หรือ backup เสมอ
- ไม่เขียน production MongoDB โดยตรง; ใช้ Form/API flow และตรวจ MongoDB แบบ read-only เว้นแต่ผู้ใช้อนุญาตชัดเจน
- ห้ามประดิษฐ์หน่วย, reference range หรือ critical threshold ทางคลินิกเอง
- ข้อมูลผู้ป่วยและผลตรวจเป็นข้อมูลอ่อนไหว ไม่คัดลอก production record ลง handoff

---

## Requirement decisions — 2026-08-19 (supersedes older result architecture where conflicting)

### Confirmed by user

1. The current canonical Lab operational/work-order record is
   `zdata_specimen_collection_status`. The disabled/empty `zdata_lab_cen_crud`
   is not part of the current runtime flow unless a future decision explicitly
   restores it.
2. The one Center ordering form in actual use is `Center Lab Order Test`.
   Other enabled/legacy Center-order forms must not be treated as current merely
   because they still exist in Form Manage.
3. The canonical order-item master is the form named `CPOE Lab Item Form`.
   Exact live id should be rechecked before any code change, but Test/clone and
   legacy Lab Test catalogs are not additional order masters.
4. The Lab result flow currently needs only an entry user and edit users; there
   is no confirmed separate verify/approve role. Persist `entered_by` /
   `entered_at`, and append an immutable edit history for every subsequent
   change containing editor, timestamp, field name, old value, and new value.
   Derive edit count and distinct-editor count from this history; do not start
   auditing only after the second edit.
5. Partial-result and complete-result rules are required, but their exact
   completion criteria still need Lab-user confirmation.
6. The integration team, not this HIS Lab UI, owns the mapping to LIS. The
   current direction is that HIS sends LAB NO., VN, and `his_code_id` in the
   OBR/order payload; `his_code_id` will be added by the Center Lab team. The
   integration team's API will return LIS results into this HIS Lab system.
7. LIS interface contract/sample payloads and the physician/patient report
   layout are intentionally parked for the next requirement round.

### Open questions to ask Lab users next

1. Does one ordered CPOE item always produce one result, or can it produce
   multiple reportable components/OBX rows (panels and narrative tests)?
2. Which result components are required before an order becomes complete?
3. What is the official critical-result workflow: source of the critical flag,
   who must be notified, required acknowledgement details, retry/escalation,
   and behavior after a corrected result?
4. Full LIS order/result contract, including stable identifiers, partial/final/
   corrected/void messages, duplicate retries, and ACK/NACK behavior.
5. Final physician/patient result presentation and legal print requirements.

### Xray architecture recommendation (pending user approval)

Keep one Center ordering experience, but materialize different operational
records by `order_type`:

```text
Center Lab Order Test
  ├─ LAB  -> zdata_specimen_collection_status (Lab Work Order)
  └─ Xray -> separate Xray Work Order CRUD/collection
```

Do not store Xray workflow fields in `zdata_specimen_collection_status`.
Xray has different scheduling, modality, body part/view, contrast, pregnancy/
safety screening, technician/radiologist assignment, acquisition, report and
amendment states. Both child work orders should retain common source keys such
as Center Order id, selected-item/master id, VN, HN, order number,
`his_code_id`, destination section/modality, and patient/order snapshots.

---

## HIS-LIS interface checkpoint — 2026-08-23

For the latest verified HIS-LIS transport contract, sample JSON fields,
idempotency rules, order/result statuses, mapping gaps, and diagrams, read
`LIS_HIS_INTEGRATION_HANDOFF.md` completely. It supersedes older assumptions in
this document where the actual LISconnect specification or JSON examples
conflict.

Do not infer that `his_code_id`, outbound `items[].test_code`, and inbound
`items[].obs_code` are the same identifier. The current business requirement
says HIS must send `his_code_id`, while the current transport sample only names
`test_code`; this remains a contract gap requiring integration-team
confirmation.

---

## Live result-receive checkpoint — 2026-08-25 (supersedes older IDs/status where conflicting)

### Current live forms and ownership

| Layer | Live form | Form ID | Collection / role |
|---|---|---|---|
| Technical receipt | `Lab_Result_Inbound_Receive` | `6a8b1c03f851000f28e501ef` | `zdata_lab_result_inbound`; append-only receipt per `result_uid` |
| Report header/workspace | `Result_Report_Manual_Entry` | `6a8d4334f851000f28e5025b` | `zdata_lab_report_manual_entry`; one materialized report per stable report key |
| Result row | `LAB_result_item` | `6a8bc91df851000f28e501fb` | `zdata_lab_result_item`; one materialized row per report/result component |
| Viewer UI | `Result Report Viewer` | `6a8d5620f851000f28e50270` | `form_ui`; popup/read-edit presentation, not a transaction collection |

Inbound process: `hl7_result_upsert_api` id `6a8da8a6f851000f28e50299`.

### What the API already does

1. Validate the inbound Agent payload and deduplicate by `result_uid`.
2. Append a technical receipt to `Lab_Result_Inbound_Receive`.
3. Match the real Lab work order using LAB NO. (`filler_order_no`) plus the available order/HN/VN and result-code checks.
4. Upsert the report header in `Result_Report_Manual_Entry`.
5. Materialize `items[]` into `LAB_result_item` and link each item to its report using the report id/parent relation.
6. Update the operational Lab work status and mark the receipt processed or unmatched.

Do not build another API-to-form connector for these three data forms. The
remaining connection is the presentation path: Lab Workbench result ListView →
`ดูผล` → `Result Report Viewer` → result items filtered by Report id.

### Verification completed

- A matching UAT partial-result payload returned `PROCESSED` and created the Receipt, Report, and one Result Item.
- Read-only database inspection confirmed the three records were linked and the work status was advanced.
- Resending the same payload returned `DUPLICATE_RESULT_UID` with no duplicate result creation.

This proves the partial persistence/idempotency path only. It does not prove the
complete production workflow.

### Explicitly parked

The user has asked to keep the combined Lab Workbench `form_ui` on hold. Do not
create or redesign it until the user resumes that task. Keep the existing Viewer
as the intended popup destination.

### Release blockers / next verification

1. Create a real UAT order through the normal HIS order workflow.
2. Verify HIS → Agent order submission, Agent → LIS transport, LIS → Agent result parsing, and Agent → HIS callback.
3. Verify a multi-item `final` payload, then `corrected`, and ensure stale versions do not overwrite newer results.
4. Verify the future Lab result-tab ListView, `ดูผล` popup, file upload, and refresh behavior.
5. Verify Manual Microbiology creates/updates only allowed result fields while preserving item names and audit.
6. Verify security, permissions, unique/idempotency protection, concurrency, and error recovery.

### Critical-value contract guardrail

For machine LIS/Mlab results, treat the explicit critical decision received from
the integration (`is_critical` and/or the agreed interpretation code) as the
clinical result. HIS displays/alerts from that decision and does not calculate
the threshold again. Keep low/high rule text as a snapshot only.

The current sample/schema must be reconciled before release if it sends rule
text for normal results but omits an explicit critical flag. In that case,
inferring `is_critical` from “rule text is present” is incorrect and the API/
contract must be revised before production testing.
