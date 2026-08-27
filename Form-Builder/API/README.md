# API JavaScript Library

This folder contains the JavaScript artifacts separated from JSON. Original
relative categories are preserved so process bodies, form events, builders,
tests, and report components remain distinguishable.

- `api-factory/processes/` — server-side initCraft API process bodies
- `form-factory/events/` — form lifecycle/button event scripts
- `report_factory/` — report builders, components, and tests
- `tests-tools/scripts/` — JavaScript builders and maintenance scripts
- `tests-tools/tests/` — JavaScript tests
- `backup/` — read-only, versioned API reference snapshots; copy a process
  template to `api-factory/processes/` before creating or editing an API

Many process/event files are initCraft runtime snippets with top-level `await`;
validate them inside an async wrapper or in the platform runtime rather than
with plain `node --check`.
