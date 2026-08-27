---
type: source
title: Customise LLM backends for diagram generation
created: 2026-08-27
updated: 2026-08-27
tags: [draw-io, llm, diagramming, configuration, privacy, web-clip]
sources: []
source_file: "03-source-materials/web-clips/Customise LLM backends for diagram generation.md"
source_type: web
source_date: unknown
author: draw.io
url: https://www.drawio.com/docs/reference/diagram-generation/configure-ai-options/
---

# Customise LLM backends for diagram generation

> An official draw.io configuration reference clipped on 2026-08-27, covering
> model endpoints, prompts, actions, attachments, and response parsing for AI
> diagram generation.

## Summary

- draw.io can use provider API keys, custom models, self-hosted endpoints, custom
  prompts, and organization-specific configurations through editor options.
- `enableAi` controls availability, while `aiActions` controls hosted creation,
  custom creation, updates, and legacy assistance. An empty action list disables
  AI features.
- A message without an attachment becomes a `create` request. Attaching a file,
  page, or selection sends captured diagram XML and turns it into an `update`
  request; returned XML can be applied as a diff.
- The Clipboard backend copies the composed request for use with an external AI
  tool, then accepts a pasted response. Mermaid responses are converted to
  draw.io XML.
- `aiGlobals` defines placeholders and system prompts; `aiModels` defines choices;
  and `aiConfigs` defines endpoint, headers, request body, and `responsePath` for
  extracting a provider response.
- Default examples cover GPT-, Gemini-, and Claude-style APIs. The hosted draw.io
  backend has a 10,000-character request limit; user-configured models do not
  share that stated cap.
- Custom backends are not supported in the draw.io Forge apps for Confluence
  Cloud or Jira Cloud because Forge CSP blocks direct browser requests to the
  provider endpoints.

## Key takeaways

- The attachment is the control boundary between creating a new diagram and
  updating existing diagram state ([[ai-diagram-generation]]).
- Stable cell IDs matter: update prompts require retained cells to keep their
  IDs so draw.io can match the response and apply a diff.
- Diagram XML, prompts, attachments, and conversation context may be sent to the
  selected backend. Provider choice is therefore also a data-governance decision.
- API-key field names and sample placeholders are documentation, not credentials.
  Real keys must never be stored in this vault.

## Entities & concepts touched

- [[draw-io]] — the editor whose Generate dialog and configuration are described.
- [[ai-diagram-generation]] — create/update routing, output validation, Mermaid
  conversion, XML identity, and diff application.
- [[model-context-protocol]] — the related draw.io MCP server is linked as a
  programmatic integration surface, but this page primarily covers editor-side
  LLM configuration.

## Contradictions / open questions

- The source describes browser-side provider configuration but does not establish
  an organization-approved method for storing or rotating real API keys.
- It does not verify which configured models or endpoints work in this local
  workspace.
- The screenshot remains an external URL in the immutable clip and was not copied
  into `03-source-materials/assets/`.
