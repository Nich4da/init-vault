---
type: entity
title: SDForm
created: 2026-07-16
updated: 2026-07-16
tags: [initcraft, sdform, form-engine, runtime]
aliases: [SDForm, sdform]
sources: ["[[llm-api-docs]]", "[[llm-field-docs]]"]
---

# SDForm

The form engine at the core of [[initcraft|initCraft]] — both reference docs in this wiki
are "SDForm" references. It spans a **client runtime** (the form the user interacts with)
and a **server layer** (permission-checked data access and events).

## Client side
- Renders the [[field-components|component catalog]] and runs field/form events.
- Exposes [[client-api-this|`this.*` and `this.getFormRef().*` functions]] and a reactive
  `data` model.
- Documented in [[llm-field-docs]].

## Server side
- `app.sdform*` functions (`sdformGetOne/GetAll/SetOne/DelOne`) read/write form data
  **with** permission checks and lifecycle events (`afterSaveForm`, `afterDeleteForm`) —
  in contrast to raw `app.db*` access which bypasses them.
- Soft-delete semantics: `sdformDelOne` sets `xrstatx = 3` rather than removing the row.
- Documented in [[llm-api-docs]].

## Key distinction
`app.sdform*` (permissioned, event-firing) vs `app.db*` (direct [[mongodb|MongoDB]], no
checks) is the central server-side access decision. See [[server-api-app]].

## Related
- Platform: [[initcraft]] · Store: [[mongodb]] / [[zdata-collections]]
- Write-back to a form after save: [[xformdatax]]
