---
type: concept
title: openForm — sub-form popups
created: 2026-07-17
updated: 2026-07-17
tags: [initcraft, client-side, form-factory, navigation]
sources: ["[[his-patient-form]]", "[[his-emr-form]]", "[[llm-field-docs]]"]
---

# openForm — sub-form popups

`form.openForm(...)` opens **another [[sdform|form]] as a popup / sub-form** over the current
one — the primary way HIS screens compose (open a patient, add a vital sign, answer a
consult). A [[client-api-this|form-ref]] method; get the ref with `this.getFormRef()`.

## Signature (as used across the HIS forms)
```js
form.openForm(formId, dataId, parentId, extra, options)
```
| Arg | Meaning |
|-----|---------|
| `formId` | target form's `_id` (24-hex string), e.g. `'6a4689ef39179670f85ba2a2'` (BMI) |
| `dataId` | record to edit; **`null` = create new** |
| `parentId` | the **joiner parent** id (e.g. the visit) a new child hangs off |
| `extra` | 4th positional arg, usually `null`/`undefined` in these examples |
| `options` | `{ afterSaveCallback, readonly, … }` |

## `options.afterSaveCallback(saved)`
Fires after the sub-form saves. The consistent HIS idiom:
```js
form.openForm(BMI_FORM, dataId ? String(dataId) : null, String(visitId), null, {
  afterSaveCallback: () => { form.subFormClose(); s.loadBmi(); }   // close, then refresh
});
```
- `saved` is the saved document — used to **merge selected keys** back into a live model
  object (avoids a full reload); see [[his-patient-form]].
- **`form.subFormClose()`** closes the popup (call it in the callback).
- **`readonly: true`** opens the sub-form view-only (EMR opens answered consults readonly).

## Refresh patterns after close
- `s.loadBmi()` / `vueState.load(...)` — re-run a [[crudgetall]] query.
- `form.getFieldRef('visit_list').getFieldEditor().refreshData()` — refresh a list/grid field.

## Related
- Opens a [[sdform]] · child hangs off a joiner parent (`parentId`).
- Data refresh via [[crudgetall]] · server calls via [[runprocess]] · connector: [[client-api-this]].
