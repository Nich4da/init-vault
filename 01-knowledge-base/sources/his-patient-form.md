---
type: source
title: HIS — Patient Form (patient.json)
created: 2026-07-17
updated: 2026-08-27
tags: [initcraft, his, form-factory, sdform, healthcare, example]
sources: []
source_file: "Form-Builder/SDForm/sdform_module/patient.json"
source_type: note
source_date: unknown
author: unknown
url:
---

# HIS — Patient Form (`patient.json`)

> An exported [[sdform|SDForm]] model (VForm JSON) for the **Patient registration / lookup**
> workspace of a [[his|Hospital Information System]] built on [[initcraft]]. A real,
> non-trivial application example — the first application (vs. platform docs) ingested.

## Summary
- Export shape is the [[form-model-json|VForm model]]: `{ fields: [widget-tree], formConfig: {…} }`
  — `modelName: formData`, `refName: sdForm`. **29 widgets**, 4 event scripts.
- Two-column [[field-components|grid]] layout:
  - **Left** — patient identity card: a `select-form-input` **`pid`** ("Person"), a
    `vue-ui` **`person_info`** custom card, and a `smart-card-ui` **`smart_card_person`**
    (Thai national ID smart-card reader).
  - **Right** — a `tab` with three panes: **Visit List** (`list-ui` `visit_list`),
    **สืบค้นผู้ป่วย / Patient search** (text/date/radio fields `ids, fname, lname, r_fname,
    r_lname, phone, bod, cond_with` + `button-ui` `btn_find` + `datagrid-form-ui`
    `person_list`), and **Patient Flow** (`vue-ui` `patient_flow`).
- The logic lives in **field event scripts**, not the layout. This form is a showcase of
  the [[client-api-this|client API]]: [[openform]], [[runprocess]], and `vueState`.

## Update (2026-07-20)
The `person_info` `vue-ui` now carries a **rich inline HTML template** (`content`): a patient
banner (**HN**, `prename.label`+`p_fname`+`p_lname`, gender tag, **วันเกิด → Thai BE**, `age` ปี,
blood group, `p_phone`) over a **สิทธิการรักษา** block (`inscl_main_code` / `inscl_sub_code` /
`inscl_hos_main` / `inscl_hos_sub`) and a **สิทธิในโรงพยาบาล** list (`inscl_hos[]` →
`inscl_item_main`/`inscl_item_sub`), plus the three action buttons. Client-side coded maps live in
the template: gender `'1'`=ชาย/`'2'`=หญิง; `p_abogroup` `'1'`A/`'2'`B/`'3'`AB/`'4'`O/`'5'`/`'9'`ไม่ทราบ;
`birth_date` (AD `YYYY-MM-DD`) → `dd ‹Thai month› (พ.ศ.)`. Insurance model → [[his-insurance]].

## Key takeaways
- **`vue-ui` + [[vue-ui-pattern|vueState]]** is the workhorse. `person_info.onCreated`
  attaches methods to `this.vueState` — `editPerson()`, `checkRight()`, `openVisit()` — bound to
  the template buttons. **`openVisit()` opens the [[his-visit-form|VISIT form]]** (`6a40fdec…`,
  `dataId=null` → new visit ⇒ new **VN**), then refreshes `visit_list`. **`checkRight()`** →
  [[his-insurance|insurance]] check (process `6a4ccaef…` → PERSON INSURANCE form).
- **Sub-forms via [[openform]]:** `form.openForm(FORM_ID, dataId, parentId, null, { afterSaveCallback })`.
  On save it calls `form.subFormClose()` then **merges only selected keys** back into the
  reactive `pid` object (so the card re-renders without a full reload).
- **Calling server logic via [[runprocess]]:** `checkRight()` runs a "check insurance right"
  process; `patient_flow` runs a process returning `{ visits, vid, steps }` and renders a
  **vue-flow** station diagram of the visit's journey.
- **Reactive-merge pattern:** after editing PERSON/INSURANCE in a sub-form, it copies a
  fixed `keys` list (`hn, prename, p_fname, …, inscl_*`) from the saved doc onto the live
  model object rather than re-querying — a recurring HIS idiom.

## Referenced forms & processes (by id)
_These ids are passed to `openForm` / `runProcess`; **none exist in the current
`erp` read-only snapshot** — the HIS app is newer than the DB dump (see [[his]])._

| Role | id | via |
|------|----|-----|
| PERSON (edit patient) | `6a37d3bd4cfbfdbe257fc912` | `openForm` |
| PERSON INSURANCE | `6a467fb539179670f85ba29e` | `openForm` |
| Visit | `6a40fdec4b6dfdf45acbfbce` | `openForm` |
| Check-right process | `6a4ccaef49285083acfeb081` | `runProcess` |
| Patient-flow process | `6a5080bb6e185ae01ab5bb1b` | `runProcess` |

## Entities & concepts touched
- [[his]] — the application this form belongs to.
- [[form-model-json]] — the export structure this file exemplifies.
- [[vue-ui-pattern]] — `vue-ui` + `vueState` custom components.
- [[openform]] — sub-form popups + `afterSaveCallback`.
- [[runprocess]] — client → [[api-factory]] process calls.
- [[client-api-this]] — `this.getFormRef()`, `getFieldRef`, `refField`, `alert`, `dayjs`.
- [[field-components]] — `select-form-input`, `smart-card-ui`, `list-ui`,
  `datagrid-form-ui`, `vue-ui`, `button-ui`.

## Contradictions / open questions
- The four referenced ids are **absent from this snapshot**; their field schemas and the
  process bodies are unverified against MongoDB. Treat the details above as read from the
  form's own scripts, not confirmed server-side.
- `smart-card-ui` behaviour (Thai ID reader) isn't documented in the ingested platform docs
  yet — candidate for a component page.
