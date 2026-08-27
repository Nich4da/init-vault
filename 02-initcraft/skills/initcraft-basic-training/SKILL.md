---
name: initcraft-basic-training
description: "Guided initCraft onboarding and click-by-click training for Form Factory, SQL Factory, and API Factory. Use when Codex needs to teach, coach, or perform beginner-friendly initCraft workflows such as building a first form, creating a SQL Factory query from a form, wiring an API Factory process, explaining how Form/SQL/API fit together, or walking the user through the Basic Training HTML lessons."
---

# initCraft Basic Training

Use this skill when the user wants step-by-step initCraft training rather than a deep reference lookup. The source lessons are local HTML training files converted into Markdown references.

## Lesson Order

Follow this order for first-time builds:

1. **Overview** - explain how Form Factory, SQL Factory, and API Factory work together.
2. **Form Factory** - build the data collection and user-facing form first.
3. **SQL Factory** - query the form's generated `zdata_*` collection through the visual query builder.
4. **API Factory** - add server-side logic that validates input, calls SQL Factory when needed, and returns a plain result to the caller.

## References

Read only the reference needed for the user's task:

- `references/basic-training-overview.md` - overall mental model: forms collect data, SQL reads it back, API processes decide and orchestrate logic.
- `references/build-a-form.md` - click-by-click Leave Request form lesson: fields, variable names, layout, calculation event, form options, preview, and publish.
- `references/build-a-query.md` - click-by-click SQL Factory lesson: query planning, From form, selected columns, `WHERE` params, sorting, testing, copying query ID, and using query results.
- `references/build-a-process.md` - click-by-click API Factory lesson: `Process(params, userInfo)`, param validation/casting, calling SQL Factory, returning success/failure, testing, wiring into a form event, and publishing.

## Training Workflow

When guiding the user live:

1. State the exact screen/menu being used before changing it.
2. Ask the user to keep names and variable names predictable before creating anything.
3. Build in the same order as the lessons: form shell, layout, fields, events, options, preview/test, then enable/place.
4. For SQL Factory, decide columns, filters, params, and sort order on paper before opening the query builder.
5. For API Factory, validate and cast `params` first, then call any SQL Factory query, then return a simple object.
6. When the user is watching the browser, narrate each major click and avoid hidden API edits unless the user explicitly asks for a faster backend route.

## Core Rules From The Lessons

- Every form creates or maps to a MongoDB collection prefixed `zdata_*`.
- Field variable names are the contract used later by events, SQL params, API params, reports, and grids.
- Inside form field events, prefer direct reactive access such as `data.field_name`.
- SQL Factory parameter values should be named placeholders such as `:employee_name`, not pasted literals.
- Beginner SQL queries should hide drafts/deleted rows with a status filter such as `xrstatx NOT IN (0, 3)` when appropriate.
- API Factory processes run as `Process(params, userInfo)` and should not assume incoming param types.
- Use `xformDatax` only for processes wired into form save/insert/update behavior; mid-edit API calls should return a plain result and let the field event decide what to do.

## Relationship To Other initCraft Skills

- Use `feilds-init` for detailed SDForm field/widget setting names.
- Use `ref-initcraft-skill` for deeper platform reference, event APIs, advanced builder behavior, and debugging.
- Use `report-factory` for Report Factory, PDF/Excel/Word configuration, report widgets, and report-ui buttons.
- Use `noql` for writing or debugging NoQL SQL syntax beyond the beginner SQL Factory lesson.
