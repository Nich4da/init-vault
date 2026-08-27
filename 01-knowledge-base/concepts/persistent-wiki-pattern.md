---
type: concept
title: Persistent Wiki Pattern
created: 2026-07-16
updated: 2026-07-16
tags: [knowledge-management, llm, pattern, rag]
sources: ["[[llm-wiki-idea]]"]
---

# Persistent Wiki Pattern

The core method of this vault: instead of retrieving raw chunks at query time (plain
RAG), the LLM **compiles knowledge once** into a structured, interlinked wiki and keeps
it current as new sources arrive ([[llm-wiki-idea]]).

## The problem it solves
Standard RAG (NotebookLM, ChatGPT file uploads, embedding retrieval) re-derives
knowledge from scratch on every question. Synthesis across many documents must be
reconstructed each time; **nothing accumulates** ([[llm-wiki-idea]]).

## The mechanism
- On **ingest**, the LLM reads a source, extracts what matters, and integrates it into
  the existing wiki — updating entity/concept pages, revising summaries, flagging
  contradictions, and strengthening or challenging the evolving synthesis.
- The wiki becomes a **persistent, compounding artifact**: cross-references, contradictions,
  and synthesis are already there before you ask a question.
- Knowledge is **compiled once and kept current**, not re-derived per query.

## Why it works
The hard part of a knowledge base is **bookkeeping** — cross-references, current summaries,
consistency across dozens of pages. Humans abandon wikis because maintenance cost grows
faster than value. LLMs don't get bored, don't forget a cross-reference, and can touch
~15 files in one pass, so maintenance cost approaches zero ([[llm-wiki-idea]]).

## Related
- Operated via [[ingest-query-lint]].
- Browsed in [[obsidian]].
- Descends in spirit from the [[memex]].
