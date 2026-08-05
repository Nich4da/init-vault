---
type: entity
title: Open Design
created: 2026-08-04
updated: 2026-08-04
tags: [product, oss, design-tooling, agent-native, desktop-app, mcp]
aliases: [OD, nexu-io/open-design, Open Design Cloud]
sources: ["[[open-design-repo]]"]
---

# Open Design

An **Apache-2.0, local-first design workspace** — "the open-source Claude Design alternative"
([[open-design-repo]]). Repo: `github.com/nexu-io/open-design` (org **nexu-io**), site
`open-design.ai`, local copy at `../open-design/` (v0.16.1).

It ships as **a desktop app + a daemon + an `od` CLI + an MCP server** — never as an agent.
The coding-agent CLIs already on your `PATH` do the generating; Open Design supplies the
brief, the brand, the templates, and the surface that renders the result.

## The one-line model

> **brief → plugin → direction → design system → artifact → handoff → memory**

A brief plus a [[skill-md|functional skill]] or design template plus a [[design-md|`DESIGN.md`]]
gets bound together and handed to a spawned CLI, which writes real files. The app previews those
files in a sandboxed iframe, and exports to HTML / PDF / PPTX / ZIP / Markdown / MP4.

## Output surfaces

| Surface | What it is |
|---|---|
| **Prototype** | single-page HTML artifacts — web, desktop, mobile (framed iPhone 15 Pro / Pixel) |
| **Live artifact** | refreshable dashboards / KPI walls with a tweaks panel; re-renders without reload |
| **Deck** | keyboard-navigable presentations → PPTX / PDF (15 templates × 36 themes) |
| **Image** | brand-grade visuals; 93 ready prompts in `prompt-templates/` |
| **Video / HyperFrames** | HTML + CSS + GSAP → deterministic MP4 via headless Chrome + FFmpeg |
| **Audio** | speech + sound effects (music explicitly out of scope in v1) |

**HyperFrames** is HeyGen's open-source agent-native video framework, integrated first-class.

## The four composable planes

1. **Plugins** — runnable workflows, the distribution/marketplace layer → [[od-plugin]]
2. **Functional skills** (`skills/`, 162 dirs) — agent behavior → [[skill-md]]
3. **Design templates** (`design-templates/`, 114 dirs) — rendering blueprints
4. **Design systems** (`design-systems/`, 151 packages) — the brand → [[design-md]]

All four are plain, portable, versionable directories. Drop a folder in; the picker finds it.

## Runtime & platform

- **Agents:** 26 runtime definitions over 25 distinct local CLI executables — Claude Code, Codex,
  Cursor, Copilot, OpenCode, OpenClaw, Antigravity, Cline, Trae, Kimi, Kiro, Pi, Mistral Vibe,
  Hermes, Raven, Reasonix… One-line wiring: `od mcp install <agent>`.
- **BYOK:** any OpenAI-compatible endpoint (OpenAI, Anthropic, Azure, Gemini, Ollama, LM Studio,
  vLLM, Atlas Cloud) through an SSRF-guarded proxy. **Open Design Cloud** is the paid first-party
  router (`AMR Cloud` internally; `AMR CLI` is its local adapter).
- **Stack:** Next.js 16 + React 18 web · Node 24 + Express + SSE + `better-sqlite3` daemon ·
  Electron desktop with sidecar IPC · pnpm 10.33.2 workspace.
- **Gotcha:** on macOS/WSL2, `/usr/bin/od` (the octal-dump utility) shadows the `od` command —
  use the desktop app's **Settings → MCP server** snippet instead.
- **Windows native is best-effort only.** `corepack enable` hits EPERM (use
  `npm i -g pnpm@10.33.2`), and `better-sqlite3` has no Node 24 prebuild so it compiles from
  source via node-gyp (~2 min, needs VS Build Tools 2022+). ⚠ Relevant — this vault is on Windows 11.

## Governance

- **License:** Apache-2.0; bundled skills keep their own (guizang-ppt and html-ppt are MIT).
- **Maintainers:** @Nagendhra-web, @Sid-Qin, @YOMXXX. An **Open Design Fellow** program pays
  $1,000/MR plus LLM credits and a direct review track.
- **Community:** Discord `mHAjSMV6gz` · X `@OpenDesignHQ` · GitHub Discussions/Issues.
  `good-first-issue` and `help-wanted` are the marked entry points.
- **Lineage:** Claude Design (the thing it replaces) · `alchaincyf/huashu-design` (design
  philosophy, anti-AI-slop checklist, 5-dimensional critique) · `op7418/guizang-ppt-skill` ·
  `lewislulu/html-ppt-skill` · `OpenCoworkAI/open-codesign` · `multica-ai/multica` (daemon +
  adapter architecture) · `VoltAgent/awesome-design-md` (the original 9-section `DESIGN.md`
  schema) · `heygen-com/hyperframes`.

## Relation to this vault

Open Design is a **second domain** here, unconnected to [[initcraft]] / [[his]]. Two honest links:

- Its `SKILL.md` convention is the same one this vault's own `.claude/skills/` already uses
  ([[skill-md]]) — so an initCraft skill and an Open Design skill are the same shape of object.
- Its `AGENTS.md` / `CONTEXT.md` discipline (single-source-of-truth sections, a glossary with
  `_Avoid_:` lists, docs that refuse to restate each other) is a directly borrowable model for
  [[CLAUDE|this vault's schema]] and for HIS documentation.

Why it was ingested is not yet recorded — see the open questions in [[open-design-repo]].
