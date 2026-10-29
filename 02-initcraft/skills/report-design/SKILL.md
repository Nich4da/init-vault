---
name: report-design
description: "Design or redesign data-rich reports, PDFs, formal documents, and report-like page or slide deliverables by defining audience, claims, hierarchy, page flow, tables, figures, visual rules, export assets, accessibility, and print QA. Use before implementation when composition materially affects understanding; use report-factory for initCraft binding and runtime authoring rather than treating this skill as implementation authority."
---

# Report Design

Turn source content and data into a design direction that can be reviewed, implemented, and regenerated. Own the information architecture and presentation contract; do not invent domain meaning, SQL fields, clinical rules, or permission to change a live report.

## Start with the decision

Resolve enough context to design intentionally:

- audience and the decision or action the report must support;
- target medium and output: print/PDF, HTML, Word, slide deck, or several;
- paper or canvas size, orientation, page limit, language, branding, and accessibility needs;
- available content, datasets, required sections, and authoritative source fields;
- privacy or sensitivity constraints and whether examples must be synthetic;
- existing report behavior or content that must be preserved.

Ask only for missing choices that materially change the result. Mark assumptions and open decisions instead of presenting them as confirmed requirements.

## Design workflow

1. **Inventory evidence and constraints.** Separate authoritative content, user-confirmed requirements, existing working behavior, and proposals. For a redesign, state `keep`, `change`, and `do not infer` boundaries before altering the hierarchy.
2. **Define the content model.** Write the report's primary question, strongest claims, section order, table or figure jobs, supporting notes, and appendix material. Start with the reader's task, not a list of charts.
3. **Choose a layout direction.** When alternatives would clarify a real tradeoff, propose a small set of meaningfully different directions and obtain the user's choice. Do not create variants merely for decoration. Treat a direction as confirmed only after explicit approval.
4. **Write the design contract.** Specify page sequence, grid, spacing, typography, color semantics, headers/footers, tables, figures, empty/error states, pagination, responsive or landscape adaptations, and locked versus flexible details.
5. **Create a safe concept or mockup when useful.** Use synthetic or redacted data. Preserve semantic reading order and show dense, sparse, long-text, multi-page, and no-data conditions that could break the layout.
6. **Prepare the implementation handoff.** Map each visual slot to content/data, dimensions, format, binding responsibility, fallback, source/caveat placement, and regeneration path. Keep report design separate from runtime data binding.
7. **Verify at final size.** Render the actual target format and inspect every page or slide. Check clipping, overlap, page breaks, repeated headers, line wrapping, font fallback, grayscale/print legibility, accessibility, and content completeness.

For reports with several meaningful figures or diagrams, read [figure packaging and export](references/figure-packaging-and-export.md) before composing pages.

## Composition rules

- Lead with the report title, context, and strongest useful finding or required action.
- Give every section one clear job and maintain an obvious reading order.
- Place explanatory text beside the table or figure it explains; use insight titles when the content supports a claim.
- Prefer focused figures and small multiples over a dashboard mosaic copied into a page.
- Use tables for exact lookup and comparison. Specify units, alignment, number/date formatting, repeated headers, totals, row grouping, and page-break behavior.
- Use color sparingly and consistently. Never make color the only carrier of status or meaning; verify monochrome output when printing matters.
- Keep type, annotations, legends, and touch targets readable at final output size rather than only on a zoomed canvas.
- Formal, government-document, clinical, editorial, and executive styles are selectable directions, not universal defaults. Follow the user's approved style and applicable organizational standard.
- Preserve sources, caveats, and alternative descriptions with each meaningful visual. Avoid screenshots when a durable vector or high-resolution asset can be regenerated.
- When an interactive or animated story must become static, design a paced panel or key-frame sequence that preserves the argument.

## Required design handoff

A completed report-design handoff should make these items explicit:

- purpose, audience, target medium, page/canvas constraints, and approval status;
- content hierarchy and page/slide sequence;
- visual tokens and layout system;
- table/figure inventory with each item's job and data dependency;
- privacy, accessibility, source, caveat, and fallback requirements;
- export asset set and regeneration path;
- verification performed, unresolved decisions, and implementation boundaries.

Do not call a mockup production-ready when only appearance was checked. Static visual QA does not prove data binding, permissions, runtime rendering, or export behavior.

## initCraft boundary

For initCraft Report Factory work, use this skill to establish or reconcile the approved design. Then use `report-factory` for `pdf_sql`, parameters, `pdf_content`, `pdf_column`, pdfmake binding, Word, LaTeX, Typst, Report Items, permissions, validation, and runtime debugging.

Never treat a design approval as authorization to edit, Save, Publish, replace, or delete a live Form/API/Report/SQL artifact. Apply the artifact ownership and write gate immediately before any live mutation.
