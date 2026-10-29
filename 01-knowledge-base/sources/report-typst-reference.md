---
type: source
title: Report Typst Reference
created: 2026-10-26
updated: 2026-10-26
tags: [initcraft, report-factory, typst, thai-document, skill, reference]
sources: []
source_file: "03-source-materials/llm-typst.md"
source_type: note
source_date: unknown
author: user
---

# Report Typst Reference

> A user-provided reference for the Typst authoring mode in [[report-factory|initCraft Report Factory]], preserved unchanged from `/Users/nichada/Downloads/LLM-Typst.md`.

## Summary

- Report Factory Type = **Typst** uses the selected [[sql-factory|SQL Factory]] provider, writes a server-side `data.json`, and compiles a Typst template to PDF.
- Unlike pdfmake `{{field}}` binding or LaTeX Nunjucks `\VAR{}`/`\BLOCK{}`, the template imports `sdthai.typ` and reads `data`, `raw`, `rows`, and `params` directly.
- `data` contains schema-converted display values; `raw` is for arithmetic, dates, IDs, and structured originals; `rows` contains every SQL row; `params` contains Report Parameters.
- The helper library covers Thai dates/numerals/money/baht text, report and government page styles, long tables, sub-form tables, images, drawings, QR/barcodes, map widgets, HTML, charts, diagrams, role-aware redaction, and multiple SQL datasets.
- The recommended flow is select SQL → choose Typst → write/import template → Save once → Validate against real data and permissions → preview the Typst PDF.
- Typst is positioned for precise Thai official documents and complex multi-page layout; pdfmake remains the lower-code drag-and-drop option. Typst produces PDF, not Word.

## Key takeaways

- Treat Typst as a separate authoring model, not an extra `pdf_content` widget.
- Inspect actual SQL fields before authoring. Changing the provider can invalidate every field reference in the template.
- Use `#import "sdthai.typ": *`; choose `gov`, `report-page()`, or `sdthai` according to the page-control model.
- Database values are data, not injected Typst code, but literal Typst template text still needs Typst escaping.
- The reference defines operational limits: server fonts/packages only, no network during compile, scoped file access, timeout/memory/concurrency limits, and permission checks for additional datasets.

## Entities & concepts touched

- [[report-factory]] — gains the Typst output mode and authoring workflow.
- [[sql-factory]] — supplies the primary and optional additional datasets.
- [[initcraft]] — hosts Report Factory, schema conversion, permissions, and preview/download flow.

## Contradictions / open questions

- This task imported and structurally validated the documentation; it did **not** independently verify the reported compile timings, cache behavior, server package versions, or every helper against a live initCraft deployment.
- The reference names the UI field **Typst Code** but does not state its persisted `pdf_*` storage key. Do not invent that field name when editing raw Report records.
- The older field catalog still lists only `report / latex / temp`; it should be refreshed from the current live Report model before using it as a complete schema for Typst.
