---
type: spec
title: X-ray Workbench SDForm — Build Spec
created: 2026-08-31
updated: 2026-09-24
tags: [xray, sdform, spec, worklist]
---

# X-ray Workbench SDForm — Build Spec

สเปกสำหรับสร้างไฟล์ JSON ตัวจริง อ่าน `design.md` ในโฟลเดอร์นี้ก่อน

**ห้ามเริ่มก่อนอ่าน** `../../../02-initcraft/governance/from-codex-backup/SDFORM_JSON_RULES.md`

---

## 0. ID ที่ deploy แล้ว

| ของ | ID |
|---|---|
| Form · X-ray Workbench (`xray-cpoe-worklist-v1.json`) | `6a953fb6422c1ca959829e14` |
| Form · RIS Order (`xray_order.json` → `zdata_xray_order`) | `6a8f1ea97632d182ef6914fd` |
| Form · **RIS Result Log** (`xray_result_log.json` → `zdata_zdata_xray_result_log`) | `6a860980f851000f28e44ab0` |
| Form · RIS Result — ฉบับปัจจุบัน (`xray_result.json` → `zdata_xray_result`) | `6aa180f009c1bad08952da58` |
| Form · RIS Result Reset (`xray_resultreset.json`) | `6a95b663422c1ca959829e87` |
| Form · RIS Schedule (`xray_schedule.json` → `zdata_xray_schedule`) | `6a86090df851000f28e44aaf` |
| Form · RIS Order Status Change (`xray_order_status_change.json` → `zdata_xray_order_status_change`) | `6a9eeef2a8772e80309592e3` |
| Form · บันทึกการใช้สารทึบรังสี (`xray-contrast-media-record-v1.json`) | `6aa2424809c1bad08952da71` — import แล้ว · **ยังไม่ยืนยันว่า Builder เรนเดอร์ครบ** (แก้ checkbox 2026-09-10 ต้อง import ทับแล้วดูอีกรอบ) |
| Form · คลังหนังสือยินยอม (`xray-consent-document-library-v1.json`) | `6aab93911c5232627d0c6ee1` — ผู้ใช้ยืนยันการใช้งานคลัง/พรีวิว/พิมพ์บน HIS 2026-09-17; ไม่มีหลักฐานเคสใบลงนามผูกผู้ป่วย |
| Process · order status change (ขาเข้า RIS→HIS) | `6a861d99f851000f28e44ab2` |
| Process · worklist (`list` · `get_report` · `cancel_order`) | `6a957009422c1ca959829e45` |
| Process · LAB worklist สำหรับแท็บสืบค้นแบบอ่านอย่างเดียว (`list` · `get_manual_result`) | `6a9434c3422c1ca959829d5e` |
| Process · dispatch | `6a967029422c1ca959829edc` |
| Process · accession | `6a95cd58422c1ca959829e8d` |
| Process · reject ราย item | ยังไม่ deploy |
| Report · X-ray Order Request v1 | `6a97f826422c1ca95982a048` |
| Report · ป้ายติดแฟ้ม (HN) (ปุ่ม HN ระดับ Order) | `6a9a355c422c1ca95982a1a2` |
| SQL · X-ray HN Accession Sticker v1 (live Clone) | `6a980809422c1ca95982a053` |
| Report · X-ray HN Accession Sticker 8.5x2 cm v2 (live Upsert) | `6a980831422c1ca95982a054` |

> 🔴 **ทีมแยกตารางผลอ่านเป็นสองชั้นแล้ว 2026-09-09 22:45–23:11 (เรารู้ 2026-09-16)**
> ยืนยันจาก `sdform_manage` แบบ read-only:
> - ฟอร์มเดิม `6a860980f851000f28e44ab0` ถูก **เปลี่ยนชื่อเป็น `xray_result_log`**
>   ตารางกลายเป็น `zdata_zdata_xray_result_log` — **เก็บทุกข้อความที่ RIS ยิงเข้ามา**
>   (มี `ResultId` เป็นลำดับที่ Result API ออกให้) ⇒ นี่คือประวัติผลอ่านตัวจริง
> - ฟอร์ม **ใหม่** `6aa180f009c1bad08952da58` ชื่อ `xray_result` ตาราง `zdata_xray_result`
>   **ไม่มีฟิลด์ `ResultId`** และถูก **upsert ทับแถวเดิม** ต่อ 1 Accession ⇒ เป็น "ฉบับปัจจุบัน"
> ⇒ ข้อสรุปเดิมใน `ris-integration-plan.md` §B1 ที่ว่า *"insert ทุกครั้ง ไม่ upsert"* **ล้าสมัยแล้ว**
> ⇒ `xray_resultreset.js` ยังตั้ง `RESULT_FORM_ID = '6a860980f851000f28e44ab0'` ซึ่งตอนนี้ชี้ไปที่
>   **ฟอร์ม log** แต่สั่ง `dbUpdate` ลง `zdata_xray_result` ⇒ หา `_id` จากคนละตาราง **เส้นทางถอนผลพัง**
>   (ไฟล์ของทีม — แจ้งอย่างเดียว ห้ามแก้เอง)
> ⇒ ฟีเจอร์ "ประวัติการแก้" ต้องอ่าน `versions[]` จาก `zdata_zdata_xray_result_log`
>   ไม่ใช่ `zdata_xray_result` ไม่งั้นจะขึ้น 1 ฉบับตลอดไป
>
> **ยืนยัน 2026-09-16** (ผู้ใช้เปิด Builder ให้ดู + ผู้ใช้ replace JSON ลงรีโป + ตรวจ DB):
> สองฟอร์มนี้ **ต่างกันแค่ฟิลด์ `ResultId` ฟิลด์เดียว** ที่เหลือเหมือนกันทุกตัวอักษร
> `ResultId` เป็น `number-input` + `disabled` + tooltip *"Server-generated sequence assigned by
> the Result API"* ⇒ มีเฉพาะในตาราง log และเป็น **คีย์เรียงลำดับฉบับที่เชื่อถือได้**
> (ดีกว่าเรียงด้วย `ResultDateTime` ซึ่งซ้ำ/ย้อนได้ — DX003 มี `ResultId` 6 และ 13)
> สแนปช็อตในรีโปตอนนี้ถูกต้องทั้งคู่: `xray_result.json` = ฟอร์มปัจจุบัน ·
> `xray_result_log.json` = ฟอร์ม log

> ⚠️ **ค้างอยู่ (2026-09-09):** ฟอร์ม `xray_order_status_change` มีอยู่จริงและ import แล้ว
> แต่ Process `xray_order_status_change.js` ตั้ง `ORDER_FORM_ID = '6a8f1ea97632d182ef6914fd'`
> แล้วเขียนลงตาราง `zdata_xray_order` ⇒ คอลเลกชัน `zdata_xray_order_status_change`
> **ยังว่าง 0 แถว** ต้องเคาะก่อนว่าฟอร์มใหม่นี้เป็น log ของทุกครั้งที่ RIS ยิงเข้ามา
> (ถ้าใช่ ต้องแก้ Process ให้เขียนเพิ่ม) หรือแค่เก็บสัญญาไว้เฉย ๆ

วิธีเทสหลัง import อยู่ใน `uat-checklist.md`

### 0.1 ใครเป็นเจ้าของอะไร (ยืนยัน 2026-09-09)

> เรื่องที่ต้องแจ้งทีมรวมไว้ที่ **`team-api-issues.md`** แล้ว — ส่งไฟล์นั้นให้ทีมได้ทั้งไฟล์

| ฝั่งเรา (แก้ได้) | ฝั่งทีม (ห้ามแก้ · แจ้งอย่างเดียว) |
|---|---|
| `xray-cpoe-worklist-v1.json` | `xray_api_order.js` |
| `xray_cpoe_dispatch_api.js` | `xray-api-ris-schedule.js` |
| `xray_accession_generate_api.js` | `xray-api-ris-result.js` |
| `xray_cpoe_worklist_api.js` | `xray_order_status_change.js` · `xray_resultreset.js` |

### 0.2 ปุ่ม "ส่งเข้าเครื่อง" ต้องส่งกี่ฟิลด์

**ไม่ใช่ ~80 ฟิลด์ตามตารางใน PDF** — PDF เป็น *data dictionary* ของสัญญา ไม่ใช่รายการที่ต้องกรอกครบ

`xray_api_order.js` บังคับแค่ **`AccessionNo` ตัวเดียว** (*"Only the upsert key is required"*) ที่เหลือ
เป็น pass-through แล้วตัว API เองเป็นคน (1) เก็บลง `zdata_xray_order` (2) forward ทั้งก้อนต่อไป
Envision RIS ⇒ **ฝั่งเราแค่เรียก `app.runProcess` แล้วส่ง JSON object ไป ไม่ต้อง forward เอง**

ปัจจุบัน `buildRisPayload()` ส่ง **14 ฟิลด์เสมอ**:
`Hn` `PatientTitle` `PatientFName` `PatientLName` `PatientGender` `PatientDob`
`PatientClassUid` `VisitNo` `AccessionNo` `ExamUid` `ExamName` `Priority` `Status` `IsDeleted`

บวก **optional อีกไม่เกิน 15 ฟิลด์ เฉพาะตัวที่มีค่าจริง** (ค่าว่างถูกตัดทิ้งก่อนส่ง):
`AdmissionNo` `PatientSsn` `RequestNo` `ClinicalInstruction` `ReferringDoctorTitle/FName/LName`
`ReferenceUnitUid/Name` `InsuranceTypeDesc` `MessageControlId` `ModalityTypeUid/Name`
`OrganizationUid` `Qty`

> 🔴 **ห้ามส่งฟิลด์เปล่า** — ทั้ง order และ schedule เป็น upsert และคัดทุกคีย์ที่ `!== undefined`
> ⇒ ส่ง `""`/`null` = ไปเขียนทับค่าเดิมใน RIS ให้ว่าง (ทีมคอมเมนต์เองว่า "ไม่ส่งมา = ไม่แตะค่าเดิม")

### 0.3 ช่องว่างที่ต้องถามทีม

| ฟิลด์ | ทีมมีในข้อมูลจริง | เราส่ง | ปัญหา |
|---|---|---|---|
| `ModalityUid` | 12/14 แถว เช่น `XR01` | ❌ ไม่ส่ง | เป็น **รหัสเครื่อง** ของ RIS · PDF ฝั่ง Schedule ติด `*` บังคับ · HIS ไม่มี master ที่ map ห้อง/เครื่องของเราไปเป็นรหัสนี้ |
| `ModalityName` | 5/14 เช่น `Digital Radiography` | ❌ ไม่ส่ง | คู่กับ `ModalityUid` |
| `QNo` · `ScheduleUid` | 12/14 | ❌ ไม่ส่ง | ยังไม่รู้ว่าจำเป็นกับ Order หรือเป็นของ Schedule |
| `ExamRate` · `OrderDtlRate` | 12/14 | ❌ ไม่ส่ง | ราคา — น่าจะไม่ใช่หน้าที่ห้องรังสี |

เราส่ง `ModalityTypeUid` = `CT`/`DX` ซึ่งเป็น **ชนิดเครื่อง** ไม่ใช่ **ตัวเครื่อง** ⇒ ถ้า Envision
ใช้ `ModalityUid` ในการจัดคิวเข้าเครื่อง ใบของเราอาจไปไม่ถึงเครื่องที่ถูกต้อง **ต้องถามก่อนเดา**

**ค้นแล้ว HIS ไม่มีรหัสเครื่องของ RIS เลย (2026-09-09)** — ตรวจครบทุกที่ที่เป็นไปได้:

| ที่ตรวจ | มีอะไร | มีรหัสเครื่องไหม |
|---|---|---|
| `zdata_ris_radio_exam` (1,825 รายการ) | `modality_type` = `DX` · `group_code` · `bp_code` · `positions_code` | ❌ |
| `zdata_ris_group` | กลุ่มอวัยวะ (Head&Neck · Vertebral · Chest&Abdomen) | ❌ |
| `zdata_section` | `modality_type` = `DX` | ❌ |
| `zdata_room` | ห้องของเรา (`X2` `X3` `X11` `US1` `US2` `RF` `CT` `MRI`) | ❌ เป็นรหัสของเราเอง ไม่ใช่ของ RIS |

⇒ **ค่า `XR01` เดาเองไม่ได้ ต้องขอจากทีม/Envision** แต่ **โค้ดที่ต้องแก้อยู่ฝั่งเรา** คือ
`buildRisPayload()` ใน `xray_cpoe_dispatch_api.js` ⇒ แบ่งงานคือ *ทีมให้ข้อมูล · เราเขียนโค้ด*

### 0.4 ช่องโหว่การวินิจฉัย — `transport` ทิ้งเหตุผลของ Envision

`xray_api_order.js` คืน `ForwardHttpStatus` · `ForwardResponse` · `ForwardError` กลับมาด้วย
แต่ `xray_cpoe_dispatch_api.js` เก็บแค่ `AcknowledgementCode` กับ `TextMessage` ลง `transport`

⇒ ถ้า Envision ปฏิเสธ เราจะเห็นแค่ *"Order saved locally, but forwarding failed"*
**โดยไม่รู้ว่า HTTP กี่ · เพราะฟิลด์ไหน** ซึ่งเป็นข้อมูลที่ต้องใช้ตอบคำถาม `ModalityUid` พอดี
ควรเก็บสามฟิลด์นี้เพิ่มก่อนเริ่มเทสจริง (เป็นการเพิ่มล้วน ไม่กระทบเส้นทางเดิม)

## 1. ชื่อไฟล์และเวอร์ชัน

```
Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json      ← เป้าหมายรอบแรก
```

- ตั้งชื่อ `xray-cpoe-<หน้าที่>-v<N>.json` · ขึ้นเวอร์ชันใหม่ทุกครั้ง ห้ามทับไฟล์เดิม
- ถ้ามี generator script ให้วางที่ `Form-Builder/seed/tests-tools/scripts/` ตามแบบของ LAB
  (`update_lab_cpoe_worklist_ui.js`) เพื่อให้ regenerate ได้ ไม่ต้องแก้ JSON ด้วยมือ

---

## 2. โครงไฟล์ — ลอกจากฟอร์ม LAB ที่ผ่านแล้ว

ใช้ `../Lab/lab-cpoe-worklist-waiting-v1.json` เป็นแม่แบบโครงสร้าง เพราะพิสูจน์แล้วว่า
validator ผ่านและเป็น pattern เดียวกับที่ต้องการ

```
{
  "formConfig": { ...17 ช่อง... },
  "fields": [
    grid  (5 options)                       id: grid-xray-cpoe-worklist-root
      └ cols[0] grid-col (11 options, span 24)
          └ fields[0] vue-ui (9 options)    id: vue-ui-xray-cpoe-worklist
    ]
}
```

### กฎโครงสร้างที่พลาดบ่อย (จาก SDFORM_JSON_RULES)

| # | กฎ | ผลถ้าผิด |
|---:|---|---|
| ก | `options` ต้องครบชุดตามแม่แบบ — `vue-ui` = **9 ช่อง**, `grid` = **5**, `grid-col` = **11** | ทั้งฟอร์มไม่ render |
| ข | ลูกของ container ต้องอยู่ใน **`.fields`** ไม่ใช่ `.widgetList` | container ว่าง |
| ค | ห้ามใส่ `key` ให้ component ที่แม่แบบไม่เคยใส่ | widget เป็นช่องว่าง |
| ง | ห้ามแต่งค่า presentation เอง (`labelIconClass`, `labelTooltip`, `customClass` ฯลฯ) | widget ไม่ render |

