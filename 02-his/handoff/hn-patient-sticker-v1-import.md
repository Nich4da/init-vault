---
type: reference
title: ป้ายติดแฟ้ม (HN) — SQL + Report v1 · import & test
created: 2026-09-04
updated: 2026-09-04
tags: [report-factory, sql-factory, hn, sticker, lab, xray, handoff]
---

# ป้ายติดแฟ้ม (HN) — สติ๊กเกอร์ผู้ป่วย ค้นด้วย HN อย่างเดียว

ผู้ใช้ขอ 2026-09-04 จากต้นแบบ `backup-data_report-factory_2026_09_04_09_02_51.zip`
(Report `ป้ายติดแฟ้ม (VN)` id `06b8f72c39fdde6064981a4e`) และยืนยันเนื้อหาว่า

> "ไม่ต้องเอาข้อมูลไรเลย เกี่ยวกับ lab /xray เอาแค่ hn ข้อมูลผู้ป่วย วาร์ดต้นทาง บาร์โคเด hn"

**รอบนี้ทำแค่ SQL + Report** ยังไม่แตะปุ่มใด ๆ ตามที่สั่ง

## ของใหม่

| ของ | ค่า |
|---|---|
| SQL | `HN Patient Sticker v1` |
| SQL ID | `6a9a355c422c1ca95982a1a1` |
| Report | `ป้ายติดแฟ้ม (HN)` |
| Report ID | `6a9a355c422c1ca95982a1a2` |
| Parameter | `hn` (required) — ตัวเดียวเท่านั้น |
| ขนาด | custom landscape **247 × 67 pt** (เท่าต้นแบบ VN เป๊ะ) · margin 1/1/4/3 · font 11 |
| Data source | `zdata_visit` (Form `6a40fdec4b6dfdf45acbfbce`) |

`_id` ทั้งคู่เป็นเลขใหม่ที่ยังไม่มีใน live ⇒ Restore (Upsert) **สร้างรายการใหม่ ไม่ทับของเดิม**

## ไฟล์

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `02-his/sql-factory/exports/backup-data_sql-factory_2026_09_04_10_00_00.zip` | **import ตัวนี้ก่อน** |
| `02-his/report_factory/exports/backup-data_report-factory_2026_09_04_10_05_00.zip` | import ตามหลัง |
| `Form-Builder/SDForm/sql-factory/exports/backup-data-module_sql-Earn_admin-2026_09_04_10_00_00.json` | JSON ต้นทางของ zip |
| `Form-Builder/SDForm/report_factory/exports/backup-data-module_report-Earn_admin-2026_09_04_10_05_00.json` | JSON ต้นทางของ zip |
| `Form-Builder/API/report_factory/builders/build_hn_patient_sticker.js` | ตัวสร้างทั้งคู่ (รันซ้ำได้) |
| `Form-Builder/API/report_factory/tests/test_hn_patient_sticker.js` | เทสสัญญา |

## หน้าตาป้าย

```
┌────────────────────────────────────────────────┐
│ น.ส.ดำ ใจดี                    19.p คลินิกวัคซีน │
│ HN 6900001                                     │
│ วันเกิด : 19/07/2561                            │
│ อายุ 8 ปี 1 เดือน 15 วัน           หญิง B        │
│                            ▌▌▌▐▌▐▌▌▐▌▌▐▌▌▌▐▌   │
└────────────────────────────────────────────────┘
```

ซ้าย 60% · ขวา 40% · บาร์โค้ด CODE128 ของ **HN** ชิดขวา (width 70, height 8, mt −16)
เหมือนต้นแบบทุกค่า ต่างแค่ผูก HN แทน VN

ตัวแปรที่ SQL คืน: `hospital_name` `hn` `patient_name` `birth_date_display` `age_display`
`gender_text` `blood_group` `ward_display`

## Contract

- **filter จับแค่ `hn`** — pipeline ใช้ `{{hn}}` ตัวเดียว ไม่มีพารามิเตอร์อื่นเลย
  ⇒ ปุ่ม HN ของ LAB และ X-ray เรียกตัวเดียวกันได้
- **ห้ามมีข้อมูล LAB/X-ray** — ไม่มี order/item/accession/LAB NO./section/modality
  ทั้งใน pipeline และในเนื้อรายงาน (เทสบังคับด้วย token list)
- ฐานข้อมูลเป็น `zdata_visit` ไม่ใช่ `zdata_person` เพราะ "วาร์ดต้นทาง" อยู่ที่ Visit
  (`zdata_person` ไม่มีแผนก/คลินิก) และ `pid` บน Visit เป็น snapshot ผู้ป่วยครบอยู่แล้ว
