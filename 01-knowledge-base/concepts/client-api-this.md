---
type: concept
title: Client API (this.* in form events)
created: 2026-07-16
updated: 2026-07-17
tags: [initcraft, form-factory, client-side, api-reference]
sources: ["[[llm-field-docs]]", "[[his-patient-form]]", "[[his-emr-form]]"]
---

# Client API (`this.*` in form events)

The client-side functions callable from a [[field-components|field]] or form event,
distilled from [[llm-field-docs]]. Three scopes: the **field** (`this.*`), the **form**
(`this.getFormRef().*`), and the **server connector** (`this.getFormRef().userState.*`).

## Field functions — `this.*`
- **Value:** `setValue`, `getValue`, `getText` (display label of a select/radio value).
- **State:** `hide`/`show`, `disabled`/`enable`, `focus`, `trigger`, `setRequired`, `setLabel`, `addCssClass`/`removeCssClass`.
- **Refs:** `refField`, `refSubField`, `isSubFormItem`.
- **Dialogs:** `notify`, `alert`, `confirm`, `prompt`.
- **Options** (for select/radio/etc.): `loadOptions`, `addOption`, `removeOption`, `clearOptions`, `getOptions`, `getOptionsModel`, `getSelectedLabel`, `disableOption`/`enableOption`.
- **Misc:** `showFields`/`hideFields`, `copyClipboard`, `numberFormat`, `string2Json`/`json2String`, `dayjs`.

## Form functions — `this.getFormRef().*`
- **Lifecycle:** `submitForm(rstat)`, `resetForm`, `validateForm`, `disableForm`/`enableForm`.
- **Data:** `getFormData(needValidation?)`, `setFormData`, `getFieldValue`, `setFieldValue`, `getSubFormValues`, `clearFormDataModel`, `setFormModel`.
- **Fields:** `hideField`/`showField`, `disableField`/`enableField`, `reloadOptionData`.
- **Popups:** `openForm` (see [[openform]]), `subFormOpen`.

## Server connector — `this.getFormRef().userState.*`
A `ConnectState`; conventionally `const api = this.getFormRef().userState`. The **only**
bridge to the [[server-api-app|server]]:
- **[[runprocess|`runProcess`]]** — call an [[api-factory|API Factory]] process.
- **[[crudgetall|`crudGetAll`]]** / `crudGetOne` / `crudCreate` / `crudUpdate` / `crudDelete` / `crudCheckUnique`.
- `apiPost/apiGet/apiPut/apiDelete` — raw HTTP.

## Reaching other fields & custom components
- **`this.getFormRef().getFieldRef(name)`** → a field ref with `.show()`/`.hide()`,
  `.setValue()`, `.getFieldEditor().refreshData()` (lists/grids), and **`.vueState`**.
  This is how one widget drives its siblings ([[his-emr-form|HIS EMR]] `opd_card.setTran`).
- **`this.vueState`** — reactive state for a `vue-ui` custom component; see [[vue-ui-pattern]].
- Cross-tab/global hand-off is done with an ad-hoc form property (e.g. `form.$examTran`).

## Event context variables
`this`, `this.getFormRef()`, `userState`, `value`, **`data`** (reactive model — `data.fieldName`
reads/writes live), `parentData`, `formParams`, `customParams`, `userInfo`, `useUserState`,
`formId`, `dataId`, `parentId`.

## Related
- Components these run on: [[field-components]] · Server side: [[server-api-app]].
- ⚠ `submitForm` rstat (`1=draft, 2=submit`) ≠ server `sdformSetOne` rstat — see [[zdata-collections]].
