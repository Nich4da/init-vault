---
type: source
title: Open Design — repository (nexu-io/open-design)
created: 2026-08-04
updated: 2026-08-04
tags: [open-design, design-tooling, agent-native, oss, design-md, skill-md, plugins]
source_file: "../open-design/ (local copy, v0.16.1)"
source_type: web
source_date: 2026-08-04
author: nexu-io / Open Design core team + contributors
url: https://github.com/nexu-io/open-design
---

# Open Design — repository (`nexu-io/open-design`)

> The **open-source alternative to Anthropic's Claude Design**: an Apache-2.0, local-first
> design workspace where the coding-agent CLIs already on your `PATH` become the design
> engine, and a `DESIGN.md` brand contract shapes every artifact they render.

**Ingested from:** a local copy at `../open-design/` (sibling of this vault, unpacked from
`open-design-main.zip`; **not a git checkout**, so no commit history is available).
Read in full: `README.md`, `AGENTS.md` (= `CLAUDE.md`, which is a one-line `@AGENTS.md`
include), `CONTEXT.md`; plus headings/samples from `docs/skills-protocol.md`,
`plugins/spec/SPEC.md`, `design-systems/*/DESIGN.md`, `skills/*/SKILL.md`.

## Summary

- **What it is.** A native desktop app (macOS + Windows; Linux AppImage on an optional lane),
  also runnable as Docker, a Vercel-style web app, or from source. It takes a brief and
  streams back a **single-page artifact** — prototype, live dashboard, deck, image, or video.
- **The pitch.** Claude Design (Anthropic, April 2026) was the first product where an LLM
  delivered design artifacts instead of prose — but closed, paid, cloud-only, Anthropic-model-only.
  Open Design keeps the loop (*discover the brief → lock the direction → stream the artifact →
  critique → deliver*) and replaces the closed parts with a **filesystem of skills, design
  templates, design systems, and plugins**.
- **Model/agent agnostic.** It ships **no agent**. `claude` / `codex` / `cursor-agent` /
  `copilot` / `hermes` / `kimi` and ~20 more are spawned as subprocesses; 27 runtime
  definition files live in `apps/daemon/src/runtimes/defs/` (README: 26 definitions over 25
  distinct executables). No CLI installed → a **BYOK proxy** at
  `POST /api/proxy/{anthropic,openai,azure,google,ollama,senseaudio}/stream`.
- **Composable on four planes** — this is the load-bearing idea:
  **plugins** (runnable workflows) · **[[skill-md|functional skills]]** (agent behavior) ·
  **design templates** (rendering blueprints) · **[[design-md|design systems]]** (the brand).
  All four are portable, versionable directories anyone can drop in.
- **Also an MCP server.** `od mcp install <agent>` wires a stdio MCP server into any of 16+
  agents, so an agent in *another* repo can read your Open Design project files live
  (`od project list`, `od files read …`) instead of re-attaching a stale zip each iteration.

## Counts (verified against the local copy, not just the README)

| Thing | README claims | Counted locally |
|---|---|---|
| Functional skills (`skills/`) | "100+" | **162 directories** |
| Design systems (`design-systems/`) | 151 packages | **152 dirs incl. `_schema` → 151** ✅ |
| Design templates (`design-templates/`) | catalog, 15 deck × 36 themes | **114 directories** |
| Official plugins (`plugins/_official/`) | 277 + 183 examples = 460 | **460 directories** ✅ |
| Runtime defs | 26 defs / 25 executables | **27 `.ts` files** in `runtimes/defs/` |

Local `package.json` version = **0.16.1**, but the README roadmap stops at **0.13.0** — the
README is behind the code (see open questions).

## Architecture

```
browser (Next.js 16 App Router + React 18) / Electron shell
        │ /api/*
        ▼
local daemon (Node 24 · Express · SSE · better-sqlite3)   ──→ BYOK proxy (SSRF-guarded)
  /api/skills · /api/design-templates · /api/plugins · /api/design-systems
  /api/chat (SSE) · /api/projects/:id/files/… · /api/artifacts/{save,lint}
  MCP stdio server
        │ spawn(cli, …, { cwd: managed project cwd })
        ▼
the coding-agent CLI composes  skill/template + DESIGN.md  and writes files
```

Workspace: `apps/{web,daemon,desktop,packaged,landing-page}` · `packages/{contracts,sidecar,
sidecar-proto,platform,components}` · `tools/{dev,pack,serve,release}` · `e2e`.
Node `~24`, pnpm `10.33.2`, everything TypeScript-first.

## Repo conventions worth stealing

- **`AGENTS.md` is the single entry point for agents**, and `CLAUDE.md` is literally just
  `@AGENTS.md`. Each layer (`apps/`, `packages/`, `tools/`, `e2e/`, `.github/`) has its own
  `AGENTS.md`; the root file stays about cross-repo boundaries and must not restate module detail.
