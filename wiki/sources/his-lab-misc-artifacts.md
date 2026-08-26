---
type: source
title: HIS — misc codex-backup artifacts (predecessors, unlogged side-project)
created: 2026-08-16
updated: 2026-08-16
tags: [his, lab, active-build, data-gap]
source_file: "codex-backup/adopt_emr_opd_card.py + mockup_V1.js + Mockup_V2.json + report-import/ + label-preview/"
source_type: note
source_date: 2026-08-06
author: user + codex agent (parallel development workspace)
---

# HIS — misc codex-backup artifacts (predecessors, unlogged side-project)

> Leftover files from `/Users/nichada/Documents/codex-backup` that don't fit the main LAB
> Workbench / Clinic Master narratives but are worth a short record: two earlier-draft scripts,
> and one genuinely separate, previously-unlogged side project. Ingested 2026-08-16 as part of
> the same deep pass as [[his-lab-workbench-handoff]] and siblings.

## Predecessor scripts (superseded, not separately actioned)

- **`adopt_emr_opd_card.py`** — an earlier draft that clones the EMR `pcard`/`opd_card` structure
  (same CSS classes: `pcard-main`, `pcard-avatar`, `pcard-identity`, `pcard-chip`…) into a Lab
  received-tab workspace, patching `Lab_Biochem_initCraft_import.json`. This is a **direct
  predecessor** to `upgrade_lab_received_opd_card.py`, the script confirmed live and current in
  [[his-lab-specimen-status-session-aug16]] (dated 2026-08-16, ten days later). No separate
  action needed — the later script is the one to trust.
- **`mockup_V1.js`** (despite the `.js` extension, this is a JSON form export — top-level
  `Components`/`vue-ui` field named `create_biochemistry_order`) and **`Mockup_V2.json`**
  (standard `{fields, formConfig}` sdform export) — both read as earlier UI mockups/prototypes for
  the Bio order screen, dated before the Aug-13/14 Center Lab Order and Work Item architecture
  existed. Not deep-read field-by-field here; flagged as historical prototypes, superseded by the
  live Lab Biochem workspace covered in [[his-lab-bio-workspace]].

## Unlogged side project: drug-label printing (2026-08-06)

`report-import/` and `label-preview/` are **not related to LAB or Clinic Master** at all — they
belong to a small, separate pharmacy feature: printing drug-label stickers, apparently built via
Figma → `html.to.design`-style import (the same pattern already recorded in
[[his-lab-worklist-ui]] for the lab worklist mockup) and a SQL Factory + Report Factory pair.

- `report-import/backup-data_report-factory_drug-label-8x6-figma-final_2026_08_06.zip` +
  matching `.json` — a Report Factory module export for an "8x6 figma final" drug-label layout.
- `report-import/backup-data_sql-factory_drug-label-all-sigs_2026_08_06.zip` +
  `backup-data-module_sql-drug-label-all-sigs-2026_08_06.json` — a SQL Factory query named
  "drug-label-all-sigs" (likely: all dosage-instruction / sig lines for a prescription, feeding
  the label).
- `backup-data_sql-factory_2026_08_06_21_35_00.zip` / `backup-data-module_sql-Earn_admin-2026_08_06_21_35_00.json`
  — a general SQL Factory backup taken the same session, purpose not confirmed from filename alone.
- Two Figma background reference images at 1208×908 and 302×227 (the 1208×908 one is **empty, 0
  bytes** — a placeholder or failed export, not usable).
- `label-preview/` — a **live component's source**, split into `template.html`,
  `onCreated.js`, `onMounted.js`, `onUnmount.js`. The template renders one row per drug "sig"
  (usage instruction) read from a `getSigs()` accessor, inside a fixed 302×88px box matching the
  Figma background image dimensions above — this is the actual on-screen label preview widget, not
  just a mockup.
- `ฉลากยา(bg3).png` (33.9KB, at the `codex-backup` root, dated 2026-08-06) — almost certainly
  another background/reference image for the same drug-label work ("bg3" = background variant 3).

**This whole cluster was never read in this vault before** — [[report-factory]] and
[[report-factory-skill]] (the existing wiki pages for the Report Factory / SQL Factory system)
make no mention of drug labels. It sits alongside the existing [[report-latex]] (เวชระเบียน OPD
printing) as a second, separate report/printing effort, apparently done in one working session on
2026-08-06 and not touched again since (no later files reference it).

## Key takeaways

- Confirms a general pattern across this whole ingest: **file naming with version suffixes
  (`v1`/`v2`/`V1`/`V2`) is not reliable evidence of recency** in this workspace — already seen with
  `specimen_collection_status_api_v2.js` actually being the *older* file
  ([[his-lab-specimen-status-session-aug16]]). Always check file mtime and cross-reference against
  the dated handoff/session-memory narrative before trusting a filename's implied order.
- The drug-label side project is a genuine data gap: real artefacts exist (a live preview
  component, Figma assets, two Factory module exports) but no source page or index entry has ever
  pointed at them. Flagged for a dedicated ingest pass if the user wants to resume that work.

## Entities & concepts touched
- [[his-lab-specimen-status-session-aug16]] · [[his-lab-bio-workspace]] — the current, trustworthy
  versions of what the two predecessor scripts here draft.
- [[report-factory]] · [[report-factory-skill]] · [[report-latex]] — the existing Report/SQL
  Factory pages this drug-label work sits beside but was never linked into.
- [[his-lab-worklist-ui]] — the other place this vault already used a Figma → HTML mockup pattern.

## Contradictions / open questions
- Whether the drug-label feature is finished, abandoned, or paused is unknown — no later file in
  `codex-backup` references it again after 2026-08-06, and it's absent from
  `LAB_WORKBENCH_HANDOFF.md`/`LAB_SESSION_MEMORY.md` entirely. Ask the user directly rather than
  assuming either status.
- `mockup_V1.js`/`Mockup_V2.json` were not read field-by-field — if the Bio order screen's history
  matters later, these are the next files to open.
