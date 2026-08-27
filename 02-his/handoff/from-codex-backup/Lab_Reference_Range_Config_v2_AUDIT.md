# Lab Reference Range Config v2 — Static and Import Preflight

วันที่ตรวจ: 2026-08-26 (Asia/Bangkok)

ไฟล์ฟอร์มที่ตรวจ:

`Lab_Reference_Range_Config_OneForm_Tabs_v2_UserAdjusted.json`

ไฟล์ข้อมูลต้นทาง:

`/Users/nichada/Documents/Reference range Chem 13 July 26.numbers`

## ผลตรวจโครง SDForm

- JSON syntax (`jq empty`): ผ่าน
- `python3 check_sdform_json.py`: exit 0
- Nested audit เพิ่มเติม: 42 widgets, 42 IDs ไม่ซ้ำ, 42 `options.name` ไม่ซ้ำ,
  ไม่มี `widgetList`, ไม่มี options ที่ขาดเมื่อเทียบกับ exported templates
- `first_value` และ `second_value` เป็น `text-input`/String แล้ว
- ไม่มี `dynamic-input` ในไฟล์
- `source_document_name` และ `source_sheet` ถูกนำออกแล้ว

หมายเหตุ: validator หลักมองเห็นเฉพาะ root `tab` เพราะยังไม่ traverse `.tabs`; จึงรัน nested
audit แยกเพิ่ม Static checks ไม่ยืนยัน Builder/Preview/runtime หลัง re-import

## เหตุผลที่ยัง Import Numbers ตรง ๆ ไม่ได้

1. ต้นทางเป็น 659 flat rows แต่ฟอร์มเก็บประมาณ 132 parent records และแต่ละ record มี
   `reference_ranges` เป็น Sub Form array จึงต้อง group ก่อน import
2. ค่า Select ในฟอร์มไม่ตรงกับค่าต้นทาง:
   - เพศ: ฟอร์มใช้ `all_sex/female/male`; ต้นทางใช้ `ALL/F/M`
   - หน่วยอายุ: ฟอร์มใช้ `start_*`/`final_*`; ต้นทางใช้ `DAYS/MONTHS/YEARS/WEEKS`
   - operator: ฟอร์มใช้ token เช่น `Inclusive`, `lessthan`; ต้นทางใช้ข้อความ/เครื่องหมายจริง
   - range type: ฟอร์มใช้ `normal/critical`; ต้นทางใช้
     `NormalNumeric/CriticalNumeric/CustomNumeric`
3. `final_age_unit` ยังไม่มี `WEEKS` แต่ต้นทางมี 6 แถว
4. `range_type` ยังไม่มี `CustomNumeric` แต่ต้นทางมี 6 แถว
5. ต้นทางมี operator `-` หนึ่งแถว (Test 101000-TP, priority 2) ซึ่งยังไม่ทราบความหมาย
6. ต้นทางมี 18 แถวที่ Initial/Final age unit ว่าง แต่ฟอร์มตั้งทั้งสองช่องเป็น required
7. `firstValue` 659 ค่าและ `secondValue` 590 ค่าเป็น number ในต้นทาง แต่ปลายทางเป็น String;
   ไฟล์แปลงต้อง serialize เป็นข้อความโดยรักษารูปแบบที่แสดง
8. `range_unit_id` บันทึก `_id` จาก Unit Master แต่ต้นทางให้ unit symbol เท่านั้น
   - 418 แถว/9 รูปแบบตรงกับ symbol ในไฟล์ Unit Master แบบ exact
   - 240 แถว/12 รูปแบบไม่ตรงแบบ exact และต้องทำ mapping ที่ Lab ยืนยัน
   - 1 แถวไม่มีหน่วย
9. `lab_item` ต้อง resolve กับ Legacy/LIS Lab Test master ด้วย code; ยังไม่ได้ยืนยันว่า Test code
   ต้นทางทั้ง 132 กลุ่ม match master ได้ครบ

## Event ที่ติดมาจาก CPOE และไม่เหมาะกับฟอร์มนี้

- `service_type.onMounted/onChange` อ้าง `lab_box` และ `xray_box` ซึ่งไม่มีในฟอร์ม
- `section.onChange` อ้าง `sub_order` และค้น `lab_item` ใน Sub Form ทั้งที่ `lab_item` อยู่ root
- `lab_item.onChange` อ้าง Sub Form `lab_specimen` ซึ่งไม่มีในฟอร์ม
- `effective_from.onChange` และ `effective_to.onChange` คำนวณ field `age` ซึ่งไม่มี
- `is_active.onChange` อ้าง field `birth_order` ซึ่งไม่มีและไม่มี null guard

ต้องล้าง Event ที่ไม่เกี่ยวข้องและทำ event filter Section → Lab Test สำหรับฟอร์มนี้โดยเฉพาะก่อน
ทดสอบ Preview/runtime

## สถานะ

ไฟล์ผ่าน static schema checks แต่ยังไม่พร้อม import ข้อมูลและยังไม่ผ่านการยืนยัน re-import ใน
Builder/Preview/runtime
