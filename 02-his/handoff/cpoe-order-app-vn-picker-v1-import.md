---
type: reference
title: CPOE Order App · VN picker (clone v1) — import & test
created: 2026-09-03
updated: 2026-09-04
tags: [cpoe, vn, form, handoff]
---

# CPOE Order App + ช่องเลือก VN — ฟอร์มโคลนไว้ทดลอง

ผู้ใช้ขอ 2026-09-03: "เพิ่ม dropdown เลือก VN ที่เปิดภายในวันนั้น … จากตอนแรก VN จะโดนดึงมาจาก
EMR อันนี้ยังอยู่เหมือนเดิมนะ แต่ว่าแค่เพิ่มกล่องให้เลือก VN อีกช่องทางนึงเฉย ๆ"

## ไฟล์

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `Form-Builder/SDForm/form-factory/forms/cpoe-order-app-vn-picker-v1.json` | ฟอร์มโคลนที่จะ import ไปลอง |
| `Form-Builder/seed/tests-tools/scripts/build_cpoe_app_vn_picker.js` | ตัวสร้างไฟล์ข้างบนจาก `CPOE_app.json` (รันซ้ำได้) |
| `Form-Builder/API/tests-tools/tests/test_cpoe_app_vn_picker_form.js` | เทสว่าต่างจากต้นฉบับเฉพาะ VN picker + Hematology visual merge ที่อนุญาต |
| `Form-Builder/API/api-factory/processes/lab_cpoe_worklist_api.js` | **ต้อง replace body ด้วย** (เหตุผลด้านล่าง) |

ต้นฉบับ `Form-Builder/SDForm/sdform_module/EMR_form/CPOE_app.json` **ไม่ถูกแก้**

## สิ่งที่เปลี่ยนจริง

จอนี้ **มีช่องเลือก VN อยู่แล้ว** แต่ถูกซ่อนด้วย `v-if="manualMode()"` ⇒ เห็นเฉพาะตอนเปิดจาก
worklist (`params.manual_visit`) · เปิดจากเมนู EMR จะไม่เห็นเลย

1. `pt_header.content` — เอา `v-if="manualMode()"` ออกจากกล่อง picker · หัวข้อ/คำอธิบาย
   เปลี่ยนตามโหมด · เพิ่มแถบเตือนเมื่อ VN ที่ใช้อยู่ไม่ใช่ตัวที่ EMR ส่งมา
2. `pt_header.onCreated` — โหลด Visit วันนี้ได้ทุกโหมด · ล้างช่อง = คืน context เดิม
   (บอก `item_screen` ด้วย) · โชว์ VN ของ EMR เป็นค่าตั้งต้นในช่องถ้าอยู่ในรายการวันนี้
3. `pt_header.onMounted` — โหลดรายการ Visit ทุกโหมด
4. `formConfig.cssCode` — สไตล์แถบเตือน (`.cpoe-vn-override`) · CSS เดิมไม่ถูกแก้สักบรรทัด
5. `item_screen.content/onCreated` — เฉพาะภาพแท็บ Hematology: HM + HH รวมเป็นแท็บเดียว
   และมีหัวแบ่ง `HM · Hematology` / `HH · Hematology-Homeostasis` ในรายการ
   รหัสจริงในตะกร้ายังเป็น HM/HH แยกกัน; ไม่แก้ API หรือฟอร์มต้นฉบับ

## เส้นทางเดิมที่ยังเหมือนเดิม

- VN/คนไข้ยังมาจาก `field.params` ที่ EMR ส่งมาเป็นค่าเริ่มต้นเสมอ
- ลำดับการอ่าน context เดิม `เลือกเอง → $labCpoeContext → params` ไม่เปลี่ยน
- ไม่ได้เพิ่ม query ใหม่ในจอ · ใช้ Process เดิม `6a9434c3422c1ca959829d5e`
  action `list_open_visits` ตัวเดียวกับที่ LAB launcher ใช้อยู่

