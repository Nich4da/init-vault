---
type: concept
title: Field component catalog
created: 2026-07-16
updated: 2026-08-27
tags: [initcraft, form-factory, components, ui]
sources: ["[[llm-field-docs]]", "[[element-plus-component-overview]]"]
---

# Field component catalog

The ~83 building blocks a [[form-factory|Form Factory]] form is assembled from, grouped by
kind ([[llm-field-docs]]). Each has **Common** + **Advanced** option tables; almost all
input components share `name`, `label`, `defaultValue`, `columnSpan`, `readonly`, `disabled`,
`hidden`, `required`, `validation`.

## Basic Input (20)
`text-input`, `number-input`, `textarea-input`, `otp-input`, `switch-input`, `radio-input`,
`select-input`, `checkbox-input`, `masked-input`, `date-input`, `date-panel-input`,
`date-range-input`, `time-range-input`, `time-input`, `time-select-input`, `multiple-date`,
`rate-input`, `slider-input`, `color-input`, `tags-input`.

## Advanced Input (19)
Data-bound selects — `select-sql-input`, `select-form-input`, `select-path-input`,
`select-data-input`, `cascader-form-input` (hierarchy) — plus `group-list-input`,
`radio-text-input`, `dynamic-input`, editors (`code-input`, `html-input`, `json-input`,
`btn-editor-input`), uploads (`file-upload-input`, `crop-upload-input`, `picture-upload-input`,
`svg-input`), `objectid-input`, `autonumber-input`, `icon-input`.

## Display UI (30)
Text/media — `text-ui`, `html-ui`, `link-ui`, `image-ui`, `avatar-ui`, `svg-ui`, `qrcode-ui`,
`carousel-ui`. Feedback — `alert-ui`, `progress-ui`, `statistic-ui`, `tour-ui`, `step-ui`.
Nav/action — `button-ui`, `dropdown-ui`, `segmented-ui`, `side-menu-ui`, `scan-code-ui`,
`smart-card-ui`, `liff-ui` (LINE). **Data views** — `record-ui`, `tree-ui`, `list-ui`,
`datagrid-sql-ui`, `datagrid-form-ui`. Charts/reports — `chart-ui` (ChartJS), `apexchart-ui`,
`report-ui`. Custom — `vue-ui`, `divider-ui`.

## Container (14)
`grid` / `grid-col`, `card`, `table` / `table-cell`, `tab` / `tab-pane`, `affix`,
`collapse` / `collapse-item`, `scrollbar`, `space`, **`sub-form`**, `object-group`.

## Special / dev-only
**SD Custom Content** and **Vue Flow** (inside `vue-ui`) — carry a ⚠ security note in the source.

## Notes
- Data-bound components (`select-sql`, `datagrid-sql`) depend on [[sql-factory|SQL Factory]]
  queries; `datagrid-form` / `select-form` reference other forms.
- Behavior at runtime is driven by [[client-api-this|`this.*` functions]]; write-back by [[xformdatax]].

## Relationship to Element Plus

The official [[element-plus|Element Plus]] overview captured on 2026-08-27 lists
82 Vue 3 components across seven categories ([[element-plus-component-overview]]).
That catalog and initCraft's ~83 SDForm building blocks are adjacent but not
equivalent: initCraft includes platform-specific data binding, reports, device
integration, and custom Vue widgets that do not map one-to-one to the official
Element Plus list ([[llm-field-docs]]).

Use Element Plus documentation as vocabulary and base-library reference only.
Before relying on a component, prop, event, or layout behavior inside initCraft,
confirm it against a real exported SDForm and the actual Builder/runtime.

## Related
- Runtime engine: [[sdform]] · built in: [[form-factory]] · base UI vocabulary:
  [[element-plus]].
