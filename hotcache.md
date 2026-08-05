---
type: meta
title: Hot Cache
updated: 2026-08-04
---

# 🔥 Hot Cache — read me first

> Fast-path snapshot of recent work (~500 words max). A cache, **not** source of truth —
> if this disagrees with a page, the page wins ([[CLAUDE]] §7).

**Domain:** [[initcraft|initCraft / SDForm]] + its real app **[[his|HIS]]** (สถาบันสุขภาพเด็กฯ).
User = developer, Thai, wants step-by-step + real-data verification.
**Counts:** 15 sources · 8 entities · 30 concepts · 3 syntheses. **As of:** 2026-08-04.

## 🔨 ACTIVE BUILD — LAB / [[lis|LIS]] — ⚠ **now multi-unit** (revised 2026-08-04)
Plan/gaps/schema: **[[his-lab-module-plan]]**. Spine = `รอรับเข้า → รับเข้าดำเนินการ → ออกผลแล้ว`, 9 screens S1–S9.

| Unit | Forms | Codes | Have |
|---|---|---|---|
| ชีวเคมี | C-20/L3.1 | `C` | memo + form + **order screen built** |
| ชีวโมเลกุล/พันธุศาสตร์ | L8.1 · L8.2×2 · BG49 | `BG` | forms only ([[his-lab-bg-request-forms]]) |
| ภูมิคุ้มกันวิทยา | L5.1-1 · L5.1-2 (Out Lab) | `IM/IN/ICO`, `I0/IO/IL` | forms only ([[his-lab-immuno-request-forms]]) |

**CHE = pilot, not the project.** 4 things the built screen can't express:
**composite codes** (`BG17+21` = order 2–3 codes ตามลำดับ, ~50 rows) · **per-test required fields**
(BG49 urine creatinine) **+ single-select sub-options** (BG50 FISH Chr) · **clinical narrative in
the order** (BG1 History/PE/Dx) · **out lab = per-test flag (BG) *and* a parallel catalogue (IM)**.
Also new: **urgency ด่วน OR/อุบัติเหตุ/เพราะ__** · สิทธิ on the request · panels (IM120/121) ·
external allergen codes (d1/f1/e1/fx5) · **โรงพยาบาล header on BG49 = referred-in specimens**.
**No two unit headers match** → header must come from a new `zdata_lab_unit.header_fields[]`.
First price seen anywhere: `BG45 TSH (DBS) = 125 บาท`. First TAT: BG49 = 10 วันทำการ, GCMS.
**Still ❌ on S1:** any save at all · specimen block · LAB NO. · prices `0` · 90 codes hard-coded in `vue-ui`.
**Next:** `zdata_lab_test` + `zdata_lab_unit` master → finish S1 + save process → S2/S3 → S5 → S4/S6 → S7/S8 → S9.
**🎨 UI designed 2026-08-04:** [[his-lab-worklist-ui]] — 3 แท็บ รอรับ/รับเข้าแล้ว/ออกผลแล้ว, master–detail,
mockup กดได้ที่ `HIS/ui/lab-worklist-mockup.html`. **ไม่มี Figma integration** — ส่งเป็น HTML แทน
(เข้า Figma ผ่านปลั๊กอิน `html.to.design`). Tab 2 = list order เดิม. 3 จุดที่แต่งเอง: ด่วน · ราคา · ลำดับ Report LIS.

## ⚠ Blocking asks (18 in the plan; the live top 6)
1. how orders reach the LIS today 2. **electronic test catalogues** (raw/ is OCR of photos —
`I0` vs `IO` unreadable, gene/exon risky; **do not use as a master list**) 3. **requirement memos
for ชีวโมเลกุล + ภูมิคุ้มกัน** (only ชีวเคมี has one) 4. composite codes = 1 charge or N?
5. how many lab units total 6. price per [[his-insurance|สิทธิ]] source.

## 🆕 [[pis|PIS]] has started + [[module-packages]]
`module_packages` = App Factory registry making a form reachable ([[his-module-packages-backup]]).
`pis_drug` "Drug & Stock" / *Pharmacy Back Office*, tab "Drug Items", unit `B001 เภสัชกรรม`,
created 07-29. **Form body not exported — ask for `6a68f6cec91cb8030e26d75d`.**
⚠ `app_assign_roles` + `tab_roles` = `null` on every module. **LAB has no module record yet.**

## 🆕 Second domain — [[open-design]] (2026-08-04, unrelated to HIS)
`nexu-io/open-design` v0.16.1 at `../open-design/` (zip unpack, **not git**). OSS Claude Design
alt: ships no agent, drives the CLIs on your `PATH`. Pages: [[open-design-repo]] · [[design-md]] ·
[[skill-md]] · [[od-plugin]]. Steal-worthy: `AGENTS.md` single entry · `CONTEXT.md` glossary with
`_Avoid_:` · UI+CLI parity per PR · red-spec-first. ❓ **why it's here is unrecorded.**

## 📦 Parked — เวชระเบียน OPD LaTeX ([[report-latex]])
SQL + layout OK locally; server lacks Tectonic + Sarabun + `code128.sty`.

## Key facts (carry forward)
- [[his-data-model]]: `zdata_visit` → `zdata_person` ON `person._id = visit.pid.value`; assessment
  via `vid.value`. Coded fields `{label,value}` → `.label`. HN/VN = `69`+5, **string**.
- `his` db = **159.223.80.155** (78 coll.), ≠ the env-var `erp` server → inline read-only URI per
  session. **No `zdata_lab_*` confirmed.** 🔐 root URI + license JWT were pasted in chat → rotate.
- ⏸ Don't re-ask: flow labels IOT/coder/FA/CSOP/FDH; `zdata_section`→`zdata_service_type`.
