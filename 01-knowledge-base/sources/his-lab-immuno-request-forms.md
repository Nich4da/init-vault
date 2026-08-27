---
type: source
title: HIS — Immunology lab request forms (C-20/L5.1-1, L5.1-2 Out Lab)
created: 2026-08-04
updated: 2026-08-04
tags: [his, lab, lis, immunology, allergy, out-lab, paper-form]
source_file: "03-source-materials/his-lab-immuno-request-forms.md"
source_type: image
source_date: 2026-08-03
author: งานภูมิคุ้มกันวิทยา (สถาบันสุขภาพเด็กฯ)
---

# HIS — Immunology lab request forms

> Two sheets from งานภูมิคุ้มกันวิทยา (ชั้น 5 ห้อง 505, โทร 1415 ต่อ 3517-8),
> **ฉบับปรับปรุง 16 เมษายน 2564**: an in-house request (`C-20/L5.1-1`) and a separate
> **OUT LAB** request (`C-20/L5.1-2`) — the first concrete picture of the out-lab workflow.
> Photos: `02-his/data/แลปภูมิคุ้มกันวิทยา-…/IMG_688{6,8}.PNG` → transcription in
> `03-source-materials/his-lab-immuno-request-forms.md`.

## Two sheets, two workflows

| | `C-20/L5.1-1` — in-house | `C-20/L5.1-2` — **OUT LAB** |
|---|---|---|
| Layout | 3 columns `CODE / TEST` | 4 columns (4th blank, for write-ins) |
| Grouping | 6 named groups | **none — one flat A→Z list** |
| Rough size | ~100 tests | ~200 tests |
| Code prefixes | `IM` · `IN` · `ICO` · a few `I0` | `I0…` / `IO…` / `IL…` |
| Extra header fields | **การขอรับผล LAB (ด่วน)** | **วันที่เก็บสิ่งส่งตรวจ**, **แพทย์ผู้ขอตรวจ** |

Groups on the in-house sheet: **Infectious Disease** · **Allergy & Autoimmune** ·
**Coagulant** · **Flow Cytometer** · **Molecular** · **Immunology test**.

## What's new versus the other two labs

### 1. A STAT / urgency field — first one seen anywhere
```
การขอรับผล LAB :  ☐ ด่วน OR   ☐ ด่วน อุบัติเหตุ   ☐ ด่วน เพราะ..........
```
Three mutually-exclusive urgency reasons, the third with free text. This is an **order-level**
attribute the built order screen has no concept of — and it presumably drives worklist ordering
in **รอรับเข้า / รับเข้าดำเนินการ** ([[lis]]).

### 2. สิทธิการรักษา printed on the request form
The first paper form to carry an **insurance-right** field. Reinforces that pricing/charging is
per-[[his-insurance|สิทธิ]] and that the lab needs it visible at request time, not only at billing.

### 3. Allergens carry a second, external code system
Allergy rows show **two** identifiers: the hospital code and a standard allergen id —
`IM82 / d1 D.pteronyssinus`, `IM84 / f1 Egg white`, `IN1 / e1 Cat epithelium`,
`IM94 / fx2 …`, `IN2 / i1 Honey bee`. These are ImmunoCAP-style allergen codes
(d = dust mite, f = food, e = epithelia, i = insect, fx = food mix).
**`zdata_lab_test` needs room for external/standard codes, not just the HIS code** — the same
slot the HIS→LIS code map (req. 11) would use.

### 4. Panels are ordinary rows
`IM120 Pediatric 27 Allergens` and `IM121 Thailand Profile 36 Allergens` are single orderable
lines that expand into dozens of results. Together with genetics' composite codes
([[his-lab-bg-request-forms]]), this makes **one order line → many results** a core requirement,
not an edge case.

### 5. Out lab as a whole parallel catalogue
Genetics marks out-lab per test (`: Out lab`). Immunology instead has an **entire second form**
with its own ~200-item catalogue and its own header fields. So out-lab is not one mechanism —
**each unit does it differently**, and the unused module 3.4.4.11 (ประสาน IT out lab / PCT lab)
in [[his-lab-biochem-requirements]] has to cover both shapes.

### 6. Specimen Type is free text
Both sheets have `Specimen Type : ..........` as a blank line — unlike biochemistry's structured
**สิ่งส่งตรวจ** grid (Blood/Clotted/iCa/Li-Hep/NaF/EDTA · Urine spot/24h · CSF · Body fluid).
Two different specimen-capture models across units.

## Header field comparison across all three labs

| Field | ชีวเคมี C-20/L3.1 | ชีวโมเลกุล L8.1/L8.2 | ภูมิคุ้มกัน L5.1-1/-2 |
|---|:--:|:--:|:--:|
| Name / Age / HN | ✅ | ✅ | ✅ |
| Ward | ✅ | ✅ (ตึก) | ✅ (Clinic/Ward) |
| Tel | ✅ | ✗ | ✗ |
| Diagnosis | ✗ | ✅ (narrative, L8.1) | ✅ (one line) |
| สิทธิการรักษา | ✗ | ✗ | ✅ |
| Requested by / แพทย์ | ✅ | ✅ | ✅ |
| Urgency (ด่วน) | ✗ | ✗ | ✅ |
| Specimen Type | ✅ structured grid | ✗ | ✅ free text |
| วันที่เก็บสิ่งส่งตรวจ | ✅ (เวลาเก็บ) | ✗ | ✅ (out-lab sheet) |
| LAB NO. box | ✅ | ✗ | ✗ |
| โรงพยาบาล (referring) | ✗ | ✅ (BG49 only) | ✗ |

**No two units agree.** A single fixed order header will not fit all three — the header itself
has to be driven by the lab unit.

## Entities & concepts touched

- [[lis]] — the module; this is its third documented unit.
- [[his-lab-bg-request-forms]] — the genetics forms, ingested together with these.
- [[his-lab-che-request-form]] — the biochemistry baseline being compared against.
- [[his-lab-module-plan]] — scope and schema this forces open.
- [[his-insurance]] — the สิทธิ field on the request form.

## Contradictions / open questions

- ⚠ **`I0` (zero) vs `IO` (letter O) is unreadable in the photo.** Codes appear to repeat
  (`I0010`, `I0011`, `I0019`, `I0042`, `I0002`, `I0030`…) which is almost certainly this
  ambiguity, not real duplicates. **The transcription must not be used as a master list** —
  ask for the lab's electronic catalogue.
- `IL36` is missing from the out-lab sequence (jumps IL35 → IL37) — retired, or a photo gap?
- **Four code namespaces now exist:** `C` (biochem), `BG` (genetics), `IM/IN/ICO` (immuno
  in-house), `I0/IO/IL` (out lab). Is there one global lab-test master, or one per unit?
  `I0026 CD19/20` and `I0032 CMV PCR` appear on the *in-house* sheet, which suggests the `I0`
  series is not purely out-lab — so the prefix does **not** cleanly encode routing.
- Sheets are **ฉบับปรับปรุง 2564 (2021)** — five years old. Are they still current?
- Is the urgency field (ด่วน OR / อุบัติเหตุ / เพราะ…) immunology-only, or a hospital-wide
  concept that just isn't printed on the other units' forms?
