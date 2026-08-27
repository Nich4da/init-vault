---
type: source
title: HIS — Lab Workbench handoff (core architecture)
created: 2026-08-16
updated: 2026-08-16
tags: [his, lab, lis, workbench, active-build, handoff]
source_file: "codex-backup/LAB_WORKBENCH_HANDOFF.md (top section, through 'Next Implementation Milestones')"
source_type: note
source_date: 2026-08-14
author: user + codex agent (parallel development workspace, outside this vault)
---

# HIS — Lab Workbench handoff (core architecture)

> The top section of a working-memory handoff document from a **separate AI coding session**
> (a "codex" CLI agent working directly against initCraft, kept in
> `/Users/nichada/Documents/codex-backup/`, not tracked by this vault until now). It documents
> **real, live, in-progress implementation** of the LAB module — far ahead of and architecturally
> different from what [[his-lab-module-plan]] proposed on 2026-08-04. Ingested 2026-08-16.

## Summary

- **Product goal:** one deployable **Lab Workbench** app shared by every laboratory section —
  explicitly **not** one app copy per lab (`BC`, `HEM`, `MICRO`, … are just data/config values
  that filter the one app, not separate builds).
- Common workflow: `LabCen/CPOE order → รอรับ → รับเข้าแล้ว → เริ่มดำเนินการ → ลงผล Manual หรือรับผลจาก LIS → ออกผลแล้ว`,
  with an alternate `ปฏิเสธ → ยกเลิกรายการ → ตรวจใหม่ → รับเข้าแล้ว` path.
- Seven **non-negotiable design decisions** are recorded (see below) — these read as hard
  constraints the agent was told not to violate, not just preferences.
- A **shared data model** (Order + Result Item) is defined once, filtered by `lab_section` +
  `order_status`, rather than per-lab collections.
- Five **existing production forms** were found "by read-only inspection" and must be reused,
  not duplicated.

## Non-negotiable design decisions

1. One app, one set of workflow screens, one set of status APIs.
2. Every inbound LabCen/CPOE order must carry a trustworthy `lab_section` before entering the
   workbench — never infer the target lab from a display name.
3. Every query filters by both `lab_section` and `order_status`.
4. APIs receive an Order ID and read `lab_section` from the database — never trust a section
   value passed from the UI for authorization/filtering.
5. Lab manager/admin may switch the active section; normal users see only permitted sections —
   enforced server-side, not just in UI.
6. Use a shared **Unit Master** and shared **Result Item** store; test-specific config lives in a
   **Result Definition Master**.
7. Never hard-code clinical units, reference ranges, critical limits, or interpretation — these
   must come from the lab's own LIS/analyzer/reagent validation.

## Shared data model

**Order** (central worklist record) — key fields: `lab_section` (required routing key),
`order_status` (`waiting_receive | received | processing | resulted | rejected`), `lab_no`,
`selected_items_json`, `specimen_json` (generic; legacy Bio uses `biochemistry_specimen_json`),
`received_at/by`, `rejected_at/by`, `result_source` (`manual | lis`).

Queue filters are simply `lab_section = activeSection AND order_status = <state>` for each tab.

