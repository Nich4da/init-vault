---
type: meta
title: Hot Cache
updated: 2026-08-27
---

# 🔥 Hot Cache — read this first

> Working-state cache. Read this before any other repository file. Safe read-only
> questions may be answered from this file alone.

**Domain:** [[initcraft|initCraft / SDForm]], HIS/LAB, and its artifact library.
**User:** Thai-speaking developer; prefers step-by-step guidance, static evidence,
and explicit separation of validated structure from unverified runtime behavior.
**Vault:** `/Users/nichada/Documents/Initcraft skill` · **Cap:** 500 words.

## Latest — SDForm best-practice promotion

- Proven, distinctive Form patterns now belong in
  `Form-Builder/SDForm/best-practices/`, separate from archival `backup/`.
- Promotion preserves the working source and creates a sanitized immutable
  `<pattern>-vN.json` plus matching evidence sidecar. Static validation alone is
  insufficient: UI goals require Builder/Preview evidence; data/workflow goals
  require runtime evidence. Unverified work remains a candidate in its working
  folder.
- Reuse by copying the JSON to `form-factory/forms/`; never edit a promoted pair.
  Improvements create new versions and update the catalog, manifest, checksums,
  log, and Hot Cache.

## Recent tools

- OpenDesign skills installed: `design-brief`, `reference-design-contract`,
  `frontend-design`, `web-design-guidelines`. For initCraft UI, combine them with
  `element-plus-initcraft` and `feilds-init`.
- draw.io, not Figma, is the user's diagram default.

## Active flag — internal development login

- Root `.env` has local credentials. `dev.childrenhospital.go.th` requires the
  hospital Wi-Fi; do not retry or transmit credentials until the user confirms
  connection. The off-network attempt stopped at DNS.

## Current repository decisions

- Artifact roots: JSON → `Form-Builder/SDForm/`, JavaScript → `Form-Builder/API/`,
  Python → `Form-Builder/seed/`. New Forms go in `SDForm/form-factory/forms/`;
  API processes in `API/api-factory/processes/`.
- Both `backup/` folders are read-only snapshots. Inspect/copy only; add a sanitized
  new version solely on explicit request and never change an existing snapshot.
- For misplaced files, report the current path, reason, recommendation,
  alternatives, and consequences. Let the user choose before relocation; preserve
  immutable sources/backups and never expose or ingest suspected secrets/data.
- Every completed repository task ends with a context-health check and Hot Cache
  refresh. If context is low, verify and commit only safely isolated task-owned
  changes; never use `git add -A` in a dirty worktree. If isolation is unsafe,
  record the blocker, do not commit, and recommend a new chat.
- If material misunderstanding survives one concise clarification, stop work and
  activate `00-home/handoff.md`. The new chat reads Hot Cache, then the handoff,
  restates confirmed intent, and waits for confirmation before editing.
- Web Clipper default is `03-source-materials/web-clips/`; attachments go in
  `03-source-materials/assets/`. Source clips are immutable after intake.

## Context checkpoint

- Commit `8e173fe` was pushed to `origin/main`. Root
  `.obsidian` UI state and misplaced `01-knowledge-base/.obsidian/` remain local.
  Context remains low; the next task must read this cache first.

## Guardrails and routing

- Before SDForm JSON edits, read `02-initcraft/governance/from-codex-backup/SDFORM_JSON_RULES.md`
  and run `Form-Builder/seed/tests-tools/validators/check_sdform_json.py`.
- Known blocker: that validator currently looks for Builder templates in its old
  directory after the library relocation and falls back to mismatched snapshots;
  fix its template path before treating automated results as authoritative.
- Static validation does not prove Builder/Preview/deployed runtime behavior.
- Navigation: `00-home/index.md` · history: `00-home/log.md` · artifact map:
  `02-initcraft/MIGRATION_MANIFEST.md`.
- Conversation reset: `00-home/handoff.md` (`status: inactive`).
