---
type: synthesis
title: HIS LAB module — scope, gap analysis & build plan
created: 2026-07-31
updated: 2026-08-04
tags: [his, lab, lis, plan, requirements, active-build]
sources: ["[[his-lab-biochem-requirements]]", "[[his-lab-che-request-form]]", "[[his-lab-che-order-component]]", "[[his-system-flow]]", "[[his-lab-bg-request-forms]]", "[[his-lab-immuno-request-forms]]"]
---

# HIS LAB module — scope, gap analysis & build plan

> Derived from the biochemistry unit's requirement memo ([[his-lab-biochem-requirements]]),
> the paper request form ([[his-lab-che-request-form]]) and what is already built
> ([[his-lab-che-order-component]]). Proposals below are marked **(proposed)** — nothing here
> is confirmed by the users yet.

## 1. Scope

**In scope** — the [[lis|LIS]] three-state pipeline and everything hanging off it:
order entry · รอรับเข้า (accept/reject) · รับเข้าดำเนินการ · ออกผลแล้ว · doctor's result view ·
manual result entry · lab master data · risk register · 4 statistical reports.

**Explicitly out of scope** (the unit says they don't use these):
`3.4.4.1` รายการผู้ป่วยนัด · `3.4.4.3` รายการผู้ป่วยส่งต่อ · `3.4.4.10` one-click Order Work List
push · `3.4.4.11` PCT out-lab image interface.

**Added to scope** (used in real life, missing from the original spec):
`Lab Request Monitoring` · `สถานะการสั่งแลป` · `ข้อมูลห้องแลป` · `บันทึกความเสี่ยง(หน่วยงาน)`.

**Unit coverage — ⚠ REVISED 2026-08-04.** Two more units' forms arrived
([[his-lab-bg-request-forms]], [[his-lab-immuno-request-forms]]), and they confirm CHE is a
**pilot**, not the project:

| Unit | Forms | Codes | Status |
|---|---|---|---|
| งานชีวเคมี | `C-20/L3.1` | `C` | requirement memo + form + order screen built |
| ชีวโมเลกุลและพันธุศาสตร์ | `C-20/L8.1`, `L8.2` ×2 หน้า, `BG49` | `BG` | forms only — **no requirement memo yet** |
| งานภูมิคุ้มกันวิทยา | `C-20/L5.1-1`, `L5.1-2` (Out Lab) | `IM/IN/ICO`, `I0/IO/IL` | forms only — **no requirement memo yet** |
| _(others?)_ | — | — | total number of units **unknown** |

The new forms break four assumptions the CHE-shaped plan was built on — see
[[lis#The lab units (updated 2026-08-04 — this is a multi-unit module)|LIS § the lab units]]:
**composite codes** (one line → 2–3 codes, "ตามลำดับ") · **per-test required fields & sub-options**
· **clinical narrative as part of the order** · **out-lab as a test-master flag *and* as a whole
parallel catalogue**. Plus order-level **urgency (ด่วน)** and **สิทธิ on the request**, and a
**referring-hospital** header on `BG49`. **No two unit headers match.**

## 2. Screens

| # | Screen | Users | Core requirement |
|---|--------|-------|------------------|
| S1 | **สั่ง LAB (CHE order)** | doctor / ward | req. 2 — tick sheet in paper-form layout · **built** |
| S2 | **Lab worklist** — 3 tabs รอรับเข้า / รับเข้าดำเนินการ / ออกผลแล้ว | lab | req. 3 |
| S3 | **รอรับเข้า detail** — edit lines, change LAB NO., accept/reject, สิทธิ+payment, print slip | lab | req. 4 |
| S4 | **ออกผลแล้ว / ดูผล** — value + comment + Ref.Range, critical alerts, edit/hide, print | lab | req. 5 |
| S5 | **ลงผล Manual** (LIS-down fallback) | lab | req. 6 |
| S6 | **สถานะการสั่งแลป** (doctor's view) — pending markers, critical at LAB NO., stamped print | doctor | req. 8 |
| S7 | **ข้อมูลห้องแลป** (master data) — code map, price per สิทธิ, rejection reasons | lab admin | req. 11 |
| S8 | **บันทึกความเสี่ยง(หน่วยงาน)** | lab | req. 10 |
| S9 | **รายงาน LAB** — 3 statistics + 1 result search, all Excel | lab / management | req. 9 |
| — | patient demographics panel (embedded in S2–S4) | lab | req. 7 |

## 3. Gap analysis — what exists vs. what's needed

**Done**
- ✅ req. 2 — [[his-lab-che-order-component]]: all 90 codes, paper-form grouping/order, group
  tri-state checkboxes, search, category filter, selection summary.
- ✅ req. 7 (partial) — the `lab_patient_header` banner already shows HN/VN, name, age, gender,
  blood group, phone, สิทธิ chips, allergy alert, vitals/BMI + history.

**Missing on the order screen itself**
- ❌ **สิ่งส่งตรวจ block** — Blood/Clotted/iCa/Li-Hep/NaF/EDTA · Urine spot / 24h **+ ml** · CSF ·
  Body fluid **+ ระบุ** · ผู้เก็บตัวอย่าง · เวลาเก็บตัวอย่าง. Required as *data* (report dimension).
- ❌ **per-item modifiers** — GTT T1–T5 นาที.
- ❌ **แพทย์ที่สั่งตรวจ · Ward · Clinic · order datetime** (Ward/Clinic are the split dimension of
  every report in req. 9 — they must be captured at order time).
- ❌ **LAB NO.** field (lab-assigned, mutable).
- ❌ **no save target at all** — the order lives only in the hidden `selected_items_json` string.
- ❌ **prices are hard-coded `0`**; no per-สิทธิ price lookup.
- ❌ test catalogue is **hard-coded in a `vue-ui` script** instead of master data.

**Not started**
- ❌ S2–S9 entirely · advance-order auto-arrival (req. 1) · critical values · accept/reject
  workflow · manual result entry · HIS↔LIS code map · risk register · all 4 reports.

## 4. Proposed data model **(proposed — needs confirmation)**

Nothing lab-shaped has been confirmed in the live `his` MongoDB yet ([[his-data-model]]).
Sketch, following [[zdata-collections]] conventions (`_id` ObjectId, `xrstatx`, audit fields):

| collection | grain | key fields |
|---|---|---|
| `zdata_lab_order` | 1 per request slip | `lab_no`, `hn`, `vid.value`, `order_doctor`, `ward`, `clinic`, `specimen{type, tube, volume_ml, note}`, `collector`, `collected_at`, `status` (รอรับเข้า/รับเข้า/ออกผล/ปฏิเสธ), `received_at`, `received_by`, `reject_reason`, `rejected_by`, `rejected_at`, `sent_to_lis_at` |
| `zdata_lab_order_item` | 1 per test line | `order_id`, `test_code`, `test_name`, `group_code`, `modifier` (นาที/ml), `price`, `price_claimable`, `status` (pending/resulted/cancelled) |
| `zdata_lab_result` | 1 per resulted line | `order_item_id`, `lab_no`, `value`, `unit`, `ref_range`, `flag` (H/L/**critical**), `comment`, `resulted_at`, `entry_mode` (lis/manual), `hidden`, `hidden_by/at/reason` |
| `zdata_lab_test` | master | `code`, `name`, `group_id/code/name`, `sort_order`, `specimen_default`, `lis_code`, `active`, `modifier_type` — **plus (2026-08-04):** `lab_unit`, `components[]` (ordered, for `BG17+21`-style composites), `out_lab` (bool), `external_codes[]` (allergen `d1`/`f1`/…), `extra_fields[]` (e.g. urine creatinine mg/dl), `sub_options[]` (single-select, e.g. FISH Chr…), `tat_days`, `method`, `result_type` (quantitative/qualitative), `instructions` |
| `zdata_lab_unit` | master **(new)** | `code`, `name`, `form_code` (C-20/L3.1, L8.1, L5.1-1…), `code_prefix`, `header_fields[]`, `location`, `phone`, `receiving_hours` |
| `zdata_lab_price` | master | `test_code`, `inscl`, `unit_price`, `claimable_price`, effective dates |
| `zdata_lab_reject_reason` | master | `code`, `name`, `active` |
| `zdata_lab_risk` | risk register | `order_id`, `type`, `detail`, `reported_by`, `reported_at` |

Design notes:
- **Order lines must be documents, not a JSON string** — every report in req. 9 aggregates at
  the item level (test / order / specimen type × Ward × Clinic × month).
- Keep **`lab_no` mutable but audited**; the order `_id` stays stable.
- `sort_order` on `zdata_lab_test` encodes **both** the paper-form order (S1) and — if it
  differs — the **Report LIS order** required by reqs. 5 & 8. May need two columns.
- Critical-value thresholds: a `zdata_lab_critical` table keyed by test + **age band** is likely
  (paediatric hospital), *if* HIS owns them rather than the LIS.
- **(2026-08-04) The order header cannot be one fixed layout.** Each unit asks for different
  fields — biochem wants a structured specimen grid + LAB NO.; genetics wants ตึก + a clinical
  narrative (and on `BG49`, a *referring hospital*); immunology wants Diagnosis, สิทธิ, urgency,
  and free-text Specimen Type. Drive the header from `zdata_lab_unit.header_fields[]`.
- **(2026-08-04) `zdata_lab_order` gains** `lab_unit`, `urgency` (`ด่วน OR` / `ด่วน อุบัติเหตุ` /
  `ด่วน เพราะ…` + reason text), `inscl` snapshot, `clinical_history`, `physical_exam`,
  `clinical_diagnosis`, and `referring_hospital`.
- **(2026-08-04) `zdata_lab_order_item` gains** `extra_values{}` (per-test field answers) and
  `sub_option`. Whether `components[]` is expanded onto the item at order time depends on the
  billing answer (open decision 11).
- **(2026-08-04) The module still has no [[module-packages|`module_packages`]] record** — the
  step that makes it reachable in the app shell. Add it to the build order.

## 5. Build order **(proposed)**

1. **Master data first** — move the 90 codes out of the `vue-ui` script into `zdata_lab_test`
   (+ `lis_code`, `sort_order`, `specimen_default`). Unblocks S1 pricing, S7, and the reports.
2. **Finish S1** — specimen block, modifiers, doctor/ward/clinic, then a real **save** via an
   [[api-factory]] process writing `zdata_lab_order` + `_item`.
3. **S2 worklist** (3 status tabs) + **S3 รอรับเข้า** (accept/reject/LAB NO./print slip) —
   this is the lab's daily driver and the core of the memo.
4. **S4/S6 result views** — needs the LIS return path decided first (see open questions).
   Ship **S5 manual entry** early; it doubles as the seed data path for S4/S6.
5. **S7 master-data screens** + **S8 risk register**.
6. **S9 reports** last — they only work once items are documents.

## 6. Open decisions (blocking, ask the users)

1. **HIS ↔ LIS integration**: how do orders reach the LIS and results come back today?
   The one-click push is listed as unused. This decides steps 4–5.
2. **The `3.4.4.x` spec document** — we only have 4 quoted lines. Get the full list to fix the
   agreed baseline.
3. **Report LIS ordering** — need the actual LIS report to encode the canonical sort.
4. **Critical values** — owner (LIS vs HIS), and age-banded or not.
5. **ปกปิดผล governance** — who, reversible, audit trail.
6. **Advance orders (req. 1)** — where do the appointment date and the pre-order live, given
   the *ผู้ป่วยนัด* list is unused?
7. **IPD scope** — req. 7 mentions Admit; the wiki models OPD only so far ([[his-opd-flow]]).
8. **Prices** — source of unit/claimable price per สิทธิ ([[his-insurance]]), and whether the lab
   order posts charges to [[his-billing]].
9. **Faint items on the paper form** (C57, C33, C24.1/24.2, C79, C82) — inactive or not?
10. ~~**Other lab units** — is CHE the pilot, or the whole project?~~ **→ answered 2026-08-04:
    a pilot.** Replaced by: **how many units in total, and in what order do we build them?**

**New, added 2026-08-04 (all blocking on the multi-unit model):**

11. **Composite codes & billing** — does `BG17+21 Phenylketonuria` post 1 charge or 2? This
    decides whether `components[]` is expanded onto the order line or stays inside the LIS.
12. **Requirement memos for genetics and immunology** — we have their *forms* but not their
    *requirements*. งานชีวเคมี's memo is what made the plan possible; the other two need the same.
13. **Electronic test catalogues** — the transcriptions in `raw/` are OCR of photographs
    (gene/exon notation, and `I0` vs `IO` on the out-lab sheet, are unreliable). Get the master
    lists as data before building `zdata_lab_test`.
14. **Is urgency (ด่วน) hospital-wide** or immunology-only?
15. **One global test master or one per unit?** `I0026`/`I0032` sit on immunology's *in-house*
    sheet, so the prefix doesn't encode routing.
16. **LAB NO. series** — per unit or hospital-wide?
17. **Referred-in specimens** — `BG49`'s header has *โรงพยาบาล* instead of Ward. Does the LAB
    module have to handle patients who are not in this hospital's [[his-data-model|person/visit]]?
18. **Immunology forms are ฉบับปรับปรุง 2564 (2021)** — still current?

## Related
- [[lis]] — the concept page (pipeline, identifiers, results, master data).
- [[his-lab-che-order-component]] — what's built · [[his-lab-che-request-form]] — the paper form.
- Other units' forms: [[his-lab-bg-request-forms]] · [[his-lab-immuno-request-forms]].
- [[module-packages]] — the registration step the module still needs.
- [[his-lab-biochem-requirements]] — the requirement memo this plan implements.
- [[his]] · [[his-opd-flow]] · [[cpoe]] · [[his-billing]] · [[report-factory]].
