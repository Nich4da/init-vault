---
type: source
title: LLM Wiki (the founding idea)
created: 2026-07-16
updated: 2026-07-16
tags: [meta, knowledge-management, llm, pattern]
source_file: "03-source-materials/llm-wiki-idea.md"
source_type: article
source_date: unknown
author: unknown
sources: []
---

# LLM Wiki (the founding idea)

> The idea file that defines this whole vault: LLMs incrementally build and maintain a persistent, interlinked markdown wiki instead of re-deriving knowledge from raw documents on every query.

## Summary
- Ordinary RAG re-discovers knowledge from scratch on every question — nothing accumulates. This pattern instead has the LLM **compile** knowledge once into a persistent wiki and keep it current. See [[persistent-wiki-pattern]].
- The wiki sits **between** you and the raw sources: a compounding artifact where cross-references, flagged contradictions, and synthesis already exist before you ask.
- Division of labor: the **human** curates sources, explores, and asks questions; the **LLM** does all summarizing, cross-referencing, filing, and bookkeeping.
- Three layers: immutable **raw sources**, the **LLM-owned wiki**, and the **schema** ([[CLAUDE|this vault's schema]]) that makes the LLM a disciplined maintainer.
- Three operations drive the lifecycle: **ingest, query, lint**. See [[ingest-query-lint]].
- Two navigation files: **00-home/index.md** (content catalog) and **00-home/log.md** (chronological journal).
- Tooling is optional/modular: [[obsidian]] as the browsing "IDE", a search engine like qmd once the wiki is large, Marp for slides, Dataview over frontmatter.

## Key takeaways
- The bottleneck in knowledge bases is **bookkeeping**, not reading or thinking — and that is exactly what LLMs do tirelessly and consistently. This is why the pattern works.
- Explorations should **compound**: good query answers get filed back into the wiki as new pages rather than vanishing into chat.
- The pattern is domain-agnostic (personal, research, book companion, team wiki, due diligence…) and every feature is opt-in.
- Spiritual ancestor: Vannevar Bush's [[memex]] (1945) — Bush couldn't solve *who does the maintenance*; the LLM is that answer.

## Entities & concepts touched
- [[persistent-wiki-pattern]] — the core method this source defines.
- [[ingest-query-lint]] — the three operations.
- [[obsidian]] — the recommended browsing environment.
- [[memex]] — the historical antecedent.

## Contradictions / open questions
- None yet — this is source #1, so there is nothing to contradict.
- Open: at what scale do we outgrow `00-home/index.md` navigation and want a real search tool (qmd)? Revisit around ~100 sources.
