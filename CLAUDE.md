# CLAUDE.md — Wiki Schema & Operating Rules

This vault is an **LLM-maintained personal wiki** (a "second brain"). You are the
wiki maintainer. The human curates sources, directs analysis, and asks questions.
You do all the reading, summarizing, cross-referencing, filing, and bookkeeping.

**Mandatory first action for every turn that touches this repository:** read only
**`00-home/hotcache.md` first** (§7), before inspecting any other repository file.
If it fully answers a read-only question, answer immediately without scanning more
files. For edits, uncertain claims, exact provenance, or safety-sensitive decisions,
continue with this file and then `00-home/index.md` or other sources as needed. If
Hot Cache reports an active conversation reset, read `00-home/handoff.md`
immediately after Hot Cache and before this file.

---

## 1. The three layers

1. **`03-source-materials/`** — immutable source documents (articles, papers, notes, images).
   You READ from here but NEVER modify or delete these. This is the source of truth.
2. **`01-knowledge-base/`** — the markdown knowledge base. You OWN this entirely: create pages,
   update them as new sources arrive, maintain cross-references, keep it consistent.
   The human reads it; you write it.
3. **This schema (`CLAUDE.md`)** — the rules. Co-evolved over time. When we discover
   a better convention, update this file.

---

## 2. Directory layout

```
├── README.md                    # folder map and starting point
├── CLAUDE.md                    # this schema (rules)
├── 00-home/
│   ├── hotcache.md              # fast-path working memory — READ FIRST (§7)
│   ├── handoff.md               # active clean-conversation reset handoff, when needed
│   ├── index.md                 # content catalog — every page, one line each
│   └── log.md                   # append-only chronological journal
├── 01-knowledge-base/
│   ├── sources/                 # one summary page per ingested source
│   ├── entities/                # people, orgs, tools, products, places — nouns
│   ├── concepts/                # ideas, topics, methods, themes
│   └── syntheses/               # overviews, comparisons, evolving theses, query outputs
├── 02-initcraft/
│   ├── skills/                  # snapshots of active initCraft-related skills
│   ├── skills-archive/          # older/uninstalled skill packages kept for reference
│   ├── governance/              # workspace rules and SDForm safety references
│   └── MIGRATION_MANIFEST.md    # artifact catalog and source provenance
├── Form-Builder/                # implementation artifacts grouped by file type
│   ├── SDForm/                  # every migrated JSON artifact
│   │   ├── backup/              # read-only, versioned Form reference snapshots
│   │   ├── form-factory/        # SDForm exports, JSON specifications/prototypes
│   │   ├── sdform_module/       # earlier HIS form/module JSON exports
│   │   ├── api-factory/         # JSON schemas and payload examples
│   │   ├── sql-factory/         # SQL Factory JSON exports
│   │   ├── report_factory/      # Report Factory JSON exports
│   │   └── tests-tools/         # JSON regression fixtures
│   ├── API/                     # every migrated JavaScript artifact
│   │   ├── backup/              # read-only, versioned API reference snapshots
│   │   ├── api-factory/         # server process bodies
│   │   ├── form-factory/        # lifecycle/button events and prototypes
│   │   ├── report_factory/      # report components/builders/tests
│   │   └── tests-tools/         # JavaScript builders and tests
│   └── seed/                    # every migrated Python artifact
│       ├── data-imports/        # import/reference-range builders
│       ├── draw_design/_gen/    # diagram generation helpers
│       └── tests-tools/         # Python builders, maintenance, validator
├── 02-his/
│   ├── data/                    # HIS/LAB datasets and source images
│   ├── data-imports/            # XLSX imports
│   ├── form-factory/            # non-JSON/JS Form Factory support files
│   ├── api-factory/             # API documentation and non-code assets
│   ├── sql-factory/             # SQL ZIP exports and non-JSON assets
│   ├── sdform_module/           # non-JSON support files from earlier modules
│   ├── report_factory/          # report templates, previews, references, ZIP/assets
│   ├── tests-tools/             # non-Python support files
│   ├── architecture/            # diagrams and interface models
│   ├── ui/                      # UI prototypes
│   ├── draw_design/             # draw.io diagrams and generators
│   └── handoff/                 # implementation handoff documents
└── 03-source-materials/         # immutable source documents
    ├── web-clips/               # immutable Obsidian Web Clipper source snapshots
    └── assets/                  # downloaded images / attachments
```

---

## 3. Naming conventions

- Filenames: lowercase `kebab-case.md`. No spaces, no dates in filenames.
- Source pages mirror the source: `03-source-materials/llm-wiki-idea.md` → `01-knowledge-base/sources/llm-wiki-idea.md`.
- Entity/concept pages are named for the thing: `01-knowledge-base/entities/obsidian.md`,
  `01-knowledge-base/concepts/persistent-wiki-pattern.md`.
- One page = one subject. Don't cram two entities into one file.

### Backup immutability

