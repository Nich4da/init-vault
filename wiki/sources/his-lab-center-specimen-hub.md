---
type: source
title: HIS — Center Specimen Hub (paused prototype, 3 build attempts)
created: 2026-08-16
updated: 2026-08-16
tags: [his, lab, lis, active-build, known-issue]
source_file: "codex-backup/LAB_WORKBENCH_HANDOFF.md ('Center Specimen Hub' section) + build_lab_center_specimen_hub.py + build_lab_center_specimen_hub_app_v3.py + rebuild_lab_center_specimen_hub_widgets.py"
source_type: note
source_date: 2026-08-13
author: user + codex agent (parallel development workspace)
---

# HIS — Center Specimen Hub (paused prototype, 3 build attempts)

> A UI where central Lab Center staff inspect and forward specimens to the destination lab
> section, sitting between [[his-lab-center-cpoe-master]] (order creation) and
> [[his-lab-work-item-bridge]] (per-lab work queue). **Three successive code generators** were
> tried for the same screen; only the third is considered safe. Ingested 2026-08-16.

## Intended workflow

```text
Center Lab Order saved
  → appears in Center Specimen Hub "รายการรวมตรวจ specimen"
  → staff presses "ตรวจ specimen" → record moves to "ตรวจ specimen"
  → staff checks the specimen/trick sheet
  → presses "Specimen ครบ — ส่งต่อห้อง Lab" → record moves to "ส่งต่อห้อง Lab แล้ว"
  → (later) a work-item process releases the target lab's record as waiting_receive
```

Central status fields on the Center Order record: `central_specimen_status`
(`awaiting_check | checking | forwarded`), `central_checked_at/by`,
`central_forwarded_at/by`. `lab_no` stays on the record; generated separately.

## Three generators, one target screen

| Script | Output | Technique | Status |
|---|---|---|---|
| `build_lab_center_specimen_hub.py` | `Lab_Center_Specimen_Hub.json` | one hand-written `vue-ui` (Components) block — full custom Vue: `el-tabs` (queue/inspect/forwarded), hand-rolled CSS (`.lch-*`), direct `crudGetAll`/`crudUpdate` calls via `field.globalUserState` | **Do not use** — caused a `SDCustomContent` render error (`'getOwnPropertyDescriptor' on proxy: trap returned descriptor for property 'activeTab'…`) |
| `build_lab_center_specimen_hub_app_v3.py` | `Lab_Center_Specimen_Hub_APP_V3.json` | second `vue-ui` attempt — simplified single-list-with-tabs layout (`s.view` state instead of 3 separate tab bodies), same direct-API style | Not confirmed safe; the handoff does not name it as the fix, so treat as superseded by the widget rebuild below |
| `rebuild_lab_center_specimen_hub_widgets.py` | `Lab_Center_Specimen_Hub_WIDGETS_V2.json` | **native `list-ui` (ListView) widgets only, no `vue-ui`** — one ListView per tab (queue/checking/forwarded), Thai labels via `customValue` mustache bindings (`{{patientNameLabel}}` etc. — **plain field substitution only, no JS expression evaluation**), row actions (`action_set_checking`, `action_forward`) as small inline scripts calling `crudUpdate` on the Center Order form directly | **The safe version** — this is what got imported into live forms |

All three targeted the same source form: `Lab_Biochem_initCraft_import.json`, and the same
provider: Center Lab Order (`6a75a7810796231c653df996`, `FORM` type).

### Why `customValue` mustache, not expressions

The widget rebuild's inline comment/pattern (confirmed independently in
[[his-lab-work-item-bridge]]'s `lab_center_specimen.json` notes) is explicit: ListView
`detailContent` templates render `{{fieldName}}` but **do not evaluate JS expressions** inside
`{{ }}`. Every dynamic value (specimen manifest, formatted dates, patient initial) must be
precomputed into a named field via `customValue.expressions` — writing `{{patient_name||'-'}}`
directly in a template displays that string literally instead of evaluating it.

## Live forms created from these imports (as of 2026-08-13 18:20 ICT)

| Form ID | Type | Table | State |
|---:|---|---|---|
| `6a7da2b48d398c11cf2fe85b` | `form_db` | `zdata_center_approve_specimen` | early import, disabled |
| `6a7da5918d398c11cf2fe862` | `form_db` | generated zdata table | early import, disabled |
| `6a7da6ec8d398c11cf2fe865` | `form_ui` | none | newest app form, **enabled** — this is the one under test |

## Verified live data (read-only Mongo check, 2026-08-13)

- Center Order form: `6a75a7810796231c653df996` — "Center Lab Order Test"; collection
  `his.zdata_lab_center_order`; **52 records** at check time; `data_sharing: public`, enabled.
- The V2 ListViews correctly point at this provider (`formId: '6a75a7810796231c653df996'`,
  `providerType: 'FORM'`, first tab intentionally `where: ''` unfiltered). **The user-reported
  "รายการรวมตรวจยังเป็น 0" was confirmed not caused by missing data or a bad first-tab filter** —
  data exists and is reachable by the same query shape elsewhere.

## Unresolved bug (as of source date)

The new `form_ui` App (`6a7da6ec...`) renders the ListView UI correctly but its runtime query
returns **zero rows**, even though an earlier builder preview of a prior version showed 33 rows.
Likely cause: a runtime/provider-configuration incompatibility specific to an imported `form_ui`
App screen reading a `FORM`-type provider — not a problem with the Center Order collection itself.
Planned next checks (not yet executed as of this source): compare the persisted model of the
working old preview against the current App model; confirm the App Viewer's user/role actually has
read access to the Center Order **form provider** (not just DB-level `data_sharing: public`);
inspect the live `crudGetAll` network response in-browser rather than guessing a new filter.

**Field note:** `selected_items_json` on Center Order records already contains per-item
`c_specimen` data. Some historical records have `patient_hn`/`patient_name` as `null` because they
were created before patient context was wired — display-only issue, not the cause of the zero-row
bug.

## Key takeaways

- This whole page describes **dead ends kept for the record**, not the final architecture — the
  actual resolution ([[his-lab-work-item-bridge]], dated 2026-08-14) moved past the Center
  Specimen Hub's own zero-row bug by re-architecting around `zdata_specimen_collection_status` as
  the canonical queue instead of continuing to debug this `form_ui` screen. Whether the
  `6a7da6ec...` App is still in use, or was abandoned in favor of the Aug-14 architecture, is not
  stated explicitly — flagged below.
- The `vue-ui` proxy/`activeTab` render error is a concrete platform gotcha worth remembering for
  any future custom `vue-ui` component with tab state — matches the general caution already
  recorded in [[vue-ui-pattern]] about hand-rolled reactive state in this platform.

## Entities & concepts touched
- [[his-lab-center-cpoe-master]] — upstream: where Center Orders are created.
- [[his-lab-work-item-bridge]] — downstream: the architecture that superseded this hub's approach.
- [[vue-ui-pattern]] — the general pattern this hub's first two attempts relied on and broke.

## Contradictions / open questions
- Whether the Center Specimen Hub (`6a7da6ec8d398c11cf2fe865`) is still the live UI, or was
  replaced outright once `zdata_specimen_collection_status` became canonical — not stated in
  either source document. Ask the user before assuming either state.
- `build_lab_center_specimen_hub_app_v3.py`'s outcome is never explicitly narrated (safe? broken?
  abandoned mid-way?) — inferred here as superseded only because the handoff names the widget
  rebuild, not V3, as "the safe version."
