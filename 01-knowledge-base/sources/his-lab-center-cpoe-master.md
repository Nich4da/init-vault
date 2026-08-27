---
type: source
title: HIS — Lab Center / CPOE master build
created: 2026-08-16
updated: 2026-08-27
tags: [his, lab, lis, cpoe, active-build]
source_file: "codex-backup/LAB_WORKBENCH_HANDOFF.md ('Lab Center / CPOE Master Work' section) + build_cpoe_item_import.py + build_center_order_master_bound.py"
source_type: note
source_date: 2026-08-13
author: user + codex agent (parallel development workspace)
---

# HIS — Lab Center / CPOE master build

> How the doctor-facing **Lab Center** CPOE screen (one screen, LAB + Xray items together) is
> dynamically bound to a live master collection, and the top-level LAB/Xray grouping bug found
> while doing it. Part of the same parallel `codex-backup` workspace as
> [[his-lab-workbench-handoff]]. Ingested 2026-08-16.

## Product direction agreed

1. **Lab Center is the single physician CPOE screen** — the doctor picks LAB and Xray items in
   one place.
2. The central order routes each selected item by its master `order_type`, `section_id`, and
   `room_code`; each lab then works its own worklist off that routing.
3. The established **Bio Order** behavior is the reference pattern: selection must save, reopen
   correctly in CRUD, and specimen must save with the order.
4. The catalog loads **dynamically from the CPOE master** at runtime — editing a master record
   changes future catalog display, but an already-submitted order keeps a snapshot of what was
   selected at order time.
5. `HM` (Hematology) and `HH` (Hematology-Homeostasis) stay **distinct routing codes** but render
   together under one UI tab labelled **Hematology**.

## Master data — verified live state (2026-08-13)

| Purpose | Form ID | Collection |
|---|---:|---|
| CPOE Item Master (Lab + Xray clone) | `6a7caae774a0be190cc30756` | `zdata_cpoe_order_lab_xray` |
| Center Lab Order test clone | `6a7cbdfc74a0be190cc3206c` | (configure/verify after JSON import) |
| Lab room / Section Master | `6a79986bd5218a5b6a26bd15` | `zdata_section_code` |
| Specimen Master | `6a79a797d5218a5b6a26bddc` | `zdata_specimen_code` |

`zdata_cpoe_order_lab_xray` had **1,605 active records**: `LAB` 830, `Xray` 775. No active record
was missing `item_code`/`item_name`/`order_type`/`section_id`. Five item codes are **intentionally
duplicated** across specimen variants (`C25`, `C25.1`–`C25.4`) — never identify a selection by
`item_code` alone; carry the master `_id` as `master_id` too. `c_specimen` was missing on 14 LAB
items (needs master-data review). Room mapping (`room_code`, **not `room_no`**) was present for
every section except one Pathology (`PA`) record:

| Section | Room code |
|---|---:|
| BG 70 · BB 50 · MY 41 · MB 40 · MI-OUT 31 · IM 30 · BC 10 · HH 22 · ML 21 · HM 20 · PA *(missing, 1 record)* | |

### Master field contract used in runtime code

```js
{ _id /* → master_id */, item_code, item_name, order_type /* 'LAB' | 'Xray' */,
  section_id, section_name, room_code, c_specimen, service_group,
  item_group /* deliberately == service_group in imported data */, item_desc,
  item_nhso_code, item_nhso_bkk_code, item_csmbs_code, tmlt_code, item_sub_code,
  sale_price, withdraw_price }
```

`c_specimen` on legacy/master rows can be an object, a JSON string, or a bare code string (e.g.
`"CD"`) — runtime normalization must handle all three and resolve to a `zdata_specimen_code`
snapshot.

## `build_cpoe_item_import.py` — the import workbook generator

Reads two source workbooks from `~/Downloads` (`cpoe_items_lab_fix.xlsx`, `cpoe_items_xray.xlsx`),
tags each row `order_type = LAB|Xray` by filename, and writes a merged, hand-rolled `.xlsx` (raw
OOXML via `zipfile`/`ElementTree`, no external library) to `CPOE_Item_Master_Import.xlsx`. Rows
with the most billing-code columns populated are sorted first, because *"initCraft's Import Excel
preview infers available columns from the first sample records."*

