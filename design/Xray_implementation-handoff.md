# X-ray SDForm Implementation Handoff

Updated: 2026-08-31

## Read first

0. `Form-Builder/SDForm/X-ray/design.md` แล้วต่อด้วย `spec.md` — เอกสารตั้งต้นในโฟลเดอร์ทำงาน
1. `design/Xray_design.md`
2. `design/Xray_design-contract.md`
3. `02-his/ui/xray-workbench-mockup.html`
4. `design/Lab_design.md` — ต้นฉบับระบบภาพ ห้าม re-derive ค่าใหม่
5. `design/lab-cpoe-integration-checklist.md` — สถาปัตยกรรมอ่านตรงจาก CPOE
6. ก่อนแก้ JSON: `02-initcraft/governance/from-codex-backup/SDFORM_JSON_RULES.md`

## Build constraints

- Working location: **`Form-Builder/SDForm/X-ray/`** (ผู้ใช้อนุมัติและสร้างแล้ว 2026-08-31)
  ในโฟลเดอร์มี `design.md` (สรุปกติกาก่อนสร้าง) และ `spec.md` (สเปกไฟล์ JSON ตัวจริง)
  ห้ามแก้ `../backup/` และ `../best-practices/`
- ใช้ palette/typography/spacing/component dimension จาก `Lab_design.md` ตรง ๆ
- Toolbar เรียง `ค้นหา · Date Range · เครื่อง · Search · Report · สร้างรายการใหม่`
- Filter chip สี่ตัวเท่านั้น และตัวเลขต้องนับภายใต้ตัวกรองเครื่องปัจจุบัน
- ห้ามมีคอลัมน์ specimen, Lab No. หรือด่านตรวจ specimen ก่อนส่งเครื่อง
- **1 order = 1 accession = 1 test** — ห้ามออกแบบใบที่มีหลาย test หรือ action ระดับ item
- **เลขสองชุด** (Appendix F): `Order No.` มาจาก CPOE (`20260831011`) · `Accession No.`
  ห้องรังสีออกเองตอนส่งเข้าเครื่อง อยู่ระดับ test (`20260831CT001`) running แยกตาม modality
  และแยกตามวัน ทั้งคู่ต้องมาจาก server ห้ามคำนวณที่หน้าจอ
- เครื่องผูกมากับ test ตั้งแต่ตอนสั่ง — ไม่ต้องมี UI สำหรับกรณี "ไม่ระบุเครื่อง"
- ขอบเขตหน่วยงาน enforce ที่ server แบบ fail-closed; dropdown เครื่องเป็นตัวกรองการแสดงผลเท่านั้น
- แยก Order, รายการตรวจ, Technical Receipt, Report และ Result Item เป็นคนละ record
- ห้ามฝังข้อมูลผู้ป่วยจริง credential URI หรือค่า environment
- ห้ามผูก Agent behavior ที่ยังไม่เคาะ (D-X1 ถึง D-X9) เหมือนว่าเป็นข้อสรุปแล้ว

## รอบที่ 1 — ที่ผู้ใช้สั่งไว้: แสดงรายการจาก CPOE ให้ได้ก่อน

สิ่งที่ artifact แรกต้องพิสูจน์:

1. Worklist query อ่าน `zdata_cpoe_order_item` ที่ `service_type='xray'` แล้ว join
   `zdata_cpoe_order` และ group กลับเป็นหนึ่ง Order พร้อม `items[]`
2. Dropdown เครื่อง 19 ค่า ค่าเริ่มต้น `Select all` กรองทันที คงค่าเมื่อเปลี่ยน chip/หน้า
   และตัวเลข chip เปลี่ยนตาม
3. แถว Order ขยาย/ย่อได้โดยไม่เสียคอลัมน์ และ dropdown render เหนือแถวข้างเคียง
4. Search และ Date Range ทำงานตาม `Xray_design.md` Appendix B
5. รายการที่ไม่มีเครื่องปลายทางถูก flag ว่าข้อมูลไม่ครบ ไม่ใช่เดาค่า
6. ทุก popup/action ได้รับ Order/Item ID ที่เสถียร ไม่อ่าน state จาก DOM
7. EMR เปิดได้ทุกสถานะ

## รอบที่ 2 — หลังเคาะ D-X1 / D-X3 / D-X4

1. `xray-cpoe-dispatch` API: บันทึกเวลารับ/ผู้รับ → เรียก Agent นอก transaction →
   เก็บ transport outcome โดย **ไม่ rollback** การรับเมื่อ Agent ล้มเหลว
2. ปฏิเสธรายการ (ครั้งละ 1) และยกเลิกทั้ง Order (atomic) เป็นคนละ action คนละ audit
3. `ตรวจใหม่` สร้าง Order ใหม่ที่ลิงก์กลับรายการเดิม ห้ามแก้/ลบประวัติ
4. แท็บผลอ่านตาม schema ที่ยืนยันแล้ว (D-X6) และปุ่ม `ดูภาพ` ต่อกับ RIS ตาม contract (D-X17)

## Verification

- รัน `python3 Form-Builder/seed/tests-tools/validators/check_sdform_json.py <candidate.json>`
- static validation ไม่ใช่หลักฐาน runtime — ต้องตรวจ Builder/Preview สำหรับ layout
  และ deployed runtime สำหรับ workflow/data
- ก่อนอ้างว่าพร้อม production ต้องรัน HIS → Agent → เครื่อง → Agent → HIS จริงหนึ่งรอบ
  ครอบคลุมกรณีสำเร็จ, ส่งไม่สำเร็จแล้วลองใหม่, ปฏิเสธ, ยกเลิก และผลซ้ำ

## ของที่ยังขาดและต้องขอจากผู้ใช้

- ไฟล์ draw.io ของกรอบงาน X-ray (export เป็น `.drawio`/`.png` เข้ามาที่ `02-his/draw_design/`)
  — ลิงก์ Google Drive ที่ส่งมาเปิดอ่านจากที่นี่ไม่ได้
- ที่มาที่แท้จริงของรายการเครื่อง 19 ค่า (section ของหน่วยรังสี, master เครื่องแยก หรือ enum)
- code เครื่องจริงของ 10 ค่าที่ไม่มีใน `modality_type` (D-X14) — mockup ใช้ค่าสมมติอยู่
- ยอมรับความยาว accession ที่ไม่คงที่ 13–15 ตัวหรือไม่ (D-X15) และตัวพิมพ์ของ code (D-X16)
- guard เมื่อ running ของ modality ใดเต็ม 999 ในวันเดียว (D-X12)
- ชื่อ field รหัสส่งตรวจขาออกของ X-ray ใน `zdata_master_item_order`
- โครงสร้างผลอ่านที่ Agent/PACS จะส่งกลับ
- contract ของโปรแกรม RIS สำหรับปุ่ม `ดูภาพ` (deep-link ด้วย accession, สิทธิ์, วิธีเปิด)
