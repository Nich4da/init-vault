---
type: concept
title: Ingest / Query / Lint
created: 2026-07-16
updated: 2026-07-16
tags: [workflow, operations, llm]
sources: ["[[llm-wiki-idea]]"]
---

# Ingest / Query / Lint

The three operations that drive the wiki's lifecycle ([[llm-wiki-idea]]). The exact
step-by-step procedures this vault follows are codified in [[CLAUDE|the schema, §6]].

## Ingest
Add a source. The LLM reads it, discusses takeaways, writes a source summary page,
updates entity/concept pages across the wiki, updates `00-home/index.md`, and appends to
`00-home/log.md`. A mature ingest can touch 10–15 pages. Prefer one-at-a-time with supervision;
batch-ingest is possible with less oversight.

## Query
Ask a question. The LLM reads `00-home/index.md` first, drills into relevant pages, and answers
**with citations**. Key insight: **file valuable answers back into the wiki** (as
[[persistent-wiki-pattern|synthesis pages]]) so explorations compound instead of vanishing
into chat. Outputs can be markdown, tables, Marp slides, or charts.

## Lint
Periodic health check. Look for contradictions, stale claims, orphan pages, missing
pages (concepts without their own page), missing cross-references, and data gaps that a
web search could fill. Also surfaces new questions and sources worth chasing.

## Related
- The pattern these operations serve: [[persistent-wiki-pattern]].
