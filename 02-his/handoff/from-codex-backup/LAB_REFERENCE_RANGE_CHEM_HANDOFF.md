# CHE Reference Range — Learning Handoff

อัปเดต: 2026-08-26 19:30 (Asia/Bangkok)

## Latest confirmed form and import artifacts

- ฟอร์มล่าสุดที่ผู้ใช้ส่งจาก Builder ถูกบันทึกแทนเวอร์ชันเดิมที่
  `/Users/nichada/Documents/init-vault/HIS/sdform_module/reference.json`
- สำเนาใน workspace: `reference_latest_2026-08-26.json`
- `service_type` ถูกถอดออกแล้ว; `section` เป็น root field และ `dependEnable=false`
- Sub Form ชื่อ `reference_ranges` มี field ลูก 13 ช่องตาม dotted path
  `reference_ranges.*`
- ค่าที่รับเข้า Select ในเวอร์ชันล่าสุดต้องใช้ค่าต้นฉบับ ได้แก่ `All/M/F`,
  `DAYS/MONTHS/YEARS`, operator แบบเต็ม (`Inclusive limits` ฯลฯ) และ
  `NormalNumeric/CriticalNumeric`
- `range_unit_id` เป็น Group List ชนิด String จึงใช้ข้อความหน่วย ไม่ใช้ JSON
  `{value,label}` ของ Unit Master แบบเวอร์ชันก่อน
- Excel สำหรับ Record Import ล่าสุด:
  `Reference_Range_Chem_initCraft_IMPORT_FLAT_GROUPED_2026-08-26.xlsx`
  มีเพียงชีต `IMPORT_READY`, 78 parent Test groups, 330 Sub Form rows และ 22 คอลัมน์
- รูปแบบกลุ่ม: แถวแรกของแต่ละ Test มี root fields; แถวต่อเนื่องเว้น root fields
  และบรรจุเฉพาะ `reference_ranges.*` เพื่อให้รวมเป็น Sub Form ของ parent เดิม
- Test groups อีก 54 กลุ่ม / 329 rules ยังไม่รวมในไฟล์ import เพราะ audit เดิมพบ
  master mapping หรือค่าบังคับไม่ครบ ห้ามเดาหรือ import ปะปน
- Static validation ผ่านแล้ว แต่การกด Import และเปิด record ใน initCraft runtime
  ยังต้องยืนยันในระบบจริง

## Scope decision (original learning checkpoint)

- พักงาน Lab Workbench / Result `form_ui` ไว้ก่อนตามคำสั่งผู้ใช้
- checkpoint เดิมด้านล่างเป็นผลการอ่าน Numbers; เวอร์ชันล่าสุดด้านบนได้เพิ่ม
  form JSON และ Excel import ตามคำสั่งผู้ใช้แล้ว

## Source

ไฟล์ต้นทาง:

```text
/Users/nichada/Documents/Reference range Chem 13 July 26.numbers
```

อ่านจาก `Sheet1` / `Table 1` ได้ 660 แถวรวม header หรือ 659 data rows,
20 คอลัมน์ และ 132 test groups

## ความหมายคอลัมน์ที่ผู้ใช้ยืนยัน

| คอลัมน์ | ความหมาย |
|---|---|
| `Physiological type` / `physiologicalType` | เพศ: `M`, `F`, `ALL` |
| `Initial age` + `Initial age unit` | อายุแรกเริ่มของช่วงที่กฎใช้ |
| `Final age` + `Final age unit` | อายุสุดท้ายของช่วงที่กฎใช้ |
| `numericRangeOperator` | รูปแบบการประเมินค่าตัวเลข |
| `rangeType` | ประเภทกฎ เช่น `NormalNumeric`, `CriticalNumeric`, `CustomNumeric` |
| `firstValue`, `secondValue` | ค่า boundary ของกฎ |
| `rangeUnit` | หน่วยของผลตรวจสำหรับกฎนั้น |

`Test code` และ `Test reference` มีค่าเฉพาะแถวแรกของแต่ละ test group;
แถวถัดมาที่เว้นว่างต้อง inherit ค่าจากแถวก่อนหน้า ห้ามตีความว่าไม่มี test

คอลัมน์ที่ซ้ำกันมีค่าตรงกันครบทุก 659 แถว:

- `Physiological type` = `physiologicalType`
- `priority` คอลัมน์ที่ 3 = `priority` คอลัมน์ที่ 11

## Operator semantics ที่ผู้ใช้สอน

