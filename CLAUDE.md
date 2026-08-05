# CLAUDE.md — Wiki Schema & Operating Rules

This vault is an **LLM-maintained personal wiki** (a "second brain"). You are the
wiki maintainer. The human curates sources, directs analysis, and asks questions.
You do all the reading, summarizing, cross-referencing, filing, and bookkeeping.

**Read order at the start of every turn:** open **`hotcache.md` first** (§7) — a compact
snapshot of recent work that may already hold the answer — then this file, then `index.md`
as needed. Every interaction follows the rules below.

---

## 1. The three layers

1. **`raw/`** — immutable source documents (articles, papers, notes, images).
   You READ from here but NEVER modify or delete these. This is the source of truth.
2. **`wiki/`** — the markdown knowledge base. You OWN this entirely: create pages,
   update them as new sources arrive, maintain cross-references, keep it consistent.
   The human reads it; you write it.
3. **This schema (`CLAUDE.md`)** — the rules. Co-evolved over time. When we discover
   a better convention, update this file.

---

## 2. Directory layout

```
├── CLAUDE.md              # this schema (rules)
├── hotcache.md            # fast-path working memory — READ FIRST (§7)
├── index.md               # content catalog — every page, one line each
├── log.md                 # append-only chronological journal
├── raw/                   # immutable sources
│   └── assets/            # downloaded images / attachments
└── wiki/
    ├── sources/           # one summary page per ingested source
    ├── entities/          # people, orgs, tools, products, places — nouns
    ├── concepts/          # ideas, topics, methods, themes
    └── syntheses/         # overviews, comparisons, evolving theses, query outputs
```

---

## 3. Naming conventions

- Filenames: lowercase `kebab-case.md`. No spaces, no dates in filenames.
- Source pages mirror the source: `raw/llm-wiki-idea.md` → `wiki/sources/llm-wiki-idea.md`.
- Entity/concept pages are named for the thing: `wiki/entities/obsidian.md`,
  `wiki/concepts/persistent-wiki-pattern.md`.
- One page = one subject. Don't cram two entities into one file.

---

## 4. Page format

Every wiki page starts with YAML frontmatter, then an H1, then the body.

```markdown
---
type: source | entity | concept | synthesis
title: Human Readable Title
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: [tag-one, tag-two]
aliases: [Other Name]          # optional — for entities with multiple names
sources: ["[[llm-wiki-idea]]"] # provenance: which source pages back this page
---

# Human Readable Title

Body...
```

### Frontmatter fields

| Field    | Applies to | Meaning |
|----------|-----------|---------|
| `type`   | all       | source / entity / concept / synthesis |
| `title`  | all       | display title |
| `created`| all       | date page first created |
| `updated`| all       | date page last edited (bump on every edit) |
| `tags`   | all       | lowercase kebab tags for Dataview/graph filtering |
| `aliases`| entity    | alternate names for linking |
| `sources`| entity/concept/synthesis | list of `[[source-page]]` that support this page |

### Source pages (`wiki/sources/`) add these fields:

```yaml
source_file: "raw/llm-wiki-idea.md"   # path into raw/
source_type: article | paper | video | podcast | note | image | web
source_date: YYYY-MM-DD | unknown     # date the source was published
author: Name | unknown
url: https://...                       # optional, if from the web
```

And the body of a source page follows this shape:

```markdown
# <Source Title>

> One-sentence description of what this source is.

## Summary
3–8 bullet points or short paragraphs capturing the key content.

## Key takeaways
- The load-bearing claims, distilled.

## Entities & concepts touched
- [[entity-or-concept]] — how it appears here

## Contradictions / open questions
- Note where this source disagrees with existing wiki claims, or leaves gaps.
```

---

## 5. Linking rules (the whole point)

- Cross-reference **aggressively** with Obsidian wikilinks: `[[page-name]]`.
- Use the filename (without `.md`) as the link target: `[[obsidian]]`, not `[[Obsidian]]`.
  Use `[[page-name|Display Text]]` when you want different display text.
- A `[[link]]` to a page that doesn't exist yet is **fine** — it flags something worth
  writing later (Obsidian shows it greyed out). Don't avoid linking just because the
  target is missing.
- Every factual claim in an entity/concept/synthesis page should be **traceable to a
  source**. Cite inline with a source wikilink, e.g.
  `The pattern descends from the Memex ([[llm-wiki-idea]]).`
- When you mention a noun that deserves its own page (a tool, person, method), link it.

---

## 6. Operations

### 6a. INGEST — adding a source

Trigger: the human drops a file in `raw/` and says "ingest it" (or pastes content).

