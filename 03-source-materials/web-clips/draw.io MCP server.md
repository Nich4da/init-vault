---
title: "draw.io MCP server"
source: "https://www.drawio.com/docs/manual/generate/drawio-mcp-server/"
author:
published:
created: 2026-08-27
description: "The official draw.io MCP (Model Context Protocol) server enables LLMs to create and open diagrams in the draw.io editor using the `.drawio` format."
tags:
  - "clippings"
---
The official draw.io MCP (Model Context Protocol) server enables LLMs to create and open diagrams in the draw.io editor using the `.drawio` format.

There are four ways you can integrate draw.io with AI models.

## MCP app server

Use this method if you want diagram previews to appear inline in your chats with AI services that support MCP Apps protocol, including Claude.ai and VSCode. To edit the diagram in draw.io, click on the *Open in draw.io* button and it will open in a new tab in the draw.io editor.

**To use:** Add the draw.io hosted endpoint as a remote MCP server to your AI model, run the server locally or deploy your own instance.

[Refer to the documentation](https://github.com/jgraph/drawio-mcp/blob/main/mcp-app-server/README.md) for setup instructions.

## MCP tool server

An installable npm package that allows any MCP client (such as Claude Desktop) to generate and open draw.io diagrams directly in a new tab in the draw.io editor in your browser. This method can import [CSV data](https://www.drawio.com/docs/manual/insert/insert-from-csv/), [Mermaid diagrams](https://www.drawio.com/docs/manual/mermaid/) and fetch diagrams from URLs automatically. You can also configure default editor options for each of these actions.

**To use:** Install with `npx @drawio/mcp`

[Refer to the documentation](https://github.com/jgraph/drawio-mcp/blob/main/mcp-tool-server/README.md) for configuration and usage options.

## Skill + CLI

This method allows the *Claude Code* to generate `.drawio` files and optionally export them to PNG, SVG or PDF files. This requires [draw.io Desktop](https://get.diagrams.net/) to be installed.

[Refer to the documentation](https://github.com/jgraph/drawio-mcp/blob/main/skill-cli/README.md) for installation and usage instructions.

## Generate an embedded diagram URL

Provide Claude.ai with project instructions so that it can generate a draw.io [diagram embedded in a URL](https://www.drawio.com/docs/manual/export/export-to-url/) via Python, with no installation necessary. This supports the.drawio format as well as importing [Mermaid code](https://www.drawio.com/docs/manual/mermaid/) and [CSV data](https://www.drawio.com/docs/manual/insert/insert-from-csv/).

[Refer to the documentation](https://github.com/jgraph/drawio-mcp/blob/main/project-instructions/README.md) for setup and usage instructions.

## Related

- Train a different LLM with our [AI style reference](https://www.drawio.com/docs/reference/diagram-generation/style-reference/).
- Set [custom LLM backends](https://www.drawio.com/docs/reference/diagram-generation/configure-ai-options/)
- Learn more about how to [generate and validate draw.io diagrams with AI](https://www.drawio.com/docs/reference/diagram-generation/) in draw.io.
- [Export a diagram to a JSON file](https://www.drawio.com/docs/manual/export/export-to-json/).