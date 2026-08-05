---
type: concept
title: xformDatax — process → form write-back
created: 2026-07-16
updated: 2026-07-17
tags: [initcraft, api-factory, form-factory, pattern]
sources: ["[[llm-api-docs]]", "[[erp-mongodb]]"]
---

# xformDatax — process → form write-back

The **only** mechanism for an [[api-factory|API Factory]] process to push computed values
back into the form document that triggered it ([[llm-api-docs]]). The process returns a
special key `xformDatax`; SDForm **merges** its contents into the just-saved document.

```js
// ✅ merges bmi back into the form
return { xformDatax: { bmi: 25.5 } };

// ✅ no write-back wanted
return {};

// ❌ NOT wrapped → nothing merges back
return { bmi: 25.5 };
```

## How it works
After a form save fires a bound process, the system does
`formData = { ...formData, ...apiOutput.data.xformDatax }` — a **shallow merge**, so only
the keys you return are touched; every other field is preserved.

## Rules (all load-bearing)
1. **Key = field name, exactly** — case-sensitive; must match the form field's `name`
   (even if the field name is misspelled, e.g. `detile`, you must return `detile`).
2. **Form-event only** — merges back **only** when the process is called from a
   `form_event` (`on: save/insert/update/delete`). Calling the API directly from a script
   does **not** merge.
3. **Merge, not replace** — unlisted fields are untouched.
4. `return {}` to update nothing.
5. The `params` the process receives = the document that was just saved (including `_id`).
6. Works on every event that has an API bound (save/insert/update/delete).

## Confirmed in the wild
The real `calculcate_bmi` process in `module_api` ([[api-factory]], [[erp-mongodb]]) ends with:
```js
return { success: true, ...payload, xformDatax: payload };
```
It both returns `payload` at top level (so a button reading `res.data` gets the values) **and**
nests it under `xformDatax` (so a `form_event`-bound save merges it) — a belt-and-suspenders
pattern that works whether the process is called via [[runprocess]] or an on-save event.

## Related
- Defined/returned by an [[api-factory|API Factory]] process; field names come from [[field-components]] / [[form-model-json]].
- The client-side counterpart (calling processes) is in [[client-api-this]] / [[runprocess]].
