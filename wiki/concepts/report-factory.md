---
type: concept
title: Report Factory (PDF/Excel/Word/LaTeX reports)
created: 2026-07-17
updated: 2026-08-18
tags: [initcraft, report-factory, pdfmake, his, deploy-pipeline]
sources: ["[[report-factory-skill]]", "[[his-med-dispense-voucher-report]]", "[[his-medical-record-report]]"]
---

# Report Factory (PDF/Excel/Word/LaTeX reports)

The fourth [[initcraft|initCraft]] [[form-factory|factory]] (`/module/report-factory`). A
**report = one record** (seed model `sdform/report-model.json`); the renderer `SdReport.vue`
reads it, runs a [[sql-factory|SQL Factory]] query for rows, and builds a pdfmake `docDefinition`
→ **PDF / Excel / Word / LaTeX**. Authoritative reference = [[report-factory-skill]] (from the
actual source); this page is the working summary + the **hands-on html gotchas** from the
[[his-med-dispense-voucher-report|ใบฎีกาจ่ายยา report]].

## Render pipeline
`createReport(reportId, type)` → `sdformGetOne` → permission gate → (if required `pdf_params`
missing, prompt dialog) → `typeReport` splits by output:

| Output | Where | Supports |
|--------|-------|----------|
| **PDF** | client (pdfmake) | all widgets |
| **Excel** | client (XLSX) | **only `table` / `subtable` / `sub_report`** (text/image/qr/barcode skipped) |
| **Word** | server, from `pdf_temp` `.docx` template | template merge |
| **LaTeX** | server (Tectonic) | separate model → [[report-latex]] |

## 🔑 Binding = `{{column}}` (the heart)
The SQL rows become a dict `{ '{{hn}}':'123', … }` (via `value2Path`); every `content_value`
is run through **`strtr()`** (two-pass) so each `{{col}}` is replaced by the real value.
- `{{field}}` must match the **exact SQL column name** — one typo = **silent blank**.
- `pdf_form_id` (auto-filled from `pdf_sql`) only **converts coded values → display values**;
  it does *not* fetch data.
- ⚠️ **Row scope:** `text/html/image/qrcode/barcode/sub_report` use **row[0] only**. Only a
  **`table`** iterates every row; `subtable` iterates a nested array; `sub_report` inlines
  another report.
- ⚠️ **`content_var` (Variable Name) is inert at runtime** — a builder label only. Never rely on
  it to bind data; bind with `{{field}}`.

## The two-layer model (the #1 builder gotcha)
`Report Content` and `Table (Column Setting)` are **different layers**:
- **Report Content** (`pdf_content`, drag-orderable) = the ordered body *sequence*. Widgets:
  `text` · `html` · **`table`** · `subtable` · `image` · `qrcode` · `barcode` · `sub_report`.
- **Table Column Setting** (`pdf_column`) = the *columns* a `table` widget renders (also the
  Excel columns).

> A table with a variable number of rows **cannot** be built in html — place a `table` widget in
> Report Content, then define its columns in Table Column Setting.

### Column fields (`pdf_column`, per column)
`col_field` (pick a variable from `pdf_sql`) · `col_label` (header) · `col_alignment` ·
`col_width` (blank = `*`) · `col_format` (`num/num1/num2/date/datetime/boolean`) · `col_sum`
(`totalOnly` = bold total row) · `col_group` (group-header row on value change) · `col_html` ·
`col_value` (custom template, e.g. `{{a}} → {{b}}`) · `col_expressions` (JS per cell, sandboxed →
exposed as `{{expressions}}` for `col_value`) · `col_fillcolor`.

**Header-now, data-later:** set **`col_label`** now; leave **`col_field`** = *Please Select* and
fill it after `pdf_sql` is wired — the header shows regardless of data.

### Table Layout (`pdf_tb_layout`)
`noBorders` · `headerLineOnly` · `lightHorizontalLines`; the **default (empty)** = pdfmake full
grid (the UI's "Table"). Custom multi-row/grouped headers via `pdf_tb_header` (pdfmake JSON array;
cells `{ text, bold, alignment, fillColor, colSpan, rowSpan }`, `{}` for spanned placeholders).

## The `html` widget → pdfmake gotchas (hard-won)
The `html` widget converts HTML via **html-to-pdfmake → pdfmake** (not a browser). So:
1. **Thai text uses the bundled `THSarabun` font, not CSS** — chase Thai glyph issues in pdfmake.
2. **CSS `padding`/`margin` on `<td>` is ignored** for horizontal position → set position by
   **width**: `<colgroup><col style="width:40%"></colgroup>`.
