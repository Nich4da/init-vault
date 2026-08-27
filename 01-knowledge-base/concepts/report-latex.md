---
type: concept
title: Report Factory — LaTeX output (Nunjucks / Tectonic)
created: 2026-07-19
updated: 2026-07-19
tags: [initcraft, report-factory, latex, nunjucks, tectonic]
sources: ["[[report-factory-skill]]"]
---

# Report Factory — LaTeX output

> A **separate authoring model** inside [[report-factory|Report Factory]]: when `pdf_type = latex`,
> the report is a LaTeX document bound **server-side** with **Nunjucks** and compiled with
> **Tectonic** — it does **not** use `{{field}}` / `strtr` / `pdf_content` / `pdf_column` at all.

## When it applies
`pdf_type = latex`. The whole document is written in the **`pdf_latex`** code field (code editor).
The PDF-report content items and table columns are **ignored**. See [[report-factory]] for the
default (pdfmake) model.

## Pipeline (server-side)
```
click LaTeX → POST /v1/files/create-latex { reportId, params }
  → server loads report + runs pdf_sql → dataList
  → renderLatexTemplate (Nunjucks) binds values
  → tectonicCompile → PDF → streams blob back (no file stored, no url)
```
Code: client `SdReport.vue typeReport('latex')`; server `api-builder/.../TLatexReport.ts`
(`latexReport` / `tectonicCompile`) + route `services/v1/files-manage.ts`.

## Syntax (Jinja2-LaTeX → Nunjucks)
| in `pdf_latex` | meaning |
|---|---|
| `\VAR{expr}` | output a value (auto-escapes LaTeX specials) |
| `\BLOCK{stmt}` | logic: `for` / `if` / `set` / `endfor` / `endif` |
| `\#{comment}` | comment (not emitted) |

- Expressions are Nunjucks — filters (`| default`, `| length`), `loop.index` work.
- ⚠️ **No `{ }` nested in an expr** (Nunjucks reads it as a dict) — dot/filter only, e.g. `\VAR{a.b}`.

## Data context (reserved keys)
- **bare field name** = value from **`rows[0]`** (first row) — e.g. `\VAR{hn}` for a header.
- **`rows`** = all rows (array) — loop a table: `\BLOCK{for row in rows}…\VAR{row.x}…\BLOCK{endfor}`.
- **`params`** = report parameters.
- Coded fields (select/status) are already converted to display values (via `pdf_sql`'s form model).

## Escaping (fails silently)
- `\VAR{}` **auto-escapes** LaTeX specials (`\ { } $ & # _ % ~ ^`).
- ⚠️ **`params.*` is NOT auto-escaped** — always pipe `| tex`: `\VAR{params.date_from | tex}`.
- Opt out with `| raw` / `| safe` **only** when the value is real LaTeX (user value + `| raw` = injection).

## Thai
- **Word-break is automatic** — the server inserts glue via `Intl.Segmenter('th')`.
- **Font is the template's job** — add `\usepackage{fontspec}\setmainfont{Sarabun}` in the preamble;
  the font must exist in the backend build image (Tectonic = XeTeX).

## Gotchas
- **Save the report before render/Validate** — needs a `reportId` to load `pdf_sql` + permissions.
- **Validate button** compiles a draft; errors map to editor squiggles.
- Error contract: 404 no report · 403 permission · 400 render/bind fail (Nunjucks) · **422 compile
  fail** (Tectonic) → `{errors:[{line,message}], logTail}`.
- **10s timeout / ~1 GB mem** per compile → pre-aggregate in SQL, keep the template light.
- `\write18` / shell-escape is **off** — no external commands.

## Related
- Parent: [[report-factory]] · source: [[report-factory-skill]] · data: [[sql-factory]].
- Full generated syntax: `initcraft/public/LLM-Report.md` (Builder → Docs → Report Docs).