`vue-ui` ทั้ง 9 ช่อง: `name` · `label` · `columnSpan` · `hidden` · `content` · `customClass` ·
`onCreated` · `onMounted` · `onUnmount`

---

## 3. โค้ดที่อยู่ในฟอร์ม

| ช่อง | เนื้อหา | ที่มา |
|---|---|---|
| `formConfig.cssCode` | CSS ทั้งหมดของหน้า | แปลงจาก `<style>` ของ `xray-workbench-mockup.html` |
| `vue-ui.options.content` | template | แปลงจาก `<body>` ของ mockup |
| `vue-ui.options.onCreated` | state + method ทั้งหมด | แปลงจาก `<script>` ของ mockup |
| `vue-ui.options.onMounted` | `this.vueState.boot();` เท่านั้น | ทุกอย่างที่ใช้ `getFormRef()` ต้องรอถึงตรงนี้ |

### กฎการเขียนโค้ดใน vue-ui (ยืนยันจาก `CPOE_app.json` และฟอร์ม LAB)

- `cssCode` inject เป็น **CSS ระดับ global** → ทุก selector ต้องขึ้นต้นด้วย root class ของหน้านี้
  (`.xray-cpoe`) · `<style>` ในเทมเพลตถูก DOMPurify ตัดทิ้ง ใช้ไม่ได้
- สีทุกตัว map เป็นตัวแปร Element Plus เพื่อให้ตามธีม/ดาร์กโหมด ห้ามเขียน hex นอกบล็อก token
- อ่าน context ผ่าน **`field.params`** ไม่ใช่ `field.formModel`
- เรียก process ด้วย `field.getFormRef().userState.runProcess(procId, payload, okCb, errCb)`
  — **`success:false` มาทาง okCb ไม่ใช่ errCb ต้องเช็คเอง**
- `getFormRef()` ใช้ได้เฉพาะใน `onMounted` เท่านั้น
- เทมเพลตอ่านจาก `s.view` ที่ `recompute()` เตรียมไว้ **ห้ามคำนวณสดในเทมเพลต**
- **ห้ามเทมเพลตเขียนค่ากลับเข้า vueState** (scope proxy ไม่มี set) ทุกการเปลี่ยนค่าผ่าน method
- ทุก key ที่เทมเพลตอ้างต้องมีค่าตั้งแต่ `onCreated` — ขาดตัวเดียว = error box ทั้ง widget
- `v-for` กับ `v-if` ห้ามอยู่ element เดียวกัน · ใช้ `globalThis.document` ไม่ใช่ `document`
- ห้ามใช้ `confirm()` / `alert()` ของ browser กับ flow ที่มีผลทางคลินิก ใช้ in-page dialog

### 3.1 PDF ต่อ Order

- แถว Order ที่ไม่ยกเลิกแสดง `<sd-report>` สำหรับใบสั่งตรวจก่อนปุ่ม EMR
- Report ID คือ `6a97f826422c1ca95982a048`
- params ต้องมาจาก Order ที่กด: `order_id`, `visit_id`, `printed_by`, `printed_at`
- ถ้า Order ID หรือ Visit ID ว่าง ให้แสดง PDF แบบ disabled พร้อมเหตุผล ห้ามยิง Report แบบ scope ไม่ครบ
- ปุ่ม `HN` ระดับ Order ใช้ Report `ป้ายติดแฟ้ม (HN)` `6a9a355c422c1ca95982a1a2` และส่ง `hn` ของ Order ที่กด; ถ้าไม่มี HN ให้ disabled (เปลี่ยนจาก `5256d813009293b480d0a15c` + `xparentx` ตามคำสั่งผู้ใช้ 2026-09-04)
- ใบยกเลิกซ่อน PDF/EMR และแสดง `ตรวจใหม่` ตาม behavior เดิม
- PDF ใบสั่งตรวจระดับ Order คนละงานกับ PDF ผลอ่านระดับ item; ห้ามย้ายหรือปลดเงื่อนไขผลอ่าน
- ปุ่ม Report บน toolbar ยังไม่เชื่อมในรอบนี้
- Layout ปัจจุบัน: โลโก้ QSNICH ใหม่ชิดซ้าย, ชื่อสถาบัน 3 บรรทัดอยู่กลาง,
  Order No./วันที่/เวลาและ Barcode อยู่ขวา; label ผู้ป่วยใช้ `ชื่อ`, `คลินิกที่ส่ง`, `วันที่`
  และ `ประเภทการตรวจวินิจฉัย`; AN ที่ไม่มีค่าแสดงว่าง, ชื่อผู้สั่งไม่มี email, priority แสดง label
  CPOE และตารางใช้เฉพาะเส้นแนวนอน ไม่มีเส้นแบ่งคอลัมน์
- สัดส่วน Header ที่ผ่าน mock preview ล่าสุด: คอลัมน์ 17/54/29, โลโก้ `54 × 76 pt`,
  ชื่อสถาบัน `20`, บรรทัดรอง `15`, Barcode `154 × 32 pt`; ชื่อหน่วย X-ray เว้นลงมา
  12 pt และหัวตารางกำหนด `fillColor: #FFFFFF` ทุกคอลัมน์

### 3.2 สติ๊กเกอร์ HN ต่อ X-ray item

- ตารางรายการตรวจมีคอลัมน์ท้าย `สติ๊กเกอร์ HN` ติดกับ item แต่ละรายการ
- ใช้ `<sd-report>` ผูก Report ID live `6a980831422c1ca95982a054`
- params ต้องมาจากแถวที่กดเท่านั้น: `order_id`, `visit_id`, `item_id`, `printed_date`
- เปิดพิมพ์ได้ทั้งก่อนและหลังมี Accession No.; ปิดเฉพาะ item ยกเลิกหรือ scope ID ไม่ครบ
- Report SQL ต้อง fail closed ด้วย ID ทั้งสามตัวและคืนไม่เกินหนึ่งแถว ห้ามค้นจาก HN อย่างเดียว;
  Accession ว่างได้ และเมื่อมีเลขต้องเป็นเลขของ `item_id` ที่กด
- กระดาษ custom แนวนอนกว้าง 8.5 ซม. × สูง 2 ซม. (240.9449 × 56.6929 pt)
- เนื้อหา 4 บรรทัดตามฉลากอ้างอิง: โรงพยาบาล/Accession, ชื่อ, วันเกิด/อายุ,
  วันที่พิมพ์/HN; ใช้คำว่า `วันเกิด` แทน `DOB`
- ปุ่มนี้เป็นเอกสารระบุตัวผู้ป่วย ไม่เปลี่ยน clinical workflow และไม่แทน PDF ผลอ่าน

### 3.3 คลังหนังสือยินยอมและ PDF แบบฟอร์ม

- ปุ่ม **หนังสือยินยอม** อยู่บรรทัดถัดไปใต้ **นัดล่วงหน้า**; ปุ่มนัดอยู่ระดับเดียวกับ
  **สร้างรายการใหม่** และตัวกรองด้านซ้าย toolbar ห่อทั้งกลุ่มปุ่มลงบรรทัดใหม่เมื่อพื้นที่ไม่พอ
  โดยไม่มีปุ่มซ้อนกัน เปิด Form UI `6aab93911c5232627d0c6ee1` ผ่าน `openForm`
  โดยไม่เปลี่ยนพฤติกรรมปุ่มนัดหรือสร้างรายการใหม่
- Form UI แยกแสดงการ์ด 5 ชุดตามภาพอ้างอิง; แต่ละชุดมี Report Factory ภาษาไทยและอังกฤษ
  รวม 10 รายงาน ใช้ชื่อจริงและ ID ที่ผู้ใช้ให้มา ตรวจ `module_report` แบบ read-only แล้วเป็น
  `public`, `pdf_type=report`, ไม่มีพารามิเตอร์บังคับ และใช้ static dummy SQL
- ค้นชื่อไฟล์จริงและชื่อเอกสารทั้งไทย/อังกฤษได้; เลือกการ์ดแล้วเห็นไฟล์ในชุด หรือพิมพ์ค้นหา
  เพื่อเห็นไฟล์ที่ตรงทันที ปุ่มไฟล์ใช้ `<sd-report type=pdf>` เพื่อพรีวิวแล้วเลือกพิมพ์ในตัวดู PDF
- ฟอร์มนี้เป็น **สารบัญของ Report Factory ที่มีอยู่แล้ว** ไม่ได้เก็บ PDF ซ้ำ ไม่ใช่ที่เก็บ
  หนังสือยินยอมที่ผู้ป่วยลงนาม และไม่รับข้อมูลผู้ป่วย
- สถานะ 2026-09-17: ผู้ใช้ยืนยันคลังเอกสารบน HIS รวมการเลือกเอกสาร พรีวิว และพิมพ์
  (คำยืนยันในแชต; ไม่ได้แนบเคสพิมพ์แยก) หลังจากที่ก่อนหน้านี้ผู้ช่วยพบ Builder ว่าง;
  ยังไม่มีการบันทึกใบยินยอมที่ลงนามผูกผู้ป่วย/การเข้ารับบริการ
- ขั้นตอนนำเข้าและ Report ID ทั้ง 10 อยู่ใน
  `../../../02-his/handoff/xray-consent-document-library-v1-import.md`

### 3.4 สร้างรายการใหม่จาก HN ที่ค้นหรือสแกน (ไฟล์เตรียม replace 2026-09-17)

- เมื่อช่อง Search เป็น HN ล้วน (รวมรูป `HN 6900040`) หรือสแกน HN/เลขบัตร
  ปุ่ม **สร้างรายการใหม่** เรียก `resolve_open_visit` ใน Process Worklist เพื่ออ่าน
  Visit ที่ยังเปิดวันนี้ตามนิยามเดียวกับ LAB; สแกนเลขบัตรค้น HN ที่ server ก่อน
  โดยไม่ส่งเลขบัตรกลับมาที่หน้าจอ
- พบ Visit: ส่ง `hn`, `visit_id`, `vn` และบริบทผู้ป่วยผ่าน `options.params`
  ให้ CPOE Order App เช่นเดียวกับ LAB; ไม่ส่งเป็น `initData`
- ไม่พบ Visit: แสดงแถบแดงโปร่งใสขนาดเล็กกลางขอบบนจอ 3.5 วินาที
  พร้อมปุ่มปิดว่า HN ยังไม่ได้เปิด VN วันนี้ และไม่เปิดฟอร์ม;
  คำเตือนนี้ใช้ state ใน Worklist โดยตรงเพื่อเลี่ยง `notify` ที่แสดง `3000`
  เป็นหัวข้อใน HIS runtime (ภาพผู้ใช้ 2026-09-17) · ภาพ HIS ยืนยันว่าแถบเตือนขึ้นแล้ว
  หลังรับข้อเสนอแนะ ตัดเส้น/เงาขอบและใช้โทนเดียวกับปุ่ม `ยกเลิกรายการที่เลือก`
  (`#f56c6c`) ที่ความทึบ 20%; ข้อความใช้สีเข้มบนธีมสว่างและสีอ่อนบนธีมมืด
  เมื่อช่องค้นหาเป็นชื่อ/Order No. หรือว่าง ให้เปิดตัวเลือก VN แบบ manual ตามเดิม
- ต้อง replace **Process Worklist ก่อน Form Worklist** ไม่เช่นนั้นปุ่มจะตรวจพบ
  action ที่ยังไม่มีและแจ้งให้ replace Process; ภาพ HIS ยืนยันเฉพาะกรณีไม่พบ VN
  พร้อมแถบเตือนเวอร์ชันก่อนปรับเป็นสีปุ่มยกเลิก ส่วนหน้าตาล่าสุดและกรณีพบ Visit ยังรอ HIS UAT

---

## 4. API ที่ต้องมี

| Process | หน้าที่ | สถานะ |
|---|---|---|
| `xray-cpoe-worklist` | อ่าน worklist + นับ chip + คืนรายชื่อเครื่อง | **Process ID `6a957009422c1ca959829e45`** (ผู้ใช้แจ้ง 2026-08-31) → `../../API/api-factory/processes/xray_cpoe_worklist_api.js` |
| `xray-cpoe-dispatch` | ออก accession → บันทึกรับ → เรียก Agent → เก็บ transport outcome | ยังไม่สร้าง (รอ D-X3) |
| `xray-accession-generate` | ออกเลข accession แบบ atomic + idempotent | **Process ID `6a95cd58422c1ca959829e8d`** (ผู้ใช้แจ้ง 2026-09-01) → `../../API/api-factory/processes/xray_accession_generate_api.js` |

ใช้ `../../API/api-factory/processes/lab_cpoe_worklist_api.js` เป็นแม่แบบโครง query/permission

**สถานะ 2026-08-31** — `xray_cpoe_worklist_api.js` เขียนเสร็จแล้วเป็น read-only (`list` + `get_report`)
พร้อม regression test `../../API/tests-tools/tests/test_xray_cpoe_worklist_api.js` ผ่านทั้งหมด
ผู้ใช้แจ้ง Process ID `6a957009422c1ca959829e45` แล้ว และฟอร์มถูก regenerate ให้เรียก ID นี้
**ยังไม่ได้ยืนยัน deployed runtime กับข้อมูลจริง** — ต้อง import ฟอร์มแล้วดูผลจริงก่อน

### 4.1 `xray-cpoe-worklist` — read contract ขั้นต่ำ

```text
input : { action?, organization_code?, modality?, statuses?, date_from?, date_to?,
          hn?, q?, page?, limit? }
output: { success, data: { orders[], total, page, limit, modalities[], counts{} }, message }
```

Query:

```text
zdata_cpoe_order_item   filter service_type.value = 'xray'
  → join zdata_cpoe_order      (order_id.value / xparentx)   หัวใบ ผู้ป่วย การเงิน
  → join zdata_master_item_order (item_data_id)              เครื่อง + รหัสส่งตรวจ
  → join zdata_section                                        modality + หน่วยงาน
  → group กลับเป็นหนึ่ง Order พร้อม items[]
```

Order object ต้องมีอย่างน้อย: `order_id`, `order_number`, `requested_at`, `priority`,
`patient{hn,prename,first_name,last_name,age,gender_text}`, `visit{visit_id,vn}`,
`emr_context`, `requester`, `finance{total,claim,paid,coverage}`, `items[]`

Item object ต้องมีอย่างน้อย: `item_id`, `item_code`, `item_name`, `modality{code,label}`,
`accession_no`, `current_status`, `dispatched_at`, `dispatched_by`,
`cancel_reason`, `cancelled_by`, `result_ref`

**บังคับ**

- คำนวณ allowed scope จาก authenticated organization แบบ **fail-closed** ห้ามให้ UI ส่งมาเอง
- `modality` เป็นตัวกรองการแสดงผลภายใน scope นั้น ไม่ใช่ตัวให้สิทธิ์
- ห้าม parse HN/ชื่อจาก label — ใช้ structured `order.vid`
- คืน `counts` ของ chip ทั้งสี่ **ภายใต้ตัวกรองเครื่องปัจจุบัน**
- คืน `modalities[]` พร้อม `code` + `label` + จำนวน ให้ UI ไม่ต้อง hard-code

