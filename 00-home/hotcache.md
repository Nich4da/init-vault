---
type: meta
title: Hot Cache
updated: 2026-09-02
---

# 🔥 Hot Cache — read this first

> Working-state cache; cap 500 words. Vault root: `~/Documents/Initcraft skill`.

## LAB identifiers / standing behavior

- Work Item `6a95c750422c1ca959829e8a`; Worklist `6a9434c3422c1ca959829d5e`; LAB NO. `6a94f1ed422c1ca959829d6e`; Receive `6a94f634422c1ca959829d70`; Reject `6a79ff46d5218a5b6a26bebc`; Agent Submit `6a9468c7422c1ca959829d6a`.
- MongoDB is standalone. Receive creates LAB NO./Outbound but does not send Agent automatically. CPOE remains read-only.
- Cancel/reject rows hide PDF/EMR and show mock `ตรวจใหม่`; future retest creates a linked new Order No. and LAB NO. only at receipt.
- PDF Report `6a977ac8422c1ca959829f97` filters by `order_id + visit_id + section_code`; preserve the existing row-scoped connection.

## Implemented locally — Scan HN + longitudinal result

- `lab-cpoe-worklist-waiting-v1.json` includes PIS-pattern `scan-code-ui` (`scan_code`, document target, Enter suffix, min 6). Scan accepts numeric HN only and calls Worklist patient-context mode; open popups block patient switching.
- Scanned HN persists across status tabs until `ล้าง HN ที่สแกน` or manual Search. Current tab remains status-scoped. In `complete/ออกผลครบ`, Date Range is omitted and all completed Orders for that HN are loaded. Scan never receives specimen, creates LAB NO., changes status, or sends Agent.
- Result dialog places `ผลก่อนหน้า` before `ผลปัจจุบัน`. Previous means latest final/corrected value for same HN + observation from another earlier Order/Visit, never the prior correction version.
- `lab_cpoe_worklist_api.js` returns normalized current rows plus per-observation previous encounter data. Manual corrections keep latest value, `change_kind`, editor/time, and empty `previous_value`/`edit_history_json`.
- `hl7_result_upsert_api.js` updates the latest Result Item per observation instead of appending a clinical row per version. Receipts/stage Reports remain technical audit/idempotency records. Corrected callbacks require explicit `corrected_at` and `corrected_by`; `verified_by` remains verifier only.
- Agent schema updated: `agent-to-his-result-v2.schema.json`. Legacy duplicate Result Items are read-time de-duplicated; destructive cleanup needs a separate approved migration.

## Verification / deployment

- Core Worklist Form/API, Agent callback, Agent Form/schema tests pass; JSON parse and `check_sdform_json.py` pass.
- Validator warns root `scan-code-ui` has no local template and needs Builder/runtime confirmation; this mirrors the provided PIS root placement.
- Several unrelated legacy LAB tests fail before assertions because fixture paths are missing.
- Runtime UAT remains: import/replace Worklist Form, replace both Process bodies by existing IDs, give Agent the revised v2 schema, then test scan tabs/history and partial→final→corrected callbacks.
- Checkpoint scope is limited to the exact Scan HN/result-contract files plus this Hot Cache. Unrelated user/X-ray/report/Obsidian changes remain uncommitted.