- **HN ที่มีหลาย Visit:** เรียง Visit ที่ยัง `visit_status` เปิดอยู่ก่อน แล้วจึงเอาวันล่าสุด
  (`_open_rank` → `visit_date` → `created_at`) และปิดท้ายด้วย `$limit 1` ⇒ ได้แถวเดียวเสมอ
- วันเกิดแสดง `DD/MM/พ.ศ.`; อายุคิดเป็น ปี/เดือน/วัน ณ เวลาพิมพ์ ด้วยสูตรเดียวกับ
  X-ray HN sticker ที่ผ่าน UAT แล้ว (ลดปี/เดือนที่ยังไม่ครบก่อน ⇒ ไม่มีวันติดลบ)
- `ward_display` = `ward.label` → `visit_clinic.label` → `visit_clinic.value` → `''`
  (fallback สุดท้ายเป็น `.value` ไม่ใช่ตัว object ไม่งั้นป้ายจะพิมพ์ `[object Object]`)
- `sql_share: public` เพื่อให้ Report Preview อ่าน data source ได้; จำกัดสิทธิ์หลัง UAT ผ่าน
- ไม่มี page number / print date / footer

## ของเดิมที่ไม่ถูกแตะ

- Report `5256d813009293b480d0a15c` "ป้ายติดแฟ้ม" ที่ปุ่ม HN ปัจจุบันของ LAB/X-ray เรียกอยู่
  ยังทำงานเหมือนเดิมทุกประการ (ยังส่ง `xparentx` = Visit ID)
- SQL `6a980809422c1ca95982a053` / Report `6a980831422c1ca95982a054`
  "X-ray HN Accession Sticker" ระดับ item — คนละใบ คนละพารามิเตอร์ ไม่ถูกแก้
- เทสบังคับว่า `_id` ใหม่ต้องไม่ชนกับสาม ID ข้างบน

## วิธี import และตรวจ

1. SQL Factory → Import → **Restore Data (Upsert)**:
   `02-his/sql-factory/exports/backup-data_sql-factory_2026_09_04_10_00_00.zip`
2. Report Factory → Import → **Restore Data (Upsert)**:
   `02-his/report_factory/exports/backup-data_report-factory_2026_09_04_10_05_00.zip`
3. เปิด Report `6a9a355c422c1ca95982a1a2` แล้วตรวจว่า Data Source เป็น SQL
   `6a9a355c422c1ca95982a1a1`
4. กด Preview แล้วใส่ HN ของคนไข้ที่เปิด Visit วันนี้ (เช่น `6900001`)
   - [ ] ได้ PDF หน้าเดียว ขนาด 247 × 67 pt
   - [ ] ชื่อ · HN · วันเกิด (พ.ศ.) · อายุ ปี/เดือน/วัน ตรงกับ EMR
   - [ ] มุมขวาบนเป็นวาร์ด/คลินิกต้นทางของ Visit ปัจจุบัน
   - [ ] มุมขวาล่างเป็น เพศ + หมู่เลือด
   - [ ] บาร์โค้ดสแกนแล้วได้ HN ไม่ใช่ VN
   - [ ] ข้อความไม่ล้นขอบป้าย
5. ลอง HN ที่มีหลาย Visit → ต้องได้วาร์ดของ Visit ที่ยังเปิดอยู่
6. ลอง HN ที่ไม่มีอยู่จริง → ต้องได้รายงานว่าง ไม่ใช่ข้อมูลของคนอื่น

## แก้รอบที่ 2 — 2026-09-04 (Preview ออกมาขาวทั้งใบ)

Preview ครั้งแรกได้หน้าเดียวขนาดถูกต้องแต่ **ว่างสนิท** ⇒ SQL คืน 0 แถว ไม่ใช่ปัญหาเลย์เอาต์
(ถ้ามีแถวแต่ค่าว่าง จะยังเห็นตัวอักษรคงที่ `HN` / `วันเกิด :` / `อายุ` ที่อยู่ในเทมเพลต)

ต่างจาก pipeline ที่ผ่าน runtime แล้วทุกตัวในรีโปนี้ตรงที่ **ของเดิม `$match` กับ dotted path
โดยตรง** (`'pid.hn': '{{hn}}'`) ขณะที่ X-ray HN sticker สร้าง alias ระดับบนสุดด้วย `$addFields`
ก่อนเสมอ แล้วจึง `$match` กับ alias นั้น (`_order_key` / `_item_key` / `_visit_key`)

แก้เป็นแบบเดียวกัน:

