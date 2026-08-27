# InitCraft Artifact Library Migration Manifest

Snapshot date: 2026-08-27 (Asia/Bangkok)

This migration consolidates the active initCraft skills and the relevant
Form/API/SQL/Report artifacts from the Codex workspace into this vault. It is a
non-destructive snapshot: original files remain in their source locations.

## Canonical sources

- Active skills: `/Users/nichada/.codex/skills/`
- Implementation workspace: `/Users/nichada/Documents/codex-backup/`
- Destination vault: `/Users/nichada/Documents/Initcraft skill/`

## Library map

| Category | Destination | Contents at migration |
|---|---|---:|
| Active skills | `02-initcraft/skills/` | 8 skill packages, 35 files |
| Archived skill | `02-initcraft/skills-archive/` | `initcraft-report-sql`, 2 files |
| Workspace governance | `02-initcraft/governance/from-codex-backup/` | 4 files |
| Form Builder library | `Form-Builder/` | JSON, JavaScript, and Python artifact roots |
| JSON library | `Form-Builder/SDForm/` | 107 JSON files, categorized by original purpose |
| Form template backups | `Form-Builder/SDForm/backup/` | Read-only, versioned SDForm JSON reference snapshots |
| Form best practices | `Form-Builder/SDForm/best-practices/` | Proven, sanitized, immutable Form patterns plus evidence sidecars |
| SDForm exports | `Form-Builder/SDForm/form-factory/forms/` | 73 JSON forms |
| JavaScript library | `Form-Builder/API/` | 40 JavaScript files, categorized by original purpose |
| API template backups | `Form-Builder/API/backup/` | Read-only, versioned API Factory JavaScript reference snapshots |
| Python library | `Form-Builder/seed/` | 32 Python files, categorized by original purpose |
| API processes | `Form-Builder/API/api-factory/processes/` | 7 JavaScript processes |
| API schemas/examples | `Form-Builder/SDForm/api-factory/` | 6 JSON files |
| SQL Factory | `Form-Builder/SDForm/sql-factory/` + `02-his/sql-factory/` | JSON separated from ZIP exports |
| Report Factory | `Form-Builder/SDForm/report_factory/` + `Form-Builder/API/report_factory/` + `02-his/report_factory/` | JSON, JavaScript, and other assets separated by file type |
| Tests and tools | `Form-Builder/API/tests-tools/` + `Form-Builder/SDForm/tests-tools/` + `Form-Builder/seed/tests-tools/` | JavaScript, JSON fixtures, and Python/validator files separated |
| Data imports | `02-his/data-imports/` + `Form-Builder/SDForm/data-imports/` + `Form-Builder/seed/data-imports/` | XLSX, JSON, and Python files separated |
| Handoffs | `02-his/handoff/from-codex-backup/` | 11 documents |
| Architecture | `02-his/architecture/from-codex-backup/` | 5 Mermaid/draw.io files |

The 73-form catalog intentionally includes historical, experimental, and known
broken files whose names contain terms such as `Broken`, `Failed`, `Draft`, or
`Validated`. They are preserved as evidence and regression fixtures, not
presented as import-ready deliverables. Apply the SDForm rules and validator to
the exact candidate selected for future use, then verify it in the real Builder.

On 2026-08-27 the artifact view was further separated by extension at the
user's request. JSON files moved under `Form-Builder/SDForm/`; JavaScript files moved under
`Form-Builder/API/`. Original category paths were retained below those roots because
`EMR.json`, `disease.json`, and `Mockup_V2.json` have duplicate basenames.

Python artifacts were subsequently moved under `Form-Builder/seed/`, also preserving their
category paths. The one Python executable inside `erp-mongodb-readonly` remains
inside its active skill package so the skill is not broken.

The three extension-based roots were later grouped under `Form-Builder/` without
changing their internal category paths or file contents.

The `backup/` directories under `Form-Builder/SDForm/` and `Form-Builder/API/`
are read-only reference libraries for sanitized, reusable templates. Existing
snapshots may be inspected or copied but must not be edited, deleted, renamed,
moved, reformatted, or overwritten. New Form and API work occurs outside
`backup/`, normally in `Form-Builder/SDForm/form-factory/forms/` and
`Form-Builder/API/api-factory/processes/`. A new backup snapshot is added only on
an explicit user request, with a new version suffix, and must not contain
credentials, database URIs, patient data, or other production data.

`Form-Builder/SDForm/best-practices/` is a separate curated promotion layer for
Forms that demonstrably meet a specific reusable objective. Promotion preserves
the working source and adds a sanitized, immutable versioned JSON copy with a
matching evidence sidecar. Static validation alone does not qualify a Form;
Builder/Preview or runtime evidence must match the kind of goal being claimed.
Future work copies a best practice back to `form-factory/forms/` rather than
editing the promoted artifact in place.

`skills-archive/initcraft-report-sql` is reference-only: its `SKILL.md` has text
before the YAML delimiter and therefore fails normal skill discovery/validation.
It was preserved unchanged rather than silently repaired or installed.

## Active skill packages

- `element-plus-initcraft`
- `erp-mongodb-readonly`
- `feilds-init`
- `initcraft-basic-training`
- `noql`
- `ref-initcraft-skill`
- `report-factory`
- `lab-che`

All eight installed snapshots were byte-compared recursively with their active
source directories after copying.

The bundled `skill-creator` quick validator could not run in the current Python
environment because the `yaml` module is unavailable. Skill copies were instead
checked by recursive byte comparison plus a structural frontmatter/name/
description check; this limitation is recorded rather than hidden.

## Deliberately excluded

- `.env` and credentials
- `.git`, `.obsidian`, and editor/runtime state from source repositories
- Codex session histories, JSONL logs, SQLite memory, and configuration files
- plugin caches and staging directories
- `.DS_Store`, `__pycache__`, and compiled Python files

## Integrity

`checksums.sha256` records SHA-256 hashes for the migrated library. It verifies
file integrity only; Builder/Preview/runtime behavior still requires the real
initCraft application.
