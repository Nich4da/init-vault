---
type: concept
title: LIS (laboratory information system)
created: 2026-07-19
updated: 2026-08-04
tags: [initcraft, his, laboratory, healthcare]
sources: ["[[his-system-flow]]", "[[his-lab-biochem-requirements]]", "[[his-lab-che-request-form]]", "[[his-lab-che-order-component]]", "[[his-lab-bg-request-forms]]", "[[his-lab-immuno-request-forms]]"]
---

# LIS — Laboratory Information System

> The lab module of the [[his|HIS]]: sends lab orders out and receives results back.
> Since 2026-07-31 this is an **active build** — see [[his-lab-module-plan]].

## In the flow
Per [[his-system-flow]], **LIS** is one of the clinical modules fanning out from the
**visit (VN)** step, beside [[cpoe]] and [[pis]]. It is drawn with a **two-way** link to
**ผลแล็บ (lab results)** — order goes out, result comes back — unlike the one-way order
modules.

## The three-state pipeline (the spine of the module)
[[his-lab-biochem-requirements]] req. 3 defines the lab's own mental model, and every screen
hangs off it:

```
(order created)  →  รอรับเข้า  →  รับเข้าดำเนินการ  →  ออกผลแล้ว
                      ↓ reject specimen (reason + rejecter)
                    ปฏิเสธสิ่งส่งตรวจ → บันทึกความเสี่ยง(หน่วยงาน)
```

- **รอรับเข้า** — the lab has the order but not (yet) an accepted specimen. Editable: change
  test lines, change **LAB NO.**, accept (stamping a receive time) or reject.
- **รับเข้าดำเนินการ** — specimen accepted, analysis in progress.
- **ออกผลแล้ว** — results returned; partial results leave the rest **pending (รอผล)**.

Two entry doors into `รอรับเข้า`: an order placed now, and an **advance order that
auto-materialises on its appointment date** (req. 1).

## Identifiers
- **LAB NO.** is **lab-owned and mutable** — the paper form marks its box
  *"สำหรับเจ้าหน้าที่ Lab เท่านั้น"* and req. 4 asks to change it. It is *not* the HIS order id;
  both must exist side by side.
- Results and critical-value alerts are addressed **by LAB NO.** in the doctor's view (req. 8).

## The lab units (updated 2026-08-04 — this is a multi-unit module)

Three of the hospital's lab units are now documented, each with its **own paper form, its own
code namespace, and its own header fields**. งานชีวเคมี is a *pilot*, not the whole project.

| Unit | Forms | Code prefix | Distinctive |
|---|---|---|---|
| **งานชีวเคมี** (biochemistry) | `C-20/L3.1` | `C` | structured สิ่งส่งตรวจ grid · LAB NO. box · per-item modifiers (GTT นาที, urine 24h ml) |
| **ชีวโมเลกุลและพันธุศาสตร์** (genetics) | `C-20/L8.1`, `C-20/L8.2` (2 หน้า), `BG49` | `BG` | **composite codes** · per-test required fields · clinical narrative · `: Out lab` per test · one printed price |
| **งานภูมิคุ้มกันวิทยา** (immunology) | `C-20/L5.1-1`, `C-20/L5.1-2` (**Out Lab**) | `IM`/`IN`/`ICO`, out-lab `I0`/`IO`/`IL` | **urgency (ด่วน)** · สิทธิการรักษา on the form · allergen codes · panels · a whole separate out-lab catalogue |

**No two headers match** — see the comparison table in [[his-lab-immuno-request-forms]]. A single
fixed order header cannot serve all three; the header has to be driven by the lab unit.

### Consequences for `zdata_lab_test`
- **`components[]` (ordered)** — a genetics row like `BG17+21 Phenylketonuria` orders *two* codes
  "ตามลำดับ"; `BG17+19+22` orders three. Biochemistry's "Globulin = C2 + C3" was the same
  pattern seen once; in genetics it is ~50 rows. **One order line → many test codes.**
- **Panels** do the same in the other direction: `IM120 Pediatric 27 Allergens`,
  `IM121 Thailand Profile 36 Allergens` — one line → many results.
- **Per-test field schema** — `BG49` demands `urine creatinine (mg/dl)`; `BG14`/`Other` rows take
  free text; GTT takes นาที. Tests need optional extra inputs, not just a checkbox.
- **Per-test sub-options (single-select)** — `BG50 FISH` picks one of
  `Chr 22q11.2 / 7q11.2 / 15q11-q12 / 4p16.3 / 5p15.3-15.2 / Other`.
- **`out_lab` flag on the test master** — genetics marks `BG50`/`BG51` as `: Out lab` on the
  test itself, so routing is master data, not an order-time decision.
- **External code slot** — allergens carry ImmunoCAP-style ids (`d1`, `f1`, `e1`, `i1`, `fx5`)
  *in addition to* the HIS code. Same slot the HIS→LIS map (req. 11) needs.
- **`tat_days` · `method` · `result_type`** — `BG49` prints "ผลภายใน 10 วันทำการ", Qualitative,
  by GCMS. First explicit turnaround time seen.
- **`instructions`** — BG49's 5 collection rules (5-10 ml, no preservative, ≤1-2 h or freeze
  −20 °C + dry ice) are printed on the form; the order screen should show them.

