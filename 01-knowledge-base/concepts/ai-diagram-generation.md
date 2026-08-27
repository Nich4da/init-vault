---
type: concept
title: AI diagram generation
created: 2026-08-27
updated: 2026-08-27
tags: [ai, diagramming, draw-io, llm, workflow]
sources: ["[[draw-io-mcp-server]]", "[[draw-io-custom-llm-backends]]"]
---

# AI diagram generation

AI diagram generation in [[draw-io]] spans artifact creation, modification, format
conversion, validation, and editor handoff. It can be exposed through MCP, a CLI,
an embedded URL, or the editor's Generate dialog ([[draw-io-mcp-server]]).

## Create and update loop

1. A prompt without an attachment is a **create** request.
2. Attaching a file, page, or selection captures its diagram XML and makes the
   message an **update** request.
3. For an update, retained cells keep their existing IDs so the response can be
   matched to the canvas.
4. draw.io can preview, insert, copy, open, or apply the result as a diff.
5. Mermaid output can be converted to draw.io XML; direct XML is required when
   the diagram cannot be represented faithfully in Mermaid
   ([[draw-io-custom-llm-backends]]).

## Configuration layers

- **Actions** decide whether hosted create, custom create/update, or no AI is
  available.
- **Globals** hold system prompts and substituted context such as `{data}`.
- **Models** define choices shown to the user.
- **Configs** define provider endpoint, headers, request body, and response path.

## Safety boundary

Attachments may transmit full-file, current-page, or selected-cell XML to the
chosen AI backend. Prompts and conversation history may also be transmitted.
Minimize attachment scope, use an approved backend, and never place real API keys
in this wiki ([[draw-io-custom-llm-backends]]).

Documentation of a backend or model is not proof that it is configured, reachable,
policy-approved, or compatible with the current client; runtime testing remains a
separate step.