**ค้นหาเพิ่ม 2026-09-17 (TOR §3.4.3.1, §3.4.3.5):** `q` ค้น `visit.an`
ซึ่งเป็น AN รับไว้รักษาของผู้ป่วยใน และค้นเลขบัตรประชาชน 13 หลักแบบตรงตัวจาก
`zdata_person.p_cid` โดย join ก่อน `$facet` เพื่อให้รายการ จำนวนรวม และ chip ตรงกัน
ใช้ `order.vid.pid.value` เทียบ person ID เมื่อมีค่า และใช้ HN แบบตรงตัวเป็นทางสำรอง
เพราะใบ CPOE จริงบางใบไม่มี `vid.pid.value` ใน snapshot; ตรวจแบบ read-only แล้วทางสำรอง
จับคู่กับใบสั่งของผู้ป่วยได้ ไม่คืนเลขบัตรหรือเอกสารบุคคลใน response

เลขบัตร 13 หลักที่ **พิมพ์ในช่อง Search** ส่งเป็น `q` อย่างเดียว ไม่ส่ง `hn` และ
ค้นข้ามวันเมื่อผู้ใช้ไม่ได้เลือกช่วงวันเอง; ตัวรับสแกนระดับ document ต้องส่งค่าที่พิมพ์
ในช่อง Search เข้าเส้นทางค้นหา ไม่สลับไปโหมดสแกน HN ส่วนสแกน HN จริงยังส่ง `hn`
แบบ exact และสแกนเลขบัตรจริงส่ง `citizen_id` แบบ exact; ทั้งคู่ค้นข้ามวันโดยไม่ส่งเลขบัตร
กลับมาที่จอ ตัวกรอง Organization, วันที่ที่เลือกเอง, คิว, เครื่อง และสถานะยังทำงานตามเดิม

| TOR | หลักฐานที่เพิ่ม | สถานะ 2026-09-17 |
|---|---|---|
| §3.4.3.1 ค้นหารายการตรวจ | เพิ่ม AN ผู้ป่วยในและเลขบัตรประชาชน โดยคง HN/VN/Order No./Accession/ชื่อ/รายการตรวจ | **ครบ — ตัดจากรายการค้าง** หลังนำเข้า API/Form และผู้ใช้ยืนยันว่าใช้งานได้ 2026-09-17 |
| §3.4.3.5 ค้นหาผู้ป่วย | เพิ่ม AN ผู้ป่วยในและเลขบัตรประชาชน โดยคงชื่อ-นามสกุล/HN | **ครบ — ตัดจากรายการค้าง** ตามการยืนยันของผู้ใช้ 2026-09-17; ไม่มีบันทึกเคส AN แยกต่างหาก |
| §3.4.3.1 บันทึกหนังสือยินยอมการเข้ารับบริการ | มีปุ่มใน Worklist และฟอร์มคลัง PDF 5 หมวด/10 รายงาน พร้อมค้นชื่อไฟล์ พรีวิว และพิมพ์; ผู้ใช้ยืนยันคลังบน HIS 2026-09-17 | **บางส่วน — ยังไม่ปิด TOR**: คลังเอกสารผ่านตามคำยืนยันของผู้ใช้ แต่ยังไม่มีการบันทึกใบยินยอมที่ลงนามผูกกับผู้ป่วย/การเข้ารับบริการ |

**UAT ย่อยของ Worklist ที่ผ่านแล้ว 2026-09-17:** ผู้ใช้ยืนยันว่า UI ตัวกรองเครื่อง
แสดงแท็กไม่เกิน 3 ตัวต่อแถว ตัวที่ 4 ขึ้นแถวใหม่ และกรอบของ 2/3 code สั้น
กว้างสมดุลกันหลังนำเข้าไฟล์ล่าสุด จึงตัดรายการแก้ layout นี้ออกจากงานค้าง
ภาพก่อนหน้านี้แสดง 0 รายการ แต่ต่อมาผู้ใช้ยืนยันการกรองเครื่องและตัวเลข chip
บน HIS ในแชต 2026-09-17; ไม่มี Order/ภาพเคสตัวอย่างแนบแยก การผ่านเกณฑ์ย่อยนี้
ไม่ใช่ข้อ TOR ลำดับใหม่

