# X-ray HN + Accession Sticker v2 — import และ UAT

สติ๊กเกอร์ PDF ระดับ X-ray item ตามภาพอ้างอิง ขนาดจริง **8.5 × 2 ซม.** เปลี่ยน
`DOB` เป็น `วันเกิด` และแสดงโรงพยาบาล, Accession No., ชื่อผู้ป่วย, วันเกิด,
อายุปี/เดือน/วัน, วันที่พิมพ์ และ HN

> **แพ็กเกจล่าสุด 19:00/19:10:** ใช้ live SQL/Report ID เดิม แก้ขนาดเป็น 8.5 × 2 ซม.,
> เปิดพิมพ์ก่อนมี Accession ได้ และแก้สูตรอายุไม่ให้จำนวนวันติดลบ ต้อง Restore SQL และ Report
> ชุดล่าสุดทั้งคู่ก่อน Restore Form

| ของ | ค่า |
|---|---|
| SQL | `X-ray HN Accession Sticker v1` |
| SQL ID live/ในแพ็กเกจล่าสุด | `6a980809422c1ca95982a053` |
| Report | `X-ray HN Accession Sticker 8.5x2 cm v2` |
| Report ID live/ในแพ็กเกจล่าสุด | `6a980831422c1ca95982a054` |
| Form เดิม | `6a953fb6422c1ca959829e14` |
| Parameters | `order_id`, `visit_id`, `item_id`, `printed_date` |

## อัปเดต live ตอนนี้

1. SQL Factory → Import SQL → **Restore Data (Upsert)**:
   `02-his/sql-factory/exports/backup-data_sql-factory_2026_09_02_19_00_00.zip`
2. Report Factory → Import Report → **Restore Data (Upsert)**:
   `02-his/report_factory/exports/backup-data_report-factory_2026_09_02_19_10_00.zip`
3. เปิด Report ID `6a980831422c1ca95982a054` แล้วตรวจ Data Source เป็น SQL ID
   `6a980809422c1ca95982a053`
4. Form Factory → Restore Data (Upsert):
   `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json`

แพ็กใหม่ใช้ `_id` ของ SQL/Report live เดิม จึงแก้ record เดิม ไม่เพิ่มรายการซ้ำ และ Form
ล่าสุดชี้ Report live ID นี้แล้ว

## Contract

- SQL อ่านจาก `zdata_cpoe_order_item` และ join Order + Visit เพื่อใช้ข้อมูลผู้ป่วยจริง
- กรองแบบ fail closed ด้วย Order, Visit และ item ที่กด; Accession No. ว่างได้
- ผลลัพธ์ไม่เกินหนึ่งแถว; ไม่มี SQL ตัวช่วยหา ID เพิ่ม เพราะปุ่มส่ง params ให้อัตโนมัติ
- Report เป็น custom landscape 240.9449 × 56.6929 pt, ไม่มี page number/date/footer
- วันเกิดแสดง `DD/MM/พ.ศ.`; อายุคำนวณเป็นปี เดือน วัน ณ วันที่พิมพ์
- ปุ่มอยู่คอลัมน์ท้ายของ item; กดได้ก่อนมี Accession และ disabled เมื่อยกเลิก/scope ไม่ครบ
- PDF ใบสั่งตรวจระดับ Order และ PDF ผลอ่านเดิมยังคงเงื่อนไขเดิม

## UAT หลัง Restore

1. เปิด X-ray Workbench และขยาย Order ที่ส่งเข้าเครื่องแล้ว
2. item ที่ยังไม่มี Accession ต้องกด `สติ๊กเกอร์ HN` ได้ และช่อง Accession ใน PDF ว่าง
3. item ที่มี Accession ต้องกดได้และ Preview ต้องได้หน้าเดียว 8.5 × 2 ซม.
4. เทียบชื่อ, HN, วันเกิด, อายุ และ Accession กับ item ที่กด ห้ามข้ามผู้ป่วย/ข้ามรายการ
5. ตรวจคำว่า `วันเกิด` และวันที่พิมพ์รูปแบบ `DD-MM-YYYY`
6. ทดสอบ Order ยกเลิกว่าปุ่มสติ๊กเกอร์ไม่สามารถพิมพ์ได้

ก่อน production ให้จำกัดสิทธิ์ SQL/Report สำหรับ role รังสีหลัง UAT ผ่าน; SQL ตั้ง
`public` ชั่วคราวเพื่อให้ Report Preview อ่าน data source ได้

## Verification ที่ทำแล้ว

- SQL/Report static contract ผ่าน
- exact NoQL pipeline ทดสอบแบบ read-only กับ X-ray item ที่มี Accession แล้วคืนหนึ่งแถว;
  อายุที่เคยเป็นวันติดลบแก้เป็นปี/เดือน/วันบวกแล้ว
- X-ray regression 8 ชุดและ Report contract เดิมผ่าน
- SDForm validator ผ่าน (เหลือ warning เดิมของ root scanner/template)
- ZIP ทั้งคู่มี JSON เดียว, integrity ผ่าน และ checksum ตรงกับ source JSON
- PDF preview 1 หน้า ขนาด 240.945 × 56.6929 pt และตรวจภาพแล้วไม่ตัดข้อความ
