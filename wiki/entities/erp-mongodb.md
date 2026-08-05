---
type: entity
title: ERP MongoDB (the erp database)
created: 2026-07-17
updated: 2026-07-17
tags: [initcraft, mongodb, database, reference]
aliases: [erp database, softmax ERP db]
sources: ["[[his-patient-form]]", "[[his-emr-form]]"]
---

# ERP MongoDB (the `erp` database)

The live [[mongodb|MongoDB]] instance backing the Softmax/initCraft deployment. Facts here
come from a **read-only** inspection on **2026-07-17** (via the `erp-mongodb-readonly`
skill; connection is a `ro` user, URI kept out of the repo). A cache of the live DB — the
DB itself is source of truth.

## Snapshot (2026-07-17)
- **~70 collections** (was ~46 on 2026-07-02 — the DB is growing).
- **System / core collections** back the [[initcraft]] factories:
  - `sdform_manage` (79) — [[form-factory|form]] definitions
  - `module_sql` (9) — [[sql-factory]] queries
  - `module_api` (41) — [[api-factory]] processes
  - `module_report` — [[form-factory|Report Factory]]
  - `module_packages` — App Factory; `module_notify`; `core_user`, `core_roles`,
    `core_setting`, `core_files_manage`, `core_queue_counter`.
- **Data collections** are [[zdata-collections|`zdata_*`]] — one per form, named either
  readably (`zdata_master_employee`, `zdata_vms_car_bookin`) or by a generated id
  (`zdata_6a4cb3411ff745f6bf8f48d0`).

## `_id` typing (load-bearing — differs by collection!)
- **`sdform_manage._id` = ObjectId** (e.g. `68f5ff7e2bdb232a29533e57`). Look up forms with
  `ObjectId(...)`, not the raw string.
- **`module_api._id` and `module_sql._id` = 24-hex *string*** (e.g. `6a3b49e8…`), and
  **equal to `dataid`**. These strings are the ids passed to [[runprocess|`runProcess`]] and
  named-SQL calls.
- The `6a…`-prefixed 24-hex ids are initCraft's own id scheme; the same value is an
  ObjectId in `sdform_manage`/`zdata_*` but a string in `module_*`.

## Modules present (by form_table / api_category)
VMS vehicle booking (`zdata_vms_car_bookin`, VMS processes), room reservation
(`zdata_reservation_room`, `zdata_manage_room`), budgeting/disbursement, master data
(employee, departments, prefix, org hierarchy), and **learning HIS precursors**:
`Learning SD Form` + `Learning Patient Form` (`zdata_learning_sd_form_and_api_factory`,
`zdata_6a4cb3411ff745f6bf8f48d0`), with `calculcate_bmi` / `query_bmi_list`.

## ⚠ Not in this snapshot
The full [[his|HIS]] patient/EMR forms and their processes/forms (PERSON, Visit, BMI,
Vital Sign, Consult, and the flow/allergy/registry processes) are **newer than this dump** —
see [[his-patient-form]] / [[his-emr-form]]. `form_model` in `sdform_manage` is **encrypted**;
readable layout/scripts come from exports ([[form-model-json]]), not Mongo.

## Related
- Datastore: [[mongodb]] · data layer: [[zdata-collections]] · factories: [[api-factory]], [[sql-factory]].
- Access: read-only via the `erp-mongodb-readonly` skill.
