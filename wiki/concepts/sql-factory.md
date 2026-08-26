---
type: concept
title: SQL Factory (module_sql queries)
created: 2026-07-17
updated: 2026-08-18
tags: [initcraft, sql-factory, query, module-sql]
sources: ["[[llm-api-docs]]", "[[erp-mongodb]]", "[[his-medical-record-report]]"]
---

# SQL Factory (`module_sql` queries)

One of initCraft's four [[form-factory|factories]]. A **SQL Factory query** is a named,
reusable read defined in the builder and stored in the **`module_sql`** collection
([[erp-mongodb]] — only 9 in the 2026-07-17 snapshot). Despite the name, `nosql_type: find`
shows these **compile down to MongoDB** queries over [[zdata-collections|`zdata_*`]].

## Document fields
| Field | Meaning |
|-------|---------|
| `_id` / `dataid` | 24-hex **string** id (identical) |
| `sql_name`, `sql_desc`, `sql_category` | catalog metadata |
| `sql_type` | `sql` (builder query) |
| `sql_select` | array of `{ field, custom, as_name }`; `field` = `` `coll`.`col` `` (backtick-quoted) |
| `sql_from` | source collection, e.g. `zdata_vms_car_bookin` |
| `sql_join`, `sql_group_by`, `sql_order_by`, `sql_limit` | standard clauses |
| `sql_where` | filter string using the shared query language (below) |
| `sql_options` | normalized `{ variable, select, join, orderBy, groupBy, params, from, where }` |
| `sql_form_id` | `{ value, label }` link back to the source [[sdform\|form]] |
| `nosql_type` | how it executes — `find` / `aggregate` |

## The shared query language
`sql_where` uses the **same syntax** as the server [[dataprovider|SdDataProvider]] `where`
and the client [[crudgetall|`crudGetAll`]] `where` — one language across all three layers:
- backtick-quoted field paths: `` `_id` ``, `` `vid.value` ``
- named binds resolved from `params`: `:_id`, `:vid`
- id conversion: `CONVERT(:_id, 'objectId')`

```text
sql_where:  `_id` = CONVERT(:_id, 'objectId')
```

## ⚠️ Two representations of JOIN — editing only one is a silent no-op
Confirmed 2026-08-18 while hand-editing an exported `module_sql` JSON file to fix a query's
join direction. A document stores the JOIN graph in **two places that don't stay in sync**:
- `sql_join` — array of `{type, hint, form, table, on}`. Looks like the authoritative field (it's
  what the builder UI's Join grid renders from) — **but is NOT what actually executes.**
- `sql_options.join` — array of `{type, hint, table, on}` (no `form`). **This is the one the
  backend actually reads to generate the runtime SQL.**

Editing `sql_join` alone and re-importing produced a query whose `FROM` clause changed correctly
but whose `JOIN` clause silently kept the *old* table/condition — confirmed by inspecting the
`sql` string returned in the SQL Test response, which still showed the pre-edit join verbatim.
Fixed by editing `sql_options.join` too. **Any future file-based edit to a query's JOINs must
update both arrays**, or the change does nothing and fails silently (still returns
`"message": "Get data success."` with 0 rows — no error to signal the mismatch).

Not yet checked whether `sql_options.from` / `sql_options.where` have the same split-brain
problem — `sql_options.from` and `sql_options.where` were both empty strings `''` on the export
inspected (while the *authoritative* `sql_from` and `sql_where` top-level fields were populated
and DID take effect correctly) — so for those two, the top-level field alone was sufficient. Only
`join` was proven to need the `sql_options` copy edited.

## Confirmed function vocabulary (via live SQL Test, 2026-08-18)
Confirmed working, including nested: `CASE WHEN...END`, `IFNULL(a,b)`, `CONVERT(x,'objectId')`,
`SIZE_OF_ARRAY(x)`, `CONCAT(...)` (arbitrarily nested with the above), `ARRAY_ELEM_AT(arr,i)`,
`PARSE_JSON(str)`. **Confirmed broken: `RIGHT(...)`** — `CONCAT(IFNULL(...), RIGHT(CONCAT('00',
...), 3))` produced a silent `{"message":"Query Error.","sql":""}` (the backend failed to
generate any SQL text at all — no line/column diagnostic). Removing just the `RIGHT` call fixed
it; plain `CONCAT` nested with `CASE`/`IFNULL`/`ARRAY_ELEM_AT` in the same query was already
working before and after. Not yet tested: any other string/date function beyond this list — treat
anything not on the "confirmed working" list as a coin flip until SQL-Tested live.

## Custom expressions can reference undeclared fields
A joined table's fields only show up in the Field dropdown / autocomplete if they're declared in
that table's SdForm schema. A field that exists in the raw MongoDB collection but isn't declared
(e.g. `zdata_visit_tran.queue_label` — see [[his-medical-record-report]]) is still reachable by
**typing the raw backtick path directly into the Custom box** — confirmed working, no function
wrapper needed, same mechanism as any other Custom expression.

## Real example — `vms_car`
- `sql_from`: `zdata_vms_car_bookin`
- `sql_select`: 26 backtick-quoted columns (`req_type`, `doc_no`, `depart_date`,
  `booking_status`, `_id`, …)
- `sql_where`: `` `_id` = CONVERT(:_id, 'objectId') ``, `sql_limit`: 30
- `sql_options.params`: `["_id"]` — the one bind it expects.
- `sql_form_id`: *แบบฟอร์มการขอใช้รถยนต์ v1* (the car-booking form).

`query_bmi_list` is the HIS-adjacent one: `from zdata_learning_sd_form_and_api_factory`,
linked to the *Learning SD Form* (see [[his]]).

## How queries are called
- Server: `app.runSql(name, params)` from an [[api-factory|API Factory]] process.
- Client: bound to a **Data Grid** or a **select-by-SQL** [[field-components|field]], or via
  the `userState` connector. (The HIS forms mostly query with `providerType: 'FORM'` through
  [[crudgetall]] instead of named SQL.)

## Related
- Query object shape: [[dataprovider]] · client reads: [[crudgetall]] · API sibling: [[api-factory]].
- Runs against [[mongodb]] / [[zdata-collections]]; storage facts in [[erp-mongodb]].
- Worked example with the JOIN split-brain gotcha + confirmed function list in practice:
  [[his-medical-record-report]].
