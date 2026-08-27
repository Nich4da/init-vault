---
type: entity
title: initCraft
created: 2026-07-16
updated: 2026-07-17
tags: [initcraft, sdform, low-code, platform]
aliases: [initCraft, SDForm platform, softmax-one]
sources: ["[[llm-api-docs]]", "[[llm-field-docs]]", "[[his-patient-form]]", "[[his-emr-form]]"]
---

# initCraft

A low-code application platform (hosted at softmax-one.com) built around **[[sdform|SDForm]]**.
Applications are assembled from forms, queries, processes, and reports rather than
hand-written app code. This is the **domain anchor** of this wiki — most pages descend
from here.

## The four "factories"
initCraft is organized into builder modules:

- **[[form-factory|Form Factory]]** — design forms from the [[field-components|component catalog]]; wire client-side logic with [[client-api-this|`this.*` functions]]. Documented in [[llm-field-docs]].
- **[[sql-factory|SQL Factory]]** — named SQL/`module_sql` queries, called via `runSql` or bound to Data Grids / select-by-sql fields.
- **[[api-factory|API Factory]]** — server-side `api_process` functions using the [[server-api-app|`app.*` API]]. Documented in [[llm-api-docs]].
- **Report Factory** — PDF/Excel/Word reports; surfaced client-side via the `report-ui` component and server-side `app.wordReport`.

## Applications built on it
- **[[his|HIS]]** (Hospital Information System) — the first real application example in this
  wiki: patient registration/lookup ([[his-patient-form]]) and an OPD EMR ([[his-emr-form]]).
  Shows the factories combined at scale.

## Data & runtime
- Data lives in [[mongodb|MongoDB]] as [[zdata-collections|`zdata_*` collections]] with status field `xrstatx` and audit fields.
- Client ↔ server bridge: the form's `userState` connector (`runProcess` / `crud*` / `api*`) → an [[api-factory|API Factory]] process. See [[client-api-this]].
- Process → form write-back happens via [[xformdatax]].

## Related resources
- Companion Claude Code skills exist for this platform: `initcraft`, `initcraft-build-form`, `initcraft-build-query`, `initcraft-build-process`, `initcraft-report-factory`, and the read-only `erp-mongodb-readonly` MongoDB workflow.
