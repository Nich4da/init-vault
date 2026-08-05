---
type: source
title: HIS — Biomolecular & Genetics lab request forms (C-20/L8.1, L8.2, BG49)
created: 2026-08-04
updated: 2026-08-04
tags: [his, lab, lis, genetics, paper-form, requirements]
source_file: "raw/his-lab-bg-request-forms.md"
source_type: image
source_date: 2026-08-02
author: ห้องปฏิบัติการชีวโมเลกุลและพันธุศาสตร์ (สถาบันสุขภาพเด็กฯ)
---

# HIS — Biomolecular & Genetics lab request forms

> **Three** paper request forms from the genetics lab (ชั้น 5 ตึกมหิตลาธิเบศร, โทร 1415 ต่อ 3514/3516).
> They break several assumptions baked into [[his-lab-che-order-component]], which was built
> against biochemistry's single flat tick sheet.
> Photos: `HIS/data/Biomolecular and Genetics/*.PNG` → transcription in
> `raw/his-lab-bg-request-forms.md`.

## The three forms

| Form | Doc no. | Pages | Sections |
|---|---|---|---|
| **C-20 / L8.1** | FM–LAB–BG–660–00 | 1 | Cytogenetic · Molecular cytogenetic · Newborn Screening · Additional testing |
| **C-20 / L8.2** | FM–LAB–BG–661–01 | **2** | Molecular analysis · Gene sequencing · Point mutations |
| **BG49** (urine organic acid) | _none printed_ | 1 | one single test + its own required fields |

All codes use the **`BG` prefix** — a second code namespace alongside biochemistry's `C` codes
([[his-lab-che-request-form]]).

## Five things this changes about the LAB data model

### 1. Composite codes — one orderable line ⇒ 2–3 test codes
Nearly every *Gene sequencing* and *Point mutation* row is coded `BG17+21`, `BG16+20`,
`BG15+20`, `BG17+20`, or `BG17+19+22`. The form spells the rule out:

> `*, ** สั่งตรวจด้วย 2, 3 รหัสการทดสอบตามลำดับ`

So the thing the doctor picks ("Phenylketonuria") is **not** the thing the lab bills or runs —
that expands to an ordered list of component codes. Biochemistry hinted at this once
("สั่ง Globulin = C2 + C3"); here it is the dominant pattern, ~50 rows.
**A `zdata_lab_test` row therefore needs a `components[]` (ordered) — not a single code.**

### 2. Per-test required fields
`BG49` is a whole form for one test because it demands **`ค่า urine creatinine = ____ mg/dl`**,
a history narrative, and a diagnosis checklist. A tick sheet cannot express this.
Compare `BG14 Real-time PCR others ______` and the `Other ______` free-text rows.
**Tests need an optional per-test field schema** (cf. GTT นาที / urine 24h ml in biochemistry).

### 3. Per-test sub-options (radio, not checkbox)
`BG50 Chromosome analysis FISH` carries a **single-select** list: `Chr 22q11.2` · `Chr 7q11.2` ·
`Chr 15q11-q12` · `Chr 4p16.3` · `Chr 5p15.3-15.2` · `Other ____`. Rendered as ○ circles, i.e.
pick one — a different control from the ☐ used for tests.

### 4. Clinical narrative is part of the order
`BG1 Chromosome analysis from blood` reserves **half the page** for
**ประวัติผู้ป่วย / การตรวจทางร่างกาย / การวินิจฉัย** with "กรุณากรอกข้อมูลให้ครบถ้วน".
`BG49` requires History + a diagnosis pick-list of 8 IEM conditions. Genetics orders carry
clinical context that biochemistry orders don't — the order screen needs long-text fields
sourced from (or pushed to) the [[his-emr-form|EMR]].

### 5. `Out lab` is marked **on the test itself**
`BG50` (FISH) and `BG51` (CMT1A/HNPP) are annotated `: Out lab`. That makes out-lab routing a
**property of the test master**, not a decision made at order time — and it connects directly to
the unused module **3.4.4.11 ประสาน IT out lab (PCT lab)** in [[his-lab-biochem-requirements]].

## Other facts worth keeping

- **First printed price anywhere:** `BG45 TSH (DBS) — 125 บาท`. Every other form (including all
  90 biochemistry codes) prints no price. So price *does* exist somewhere; it is simply not on
  the paper. Confirms the price-master gap in [[his-lab-module-plan]].
- **Header fields differ per form.** L8.1/L8.2 = Name · Age · HN · **ตึก/Ward** · วันที่รับ.
  BG49 = Name · Age · HN · **โรงพยาบาล** · วันที่รับ · Physician-in-header. The "โรงพยาบาล" field
  implies this lab **accepts specimens referred from other hospitals** — an actor the HIS LAB
  scope has not accounted for.
- **Turnaround & method are printed on BG49:** ผลภายใน **10 วันทำการ**, Qualitative, by **GCMS**.
  The first explicit TAT seen. `zdata_lab_test` likely needs `tat_days` + `method` + `result_type`.
- **Specimen handling rules are printed on the form** (5-10 ml, no preservative, deliver within
  1-2 h else freeze -20 °C and ship on dry ice). Candidate for a per-test `instructions` field
  the order screen can display.
- **Receiving desk has hours:** จันทร์–ศุกร์ 08.30–15.30 น. โทร 1415 ต่อ 3516. Relevant to the
  **รอรับเข้า → รับเข้าดำเนินการ** transition in [[lis]] — receiving is not 24/7.
- Newborn Screening is its own section (`BG45/48/54/55/56`) — a distinct workflow from
  diagnostic ordering (population screening, DBS cards).

## Entities & concepts touched

- [[lis]] — the module these forms belong to; extends it well past biochemistry.
- [[his-lab-module-plan]] — the build plan, whose scope this widens.
- [[his-lab-che-request-form]] · [[his-lab-che-order-component]] — the biochemistry equivalents
  the built screen was modelled on.
- [[his-lab-immuno-request-forms]] — the third lab unit, ingested the same day.
- [[his-lab-biochem-requirements]] — the out-lab (3.4.4.11) requirement this substantiates.

## Contradictions / open questions

- ⚠ **Transcribed from photos.** Gene symbols, exon ranges, and `c.`/`p.` notation are OCR-risky.
  Do not build a master table from `raw/` — get the lab's electronic list.
- A handwritten annotation sits next to `BG39 Duchenne/Becker MLPA` (reads roughly `6360 (จำนวน?)`)
  — illegible; ask what it means. A price? A volume count?
- **How do BG's composite codes bill?** Does ordering "Phenylketonuria" post 2 charges
  (BG15 + BG20) or 1? This decides whether components live on the order line or only in the LIS.
- **Is `C-20/L8.1`'s `BG1` narrative block re-keyed by hand, or pulled from the EMR?** If pulled,
  which EMR fields map to History / PE / Clinical diagnosis?
- **Does the genetics lab share the biochemistry LAB NO. series** or run its own?
- **No specimen-type block** on L8.1/L8.2 (unlike biochemistry's Blood/Urine/CSF grid) — is
  specimen implied by the test, or captured elsewhere?
- **How many lab units are in scope in total?** Three are now documented (ชีวเคมี, ชีวโมเลกุล,
  ภูมิคุ้มกัน) out of an unknown total — this reopens question 10 of
  [[his-lab-module-plan]] ("CHE = pilot or whole project?"). It now clearly looks like a pilot.
