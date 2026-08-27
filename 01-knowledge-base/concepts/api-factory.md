---
type: concept
title: API Factory (module_api / api_process)
created: 2026-07-17
updated: 2026-08-27
tags: [initcraft, api-factory, server-side, module-api]
sources: ["[[llm-api-docs]]", "[[his-emr-form]]", "[[erp-mongodb]]"]
---

# API Factory (`module_api` / `api_process`)

One of initCraft's four [[form-factory|factories]]. An **API Factory process** is a
server-side JavaScript function that runs against the [[server-api-app|`app.*` API]]. Forms
call processes through the client bridge [[runprocess]]; a process bound to a `form_event`
can write results back via [[xformdatax]].

## Where it lives
Processes are documents in the **`module_api`** collection ([[erp-mongodb]] — 41 in the
2026-07-17 snapshot). Key fields:

| Field | Meaning |
|-------|---------|
| `_id` / `dataid` | 24-hex **string** id (identical); the id passed to [[runprocess|`runProcess`]] |
| `api_name` | function name, e.g. `calculcate_bmi` |
| `api_desc`, `api_category`, `api_tags` | catalog metadata |
| `api_input` | array of expected param names, e.g. `["weight","height"]` |
| `api_output` | declared output (often `null`) |
| `api_process` | **the JS body** |
| `api_assign_roles`, `api_share` | access control |

## The `Process()` shape (ambient context)
Inside `api_process` you get, without importing:
- **`params`** — the input object. For a `form_event` process, this *is the just-saved
  document* (including `_id`); for a `runProcess` call, it's the args you passed.
- **`userInfo`** — the acting user / site / unit context ([[server-api-app|`UserInfo`]]).
- **`app`** — the whole [[server-api-app|server API]] (`app.db*`, `app.sdform*`,
  `app.runSql`, `app.curDate`, `app.dbObjectId`, `app.db.collection(...)` raw driver, …).

## Real example — `calculcate_bmi` (category: Learning)
```js
const weight = Number(params.weight), height = Number(params.height);
if (!weight || !height) return {};
const heightM = height / 100;
const bmi = weight / (heightM * heightM);
const bsa = Math.sqrt((height * weight) / 3600);        // Mosteller
const result_bmi = bmi < 18.5 ? 'ต่ำกว่ามาตรฐาน' : bmi <= 24.9 ? 'ปกติ' : 'เกินมาตรฐาน';

await app.dbUpdate(
  { status_bmi: result_bmi, status_bsa: result_bsa },
  'zdata_learning_sd_form_and_api_factory',
  userInfo,
  { _id: app.dbObjectId(params._id) }
);

const payload = { ...params, bmi: bmi.toFixed(2), bsa: bsa.toFixed(2), status_bmi: result_bmi };
return { success: true, ...payload, xformDatax: payload };   // merge back into the form
```

## Return conventions (observed)
- `return { success: true, data: {...} }` — `runProcess`'s callback reads `res.data`.
- `return { ..., xformDatax: {...} }` — merges those keys back into the saving form
  (form-event only). See [[xformdatax]].
- `return {}` — do nothing / no write-back.
- Errors surface to `runProcess`'s error callback as `{ message }`.

## Related
- Client caller: [[runprocess]] · write-back: [[xformdatax]] · server surface: [[server-api-app]].
- SQL sibling: [[sql-factory]] · storage & id typing: [[erp-mongodb]] / [[zdata-collections]].
- Artifact library: process JavaScript in `Form-Builder/API/api-factory/processes/`, schemas/examples in
  `Form-Builder/SDForm/api-factory/`, and interface notes in `02-his/api-factory/docs/`
  ([[initcraft-library-migration]]).
