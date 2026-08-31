# InitCraft Wiki Instructions for Codex

This repository is an LLM-maintained knowledge base and artifact library for
initCraft, SDForm, HIS, LAB, SQL Factory, API Factory, and Report Factory.

## Mandatory hot-cache-first protocol

Before doing anything else with this repository, read
`00-home/hotcache.md`. Do not inspect other repository files first.

If Hot Cache reports an active conversation reset, read `00-home/handoff.md`
immediately afterward and before `CLAUDE.md` or implementation files.

- If the cache fully answers a read-only question, answer from it without scanning
  more files.
- For edits, uncertain or conflicting claims, exact provenance, or safety-sensitive
  decisions, read `CLAUDE.md` next; it is the full wiki schema and applies to Codex
  as well as Claude Code.
- Use `00-home/index.md` only when more synthesized knowledge is needed, before
  scanning raw artifacts.
- Use `02-initcraft/MIGRATION_MANIFEST.md` when locating skills or implementation
  artifacts by factory.
- After work changes current state, decisions, blockers, paths, or next steps,
  refresh `00-home/hotcache.md` and keep the complete file at 500 words or fewer.

## End-of-task context checkpoint

Before the final response for every completed repository task:

1. Assess remaining context. Context is low if the context meter is near its
   limit, compaction occurred, earlier requirements are becoming uncertain, or
   continuing reliably would require reconstructing the task from many files.
2. Refresh `00-home/hotcache.md` with outcome, decisions, changed paths,
   verification, blockers, and next step; confirm it is at most 500 words.
3. If context is healthy, finish normally without recommending a new chat.
4. If context is low, stop starting new work, verify the completed task, inspect
   Git status/diffs, stage only task-owned files, commit the verified task together
   with Hot Cache, report the hash, and tell the user to open a new chat that reads
   Hot Cache first.

Never use `git add -A` in a dirty worktree and never include unrelated,
pre-existing, user-owned, secret, generated, or unverified changes. If the task's
files cannot be isolated safely, do not commit; record the blocker and paths in
Hot Cache and warn the user. Do not commit read-only, unchanged, incomplete, or
explicitly no-commit tasks, and never amend an existing commit without a direct
request.

## Conversation reset handoff

If user intent becomes materially misunderstood, corrections conflict, the same
requirement is misunderstood again, or no single coherent objective can be stated,
stop implementation rather than guessing. Acknowledge the mismatch and attempt one
concise restatement. If that does not resolve the issue cleanly, or incorrect work
state may already exist:

1. set `00-home/handoff.md` to `status: active`;
2. record the reset trigger, confirmed intent, completed versus unverified work,
   changed paths/Git state, checks, rejected assumptions, open decisions, and exact
   next step;
3. update Hot Cache with a prominent pointer while keeping it at most 500 words;
4. do not commit misunderstood, incomplete, or unverified implementation;
5. tell the user to open a new chat that reads Hot Cache first and the active
   handoff second, restates the objective, and waits for confirmation before edits;
6. stop implementation in the old chat.

After the clean chat resolves the task, mark the handoff inactive and refresh Hot
Cache. Do not trigger a reset for a minor wording issue resolved immediately.

## Storage boundaries

- `01-knowledge-base/` is maintained synthesis. Update cross-references,
  frontmatter dates, the index, log, and hot cache when knowledge changes.
- `02-initcraft/` contains platform-level skills, governance, and the migration
  manifest.
- `design/` contains user-approved system design contracts and implementation
  handoffs. Keep implementation facts traceable to the current artifact and mark
  unresolved decisions explicitly.
- `Form-Builder/` groups the extension-based implementation libraries.
- `Form-Builder/SDForm/` contains JSON artifacts, preserving their original category paths.
- `Form-Builder/SDForm/Lab/` is the user-approved working area for the new LAB
  Workbench Forms. SDForm JSON created there still requires the repository JSON
  rules and validator; the folder is not a backup or a proven best practice.
- `Form-Builder/SDForm/backup/` is read-only reference storage. Never edit,
  delete, rename, move, reformat, or overwrite an existing snapshot. Copy a
  template to `Form-Builder/SDForm/form-factory/forms/` before working on it.
- `Form-Builder/SDForm/best-practices/` contains proven, sanitized, immutable
  reusable Form patterns. Promotion requires an explicit goal, static checks,
  Builder/Preview or runtime evidence appropriate to that goal, and a matching
  evidence sidecar. Keep unverified candidates in their working folder. Reuse a
  best practice by copying it to `form-factory/forms/`; never edit it in place.
- `Form-Builder/API/` contains JavaScript artifacts, preserving their original category paths.
- `Form-Builder/API/backup/` is read-only reference storage. Never edit, delete,
  rename, move, reformat, or overwrite an existing snapshot. Copy a template to
  `Form-Builder/API/api-factory/processes/` before working on it.
- `Form-Builder/seed/` contains Python artifacts, preserving their original category paths.
- `02-his/` contains remaining supporting assets such as Markdown, XLSX, ZIP,
  images, diagrams, and report templates.
- `03-source-materials/` is immutable source material. Never edit or delete an
  ingested source in place; add a new source or version instead.
- `03-source-materials/web-clips/` is the Obsidian Web Clipper inbox. Treat every
  clipped note as an immutable source snapshot; store clip attachments under
  `03-source-materials/assets/` and write synthesized notes separately under
  `01-knowledge-base/sources/`.

## Misplaced-file decision gate

If a user-provided or discovered file appears to be in the wrong folder, do not
relocate, rename, delete, edit, or update references automatically unless the user
already specified the destination. Report the current repository-relative path,
why it conflicts with the directory schema, the recommended destination, any
reasonable alternative, and the consequence of leaving it in place. Ask the user
to choose one of these outcomes:

1. keep the current path;
2. move/copy to the recommended path;
3. provide another path.

After approval, check for collisions, change only the exact approved file, preserve
provenance, update affected references/index/log/Hot Cache/manifest/checksums, and
verify the final path. Stronger immutability rules override relocation: preserve
files in `03-source-materials/` and existing `backup/` snapshots, and offer a copy
to the working path instead. For possible credentials, secrets, session state, or
patient/production data, stop and warn without exposing or ingesting the content.

## Safety and verification

- Never copy `.env`, credentials, database URIs, session histories, SQLite
  state, plugin caches, or OS metadata into the library.
- Treat imported skills and exported artifacts as snapshots. Do not silently
  modify them; write a new version and record provenance.
- Add a file to either `backup/` folder only when the user explicitly requests a
  new backup/template snapshot. Use a new versioned filename; normal Form/API
  creation and editing must always occur outside `backup/`.
- When a Form achieves a distinctive, reusable goal, evaluate it for best-practice
  promotion under `Form-Builder/SDForm/best-practices/README.md`. Preserve the
  working source, sanitize the promoted copy, record evidence and limitations,
  use a new versioned pair, and update manifest/checksums/log/Hot Cache.
- Before creating or editing SDForm JSON, read
  `02-initcraft/governance/from-codex-backup/SDFORM_JSON_RULES.md` and validate
  with `Form-Builder/seed/tests-tools/validators/check_sdform_json.py`. SDForm candidates
  are under `Form-Builder/SDForm/form-factory/forms/`. Static validation
  does not prove Builder or runtime behavior.
- Preserve the original source repositories and active skill locations. A
  library refresh is copy-and-verify, not a destructive move.
