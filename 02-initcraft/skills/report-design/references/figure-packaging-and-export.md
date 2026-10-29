# Figure Packaging and Export

Read this reference when a report, PDF, document, or deck contains several meaningful charts, diagrams, maps, table-graphics, insets, or interactive-to-static adaptations.

## Inventory before layout

Create one row per visual asset:

| Field | Record |
|---|---|
| ID and page/slot | Stable name and intended placement |
| Job | Question answered or claim supported |
| Source/data shape | Authoritative input, fields, grain, filters, and date |
| Encoding | Chart, table-graphic, diagram, map, image, or panel sequence |
| Dimensions | Final width, height, aspect ratio, and minimum readable size |
| Annotation | Insight title, labels, units, legend, callouts, and uncertainty |
| Accessibility | Alternative description, non-color cues, and reading order |
| Provenance | Source line, caveat, freshness, and permission/privacy boundary |
| Output | SVG, PNG, PDF, embedded HTML, or another required asset |
| Fallback | Static or reduced-motion version when applicable |
| Status/QA | Draft, approved, exported, and final-size checks |

Keep shared scales, status colors, units, date formats, and vocabulary consistent across assets. A visual belongs in the report only when its job is distinct and useful.

## Choose durable outputs

- Prefer SVG for vector web and print workflows that preserve it.
- Use high-resolution PNG for office or slide workflows with inconsistent SVG support.
- Use PDF when the downstream composition retains vector PDF pages reliably.
- Keep captions and source notes as editable text when the target medium permits.
- Preserve the chart/diagram source or generation input alongside the rendered asset when regeneration matters.
- Use screenshots only when the source cannot provide a stable export and the limitation is recorded.

For browser/HTML-first reporting, semantic HTML and CSS printed through a browser engine is usually a practical composition path. For PowerPoint or Google Slides, generate assets first and place them with explicit page geometry. These are implementation options, not mandatory design choices.

## Static adaptation

When adapting animation, interaction, WebGL, particles, or scrollytelling:

1. identify the claim made by each important state;
2. export the first, selected key, and final states needed to preserve that claim;
3. add arrows, labels, focus states, or a panel sequence so the static version remains understandable;
4. provide a reduced-motion or non-interactive fallback;
5. verify that the PDF or slide version does not depend on hover, timing, or hidden controls.

Keep generated imagery, data overlays, captions, and source notes as separate layers whenever the medium allows it.

## Final-size QA

Inspect the actual exported deliverable, not only the authoring canvas:

- every figure appears in the intended order and slot;
- text, annotations, legends, and labels remain readable at normal view/print size;
- no figure is clipped, stretched, unexpectedly rasterized, or split across pages;
- color semantics remain consistent and understandable in grayscale;
- source lines, caveats, units, and alternative descriptions are present;
- tables repeat headers and handle long cells, empty rows, totals, and page breaks;
- static fallbacks preserve the original claim;
- assets can be regenerated when data changes.
