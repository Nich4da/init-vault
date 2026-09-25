---
type: synthesis
title: CBC → his_lab_code mapping ผิดใน master item
created: 2026-09-23
updated: 2026-09-23
tags: [lab, cpoe, master-data, integration, his-lab-code, cbc]
sources: []
---

# CBC → his_lab_code mapping ผิดใน master item

> ตรวจจากคำถาม "LAB NO. 206909230001 ส่งรหัสรายการสั่งตรวจอะไรไปให้ Agent" แล้วพบว่า
> รหัสที่ผูกกับรายการ CBC ทุกตัวใน `zdata_master_item_order` ชี้ไปที่ **Hb Typing** ไม่ใช่ CBC

## สรุปสั้น

| | ค่า |
|---|---|
| รหัสที่ส่งออกจริง | `test_code = 2201EB` |
| `2201EB` คืออะไรใน catalog | **Hb Typing** · section `HH` · specimen `EB` |
| รหัส CBC ที่ถูกต้อง | `2001EB` = CBC FL5 (`HM`) · `2101EB` = CBC FL2 (`ML`) |
| ผลกระทบที่เกิดแล้ว | outbound 7 ใบส่ง `2201EB` ออกไปแล้ว |

## หลักฐาน (Mongo, read-only, 2026-09-23)

**1. รหัสที่ส่งออกไปจริง** — `his.zdata_lab_outband_order`, work item `6ab34e21cec3020e8562a216`
(LAB NO. `206909230001`, order `R2609230001`, section HM, received `2026-09-23 10:59:21`):

```
request_payload_json.items[0] = {
  seq: 1, test_code: "2201EB",
  test_name: "[เฉพาะโรคเลือด] CBC ( Complete Blood Count )",
  specimen_code: "EB", lab_code: "HM", ...
}
```

Agent ตอบ `202 queued`, `dispatch_id 45`, `order_ref 50`, `routed_to ["rax-file"]`
ฝั่ง HIS ยัง `hl7_status: queued` · `order_no` ที่ส่งไปคือ work-item id `6ab34e21cec3020e8562a216` ไม่ใช่ `R2609230001`

**2. รหัสมาจากไหน** — `Form-Builder/API/api-factory/processes/lab_cpoe_receive_api.js:765`

```js
const testCode = text(masterLab.his_lab_code)   // มาจาก zdata_master_item_order.lab_item
```

CPOE item เก็บแค่ `item_code: "HM1"` · `test_code` ถูก derive ตอน receive จาก master เท่านั้น

**3. catalog พูดว่าอะไร** — `his.zdata_lab_catalog` (690 รายการ)

| his_lab_code | name | section | specimen |
|---|---|---|---|
| `2001EB` | CBC FL5 | HM | EB |
| `2101EB` | CBC FL2 | ML | EB |
| `2201EB` | **Hb Typing** | HH | EB |

**4. master ผูกผิดกี่ตัว** — `his.zdata_master_item_order`, `lab_item.his_lab_code = "2201EB"` มี 6 รายการ

| item_code | item_name | section ของ item | ถูกต้องไหม |
|---|---|---|---|
| `H1` | Hemoglobin typing | HH | ✅ ถูก |
| `HM1` | [เฉพาะโรคเลือด] CBC ( Complete Blood Count ) | HM | ❌ ควรเป็น `2001EB` |
| `MS1` | CBC | ML | ❌ ควรเป็น `2101EB` |
| `HM1-R` | CBC (Research) | HM | ❌ |
| `MS1-R` | CBC (Research) | ML | ❌ |
| `NAP-MS-1` | NAP-Free-CBC | ML | ❌ (`use_status: false`) |

**ไม่มี master item ตัวใดเลยที่ผูกกับ `2001EB` หรือ `2101EB`** ⇒ รหัส CBC จริงไม่เคยถูกส่งออกไปหา LIS

**5. ขอบเขตที่กว้างกว่านั้น** — active item ที่มี `lab_item.his_lab_code` 767 ตัว · รหัสไม่ซ้ำ 646 ตัว ·
**55 ตัวที่ section ของ item ไม่ตรงกับ section ของ lab_item** (2201EB เป็นหนึ่งในนั้น) — ยังไม่ได้ไล่ทีละตัว

**6. ที่ส่งออกไปแล้ว** — outbound ที่ payload มี `2201EB`

- HM 6 ใบ: `206909090003` `206909090005` `206909090006` `206909160001` `206909160002` `206909230001`
- ML 1 ใบ: `216909040001`

## ข้อเสนอการแก้ (ยังไม่ได้ทำ)

1. แก้ที่ **master** ไม่ใช่ที่โค้ด: `HM1`/`HM1-R` → `2001EB`, `MS1`/`MS1-R`/`NAP-MS-1` → `2101EB`
   โดยยืนยันกับฝั่ง LIS ก่อนว่าเขา map `2001EB`/`2101EB` ไว้แล้วจริง