**⚠ Stale field name found in the script:** it still emits a column called **`room_no`**, mapped
from a hard-coded `ROOM_NO_BY_SECTION` dict — but the live master field is `room_code` (confirmed
above and independently in [[his-lab-workbench-handoff]]). The handoff explicitly flags this:
*"It currently emits `room_no`; update it to emit `room_code` before any re-import."* **This fix
had not been applied as of the 2026-08-13 section** — check `build_cpoe_item_import.py`'s current
`HEADERS` list before trusting any future re-run of this script.

## `build_center_order_master_bound.py` — the dynamic order-sheet patcher

Patches (string-replace, not template-render) a copy of
`Form-Builder/SDForm/sdform_module/EMR_form/lab_center_order.json` — **a file that lives in this vault**, not in
`codex-backup` — and writes the result to `Center_Lab_Order_Master_Bound.json`. This confirms the
two workspaces (this vault and `codex-backup`) already share files one-directionally: the codex
agent reads exported forms out of `Form-Builder/SDForm/sdform_module/EMR_form/` as its source of truth. That
directory currently also holds `Labcenter.json` (488KB) and `CPOE_Lab_Item.json` (44KB, opened in
the user's IDE earlier this session) and a newer `EMR.json` (248KB, Aug 13) — **none of these three
have been read/ingested yet**; flagged as a data gap below.

Key patch logic (both bound to `ITEM_MASTER_FORM_ID = '6a7caae774a0be190cc30756'`):

- **LAB order sheet (`s.loadLabCatalog`)** — adds a live `crudGetAll` against the Specimen Master
  (`6a79a797d5218a5b6a26bddc`) so specimen labels update without editing the form; normalizes
  `c_specimen` (object / JSON string / bare code) before snapshotting; groups items by
  `sectionCode|itemGroup`, with `HM`/`HH` **both mapped to tab code `HEM`** (label "Hematology")
  while keeping their real `section_id` per item.
- **Xray order sheet (`s.loadXrayCatalog`)** — new loader added wholesale (the widget had none),
  reading the same master filtered to `order_type === 'XRAY'`, with a hard-coded
  `xrayNames` map (`CTS`→Computed Tomogram, `CT`→CT scan, `DX`→General X-ray, …) as a label
  fallback when `section_name` is blank on the master row.

### Open bug fixed by this generator — top-level LAB/Xray separation

Before the fix, the catalog loader fed **all** master rows into `s.sections.lab` regardless of
`order_type`, so Xray tabs (Computed Tomogram, CT scan, General X-ray…) appeared under **LAB
ORDER**. Fix: each order-sheet widget now filters by its own expected order type
(`s.orderType === 'xray' ? 'XRAY' : 'LAB'`, uppercased comparison) before writing into
`s.sections[s.orderType]` instead of always into `s.sections.lab`.

Two earlier runtime fixes bundled into the same generator: `String(row.item_group || '').trim()`
guards against a non-string `item_group` throwing `trim is not a function`; and the tab label
fallback order is `row.section_name` → known Xray name map → source code, so Xray CT items don't
inherit the Lab Room resolver's `"ไม่ระบุหมวด"` label when their own `section_name` is empty.

## Key takeaways

- The **snapshot-vs-master distinction** here — catalog reads live, submitted orders keep what was
  selected at order time — is the same principle [[his-lab-module-plan]] flagged as missing
  (`sort_order`/master changes must not rewrite historical reports) but now actually implemented.
- `master_id` (not `item_code`) as the true selection key, because of intentionally duplicated
  codes like `C25.1`–`C25.4`, is a concrete answer to a question the plan never resolved.

## Entities & concepts touched
- [[his-lab-workbench-handoff]] — the parent handoff document and shared data-model decisions.
- [[his-lab-work-item-bridge]] — what happens to a Center order after it's submitted.
- [[his-lab-module-plan]] — superseded proposed data model; this is what was actually built.

## Contradictions / open questions
- `build_cpoe_item_import.py`'s `room_no`-vs-`room_code` staleness (above) — unresolved as of the
  source date; re-check before trusting a future regenerated import workbook.
- **Data gap:** `Form-Builder/SDForm/sdform_module/EMR_form/lab_center_order.json`, `Labcenter.json`, and the
  Aug-13 `EMR.json` in this vault have not been read/ingested despite being the direct input/output
  of this build script. Worth a dedicated follow-up ingest pass given their size (up to ~490KB).
- The "Center Lab Order test clone" (form `6a7cbdfc74a0be190cc3206c`) status is listed as
  "configure/verify after JSON import" — not confirmed complete as of this source.