**Result Item** (one per ordered test, created once when processing starts — must snapshot so
later Master edits don't rewrite historical reports): `order_id`, `lab_section`, `lab_no`,
`test_code`, `test_name`, `result_definition_id`, `result_source`, `result_status`
(`draft | entered | verified | void`), `result_number`, `result_text`, `unit_code_snapshot`,
`unit_symbol`, `reference_range_snapshot`, `result_comment`, `is_critical`.

LIS result matching must use **`lab_section + lab_no + test_code`**, never `lab_no` alone.

## Existing production forms (read-only inspection)

| Purpose | Form | Form ID | Collection |
|---|---|---:|---|
| Lab/Section Master | `[Lab room] ประเภทการตรวจ` | `6a79986bd5218a5b6a26bd15` | `zdata_section_code` |
| CPOE Lab Item Master | `CPOE Lab Item Form` | `6a79e45fd5218a5b6a26be9e` | `zdata_cpoe_lab_order_item` |
| Shared Unit Master | `Lab_Unit_Master` | `6a7aa575935ed08882467368` | `zdata_lab_unit_master` |
| Bio Order | `Lab_Bio_Order` | `6a771f20cc7d0a8451130339` | `zdata_testlab_bio` |
| Bio Rejection form | `ปฏิเสธสิ่งส่งตรวจ-Bio` | `6a7713fdcc7d0a8451130331` | `zdata_lab_receive` |

**⚠ "Lab Unit Master" is a false-friend name** — its fields (`unit_code, unit_symbol,
unit_name_th, unit_name_en, unit_dimension, decimal_places_default, is_active, unit_note`) are a
**measurement-unit master** (mg/dL, mmol/L…), *not* a lab-department/section master. The
department/section concept is the separate **Lab/Section Master** above
(`zdata_section_code`), which already exists and is already used as the routing key
(`lab_section`/`section_id`/`section_code`) everywhere in this build.

**CPOE Lab Item Master** already had **~838 records** at the time this section was written and is
meant to be the single master for orderable tests (`item_code, item_name, section_id, c_specimen,
service_group, item_desc`, billing codes, `sale_price`, `withdraw_price`) — do not create a
duplicate test master. **Contradiction to note (dated 2026-08-16):** a later section of the same
handoff (2026-08-13, see [[his-lab-center-cpoe-master]]) describes a *different* form/collection —
`CPOE Item Master (Lab + Xray clone)`, form `6a7caae774a0be190cc30756`, collection
`zdata_cpoe_order_lab_xray`, **1,605 records** (830 LAB + 775 Xray). The handoff text never
explicitly reconciles whether this is a clone/superset of the original 838-record master or a
separate parallel master — open question, not yet confirmed in either document.

**Result Definition Master** (`Lab_Result_Definition_Master.json`) exists locally but is called
an early draft needing redesign before broad use: it should hold only reporting config (result
type, decimal places, approved reference-range profiles, approved qualitative options,
method/analyzer/version, activation/revision) and reference `lab_item_id` → CPOE Lab Item Form and
`default_unit_id` → Lab Unit Master by ID, rather than duplicating `lab_section_code`/`test_code`/
test names as separate fields.

## Next implementation milestones (as recorded 2026-08-14)

1. Verify the fixed Reject API in API Factory using one test order, one Submit only.
2. Verify Receive/Start-Process API against `zdata_testlab_bio`.
3. Revise/import Result Definition Master to reference CPOE Item Master + Unit Master.
4. Revise/import Result Item; implement Start Process to create one Result Item per ordered test.
5. Implement manual-result entry with type/decimal/unit/reference snapshots from Result
   Definition.
6. Define the LIS inbound contract and matching/update rules.
7. Generalize the Bio workbench: active-lab selector, dynamic section filter on every queue,
   generic specimen model, neutral labels/API names, role-based permitted sections.
8. Add lab-specific extensions only where the workflow genuinely differs (e.g. Microbiology
   culture/susceptibility) — the shared app stays the default.

## Governance / safety notes recorded in the handoff

- MongoDB access is **read-only unless explicit write permission is supplied**.
- Never request/store user credentials or put credentials in `.env`; a read-only Mongo connector
  was already configured separately for schema/data inspection.
- Treat patient/order/result data as sensitive — avoid copying raw production patient data into
  workspace notes.
- The "form for storing edits" pattern is deprecated by the user; retain audit history inside the
  Order/result workflow instead (realized later as `order_change_history_json` — see
  [[his-lab-specimen-status-session-aug16]]).

## Key takeaways

- This single design decision — **one shared app filtered by `lab_section`, not one app per lab**
  — is the biggest divergence from [[his-lab-module-plan]], which had been organizing the whole
  build around per-unit rollout (CHE pilot → BG → immunology, each getting its own screens).
- The plan's proposed `zdata_lab_order`/`zdata_lab_order_item`/`zdata_lab_test`/`zdata_lab_unit`
  collections do not match what was actually built (see [[his-lab-center-cpoe-master]],
  [[his-lab-work-item-bridge]] for the real collections).
- Decision #10 in the plan ("CHE is a pilot, not the whole project") is effectively superseded —
  the real build never treated CHE/Bio as special; it treats it as the one legacy flow being
  generalized into the shared app.

## Entities & concepts touched
- [[lis]] — the concept page this whole initiative extends.
- [[his-lab-module-plan]] — the now-superseded plan; needs a dated supersession note.
- [[his-lab-center-cpoe-master]] · [[his-lab-center-specimen-hub]] · [[his-lab-work-item-bridge]] ·
  [[his-lab-specimen-status-session-aug16]] · [[his-lab-bio-workspace]] — the other milestones
  ingested from the same workspace.

## Contradictions / open questions
- Two differently-shaped CPOE masters (838-record `zdata_cpoe_lab_order_item` vs. 1,605-record
  `zdata_cpoe_order_lab_xray`) are both referenced as *the* CPOE Lab Item Master — not reconciled
  in source. Ask the user which is authoritative, or whether the second retired the first.
- "Lab Unit Master" naming collides with the `lab-unit-master.json` file built earlier in this
  vault's own session (before this ingest) for a *different* concept (lab department/section) —
  see [[his-clinic-master-handoff]] for the note on retiring that file.
