---
type: concept
title: crudGetAll — client-side data query
created: 2026-07-17
updated: 2026-07-17
tags: [initcraft, client-side, query, connector]
sources: ["[[his-emr-form]]", "[[llm-field-docs]]"]
---

# crudGetAll — client-side data query

The [[client-api-this|`userState`]] connector method for **reading data from a form's
collection directly in client code** — no [[api-factory|API Factory]] process needed. The
workhorse for "load the latest / related record" cards in the [[his|HIS]] [[his-emr-form|EMR]].

## Signature (as used)
```js
form.userState.crudGetAll({
  sdProvider: {
    providerId:   '6a470b4939179670f85ba2d8',  // a form _id (the Vital Sign form)
    providerType: 'FORM',                       // resolve the form → its zdata collection
    params:       { vid: String(visitId) },     // bind values
    options: {
      where:   "`vid.value` = CONVERT(:vid, 'objectId')",
      orderBy: [{ column: 'created_at', sort: 'DESC' }],
      limit: 1, page: 1
    }
  },
  totalEnable: false                            // true → also return a total count
}, (res) => {
  const rec = (res.data && res.data[0]) || null;
});
```

## Notes
- **`providerType: 'FORM'` + `providerId: <form _id>`** points the query at that form's
  [[zdata-collections|`zdata_*`]] collection — you reference the *form*, not the raw
  collection name.
- **`options`** is a [[dataprovider|SdDataProvider]]-shaped object: `where`, `orderBy`,
  `limit`, `page`. The `where` uses the **shared query language** — backtick paths,
  `:named` binds from `params`, `CONVERT(:id, 'objectId')` — identical to
  [[sql-factory|SQL Factory]] `sql_where`.
- **Result** arrives in the callback as `res.data` (an array); the HIS pattern is
  `(res.data && res.data[0]) || null` for a single latest row.
- Sibling connector methods (from [[client-api-this]]): `crudGetOne`, `crudCreate`,
  `crudUpdate`, `crudDelete`, `crudCheckUnique`.

## When to use which
- **`crudGetAll`** — simple reads/lists straight from a form's data. Fast to wire, no server
  code. Used for the EMR's BMI, Vital-Sign, Consult-list, and visit re-fetch cards.
- **[[runprocess]]** — when you need server-side computation, joins across collections, or
  aggregation → write an [[api-factory|API Factory]] process instead.

## Related
- Query shape: [[dataprovider]] · shared `where` language: [[sql-factory]].
- The other connector call: [[runprocess]] · full connector list: [[client-api-this]].