```
{"$addFields":{"_hn_key":{"$trim":{"input":{"$toString":{"$ifNull":["$pid.hn",""]}}}}}}
{"$addFields":{"_hn_key_prefixed":{"$concat":["HN","$_hn_key"]}}}
{"$match":{"xrstatx":{"$nin":[0,3]},"$or":[{"_hn_key":"{{hn}}"},{"_hn_key_prefixed":"{{hn}}"}]}}
```

- `$toString` เผื่อบางแถวเก็บ `hn` เป็นตัวเลข · `$trim` กันช่องว่างติดมา
- `_hn_key_prefixed` ทำให้พิมพ์ได้ทั้ง `6900001` และ `HN6900001` (หน้าจอโชว์แบบมีคำนำหน้า)
  ทั้งสองทางชี้ผู้ป่วยคนเดียวกัน จึงไม่ได้ทำให้กรองหลวมข้ามคน
- assertion เดิมที่ล็อก `"pid.hn":"{{hn}}"` ถูกเปลี่ยนพร้อมคอมเมนต์ลงวันที่ · สิ่งที่มันปกป้อง
  (กรองด้วย HN เท่านั้น) ยังถูกล็อกครบผ่าน assertion ชุดใหม่

**ถ้ายังว่างอีก** ให้แยกชั้นก่อน: เปิด SQL Factory → รัน `HN Patient Sticker v1` ใส่ `hn` = `6900001`
- ได้ 1 แถว ⇒ ปัญหาอยู่ที่ Report binding (เช็คว่า Data Source ชี้ SQL ID ถูก และชื่อ variable ตรง)
- ได้ 0 แถว ⇒ ปัญหาอยู่ที่ค่า/ที่อยู่ของ HN ⇒ ส่งผลลัพธ์ของ pipeline สั้น ๆ นี้มาให้ดู
  `[{"$limit":3},{"$project":{"vn":1,"visit_date":1,"pid.hn":1}}]`

## เชื่อมปุ่ม HN ของ X-ray แล้ว — 2026-09-04

ผู้ใช้ยืนยันว่า Preview ผ่านแล้ว และสั่ง: *"ไอดี report `6a9a355c422c1ca95982a1a2` เอาไป
เชื่อมกับปุ่ม PDF HN แทนของเดิมเลย xray อ่ะ"* ⇒ **เปลี่ยนเฉพาะหน้า X-ray**

| | ก่อน | หลัง |
|---|---|---|
| Report ที่ปุ่มเรียก | `5256d813009293b480d0a15c` (ป้ายติดแฟ้ม/VN) | `6a9a355c422c1ca95982a1a2` (ป้ายติดแฟ้ม HN) |
| Parameter ที่ส่ง | `xparentx` = Visit ID ของ Order ที่กด | `hn` ของ Order ที่กด |
| เงื่อนไข disabled | Order ไม่มี Visit ID | Order ไม่มี HN |
| ข้อความ tooltip | "Order นี้ไม่มี Visit ID สำหรับสร้าง HN PDF" | "Order นี้ไม่มี HN สำหรับสร้างป้ายติดแฟ้ม" |

⚠️ ไม่ใช่แค่เปลี่ยนเลข Report — ป้ายใหม่รับ `hn` อย่างเดียว ถ้าเปลี่ยนแต่ ID แล้วยังส่ง
`xparentx` ต่อ ป้ายจะออกมาว่างทุกใบ จึงต้องเปลี่ยน `hnOrderReportReady` / `hnOrderReportParams`
พร้อมกันเสมอ

ผลพลอยได้: Order ที่ไม่มี Visit ID แต่มี HN ตอนนี้พิมพ์ป้ายได้แล้ว (เดิม disabled)

ไฟล์ที่แก้:
- `Form-Builder/seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js` (`defaultHnOrderReportId`
  + `hnOrderReportReady` + `hnOrderReportParams` + tooltip)
- `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json` (generate ใหม่ · ยังคง
  `CPOE_ORDER_APP_ID='6a995d064744260ea8c9498c'` จากงานเมื่อวานไว้)
- `Form-Builder/API/tests-tools/tests/test_xray_cpoe_worklist_form.js` (assertion เดิมเปลี่ยน
  พร้อมคอมเมนต์ลงวันที่)
- `Form-Builder/SDForm/X-ray/spec.md` · `design/Xray_design.md`

### LAB ย้ายตามแล้ว — 2026-09-04 (ผู้ใช้สั่ง "เอาเข้า lab ให้ด้วย ห้ามแตะส่วนอื่นนะ")

เปลี่ยนใน `update_lab_cpoe_worklist_ui.js` แบบเดียวกันเป๊ะ ต่างแค่ที่อยู่ของ HN:
LAB อ่านจาก `order.patient.hn` (X-ray ใช้ `row.hn`)

