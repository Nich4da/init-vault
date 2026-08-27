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

## Latest — OpenDesign skills

- Installed four audited skills from `nexu-io/open-design` into
  `~/.codex/skills/`: `design-brief`, `reference-design-contract`,
  `frontend-design`, and `web-design-guidelines`.
- Source matched commit `9881cff70e02be86c2a58130af512011ba23d4af`;
  recursive diff passed.
- They become discoverable from the next task/turn. For initCraft UI, combine
  them with `element-plus-initcraft` and `feilds-init`; existing platform and
  SDForm rules remain authoritative.
- Skipped catalogue stubs, workflows requiring `od`/`agent-browser`, and
  `taste-skill`, which excludes dashboards and forms.

## Recent artifact

- draw.io is the user's diagram default, not Figma. Latest source and PNG:
  `02-his/draw_design/agent_result_final_relation.{drawio,png}`. XML validation
  and draw.io Desktop rendering passed; source JSON stayed unchanged.

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

- User explicitly authorized a full migration commit. All 293 recorded checksums
  passed; `.env` remains ignored. Commit the named migration paths only and leave
  unrelated `.obsidian` UI-state changes unstaged. Context remains low; start the
  next design request in a new task and read this cache first.

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
