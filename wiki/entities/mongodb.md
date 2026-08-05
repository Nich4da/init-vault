---
type: entity
title: MongoDB
created: 2026-07-16
updated: 2026-07-17
tags: [initcraft, mongodb, database, datastore]
aliases: [MongoDB, mongo, mongoClient]
sources: ["[[llm-api-docs]]"]
---

# MongoDB

The datastore behind [[initcraft|initCraft]] / [[sdform|SDForm]]. Application data lives in
[[zdata-collections|`zdata_*` collections]]; the [[server-api-app|`app.*` server API]]
provides both a convenience layer and raw access.

## Access from a process
- **Convenience CRUD** — `app.dbInsert(Many)`, `app.dbFindAll/One/ById`, `app.dbUpdate(Many)`,
  `app.dbDelete(Many)`. Adds audit fields automatically; **bypasses sdform permissions**.
- **Raw** — `app.db` / `app.mongoClient` for driver-level operations, plus `nosql.aggregate`
  pipelines inside a [[dataprovider|SdDataProvider]].
- **Helpers** — `app.dbObjectId(id)` to build an `ObjectId`, `app.curDate()` for timestamps.
- **Transactions** — `this.mongoTxn()` / `this.withVersion()` for atomicity + optimistic
  locking. See [[mongo-transactions]].

## Conventions
- Query filters can use SQL-ish `where` strings with `:named` params (translated by SDForm)
  **or** native Mongo operators (`$match`, `$nin`, …) — see [[dataprovider]].
- `_id` is an `ObjectId`; convert incoming ids with `CONVERT(:id, 'objectId')` or `app.dbObjectId`.

## Related
- The live database (collections, id typing, modules): [[erp-mongodb]]
- Collection & status conventions: [[zdata-collections]]
- Query shape: [[dataprovider]]
- Read-only inspection workflow: the `erp-mongodb-readonly` skill.
