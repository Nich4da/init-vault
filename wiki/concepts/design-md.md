---
type: concept
title: DESIGN.md — the brand contract
created: 2026-08-04
updated: 2026-08-04
tags: [open-design, design-system, brand, markdown, tokens]
sources: ["[[open-design-repo]]"]
---

# `DESIGN.md` — the brand contract

The core idea of [[open-design]]: **a brand is a markdown file**. Every render reads the active
package's `DESIGN.md`, so switching design systems changes the output without touching the brief,
the skill, or the template ([[open-design-repo]]).

The schema descends from `VoltAgent/awesome-design-md`'s original **9-section** layout; current
packages may extend it.

## The sections (observed in `design-systems/linear-app/DESIGN.md`)

1. **Visual Theme & Atmosphere** — the prose brief: what this brand *feels* like.
2. **Color Palette & Roles** — background surfaces · text & content · brand/accent ·
   status colors · borders & dividers · light-mode neutrals · overlay.
3. **Typography Rules** — font family, hierarchy, principles.
4. **Component Stylings** — buttons, cards & containers, inputs & forms, badges & pills,
   navigation, image treatment.
5. **Layout Principles** — spacing system, grid & container, whitespace philosophy,
   border-radius scale.
6. **Depth & Elevation**
7. **Do's and Don'ts** — an explicit two-column list; the anti-slop guardrail.

Roles, not hexes-in-a-vacuum: the palette section names *what each color is for*, which is what
makes it usable by a model rather than just readable by a human.

## Package shape

Legacy packages are `DESIGN.md`-only. Newer ones carry more — e.g. `design-systems/claude/`:

```
design-systems/<brand>/
├── DESIGN.md                  ← the contract (always)
├── USAGE.md
├── manifest.json
├── design-tokens.json         ← machine tokens
├── tokens.css  ·  tailwind-v4.css
├── components.html  ·  components.manifest.json   ← rendered fixtures
├── preview/{colors,spacing,typography}.html
├── system/
└── source/evidence.md         ← provenance: where the values came from
```

`design-systems/_schema` holds the package schema; `design-systems/README.md` records the shape
and provenance rules.

## Catalog

**151 packages** ship with the repo, mixing upstream-derived systems with project-owned additions:

- **AI & LLM** — claude · cohere · mistral-ai · minimax · together-ai · replicate · runwayml ·
  elevenlabs · ollama · x-ai
- **Developer tools** — cursor · vercel · linear-app · framer · expo · clickhouse · [[mongodb]] ·
  supabase · hashicorp · posthog · sentry · warp · webflow · sanity · mintlify · lovable
- **Productivity** — notion · figma · miro · airtable · superhuman · intercom · zapier · raycast
- **Fintech** — stripe · coinbase · binance · kraken · mastercard · revolut · wise
- **E-commerce / Media / Automotive / Other** — shopify · airbnb · uber · nike · starbucks ·
  spotify · playstation · wired · theverge · meta · tesla · bmw · ferrari · apple · ibm · nvidia
- **Starters** — `default` (Neutral Modern) · `warm-editorial`

Adding your own brand = drop a `DESIGN.md` into `design-systems/<brand>/`. Re-import the upstream
library with `scripts/sync-design-systems.ts`.

## Why it matters beyond Open Design

- The brand becomes **versionable, diffable, and reviewable** in git — the thing a Figma library
  can never be.
- It's a **portable prompt fragment**: any agent that can read a file can honor the brand, which
  is what lets [[open-design]] stay agent-agnostic.
- It enables the *refresh an existing codebase* flow — hand a git repo + `DESIGN.md` to an agent
  and get a PR that refactors real components to the spec.
- ⚠ Nothing enforces it. `DESIGN.md` is context, not a compiler; adherence is only as good as the
  model reading it. The repo's answer is the separate `critique` template (a five-dimensional
  self-critique scoresheet) plus an artifact lint API as a pre-emit gate.

## Related

- [[skill-md]] — §5 of the skills protocol is literally "The DESIGN.md as skill context".
- `craft/` — universal, brand-*agnostic* craft rules a skill opts into via `od.craft.requires`;
  the complement to a brand-specific `DESIGN.md`.
- [[od-plugin]] — 143 of the official plugins are just brand `DESIGN.md` files wrapped as plugins.
