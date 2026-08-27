---
type: source
title: HIS — EMR Form (EMR.json)
created: 2026-07-17
updated: 2026-08-27
tags: [initcraft, his, form-factory, sdform, healthcare, emr, example]
sources: []
source_file: "Form-Builder/SDForm/sdform_module/EMR_form/EMR.json"
source_type: note
source_date: unknown
author: unknown
url:
---

# HIS — EMR Form (`EMR.json`)

> An exported [[sdform|SDForm]] model for the **OPD EMR (electronic medical record)**
> workspace of the [[his|Hospital Information System]] — a doctor's clinical "SOAP" screen.
> The most complex example ingested so far (**37 widgets**, 7 event scripts, ~16 kB of code).

## Summary
- Top-level `tab` **`main_app`** with four panes:
  1. **Unit Queue** — `list-ui` `visit_unit` (patients waiting in the unit) + `btn_unit`.
  2. **My Room** — `list-ui` `visit_room` + `btn_room` (the doctor's exam room).
  3. **EMR** — the clinical record itself (below).
  4. **Completed** — `list-ui` `visit_done`.
- The **EMR** pane = an `affix` patient banner (`vue-ui` **`opd_card`**) over an `emr_box`
  grid of `card`s, each hosting a `record-ui` for one **SOAP** section:
  - `record_cc` — **ประวัติอาการ / CC** (chief complaint, S)
  - `record_pe` — **ตรวจร่างกาย / PE** (physical exam, O)
  - `record_dx` — **วินิจฉัยโรค / Dx** (diagnosis, A)
  - `record_plan` — **แผนการรักษา / Plan** (treatment plan, P)
  - plus `vue-ui` `consult_banner`, `consult_box` (**ปรึกษา** / referrals) and
    `registry_card` (**disease registry**). A hidden `sys_box` holds `text-input` `vid`.

## Key takeaways
- **`opd_card` is the orchestrator.** Its `onCreated` (7.4 kB) defines `setTran(row)` which,
  on selecting a queue patient, fans the visit out to every sibling widget:
  `getFieldRef('consult_box').vueState.load(vid)`, `…('registry_card').vueState.load(personId,…)`,
  shows/hides `emr_box`, and stamps `vid` — **one entry point, many reactive updates**.
- **Client data queries via [[crudgetall]]:** BMI and Vital-Sign "latest record" cards load
  with `userState.crudGetAll({ sdProvider: { providerId: <formId>, providerType: 'FORM',
  params, options: { where, orderBy, limit:1, page:1 } }, totalEnable:false }, cb)`. The
  `where` uses the shared query language: `` `vid.value` = CONVERT(:vid, 'objectId') ``.
- **Vital-sign colour rules** (`vsRules`/`vsClass`) show client-side clinical logic:
  warn (yellow) outside normal range, danger (red) past critical thresholds; BP takes the
  worse of systolic/diastolic.
- **Cross-tab hand-off:** the queue tab stashes the chosen visit on `form.$examTran`; the
  lazy-mounted EMR tab reads it in `onMounted`. A custom form property used as a channel.
- **Exam timer:** `setInterval` in `onMounted` ticks a clock from `tran.start_at`
  (cleared/guarded against re-mount).
- **Sandbox note (load-bearing):** inside `vue-ui` code `localStorage` is shadowed to
  `undefined` (restricted compile context) — per-device "unread" state was abandoned for this.

## Referenced forms & processes (by id)
_As with the [[his-patient-form]], none resolve in the current `erp` snapshot._

| Role | id | via |
|------|----|-----|
| PERSON | `6a37d3bd4cfbfdbe257fc912` | `openForm` |
| BMI form | `6a4689ef39179670f85ba2a2` | `crudGetAll` + `openForm` |
| Vital Sign form | `6a470b4939179670f85ba2d8` | `crudGetAll` + `openForm` |
| Consult form | `6a482ea68ca8083d715e3498` | `crudGetAll` + `openForm` |
| visit_tran (re-fetch) | `6a461235e521219e514d1c4b` | `crudGetAll` |
| Allergy-sync process | `6a50cc20e97c6d6bbf111ce0` | `runProcess` |
| Disease-registry process | `6a51a09c6e185ae01ab5bb4d` | `runProcess` |

## Entities & concepts touched
- [[his]] · [[form-model-json]] · [[vue-ui-pattern]]
- [[crudgetall]] — the client-side "latest record" query pattern (heavily used here).
- [[openform]] · [[runprocess]] · [[client-api-this]] (`getFieldRef`, `.show()/.hide()`, `.setValue()`, `dayjs`, `alert`).
- [[dataprovider]] — the `sdProvider`/`where`/`CONVERT` query shape, mirrored client-side.
- [[field-components]] — `record-ui`, `list-ui`, `vue-ui`, `affix`, `button-ui`.

## Contradictions / open questions
- SOAP/consult/registry backing forms and the two processes are **not in the snapshot** —
  field names (`consult_status`, `consult_priority`, `allergy_tags`, `start_at`,
  `xtbxlv1_xfx_id`) are read from the form's scripts, unverified against MongoDB.
- `xtbxlv1_xfx_id` (person id carried on `vid`) is an opaque joiner key worth documenting
  once a `zdata_visit*` collection is available to inspect.
