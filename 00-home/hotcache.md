---
type: meta
title: Hot Cache
updated: 2026-10-20
---

# 🔥 Hot Cache — read this first

## LAB / EMR

- 2026-10-18 live check: LAB/EMR matches local except the real Agent Submit URL/key. Of 14 receipts since 10-01, 13 processed and all items matched; one version-guard rejection was later accepted. Open: code `400305` unmapped (422), no explicit LIS critical decision, corrected/duplicate and BB/ML/BG UAT gaps, Outbound backlog 60 new/37 queued.
- Approved LAB popup mockup: `02-his/ui/lab-result-history-table-popup-confirmation.html`. Local SDForm `Form-Builder/SDForm/form-factory/forms/lab-emr-result-history-popup-v1.json` now requires EMR `visit_id` plus Order/section identifiers and calls `emr-lab-board-get` (`6ab3be31cec3020e8562a2c9`) directly; all demo/fallback clinical values were removed. Standard rooms use the long history table; MB preserves raw MLab cards; MY adds `ตำแหน่ง Specimen`; IM/MI-OUT use the API `open_sensitive` re-auth path. The API accepts `history_limit` 1/5/10 (default 5 for existing consumers) and returns Order comments. SDForm validation and popup/API regression tests pass. No live artifact, EMR caller, LAB Worklist, or X-ray Worklist was changed; importing/replacing the Form and wiring the EMR opener require separate ownership verification and approval.
- X-ray history uses read-only `emr-xray-history-get` (`6ad58d76481c196fbb339ae8`): Visit → Order → room/modality → exam, five prior results by HN + exact exam code. Guide: `02-his/handoff/emr-xray-result-history-v1-import.md`.
- EMR History replacements preserve existing viewers, Sensitive/HIV re-auth, PDF/attachments, Order/Visit, and Treat Summary. APIs unchanged; 10 tests and syntax pass.

## X-ray / UAT

- CPOE writes Order/Item only, never Bill or Visit Tran. Finance bills by visit, marks paid items `ready`, and opens that Visit’s X-ray queue. Reject stores reason; cancel resends stored JSON with `IsDeleted:true`; audit is append-only.
- UAT HN `6900031`, VN `6900444`; never press real `ส่งเข้าเครื่อง`. Guarded `xray_uat_seed_api.js` never calls Agent/RIS or creates outbound X-ray orders.
- Treat Summary X-ray shows latest result/PDF and exact-exam history. Replacement: `02-his/form-factory/treat-summary-onCreated-FULL-v3-REPLACE.txt`; surgical block: `treat-summary-xray-board-load-replace-v1.txt`.
- Verified Skull AP/RD020 history/filtering. Retest clears current reject fields but keeps audit; `VB001` appears after hard refresh; other units are read-only; LAB paste stays in LAB; X-ray never creates/copies/closes Visit Tran.

## Blood Bank exports 2026-10-20

- Live CPOE Blood Bank read-only extraction exported 103 tests; no selection/save/submit or patient data. Detailed and grouped Excel/PDF/HTML outputs remain under prior recorded paths; grouped counts are 8 frequent, 20 `Antigen*`, 8 `*- Gel method`, and 67 other.
- Converted `backup-data-zdata_bb_product_type-Earn_admin-2026_10_20_16_08_00.json` into `outputs/01a15892-2903-7bc3-ab34-4fbd3fd16167/bb-product-types-readable.xlsx`.
- Workbook has a Thai-readable `สินค้าเลือด` sheet (7 products) and exact flattened `ข้อมูลระบบ` sheet (33 columns). Verified source/output row counts, leading-zero codes, nested ObjectId handling, no spreadsheet errors after saved-file reimport, and visual layout on both sheets.

## Guardrails

- Live HIS MongoDB is read-only. Live EMR and non-user-owned/unknown Factory artifacts are read-only; ask before every user-owned live mutation.
- Dirty worktree has overlapping X-ray work. Never broad-stage/revert/commit. Never expose Agent/RIS tokens.
