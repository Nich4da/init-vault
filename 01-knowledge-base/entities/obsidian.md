---
type: entity
title: Obsidian
created: 2026-07-16
updated: 2026-07-16
tags: [tool, markdown, knowledge-management]
aliases: [Obsidian.md]
sources: ["[[llm-wiki-idea]]"]
---

# Obsidian

A local, file-based markdown knowledge app. In this pattern it is the **browsing
environment** — the human keeps Obsidian open on one side and the LLM agent on the
other, watching pages update in real time ([[llm-wiki-idea]]). Framing: *Obsidian is the
IDE, the LLM is the programmer, the wiki is the codebase.*

## Why it fits
- Native `[[wikilink]]` support — matches this vault's [[CLAUDE|linking rules]].
- **Graph view** shows the shape of the wiki: hubs, clusters, and orphan pages.
- Plain markdown files on disk, so the wiki is also just a git repo (free version history).

## Ecosystem features noted in the source
- **Web Clipper** — browser extension that converts web articles to markdown for `03-source-materials/`.
- **Attachment folder + "Download attachments" hotkey** — pulls a clipped article's images
  to local disk (e.g. `03-source-materials/assets/`) so the LLM can view them.
- **Marp plugin** — markdown-based slide decks generated from wiki content.
- **Dataview plugin** — dynamic tables/lists from YAML frontmatter (this vault adds
  frontmatter partly to enable this).

## Related
- Alternative search layer as the wiki grows: qmd (not yet set up here).