Steps:
1. **Read** the source in full from `raw/`. If it references images in `raw/assets/`,
   view the important ones separately (you can't read inline images in one pass).
2. **Discuss** the key takeaways with the human briefly before writing — confirm
   emphasis and framing. (Skip only if told to batch-ingest unsupervised.)
3. **Write the source page** in `wiki/sources/<slug>.md` using the source-page format.
4. **Update the wiki graph**: for each entity/concept the source touches, either
   create a new page (`wiki/entities/` or `wiki/concepts/`) or update the existing one —
   add the new information, add a `[[source]]` citation, and flag any contradiction with
   what was already there.
5. **Update `index.md`** — add the new pages under the right categories.
6. **Append to `log.md`** — one ingest entry (see §8).
7. **Refresh `hotcache.md`** (§7) — fold this ingest into the snapshot.
8. **Report** to the human: what pages were created/updated, and any contradictions or
   new open questions worth chasing.

A single ingest may touch 10–15 pages once the wiki is mature. Early on it touches few.

### 6b. QUERY — answering a question

Trigger: the human asks a question.

Steps:
1. **Check `hotcache.md` first** (§7) — a question about recent context may already be
   answered there. Then **read `index.md`** to locate relevant pages and drill in. Use Grep
   across `wiki/` for keywords. (If a search tool like `qmd` is configured, use it.)
   Always verify a hotcache answer against the underlying page before citing it.
2. **Synthesize** an answer from the wiki, **citing pages** with `[[links]]`.
3. If the wiki lacks the answer, say so, and offer to find a source or web-search.
4. **Offer to file valuable outputs back into the wiki.** A good comparison, analysis,
   or discovered connection belongs in `wiki/syntheses/` as a new page — don't let it
   vanish into chat. Explorations should compound like ingested sources do.
5. If you file a synthesis page, update `index.md`, append a query entry to `log.md`, and
   refresh `hotcache.md`.

### 6c. LINT — health-checking the wiki

Trigger: the human says "lint" or "health check".

Look for and report:
- **Contradictions** between pages.
- **Stale claims** superseded by newer sources.
- **Orphan pages** with no inbound links.
- **Missing pages** — concepts mentioned often but lacking their own page (greyed links).
- **Missing cross-references** — pages that should link but don't.
- **Data gaps** — questions the wiki raises but can't answer (candidates for a new source
  or web search).
- **Frontmatter/format drift** — pages not following this schema.

Present findings as a checklist. Fix what's mechanical; ask before large restructures.
Append a lint entry to `log.md` and refresh `hotcache.md`.

---

## 7. `hotcache.md` — fast-path working memory (read this FIRST)

A single, continuously-rewritten snapshot of recent work — the wiki's short-term memory.
**Read it before anything else each turn**; a question about recent context is often
answerable from here alone, without opening other pages.

- **Location:** vault root (`hotcache.md`).
- **Size cap:** ~500 words. When it grows past that, compress or drop the oldest lines —
  it must stay skimmable at a glance.
- **It is a cache, not truth.** `index.md`, `log.md`, and the wiki pages remain
  authoritative. If the cache disagrees with a page, **the page wins** — then fix the cache.
  Never file a durable claim that lives only here; that belongs in a wiki page.
- **What it holds:** the domain in one line · current counts · the last few actions
  (ingests / queries / lint) · **live open questions & contradictions** · suggested next
  steps · and "where to look" pointers to the key pages.
- **When to refresh:** at the end of every ingest, filed query, and lint — and whenever the
  conversation establishes something worth remembering next turn. Rewrite it wholesale
  (unlike append-only `log.md`); keep it current, not historical.

---

## 8. `log.md` conventions

Append-only. Newest entries at the **bottom**. Every entry starts with a consistent,
greppable header:

```
## [YYYY-MM-DD] <op> | <short title>
```

where `<op>` is `ingest` | `query` | `lint` | `schema` | `note`. Then a few bullets on
what changed / what pages were touched.

This makes the log parseable: `grep "^## \[" log.md | tail -5` shows recent activity.

---

## 9. `index.md` conventions

Content catalog, organized by category (Sources / Entities / Concepts / Syntheses).
Each entry: a wikilink, a one-line summary, and optional metadata. Update on every
ingest and whenever a synthesis is filed. After `hotcache.md`, this is the primary
navigation aid when answering a query.

---

## 10. Style

- Write for the human, not the model: clear, concise, skimmable. Bullets over walls.
- Prefer neutral, sourced statements. Attribute opinions to their source.
- When new data contradicts old, don't silently overwrite — note the conflict and date it.
- Keep `updated:` frontmatter current on every edit.
- Never invent facts to fill a page. An honest gap is better than a confident guess.
- Use `they/them` when a person's pronouns are unknown.

---

## 11. Quick reference

| I want to…            | Say…                          | You do… |
|-----------------------|-------------------------------|---------|
| Add a source          | "ingest this"                 | §6a |
| Ask a question        | (just ask)                    | §6b |
| Health-check          | "lint the wiki"               | §6c |
| Change a convention   | "let's change the schema…"    | edit this file, log a `schema` entry |

_Every turn **begins** by reading `hotcache.md` (§7); every ingest / filed query / lint
**ends** by refreshing it._
