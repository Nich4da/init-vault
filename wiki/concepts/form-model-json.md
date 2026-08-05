---
type: concept
title: Form model JSON (VForm export)
created: 2026-07-17
updated: 2026-07-17
tags: [initcraft, form-factory, sdform, schema]
sources: ["[[his-patient-form]]", "[[his-emr-form]]"]
---

# Form model JSON (VForm export)

The exported design of a [[sdform|form]] — the structure you get from Form Factory as a
`.json` file (e.g. `HIS/sdform_module/patient.json`). In MongoDB the live equivalent
(`sdform_manage.form_model`) is **encrypted** and not readable from the DB alone
([[erp-mongodb]]), so these exports are the only way to see canvas layout + event scripts.

## Top-level shape
```jsonc
{
  "fields":    [ <root widget> ],   // the widget tree
  "formConfig": {                   // form-wide settings + lifecycle hooks
    "modelName": "formData", "refName": "sdForm", "rulesName": "rules",
    "functions": "", "cssCode": "", "customClass": "",
    "onFormCreated": "", "onFormMounted": "", "onFormDataChange": "",
    "onParentChange": "", "onFormUnmounted": ""
  }
}
```

## Widget node
Every widget (container or field) looks like:
```jsonc
{
  "key": "...", "id": "...", "name": "grid52536",
  "component": "text-input",         // widget type
  "category": "basic_input",         // container | basic_input | advanced_input | display_ui
  "fieldType": "...", "fieldLength": ...,
  "options": { "name": "phone", "label": "เบอร์โทร", "hidden": false, /* + events */ },
  "fields": [ ... ]                  // ← children live here (also `cols` for grids)
}
```
- **`options.name`** = the field key (what you reference in `where`, `formModel.x`,
  [[xformdatax]]). **`options.label`** = display label.
- **Container children** are under **`fields`** (and `cols` for `grid`/`grid-col`) — *not*
  a single `widgetList`. Walk both when parsing.
- **Event scripts** are string values on `options` keyed by event name
  (`onCreated`, `onMounted`, `onChange`, `onClick`, …) — this is where the
  [[client-api-this|client API]] code lives.

## Component families seen ([[field-components]])
- **Containers:** `grid`, `grid-col`, `card`, `tab`, `tab-pane`, `affix`.
- **Inputs:** `text-input`, `date-input`, `radio-input`, `select-form-input`.
- **Display / advanced UI:** `vue-ui` ([[vue-ui-pattern]]), `record-ui`, `list-ui`,
  `datagrid-form-ui`, `smart-card-ui`, `button-ui`.

## Related
- The engine: [[sdform]] · builder: [[form-factory]] · component catalog: [[field-components]].
- Worked examples: [[his-patient-form]], [[his-emr-form]] · encrypted live copy: [[erp-mongodb]].