## ทำไมต้อง replace Process LAB ด้วย

`list_open_visits` เดิมอยู่ **ใต้** ด่าน "Organization นี้ไม่มี Section LAB" ทั้งที่ตัว query
ไม่ได้ใช้ Section เลย (กรองแค่ `visit_date` + `visit_status`) ⇒ ผู้ใช้ที่ไม่ได้อยู่ห้อง LAB
(หมอที่คลินิก, ห้องรังสี) จะถูกตัดจบก่อนถึง action แล้วได้ payload ของ `list` กลับไปแทน
จนกล่องเลือก VN ขึ้นว่า *"รูปแบบข้อมูล Visit ไม่ถูกต้อง"*

แก้โดย **ย้าย** action dispatch กับบล็อก `list_open_visits` ขึ้นมาไว้เหนือด่าน — ด่านเดิม
ยังอยู่ครบสำหรับ action อื่นทุกตัว (เทสคุมทั้งสองด้าน: หมอคลินิกขอ Visit ได้ · แต่ยังไม่เห็น
รายการ LAB) · อาการนี้กระทบปุ่ม "สร้างรายการใหม่" จากหน้า X-ray ที่มีอยู่เดิมด้วย

## วิธีลอง

1. Replace body ของ Process LAB worklist `6a9434c3422c1ca959829d5e`
2. Import `cpoe-order-app-vn-picker-v1.json` เป็นฟอร์มใหม่ (ได้ Form ID ใหม่ — ปุ่มเดิม
   ในระบบยังชี้ไปที่ `6a927860422c1ca959829d26` เหมือนเดิม ไม่กระทบของจริง)
3. เปิดฟอร์มโคลนจากเมนู EMR ของคนไข้สักคน:
   - [ ] การ์ดคนไข้ด้านล่างยังเป็นคนเดิมจาก EMR (ค่าเริ่มต้นไม่เปลี่ยน)
   - [ ] มีกล่อง "เลือก VN อีกช่องทาง" อยู่เหนือการ์ด · ค้นหาด้วย HN/VN/ชื่อได้
   - [ ] เลือก VN อื่น → การ์ดเปลี่ยนเป็นคนไข้นั้น · ตะกร้าที่ค้างอยู่ถูกล้าง ·
         มีแถบส้มเตือนว่ากำลังใช้ VN ที่เลือกเอง
   - [ ] กดกากบาทล้างช่อง → กลับไปเป็นคนไข้จาก EMR ทั้งหัวจอและจอสั่งรายการ
   - [ ] สั่งรายการแล้วบันทึก → ใบไปอยู่ใต้ VN ที่เห็นบนการ์ด (ตรวจที่ worklist)
4. เปิดจากปุ่ม "สร้างรายการใหม่" ของ worklist (โหมด manual):
   - [ ] ข้อความยังเป็น "เลือกผู้ป่วยที่เปิด Visit วันนี้" เหมือนเดิม
   - [ ] รายการ Visit ขึ้นครบ (เดิมจากห้องรังสีจะขึ้น error — ต้องหายไปแล้ว)

## เชื่อมกับปุ่ม "สร้างรายการใหม่" ของ X-ray

ปุ่มนี้เปิดฟอร์มตามค่า `CPOE_ORDER_APP_ID` ในวิดเจ็ต ซึ่งตั้งได้ตอน generate แล้ว
(ค่าเริ่มต้นยังเป็นฟอร์มจริง `6a927860422c1ca959829d26` ⇒ ไม่ตั้งอะไร = เหมือนเดิมทุกประการ)

```bash
XRAY_CPOE_ORDER_APP_ID=<Form ID ของโคลนหลัง import> \
  node Form-Builder/seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js
```

