# InitCraft library migration — raw provenance note

Date: 2026-08-27 (Asia/Bangkok)

The vault received a non-destructive snapshot from two canonical locations:

- `/Users/nichada/.codex/skills/` — eight active initCraft-related skills.
- `/Users/nichada/Documents/codex-backup/` — SDForm exports, API processes,
  SQL/Report Factory exports, tests, builders, validators, handoffs, diagrams,
  and data-import workbooks.

The full categorized inventory and exclusions are recorded in
`02-initcraft/MIGRATION_MANIFEST.md`. The originals were not removed. Secrets,
runtime/session state, caches, and operating-system metadata were excluded.

The vault later separated migrated artifacts by extension: JSON under
`SDForm/` and JavaScript under `API/`, while retaining category subdirectories
to prevent duplicate basenames from overwriting one another.

Python artifacts were separated under `seed/`. Python resources owned by an
active skill remain inside that skill package.