2. `zdata_master_item_order` เป็น contract ที่ระบบอื่นอ่านอยู่ ⇒ ต้องขออนุมัติก่อนแก้ (CLAUDE.md §14d)
3. ใบที่ส่งออกไปแล้ว 7 ใบต้องตกลงกับ LIS ว่าจะแก้ย้อนหลังอย่างไร — HIS ไม่ควรเงียบแล้วส่งใหม่ทับ
4. ไล่ตรวจอีก 54 ตัวที่ section ไม่ตรงกัน ว่าเป็นความผิดพลาดแบบเดียวกันหรือเป็นเคสที่ตั้งใจ

## ฟิลด์ที่ต้องแก้ (ตรวจ 2026-09-23)

**คอลเล็กชัน `his.zdata_master_item_order` · ฟิลด์ `lab_item` (ทั้งก้อน)** — ไม่มีที่อื่นให้แก้
(`zdata_cpoe_order_item` ไม่ได้เก็บสำเนา `lab_item` เลย ยืนยันด้วย count = 0)

ฟิลด์ย่อยที่โค้ดอ่านจริง:

| path | ใครอ่าน | ผลถ้าผิด |
|---|---|---|
| `lab_item.his_lab_code` | `lab_cpoe_receive_api.js:290,785` → `test_code` ที่ส่งออก | LIS ได้รหัสผิด |
| `lab_item.specimen.code` / `.name` | receive + worklist (`:835,2819,3458`) | specimen fallback / ตัวกรอง |
| `lab_item.c_test`, `lab_item.tmt_code` | worklist projection (`:3473-3475`) | ข้อมูลแสดง/เบิกผิด |
| `lab_item.value`, `.label`, `.name`, `.section`, `.seq` | snapshot ที่ UI แสดง | ชื่อ/ห้องแลปที่คนอ่านเห็นผิด |

🟢 **ไม่ต้องแตะ `section` ระดับบนสุดของ item** — LAB NO./routing อ่านจาก
`item.section_snapshot → item.lab_context_snapshot.section → master.section`
(`lab_no_generate_api.js:145-147,483-485`) ไม่ได้อ่าน `lab_item.section`
⇒ แก้ `lab_item` แล้ว prefix LAB NO. (HM=20, ML=21) ยังเหมือนเดิมทุกใบ

### ค่าที่ถูกต้อง (คัดลอกจาก `zdata_lab_catalog` ตรง ๆ)

`HM1`, `HM1-R` (section HM) ⇒ `lab_item` = snapshot ของ `2001EB`:

```json
{ "value":"2001EB","label":"CBC FL5","name":"CBC FL5","short_name":null,"flag":null,
  "is_show_chart":false,
  "section":{"value":"HM","label":"Hematology","code":"HM","name":"Hematology",
    "modality_type":"","ref_code":"20",
    "unit":{"value":"20-22","label":"20-22 Hematology",
      "unit_parent":{"unit_code":"LAB","unit_name":"งานปฏิบัติการ"}}},
  "specimen":{"value":"EB","label":"EDTA blood","code":"EB","name":"EDTA blood"},
  "seq":152,"c_test":"01","his_lab_code":"2001EB","tmt_code":"300034" }
```

`MS1`, `MS1-R`, `NAP-MS-1` (section ML) ⇒ `lab_item` = snapshot ของ `2101EB`:

```json
{ "value":"2101EB","label":"CBC FL2","name":"CBC FL2","short_name":null,"flag":null,
  "is_show_chart":false,
  "section":{"value":"ML","label":"Clinical Microscopy Laboratory","code":"ML",
    "name":"Clinical Microscopy Laboratory","modality_type":"","ref_code":"21",
    "unit":{"value":"21","label":"21 Clinical Microscopy",
      "unit_parent":{"unit_code":"LAB","unit_name":"งานปฏิบัติการ"}}},
  "specimen":{"value":"EB","label":"EDTA blood","code":"EB","name":"EDTA blood"},
  "seq":173,"c_test":"01","his_lab_code":"2101EB","tmt_code":"300034" }
```

`H1` (Hemoglobin typing, HH) ถูกอยู่แล้ว — **ห้ามแตะ**

### หลักฐานว่า mapping นี้คือเจตนาเดิมของ migration

- `zdata_lab_catalog.legacy.item_codes` ระบุไว้ตรง ๆ:
  `2001EB → ["HM1","HM1-R"]` · `2101EB → ["MS1","MS1-R","NAP-MS-1"]` · `2201EB → ["H1"]`
