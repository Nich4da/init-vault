---
type: concept
title: runProcess — client → API Factory bridge
created: 2026-07-17
updated: 2026-07-17
tags: [initcraft, client-side, api-factory, connector]
sources: ["[[his-patient-form]]", "[[his-emr-form]]", "[[llm-field-docs]]"]
---

# runProcess — client → API Factory bridge

The [[client-api-this|`userState`]] connector method that **calls an
[[api-factory|API Factory]] process** from client code and hands back its result. The main
way form logic reaches server-side computation.

## Signature (as used)
```js
form.userState.runProcess(
  '6a5080bb6e185ae01ab5bb1b',        // process _id (module_api id / dataid)
  { pid: pid, vid: vid || '' },      // params → the process's `params`
  (res) => {                         // success: read res.data (the process's return .data)
    const out = (res && res.data) || {};
    s.flowVisits = out.visits || [];
    s.flowSteps  = out.steps  || [];
  },
  () => { /* error callback */ }
);
```

## Notes
- **First arg = process id** — the 24-hex **string** `_id`/`dataid` from
  [[api-factory|`module_api`]] ([[erp-mongodb]]).
- **`params`** becomes the process's ambient `params` object.
- **`res.data`** is whatever the process put under `data` in its return (e.g.
  `return { success: true, data: {...} }`). The [[his|HIS]] forms defensively read
  `(res && res.data) || {}`.
- **Error callback** receives `{ message }`; HIS code shows
  `err => field.alert('...: ' + ((err && err.message) || err), 'error')`.
- **Not a write-back path.** `runProcess` returns data to the caller; it does **not**
  [[xformdatax|merge into the form]] — that only happens for processes bound to a
  `form_event`. To update the UI, set the result into `vueState`/fields yourself.

## Seen in the HIS forms
- Patient: check-insurance-right, then load a **visit-flow** diagram
  (`{ visits, vid, steps }`). ([[his-patient-form]])
- EMR: **allergy sync** (returns `allergy_tags`) and **disease-registry list**
  (`{ items }`). ([[his-emr-form]])

## Related
- Callee: [[api-factory]] · direct data reads instead: [[crudgetall]].
- Full connector surface: [[client-api-this]] · write-back contrast: [[xformdatax]].
