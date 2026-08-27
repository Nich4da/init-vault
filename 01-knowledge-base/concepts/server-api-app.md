---
type: concept
title: Server API (app.* in API Factory)
created: 2026-07-16
updated: 2026-07-16
tags: [initcraft, api-factory, server-side, api-reference]
sources: ["[[llm-api-docs]]"]
---

# Server API (`app.*` in API Factory)

The server-side surface available inside an [[api-factory|API Factory]] `api_process`,
distilled from [[llm-api-docs]]. Two objects are in scope: **`app.*`** (the API) and
**`this.*`** (utility + transaction helpers).

## Data access — two tiers
| Tier | Functions | Permissions/Events | Use when |
|---|---|---|---|
| Direct Mongo | `app.dbInsert(Many)`, `dbFindAll/One/ById`, `dbUpdate(Many)`, `dbDelete(Many)`, raw `app.db`/`mongoClient` | **Bypassed** (fast) | Internal logic, batch jobs, trusted writes |
| Through SDForm | `app.sdformGetOne/GetAll/SetOne/DelOne` | **Enforced** (+ `afterSaveForm`/`afterDeleteForm`) | User-facing operations that must respect access rules |

Both read via the [[dataprovider|SdDataProvider]] shape. `dbFindAll` supports pagination
(`limit`, `page`, `totalEnable`) and raw `nosql.aggregate` pipelines. Audit fields
(`created_by/at`, `updated_by/at`) are added automatically on `db*` writes.

## Other categories
- **Form management** — `initSaveForm` (empty record, `xrstatx=0`), `insertData(Form)`, `createJoinerValue`, `updateFileStatus`, `deleteFileSystem`, `dataPolicyAudit`.
- **Process/event** — `runProcess`, `subProcess` (compose processes).
- **Transactions** — `this.mongoTxn()`, `this.withVersion()`. See [[mongo-transactions]].
- **[[xformdatax]]** — return-value channel to write back into the saved form.
- **SQL** — `runSql` (invoke a [[sql-factory|SQL Factory]] query), `parsedSQL`, `parsedProvider`, `pgQuery` (Postgres).
- **Realtime** — `wsSend`, `notifySend`.
- **[[line-integration|LINE]]** — `lineVerifyIdToken`, `linePush`.
- **HTTP** — `app.axios`.
- **Users/roles** — `getUserInfo`, `isRole`, `isAdmin/isManager/isSuper/isAuth`, `assignRole/revokeRole`.
- **Crypto** — `encode/decode`, `encodeObj/decodeObj`, `generateKeyPair`, `getDynamicPublicKey`.
- **Report** — `wordReport`.
- **Utilities `this.*`** — `isNull/isNotNull`, `isEmptyStr/Obj`, `generateId/genUidTime/genUUID`, `deepClone`, `compareHash`, `get/setObjectByPath`, `string2Json/boolean`, `object2Path`.

## Return conventions
- Most `app.*` calls return `{ success, reply: { message, data, id/ids } }` — check `success`.
- A process returns a plain object to its caller; wrap fields in [[xformdatax]] to merge them back into the form.

## Related
- Called from the client via the connector in [[client-api-this]].
- Query shape: [[dataprovider]] · Data store: [[mongodb]] / [[zdata-collections]].