แล้ว import `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json` ทับ Form
`6a953fb6422c1ca959829e14` อีกครั้ง · ค่าที่ไม่ใช่ Form ID 24 ตัวอักษรจะล้มตั้งแต่ตอน generate
ไม่หลุดไปเงียบ ๆ ในฟอร์ม

- ปุ่มยังส่ง `manual_visit: true` และ `source: 'xray-worklist'` เหมือนเดิม ⇒ โคลนเปิดมาในโหมด
  เลือกผู้ป่วยเหมือนที่เคยเป็น เพียงแต่ตอนนี้ช่องเลือก VN ใช้ได้ทุกโหมด
- กลับไปใช้ฟอร์มจริงเมื่อไหร่ก็ generate ใหม่โดยไม่ต้องตั้ง env
- เทส `test_xray_cpoe_worklist_form.js` อ่าน Form ID จากฟอร์มที่ generate มา ไม่ผูกเลขตายตัว
  จึงไม่แดงเวลาสลับฟอร์มโดยตั้งใจ แต่ยังคุมว่า **ค่าเริ่มต้นในสคริปต์** ต้องเป็นฟอร์มจริง

## 2026-09-04 — ต่อปุ่ม X-ray เข้าโคลนแล้ว + แก้ VN dropdown ว่าง

ผู้ใช้ import โคลนเสร็จ ได้ Form ID **`6a995d064744260ea8c9498c`** และแจ้งว่า dropdown เลือก VN
ในฟอร์มนั้น "ไม่แสดงสักรายการ" ทั้งที่ Visit List วันนั้นมี 6 คิว

### 1. ปุ่ม "สร้างรายการใหม่" ของ X-ray ชี้ไปที่โคลนแล้ว

```bash
XRAY_CPOE_ORDER_APP_ID=6a995d064744260ea8c9498c \
  node Form-Builder/seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js
```

`Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json` ตอนนี้มี
`const CPOE_ORDER_APP_ID='6a995d064744260ea8c9498c';` — **ต้อง import ทับ Form
`6a953fb6422c1ca959829e14` อีกครั้ง** ปุ่มยังส่ง `manual_visit:true` +
`source:'xray-worklist'` เหมือนเดิม · กลับไปฟอร์มจริงเมื่อไหร่ก็ generate ใหม่โดยไม่ตั้ง env

### 2. ทำไม dropdown ว่าง — query ไม่ตรงกับ Visit List

คำตอบตรง ๆ ของคำถาม "ดึง vn ต่อวันตาม Visit List ยัง": **ยังไม่ตรง**

| | Visit List (จอ Patient) | `list_open_visits` เดิม |
|---|---|---|
| Collection | `zdata_visit_tran` (form `6a461235e521219e514d1c4b`) | `zdata_visit` |
| กรองวัน | `` `visit_date` = DATE_TO_STRING(DATE_ADD(CURRENT_DATE(),'hour',7),'%Y-%m-%d') `` | `visit_date` **เท่ากันเป๊ะ** กับ `'YYYY-MM-DD'` |
| กรองสถานะ | `vtran_status IN ('waiting','called','in_progress')` | `visit_status: true` |

ที่มาของจอ Visit List: `Form-Builder/SDForm/sdform_module/patient.json` →
`visit_list` ListView (`where` ตามตารางข้างบน)

จุดที่ทำให้ได้ 0 แถวเงียบ ๆ: `visit_date` ในฟอร์ม Visit เป็น `date-input` **`dateType: "datetime"`**
(`Form-Builder/SDForm/sdform_module/visit.json`) ⇒ ค่าที่เก็บจริงอาจมีเวลาต่อท้าย
เช่น `'2026-09-04 08:30'` ซึ่ง `=` กับ `'2026-09-04'` ไม่มีวันตรง

### 3. แก้แล้วใน `lab_cpoe_worklist_api.js` (2 ชั้น ของเดิมไม่ได้ถูกลบ)

