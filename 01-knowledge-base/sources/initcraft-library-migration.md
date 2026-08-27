---
type: source
title: InitCraft skill and artifact library migration
created: 2026-08-27
updated: 2026-08-27
tags: [initcraft, skills, form-factory, api-factory, sql-factory, report-factory, provenance]
source_file: "03-source-materials/initcraft-library-manifest.md"
source_type: note
source_date: 2026-08-27
author: Codex and user
---

# InitCraft skill and artifact library migration

> A provenance record for consolidating active skills and implementation
> artifacts into this LLM-maintained vault without deleting their originals.

## Summary

- Eight active initCraft-related skill packages are now cataloged under
  `02-initcraft/skills/`.
- All 107 migrated JSON artifacts are under `Form-Builder/SDForm/`; the 73 primary SDForm
  exports are grouped under `Form-Builder/SDForm/form-factory/forms/`.
- All 40 migrated JavaScript artifacts are under `Form-Builder/API/`, separated into
  process, event, builder, component, and test categories.
- All 32 migrated Python artifacts are under `Form-Builder/seed/`, separated into data
  builders, diagram generators, maintenance scripts, and validators.
- API processes, schemas, and payload examples are separated from Form event
  handlers and from tests/builders.
- SQL Factory and Report Factory exports have dedicated folders.
- Handoffs, import workbooks, diagrams, tests, and validators are discoverable
  without searching the old workspace root.
- The operation was copy-and-verify. The active skill directories and
  `codex-backup` Git repository remain authoritative working sources.

## Key takeaways

- `02-initcraft/MIGRATION_MANIFEST.md` is the entrypoint for locating raw
  skills and artifacts.
- `Form-Builder/SDForm/README.md`, `Form-Builder/API/README.md`, and `Form-Builder/seed/README.md` explain the
  extension-based views.
- `Form-Builder/SDForm/backup/` and `Form-Builder/API/backup/` are the designated
  read-only locations for sanitized, reusable Form and API reference snapshots.
  New work must be copied to the corresponding non-backup Form/API directory.
- The wiki pages remain the synthesized knowledge layer; the migrated JSON,
  JavaScript, ZIP, and XLSX files are implementation evidence, not automatically
  trusted runtime truth.
- Sensitive and transient files were intentionally excluded.

## Entities & concepts touched

- [[initcraft]] — platform anchor for the consolidated library.
- [[skill-md]] — skill packages and progressive disclosure.
- [[form-model-json]] — SDForm exports and validation evidence.
- [[api-factory]] — server-side process artifacts.
- [[sql-factory]] — query exports and dual-representation caveats.
- [[report-factory]] — report exports, templates, and publish-chain evidence.

## Contradictions / open questions

- The active `feilds-init` skill is newer than the repository backup because it
  includes the drug-label resume checkpoint. The active snapshot is therefore
  the cataloged copy.
- Cataloging does not equal semantic ingestion. Individual artifacts should be
  read and integrated into the wiki only when their topic is worked on.
