---
type: spec
title: X-ray Workbench SDForm — Build Spec
created: 2026-08-31
updated: 2026-08-31
tags: [xray, sdform, spec, worklist]
---

# X-ray Workbench SDForm — Build Spec

สเปกสำหรับสร้างไฟล์ JSON ตัวจริง อ่าน `design.md` ในโฟลเดอร์นี้ก่อน

**ห้ามเริ่มก่อนอ่าน** `../../../02-initcraft/governance/from-codex-backup/SDFORM_JSON_RULES.md`

---

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

---

## 4. API ที่ต้องมี

| Process | หน้าที่ | สถานะ |
|---|---|---|
| `xray-cpoe-worklist` | อ่าน worklist + นับ chip + คืนรายชื่อเครื่อง | **ยังไม่สร้าง** |
| `xray-cpoe-dispatch` | ออก accession → บันทึกรับ → เรียก Agent → เก็บ transport outcome | ยังไม่สร้าง (รอ D-X3) |
| `xray-accession-generate` | ออกเลข accession แบบ atomic + idempotent | ยังไม่สร้าง (รอ D-X14/X15) |

ใช้ `../../API/api-factory/processes/lab_cpoe_worklist_api.js` เป็นแม่แบบโครง query/permission

### 4.1 `xray-cpoe-worklist` — read contract ขั้นต่ำ

```text
input : { action?, organization_code?, modality?, statuses?, date_from?, date_to?,
          hn?, page?, limit? }
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

### 4.2 `xray-cpoe-dispatch`

```text
input : { order_id }            ← ทั้งใบ ไม่ใช่ราย item
output: { success, accession_no, transport{status,error}, message }
```

ลำดับที่ห้ามสลับ:

1. ตรวจสิทธิ์ + scope + สถานะ `sent`
2. ออก accession (idempotent — ถ้ามีแล้วใช้เลขเดิม)
3. commit การรับ + audit `dispatched_at` / `dispatched_by` แบบ atomic
4. เรียก Agent **นอก transaction**
5. เก็บผล transport · **Agent ล้มเหลวห้าม rollback ข้อ 2–3**

### 4.3 เลข Accession

```text
YYYY MM DD <MODALITY_CODE> NNN      →  20260831CT001
```

- running **แยกตาม modality และแยกตามวัน** ครบ 999 วนกลับ 001
- ต้อง atomic ระดับ DB · idempotent ต่อ Item · ห้ามคำนวณที่หน้าจอ
- ดูตาราง code และข้อจำกัดใน `Xray_design.md` Appendix F.3
  — **code 10 ค่ายังเป็นค่าสมมติ ห้ามใช้จริงก่อนยืนยัน (D-X14)**

---

## 5. โครง UI ที่ต้องมีในไฟล์

```
.xray-cpoe
├── toolbar (grid 7 คอลัมน์)
│   ค้นหา · Date Range · เครื่อง(dropdown) · Search · Report · spacer · สร้างรายการใหม่
├── status chips ×4      ทั้งหมด · รอรับ/รอผลอ่าน · ออกผลครบ · ยกเลิก
├── worklist (min-width 1310px, 10 คอลัมน์)
│   expand · patient · context pills · รายการตรวจ · เครื่อง ·
│   เวลาสั่ง+Order No. · เวลาสถานะ · แพทย์/Dx · สถานะ · ปุ่ม(คอลัมน์เดียว)
│   └── detail panel
│       ├── tab: order      ตาราง 9 คอลัมน์ (min-width 1180px)
│       │    Accession No. · รายการตรวจ · เครื่อง · เวลาสั่ง ·
│       │    เวลาส่งเข้าเครื่อง · ผู้ส่ง · สถานะ · ปฏิเสธ · คนปฏิเสธ
│       ├── tab: ผลอ่าน      ลำดับ · รายการตรวจ · เครื่อง · เวลาออกผล ·
│       │                   [ดูผลอ่าน][ดูภาพ] · สถานะ
│       └── ปุ่ม: ส่งเข้าเครื่อง · ยกเลิก order   (ยกเลิกแล้ว → ตรวจใหม่)
└── dialogs: ผลอ่าน · ยืนยันส่งเข้าเครื่อง · ยกเลิก order · ตรวจใหม่
```

ทุกขนาด/สี/ระยะอ้างจาก `Xray_design.md` §2–§7 ห้ามตั้งค่าใหม่เอง

---

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
- [ ] dropdown เครื่อง 19 ค่า ค่าเริ่มต้น `Select all` กรองทันที และคงค่าเมื่อเปลี่ยน chip/หน้า
- [ ] chip สี่ตัว ตัวเลขมาจากข้อมูลจริงภายใต้ตัวกรองเครื่อง
- [ ] ไม่มี specimen ไม่มี Lab No. ไม่มี checkbox ราย item
- [ ] Accession No. เป็นคอลัมน์ระดับ test และว่างจนกว่าจะส่งเข้าเครื่อง
- [ ] ปุ่มท้ายแถวเรียงต่อกันไม่มีช่อง `–` · ใบที่ยกเลิกเหลือ `EMR`
- [ ] คอลัมน์ `ปฏิเสธ` / `คนปฏิเสธ` มีค่าจากการยกเลิกใบ
- [ ] แท็บผลอ่านมีปุ่ม `ดูภาพ` ที่แจ้งว่ารอเชื่อมกับ RIS
- [ ] scope หน่วยงาน enforce ที่ server แบบ fail-closed
- [ ] ไม่มีข้อมูลผู้ป่วยจริง credential หรือ URI ของ environment ในไฟล์
- [ ] validator exit 0 และตรวจ Builder/Preview แล้ว
