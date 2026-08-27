---
name: element-plus-initcraft
description: Element Plus patterns for initCraft and softmax-one SDForm work. Use when Codex needs to create, explain, audit, or debug Vue/Element Plus `el-*` templates inside initCraft `vue-ui`, custom form UI, builder components, list/table controls, pagination, dialogs, forms, buttons, selects, or other Element Plus-based UI behavior.
---

# Element Plus initCraft

## Purpose

Use Element Plus as the default UI vocabulary when building custom initCraft screens, especially inside `vue-ui` templates and builder-generated Vue views. initCraft already uses Element Plus heavily, so prefer native `el-*` components over hand-rolled controls when the component exists.

## Workflow

1. Identify whether the work is plain Report Factory PDF/HTML, SDForm builder settings, or runtime `vue-ui`.
2. Use Element Plus components only where Vue runtime rendering is available. Report Factory PDF `html` is converted to pdfmake and should not rely on interactive `el-*` components.
3. In `vue-ui`, write normal Vue template syntax: `v-model`, `v-if`, `v-for`, `:prop`, `@event`, and `{{ }}`.
4. Keep state explicit in the component data/model used by initCraft. For pagination, bind both current page and page size when they are controlled.
5. For detailed Pagination notes, read `references/pagination.md`.

## initCraft Notes

- Use Element Plus for app/runtime UI such as filters, tables, pagination, dialogs, popovers, buttons, tags, and form controls.
- Do not assume Element Plus components render correctly inside Report Factory PDF output. For PDFs, use static HTML tables or Report Factory `table`/`html` widgets.
- When adapting official Element Plus examples, remove TypeScript-only imports and keep code compatible with the initCraft event/editor context unless the project explicitly supports `<script setup>`.
- Prefer `v-model:*` bindings over legacy one-way props plus events for controlled Element Plus components.
- In a ue-ui Components widget, test el-dialog lifecycle behavior before using ppend-to-body. A verified Trade Drug preview became Unable to display this content after closing a teleported dialog. For fragile builder previews, prefer a single-root inline modal (-if, fixed overlay) whose close handler only flips visibility and does not clear selected data.
- Do not embed a complete interactive page through iframe srcdoc in a vue-ui; initCraft Preview can import the JSON successfully but render a blank area. Translate the page into a native Vue template and initialize state through this.vueState.
- If a fragile inline modal changes to Unable to display this content while typing, remove direct v-model from the affected el-input or textarea and test controlled input instead: :model-value plus @input, with the setter declared on this.vueState. Keep render-time template methods side-effect free.
- For large selectable catalogs, reuse the verified source model rather than duplicating labels/options manually. Preserve group IDs, codes, names, and prices, and flatten only as a derived runtime index when needed.