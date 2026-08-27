---
name: feilds-init
description: initCraft / softmax-one SDForm form builder field guide. Use when Codex needs to configure, explain, audit, or generate settings for initCraft form builder sidebar tools, dropped form fields, right-sidebar Common Setting, Advanced Setting, Event Setting, Form Setting, field option names, validation, JavaScript event handlers, report/data-grid/list/sub-form tools, or SDForm field JSON.
---

# Feilds Init

Use this skill for initCraft SDForm form builder work, especially the builder at `/sdform/form-builder`.

## Core Workflow

1. Treat the left sidebar as the source of field/tool types. Fields are grouped as Basic Input, Advanced Input, Display UI, and Container.
2. After a field is dropped on the canvas and selected, inspect the right sidebar:
   - `Property > Common Setting`: identity, label, layout, value, display, validation, and component-specific options.
   - `Property > Advanced Setting`: specialized behavior such as data sources, templates, upload rules, chart/report/grid settings, container layout, or display customization.
   - `Property > Event Setting`: JavaScript handlers stored on `field.options`.
   - `Form Setting`: global form size, label layout, CSS, global functions, and form-level events.
3. Prefer the exact option key names from the reference when discussing or editing JSON. Do not translate option keys.
4. For field events, write JavaScript as the body of the handler only. The builder wraps it in a function header.
5. Read [references/fields-reference.md](references/fields-reference.md) for the field catalog, option keys, event signatures, and usage notes.
6. For runtime scripting questions, use the API reference notes in `fields-reference.md` before guessing method names. The user supplied a Drive-hosted `SDForm API Reference` on 2026-07-06; distilled non-secret notes from it are maintained in the reference file.
7. For Trade Drug/PIS label previews or Components that combine current-form fields with an embedded Select By Form snapshot, read [references/drug-label-preview.md](references/drug-label-preview.md). It records the verified field mapping, physical dimensions, modal pattern, and failed data-source assumptions.
8. When the user sends only **"ฉลากยา"** or asks to resume the drug-label work, read `references/drug-label-preview.md` and begin by returning its current resume checkpoint—status, verified IDs/configuration, latest blocker, and pending decision—before proposing or making further changes.

## Event Handler Context

Field event editor title: `Field Event Handler [ SD => ( FD, FM, API ), FN, EL ]`.

Use these practical references in handler code:

- `this`: the selected field component instance.
- `this.refField("field_name")`: get another field instance by option `name`.
- `this.getFormRef()`: get the form instance.
- `this.getValue()` / `this.setValue(value)`: read/write current field where supported.
- `this.notify(message, type, duration)`: toast notification; types include `success`, `warning`, `info`, and `error`.
- `this.alert(message, type)`: show feedback.
- `this.confirm(message, title, options)`: confirm dialog that resolves true/false.
- `this.prompt(message, options)`: prompt dialog that resolves a string or null.
- `FD`: field/data helpers exposed by the editor autocomplete.
- `FM`: form/model helpers exposed by the editor autocomplete.
- `API`: platform API helpers exposed by the editor autocomplete.
- `FN`: global functions from Form Setting.
- `EL`: element/component context.

Field validation event `onValidate` receives `(rule, value, callback)`. Call `callback()` to pass, or `callback(new Error("message"))` to fail.

## Form Setting

Global form settings include:

- Basic: `size`, `labelPosition`, `labelAlign`, `labelWidth`, `cssCode`, `customClass`, `functions`.
- Events: `onFormCreated()`, `onFormMounted()`, `onParentChange(fieldName, newValue, oldValue, formModel, showInput)`, `onFormDataChange(fieldName, newValue, oldValue, formModel, subFormName, subFormRowIndex)`, `onFormUnmounted()`.

Common form runtime helpers from `this.getFormRef()`:

- Data: `getFormData(needValidation)`, `setFormData(formData)`, `getFieldValue(fieldName)`, `setFieldValue(fieldName, value)`, `clearFormDataModel()`.
- Validation/submission: `submitForm(rstat)`, `validateForm(callback)`, `resetForm()`.
- Field state: `hideField(fieldName)`, `showField(fieldName)`, `disableField(fieldName)`, `enableField(fieldName)`, `disableForm()`, `enableForm()`.
- Sub forms/popups: `getSubFormValues(subFormName)`, `subFormOpen(subFormName, rowIndex)`, `openForm(formId, dataId, parentId, initData, options)`.
- Dynamic model/options: `setFormModel(newFormJson)`, `reloadOptionData(fieldName)`.

## Notes

- The source inspection was from `https://softmax-one.com/sdform/form-builder?form_id=6a44774268ca67d64ac42595` on 2026-07-01.
- The requested skill name is intentionally spelled `feilds-init` to match the user's wording.
