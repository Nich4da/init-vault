---
type: source
title: HIS — Visit Form (visit.json)
created: 2026-07-20
updated: 2026-07-20
tags: [initcraft, his, form-factory, sdform, healthcare, visit, example]
sources: []
source_file: "HIS/sdform_module/visit.json"
source_type: note
source_date: unknown
author: unknown
url:
---

# HIS — Visit Form (`visit.json`)

> The exported [[sdform|SDForm]] model for a **Visit (encounter)** in the [[his|HIS]] — opened
> per visit from the [[his-patient-form|patient workspace]] ("Open Visit" button). Realises the
> **visit (VN)** step of [[his-opd-flow]]. Form id `6a40fdec4b6dfdf45acbfbce` (2082 lines).

## Summary
- **Link to patient = `pid`** — the person is passed as `parentId` on `openForm`; at runtime the
  form reads `this.formDataModel.pid.value` = the person **`_id`**. (Not `hn`.) One person → many
  visits.
- **`vn` (VN) = `autonumber-input`**, `prefix "69"` + `digit 5`, `readonly`, `perDay:false`,
  `bySite:false` → generated on save of a **new** visit. Each Open Visit = a new VN.
- **`visit_date`** (Visit Date) = the วันที่มาตรวจ printed on the record.
- **Insurance auto-loads** (see [[his-insurance]]): `formConfig.onFormMounted` (and `onParentChange`)
  — if `visit_date` is today and `inscl_hos` is empty, it runs process
  **`6a4c705049285083acfeb076`** `({ personId })` → sets `inscl_hos` from the person's active rights.

## Field groups (from the widget tree)
- **Header:** `vn`, `visit_date`.
- **Service:** `visit_service` (บริการใน-นอกสถานที่), `visit_type_time` (ประเภทเวลาบริการ),
  `visit_clinic` (แผนก/คลินิก, `select-form-input`), `visit_type` (ขอรับบริการ: ตรวจสุขภาพ / ตรวจตามนัด /
  รับส่งต่อ / ตรวจรักษาโรค / อื่นๆ), `visit_priority` (คิวตรวจ: ตามคิว / เร่งด่วน / STAT),
  `visit_doctor` (แพทย์, `select-data-input`), `visit_note`.
- **Clinical:** `cc` (Chief complaint / อาการสำคัญ), `visit_diag` (การวินิจฉัย, `select-form-input`),
  `doctor_diag` (แพทย์ผู้วินิจฉัย).
- **Insurance sub-form** (`card` → `sub-form`, see [[his-insurance]]): `inscl_item_main`
  (ประเภทผู้ป่วย), `inscl_item_sub` (ประเภทการรักษา), `inscl_hos` (array) inside `inscl_hos_box`
  (สิทธิในโรงพยาบาล).
- **Status switches:** `visit_status`, `consult_status`, `payment_status`, `fu_status`,
  `admit_status`, `refer_status`.
- **Money (number):** `vcost` (ราคาทุน), `vprice` (ค่าบริการทั้งหมด/ราคาขาย), `vpayprice`
  (ต้องจ่ายเอง), `vactualpay` (จ่ายจริง).
- **Discharge:** `typeout` (ผู้มารับบริการเสร็จสิ้น) — จำหน่ายกลับบ้าน / รับไว้ IPD / ส่งต่อ /
  เสียชีวิต (+ ก่อนมาถึง / ระหว่างส่งต่อ) / ปฏิเสธการรักษา / หนีกลับ / ให้บริการโดยไม่มีคำวินิจฉัย.
- **Denormalized from person:** `birth_date`, `gender_text` (เพศ), `abogroup_text` (หมู่เลือด) —
  copied onto the visit (⚠ may drift from the person record).
- **Misc/hidden:** `first_visit`, `diff_day_visit`, `status_box` (hidden).

## Key takeaways
- The **person↔visit join key for reports = `visit.pid.value` → `person._id`** ([[his-opd-flow]]
  module→collection map). This is what a Report Factory SQL must join on.
- **VN and HN share the `69` + 5-digit autonumber format** but are separate counters (HN is on the
  PERSON form, VN here).
- The visit **snapshots insurance** (`inscl_hos`) from the person at open time via a process — so a
  visit carries the rights that applied *that day*, independent of later person edits.
- `visit_date`, `vn`, and the `inscl_*` fields are the visit-side columns the
  [[his-medical-record-report|เวชระเบียน report]] needs; person demographics/address come from the
  PERSON side.

## Referenced processes / forms (by id)
| Role | id | via |
|------|----|-----|
| Insurance-load (personId → `inscl_hos`) | `6a4c705049285083acfeb076` | `runProcess` (onFormMounted/onParentChange) |
| Visit form (opened from workspace) | `6a40fdec4b6dfdf45acbfbce` | `openForm` (from [[his-patient-form]]) |

## Contradictions / open questions
- **Not verified against MongoDB** — the read-only connection reachable here (`erp`) has **no HIS
  data** (no `zdata_visit`); the real `his` db (159.223.80.155) needs a separate read-only URI. Field
  names/types above are read from the form JSON only.
- `gender_text` / `abogroup_text` / `birth_date` are denormalized onto the visit — for the report,
  decide whether to print from the visit copy or join fresh from PERSON.
- `visit_type_time` reuses the ในสถานบริการ/นอกสถานบริการ labels — semantics vs `visit_service`
  unclear (in/out-hours vs in/out-facility?).

## Entities & concepts touched
- [[his]] · [[his-patient-form]] (opens this form) · [[his-opd-flow]] (the visit step).
- [[his-insurance]] — the สิทธิ model this form snapshots.
- [[form-model-json]] · [[openform]] · [[runprocess]] · [[field-components]]
  (`autonumber-input`, `select-form-input`, `select-data-input`, `sub-form`, `switch-input`).
