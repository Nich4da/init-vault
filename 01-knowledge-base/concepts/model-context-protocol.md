---
type: concept
title: Model Context Protocol integration
created: 2026-08-27
updated: 2026-08-27
tags: [mcp, integration, agents, tooling]
sources: ["[[draw-io-mcp-server]]", "[[open-design-repo]]"]
---

# Model Context Protocol integration

In this wiki, Model Context Protocol (MCP) is an integration boundary through
which an AI client can call a tool or read application-managed context. The exact
transport and user experience remain implementation-specific.

## Observed patterns

- [[draw-io]] documents a hosted or self-deployed **MCP App server** that can
  return inline diagram previews in clients supporting MCP Apps
  ([[draw-io-mcp-server]]).
- It separately ships an npm **MCP Tool server** for compatible clients to
  generate and open diagrams in a browser ([[draw-io-mcp-server]]).
- [[open-design]] exposes a stdio MCP server so an agent working elsewhere can
  read live project files through `od` operations ([[open-design-repo]]).

The shared MCP label does not imply the same capabilities, transport, trust
boundary, installation procedure, or UI. Each server must be evaluated from its
own documentation and verified in the target client.

## Verification checklist

- Identify the exact server variant and transport.
- Confirm the target client supports the required MCP feature set.
- Review data sent to the server and any third-party endpoint.
- Test the advertised tool calls and returned artifact format.
- Record installed/configured status separately from documentation availability.

## Related

- [[draw-io]] — diagram-specific MCP App and Tool servers.
- [[ai-diagram-generation]] — one workflow enabled by the draw.io integration.
- [[open-design]] — project-context MCP server with a different capability set.