- `Form-Builder/SDForm/backup/` and `Form-Builder/API/backup/` are read-only
  reference libraries. Existing snapshots may be opened and copied, but never
  edited, deleted, renamed, moved, reformatted, or overwritten in place.
- New Form work belongs outside backup, normally in
  `Form-Builder/SDForm/form-factory/forms/`. New API process work belongs outside
  backup, normally in `Form-Builder/API/api-factory/processes/`.
- Never work directly on a file inside `backup/`; copy it to the appropriate
  non-backup destination first.
- Add a new backup snapshot only when the user explicitly requests an archive or
  template publication. Use a new versioned filename and preserve every existing
  snapshot unchanged.

### Misplaced-file decision gate

When a user-provided or newly discovered file appears to be in the wrong folder:

1. Inspect only enough metadata/content to classify it against this directory
   schema and `02-initcraft/MIGRATION_MANIFEST.md`.
2. Do not move, copy, delete, rename, edit, or update references yet, unless the
   user's current instruction already names the destination explicitly.
3. Warn the user with:
   - the current repository-relative path;
   - why it appears misplaced (extension, purpose, ownership, immutability, or
     category mismatch);
   - the recommended destination and any reasonable alternative;
   - the effect of keeping it in place versus relocating it.
4. Ask the user to choose: keep the current path, use the recommended path, or
   provide another path. The recommendation must be clear, but the user owns the
   placement decision.
5. After approval, check for basename/content collisions, relocate only the exact
   approved file, preserve provenance, and update affected references, index/log,
   Hot Cache, manifest, and checksums as applicable. Verify the final path.

Stronger storage rules still apply. Never remove or modify an immutable source or
an existing backup snapshot merely because it is misplaced; offer to preserve the
original and copy it to the approved working location. If the file may contain
credentials, secrets, session state, or production/patient data, stop and warn the
user without exposing its contents or adding it to the library.

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

### Source pages (`01-knowledge-base/sources/`) add these fields:

