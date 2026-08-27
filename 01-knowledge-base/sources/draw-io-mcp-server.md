---
type: source
title: draw.io MCP server
created: 2026-08-27
updated: 2026-08-27
tags: [draw-io, mcp, diagramming, ai, web-clip]
sources: []
source_file: "03-source-materials/web-clips/draw.io MCP server.md"
source_type: web
source_date: unknown
author: draw.io
url: https://www.drawio.com/docs/manual/generate/drawio-mcp-server/
---

# draw.io MCP server

> An official draw.io page clipped on 2026-08-27 that distinguishes four ways
> to connect AI models to draw.io diagram creation and editing.

## Summary

- The hosted or self-deployed **MCP App server** can return inline previews in
  clients that support MCP Apps and provides an action to open the result in the
  draw.io editor.
- The npm **MCP Tool server**, installed with `npx @drawio/mcp`, lets compatible
  clients generate or open diagrams in a browser tab and can import CSV,
  Mermaid, and diagrams fetched from URLs.
- The **Skill + CLI** path lets Claude Code create `.drawio` files and optionally
  export PNG, SVG, or PDF; it requires draw.io Desktop.
- The **embedded diagram URL** path uses project instructions and Python to put
  draw.io, Mermaid, or CSV-generated diagram data in a URL without installing a
  server.
- The page links separate guidance for AI styling, custom LLM backends, AI
  generation/validation, and JSON export.

## Key takeaways

- [[draw-io]] offers multiple integration shapes with different client,
  installation, preview, and editing requirements; “draw.io MCP” does not name
  one universal deployment.
- MCP App previews, an npm MCP tool, a desktop-dependent CLI, and an encoded URL
  are alternatives rather than interchangeable setup steps.
- This document describes available integrations. It does not show that any of
  them is installed or configured in this vault.

## Entities & concepts touched

- [[draw-io]] — the diagram editor and provider of the four integration paths.
- [[model-context-protocol]] — the compatibility layer used by the App and Tool
  server options.
- [[ai-diagram-generation]] — generation can produce draw.io XML directly or
  import Mermaid/CSV, then open or export the result.

## Contradictions / open questions

- The page delegates authentication, deployment, and detailed client support to
  linked setup documents; those details were not captured in this clip.
- Actual compatibility with Codex, the current desktop app, or local draw.io
  installations remains unverified.
