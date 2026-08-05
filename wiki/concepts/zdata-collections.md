---
type: concept
title: zdata_ collections, xrstatx & audit fields
created: 2026-07-16
updated: 2026-07-17
tags: [initcraft, mongodb, data-model, convention]
sources: ["[[llm-api-docs]]", "[[erp-mongodb]]"]
---

# `zdata_` collections, `xrstatx` & audit fields

The data-model conventions of [[initcraft|initCraft]] on [[mongodb|MongoDB]], from
[[llm-api-docs]].

## Collections
- Application data lives in collections prefixed **`zdata_`** (e.g. `zdata_employee`,
  `zdata_counter`, `zdata_items`).
- Every `app.db*` write auto-adds **audit fields**: `created_by`, `created_at`,
  `updated_by`, `updated_at`.

## `xrstatx` — record status
A status field on every record, used to filter out drafts/deleted rows (e.g.
`where: "xrstatx NOT IN(0,3)"` keeps only active/submitted).

Documented codes (from `sdformSetOne` / soft-delete / `initSaveForm`):

| Code | Meaning |
|---|---|
| 0 | draft (also the state `initSaveForm` creates) |
| 1 | active |
| 2 | submitted |
| 3 | deleted (soft delete — `sdformDelOne` sets this) |

## ⚠ Open questions / contradictions
- **Two different `rstat` numberings exist.** Server `sdformSetOne` uses the table above
  (`0=draft…3=deleted`), but the client `submitForm` in [[client-api-this]] / [[llm-field-docs]]
  documents `rstat` as **`1=draft, 2=submit`**. These are inconsistent — likely two different
  "rstat" concepts (a save-mode flag vs the stored status), but **unconfirmed**. Resolve with
  a source that defines both.
- ~~**`xrstatx` type is inconsistent**~~ — **RESOLVED 2026-07-17.** A read-only check
  ([[erp-mongodb]]) shows `xrstatx` is stored as an **`int`** in every collection sampled
  (`zdata_vms_car_bookin`, `zdata_reservation_room`, `zdata_learning_sd_form_and_api_factory`,
  `module_api`); observed values `1` (active) and `3` (deleted). The string form `'1'` seen in
  a doc example is a loosely-written filter, not the stored type — **prefer numeric filters**
  (`{ $nin: [0,3] }`).

## Live snapshot
The actual `erp` database (system collections, id typing, module inventory) is catalogued in
[[erp-mongodb]] — note `_id` is an **ObjectId** in `zdata_*`/`sdform_manage` but a **string**
in `module_api`/`module_sql`.

## Related
- Queried via [[dataprovider]] · accessed via [[server-api-app]] · live DB: [[erp-mongodb]].
- Inspected read-only via the `erp-mongodb-readonly` skill.
