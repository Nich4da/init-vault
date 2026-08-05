---
type: source
title: Report Factory Skill (SKILL.md + references)
created: 2026-07-19
updated: 2026-07-19
tags: [initcraft, report-factory, pdfmake, latex, skill, reference]
sources: []
source_file: "HIS/report_factory/SKILL.md"
source_type: note
source_date: 2026-07-19
author: user
url:
---

# Report Factory Skill (`SKILL.md` + `references/`)

> An internal **skill doc-set** for [[initcraft|initCraft]]'s [[report-factory|Report Factory]],
> reverse-engineered from the actual renderer source (`SdReport.vue`, `TLatexReport.ts`). Four
> files under `HIS/report_factory/`: `SKILL.md` (workflow) + `references/{binding,fields,latex}.md`.
> This is the **authoritative** reference — it supersedes the earlier hands-on notes where they differ.

## Summary
- **A report = one record** in the Report Factory form (seed model `sdform/report-model.json`).
  `SdReport.vue` reads the record → runs `pdf_sql` → gets rows → builds a pdfmake `docDefinition`
  → outputs **PDF / Excel / Word / LaTeX**.
- **Data source is always [[sql-factory|SQL Factory]]** (`pdf_sql`). No query = no data. Selecting
  `pdf_sql` **gates the other tabs** (hidden until set) and auto-fills `pdf_from` + `pdf_form_id`.
- **Binding = `{{column}}`** replaced by `strtr()` (two-pass) from the SQL row dict built by
  `value2Path` — `pdf_form_id`'s schema converts coded values → display values (it does *not*
  fetch data). `{{field}}` must match the **exact SQL column name**.
- **Row scope:** `text/html/image/qrcode/barcode/sub_report` use **row[0] only**; only **`table`**
  iterates every row (columns from `pdf_column`); `subtable` iterates a nested array; `sub_report`
  inlines another report's content.
- ⚠️ **`content_var` (Variable Name) is NOT used at render time** — design-time label only. Bind
  with `{{field}}`, never `content_var`.
- **LaTeX is a separate authoring model** — see [[report-latex]].

## Key takeaways
- **Render pipeline** (`createReport`): `sdformGetOne` → permission gate → (required `pdf_params`
  dialog) → `typeReport` splits **pdf** (client pdfmake) / **excel** (client XLSX) / **word**
  (server, from `pdf_temp` .docx) / **latex** (server, Tectonic).
- **Output support differs:** PDF = all widgets. **Excel = only `table`/`subtable`/`sub_report`**
  (text/image/qr/barcode silently skipped). Word = `.docx` template. LaTeX = Nunjucks (see below).
- **Column model (`pdf_column`, per column):** `col_field` (pick a variable from `pdf_sql`) ·
  `col_label` · `col_alignment` · `col_width` (blank = `*`) · `col_format`
  (`num/num1/num2/date/datetime/boolean`) · `col_sum` (`totalOnly` = bold total row) · `col_group`
  (group-header rows on change) · `col_html` · `col_value` (custom template) · `col_expressions`
  (JS per cell, sandboxed → exposed as `{{expressions}}`) · `col_fillcolor`.
- **`col_expressions` flow:** `strtr` fills `{{}}` first → `new Function('row', …)` sandbox eval
  → result exposed as `{{expressions}}`, usable inside `col_value`.
- **Content widgets** (`pdf_content`, drag-orderable): `text` · `html` (mini editor) · `table`
  (no value — data from `pdf_column`) · `subtable` (JSON `{subTableField,column,header,widths,alignment}`
  over a nested array) · `image` · `qrcode` (pdfmake native `{qr}`) · `barcode` (CODE128 PNG via
  JsBarcode, **bars only, no text**) · `sub_report` (a reportId to inline).
- **Parameters (`pdf_params`):** `param_var`/`param_label`/`param_default` (`date()` = today)/
  `param_required`/`param_type` (`text/number/date/datetime/boolean/form`; `form` chains
  `param_sform`/`param_svalue`/`param_slabel`).
- **Page setup → docDefinition:** `THSarabun` default font @ `pdf_fontsize` (14); `pdf_watermark`
  opacity 0.1 / 45°; `pdf_orientation`; `pdf_page_size` (A0–A10/LETTER/…/custom → `pdf_custom_size`
  w/h pt); margins `pdf_ml/mt/mr/mb` (need all 4, else 20); `pdf_title` `firstPage` vs `everyPage`
  (+25 top margin); footer `Page X of Y` (`pdf_page_num`) + print date (`pdf_page_date`); `pdf_bg` cover.
- **Editing the seed model needs a re-import:** builder reads field options from the **DB**, not
  `report-model.json` directly.

## Entities & concepts touched
- [[report-factory]] — the concept page this source now authoritatively backs (updated).
- [[report-latex]] — the separate LaTeX/Nunjucks/Tectonic output model (new page from `references/latex.md`).
- [[sql-factory]] — the mandatory data source (`pdf_sql`); `col_field` reads its `sql_options.variable`.
- [[his-med-dispense-voucher-report]] — the worked example whose `{{}}` placeholders this explains.
- [[initcraft]] — the platform; Report Factory is its 4th factory.

## Contradictions / open questions
- **Table Layout options:** `references/fields.md` lists `pdf_tb_layout` = `noBorders /
  headerLineOnly / lightHorizontalLines` only — the earlier page also listed a **"Table" (full
  grid)** option. Likely the *default/empty* `pdf_tb_layout` = pdfmake's full-grid layout, and the
  three named values strip borders. Minor — worth a UI check.
- **`content_var` misconception corrected** — earlier material implied it might bind data; the
  source confirms it is inert at runtime.
- Full generated syntax reference lives at `initcraft/public/LLM-Report.md` (Builder → Docs →
  **Report Docs**) — not ingested here; a candidate if deeper coverage is needed.