### Order-level attributes not yet in the built screen
- **Urgency:** `☐ ด่วน OR · ☐ ด่วน อุบัติเหตุ · ☐ ด่วน เพราะ______` (immunology). Presumably
  drives worklist ordering in รอรับเข้า.
- **สิทธิการรักษา** on the request itself ([[his-insurance]]).
- **Clinical narrative** — genetics `BG1` reserves half a page for History / Physical exam /
  Clinical diagnosis; `BG49` requires History + a diagnosis pick-list of 8 IEM conditions.
- **Referring hospital** — `BG49`'s header has **โรงพยาบาล** instead of Ward, i.e. the genetics
  lab receives specimens referred from *other hospitals*. An actor the scope hasn't accounted for.

## Ordering (CHE)
- The order sheet is a **checkbox form, laid out exactly like the paper
  [[his-lab-che-request-form|ใบส่งตรวจ]]** — explicitly *not* a one-at-a-time search (req. 2).
- Built already: [[his-lab-che-order-component]] — 25 groups / 90 codes for งานชีวเคมี.
- **Specimen (สิ่งส่งตรวจ)** is part of the order, with tube/type detail
  (Clotted / Ionized Ca / Lithium Heparin / NaF / EDTA / Urine spot / Urine 24h + ml /
  CSF / Body fluid + ระบุ) plus **ผู้เก็บตัวอย่าง** and **เวลาเก็บตัวอย่าง**. It is a reporting
  dimension (req. 9), so it must be stored as coded data.
- Some tests carry **modifiers** — GTT T1–T5 take นาที, Urine 24 hr takes ml.
- **"สั่ง Globulin = C2 + C3"** — a derived result, not an orderable code.

## Results
- Come back from the **LIS**, not from HIS. Each line carries **value + comment + Ref. Range**,
  and the display order must follow the **Report LIS** order (reqs. 5 & 8).
- **Critical values** are required in three places: per test, per order, and beside the
  **LAB NO.** on the doctor's screen.
- Results can be **edited or hidden (ปกปิด)** by the lab — governance rules undecided.
- **Manual entry fallback** is mandatory for LIS downtime (req. 6).
- Printouts are legally **copies**: stamp *"สำเนาพิมพ์ออนไลน์"* + printer + datetime, and
  paginate `page 1/2`; the signed MT original is the legal document (req. 8).

## Master data (เมนู "ข้อมูลห้องแลป")
- **HIS → LIS test-code map** (req. 11) — the integration contract. Now known to span **four**
  code namespaces (`C` · `BG` · `IM/IN/ICO` · `I0/IO/IL`), plus external allergen ids.
- **Unit price / reimbursable price per [[his-insurance|สิทธิ]]** (req. 11). The paper forms
  carry no prices — **except one**: `BG45 TSH (DBS) — 125 บาท`. So prices exist somewhere off
  the paper. [[his-lab-che-order-component]] hard-codes `price: 0`.
- **Specimen-rejection reason list** (req. 11), feeding the risk register (req. 10).
- **Lab unit master** — a new requirement: each unit owns its form layout, header fields, code
  namespace, receiving desk, and hours (genetics receives จันทร์–ศุกร์ 08.30–15.30 only).

## Data
- Exchanges **`ผลแล็บ`** (lab results) — a data node in [[his-system-flow]], still not mapped to
  a [[zdata-collections|collection]]. No `zdata_lab_*` collection has been confirmed in the live
  `his` database yet.

## Open questions
- **How do orders actually reach the LIS today?** The one-click Order Work List push
  (`3.4.4.10`) is listed as *unused*, yet results clearly flow back. Manual re-key? Paper?
- Result collection/schema; whether results attach to `order_tran` or a separate lab table.
- Who owns **critical-value thresholds** (LIS or HIS) and are they age-banded? (paediatric
  hospital → likely yes)
- Governance of **ปกปิดผล**: who, reversible, audited?
- Does the lab module span **IPD** as well? Req. 7 asks for "Check in หรือ Admit ที่ไหน".
- **(new) How many lab units total?** Three documented; the total is unknown. This effectively
  answers the old "CHE = pilot or whole project?" question — it's a pilot.
- **(new) One global test master, or one per unit?** `I0026`/`I0032` appear on immunology's
  *in-house* sheet, so the `I0` prefix does not cleanly mean "out lab" — the prefix does not
  encode routing.
- **(new) Do composite codes bill as 1 charge or N?** Decides whether `components[]` lives on the
  order line or only inside the LIS.
- **(new) Does each unit run its own LAB NO. series**, or is it hospital-wide?
- **(new) The immunology sheets are ฉบับปรับปรุง 2564 (2021)** — still current?

## Related
- Build plan: [[his-lab-module-plan]] · order UI: [[his-lab-che-order-component]].
- Unit forms: [[his-lab-che-request-form]] · [[his-lab-bg-request-forms]] ·
  [[his-lab-immuno-request-forms]].
- Flow: [[his-opd-flow]] · siblings: [[cpoe]] · [[pis]] · read in [[his-emr-form]].
- Reports & printing: [[report-factory]] · charges: [[his-billing]].
