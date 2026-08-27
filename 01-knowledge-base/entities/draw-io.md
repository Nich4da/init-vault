---
type: entity
title: draw.io
created: 2026-08-27
updated: 2026-08-27
tags: [draw-io, diagrams-net, diagramming, mcp, ai]
aliases: [diagrams.net, drawio]
sources: ["[[draw-io-mcp-server]]", "[[draw-io-custom-llm-backends]]", "[[his-system-flow]]"]
---

# draw.io

draw.io (also known as diagrams.net) is a diagram editor used by this vault's
existing HIS architecture source ([[his-system-flow]]). Its official AI
documentation exposes several routes for generating, opening, and updating
diagrams ([[draw-io-mcp-server]]).

## AI integration surfaces

| Surface | Main behavior | Dependency |
|---|---|---|
| MCP App server | Inline preview plus open-in-editor action | MCP Apps-capable client and hosted/self-hosted endpoint |
| MCP Tool server | Generate/open in a browser; import CSV, Mermaid, or URL | npm package and MCP client |
| Skill + CLI | Create `.drawio`; optionally export PNG/SVG/PDF | Claude Code and draw.io Desktop |
| Embedded URL | Encode a diagram or import payload in a URL | Project instructions and Python |
| Generate dialog | Chat-based create/update against selected LLM backend | Editor AI configuration and chosen provider |

These are distinct workflows, not evidence that a local MCP server is already
installed ([[draw-io-mcp-server]]).

## Configurable LLM behavior

The editor configuration separates actions, global prompts/placeholders, visible
models, provider request shapes, and response extraction. Attaching a diagram
changes a request from creation to update and sends captured diagram XML; update
responses preserve cell IDs so the editor can apply a diff
([[draw-io-custom-llm-backends]]).

Because prompts, diagram content, and conversation state may leave the browser,
the chosen backend and attachment scope must match the data policy. This vault
records parameter names and examples only; it must not hold live API keys.

## Related

- [[model-context-protocol]] — server/client integration pattern.
- [[ai-diagram-generation]] — create, update, validate, and apply workflow.
- [[open-design]] — another diagram/design-adjacent tool with its own MCP server,
  but not the same product or protocol implementation.
