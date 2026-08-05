---
type: concept
title: vue-ui + vueState (custom components)
created: 2026-07-17
updated: 2026-07-17
tags: [initcraft, client-side, field-components, pattern]
sources: ["[[his-patient-form]]", "[[his-emr-form]]", "[[llm-field-docs]]"]
---

# vue-ui + vueState (custom components)

`vue-ui` is a [[field-components|field component]] that hosts a **custom Vue template with
its own reactive state object, `this.vueState`**. It's how the [[his|HIS]] forms build rich
widgets — the patient card, the visit-flow diagram, the OPD banner, the consult panels — that
plain input components can't express.

## The pattern
In the component's **`onCreated`** event you populate `this.vueState` with data and methods;
the component's template binds to them.
```js
const s = this.vueState;
const field = this;

s.tran = null;                                  // reactive data
s.ptName = () => { const p = s.pt(); return (p.p_fname||'') + ' ' + (p.p_lname||''); };  // method
s.openBmi = (dataId) => {                       // event handler the template calls
  const form = field.getFormRef();
  form.openForm(BMI_FORM, dataId || null, String(visitId), null, {
    afterSaveCallback: () => { form.subFormClose(); s.loadBmi(); }
  });
};
```

## Load-bearing rules (learned from the forms)
1. **`onCreated` defines, `onMounted` triggers.** `onMounted` typically reads
   `form.$examTran` (a cross-tab hand-off) or a field value and calls a `vueState` loader —
   often wrapped in `setTimeout(fn, 0)` to wait for field refs to register.
2. **Don't put non-reactive instances in `vueState`.** A vue-flow instance is kept in a
   closure `let flowInst = null` because reactive-wrapping it "โดน reactive wrap แล้วเพี้ยน"
   (breaks it). Store live third-party objects outside `vueState`.
3. **Sandbox restrictions.** Inside `vue-ui` code some globals are shadowed — notably
   **`localStorage` is `undefined`** (restricted compile context), so per-device state isn't
   possible here.
4. **Cross-widget orchestration.** One `vue-ui` reaches siblings via
   `field.getFieldRef(name).vueState.someLoader(...)` — the EMR's `opd_card.setTran()` fans a
   selected visit out to `consult_box`, `consult_banner`, and `registry_card` this way.
5. **Guard timers/intervals** against re-mount (`if (s.examTimerId) clearInterval(...)`).

## Context available (`this` / `field`)
`getFormRef()`, `getFieldRef(name)`, `refField(name)`, `formModel`, `alert(msg, type)`,
`dayjs(...)`, and the connector via `getFormRef().userState` ([[crudgetall]] / [[runprocess]]).

## Related components in the HIS forms
`smart-card-ui` (Thai ID reader), `record-ui` (SOAP note card), `list-ui` (list view),
`datagrid-form-ui` (grid), `button-ui` — all [[field-components|display/advanced components]].

## Related
- API surface: [[client-api-this]] · data: [[crudgetall]] · server: [[runprocess]] · popups: [[openform]].
- Catalog: [[field-components]] · exemplars: [[his-patient-form]], [[his-emr-form]].