- `name_th` ของ catalog ตรงกับ `item_name` ของ master:
  `2001EB.name_th` = "[เฉพาะโรคเลือด] CBC ( Complete Blood Count )" = `HM1.item_name` ·
  `2101EB.name_th` = "CBC" = `MS1.item_name`
- `HM1.std_code_data` มี TMT `300034` ซึ่งเป็น `tmt_code` ของ CBC ไม่ใช่ `300124` ของ Hb Typing
- เอกสาร `Qsnich_tests.pdf` ฝั่งเครื่อง: Group `6013` = Order - CBC FL5 · `6019` = Order - CBC FL2 ·
  `6023` = Order - Hb Typing ตรงกับ `lab_code` ของ catalog ทั้งสามตัว

### ตรวจก่อน/หลัง

```js
db.zdata_master_item_order.find(
  { item_code: { $in: ["H1","HM1","MS1","HM1-R","MS1-R","NAP-MS-1"] } },
  { item_code:1, item_name:1, "section.code":1, "lab_item.his_lab_code":1, "lab_item.label":1 }
)
```

ยังไม่ได้รันคำสั่งเขียนใด ๆ — ต้องขออนุมัติก่อน (§14d) และต้องตกลงกับ LIS
เรื่องใบที่ส่ง `2201EB` ออกไปแล้ว 7 ใบ

## สถานะหลังผู้ใช้แก้รอบแรก (2026-09-23, ตรวจจาก Mongo)

แก้ไปแล้ว **เฉพาะ `lab_item.value`** ของ 4 รายการ — ฟิลด์ที่ส่งออกจริงยังไม่ถูกแตะ

| item_code | `lab_item.value` | `lab_item.his_lab_code` (ตัวที่ส่ง) | `label` | สรุป |
|---|---|---|---|---|
| `H1` | `2201EB` | `2201EB` | Hb Typing | ✅ ไม่โดนแตะ ถูกต้อง |
| `HM1` | `2001EB` ✔ | **`2201EB`** ✘ | Hb Typing | ยังส่งรหัสผิด |
| `HM1-R` | `2001EB` ✔ | **`2201EB`** ✘ | Hb Typing | ยังส่งรหัสผิด |
| `MS1` | `2101EB` ✔ | **`2201EB`** ✘ | Hb Typing | ยังส่งรหัสผิด |
| `MS1-R` | `2101EB` ✔ | **`2201EB`** ✘ | Hb Typing | ยังส่งรหัสผิด |
| `NAP-MS-1` | `2201EB` | `2201EB` | Hb Typing | ยังไม่ได้แก้เลย |

⇒ `test_code` ที่ส่งไป LIS ยังเป็น `2201EB` ทุกใบ และตอนนี้ `value` กับ `his_lab_code`
ไม่ตรงกัน (ไม่ควรค้างไว้แบบนี้) · `label`/`name`/`section`/`seq`/`tmt_code` ยังเป็นของ Hb Typing
· `updated_at` ยังเป็น `2026-08-27` เพราะแก้ทีละฟิลด์ใน Compass

**ขอบเขตที่ผู้ใช้ตัดสิน 2026-09-23:** ไม่แก้ `NAP-MS-1` เพราะ `use_status: false` (ปิดใช้งานอยู่)
⇒ ขอบเขตการแก้เหลือ 4 รายการ: `HM1`, `HM1-R`, `MS1`, `MS1-R`
🔴 ถ้าวันใดเปิด `NAP-MS-1` กลับมาใช้ ต้องแก้ `lab_item` ของมันก่อน ไม่งั้นจะส่ง `2201EB` ออกไปทันที

**วิธีจบ:** รันสคริปต์ snapshot ในหัวข้อก่อนหน้า ซึ่งเขียนทับ `lab_item` ทั้งก้อน
(แก้ `value` + `his_lab_code` + ที่เหลือพร้อมกันให้สอดคล้อง) โดยตัด `NAP-MS-1` ออกจากชุด `_id`

## คำถามที่ยังไม่มีคำตอบ

- ทำไม migration ถึงยัด `2201EB` ให้ทุกรายการ CBC — `zdata_lab_test` code `01` เก็บ
  `legacy.his_code_ids` รวม `2001EB` `2101EB` `2201EB` ไว้ด้วยกันโดยมี `dropped_names`
  ว่า "CBC FL5 / CBC FL2 / Hb Typing" ⇒ น่าจะ merge ด้วย `c_test = "01"` แล้วเลือกตัวสุดท้ายชนะ
- LIS ฝั่งปลายทางตีความ `2201EB` ที่รับไปแล้วเป็นอะไร (Hb Typing จริง หรือ map เป็น CBC ไว้)
- [[lab-cbc-swap-item]] (สลับ HM↔ML ก่อน receipt) จะเปลี่ยน `test_code` ตามหรือไม่เมื่อ master ถูกแก้
