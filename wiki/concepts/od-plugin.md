---
type: concept
title: Open Design plugins
created: 2026-08-04
updated: 2026-08-04
tags: [open-design, plugins, marketplace, manifest, cli, capabilities]
sources: ["[[open-design-repo]]"]
---

# Open Design plugins

The **distribution layer** of [[open-design]]: a portable directory anchored by
`open-design.json` plus whatever payload its type needs ([[open-design-repo]],
`plugins/spec/SPEC.md`). Where [[skill-md]] defines *behavior*, a plugin makes that behavior
installable, discoverable, parameterized, and shippable.

## Directory shape

```
my-plugin/
├── open-design.json    ← required: marketplace metadata + inputs + pipeline + capabilities
├── SKILL.md            ← required for agent-skill / scenario entries; omitted for other types
├── README.md           ← optional
├── preview/            ← optional: index.html / poster.png (strongly recommended if visual)
└── examples/           ← optional
```

Manifest-only types don't carry a `SKILL.md` at all — a media template uses `template.json`,
a design-system entry uses [[design-md|`DESIGN.md`]].

## `open-design.json` core fields

| Field | Meaning |
|---|---|
| `specVersion` | currently `1.0.0` |
| `name` / `version` | stable ID + semver |
| `compat.agentSkills[].path` | points at `./SKILL.md` when the entry exposes an Agent Skill |
| `od.kind` | `skill` · `scenario` · `atom` · `bundle` |
| `od.taskKind` | `new-generation` · `figma-migration` · `code-migration` · `tune-collab` |
| `od.mode` | output surface — `prototype` · `deck` · `live-artifact` · `image` · `video` · `hyperframes` · `audio` · `design-system` · `scenario` |
| `od.capabilities[]` | **declare the minimum** — a restricted install grants only `prompt:inject` by default |
| `od.inputs[]` | apply-time parameters (drive the generated input UI) |

## The bundled catalog — 460 official directories

| Category | Count | Contents |
|---|---|---|
| `scenarios/` | 13 | complete design scenarios — `od-default`, `od-design-refine`, `od-figma-migration`, `od-code-migration`, `od-react-export`, `od-nextjs-export`, `od-vue-export`, `od-media-generation`, `od-tune-collab`, `od-plugin-authoring`, `od-web-effect-extractor`, … |
| `image-templates/` | 45 | one-shot image prompts |
| `video-templates/` | 63 | HyperFrames / Seedance / Veo motion templates |
| `design-systems/` | 143 | brand `DESIGN.md` wrapped as plugins |
| `atoms/` | 13 | reusable UI fragments — buttons, heroes, KPI cards |
| `examples/` | 183 | remixable reference outputs |

Plus `plugins/community/` (third-party) and `plugins/registry/` (the publishing flow).
Counted locally: **460 directories** under `plugins/_official/`, matching 277 + 183.

## The CLI (and the UI/CLI parity rule)

```bash
od plugin list  --json                # --task-kind / --mode / --tag filters
od plugin search "landing page"
od plugin info    od-default
od plugin install od-figma-migration  # registry ID, ./local-folder, or an https://… link
od plugin apply   od-default --input brief="a one-page pitch for our seed round"
od plugin upgrade / uninstall
od plugin scaffold --id my-plugin --title "My Plugin"
od plugin validate ./my-plugin
```

Every command supports `--json`. This is not a convenience — [[open-design]]'s `AGENTS.md`
makes it a **hard rule**: every user-facing capability must exist in both the web UI *and* the
`od` CLI, hitting the same `/api/*` endpoints, landed in a single PR. The reason is
embeddability: external agents drive `od` and never render the UI, so a UI-only feature simply
cannot be composed into them.

## Contributing a plugin

1. Drop the folder into `plugins/community/` (third-party) or the matching tier of
   `plugins/_official/` (to ship bundled).
2. `od plugin validate` → `pnpm guard` → `pnpm --filter @open-design/plugin-runtime typecheck`.
3. Fill the PR template: ID, version, lane, mode, capabilities, trigger examples, and a
   screenshot/preview for anything visual.
4. External registries (skills.sh / ClawHub / standalone GitHub) →
   `plugins/spec/PUBLISHING-REGISTRIES.md`.

Spec: `plugins/spec/SPEC.md` · agent-authoring guide: `plugins/spec/AGENT-DEVELOPMENT.md` ·
copy-paste minimal templates: `plugins/spec/examples/` · registry endpoint: `GET /api/plugins`.

## Related

- [[skill-md]] — the behavior a plugin usually wraps.
- [[design-md]] — the payload for the 143 design-system plugins.
- [[open-design]] — the host product.