| | ก่อน | หลัง |
|---|---|---|
| Report | `5256d813009293b480d0a15c` | `6a9a355c422c1ca95982a1a2` |
| Parameter | `xparentx` = `s.orderVisitId(o)` | `hn` = `o.patient.hn` |
| disabled เมื่อ | ไม่มี Visit ID | ไม่มี HN |

**พิสูจน์ว่าไม่ได้แตะส่วนอื่น:** เทียบ JSON ก่อน/หลัง generate แบบ field-by-field แล้วมี
**2 ฟิลด์เท่านั้น** ที่เปลี่ยน (`options/content` = ข้อความ tooltip · `options/onCreated` =
Report ID + สองฟังก์ชัน) นอกนั้นเหมือนเดิมทุกไบต์ · `s.orderVisitId` ยังอยู่ครบเพราะ
EMR History และ PDF ใบสั่งตรวจยังใช้อยู่ (เทสล็อกไว้)

`xray-cpoe-worklist-v1.json` generate ใหม่หลัง LAB เปลี่ยน (LAB JSON เป็น template ของมัน)
แล้ว diff ออกมา **ไม่ต่างเลยสักไบต์** ⇒ การแก้ LAB ไม่รั่วไปหน้า X-ray

ตอนนี้ **ไม่มีโค้ด/ฟอร์มไหนเรียก `5256d813009293b480d0a15c` แล้ว** — จะลบก็ได้ แต่แนะนำให้
เก็บไว้จนกว่า UAT ทั้งสองหน้าจะผ่าน เผื่อต้องย้อนกลับ

ต้อง import: Form Factory → Restore (Upsert)
`Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json` ทับ Form LAB Worklist เดิม

### ต้องทำในระบบ

Form Factory → Restore Data (Upsert): `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json`
ทับ Form `6a953fb6422c1ca959829e14`

UAT: เปิด X-ray Workbench → กดปุ่ม `HN` ที่แถว Order
- [ ] ได้ป้าย 247 × 67 pt ของผู้ป่วยแถวนั้น ไม่ข้ามคน
- [ ] Order ที่ยกเลิกแล้วยังไม่มีปุ่ม
- [ ] แถวที่ไม่มี HN ปุ่มเป็น disabled พร้อม tooltip ใหม่
- [ ] ปุ่ม `PDF` ใบสั่งตรวจ และ `สติ๊กเกอร์ HN` ระดับ item ยังทำงานเหมือนเดิม
- [ ] ปุ่ม HN ของหน้า **LAB** ยังได้ป้ายแบบเดิม (VN) ไม่เปลี่ยน

## Verification ที่ทำแล้ว

- เทสสัญญา `test_hn_patient_sticker.js` ผ่าน: param เดียวคือ `hn` · ไม่มี token ของ LAB/X-ray
  ทั้งใน pipeline และเนื้อรายงาน · ทุก `{{tag}}` มี alias จริงใน SQL · ขนาด/ขอบตรงต้นแบบ ·
  `_id` ไม่ชนกับ record ที่ live อยู่ · ไฟล์ export ตรงกับ builder
- Report suite เดิมผ่านครบ: X-ray HN sticker, X-ray/LAB Order Request, Result Report viewer
  (`test_result_report_viewer_manual_lis` ต้องรันจากโฟลเดอร์ `form-factory/forms` ตาม path
  สัมพัทธ์เดิมของมัน — รันจากที่นั่นแล้วผ่าน)
- ZIP ทั้งคู่มี JSON เดียว integrity ผ่าน และ checksum ตรงกับ JSON ต้นทาง

## ที่ยังไม่ได้ทำ

- ยังไม่ได้ UAT ปุ่ม HN ในระบบจริงทั้งสองหน้า — ต้อง import ฟอร์มทั้ง LAB และ X-ray ก่อน
- ยังไม่มี runtime evidence: ไม่มี MongoDB ให้รัน pipeline ในเครื่องนี้ · Preview รอบแรก
  คืน 0 แถว และแก้ตามข้างบนแล้ว แต่ยังไม่ได้ยืนยันว่ารอบสองคืนแถวจริง
- ถ้าต้องการให้ "วาร์ดต้นทาง" ผูกกับ Visit ของ Order ที่กด แทนที่จะเป็น Visit ล่าสุดของ HN
  ต้องเพิ่มพารามิเตอร์ `visit_id` (optional) — ตอนนี้ยังไม่ได้ใส่ เพราะผู้ใช้ระบุว่า filter แค่ HN