```yaml
source_file: "03-source-materials/llm-wiki-idea.md"   # path into 03-source-materials/
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

Trigger: the human drops a file in `03-source-materials/` and says "ingest it" (or pastes content).

Steps:
1. **Read** the source in full from `03-source-materials/`. If it references images in `03-source-materials/assets/`,
   view the important ones separately (you can't read inline images in one pass).
2. **Discuss** the key takeaways with the human briefly before writing — confirm
   emphasis and framing. (Skip only if told to batch-ingest unsupervised.)
3. **Write the source page** in `01-knowledge-base/sources/<slug>.md` using the source-page format.
4. **Update the wiki graph**: for each entity/concept the source touches, either
   create a new page (`01-knowledge-base/entities/` or `01-knowledge-base/concepts/`) or update the existing one —
   add the new information, add a `[[source]]` citation, and flag any contradiction with
   what was already there.
5. **Update `00-home/index.md`** — add the new pages under the right categories.
6. **Append to `00-home/log.md`** — one ingest entry (see §8).
7. **Refresh `00-home/hotcache.md`** (§7) — fold this ingest into the snapshot.
8. **Report** to the human: what pages were created/updated, and any contradictions or
   new open questions worth chasing.

A single ingest may touch 10–15 pages once the wiki is mature. Early on it touches few.

### 6b. QUERY — answering a question

Trigger: the human asks a question.

Steps:
1. **Check `00-home/hotcache.md` first** (§7). If it completely answers a
   read-only question and the user does not require exact provenance, current
   external facts, or safety-sensitive precision, answer from the cache and stop.
2. Otherwise, **read `00-home/index.md`** to locate relevant pages and drill in.
   Use Grep across `01-knowledge-base/` for keywords. Verify cached claims against
   their underlying page before citing them or using them to modify artifacts.
3. **Synthesize** an answer from the wiki, **citing pages** with `[[links]]`.
4. If the wiki lacks the answer, say so, and offer to find a source or web-search.
5. **Offer to file valuable outputs back into the wiki.** A good comparison, analysis,
   or discovered connection belongs in `01-knowledge-base/syntheses/` as a new page — don't let it
   vanish into chat. Explorations should compound like ingested sources do.
6. If you file a synthesis page, update `00-home/index.md`, append a query entry to `00-home/log.md`, and
   refresh `00-home/hotcache.md`.

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
Append a lint entry to `00-home/log.md` and refresh `00-home/hotcache.md`.

---

## 7. `00-home/hotcache.md` — fast-path working memory (read this FIRST)

A single, continuously rewritten summary of recent conversation and working state —
the wiki's short-term memory. **Read it before anything else each turn.** A question
about recent context may be answered from this file alone.

- **Location:** the home category (`00-home/hotcache.md`).
- **Hard size cap:** 500 words, including frontmatter. Compress or remove the oldest
  resolved context before saving anything longer.
- **Cache-only answers:** Answer directly from this file when it fully covers a
  read-only question and no exact citation, current external state, or high-stakes
  verification is required.
- **Escalation:** For edits, consequential decisions, contradictions, exact citations,
  or stale/uncertain claims, continue to the index and authoritative files.
- **It is a cache, not truth.** `00-home/index.md`, `00-home/log.md`, and the wiki pages remain
  authoritative. If the cache disagrees with a page, **the page wins** — then fix the cache.
  Never file a durable claim that lives only here; that belongs in a wiki page.
- **What it holds:** recent requests and outcomes · current decisions · changed paths ·
  active blockers/open questions · next steps · essential guardrails · pointers to
  authoritative files. Summarize; never copy the transcript.
- **When to refresh:** after an ingest, filed query, lint, repository change, or any
  conversation that changes current state, decisions, blockers, or next steps. Rewrite
  it wholesale (unlike append-only `00-home/log.md`) and recheck the word count.

---

## 8. `00-home/log.md` conventions

Append-only. Newest entries at the **bottom**. Every entry starts with a consistent,
greppable header:

```
## [YYYY-MM-DD] <op> | <short title>
```

where `<op>` is `ingest` | `query` | `lint` | `schema` | `note`. Then a few bullets on
what changed / what pages were touched.

This makes the log parseable: `grep "^## \[" 00-home/log.md | tail -5` shows recent activity.

---

## 9. `00-home/index.md` conventions

Content catalog, organized by category (Sources / Entities / Concepts / Syntheses).
Each entry: a wikilink, a one-line summary, and optional metadata. Update on every
ingest and whenever a synthesis is filed. After `00-home/hotcache.md`, this is the primary
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

_Every turn **begins** with `00-home/hotcache.md` (§7). Stop there when it fully
answers a safe read-only question; otherwise continue to authoritative files. Every
meaningful state change **ends** by refreshing the cache and confirming ≤500 words._

---

## 12. End-of-task context checkpoint

Before sending the final response for every completed repository task:

1. **Check context health.** Estimate whether the remaining conversation context
   is sufficient to continue reliably. Treat context as low when a context meter
   is near its limit, automatic compaction has occurred, earlier requirements are
   becoming uncertain, or recovering the task would require rereading many files.
   If unsure, treat the context as low.
2. **Refresh `00-home/hotcache.md`.** Record the completed outcome, important
   decisions, changed paths, verification performed, unresolved blockers, and the
   next step. Compress older resolved context and confirm the entire file remains
   at 500 words or fewer.
3. **If context is healthy,** finish normally. Do not recommend a new chat merely
   because the thread is long.
4. **If context is low,** stop starting additional work, finish proportional
   verification, and prepare a clean Git handoff:
   - inspect `git status` and relevant diffs;
   - stage only files owned by the completed task; never use `git add -A` in a
     dirty worktree;
   - commit the completed, verified task with a clear message, including the
     refreshed Hot Cache, then report the commit hash;
   - never include unrelated, pre-existing, user-owned, secret, generated, or
     unverified changes;
   - if task changes cannot be isolated safely, do not commit. Record the exact
     blocker and affected paths in Hot Cache and tell the user.
5. **Recommend a new chat only when context is low.** Tell the user the handoff is
   saved in `00-home/hotcache.md` and that the new chat must read it first.

Do not create a commit when the task is read-only, creates no repository changes,
is incomplete, or the user explicitly asks not to commit. Never amend or rewrite
an existing commit unless the user explicitly requests it.

---

## 13. Conversation reset handoff protocol

Use this protocol when the conversation becomes incoherent or materially
misunderstood: the user says the intent was misunderstood, corrections conflict,
the same requirement is misread again after clarification, the assistant cannot
state one coherent objective, or continuing would risk more incorrect edits.

1. **Stop implementation.** Do not keep editing from assumptions. Limit further
   actions to read-only diagnosis, preserving safe state, and writing the handoff.
2. **Acknowledge the mismatch plainly.** Restate confirmed intent and uncertainty
   once. If one short clarification fully resolves the issue and no work state is
   contaminated, continuation is allowed; otherwise trigger the reset.
3. **Activate `00-home/handoff.md`.** Set `status: active` and record the reset
   trigger, confirmed user intent, genuinely completed work, changed paths/Git
   state, verification, rejected or uncertain assumptions, unresolved decisions,
   and the exact first safe next step. Do not present guesses as confirmed intent.
4. **Refresh Hot Cache.** Add a prominent pointer to the active handoff, summarize
   why the reset is required, and keep the cache at 500 words or fewer.
5. **Preserve Git safety.** Follow §12. Never commit misunderstood, incomplete, or
   unverified implementation merely to create a handoff. Commit only safely
   isolated, completed work when the existing commit rules allow it.
6. **End the old conversation.** Tell the user to open a new chat and instruct it
   to read `00-home/hotcache.md` first, then `00-home/handoff.md`, restate the
   confirmed objective, and wait for confirmation before implementation.

After the clean chat resolves the task, change the handoff to `status: inactive`,
retain a concise resolution note or log entry, and refresh Hot Cache. Do not force
a reset for a harmless wording issue that was resolved immediately.
