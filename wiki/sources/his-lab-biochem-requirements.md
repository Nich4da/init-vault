---
type: source
title: หน่วยงานชีวเคมี — ความต้องการต่อระบบ HIS (LAB)
created: 2026-07-31
updated: 2026-07-31
tags: [his, lab, lis, requirements, biochemistry]
source_file: "raw/his-lab-biochem-requirements.md"
source_type: image
source_date: unknown
author: หน่วยงานชีวเคมี (lab users)
---

# หน่วยงานชีวเคมี — ความต้องการต่อระบบ HIS (LAB)

> A 3-page user requirement memo from the **biochemistry lab unit**: which existing HIS/LAB
> modules they *don't* use, which modules they *do* use that were missing from the spec, and
> 11 numbered add/fix requests. This is the **scope document for the LAB project**.

## Summary

**(a) โมดูลที่ไม่ได้ใช้งาน — 4 items, can be dropped from scope**
`3.4.4.1` รายการผู้ป่วยนัด · `3.4.4.3` รายการผู้ป่วยส่งต่อ · `3.4.4.10` ส่ง Order Work List
ไประบบ LIS ทั้งหมดในคลิกเดียว · `3.4.4.11` ประสาน IT out lab (PCT lab) ส่ง order + รับผลกลับ
เป็นไฟล์รูปภาพ.

**(b) โมดูลที่ใช้จริงแต่ไม่มีในสเปกเดิม — 4 items, must be ADDED to scope**
`Lab Request Monitoring` · `สถานะการสั่งแลป` · `ข้อมูลห้องแลป` · `บันทึกความเสี่ยง(หน่วยงาน)`.

**(c) 11 add/fix requests** — these define the module. Condensed:
1. **Advance orders auto-arrive.** Doctor orders ahead; on the appointment date the order must
   appear on **"รอรับเข้าดำเนินการ"** automatically.
2. **Order entry = tick boxes**, not one-at-a-time search, laid out
   *ตามรูปแบบของใบส่งตรวจ* ([[his-lab-che-request-form]]).
3. **Lab main screen split by status:** รอรับเข้า → รับเข้าดำเนินการ → ออกผลแล้ว.
4. **หน้ารอรับเข้า:** edit/delete order lines · change **LAB NO.** · **accept** specimen with
   receive-timestamp · **reject** specimen with reason + rejecter name · check
   [[his-insurance|สิทธิ]] & payment status · print the request slip.
5. **หน้าออกผลแล้ว:** show result + comment + **Ref. Range**, ordered *ตาม Report LIS* ·
   **critical-value alert at both order level and per test** · edit or **hide (ปกปิด)** a result ·
   print.
6. **Manual result entry fallback** when the LIS is down, displayed on HIS + printable.
7. **Patient demographics access from the lab screen** — name (+ **remark on name change**),
   DOB, citizen id, contact/address/phone, contact person, สิทธิ, whether the patient is
   **Check-in or Admit (and where)**, and the **next appointment**.
8. **Doctor's result view** (existing menu *สถานะการสั่งแลป*): same ordering as Report LIS;
   unresolved items must show **pending (รอผล)** so partial results aren't mistaken for
   "not ordered"; critical-value flag shown **at the LAB NO.**; printouts must be stamped
   **"สำเนาพิมพ์ออนไลน์"** + printer name + datetime (legal copies need an MT signature); and
   **page 1/2 numbering** on multi-page reports.
9. **Reports (Excel export, monthly, by date/time, split by Ward and Clinic):**
   test-level statistics · order count (by LAB NO. that produced results) · count by
   **specimen type** · and a **result search by test + value range**.
10. **บันทึกความเสี่ยง(หน่วยงาน)** must pull risk reports + specimen rejections and export to
    the unit's form.
11. **ข้อมูลห้องแลป:** maintain specimen-rejection reason comments · inspect the **test code map
    HIS → LIS** · inspect **unit price / reimbursable price per สิทธิ**.

## Key takeaways
- The lab's model is a **three-state pipeline** — `รอรับเข้า → รับเข้าดำเนินการ → ออกผลแล้ว` —
  and every screen hangs off it. Design the data model around that first.
- **HIS does not own results; the LIS does.** HIS orders, the LIS returns results/Ref.Range,
  and HIS needs a **manual-entry fallback** (req. 6) and a **code mapping table** (req. 11).
- **Critical values are a first-class feature**, required in three places (lab result screen,
  order-level, and the doctor's LAB NO. view).
- **Specimen handling is a workflow, not a field:** accept-with-timestamp, reject-with-reason
  -and-name, and rejections feed the **risk register** (req. 10) and monthly stats (req. 9).
- Printing carries **medico-legal semantics** — online prints are copies and must say so.
- Everything statistical is **Ward/Clinic-segmented and Excel-exportable** → these are
  [[report-factory]] jobs with a shared Ward/Clinic dimension.

## Entities & concepts touched
- [[lis]] — this memo is the richest description of the LIS module we have.
- [[his-lab-che-request-form]] — req. 2 mandates its layout.
- [[his-lab-che-order-component]] — the built order UI; satisfies req. 2 partially.
- [[his-lab-module-plan]] — the gap analysis / build plan derived from this memo.
- [[his-insurance]] — req. 4 (สิทธิ + payment status) and req. 11 (price per สิทธิ).
- [[report-factory]] — req. 8 (printouts) and req. 9 (Excel reports).
- [[his-data-model]] — req. 7 pulls person/visit demographics into the lab screen.
- [[cpoe]] · [[his-billing]] — order origin and the charge side.

## Contradictions / open questions
- **Numbering `3.4.4.x` refers to a spec document we don't have.** Only 4 unused items are
  quoted; the full list (and thus the agreed baseline scope) is unknown. **Ask for it.**
- Req. (a) says *ส่ง Order Work List ไประบบ LIS ในคลิกเดียว* is **not used** — yet reqs. 5/8/11
  assume an active HIS↔LIS interface. So how do orders reach the LIS today: manual re-key,
  a per-order push, or paper? **This decides the whole integration design.**
- "ปกปิด ผลการตรวจ" (hide a result) — who may do it, is it reversible, and is the original kept
  for audit? Clinical-governance question, needs a decision before implementing.
- Req. 1 needs an **appointment/นัด source** — but (a) says the *ผู้ป่วยนัด* list is unused.
  Where do advance orders and appointment dates live?
- "Report LIS ordering" is referenced twice as the canonical sort order — we need the actual
  LIS report to encode it (it may differ from the paper form's order).
- Critical-value thresholds: owned by the LIS or configured in HIS? Age-specific (paediatric
  hospital → almost certainly age-banded).
- Req. 7 mentions **Admit** — implies IPD scope, while the wiki so far models OPD only
  ([[his-opd-flow]]).
