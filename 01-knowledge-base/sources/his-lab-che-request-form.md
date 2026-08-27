---
type: source
title: ใบส่งตรวจงานชีวเคมี (C-20 / L3.1)
created: 2026-07-31
updated: 2026-07-31
tags: [his, lab, lis, biochemistry, form, paper-form]
source_file: "03-source-materials/his-lab-che-request-form.md"
source_type: image
source_date: 2026-04
author: งานชีวเคมี กลุ่มงานพยาธิวิทยาคลินิกและเทคนิคการแพทย์ สถาบันสุขภาพเด็กแห่งชาติมหาราชินี
---

# ใบส่งตรวจงานชีวเคมี (C-20 / L3.1)

> The paper lab request form that the [[his|HIS]] **CHE (clinical chemistry) order screen**
> must reproduce — 4 columns, 25 groups, 90 test codes, plus a specimen block. Form no.
> `148-1-8 / เม.ย.69`.

## Summary
- Issued by **งานชีวเคมี**, กลุ่มงานพยาธิวิทยาคลินิกและเทคนิคการแพทย์ — ตึกมหิตลาธิเบศร ชั้น 5
  ห้อง 503 (โทร 3505-7). This is the *biochemistry* form only; other lab units (hematology,
  microbiology, ...) presumably have their own.
- **Header block** = Name · H.N. · Age · Ward · Tel. + **แพทย์ที่สั่งตรวจ** + **Lab No.**
  (the Lab No. box is explicitly marked *สำหรับเจ้าหน้าที่ Lab เท่านั้น* — i.e. it is
  assigned by the lab, not by the ordering ward → matches requirement 4 "ปรับเปลี่ยน LAB NO.").
- **สิ่งส่งตรวจ (specimen)** is a first-class block, not an afterthought:
  Blood (→ Clotted / Ionized Calcium / Lithium Heparin / NaF / EDTA) · Urine (→ Urine spot /
  Urine 24 hr **+ ปริมาตร ml**) · CSF · Body Fluid (**+ ระบุ**), plus **ผู้เก็บตัวอย่าง** and
  **เวลาเก็บตัวอย่าง**.
- **Test list** is laid out in 4 print columns; grouping and order are meaningful — requirement 2
  of [[his-lab-biochem-requirements]] says the HIS screen must be arranged *"ตามรูปแบบของใบส่งตรวจ"*.
- Three groups have a **checkbox on the group header itself** (order the whole panel):
  `C1` Liver Function Test, `C36` Blood Gas/Ionized Ca²⁺, `C25` Electrolyte (Clot Blood).
  `C35` Glucose Tolerance Test behaves as a parent too, with 5 timed children.
- **Free-text/numeric riders** exist on some items: `C352–C356` GTT T1–T5 each take a
  **นาที** value; Urine 24 hr takes **ml**; Body Fluid takes **ระบุ**.
- A printed derivation note: **"สั่ง Globulin = C2 + C3"** — Globulin is not orderable on its
  own; it is Protein + Albumin.
- **No prices anywhere on the form.** Pricing has to come from a master table — and per
  requirement 11 it must be per-สิทธิ ([[his-insurance]]).
- Footer: `Report by ...........` and an empty **สำหรับเจ้าหน้าที่การเงิน** box.

## Key takeaways
- The order screen is a **checkbox sheet**, not a search box. Fidelity to this layout is an
  explicit user requirement, not cosmetic.
- **Specimen is per-order (or per-item), and it is data** — the reports in requirement 9 slice
  statistics *ตาม Specimen type*. It must be stored, not just printed.
- **Lab No. is lab-owned and mutable**, distinct from the HIS order id.
- Some tests need **modifiers** (นาที / ml / ระบุ) → an order line is `{code, qty?, modifier}`,
  not a bare boolean.

## Entities & concepts touched
- [[lis]] — this form is the paper artefact the LIS order module digitises.
- [[his-lab-che-order-component]] — the SDForm implementation of this list (already built).
- [[his-lab-biochem-requirements]] — the requirement doc that references this layout.
- [[his-insurance]] — pricing/เบิกได้ must be resolved per สิทธิ.
- [[his]] · [[cpoe]] — lab ordering is one branch of order entry.

## Contradictions / open questions
- Six items print **noticeably faint** on the photograph (C57 Insulin, C33 Magnesium,
  C24.2 CSF Protein, C24.1 CSF Sugar, C79 Prolactin, C82 DHEAS). Deliberate (send-out /
  discontinued / conditional) or just print quality? **Ask the lab.**
- The form has **no order date** and no doctor signature line — where do those live? On the
  HIS order record only?
- `L1 Activated clotting time` sits alone at the bottom of column 2 with an `L` prefix, not `C`
  — likely belongs to a different unit (coagulation) but is printed on this sheet. Confirm.
- Group headers `C1` / `C25` / `C36` — are these *orderable codes* sent to the LIS, or just
  print groupings? Affects what [[his-lab-che-order-component]] should emit.
- Is there an equivalent form per lab unit (hema/micro/immuno)? This project so far covers CHE.
