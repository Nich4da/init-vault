---
type: source
title: HIS — Lab CHE Order Component (form JSON)
created: 2026-07-31
updated: 2026-07-31
tags: [his, lab, lis, sdform, vue-ui, form-model]
source_file: "HIS/sdform_module/Lab_CHE_Order_Component.json"
source_type: note
source_date: 2026-07-31
author: user (developer)
---

# HIS — Lab CHE Order Component (`Lab_CHE_Order_Component.json`)

> The exported [[form-model-json|SDForm model]] for the **biochemistry lab order screen** —
> a patient header card + a 25-group / 90-code tick sheet reproducing
> [[his-lab-che-request-form]]. Built by the user; this is the project's starting point.

## Structure — 3 fields only

| # | field | component | name | role |
|---|-------|-----------|------|------|
| 1 | patient banner | `vue-ui` | `lab_patient_header` | HN/VN card + BMI/Vital Sign + allergy alert |
| 2 | hidden state | `text-input` (`hidden:true`) | `selected_items_json` | the **saved value** — JSON array of picked tests |
| 3 | tick sheet | `vue-ui` | `lab_che_order_ui` | the order UI |

All logic lives in `onCreated` / `onMounted` scripts — the [[vue-ui-pattern]] end to end.

## `lab_che_order_ui` — the tick sheet
- **Data is hard-coded in `onCreated`**: `s.groups = [...]` — 25 groups, 90 items, matching the
  paper form's grouping and order 1:1. Ids are synthesised as `groupId|code`; **`price` is set
  to `0` for every item** with an on-screen note *"ราคาเริ่มต้นเป็น 0 เนื่องจากเอกสารต้นฉบับไม่ระบุราคา"*.
- **Features already working:** free-text search over code+name (matches a group name too and
  then shows all its children) · a "กรองหมวดหมู่" chip row · per-group tri-state checkbox
  (`isGroupChecked` / `isGroupIndeterminate` / `toggleGroup`) · a selected-items summary panel
  with remove/clear · a running count and total.
- **Persistence:** `s.sync()` writes `JSON.stringify(s.selectedList())` into `selected_items_json`
  via `field.getFormRef().setFieldValue(...)`. `formConfig.onFormDataChange` reverses it — when
  `selected_items_json` is cleared externally it empties `s.selected`.
- Styling lives in `formConfig.cssCode` (a `.lab-*` design system: 3-col grid → 2 → 1 responsive,
  Element Plus CSS variables so it follows the theme).

## `lab_patient_header` — the banner
- Reads the current visit transaction from **`getFormRef().$labTran`** (set by `s.setTran()`,
  re-read on `onMounted`) — the same carry-the-selected-visit convention as
  [[his-emr-form]]'s `$examTran`.
- Renders from [[his-data-model]] shapes: `tran.vid.pid` = person (`hn`, `prename.label`,
  `p_fname/p_lname`, `age`, `p_gender` 1/2, `p_abogroup` 1–5/9, `p_phone`, `p_pic[0].url`),
  `tran.vid` = visit (`vn`, `visit_date`), plus `tran.pttype[]` and `tran.allergy_tags[]`.
- Carries a lot beyond identity: **BMI + BSA card**, **BP/PR/Temp/RR vitals** with
  add/edit buttons ([[openform]]), an inline **history modal grouped by visit**, and
  hand-rolled **SVG trend charts** (`bmiHistoryChartBmi()`, `vsHistoryChartBp()`, …).
- A **red allergy alert bar** renders when `tran.allergy_tags` is non-empty.

## Key takeaways
- Requirement 2 of [[his-lab-biochem-requirements]] (**tick sheet, ordered like the paper form**)
  is **done** — this is the one requirement already satisfied.
- The whole test catalogue is currently **hard-coded in a `vue-ui` script**. It should move to a
  master collection (`zdata_lab_test` or similar) so that price-per-สิทธิ (req. 11), the
  **HIS→LIS code map** (req. 11) and per-item enable/disable become data, not code.
- The saved payload is a **JSON string in one hidden text field** — fine for a prototype, but it
  can't be queried, so none of req. 9's statistics can be built on it. Order lines need to
  become documents.
- The component captures **no specimen, no LAB NO., no ordering doctor, no ward, no
  collector/collection time, and no per-item modifiers** (GTT นาที, urine 24h ml, body-fluid
  ระบุ) — all of which the paper form and requirements demand.

## Entities & concepts touched
- [[his-lab-che-request-form]] — the layout it reproduces (verified: all 90 codes present).
- [[his-lab-biochem-requirements]] — the requirements it partially satisfies.
- [[his-lab-module-plan]] — where the gaps are turned into a build plan.
- [[vue-ui-pattern]] · [[form-model-json]] · [[client-api-this]] · [[openform]] — patterns used.
- [[his-data-model]] — the person/visit fields the header consumes.

## Contradictions / open questions
- `lab_patient_header` appears **twice in the vault**: the older standalone
  `HIS/sdform_module/lab_order_form_step1.txt` (simple card) and the richer copy embedded here.
  Two divergent copies of the same component — decide which is canonical.
- Nothing writes the order anywhere yet: no save process, no `zdata_lab_order` collection,
  no [[api-factory]] call. `selected_items_json` is the only output.
- Group-header codes (`C1`, `C25`, `C36`, `C35`) are stored as group metadata, not as items —
  if the LIS expects a panel code they are currently lost on save.
