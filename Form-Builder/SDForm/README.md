# SDForm JSON Library

This folder contains the JSON artifacts separated from the JavaScript library.
The original relative categories are preserved to avoid filename collisions.

- `form-factory/forms/` — 73 SDForm exports with `fields` and `formConfig`
- `sdform_module/` — earlier HIS module/form exports
- `api-factory/` — API schemas and JSON payload examples
- `sql-factory/` — SQL Factory JSON exports
- `report_factory/` — Report Factory JSON exports
- `tests-tools/` — JSON fixtures
- `data-imports/` — JSON analysis/import data
- `backup/` — read-only, versioned SDForm reference snapshots; copy a template
  to `form-factory/forms/` before creating or editing a Form
- `best-practices/` — curated, sanitized, versioned Form patterns with validation
  evidence; copy a pattern to `form-factory/forms/` before adapting it

Not every JSON file is import-ready. Historical, draft, failed, and broken
artifacts are retained as evidence. Validate the exact SDForm candidate and
verify it in the real Builder before use.

A working form becomes a best practice only after it proves a specific reusable
goal. Static validation is necessary but not sufficient. Follow
`best-practices/README.md` for promotion evidence, sanitization, versioning, and
reuse rules.