ผลรวม TOR ฝั่งรีโปหลังปิดสองข้อค้นหาและเลื่อนข้อหนังสือยินยอมจาก “ยังไม่มี” เป็น “บางส่วน”:
**ครบ 12 / บางส่วน 13 / ยังไม่มี 48** จาก 73 ข้อ (เดิม 10 / 14 / 49)
โดยข้ออื่นยังคงสถานะเดิม ตารางนี้เป็นข้อความอัปเดตฝั่งรีโป;
[Claude artifact ต้นฉบับ](https://claude.ai/artifact/HKJE1GioB94vnygz7d8d6d)
เปิดได้แบบ signed-out/read-only จึงยังไม่ได้แก้เนื้อหาในลิงก์ต้นฉบับ

**Artifact ฉบับที่ผู้ใช้เป็นเจ้าของ อัปเดตแล้ว 2026-09-17:**
[TOR รังสีวิทยา งวดที่ 2](https://claude.ai/code/artifact/842038a1-fb08-4aae-8f15-347ff32f9d2e)
— แก้ในลิงก์เดิม ปรับสรุปเป็น **12/13/48** (16% / 18% / 66% · ถ่วงน้ำหนัก ≈ 25%)
ปรับ tally §3.4.3.1 เป็น 2/4/4 และ §3.4.3.5 เป็น 4/3/5 เลื่อนสองข้อค้นหาเป็น “ครบ”
เลื่อนข้อหนังสือยินยอมเป็น “บางส่วน” และเพิ่มบล็อก “ปิดเพิ่มรอบนี้”
ส่วนข้ออื่นทั้ง 73 ข้อคงสถานะและคำอธิบายเดิมทุกข้อ

**ตรวจ TOR ฉบับที่ผู้ใช้อัปเดต 2026-09-17:** `~/Downloads/สำเนาของ X-RAY - (30-3-69) ระบบ HIS edit.docx.pdf`
(ดาวน์โหลด 11:30) เทียบกับ `X-RAY - (30-3-69) ____ HIS edit.docx` ฉบับ 2026-08-31 แบบตัวต่อตัว
หลังตัดช่องว่าง: **ข้อความเท่ากันทุกตัวอักษร (10,928 ตัว)** ไม่มีข้อกำหนดเพิ่ม ลด หรือแก้ถ้อยคำ
ข้อความสีแดง/น้ำเงินคือการทำเครื่องหมายข้อใหม่ในคอลัมน์ “HIS ใหม่” ซึ่งมีมาตั้งแต่ฉบับ ส.ค.
ไม่ใช่เครื่องหมายสถานะงาน และไม่มี PDF annotation/highlight ในไฟล์
จำนวนข้อกำหนดจึงยังเป็น **73 ข้อ** เท่าเดิม ตัวเลขที่ขยับมาจากงานที่ทำเสร็จล้วน ๆ

### 4.2 `xray-cpoe-dispatch`

```text
input : { order_id, item_id? | item_ids[]?, retry_only? }
output: { success, accession_no, accession_nos[], requested, delivered, failed,
          partial, transport{status,error}, items[], message }
```

**UI เลือกได้หลายรายการและเลือกทั้งหมดได้** (ผู้ใช้เปลี่ยน requirement 2026-09-03)
และตั้งแต่ 2026-09-07 Process รับ `item_ids[]` หลายรายการของ Order เดียวในคำขอเดียวได้
เหมือน LAB แต่ **RIS contract ยังเป็นราย item**: server จึงออก accession, commit และส่ง
flat payload ตามลำดับทีละ item ไม่ส่ง `items[]` เข้า Process ของ RIS และไม่เปลี่ยน
transaction/accession/transport contract เดิม · `item_id` เดี่ยวยังใช้ได้เหมือนเดิม
· สถานะระดับใบเป็น **ผลรวมของ item** — ใบจะ `ออกผลครบ` ก็ต่อเมื่อทุก item มีผลอ่านแล้ว
· ไม่เลือกรายการตอนใบมีหลายรายการ = **ปฏิเสธ ไม่เดา**
· batch จำกัด 50 รายการ และ preflight ทั้งชุดก่อนแตะข้อมูล ถ้ามี ID นอก Order หรือรายการใด
ส่งไม่ได้ จะหยุดทั้งชุด; หลังเริ่มส่งแล้วแต่ปลายทางบางรายการล้มเหลว จะไม่ rollback รายการก่อนหน้า
และคืนผลแยกราย item ให้ retry เฉพาะรายการที่ล้มเหลวได้

**Process ID `6a967029422c1ca959829edc`** (ผู้ใช้แจ้ง 2026-09-01) →
`../../API/api-factory/processes/xray_cpoe_dispatch_api.js` · ฟอร์มผูกไว้แล้ว

mapping CPOE → RIS ผู้ใช้ยืนยัน 2026-09-01: `PatientClassUid` ใช้แค่ **I / O**
(มี AN = I ไม่มี = O · **ตัด E ออก**) · `ExamUid` = `item_code` ของ CPOE ·
`ModalityTypeUid` = code เช่น `DX` · ส่งฟิลด์เท่าที่เหมาะสม ฝั่ง RIS map ต่อเอง ·
วันเกิดอ่านได้ทั้ง `vid.pid.birth_date` และ `vid.birth_date`; ถ้าเป็น พ.ศ. จะแปลงเป็น ค.ศ.
ก่อนส่ง อ่านไม่ออกไม่ส่ง (ไม่เดา) ·
ฟิลด์ที่ไม่มีค่า **ไม่ส่ง** ไม่ยัดค่าปลอมให้ `AdmissionNo` / `PatientSsn`

ผู้ใช้ยืนยัน 2026-09-01: **ปุ่ม `ส่งเข้าเครื่อง` คือจุดเรียกทั้งลำดับนี้** — ออกเลข
Accession แล้วส่งใบสั่งเข้า RIS ด้วย **API ที่ทีมเขียนไว้** ไม่เขียน `zdata_xray_order`
เองด้วย logic คนละชุด

ลำดับที่ห้ามสลับ:

1. ตรวจสิทธิ์ + scope + Finance gate: การส่งครั้งแรกต้องเป็นสถานะ `ready`
2. ออก accession ผ่าน Process `6a95cd58422c1ca959829e8d` (idempotent — มีแล้วใช้เลขเดิม)
3. commit การรับ + audit `dispatched_at` / `dispatched_by` แบบ atomic
   (compare-and-set เอกสารเดียว — ไม่พึ่ง transaction ดู §4.3.1)
4. ส่งใบสั่งเข้า RIS **นอก transaction** ด้วยสัญญาของ `xray_api_order.js`
   (Process `6a8f1ef87632d182ef6914fe` · Form `6a8f1ea97632d182ef6914fd` ·
   ตาราง `zdata_xray_order`)
5. เก็บผล transport · **RIS ล้มเหลวห้าม rollback ข้อ 2–3**

สิ่งที่ได้จากการอ่านซอร์สของทีม (2026-09-01) และมีผลกับลำดับนี้:

- **`AccessionNo` เป็นกุญแจธุรกิจตัวเดียว** เจอ = update ไม่เจอ = insert · `MessageControlId`
  ไม่มีผล ⇒ **ยิงซ้ำไม่เกิดใบซ้ำ** ปุ่ม "ลองใหม่" จึงปลอดภัยโดยไม่ต้องมี dedup ฝั่งเรา
- payload ต้องอยู่ที่ **`params` root** · wrapper ที่ process แกะให้คือ
  `params` / `body` / `data` / `payload` / `New item` เท่านั้น — **`params.input` ใช้ไม่ได้**
- API รับ `Status: C` เพิ่มจากที่ฟอร์มประกาศ (N/A)
- **ทีมผ่อนกฎแล้ว 2026-09-01** — `AdmissionNo` และ `PatientSsn` **ไม่บังคับ** อีกต่อไป
  (บังคับเหลือ 9 ฟิลด์) และกฎ `PatientSsn` ต้องเป็นเลข 13 หลัก **ถูกถอดออก**
  ⇒ ผู้ป่วยนอกที่ไม่มี AN และผู้ป่วยต่างชาติที่ไม่มีเลขบัตร **ส่งได้เลย ไม่ต้องใส่ค่าปลอม**
  ทั้งสองฟิลด์ยังอยู่ใน `allowedFields` จึงถูกบันทึกถ้าส่งมา
- ฟอร์ม `xray_order.json` ยังทำเครื่องหมาย 11 ฟิลด์เป็นบังคับ — **ต่างจาก API โดยตั้งใจ**
  เวลาส่งจริงยึด API เป็นหลัก (`test_xray_order_ris_params.js` ล็อกส่วนต่างไว้แล้ว)

**การเรียกในแอปไม่ต้องใช้ public token** — ฟอร์มเรียก Process ของทีมผ่าน
`runProcess('6a8f1ef87632d182ef6914fe', {…})` ตัวเดียวกับที่เรียก worklist/accession อยู่แล้ว
ใช้ session ของผู้ใช้ที่ล็อกอิน ถ้าจำเป็นต้องยิงดิบ รูปแบบที่ initCraft รองรับคือ
`POST <apiHost>/v1/process/<id>` · header `Authorization: Bearer <api.user.token>` ·
body `{ params: {…} }` (ตรงกับที่ทดสอบกับ endpoint จริงได้ผลเหมือนกัน)
**public token มีไว้สำหรับผู้เรียกจากนอก initCraft และการทดสอบด้วย curl เท่านั้น**
- ถ้าต้องเขียน `zdata_xray_order` เอง ให้ใช้ `app.dbInsert` / `app.dbUpdate`
  **ไม่ใช่ `sdformSetOne`** (ฟอร์มที่ import มาแล้วจะคืน `"Cannot Update data."`)
- ตารางนี้เป็นสถานะปัจจุบันของใบสั่ง **ไม่ใช่ log ของข้อความ** (update ทับ และข้อความที่ถูก AE
  ไม่ถูกบันทึกเลย) ถ้าต้องการ audit trail ต้องทำตารางแยก — ยังไม่เคาะ

### 4.2.2 ก่อนยิง RIS ต้องเช็คฟิลด์บังคับเอง

`RIS_REQUIRED_FIELDS` ใน `xray_cpoe_dispatch_api.js` ต้องเท่ากับ `required` ใน
`../../API/api-factory/xray_api_order.js` เป๊ะ ๆ (9 ตัวหลังทีมผ่อนกฎ 2026-09-01):

```text
Hn · PatientFName · PatientGender · PatientDob
PatientClassUid · VisitNo · AccessionNo · ExamUid · ExamName
```

ยิงทั้งที่รู้ว่าขาดฟิลด์ = เสียเที่ยว และได้ `Missing required field(s): PatientDob`
กลับมาเป็นชื่อฟิลด์ฝั่ง RIS ซึ่งคนหน้างานแปลไม่ออกว่าต้องไปแก้ที่ไหน
⇒ เช็คก่อนแล้วรายงานเป็นภาษาคน (`RIS_FIELD_LABEL`) พร้อม `missing_fields[]`

`test_xray_cpoe_dispatch_api.js` อ่าน `required` จากไฟล์ของทีมมาเทียบทุกครั้งที่รัน
รายชื่อหลุดจากกันเมื่อไหร่เทสแดงทันที

**วันเกิด** — HIS เก็บได้หลายทรง `toIsoDate` จึงรับ `YYYY-MM-DD` `YYYY/MM/DD`
`DD/MM/YYYY` `YYYYMMDD` และมี `T` ต่อท้ายได้ · ปี ≥ 2400 ถือเป็น พ.ศ. แปลงลง 543 ·
**อ่านไม่ออก = หยุด ไม่เดา** เพราะวันเกิดผิดใน PACS แก้ย้อนหลังยากกว่าแก้ทะเบียนผู้ป่วย

**ชื่อฟิลด์ใน snapshot** ก็ไม่ได้มาทรงเดียว `firstText()` ไล่หาทุกชื่อที่เจอจริงก่อนยอมแพ้:
`p_fname`/`first_name`/`fname` · `birth_date`/`birthdate`/`dob` · `vn`/`visit_no` ฯลฯ
คืนค่าแรกที่ไม่ว่าง ไม่มีเลยคืนค่าว่าง (ไม่เดา)

**แพทย์ส่งตรวจ** — ถ้า HIS ให้มาเป็น object แยกลง `ReferringDoctorTitle/FName/LName`
ถ้าเป็นข้อความล้วน **ใส่ทั้งก้อนไว้ที่ `FName` เหมือนเดิม** ห้ามเดาว่าคำไหนคือนามสกุล

**ข้อความบนหน้าจอ** — แถวที่ส่งไม่ผ่านแสดง `transport.message` ตัวจริง ไม่ใช่ประโยค
สำเร็จรูป "ส่งเครื่องไม่สำเร็จ · ลองใหม่ได้" ซึ่งไม่ได้บอกว่าต้องไปแก้อะไร
(ผู้ใช้ทักท้วง 2026-09-01)

### 4.2.3 ค่าเริ่มต้นของช่วงวัน — เวลาสถานะวันนี้

แกน Date Range คือ **เวลาของสถานะ** (`status_date`) ไม่ใช่ `เวลาสั่ง` ที่แสดงในตาราง:
รอรับใช้เวลาสั่ง **หรือเวลาตรวจใหม่ของรอบล่าสุด**, รอผลตรวจใช้เวลาส่งเข้าเครื่อง
(หลังตรวจใหม่ใช้เวลาส่งรอบใหม่ แม้ sibling ในใบเคยส่งวันก่อน), ออกผลแล้วใช้เวลาออกผล,
ยกเลิกใช้เวลายกเลิก. ไม่เลือกช่วงวัน = `status_date` ของวันนี้เท่านั้น;
เลือกช่วงเอง = `status_date` ในช่วงนั้นเท่านั้น. ค้น HN แบบตรงตัวข้ามค่าเริ่มต้น
เพื่อดูประวัติทุกวันได้

**คำสั่งผู้ใช้ 2026-09-08 แทนกติกา 2026-09-02:** เลิกแถมงานค้างข้ามวัน
(`OR bucket=active`) ในค่าเริ่มต้น; API ยังคืน `date_scope.include_backlog:false`
เพื่อรักษาทรง response. รายการที่สั่งวันที่ 10 แต่เพิ่งส่งเข้าเครื่องวันที่ 18
จึงอยู่ในหน้าค่าเริ่มต้นของวันที่ 18 แม้คอลัมน์ `เวลาสั่ง` จะแสดงวันที่ 10
ตามข้อเท็จจริง. หลักฐาน runtime 2026-09-18: รายการสามใบที่สั่ง 10 ก.ย.
มี `dispatched_at` วันที่ 18 ก.ย. เวลา 11:57–11:58 จึงผ่านตัวกรองวันนี้

**แก้ 2026-09-18 หลังทดสอบ Retest:** `retest_items` เปิด item ใน Order เดิมและล้าง
`dispatched_at` แต่ `requested_at`/`order.status_stage` ยังเป็นวันสั่งเดิม. จึงต้องคืน
`retest_at` ใน item ของ Worklist และให้ `status_at` ใช้เวลาที่ใหม่กว่าระหว่าง
`retest_at` กับ `dispatched_at` ของรอบใหม่; ใบจึงอยู่ในช่วง “วันนี้” ทั้งหลังตรวจใหม่
และหลังส่งเข้าเครื่องใหม่. เรียงแถวตาม `status_at` ใหม่สุดก่อนเพื่อไม่ให้ใบเก่า
ที่กลับมาวันนี้ตกท้ายหน้า. คอลัมน์ `เวลาสั่ง` ยังคงเป็นวันสั่งจริงของ Order.

### 4.2.4 สองเส้นทางไปหา RIS

| ลำดับ | เส้นทาง | ต้องมีอะไร |
|---|---|---|
| 1 | `app.runProcess(6a8f1ef8…, payload, userInfo)` | ไม่ต้องมี token · ใช้ session ผู้ใช้ |
| 2 | `app.axios.post` → public endpoint ของ Process เดียวกัน | ต้องมี public token |

ทางที่ 2 ยิงเฉพาะเมื่อทางที่ 1 **ไม่ได้ ACK กลับมา** — ปลอดภัยเพราะ RIS upsert ด้วย
`AccessionNo` ⇒ ถึงทางที่ 1 จะไปถึงจริงแต่เราอ่านคำตอบไม่ออก ก็ได้ใบเดิมทับ ไม่เกิดใบซ้ำ

body ต้องห่อเป็น `{ params: <payload> }` เสมอ — gateway ตรวจ property `params`
ที่ระดับบนสุด**ก่อน**ตรวจ token (ยืนยันด้วยการยิงจริง 2026-09-01)

**`RIS_ORDER_PUBLIC_TOKEN` ต้องเป็นค่าว่างในรีโปเสมอ** ไปวางค่าจริงในช่องโค้ดของ
API Factory เท่านั้น · token เปิดให้เขียนฐานข้อมูลได้โดยไม่ต้องล็อกอิน
เทสบังคับว่าไฟล์นี้ต้องมี URL ได้ตัวเดียว ห้ามมี JWT และทางหลักต้องยังเป็น `runProcess`

`item.transport.route` บันทึกว่าใบนั้นไปทางไหน (`process` / `public`) จะได้รู้ว่า
ต้องไปขอสิทธิ์ `runProcess` จากทีมเพิ่มหรือยัง

### 4.2.1 สถานะที่ห้องรังสีมองเห็น

`STATUS_VOCABULARY` ใน `xray_cpoe_worklist_api.js` เป็นด่านแรกของ pipeline — สถานะที่ไม่อยู่
ในนี้จะไม่เข้าทั้ง chip และตาราง

**ไม่มี `draft` โดยตั้งใจ** (ผู้ใช้ยืนยัน 2026-09-01) — ใบที่แพทย์ยังร่างอยู่ยังไม่ได้กดส่ง
จึงยังไม่ใช่คำสั่ง ห้องรังสีต้อง **ไม่เห็นและไม่นับ** ไม่ใช่เห็นแล้วกดไม่ได้

| bucket | สถานะ |
|---|---|
| waiting | `sent` `ready` |
| active | `accepted` `prepared` `dispensed` `dispatched` `in_progress` |
| complete | `resulted` `completed` |
| cancelled | `cancelled` `rejected` `returned` `reversed` |

รายชื่อนี้ต้องตรงกับ `s.statusMap` ในฟอร์มเสมอ — `test_xray_cpoe_worklist_form.js` อ่าน
vocabulary จากซอร์ส API ทุกครั้งแล้วเทียบให้ · chip `ทั้งหมด` ส่ง `statuses` ว่างเพื่อให้
API ใช้ vocabulary ของตัวเอง

`sent` กับ `ready` อยู่ bucket `waiting` และแสดง `รอรับ` เหมือนกัน แต่มีความหมายด้าน action
ต่างกัน: `sent` ยังไม่ผ่านการเงิน, `ready` ผ่านการเงินแล้ว. ปุ่ม `ส่งเข้าเครื่อง` ของรายการ
`sent` ต้องคงมองเห็นแต่ disabled พร้อม tooltip `ยังไม่ผ่านการเงิน`; checkbox ยังคงเลือกได้
เพื่อปฏิเสธหรือยกเลิก. ทั้ง `xray-accession-generate` และ `xray-cpoe-dispatch` ต้องปฏิเสธ
การรับครั้งแรกจาก `sent` ก่อนจองเลข/แก้สถานะ/เรียก RIS. Retry, repair, incomplete dispatch
และ resend ที่มีหลักฐานว่าเคยรับแล้วไม่ถูกบล็อกด้วย gate นี้.

---

### 4.3 เลข Accession

```text
SM YYYY MM DD <MOD2> NNN      →  SM20260901CT001      (ยาว 15 ตัวคงที่)
```

ผู้ใช้ยืนยันรูปแบบและเงื่อนไข 2026-09-01:

- prefix `SM` · ปี **ค.ศ.** 4 หลัก · วันที่ = วันที่ **ออกเลข** ไม่ใช่วันที่สั่ง
- modality เป็น **2 ตัวเสมอ** (`VCUG` → `VC` ผ่าน `MODALITY_SEGMENT_ALIAS`)
  code ที่ยาวเกิน 2 ตัวและยังไม่มีตัวย่อ **ต้องปฏิเสธ** ห้ามตัดคำเองจนย่อชนกัน
- ยาว 15 ตัวทุกเครื่อง < ลิมิต `AccessionNo` 16 ตัวของ RIS (`xray_order.json`)
- running **แยกตาม modality และแยกตามวัน** · ขึ้นวันใหม่เริ่ม 001
- **ครบ 999 แล้วไม่วนกลับ** — รายการที่ 1000 หยุดและแจ้ง error (เลขซ้ำใน PACS
  แก้ย้อนหลังไม่ได้) · เตือนล่วงหน้าตั้งแต่ลำดับ 950 ผ่าน `response.warning`
- กุญแจ counter = `xray_accession:SM:<YYYYMMDD>:<MOD2>` — **ต้องเท่ากับฟิลด์ที่
  พิมพ์ลงในเลขเป๊ะๆ** ห้ามแยกด้วย Section หรือ Organization ที่ไม่ได้อยู่ในเลข
- master ไม่มี modality ⇒ ไม่ออกเลข ห้าม fallback เป็น `UN`
- ต้อง atomic ระดับ DB · idempotent ต่อ Item · ห้ามคำนวณที่หน้าจอ

---

### 4.3.1 MongoDB เป็น standalone — ห้ามใช้ transaction

**สาเหตุจริงของอาการ "สถานะเปลี่ยนแต่ไม่มีเลข Accession" (2026-09-01)**

MongoDB ของระบบนี้เป็น **standalone** ไม่ใช่ replica set จึงเปิด session ไม่ได้ ทุกครั้ง
ที่เรียก `this.mongoTxn(...)` driver จะโยน
`Transaction numbers are only allowed on a replica set member or mongos`

`xray-accession-generate` และ `xray-cpoe-dispatch` เดิมเรียก `mongoTxn` ตรง ๆ ไม่มีทางสำรอง
⇒ **ออกเลขไม่ได้เลยสักครั้ง** ฝั่ง LAB เจอปัญหาเดียวกันมาก่อนและแก้ไว้แล้วใน
`lab_no_generate_api.js` / `lab_cpoe_receive_api.js` — X-ray ใช้ทางแก้ชุดเดียวกัน:

| จุด | แทน transaction ด้วย |
|---|---|
| เพิ่ม counter | `findOneAndUpdate` ซึ่ง atomic ต่อเอกสารอยู่แล้ว |
| จองเลขให้ item | เงื่อนไข "`accession_no` ยังว่าง" บน item เอง = ตัวล็อก idempotent |
| แพ้ race | อ่านซ้ำแล้วคืน "เลขของผู้ชนะ" ไม่ใช่ error และไม่ใช่เลขที่ตัวเองจอง |
| บันทึกการรับ | compare-and-set `current_status: 'ready'` เอกสารเดียว |

ผลข้างเคียงที่ยอมรับ: ล้มกลางคันได้ **ช่องว่างในลำดับ** (เช่น 001 → 003) ซึ่งปลอดภัย
เพราะเลขที่จองแล้วไม่ถูกใช้ซ้ำเด็ดขาด — เหมือนที่ LAB NO. ยอมรับไว้

**กฎถาวร:** ทุก Process ของ X-ray ต้องรันได้บน standalone · ใครใส่ `mongoTxn` เข้ามา
ต้องมี `transactionUnsupported(error)` แล้วตกลงเส้นทางไม่มี session เสมอ

**ทางซ่อมรายการที่ค้างครึ่งทาง** — บั๊กนี้ทิ้งรายการที่ `current_status = 'dispatched'`
แต่ **ไม่มี `accession_no`** ไว้ในฐานข้อมูลจริง ลำดับที่ถูกต้องออกเลขก่อนเปลี่ยนสถานะเสมอ
⇒ สภาพนี้เป็นหลักฐานว่า **ยังไม่เสร็จ และ RIS ไม่เคยเห็นใบนี้** (ไม่มีเลขก็ส่งไม่ได้)
จึงทำต่อได้โดยไม่เสี่ยงใบซ้ำ:

- `xray-accession-generate` ออกเลขครั้งแรกได้จาก `ready` เท่านั้น และออกเลขซ่อมให้
  **กลุ่ม "รับแล้ว"** (`accepted` `prepared` `dispensed` `dispatched` `in_progress`)
  สถานะอื่น — ออกผลแล้ว/ยกเลิก/ปฏิเสธ — ยังห้ามเด็ดขาด

  **`RECEIVED_STATUSES` ต้องไม่รวม `sent` หรือ `ready`**; `ready` เป็น Finance-cleared waiting
  และเป็นสถานะเริ่มต้นของ dispatch แยกจากกลุ่มที่รับแล้ว. รายชื่อ repair ต้องเท่ากับสถานะ
  dispatched ใน `s.itemState` ของฟอร์มด้วย · เคยหลุดกันมาแล้ว: API เช็ค
  `'dispatched'` ตรงตัว แต่ฟอร์มเช็คทั้งกลุ่ม ⇒ ติ๊กได้แต่กดแล้วขึ้น
  "รายการที่เลือกไม่อยู่ในสถานะที่ส่งเข้าเครื่องได้" · `test_xray_cpoe_dispatch_api.js`
  อ่านทั้งสามไฟล์มาเทียบกันแล้ว หลุดอีกไม่ได้

- ข้อความปฏิเสธของทั้งสอง Process ต้อง **บอกสถานะจริงที่อ่านได้** เสมอ ไม่ใช่ประโยคลอย
  ที่ต้องเปิด DB เดาเอง (`data.items[]` แนบ `current_status` / `accession_no` /
  `transport_status` มาด้วย)
- `xray-cpoe-dispatch` หยิบรายการที่ค้างมาทำต่อ **โดยไม่แตะสถานะและ `dispatched_at` เดิม**
- ฟอร์มแสดงสถานะ `ค้าง · ยังไม่ได้เลข` พร้อมข้อความ `ยังไม่ได้เลข Accession · กดส่งเข้าเครื่องอีกครั้ง`
  และเปิดให้ติ๊กแถวนั้นได้

⇒ ซ่อมได้จากหน้าจอ **ไม่ต้องแก้ DB มือและไม่ต้องสั่ง order ใหม่**

### 4.4 `xray-cpoe-reject` — ปฏิเสธระดับ item

```text
input : { action:'reject_item', item_id, rejection_record_id, order_id?, order_number? }
output: { success, data{ item_id, rejected_at, rejected_by, reject_reason_code,
          reject_reason_detail, audit_sync_pending, already_rejected }, message }
```

`../../API/api-factory/processes/xray_cpoe_reject_api.js` — **ยังไม่ deploy**
paste แล้วเอา Process ID มาใส่ที่ `REJECT_PROCESS_ID` ใน
`build_xray_cpoe_worklist_ui.js` พร้อม `REJECTION_FORM_ID` ของฟอร์มเหตุผล

โครงเดียวกับ LAB (`Lab_Reject_Specimen.js` · `6a79ff46d5218a5b6a26bebc`):
**ฟอร์มเหตุผลคือหลักฐาน · Process แค่ทำให้สถานะตรงกับหลักฐาน** ไม่มีทางลัดที่ข้ามฟอร์มได้
CPOE ยังเป็น read-only จากมุมห้องรังสี — แตะเฉพาะฟิลด์สถานะของ item

**ปฏิเสธได้เฉพาะรายการที่ยังไม่ได้ส่งเข้าเครื่อง (`current_status = sent`)**
รายการที่ส่งไปแล้วมีใบสั่งนอนอยู่ฝั่ง RIS/PACS การยกเลิกต้องยิง `IsDeleted` กลับไปด้วย
ซึ่งยังเป็น decision ที่ไม่ได้ยืนยันกับทีม RIS (D-X9) — ปฏิเสธเงียบ ๆ ฝั่งเราอย่างเดียว
จะทำให้สองระบบไม่ตรงกัน จึงบล็อกไว้ก่อนพร้อมข้อความบอกเหตุผล

ลำดับ (ไม่มี transaction): ตรวจหลักฐาน → compare-and-set สถานะ item →
ประทับ `rejection_status: 'applied'` บนหลักฐาน · ประทับพลาดได้ สถานะยังถูก แค่คืน
`audit_sync_pending: true` ให้ตามเก็บ (เหมือน LAB)

### 4.5 `cancel_order` — ยกเลิกเฉพาะ X-ray item ที่เลือก

```text
input : { action:'cancel_order', organization_code, order_id, order_number?, item_ids:[...], cancel_reason }
output: { success, data{ cancelled_item_count, preserved_terminal_item_count,
          item_ids, cancellation_record_id, already_cancelled, audit_sync_pending }, message }
```

อยู่ใน **Process worklist ตัวเดิม** `6a957009422c1ca959829e45` ไม่ใช่ Process ใหม่ —
ทรงเดียวกับ `lab_cpoe_worklist_api.js` ที่ใช้งานจริงแล้ว ⇒ ไม่ต้องขอ Process ID เพิ่ม

- เหตุผลเป็น **free text บังคับกรอก** (≤1000 ตัว) ผ่าน dialog ในฟอร์ม
  ไม่ต้องมีฟอร์มแยกแบบการปฏิเสธรายรายการ
- Form ส่ง `item_ids` จาก checkbox ที่เลือกเท่านั้น; ว่างแล้วปิดปุ่ม และ API ปฏิเสธ
  array ว่าง/ID ที่ไม่ใช่ X-ray item ใน Order นั้น รายการพี่น้องที่ไม่ได้เลือกไม่ถูกตรวจ
  ผลเพื่อบล็อก ไม่ถูกส่งไป RIS และไม่ถูกเปลี่ยนสถานะ
- บันทึกการยกเลิกอยู่ที่ `zdata_xray_order_cancellation` โดยใช้ `_id` ของ order
  เป็น `_id`; `item_ids` คือชุดที่กำลังดำเนินการ และ `history[]` เก็บเหตุผล/ผู้ทำ/
  เวลา/ผล RIS ของชุดก่อนหน้าเมื่อยกเลิก item อีกชุดใน Order เดิม กดซ้ำชุดเดิมไม่เกิดใบซ้ำ
- client เดิมที่ไม่ส่ง `item_ids` ถูก API ปฏิเสธเพื่อไม่ให้ยกเลิกทั้งใบระหว่าง deploy;
  หากต้องการยกเลิกทุก X-ray item ให้ส่ง ID ของทุกรายการอย่างชัดเจน
- เปลี่ยนสถานะ item แบบ compare-and-set ทีละใบ · แพ้ race = หยุดทันที ประทับ
  `cancel_status:'conflict'` แล้วบล็อกการกดซ้ำจนกว่าผู้ดูแลจะตรวจ
- รายการที่เลือกและจบไปแล้ว (`cancelled` `rejected` `returned` `reversed`) **ข้าม ไม่ทับ**
  เหตุผลเดิมของมัน — นับเป็น `preserved_terminal_item_count`; ไม่รวม sibling ที่ไม่ได้เลือก
- ไม่มี transaction (MongoDB standalone — §4.3.1)

**เส้นแบ่งของ X-ray คือเลข Accession — เพิ่ม flow RIS cancel 2026-09-18 ตามคำสั่งผู้ใช้**

- ไม่มีเลข: ยกเลิกเฉพาะ CPOE item ที่เลือกตามเส้นทางเดิม ไม่เรียก RIS
- มีเลข: อ่าน Order JSON ที่เคยส่งจาก `zdata_xray_order` ด้วย `AccessionNo` เดิม,
  ตรวจ `ExamUid`/`RequestNo` ให้ตรง CPOE และเช็ก `zdata_xray_result` ว่ายังไม่ออกผล,
  ส่งฟิลด์ของ outbound เดิมผ่าน Process `xray_api_order` ตัวเดียวกับปุ่มส่งเข้าเครื่อง
  ไป Envision `GetOrder` โดยใช้ `IsDeleted: true` และ `Status: 'A'` (ห้ามใช้
  `Status: 'C'` เพราะหมายถึง Completed) ไม่ออก Accession ใหม่
- ไม่พบ Order JSON ต้นทาง/ข้อมูลบังคับไม่ครบ ⇒ fail-closed (`ris_cancel_required`/
  `ris_cancel_payload_incomplete`) และยังไม่เปลี่ยนสถานะ CPOE
- ถ้า Accession เดียวกันผูกกับ sibling ที่ไม่ได้เลือก ให้หยุดก่อนส่ง RIS
- บันทึก `cancel_status:'ris_pending'` พร้อม `item_ids` ของชุดนี้ก่อนส่ง; ถ้าเรียก Process
  ไม่สำเร็จ หรือ API Order ไม่ยืนยัน `LocalSaved:true` พร้อม Accession ที่ตรงกัน
  ให้คง CPOE ไว้ เก็บผลใน `ris_cancel` และกดยกเลิกซ้ำด้วย Accession เดิมได้;
  dispatch ปกติถูกบล็อกเฉพาะ item ในชุด pending
- **ขอบเขตที่ผู้ใช้ยืนยัน 2026-09-18:** เมื่อ API Order ยืนยันว่าเก็บ
  `IsDeleted:true` ของทุก Accession ที่เลือกแล้ว ให้เปลี่ยน CPOE item เหล่านั้นเป็น
  `cancelled` และประทับ cancellation `applied` แม้ขาส่งต่อ RIS ได้ HTTP 401/ACK `AE`.
  เก็บ `ris_cancel.status:'accepted_local'` และ HTTP status ใน audit พร้อมเตือนบนหน้าจอว่า
  API Order รับคำขอแล้ว แต่การส่งต่อ RIS ยังไม่สำเร็จและเป็นหน้าที่ของทีม API Order.
  หากขาส่งต่อ RIS ยืนยัน `AA` ตามเดิม เก็บ `ris_cancel.status:'confirmed'`.
  ถ้ายังมี sibling ที่ทำงานอยู่
  response ใช้ `current_status:'partially_cancelled'` โดยไม่เปลี่ยน Order header
  รายการที่ออกผลแล้วก็ยังห้ามยกเลิกเมื่อถูกเลือก

หลักฐาน runtime 2026-09-18 ของ `SM20260918CT001` ใน Order `R2609100008`:
`zdata_xray_order.IsDeleted:true` เวลา 12:11:37 แต่ขาส่งต่อได้ HTTP 401,
CPOE ยัง `dispatched` และ cancellation ค้าง `ris_pending` ด้วยโค้ด live เดิม.
นี่พิสูจน์การรับของ API Order แล้ว ยังไม่พิสูจน์ว่า Envision ลบคิว modality.
ต้อง deploy Worklist Process/Form คู่กัน แล้วทดสอบ selected-item CPOE และ audit ใน runtime;
ทีม API Order ต้องตรวจการส่งต่อ RIS และคิวปลายทางแยกกัน

### 4.6 ผลอ่านจาก RIS และการส่งตรวจซ้ำ (2026-09-02)

**ผลอ่าน** — RIS ยิงเข้ามาที่ `zdata_xray_result` เอง (Process `6a861de5f851000f28e44ab3`)
ผูกด้วย `AccessionNo` เท่านั้น · worklist `$lookup` เข้ามาระดับ item

- endpoint ของทีม **insert ทุกครั้ง ไม่ upsert** ⇒ หนึ่ง accession มีได้หลายฉบับ
  เรียง `ResultDateTime` แล้วหยิบล่าสุด และคืน `result_versions` ให้หน้าจอเตือนผู้ใช้
- `ResultText` เป็น **ข้อความก้อนเดียว** ไม่แยก Findings/Impression — ห้ามแบ่งเองด้วยการเดา
- `RadiologistUid` เป็น **รหัส** ไม่ใช่ชื่อ · ยังไม่มีตาราง map (คำถามข้อ 5) แสดงรหัสตามจริง
- `ImageCapturedDateTime` มาก่อน `performed_at`/`dispatched_at` เสมอ

**สถานะ "ออกผลแล้ว" derive จากผล ไม่ใช่จาก `current_status`** — RIS ไม่ได้เขียน
`zdata_cpoe_order_item` ให้เรา ถ้ารอสถานะจาก CPOE รายการจะค้างที่ "ส่งเครื่องแล้ว"
ตลอดกาลทั้งที่ผลมาแล้ว

```
ออกผลแล้ว  ⟺  มี ResultText  และ  ResultDateTime ≥ dispatched_at
```

**กติกานี้ต้องใช้ทั้งสองฝั่ง** — pipeline คำนวณ `effective_status` แล้วใช้เป็นทั้ง
ตัวกรอง `statuses[]`, ที่มาของ `bucket` สำหรับ chip และค่าที่ส่งไปกับ item
ถ้าปล่อยให้ chip นับจาก `current_status` ดิบ chip จะบอก "รอผลอ่าน" ขณะที่แถวบอก
"ออกผลครบ" ทันทีที่ผลแรกเข้ามา — บั๊กตระกูลเดียวกับ draft ที่เคยเจอ 2026-09-01
· `test_xray_cpoe_worklist_api.js` ห้าม `'items.current_status'` โผล่ใน pipeline อีก
· ฝั่ง server เทียบเวลาด้วย `$dateFromString` (`onError: null`) และตกลงกติกาเดียวกับ
ฟอร์มเมื่ออ่านวันที่ไม่ได้: ถือว่าผลนั้นใช้ได้ ดีกว่าซ่อนผลจริงเพราะรูปแบบวันที่

**ส่งตรวจซ้ำ** (ผู้ใช้ยืนยัน 2026-09-02) — ถ่ายซ้ำเคสเดิม = กดส่งเข้าเครื่องอีกรอบ
**ด้วยเลข Accession เดิม** ไม่ออกเลขใหม่

- ปลอดภัยเพราะ `xray_api_order` upsert ด้วย `AccessionNo` ⇒ ทับใบเดิม ไม่เกิดใบซ้ำ
- dispatch เลื่อน `dispatched_at` เป็นรอบล่าสุด + `resent_at` + `dispatch_count`
  ⇒ กติกาข้างบนทำให้รายการกลับไปเป็น "รอผลอ่าน" เองโดยไม่ต้องเขียนสถานะเพิ่ม
- ปุ่มขึ้นคำว่า **ส่งตรวจซ้ำ** แยกจาก **ส่งเข้าเครื่องใหม่** (รอบเดิมที่ส่งไม่สำเร็จ)
- **ยกเลิก/ปฏิเสธแล้วส่งซ้ำไม่ได้** — ต้องสั่งใหม่จาก CPOE ไม่ใช่ปลุกใบเดิม

## 5. โครง UI ที่ต้องมีในไฟล์

แท็บระดับบนต้องเรียงเป็น `Unit Queue` · `My Room` · `X-ray` · `สืบค้นผลแลป` ·
`Completed` และเปิดเริ่มต้นที่ `X-ray` เหมือนเดิม

```
.xray-cpoe
├── toolbar (grid 7 คอลัมน์)
│   ค้นหา · Date Range · เครื่อง(dropdown) · Search · Report · spacer · สร้างรายการใหม่
│                                                          นัดล่วงหน้า
│                                                          หนังสือยินยอม
├── status chips ×5      ทั้งหมด · รอรับ · รอผลตรวจ · ออกผลครบ · ยกเลิก
├── worklist (min-width 1310px, 10 คอลัมน์)
│   expand · patient · context pills · รายการตรวจ · เครื่อง ·
│   เวลาสั่ง+Order No. · เวลาสถานะ · แพทย์/Dx · สถานะ · ปุ่ม(คอลัมน์เดียว)
│   └── detail panel
│       ├── tab: order      ตาราง 9 คอลัมน์ (min-width 1180px)
│       │    Accession No. · รายการตรวจ · เครื่อง · เวลาสั่ง ·
│       │    เวลาส่งเข้าเครื่อง · ผู้ส่ง · สถานะ · ปฏิเสธ · คนปฏิเสธ
│       ├── tab: ผลอ่าน      ลำดับ · รายการตรวจ · เครื่อง · เวลาออกผล ·
│       │                   [ดูผลอ่าน][ดูภาพ] · สถานะ
│       └── ปุ่ม: ส่งเข้าเครื่อง · ยกเลิกรายการที่เลือก   (ยกเลิกทั้งใบแล้ว → ตรวจใหม่)
└── dialogs: ผลอ่าน · ยืนยันส่งเข้าเครื่อง · ยกเลิกรายการที่เลือก · ตรวจใหม่
```

ทุกขนาด/สี/ระยะอ้างจาก `Xray_design.md` §2–§7 ห้ามตั้งค่าใหม่เอง

---

### 5.1 แท็บสืบค้นผล LAB ข้ามทุกห้อง (2026-09-24)

- widget ชื่อ `xray_lab_lookup` อยู่ใน pane `xray_tab_lab_lookup` และแยก state/CSS จาก
  `xray_cpoe_worklist`
- เริ่มต้นด้วยคำแนะนำ `โปรดระบุ HN / เลือกวันที่`; `onMounted` ห้ามเรียก `load()`
- scope ที่ยอมรับมีเพียง HN แบบตรงตัว (ไม่มีวันที่ = `all_dates:true`) หรือ Date Range
  ครบสองฝั่ง; HN ว่างและวันที่ไม่ครบต้องไม่เรียก Process
- ใช้ Process `6a9434c3422c1ca959829d5e`, `organization_code` จากผู้ใช้ปัจจุบัน,
  `cross_section:true` และ `lookup_mode:'results'|'orders'`
- เปิดผลราย item ด้วย `action:'get_manual_result'`, `cross_section:true`,
  `lookup_mode:'results'`; แสดง result, unit, reference range, interpretation, critical และเวลา
- contract นี้เป็น read-only โดยเด็ดขาด: Form ห้ามมี write action ฝั่ง LAB และต้องพึ่ง guard
  ฝั่ง LAB Process ที่อนุญาตเฉพาะ `list`/`get_manual_result` เมื่อข้าม section
- ก่อน import ต้องตรวจว่ากลุ่มผู้ใช้ X-ray มีสิทธิ์เรียก Process นี้ แล้วทดสอบใน Builder/Preview
  และ runtime จริงด้วยบัญชี X-ray

---

### 5.4 แท็บผลอ่านและปุ่มลงมาอยู่ระดับ item (2026-09-02)

**ส่งเข้าเครื่องทีละรายการ ⇒ ผลมาทีละรายการ ⇒ ปุ่มต้องอยู่ระดับ item**

- ระดับ order เหลือปุ่ม **EMR** อย่างเดียว (แถวที่ยกเลิกแล้วเป็น **ตรวจใหม่**)
  `row.can_pdf` / `row.first_result_item` ยังคำนวณอยู่ แค่ไม่ได้แสดง
- ตารางผลอ่าน: `ลำดับ · รายการตรวจ · เครื่อง · ผู้ส่ง · เวลาออกผล · สถานะ · [ดูผล][ดูภาพ][PDF]`
  (`min-width` 948 → 1020)
- **สถานะในแท็บผลอ่านใช้ชุดเต็มเหมือนแท็บ order** — `รอรับ / ส่งเครื่องแล้ว / ออกผลแล้ว /
  ค้าง · ยังไม่ได้เลข / ส่งเครื่องไม่สำเร็จ` ถ้าโชว์แค่ "รอผลอ่าน/ออกผลแล้ว" จะไม่รู้ว่า
  รายการไหนยังไม่ได้ส่งเข้าเครื่องเลย
- **ผู้ส่ง** = คนที่กดส่งเข้าเครื่องของรายการนั้น (คนละรายการอาจคนละคน)
- **ดูผล / ดูภาพ กดได้เสมอ** ยังไม่มีผลก็เปิดดูสถานะรอผลได้ · **PDF** เปิดเมื่อออกผลแล้ว
  เท่านั้น

### 5.5ข เส้นแบ่ง "ผลของรอบนี้" = เลข Accession ไม่ใช่เวลา (2026-09-16 · ผู้ใช้สั่ง)

กติกาเดิม 2026-09-02 บังคับว่า `resulted_at` ต้องไม่เก่ากว่า `dispatched_at` ไม่งั้นไม่นับ
ว่าออกผล — จำเป็นตอนที่ **ส่งตรวจซ้ำยังใช้เลข Accession เดิม** เวลาจึงเป็นทางเดียวที่แยกรอบได้

2026-09-03 ผู้ใช้สั่งให้ **ส่งตรวจซ้ำ/ตรวจใหม่ ออกเลข Accession ใหม่เสมอ** ⇒ รอบใหม่ = เลขใหม่
และผลถูก join ด้วย `AccessionNo` ⇒ ผลที่เจอใต้เลขปัจจุบันเป็นของรอบนี้โดยนิยาม
กติกาเทียบเวลาจึงเหลือแต่สร้าง false negative — **2026-09-16 พบว่ากินทุกใบที่มีผลในระบบ**
(RIS ส่ง `ResultDateTime` เป็นเวลาที่ตรวจจริงตอนเช้า แต่เรากดส่งเข้าเครื่องตอนบ่าย)

- **ตัดการเทียบเวลาออกทั้งฝั่ง server (`effective_status`) และฟอร์ม (`resultIsCurrent`)**
  ⇒ มีผลอ่านใต้ Accession ปัจจุบัน = ออกผลแล้ว
- **มีผลอ่าน = ป้ายขึ้น "ออกผลแล้ว"** ไม่ให้ `transport_failed` บังอีกต่อไป · ข้อความ
  transport ที่ล้มยังอยู่ครบในคอลัมน์ "เวลาส่งเข้าเครื่อง" (ตัวแดง) ไม่ได้ซ่อน
- **`dispatched_at` เลื่อนเฉพาะรอบใหม่จริง** — กดส่งใหม่เพราะ forward ล้ม/`retry_only`
  ใช้เวลาเดิม (ใบเดิมที่ยังไปไม่ถึงปลายทาง) แต่ยังบันทึก `resent_at`/`dispatch_count`
  ใช้เงื่อนไขตัวเดียวกับที่ตัดสินว่าจะล้างเลข Accession หรือไม่ (`isNewRound`)
- แถบ/ป้าย "ไม่ใช่ผลรอบนี้" ที่เพิ่มไว้ 2026-09-15 ถูกถอนออก (สภาพนั้นไม่มีวันเกิดอีก)

🔴 **ถ้าวันหนึ่งกลับไปใช้เลข Accession เดิมซ้ำในรอบใหม่ ต้องเอากติกาเทียบเวลากลับมา**
- **ดูภาพ ต่อกับ viewer ของ RIS แล้ว 2026-09-15 (D-X17)** — เปิดแท็บใหม่ไปที่
  `<RIS_VIEWER_BASE>?QueryMode=AN&Value=<Accession No.>` และตกไป
  `?QueryMode=PID&Value=<HN>` เมื่อรายการยังไม่มีเลข Accession
  - ค่าเริ่มต้นของ base คือ `http://localhost:9090` = **เครื่องของผู้ใช้เอง**
    ⇒ ต้องเปิดจาก browser (`window.open`) ห้ามทำเป็น Process ฝั่ง server
    และ **ไม่ต้องเพิ่ม API ตัวใหม่** เพราะ HN/Accession อยู่ใน payload ของ worklist เดิม
  - ✅ `RIS_VIEWER_ENABLED=true` **เปิดใช้งานแล้ว** ตามคำสั่งผู้ใช้ 2026-09-15
    ("ก็ใส่ลิ้งแล้วเปิดให้กดเป็น newtab ได้เลย") ⇒ กดแล้วเปิดแท็บใหม่จริงทุกครั้ง
    วินาทีที่ RIS เปิดเส้นทาง ภาพขึ้นทันทีโดยไม่ต้อง import ฟอร์มใหม่
  - ⚠️ ระหว่างที่ RIS ยังไม่เปิดเส้นทาง แท็บใหม่จะขึ้นหน้า error ของ browser
    (`ERR_CONNECTION_REFUSED`) ไม่ใช่ข้อความของเรา — ผู้ใช้รับทราบและเลือกแล้ว
  - สวิตช์ยังอยู่ครบทั้งสองทาง: ปิดกลับได้ด้วยการ generate ใหม่โดยไม่ตั้ง env
    แล้วแก้ assertion ใน `test_xray_cpoe_worklist_form.js` กลับ
    · เปิด/เปลี่ยน base: `XRAY_RIS_VIEWER_ENABLED=1 XRAY_RIS_VIEWER_BASE=http://<host>:9090
    node Form-Builder/seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js`
  - ⚠️ ยังไม่ยืนยันว่า `PID` ของ Envision = HN ของเราตรง ๆ — ถามพร้อมตอนขอเปิดลิงก์

### 5.5ก ประวัติการแก้ผลอ่านใน popup (2026-09-15 · ผู้ใช้อนุมัติดีไซน์แล้ว)

RIS `insert` แถวใหม่ทุกครั้งโดยตั้งใจ ⇒ ผลอ่านทุกฉบับอยู่ใน `zdata_xray_result` ครบ
เดิมเราคืนแค่ฉบับล่าสุด popup จึงทิ้งประวัติที่มีอยู่แล้ว

- `get_report` เพิ่ม **`versions[]`** (ใหม่→เก่า · `versions[0]` = ล่าสุดเสมอ) ต่อฉบับมี
  `no` `latest` `result_text` `reported_at` `radiologist_uid` `severity_uid`
  `result_status` `performed_at` `received_at` `message_control_id` `result_id`
  พร้อม `versions_capped` (ชน limit 20 แถวเดิม) — **เพิ่มล้วน** ฟิลด์ระดับบนสุดทุกตัว
  ยังเป็นฉบับล่าสุดเหมือนเดิม
- popup: ปุ่ม **ประวัติการแก้ N ฉบับ** (โผล่เมื่อมีมากกว่า 1) กางไทม์ไลน์ซ้าย กดสลับฉบับได้
  · ดูฉบับเก่าขึ้นแถบเตือนสีอำพัน + ปุ่มไปฉบับล่าสุด · ปิดประวัติ = เด้งกลับฉบับล่าสุดเสมอ
  · ไฮไลต์บรรทัดที่ต่างจากฉบับก่อน (ปิดได้) · หัว/ท้าย dialog เดินตามฉบับที่กำลังดู
  · ช่อง **เครื่อง** เหลือตัวย่อ ชื่อเต็มอยู่ที่ tooltip (กติกาเดียวกับตาราง)
- **ไม่ join `zdata_xray_resultreset`** — ผู้ใช้ตัดหมุด "ถอนผล" ออกจากไทม์ไลน์
  2026-09-15 เพราะทุกฉบับถูกเก็บไว้ครบอยู่แล้ว แถว audit ยังอยู่ในฐานข้อมูลเหมือนเดิม
- Process รุ่นเก่าที่ยังไม่คืน `versions[]` ⇒ popup ตกกลับไปหน้าตาเดิมทุกประการ
  แล้วขึ้นข้อความบอกว่าต้องเอาโค้ดล่าสุดของ `xray_cpoe_worklist_api.js` ไป replace ก่อน
- รังสีแพทย์ยังเป็น **รหัส** ต่อฉบับ (คนละฉบับคนละคนได้) ไม่มี master ให้ map เป็นชื่อ
  ⇒ ฉบับที่ RIS ไม่ส่งรหัสมาให้เว้นว่าง **ห้ามยืมรหัสของฉบับล่าสุดมาเติม**

**ช่องผู้รับรองผลใน popup** — มีช่องกรอกแล้ว แต่ **ยังไม่บันทึกลงฐานข้อมูล**
ไม่ได้ทำปุ่มบันทึกไว้หลอก เพราะยังไม่เคาะว่าเก็บที่ไหน ใครมีสิทธิ์รับรอง และนับเป็น
audit event หรือไม่ · ค่าถูกล้างทุกครั้งที่ปิด dialog

### 5.6 สแกนบาร์โค้ด HN (2026-09-02 · pattern เดียวกับ LAB)

`scan-code-ui` `scan-code-ui-xray-hn` อยู่ระดับ root ตามแบบ PIS/LAB — ตั้งค่าเดียวกัน
(`target: document` · `suffixKeyCodes: [13]` · `minLength: 6` · `preset: both`)
แต่ **id และ handler เป็นของ X-ray** สร้างโดย generator อย่างตั้งใจ ไม่ใช่ติดมาจาก LAB (§5.5)

`onScan` ส่ง **ค่าดิบ** ให้ `xray_cpoe_worklist` → `state.scanPatientHn(raw)`
การแปลงและตรวจความยาวอยู่ที่ widget ที่เดียว ไม่งั้นสองที่จะตรวจคนละเกณฑ์แล้วเพี้ยน
· `form.showPopupFlag` เปิดอยู่ = ไม่สลับผู้ป่วยกลางคัน (กฎเดียวกับ LAB)

**⚠️ คีย์บอร์ดโหมดภาษาไทย** — เครื่องสแกนพิมพ์เหมือนคีย์บอร์ด ถ้าเครื่องค้างอยู่โหมดไทย
ตัวเลขจะกลายเป็นอักษรไทยตามผัง Kedmanee · HN `6900001` อ่านได้เป็น `ุตจจจจๅ`
(ยืนยันจาก runtime ฝั่ง LAB 2026-09-02) ถ้าไม่แปลงกลับ จะโดน `\D` ตัดจนเหลือค่าว่าง
แล้วขึ้นว่า HN ไม่ถูกต้องทุกครั้งโดยไม่มีใครเดาสาเหตุถูก

`normalizeScanDigits()` แปลงกลับด้วยผัง `ๅ/-ภถุึคตจ → 1234567890` และ
**แปลงเฉพาะเมื่อเจออักษรไทยจริง ๆ** เพื่อไม่ให้ `-` หรือ `/` ใน barcode ปกติถูกแปลงผิด

**พฤติกรรมโหมดสแกน**

- ล้างคำค้นเดิมทิ้ง เพราะสองอย่างนี้ตีกันแล้วผู้ใช้จะงงว่าทำไมไม่เจอ
- ส่งเฉพาะ `hn` (+ตัวกรองเครื่องถ้ามี) · **ไม่ส่งช่วงวันที่และคำค้น** ⇒ API เห็น `hn`
  แล้วยกเลิกช่วงวันที่ค่าเริ่มต้นให้เอง (Appendix B) จึงเห็นประวัติทุกวันของ HN นั้น
- **ต้องตัดวันที่ทั้ง rows และ counts พร้อมกัน** ไม่งั้น chip กับตารางจะไม่ตรงกันอีก
- คง HN ไว้เมื่อเปลี่ยนแท็บสถานะ · ออกจากโหมดด้วย `ล้าง HN ที่สแกน` หรือกด **Search**
- ช่อง Date Range ถูก disable ระหว่างสแกน เพราะไม่มีผล — ดีกว่าปล่อยให้กดแล้วเงียบ
- แถบสีฟ้าบอกว่าอยู่โหมดไหนและ HN อะไร · ไม่พบรายการจะบอกว่าไม่พบ **ของ HN นี้ในสถานะนี้**
- **สแกนไม่เปลี่ยนสถานะ ไม่ออกเลข Accession ไม่ส่งเข้าเครื่อง** — อ่านอย่างเดียวล้วน

### 5.5 ห้ามให้ของ LAB รั่วเข้ามาในฟอร์ม X-ray

`build_xray_cpoe_worklist_ui.js` ลอกโครงมาจาก `lab-cpoe-worklist-waiting-v1.json`
**ทั้งไฟล์** ⇒ ทุก field ที่ฝั่ง LAB เพิ่มที่ระดับ root จะติดมาด้วยโดยไม่มีใครสั่ง

เกิดจริง 2026-09-02: widget `scan-code-ui` "Scan HN" ที่ LAB เพิ่ม (commit `83ae7b2`)
โผล่ในฟอร์ม X-ray โดยไม่ได้ผูกกับ logic อะไรเลย

⇒ generator ตัดให้เหลือเฉพาะ container ของตัวเอง (`form.fields = [grid]`) แล้วค่อย
สร้างวิดเจ็ตของ X-ray เองต่อท้าย (§5.6) · เทส `test_xray_cpoe_worklist_form.js`
บังคับว่า root มีได้ 2 ตัวคือ container กับ `scan-code-ui-xray-hn` เท่านั้น และห้ามมี
`lab_cpoe_worklist` หรือ `scan-code-ui-lab-hn` ปนมา
**ห้ามผ่อน assertion นี้เป็น "มีกี่ตัวก็ได้"** — มันคือตัวที่จับเรื่องนี้ได้

### 5.3 ปรับตาราง 2026-09-02

- **ตัดคอลัมน์ "เวลาสถานะ" ออก** — ระดับ item มี `เวลาส่งเข้าเครื่อง` อยู่แล้ว
  เหลือ 9 คอลัมน์ · `min-width` 1259 → 1149 (ลดเท่าคอลัมน์ที่หายพอดี)
  **`s.statusTime()` และ `row.status_time_*` ยังคำนวณอยู่** เพราะเป็นแกนเดียวกับที่
  API ใช้กรอง Date Range (`status_date`) และเอากลับมาแสดงได้ทันทีถ้าเปลี่ยนใจ
- **แท็บ "ผลอ่าน" กดได้เสมอ** ไม่ disable แล้ว เพื่อให้เปิดดูโครงตารางได้ก่อน
  แม้ยังไม่มีผลจริง · ทุกรายการจะขึ้นเป็น "รอผลอ่าน"
- **ตัด tooltip ของแถวระดับ item ออก** — ไม่มี `:title` ทั้งที่แถวและที่ checkbox
  ข้อความ `select_hint` ยังอยู่ในข้อมูลแถว เผื่อใช้ที่อื่นและยังมีเทสคุมอยู่

### 5.2 ตัวกรองเครื่องเป็น multi-select (ปรับล่าสุด 2026-09-11)

เลือกได้หลายเครื่องพร้อมกัน — ใบไหนมีเครื่องใดเครื่องหนึ่งที่เลือกไว้ก็เข้าข่าย
(ใบที่มี CT+DX ติดทั้งสองตัวกรอง เพราะเทียบกับ **ทุกเครื่องในใบ** ไม่ใช่ของ item ตัวแรก)

- `s.modality` เป็น **array ของ code** · ว่าง = ไม่กรอง ซึ่งให้ผลเท่ากับ "Select all" เดิม
- ตัวเลือก `<el-option value="">` ถูกแทนด้วย `clearable` + placeholder — ความสามารถเดิมไม่หาย
- **ยกเลิกรายตัวด้วยการกดซ้ำที่แถวใน dropdown** (พฤติกรรมมาตรฐานของ el-select multiple)
  ปุ่มกากบาทรายเครื่องที่เคยเพิ่มไว้ถูกตัดออก 2026-09-02 เพราะซ้ำซ้อน — เมธอด
  `unpickModality` ยังอยู่เป็นทางเรียกแบบระบุตัวและยังมีเทสคุมพฤติกรรม
- ตัวเลือกและ tag ที่เลือกแสดง **ตัวย่อ code เท่านั้น**; ชื่อเต็มอยู่ใน `title`
- **แสดงทุก code ที่เลือก ห้ามยุบเป็น `+N`** · trigger มีฐาน `186px` เท่ากันเมื่อ
  เลือก 0–3 code สั้น และไม่กระโดดความกว้างเมื่อเพิ่ม code ที่ 4; จัดแท็กไม่เกิน
  **3 ตัวต่อแถว** ตัวที่ 4 ขึ้นบรรทัดใหม่ ความกว้างขยายเฉพาะเมื่อ code ยาวจน
  คอลัมน์แท็กต้องการพื้นที่เพิ่ม ไม่เผื่อพื้นที่ input ที่ซ่อนอยู่ ไม่โตตามจำนวนแถว;
  หน้าจอแคบมากลดเหลือ 2 คอลัมน์
- ก่อนเลือก ค่า `Select all` ต้องอยู่กึ่งกลางแนวตั้ง; หลังเลือกจึงจัด tag ชิดบนเพื่อให้หลายแถว
  เพิ่มความสูงลงล่างโดยไม่ทำให้ปุ่มข้างเคียงขยับ
- สีฟ้าใช้เฉพาะ tag ที่เลือกใน textbox; ตัวกล่อง, label และพื้นหลัง option ใน dropdown
  คงขาว/เทาตาม Element Plus เดิม
- selector ของ popper ยังต้อง **ไม่มี prefix `.xray-cpoe`** เพราะ teleport ออกไปนอก root

ฝั่ง API `params.modality` รับได้ทั้ง **array, CSV และค่าเดี่ยว** (`listText`) แล้วกรองด้วย
`{ modality_codes: { $in: [...] } }` · `data.modality` ยังคืนค่าเดิมสำหรับผู้เรียกเก่า
(เลือกตัวเดียวได้ค่าเท่าเดิม เลือกหลายตัวได้ CSV) และเพิ่ม `data.modality_codes` เป็น array

dropdown ยังโชว์ทุกเครื่องพร้อมจำนวนเสมอ แม้เลือกไปแล้วหลายตัว (`modality_counts`
ไม่ถูกกรอง) จะได้เพิ่มเครื่องเข้าไปอีกได้โดยไม่ต้องล้างตัวกรองก่อน

### 5.4 คอลัมน์ "สถานะ" ระดับ order เป็นเช็คลิสต์ (ผู้ใช้ขอ 2026-09-03)

หน้าทั่วไป (ตารางรวมทุก order) เท่านั้น — ตารางระดับ item ในแท็บ `order` และแท็บ
`ผลอ่าน` ยังใช้ป้ายสถานะเดิมทุกประการ

- ป้ายเดียวรวมทั้งใบ (`xr-row-status`) ถูกแทนด้วยเช็คลิสต์ **4 ช่องคงที่** เรียงตาม
  เส้นทางจริงของรายการ: `รอรับ` → `รอผลตรวจ` → `ออกผลแล้ว` → `ยกเลิก / ปฏิเสธ`
- **เป็น "ความคืบหน้า" ไม่ใช่ภาพนิ่งของสถานะปัจจุบัน** (ผู้ใช้แก้ 2026-09-03 รอบสอง
  หลังเห็นของจริง — ใบที่ส่งเครื่องแล้วโชว์ช่อง `รอรับ` ว่าง เหมือนไม่เคยรับ):
  | สภาพของช่อง | แสดง |
  |---|---|
  | มีรายการค้างอยู่ที่ขั้นนี้ | จุดสี + **จำนวน item** |
  | ไม่มีรายการค้าง แต่มีรายการผ่านขั้นนี้ไปแล้ว | จุดสี + **เครื่องหมายถูก** |
  | ยังไม่มีรายการไปถึง | **เว้นว่าง** |
- `ยกเลิก / ปฏิเสธ` **ไม่อยู่ในเส้นทางเดิน** (`s.STEP_ORDER` มีแค่สามขั้นแรก) — ยกเลิกแล้ว
  ไม่ได้เดินต่อ จึงไม่ทำให้ขั้นก่อนหน้ากลายเป็น "ผ่าน" และตัวมันเองไม่มีวันขึ้นเครื่องหมายถูก
- ทุกช่องกว้างเท่ากัน `24px` และเครื่องหมายถูกขนาดเท่าจุด (`11px`) ความกว้างจึงไม่ขยับ
  ดอตอยู่ตรงคอลัมน์เดียวกันทุกแถว เทียบด้วยตาได้ทันที
- hover ที่ดอตเห็นชื่อสถานะ + จำนวน (หรือ `ผ่านขั้นนี้แล้ว N รายการ`) · hover ทั้งช่อง
  เห็นสรุปทั้งใบ (`row.status_aria`) ซึ่งขึ้นต้นด้วยป้ายรวมเดิม เช่น
  `รอผลตรวจ · รอรับ ผ่านแล้ว · รอผลตรวจ 1 รายการ`
- **`row.status_label` / `row.status_class` ยังใช้ state เดิม** แต่เปลี่ยนคำของช่วงหลังส่งเป็น
  `รอผลตรวจ` และใช้สีส้ม; ค่ายังถูกใช้ใน `title` / `aria-label` ของเช็คลิสต์
- ใบที่ยกเลิกทั้งใบ (`order.cancelled === true`) นับ item ทุกตัวเป็น `ยกเลิก / ปฏิเสธ`
  แม้ CPOE ยังไม่ได้อัปเดตรายตัว — ไม่งั้นจะโชว์ดอต `รอรับ` ค้างขัดกับป้ายรวมของแถวเอง
- ความกว้างคอลัมน์ `84px → 108px` · worklist `min-width` `1149 → 1173`
  **คอลัมน์อื่นไม่ถูกแตะ** (คอลัมน์ที่ยืดหยุ่นรับส่วนต่างไปเอง)
- legend ทางขวาของแถบ status chip แสดงครบ: จุดสีเหลืองอ่อน `รอรับ`, สีส้ม
  `รอผลตรวจ`, สีเขียว `ออกผลแล้ว`, สีแดง `ยกเลิก` ใช้รหัสสีเดียวกับจุดจริงในคอลัมน์
  สถานะและมี `aria-label`
- เทสที่คุมไว้: `test_xray_cpoe_worklist_form.js` (โครง 4 ช่อง · ลำดับ · จำนวน ·
  ขั้นที่ผ่านแล้ว · ยกเลิกไม่ทำให้ขั้นก่อนหน้าเป็นผ่าน · ใบยกเลิกทั้งใบ · ใบไม่มี item ·
  ป้ายระดับ item ต้องไม่เปลี่ยน)

### 5.5 ปรับหน้าจอรอบ UAT (ผู้ใช้สั่ง 2026-09-03)

ห้าข้อนี้มาจากการดูของจริงหลัง import รอบแรก

| # | เปลี่ยนอะไร | ของเดิมที่ยังอยู่ |
|---:|---|---|
| 1 | **ตัดช่อง `ผู้รับรองผล`** ออกจาก popup ผลอ่าน | `report.certified_by` / `setReportCertifier` ยังอยู่ครบ เอากลับมาแสดงได้ทันที |
| 2 | **เพิ่มคอลัมน์ `รังสีแพทย์`** ระดับ item ใน **แท็บ order** (mockup) | คอลัมน์เดิมทั้ง 10 ไม่ถูกตัดหรือย่อ · grid 11 คอลัมน์ · `min-width 1226 → 1386` |
| 3 | **ตัดปุ่ม `PDF`** ระดับ item ใน **แท็บผลอ่าน** | `item.can_pdf` / `pdf_hint` ยังคำนวณ · `min-width 1020 → 956` |
| 4 | **ส่งตรวจซ้ำ / ตรวจใหม่ = Order เดิม เลข Order เดิม แต่ล้างเลข Accession แล้วออกใหม่ตอนส่ง** | `retry_only` และรายการที่ transport ล้มเหลวยังใช้เลขเดิม |
| 5 | **กล่องแดงเตือนแพ้ยา / COVID** ในคอลัมน์เดียวกับห้องต้นทาง/การเงิน | ป้ายห้องต้นทาง ชำระเงิน สิทธิ์ ยังอยู่ครบใต้กล่อง |

**#2 รังสีแพทย์เป็น mockup จริง ๆ** — ตัวเลือกคือ `radiologist1` / `radiologist2`
ค่าที่เลือกอยู่ในหน้าจอรอบนั้นเท่านั้น: ไม่ส่งเข้า API ไม่บันทึกลงฐานข้อมูล และหายเมื่อกด
Search/เปลี่ยนหน้า · เก็บที่ `s.radiologist[item_id]` แยกจาก `s.selected` ของการติ๊กส่งเครื่อง
ยังต้องเคาะ: master รังสีแพทย์มาจากไหน · เก็บที่ฟิลด์ไหนของ item · ใครแก้ได้

**#4 เปลี่ยนสัญญาที่เคยยืนยันไว้ 2026-09-02** (เดิม: ส่งตรวจซ้ำใช้เลข Accession เดิม
เพราะ RIS upsert ด้วย AccessionNo) กติกาใหม่:

- `xray_cpoe_dispatch_api.js` ล้าง `accession_no` ของ item ก่อนออกเลข แล้ว `$push`
  `accession_history[{accession_no, cleared_at, cleared_by, reason:'resend'}]`
- ตัวออกเลขเป็น idempotent ด้วยเงื่อนไข "accession_no ยังว่าง" ⇒ ล้างก่อนจึงได้เลขใหม่
- **ห้ามล้างสองกรณี**: `retry_only` และรายการที่ `transport.status = failed` ค้างอยู่ —
  รอบนั้น RIS ยังไม่เคยได้ใบ ใช้เลขเดิมถูกแล้ว (เทสคุมไว้ทั้งสองเส้นทาง)
- ผลข้างเคียงที่ต้องรู้: ผลอ่านรอบก่อนอยู่ใต้เลขเก่า ⇒ หน้าจอจะกลับไปเป็น "รอผลอ่าน"
  ของรอบใหม่ · ตามผลเก่าได้จาก `accession_history` (ยังไม่มีหน้าจอให้ดู)

**#5 แหล่งข้อมูลกล่องแดง** — `xray_cpoe_worklist_api.js` join เพิ่มสองตัวใน rows facet
(หลัง `$limit` เหมือน Diagnosis จึงอ่านเฉพาะคนไข้ในหน้านั้น) แล้วสรุปเป็น `patient.alerts`:

- `zdata_person.allergy_main[]` — ประวัติการแพ้ยาตัวจริง (join ด้วย `pid.value`, เทียบ `$toString`)
- `zdata_patient_assessment.drug_allergy` / `food_allergy` — ราย visit
- COVID: **Diagnosis ของ visit** (ผู้ใช้เลือกแหล่งนี้ 2026-09-03) — ICD `U07*` หรือชื่อโรคมี
  covid/โควิด/sars-cov · HIS ยังไม่มีฟิลด์สถานะ COVID โดยเฉพาะ
- ข้อความปฏิเสธ (`ไม่มี` `ปฏิเสธ...` `NKDA` `-`) ถูกคัดออก **ห้ามยกขึ้นกล่องแดง** เพราะจะกลาย
  เป็นเตือนกลับด้าน · ไม่มีข้อมูล = ไม่ขึ้นกล่อง ไม่ใช่กล่องเปล่า
- UI ห้าม derive เอง อ่าน `patient.alerts` อย่างเดียว (Process รุ่นเก่าที่ยังไม่มีฟิลด์นี้ไม่พัง)

### 5.6 รอบแก้หลังดูของจริงครั้งที่สอง (ผู้ใช้สั่ง 2026-09-03)

| # | เปลี่ยนอะไร | หมายเหตุ |
|---:|---|---|
| 1 | ป้ายเตือนแพ้ยา/COVID ใช้ **ทรงเดียวกับป้ายอื่นในคอลัมน์** (`min-height 21px` · `padding 1px 8px` · `border-radius 999px` · `font-size 10px`) ต่างแค่สีแดง | ไม่ใช้คลาส `xr-meta-pill` ตรง ๆ เพราะกฎ `.xr-context-tags>.xr-meta-pill` จะย้อมส้มทับ |
| 2 | เอา **เส้นประใต้ `N รายการ`** ออก | tooltip รายชื่อ test ยังทำงานเหมือนเดิม |
| 3 | รายชื่อ **รังสีแพทย์** เป็นชื่อจริง 5 คน (ชื่อ-นามสกุล ไม่เอาตำแหน่ง) | ยัง **ไม่บันทึก** — mockup เหมือนเดิม |
| 4 | คอลัมน์ **`ผู้ส่ง` → `Radiographer`** เป็น dropdown 8 ชื่อ **บันทึกจริง + เก็บ log** | ค่าเดิม (คนกดส่ง) ไม่หาย ย้ายไปอยู่ tooltip ของช่อง |

**#4 การบันทึกและ log** — เพิ่ม action `set_staff` ใน Process worklist ตัวเดิม
(ไม่มี Process ID ใหม่ · ทรงเดียวกับ `cancel_order`)

```
{action:'set_staff', organization_code, order_id, item_id, radiographer}
  → {success, data:{item_id, radiographer, previous, changed, at, by}, message}
```

- เขียนที่ item: `radiographer` · `radiographer_at` · `radiographer_by`
- **`$push radiographer_log[]`** ทุกครั้งที่เปลี่ยน เก็บ `{value, previous, action, at, by}`
  · การล้างค่าก็ถูกบันทึกเป็น `action:'clear'` ไม่ใช่ลบเงียบ · กดค่าเดิมซ้ำไม่สร้าง log ขยะ
- **ไม่แตะ `dispatched_by`** — นั่นคือบัญชีที่กดปุ่มส่งเข้าเครื่อง คนละความหมายกับผู้ถ่าย
- ปฏิเสธ: หน่วยงานไม่ใช่รังสี · `item_id` ผิดรูป · ไม่ส่งฟิลด์มาเลย · ยาวเกิน 120 ตัวอักษร ·
  รายการ LAB · รายการที่ยกเลิก/ปฏิเสธแล้ว · หา item ไม่เจอ
- `list` คืน `radiographer` / `radiographer_at` กลับมาด้วย ค่าที่เลือกจึงไม่หายหลังรีเฟรช
- ฝั่งฟอร์มเป็น optimistic update: ขึ้นค่าทันที แต่ถ้า server ปฏิเสธ **ย้อนกลับค่าเดิม**
  ห้ามปล่อยให้จอโชว์ชื่อที่ไม่ได้ถูกบันทึกจริง · แก้ค่าในข้อมูลดิบแล้ว recompute
  ไม่เรียก `loadOrders` เพราะจะพับแถวที่กางอยู่และล้างที่ติ๊กไว้ทิ้ง
- เทส: `test_xray_set_staff_api.js` (บันทึก · เปลี่ยนคน · ล้างค่า · กดซ้ำ · ทุกกรณีที่ต้องปฏิเสธ)

**ข้อยกเว้นที่ต้องรู้** — รายชื่อรังสีแพทย์/Radiographer ยัง **hard-code ในฟอร์ม**
ตามเอกสารที่ผู้ใช้ส่งมา ซึ่งขัดกับข้อห้าม "ห้าม hard-code ชื่อผู้ใช้" ใน `Xray_design.md`
เพราะยังไม่มี master เจ้าหน้าที่ในระบบ · ย้ายไปอ่านจาก master ทันทีที่มี
(ฝั่ง API ไม่ได้ whitelist ชื่อไว้ จึงเปลี่ยนรายชื่อที่ฟอร์มที่เดียวได้เลย)

**คอลัมน์ตาราง item** — `ผู้ส่ง 116px → Radiographer 150px` · `min-width 1386 → 1420`
แท็บผลอ่านยังมีคอลัมน์ `ผู้ส่ง` แบบอ่านอย่างเดียวเหมือนเดิม ไม่ถูกแตะ

### 5.7 ปุ่ม "ตรวจใหม่" ใช้งานได้จริง + เก็บกวาดหน้าจอ (ผู้ใช้สั่ง 2026-09-03; จำกัดรายรายการ 2026-09-18)

**ปุ่มตรวจใหม่** เดิมกดแล้วขึ้นข้อความบล็อก (decision X9) — ผู้ใช้กำหนดกติกาใหม่ที่ทำได้เลย
โดยไม่ต้องรอ contract ฝั่ง RIS เพราะเป็นการทำงานภายในฝั่งเราล้วน:

> เลือกรายการที่ยกเลิกแล้วใน Order เดิม กดตรวจใหม่เฉพาะที่เลือก · รายการเหล่านั้นกลับไปรอรับ
> · มีเลข Accession ให้ล้าง · แล้วค่อยกดส่งเข้าเครื่องเพื่อออกเลขใหม่
> · **เลข Order เดิม**

Form ใหม่เรียก action `retest_items` ใน Process worklist ตัวเดิม (ไม่มี Process ID ใหม่);
Process ใหม่ยังรับ `retest_order` จาก Form เก่า แต่บังคับ `item_ids` เช่นกัน:

```
{action:'retest_items', organization_code, order_id, order_number, item_ids:[item_id,...]}
  → {success, data:{order_id, order_number, current_status:'sent',
                    item_ids, reopened_item_count, cleared_accession_count, audit_sync_pending}}
```

- บังคับ `item_ids` อย่างน้อย 1 ID ที่ไม่ซ้ำ อยู่ใน Order นี้และเป็น X-ray เท่านั้น; client เก่าที่ไม่ส่ง
  IDs ถูกปฏิเสธ ไม่เดาว่าต้องการทั้งใบ · ตรวจทุกตัวก่อนเขียน หากตัวใดไม่อยู่ในสถานะที่เปิดได้
  ปฏิเสธทั้งชุด
- action ใหม่ป้องกัน Form ใหม่ยิง `retest_order` บน Process รุ่นเก่าซึ่งยังเปิดกลับทั้งใบ;
  Process เก่าไม่รู้จัก `retest_items` และคำตอบทรง list ถูกฟอร์มปฏิเสธ
- ปลุกเฉพาะ item **ที่เลือก** และสถานะเป็น `cancelled/rejected/returned/reversed` → `sent`
  · sibling ไม่ถูกเลือกคงสถานะ/Accession/ประวัติเดิม
  · ใบที่ **ออกผลแล้ว** ไม่ใช่งานของปุ่มนี้ (ใช้ `ส่งตรวจซ้ำ` ในแท็บ order)
- ล้างร่องรอยรอบก่อนให้แถวเป็น "รอรับ" จริง: `accession_no` · `dispatched_at/by` · `resent_at` ·
  `transport` · `transport_failed` · `cancel_reason/cancelled_at/cancelled_by/cancel_type/`
  `cancellation_record_id` — ถ้าไม่ล้าง หน้าจอจะอ่านว่ารอบนี้เคยส่งไปแล้ว
- เก็บร่องรอย: `$push retest_log[{from_status,to_status,cleared_accession_no,at,by}]` และเลขเดิม
  ลง `accession_history[{…, reason:'retest'}]` ที่เดียวกับการส่งตรวจซ้ำ
- **ไม่ลบบันทึกการยกเลิก** ใน `zdata_xray_order_cancellation` — `reopen_log[]` ระบุ `item_ids`
  ที่เปิดครั้งนี้; คง `cancel_status:'applied'` ถ้ารายการอื่นในชุดที่ยกเลิกยังไม่ถูกเปิด
  และเป็น `reopened` เมื่อเปิดครบ · เหตุผลเดิมยังอ่านได้
- `cancel_order` รับ `reopened` เพิ่มในชุด `$in` ของการประทับ `applied` ⇒ ใบที่เคยตรวจใหม่แล้ว
  ถูกยกเลิกอีกครั้งจะไม่ค้างเป็น "รอ reconcile"
- ใช้ compare-and-set กับสถานะเดิมของแต่ละ item — ชนกับคนอื่นแล้วคืน `retest_race_lost`
- ปุ่มบนแถว Order ที่ยกเลิกทั้งหมดเปิดตาราง item ให้เลือกก่อน; ใบที่ยกเลิกบางส่วนก็มี
  `ตรวจใหม่เฉพาะที่เลือก` ในแท็บ order. การติ๊กปนกับรายการที่ยังส่งได้จะปิดปุ่มทั้งตรวจใหม่
  และส่งเข้าเครื่องจนกว่าจะเลือกเฉพาะสถานะที่สอดคล้อง
- เทส: `test_xray_retest_order_api.js`

**เก็บกวาดหน้าจอรอบเดียวกัน**

| เปลี่ยน | เหตุผลที่ผู้ใช้ให้ |
|---|---|
| หัวคอลัมน์ `รังสีแพทย์` → **`Radiologist`** | ให้เข้าชุดกับ `Radiographer` |
| **ตัด toast ตอนบันทึก Radiographer สำเร็จ** | "รังสีแพทย์ยังไม่มี noti เลย" — ให้เงียบเหมือนกัน |

**toast ที่ยังเหลือ**: กรณี **บันทึกไม่สำเร็จ** ยังเตือนอยู่ เพราะค่าจะถูกย้อนกลับเป็นค่าเดิม
ถ้าเงียบด้วยผู้ใช้จะเห็นชื่อหายไปเฉย ๆ แล้วนึกว่าระบบบันทึกให้แล้ว

**กันหน้าจอโกหกเมื่อ Process ที่ deploy อยู่ยังเก่า (เพิ่ม 2026-09-03)**

อาการที่ผู้ใช้เจอ: กด `ตรวจใหม่` แล้ว "ใช้ไม่ได้" ทั้งที่โค้ดในรีโปครบแล้ว — สาเหตุคือ
Process ที่ deploy อยู่ยังไม่มี action ใหม่ ฟอร์มจึงได้คำตอบที่ไม่ใช่ผลของ action นั้น

- `s.actionAnswered(p, key)` ตรวจ **ทรงของคำตอบ** ไม่ใช่ดูแค่ `success` — เจอ `data.orders`
  (ทรงของ `list`) หรือไม่มีคีย์ที่ action ต้องคืน = ถือว่า Process ยังไม่รู้จัก action นี้
- ขึ้นข้อความบอกตรง ๆ ว่าต้องเอา `xray_cpoe_worklist_api.js` ล่าสุดไป replace body ก่อน
  แทนที่จะขึ้น "เปิดตรวจใหม่แล้ว" ทั้งที่ไม่มีอะไรเปลี่ยน
- ใช้กับทั้ง `retest_order` (`reopened_item_count`) และ `set_staff` (`item_id`) ·
  ฝั่ง Radiographer ย้อนค่าเดิมบนจอด้วย ไม่ปล่อยให้ชื่อค้างทั้งที่ไม่ได้บันทึก

**หมายเหตุเรื่องหัวข้อ toast เป็นตัวเลข** (เช่น "2600" / "3600") — ภาพ HIS runtime
ยืนยันว่า wrapper `notify` แสดง argument ที่สามเป็นหัวข้อ; เอกสารอ้างอิง initCraft
ระบุเป็นระยะเวลา จึงต้องตรวจ implementation จริงก่อนแก้ทั่วระบบ · คำเตือน
“HN ยังไม่ได้เปิด VN วันนี้” ใช้แถบใน Worklist แทน ไม่ส่ง `3000` เข้า wrapper แล้ว
ส่วนคำเตือนอื่นของ X-ray และ LAB ยังเรียก `notify` แบบเดิมและยังไม่ได้แก้

### 5.1 คอลัมน์ "เครื่อง" และปุ่มบนแถวที่ยกเลิกแล้ว

ปรับ 2026-09-01 ตามที่ผู้ใช้ขอ (กลับทิศจากรอบก่อนที่ให้แสดงชื่อเต็ม):

- ตารางแสดง **ตัวย่อ** (`DX`, `CT`) · ชื่อเต็มอยู่ใน `title` ให้ hover ดู
  ทั้งระดับ order, ระดับ item และแท็บผลอ่าน
- **1 order มีได้หลายเครื่อง** — แถวสรุปเดิมโชว์เครื่องของ item ตัวแรกตัวเดียว
  ทำให้ใบที่มี CT + DX ดูเหมือนมีเครื่องเดียว · ตอนนี้ `row.modalities[]` เก็บ
  ทุก code ที่ไม่ซ้ำ เรียงตามลำดับที่เจอใน item เพื่อให้ตรงกับตารางด้านล่าง
- คอลัมน์แคบลงตามขนาดตัวย่อ: order `130px → 94px` (min-width 1295 → 1259) ·
  item `130px → 78px` (min-width 1142 → 1090)
- แถวที่ยกเลิกแล้ว: ปุ่ม **ตรวจใหม่** อยู่แทนที่ **EMR** ในแถบปุ่มของ order
  (EMR ซ่อนไป) และไม่มีปุ่ม ตรวจใหม่ ซ้ำในแถบล่างอีก

## 6. Verification — ทำครบก่อนบอกว่าเสร็จ

```bash
python3 Form-Builder/seed/tests-tools/validators/check_sdform_json.py \
  "Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json"
```

1. validator ต้องได้ **exit 0** — ห้ามส่งไฟล์ที่ exit 1 ไม่ว่ากรณีใด
2. ตรวจ **Builder/Preview จริง** โดย import แล้วดูทันที **ห้ามคลิกอะไรเลย**
   ถ้าภาพหลักฐานมี widget ถูกเลือกอยู่ = หลักฐานใช้ไม่ได้
3. ตรวจ **runtime จริง** ว่า query คืนข้อมูลถูก scope และ action ทำงาน
4. ก่อนอ้างว่าพร้อม production ต้องรัน HIS → Agent → เครื่อง → Agent → HIS หนึ่งรอบ
   ครอบคลุม สำเร็จ · ส่งไม่สำเร็จแล้วลองใหม่ · ยกเลิก · ผลซ้ำ

**validator ผ่าน ≠ ใช้งานได้** — ต้องให้ผู้ใช้ยืนยันใน Builder จริงก่อนเสมอ

---

## 7. Acceptance รอบแรก

ตาม `Xray_design.md` Appendix E — รอบแรกพิสูจน์แค่ **แสดงรายการที่สั่งมาจาก CPOE**

- [ ] worklist ดึงจาก `zdata_cpoe_order_item` ที่ `service_type='xray'` และ group เป็น Order
- [ ] ทุกใบมี test เดียว และหนึ่งแถวคือหนึ่งรายการตรวจ
- [x] UI dropdown เครื่องแสดงตัวย่อครบทุกค่าที่เลือก ไม่ยุบเป็น `+N`; แถวละไม่เกิน 3 tag, ตัวที่ 4 ขึ้นบรรทัดใหม่; เลือก 2 กับ 3 code สั้นแล้วกรอบกว้างสมดุลกัน ไม่มีช่องว่างท้ายกรอบมากเกิน — ผู้ใช้ยืนยันผ่านบน HIS 2026-09-17
- [x] กรองเครื่องกับ Order จริงและตัวเลข chip ตรงกับรายการภายใต้ตัวกรอง — ผู้ใช้ยืนยันบน HIS 2026-09-17 (ไม่มีเคสตัวอย่างแนบแยก)
- [ ] Dark mode ไม่มีป้ายพื้นขาวจ้าที่ urgency, หน่วยต้นทาง, ชำระเงิน, Order No., เครื่อง และสถานะ `รอรับ`
- [ ] ช่องค้นหาแสดง HN / VN / ON / Accession / AN ผู้ป่วยใน / เลขบัตรประชาชน / ชื่อ และ `aria-label` ใช้คำเต็ม
- [ ] หัวตารางระดับ test ของทั้งแท็บ order/ผลอ่านใช้พื้น Primary สีฟ้าบางและข้อความเข้ม รองรับ Light/Dark mode
- [ ] legend สีสถานะแสดง `รอรับ`, `รอผลตรวจ`, `ออกผลแล้ว`, `ยกเลิก` ด้วยสีเดียวกับจุดในตาราง
- [x] chip ห้าตัว ตัวเลขมาจากข้อมูลจริงภายใต้ตัวกรองเครื่อง — ผู้ใช้ยืนยันร่วมกับการกรองเครื่อง 2026-09-17
- [ ] ไม่มี specimen และ Lab No.; checkbox ราย item เลือกหลายรายการ/เลือกทั้งหมดได้
- [ ] Accession No. เป็นคอลัมน์ระดับ test และว่างจนกว่าจะส่งเข้าเครื่อง
- [ ] ช่องไม่มีข้อมูลเป็นค่าว่าง ไม่ใช้ `–` เป็น placeholder
- [ ] คอลัมน์ `ปฏิเสธ` / `คนปฏิเสธ` มีค่าจากการยกเลิกใบ
- [ ] แท็บผลอ่านมีปุ่ม `ดูภาพ` เปิดแท็บใหม่ด้วย `QueryMode=AN` (มีเลข Accession)
      หรือ `QueryMode=PID` (ยังไม่มีเลข) · ปิดสวิตช์แล้วต้องกลับไปแจ้งว่ารอ RIS เปิดลิงก์
- [ ] scope หน่วยงาน enforce ที่ server แบบ fail-closed
- [ ] ไม่มีข้อมูลผู้ป่วยจริง credential หรือ URI ของ environment ในไฟล์
- [ ] validator exit 0 และตรวจ Builder/Preview แล้ว
