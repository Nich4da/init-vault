---
type: entity
title: HIS (Hospital Information System)
created: 2026-07-17
updated: 2026-07-31
tags: [initcraft, his, healthcare, application, example]
aliases: [Hospital Information System, EMR app, OPD system]
sources: ["[[his-patient-form]]", "[[his-emr-form]]", "[[his-visit-form]]", "[[his-system-flow]]", "[[his-lab-biochem-requirements]]", "[[his-lab-che-request-form]]", "[[his-lab-che-order-component]]"]
---

# HIS (Hospital Information System)

A **hospital / clinic application built on [[initcraft]]** — the first real *application*
in this wiki (everything before was platform reference). We know it through two exported
[[form-model-json|form models]]: [[his-patient-form]] and [[his-emr-form]]. Source files
live under `HIS/` in the vault (`HIS/sdform_module/`, plus empty `api_factory/`,
`sql_factory/`, `report_factory/` folders mirroring initCraft's [[form-factory|factories]]).

## End-to-end flow (the architecture)
The [[his-system-flow|"architecture" flow diagram]] maps the whole OPD journey and gives the
two forms above a place in a larger pipeline — see [[his-opd-flow]] for the narrated version:

> **Person (HN)** → **เช็คสิทธิ์** → **visit (VN)** → **opd_trans (EMR)** → clinical modules
> ([[cpoe|CPOE]] · [[pis|PIS]] · [[lis|LIS]] · Diag · Clinical Doc) → **[[his-billing|FA]]**
> (fa_trans / ปิดสิทธิ์) → **End** → **[[his-claims|ระบบเคลม]]** (CSOP / e-claim) → outbound
> **[[his-data-integrations|43 แฟ้ม / FDH / refer]]** feeds.

[[his-patient-form]] realises the front-desk steps; [[his-emr-form]] realises the EMR step.

## What it does (from the forms)
- **Patient registration & lookup** — identity card with Thai smart-card read, search by
  name/phone/DOB, a per-patient **visit flow** diagram. ([[his-patient-form]])
- **OPD EMR** — a doctor's clinical screen: patient banner, **SOAP** note (CC / PE / Dx /
  Plan) via `record-ui` cards, **Vital Signs & BMI** latest-record cards, **consult /
  referral** workflow, and a **disease registry**. ([[his-emr-form]])
- **Queue-driven** — Unit Queue → My Room → EMR → Completed tabs; a selected visit
  (`$examTran`) is carried across tabs and fanned out to every panel.
- **LAB / [[lis|LIS]]** — *(active build, 2026-07-31)* biochemistry order entry as a tick sheet
  copying the paper [[his-lab-che-request-form|ใบส่งตรวจ C-20/L3.1]]
  ([[his-lab-che-order-component]]), on the lab's **รอรับเข้า → รับเข้าดำเนินการ → ออกผลแล้ว**
  pipeline. Scope & gaps in [[his-lab-module-plan]].
- **Visit / VN** — a per-encounter [[his-visit-form|Visit form]] opened from the workspace
  ("Open Visit"): `vn` autonumber (`69`+5), `visit_date`, clinic/doctor/type/priority, `cc`,
  diagnosis, discharge (`typeout`), money fields, and a snapshotted [[his-insurance|สิทธิ]]
  sub-form. Links to the patient via **`pid.value` = person `_id`**.

## Data model quick facts (from the forms)
- **person ↔ visit join = `visit.pid.value` → `person._id`** (for reports/queries).
- **HN** & **VN** both = `autonumber` `69`+5-digit, separate counters (HN on PERSON, VN on visit).
- [[his-insurance|สิทธิการรักษา]] (`inscl_*`) lives on PERSON, snapshotted onto each visit.
- ⚠ The live `his` MongoDB (`zdata_person`, `zdata_visit`, `zdata_patient_assessment`, `zdata_inscl_*`)
  is **not reachable** via the `erp` read-only connection currently configured — see [[erp-mongodb]].

## Domain vocabulary observed
`visit` / `visit_tran` (a patient encounter), `vid` (visit id), `pid` (person select),
`consult` (referral between clinics, with `status` send/accept/complete and `priority`
10/20/30), `unit_from` / `unit_to` (referring vs receiving clinic), `allergy_tags`,
`start_at` (exam start), `xtbxlv1_xfx_id` (person id carried on a visit joiner).

## Relationship to the ERP snapshot
The [[erp-mongodb|`erp` MongoDB]] read-only snapshot (2026-07-17) is **older** than this HIS
app: the patient/EMR forms and their processes aren't present. What *is* there are
precursors — a **`Learning SD Form`** and **`Learning Patient Form`**, plus the
`calculcate_bmi` [[api-factory|process]] and `query_bmi_list` [[sql-factory|query]] over
`zdata_learning_sd_form_and_api_factory`. The bulk of the live DB is other modules (VMS
vehicle booking, room reservation, budgeting, master data).

## Why it matters here
These forms are the richest worked example of the [[client-api-this|client API]] we have —
they demonstrate [[vue-ui-pattern|vueState components]], [[openform]], [[crudgetall]], and
[[runprocess]] in combination, at real application scale.

## Related
- Platform: [[initcraft]] · [[sdform]] · data in [[mongodb]] / [[zdata-collections]].
- Sources: [[his-patient-form]] · [[his-emr-form]].
