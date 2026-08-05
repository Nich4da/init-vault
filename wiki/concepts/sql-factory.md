---
type: concept
title: SQL Factory (module_sql queries)
created: 2026-07-17
updated: 2026-07-17
tags: [initcraft, sql-factory, query, module-sql]
sources: ["[[llm-api-docs]]", "[[erp-mongodb]]"]
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
