---
type: concept
title: SdDataProvider — the query object
created: 2026-07-16
updated: 2026-07-16
tags: [initcraft, mongodb, query, interface]
sources: ["[[llm-api-docs]]"]
---

# SdDataProvider — the query object

The shared query shape used by every read in the [[server-api-app|server API]]
(`dbFindAll`, `dbFindOne`, `sdformGetAll`, …), from the Interfaces section of
[[llm-api-docs]].

## Shape
```js
let dp = {
  from: 'zdata_employee',                 // collection
  select: ['name', 'email', 'department'],// projection (optional)
  where: "xrstatx NOT IN(0,3) AND status = :status", // SQL-ish filter w/ :named params
  params: { status: 'active' },           // bound param values
  orderBy: [{ column: 'name', sort: 'ASC' }],
  limit: 20,
  page: 1,
};
```

- **`where`** is a SQL-like string; bind values with `:name` and supply them in `params`
  (prevents injection). Convert ids with `CONVERT(:id, 'objectId')`.
- **Pagination:** pass `limit` + `page`; call `dbFindAll(dp, totalEnable, limitEnable)` with
  `totalEnable=true` to also get `reply.total`.

## Raw NoSQL escape hatch
Bypass the SQL-ish layer with a native Mongo pipeline:
```js
let dp = {
  from: 'zdata_employee',
  nosql: {
    type: 'aggregate',
    collections: ['zdata_employee'],
    pipeline: [
      { $match: { xrstatx: { $nin: [0, 3] } } },
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]
  }
};
```

## Related interfaces
- `SdProvider`, `SdDataProvider`, `UserInfo` are the three documented interfaces in [[llm-api-docs]].
- Runs against [[mongodb]] / [[zdata-collections]]; filters reference `xrstatx`.