3. **Use `<table>` for columns** — float/flex don't work in pdfmake.
4. **Table overflows the page** when all columns are `Auto`. Fix: give the long column **`Width = *`**
   (absorbs remainder + wraps) and fix the rest; or landscape; or shrink font/margins.
5. **Bold** = `font-weight:bold` (on `<table>`, a `<td>`, or `<span>`/`<b>`).
6. **Working header pattern:** `<table>` + `<colgroup>` + `border:none` on every `<td>` +
   `line-height:1`; offset a row by leaving a whole empty cell (not padding).

## Widgets with special rendering
- **qrcode** → pdfmake native `{ qr: value, fit }`.
- **barcode** → CODE128 PNG dataURL via JsBarcode (`displayValue:false`) — **bars only, no text**.
- **subtable** → `content_value` is JSON `{ subTableField, column[], header[], widths[], alignment[] }`
  over an array nested in the record.
- **sub_report** → `content_value` = another reportId; its content+images are concatenated inline
  (page setup skipped for the sub).

## Parameters (`pdf_params`)
`param_var` · `param_label` · `param_default` (**`date()` = today**) · `param_required` ·
`param_type` (`text/number/date/datetime/boolean/form`; `form` chains `param_sform` / `param_svalue`
/ `param_slabel`). Required params prompt a dialog before render.

## Page setup (`docDefinition`)
`THSarabun` default @ `pdf_fontsize` (14) · `pdf_orientation` · `pdf_page_size` (A0–A10/LETTER/…/
`custom` → `pdf_custom_size` w/h pt) · margins `pdf_ml/mt/mr/mb` (need all 4, else 20) · `pdf_title`
(`firstPage` vs `everyPage` → +25 top margin) · footer `Page X of Y` (`pdf_page_num`) + print date
(`pdf_page_date`) · `pdf_watermark` (opacity 0.1, 45°) · `pdf_bg` (cover). Sharing: `pdf_share`
(`public/private/assign` → `pdf_assign_roles`).

## 🆕 Saving ≠ live — the publish chain (confirmed 2026-08-18)
A report edit does **not** reach a real deployed app just by saving in Report Factory. Confirmed
chain for [[his-medical-record-report]]'s report: **Report Factory (edit/preview)** → bound into a
**ListView "Report Items" widget** inside a target **SDForm** (e.g. the Patient form) → published
via **App Factory** → live in the deployed app (e.g. `QSNICH`, a separately-branded instance at
its own subdomain). Evidence: Report Factory's own "Preview" button always reflected the latest
saved field (`{{prename_text}}` resolved correctly there), but the *same* report previewed from
inside the SDForm's "Report Items" widget — and the live deployed app — both showed the literal
unresolved tag, even after a hard refresh (ruling out plain browser cache). Leading theory: the
Report Items widget and/or the deployed app cache a compiled report template separately, frozen
from before the field existed, and don't auto-resync when the underlying report/SQL changes.
**Unresolved as of 2026-08-18** — untested fix: deselect/reselect the report in the widget's
"Report" dropdown to force a resync. Any future report-field change should be checked at all
three layers (Report Factory preview, the SDForm widget preview, the live app), not just the
first.

## Gotchas (quick list)
1. No `pdf_sql` → other tabs stay hidden + nothing binds.
2. Wrong `{{field}}` name = silent blank.
3. text/qr/barcode use **row[0] only** — need many rows → `table`.
4. `content_var` has no runtime effect.
5. Excel skips non-table content.
6. Editing `report-model.json` needs a **re-import** (builder reads options from the DB).
7. **Saving in Report Factory ≠ live** — a "Report Items" widget bound to a form's ListView (and
   the deployed app beyond it) can keep serving a stale cached template; see the publish-chain
   section above. Preview inside Report Factory itself is not proof the live app matches.

## Related
- Source of truth: [[report-factory-skill]] · LaTeX model: [[report-latex]].
- Worked example: [[his-med-dispense-voucher-report]] · data: [[sql-factory]] / [[erp-mongodb]] (`his`).
- Skill: `initcraft-report-factory` (+ `initcraft-build-report`). Platform: [[initcraft]].
- Publish-chain + still-open template-cache bug, in practice: [[his-medical-record-report]].
- App-level publish step: [[module-packages]] (App Factory registry).
