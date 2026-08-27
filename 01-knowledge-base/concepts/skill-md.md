---
type: concept
title: SKILL.md — the Agent Skills convention
created: 2026-08-04
updated: 2026-08-04
tags: [open-design, skills, claude-code, agent, markdown, protocol]
sources: ["[[open-design-repo]]"]
---

# `SKILL.md` — the Agent Skills convention

A folder with a `SKILL.md` inside is a **skill**: a packaged, portable unit of agent behavior.
The format comes from Claude Code's Agent Skills; [[open-design]] adopts it **verbatim** and then
adds an optional `od:` block on top ([[open-design-repo]], `docs/skills-protocol.md`).

This is the same object this vault already lives with — `.claude/skills/initcraft`,
`initcraft-report-factory`, `latex`, and friends are all `SKILL.md` folders. Open Design just
proves the format scales to a 162-skill registry.

## Base format (unchanged from Claude Code)

```yaml
---
name: 8-bit-orbit-video-template
description: |
  Hyperframes-based video template for retro pixel deck motion design.
  Use when users want a high-fidelity, multi-scene HTML-to-video composition…
---
```

`name` + `description` are the whole required contract. The `description` is what the host model
reads to decide relevance — it carries the trigger conditions, which is why the convention is
"what it does **+ when to use it**". Optional `assets/` and `references/` sit beside it.

## Open Design's extensions

Two additions past the base format:

- **`triggers:`** — an explicit list of trigger phrases, **multilingual** in practice
  (`"video template"`, `"视频模板"`, `"像素风动效"`). Cheap and worth copying.
- **`od:`** — the registry block:

| Field | Meaning |
|---|---|
| `od.mode` | the output surface — `prototype` · `deck` · `template` · `design-system` · `image` · `video` · `audio` |
| `od.surface` | narrower target within the mode (e.g. `video`) |
| `od.scenario` | audience grouping — `design` · `marketing` · `operation` · `engineering` · `product` · `finance` · `hr` · `sale` · `personal` |
| `od.type` | implementation family (e.g. `hyperframes`) |
| `od.platform` | e.g. `desktop` |
| `od.craft.requires` | opt into brand-agnostic craft rules from `craft/` |

A skill that omits `od:` entirely still works — the protocol defines the fallback.

## The functional / rendering split (the important distinction)

| | `skills/` | `design-templates/` |
|---|---|---|
| Registry | `GET /api/skills` | `GET /api/design-templates` |
| Purpose | **agent behavior** invoked mid-task — utilities, briefs, packagers | **rendering blueprints** — what the artifact looks like |
| Counted locally | 162 dirs | 114 dirs |

Both use `SKILL.md`. Which registry a folder lands in depends on which directory it sits in, not
on its contents — an intentionally boring rule.

Anchor modes for the template catalog are `prototype` (single-page web/mobile/desktop artifacts)
and `deck` (horizontal-swipe presentations); `image`, `video`, `audio`, and utility templates fill
out the rest. Two utility templates are worth naming: **`critique`** (a five-dimensional
self-critique scoresheet) and **`tweaks`** (an AI-emitted tweaks-panel manifest).

## Discovery, precedence, staging

`docs/skills-protocol.md` also specifies skill **discovery & precedence** (which copy wins when a
skill exists in more than one root) and **runtime resource staging** (how a skill's assets get
into the agent's working directory). Both matter the moment you have user-authored skills sitting
alongside bundled ones.

## Why this matters here

- It's the **interop format** — Claude Code, Codex, Cursor, Copilot and the rest all consume the
  same folder. Writing a skill once means it runs everywhere, which is exactly what makes
  [[open-design]]'s agent-agnostic claim work.
- The [[initcraft]] skills in this project are the same shape; anything learned about writing good
  `description`/`triggers` transfers directly.
- Distribution is the missing piece a bare `SKILL.md` doesn't solve — that's what
  [[od-plugin]] wraps around it.

## Related

- [[design-md]] — the brand context a skill composes with (skills-protocol §5).
- [[od-plugin]] — `open-design.json` points at `./SKILL.md` via `compat.agentSkills[].path`.
- [[persistent-wiki-pattern]] — same underlying bet: durable files on disk beat re-deriving
  behavior from scratch each session.
- Current initCraft skill snapshots: `02-initcraft/skills/`; source provenance and
  exclusions: `02-initcraft/MIGRATION_MANIFEST.md` ([[initcraft-library-migration]]).