- **One-source-of-truth sections.** The "Daemon data directory contract" declares itself the
  *only* place daemon data paths may be described, forbids concrete path examples elsewhere,
  and lists named "escape candidates that must not be reused". README explicitly refuses to
  restate it. A strong pattern for stopping doc drift.
- **`CONTEXT.md` = a domain glossary**, each term with an explicit **`_Avoid_:`** list of wrong
  synonyms (Project ≠ repo/folder/session; Normal Artifact ≠ Live Artifact), plus a
  Relationships section, an example dialogue, and "flagged ambiguities" that record resolutions.
- **UI/CLI dual-track rule.** Every user-facing capability must land as *three* things in one PR:
  an `/api/*` endpoint + a `packages/contracts` DTO, a web UI surface, and an `od <capability>`
  subcommand. Shipping only one surface is treated as a regression, because external agents
  drive `od` and never render the UI.
- **Bug follow-up playbook:** lead with a **red spec** that fails before any source change,
  use the cheapest test layer that still sees the symptom, hold the spec's scope (adjacent
  defects go to a follow-up PR), and seed human-verification data only through production HTTP
  APIs — never a test backdoor.
- **UI animation philosophy** is written down as law: default ease-out
  `cubic-bezier(0.23, 1, 0.32, 1)`, enter ≈200ms / exit ≈140ms (asymmetric on purpose),
  `ease-in` forbidden, never animate from `scale(0)`.
- **19 locale files** must all define every i18n key or typecheck fails — `th` (ไทย) included.
- Commits **must not** carry `Co-authored-by` trailers.

## Key takeaways

- The whole product is an argument that **design output should be plain files an agent can read
  and write** — HTML/CSS with real fonts and components, not a canvas. That makes handoff to
  Cursor/Codex/Claude Code a non-event, and makes the brand itself (`DESIGN.md`) a versionable
  artifact instead of a Figma library.
- **`DESIGN.md` is the brand contract** and the single highest-leverage concept here → [[design-md]].
- **`SKILL.md` is adopted verbatim from Claude Code**, then extended with an optional `od:` block
  (`mode`, `surface`, `scenario`, `craft.requires`) → [[skill-md]]. The same convention this
  vault's own `.claude/skills/` (initcraft, report-factory, …) already uses.
- **Plugins are the distribution layer** — `open-design.json` + a type-specific payload, with
  capability declarations, a scaffold/validate CLI, and a PR-based marketplace → [[od-plugin]].
- **Security posture is explicit:** daemon binds `127.0.0.1`, MCP read-only by default, SSRF
  blocked at the proxy edge (private/link-local/CGNAT/metadata IPs), LAN exposure requires
  `OD_BIND_HOST` + `OD_ALLOWED_ORIGINS`, and `OD_ALLOWED_INTERNAL_HOSTS` is strict opt-in,
  exact-host, with malformed entries dropped rather than silently trusted.

## Entities & concepts touched

- [[open-design]] — the product/repo entity page.
- [[design-md]] — the brand contract format that shapes every render.
- [[skill-md]] — the `SKILL.md` convention + Open Design's `od:` extensions.
- [[od-plugin]] — `open-design.json`, plugin kinds, capabilities, the `od plugin` CLI.
- [[obsidian]] — a distant cousin: both treat a folder of markdown as the real artifact.
- [[persistent-wiki-pattern]] — same conviction from a different angle: durable files over
  re-derivation. Open Design applies it to *design*, this vault applies it to *knowledge*.

## Contradictions / open questions

- **README vs code version.** Local `package.json` is `0.16.1`; the README roadmap's last
  checked item is `0.13.0` and `AGENTS.md` marks `docs/roadmap.md` + `docs/spec.md` as
  *archived — do not treat their dated decisions as current behavior*. Anything read from the
  roadmap is unreliable.
- **"100+ functional skills"** undercounts the 162 directories present; conversely
  `design-templates/` has 114 dirs but the README only tables ~20. Neither number is authoritative
  — the registries (`GET /api/skills`, `GET /api/design-templates`) are.
- **Not a git repo locally** — unpacked from `open-design-main.zip`, so there is no branch,
  tag, or commit to pin this snapshot to. Re-clone with `git` before contributing.
- **Why is this in the vault?** The wiki's domain so far is [[initcraft]] / [[his]]. Open Design
  is a **second, unrelated domain** — the user's intent (use it? contribute to it? borrow its
  conventions?) is not yet recorded. `.claude/commands/od-contribute.md` and an empty
  `open-design-stage/` directory hint at **contributing**, but that is inference, not fact.
- `open-design-extracted/` and `open-design/` are two copies of the same zip; only
  `open-design/` was read. Whether they differ is unchecked.
