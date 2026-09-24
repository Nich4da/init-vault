---
type: meta
title: Hot Cache
updated: 2026-09-24
---

# 🔥 Hot Cache — read this first

## EMR History — LAB result placement (awaiting confirmation)

- Exported live Form `EMR History` (`6a96557e422c1ca959829eae`, v1) on 2026-09-24 and stored the new immutable snapshot at `Form-Builder/SDForm/backup/emr-history-6a96557e422c1ca959829eae-export-2026-09-24_18-03-01.json`. The exact downloaded export remains outside the repo in Downloads; the repo copy removes `feature_token` per repository safety rules. JSON syntax passes; SHA-256 `e4642149bcb15f545e193e36fb84b0a7b0240d4bf31a837eef9b8c593293ba9c`.
- No EMR History implementation changed yet. Recommended design for user confirmation: inside the existing right-column `Lab` order card, append the completed EMR LAB result card pattern after the current order row, preserving its status/time, abnormal-first rows, comment, PDF, and LAB Worklist-style full-result popup.
- Integrate only in vue-ui `emr_view`: call existing `emr-lab-board-get` separately with the selected visit/HN; do not modify restored `emr-history-get`. Match results exactly with `item_groups[].items[].order_id === lab_orders[].source_order_id`, never by display name. Prefix added state/helpers with `ehLab*`.

> Cache; 500 max.

## HL7 / `lis.receive`

- Proc `6a8da8a6f851000f28e50299`; `lis.receive`: scoped `x-api-key` + `{params:<result>}`, strips gateway metadata, rejects unknown clinical fields, prefers outbound `test_code`. Agent `lisconnect.childrenhospital.go.th/api/orders`; callback `apihis.softmax-one.com`. `R2609090013` 422 (`rax-file` off); retry reuses Item/LAB NO./Outbound.

## LAB current state

- Critical marker is clinical only; never infer from range. Manual-result 4500 open: fallback can mistake a CPOE Item ID for a Result Item ID.
- **Shared LAB NO batch (local):** Receive groups Items by specimen → one LAB NO./Agent request/Outbound per group; new click ⇒ new LAB NO. Work Items keep per-test rows + batch metadata; callback updates related Items/Order/Outbound.
- **LAB UI design 2026-09-11:** visual-only X-ray alignment applied to LAB Form/generator: 5 LAB-native filters + legend, Order status shows colored dot + Item count per active bucket (mixed orders show multiple counts), Item status stays a text box, theme-safe dark mode, solid actions, guarded row toggle, matched heads, sticky checkbox. Status mapping/API/flow unchanged. Spec: `design/lab-worklist-ui-design-update.md`; tests/validator/idempotency/X-ray regression ✅. Replace Form JSON only; Builder/runtime UAT pending.
- Safe LAB Worklist UI checkpoint: commit `57f4640` (generator, Form JSON, Form regression, LAB README, design supplement). X-ray token-bearing artifacts, ZIP exports, Obsidian state and output/tmp were excluded.
- Deploy together: `lab_no_generate_api.js`, `lab_cpoe_receive_api.js`, `lab_cpoe_worklist_api.js`, `hl7_result_upsert_api.js`, `lab-cpoe-worklist-waiting-v1.json` — verified. No unique `lab_no` index. Next: final callback must complete all 9 batch Items of `R2609090021` + parent Order.

## Guardrails

- Mongo read-only (form JSON in `sdform_manage.form_model` is encrypted). No credentials or patient data (exception: the agent token the user ordered in). Preserve dirty worktree; no commit/push unless asked.