ต้องยึดความหมายตามนี้ ไม่แปลเครื่องหมายด้วยสมมติฐานทางคณิตศาสตร์เอง:

| ตัวอย่าง | ความหมายที่ผู้ใช้กำหนด |
|---|---|
| `Inclusive limits`, `firstValue=10`, `secondValue=84` | ค่า 10–84 เป็นค่าปกติ |
| `<`, `firstValue=250` | ค่ามากกว่า 250 เป็นค่าปกติ |
| `>=`, `firstValue=8` | ค่าน้อยกว่าหรือเท่ากับ 8 เป็นค่าปกติ |
| `Exclusive limits`, `firstValue=40`, `secondValue=200` | ค่านอกช่วง 40–200 เป็นค่าวิกฤติ คือด้านต่ำกว่า 40 หรือสูงกว่า 200 |

ตัวอย่างทั้ง 4 แบบพบจริงในไฟล์ ได้แก่ AST 10–84, ALP `< 250`, TBIL `>= 8`
และ GLU/GLU_NaF `Exclusive limits 40–200`

## ภาพรวมค่าที่พบจริง

`numericRangeOperator` มี 6 ค่า:

| ค่า | จำนวนแถว |
|---|---:|
| `Inclusive limits` | 543 |
| `<` | 51 |
| `Exclusive limits` | 47 |
| `>=` | 10 |
| `<=` | 5 |
| `>` | 3 |

`rangeType`:

| ค่า | จำนวนแถว |
|---|---:|
| `NormalNumeric` | 602 |
| `CriticalNumeric` | 51 |
| `CustomNumeric` | 6 |

ข้อสังเกตสำคัญ:

- `Inclusive limits` ทุกแถวในไฟล์เป็น `NormalNumeric`
- `Exclusive limits` ทุกแถวในไฟล์เป็น `CriticalNumeric`
- `<`, `>` และ `>=` ไม่ได้บอก Normal/Critical ได้ด้วยตัวเอง เพราะพบมากกว่าหนึ่ง
  `rangeType`; ต้องอ่าน `rangeType` ร่วมด้วยเสมอ
- Test/ช่วงเพศ/ช่วงอายุเดียวกันอาจมีหลายกฎคู่กัน เช่น normal range และ critical
  range จึงห้ามเลือกเพียงแถวเดียวด้วย `priority` แล้วทิ้งกฎอื่น
- มี `CustomNumeric` 6 แถวของ K (`>= 5.5`) พร้อม `minResultStatusID=VRH`;
  ยังไม่สรุปความหมายของ `VRH` เพิ่มเอง
- `method`, `alphaNumericOperator` และ `values` ว่างทุกแถวในไฟล์นี้
- มี 18 แถวที่ age boundary/unit ไม่ครบ ห้ามสรุปเองว่าเป็น all ages จนกว่าจะยืนยัน
- หน่วยที่พบมี 22 รูปแบบข้อความ ต้องเก็บตามต้นฉบับ ไม่ normalize โดยเดา

## จุดที่ยังต้องยืนยันก่อน implement

1. ความหมายที่ผู้ใช้ต้องการสำหรับ operator `<=` และ `>`
2. การนับค่าที่เท่ากับ boundary ของ `Exclusive limits`
3. วิธีเลือกแถวเมื่ออายุอยู่ตรงรอยต่อของสองช่วง
4. ความหมายของแถวที่ไม่กำหนดอายุ
5. บทบาทของ `CustomNumeric` และ `VRH`
6. ไฟล์นี้เป็น source สำหรับ Manual calculation, display snapshot หรือใช้ส่วนใดกับ LIS

## Implementation guardrails

- Match กฎด้วย test + เพศ + ช่วงอายุ + หน่วย และเก็บทุก applicable `rangeType`
- เก็บ normal rule และ critical rule แยกกัน; ห้ามแปลงทุก operator เป็นกฎแบบเดียว
- ใช้ค่าที่แสดงใน Numbers เช่น `0.6` ไม่ใช้ binary-float artifact เช่น
  `0.6000000000000001`
- ห้ามสร้าง reference range, หน่วย หรือ critical threshold เพิ่มจากความรู้ภายนอก
- สำหรับ machine LIS/Mlab ยังต้องใช้ explicit `is_critical`/interpretation ที่รับจาก integration
  ตาม contract guardrail เดิม; ไฟล์นี้ยังไม่ใช่หลักฐานอนุมัติให้ HIS คำนวณ critical แทน LIS
- ต้องรอคำสั่งผู้ใช้ก่อนสร้าง schema/import/API/UI จากข้อมูลชุดนี้