1. **ชั้นแรก (ใหม่)** — อ่านคิววันนี้จาก `zdata_visit_tran` ด้วยสถานะชุดเดียวกับ ListView
   (`waiting|called|in_progress`) + วันนี้ (`visit_date` หรือ `checkin_at`) แล้วดึง Visit
   ตาม `vid.value` ที่ได้ ⇒ เห็นชุดเดียวกับกล่อง "ผู้มารับบริการวันนี้" (dedupe ตาม VN แล้ว)
2. **ชั้นสอง (ของเดิม)** — ถ้าชั้นแรกไม่ได้อะไร ยัง query `zdata_visit` เหมือนเดิม แต่ผ่อน 2 จุด:
   `visit_date` เทียบเป็นช่วงวัน (`$gte` วันนี้ / `$lt` พรุ่งนี้) และ `visit_status: {$ne:false}`
3. response เพิ่ม `source` (`visit_tran` / `visit_day`) และ `visit_tran_total`
   ฟอร์มโคลนเอาสองค่านี้ไปต่อท้ายข้อความตอนไม่มีรายการ ⇒ หน้าจอบอกได้เองว่าชั้นไหนตอบ

**ต้อง replace body ของ Process `6a9434c3422c1ca959829d5e` อีกครั้ง** แล้ว import ฟอร์มโคลนทับ
`6a995d064744260ea8c9498c`

## ที่ยังไม่ได้ทำ

- ยังไม่มีการยืนยันใน Builder/Preview และ runtime จริงว่าชั้น Visit Tran คืนแถวจริง —
  ยังไม่ได้เปิด DB อ่านว่า `zdata_visit.visit_date` เก็บมีเวลาต่อท้ายจริงหรือไม่
  (สรุปข้างบนอ่านจาก form JSON + where ของ ListView เท่านั้น)
- ยังไม่ตัดสินใจว่าจะย้ายช่องเลือก VN เข้า `CPOE_app.json` ตัวจริงหรือไม่

## 2026-09-04 — Hematology รวมแท็บเฉพาะหน้าจอ

- ต้อง import JSON ทับ Form `Cpoe_test_order` ID `6a995d064744260ea8c9498c`
- เมื่อ catalog มีทั้ง HM และ HH แถบ Section จะเหลือ `HM / HH · Hematology` แถวเดียว
- รายการด้านขวาแบ่งด้วยหัว `HM · Hematology` และ
  `HH · Hematology-Homeostasis`; lab_group และกติกาชุดตรวจเดิมยังอยู่ครบ
- ถ้า scope คืนมาแค่ HM หรือ HH ห้องเดียว จอจะไม่รวมเป็นแท็บเสมือน
- เทสจำลองยืนยันว่าตะกร้าเก็บ `HM`/`HH` จริง และ section อื่นไม่ถูกรวม
- ผ่าน generator, form regression, LAB scope regression และ SDForm validator;
  ยังต้องยืนยันภาพจริงหลัง import/hard-refresh

## 2026-09-09 — สิทธิ์ต้องตาม Visit ที่เลือก

- แก้ `item_screen` ให้ dropdown สิทธิ์อ่าน `inscl_hos` จาก patient/Visit context ปัจจุบัน
  จุดเดียวกับข้อมูลที่ทำให้หัวฟอร์มแสดง `✓ OFC` ไม่อ่านจาก `params` ตอนเปิด popup อย่างเดียว
- เมื่อเปลี่ยน Visit จะกลับไปเลือกสิทธิ์แถวแรกของ Visit ใหม่ ป้องกัน index ของคนก่อนค้าง
- ต้อง import JSON ทับ Form `Cpoe_test_order` ID `6a995d064744260ea8c9498c` แล้วปิด popup/
  hard-refresh ก่อนทดสอบใหม่
- การคำนวณราคาตามสิทธิ์ไม่ได้เปลี่ยนในรอบนี้; master ที่มีแต่ STD ยังใช้ราคามาตรฐานตามเดิม
