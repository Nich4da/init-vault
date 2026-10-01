---
type: meta
title: Hot Cache
updated: 2026-10-01
---

# 🔥 Hot Cache — read this first

## Git state (2026-10-01)

- Backlog split into 9 scoped commits `68caf35`..`f544503` + bookkeeping `4f90e3e`. **Not pushed
  yet** — `git push` was blocked by the auto-mode classifier and needs the user to run or allow it.
  `origin/main` is still at `c84f22f`, so 11 commits are waiting.
- Verified in a clean worktree: 48 test suites pass, 10 fail. Those 10 **already failed at
  `c84f22f`** (multilab reject, manual-lab-results, specimen receive, start processing, workbench
  widget draft, xray RIS params/team, result report viewer) — pre-existing, not this work.
- SDForm validator passes on all 11 changed form JSONs.
- **Still uncommitted on purpose:** `02-his/data/xray-staff-master-seed-v1.json` (13 real staff
  names + 7 personal emails — repo is public; sanitize before committing) and its reader
  `test_xray_staff_master_forms.js`; `test_xray_cpoe_worklist_form.js` (red — X-ray worklist form
  lacks the refresh button the LAB form gained); two `.txt` byte-duplicates of the EMR/treat-summary
  HTML templates; both `.obsidian/` editor-state files. Never bulk-commit these.

## LAB Worklist / CPOE

- Non-empty current Visit or CPOE snapshot `an` ⇒ `encounter.class="IPD"`, else `"OPD"`. Legacy flat
  `visit_type` unchanged (service type 1–5). Agent gateway/schema allow only OPD/IPD and reject
  extra nested fields. Worklist returns `visit.an`/`visit.encounter_class`, red read-only `AN : ...`
  badge only when AN exists, CBC rows included. AN not sent separately until Agent confirms its path.
- Live evidence: Visit Form `6a40fdec4b6dfdf45acbfbce` has `an`; CPOE `vid.an` + admission sync
  exist. At check: Visit AN 3, CPOE snapshot AN 4, admission-log AN 3.
- Readiness audit: Work Item 175, Outbound 97, Receipt 14, Report 19, Result Item 36, Edit Log 1,
  Revision 0. Still need callback/revision, multi-item final/corrected/duplicate, Report/EMR UAT,
  IM LAB NO/sticker, upload/RBAC. Critical contract: `is_critical` Boolean. Cancel is HIS-only;
  `retest_item` still needs explicit LIS-deletion confirmation.
- CPOE VN picker: Thai VN dates, optional Source, Visit-locked entitlement; IM/MI-OUT hide `All`.
  Cash badge: `sent` red unpaid, post-Finance green. Runtime test pending.
- Result correction writes append-only Edit Log `6ab78b7159662ac8f059105a`. Manual hide blocks EMR
  publication but LAB can edit; only Master Sensitive hides LAB values. Revision Log
  `6abbabdcc54b3f93ce799576` stores whole callbacks; runtime UAT pending.

## X-ray

- Worklist: `ready` can dispatch, `sent` disabled; cash badges follow LAB. Staff selector uses Form
  `6abcb7c0c54b3f93ce7a0489`, role-validated. Deploy/UAT pending.

## EMR LAB result

- HN `6900031` UAT proved Sodium unhide (`3000`). API resolves each Result through batch snapshot +
  Item Master and groups Profile like LAB. Manual hide is server-redacted and cannot be overridden;
  Sensitive doctor re-auth stays separate. Latest UI/template needs deploy/UAT.

## Remaining blockers

- Result Report join fix (`order_status_id → CPOE Item → Order`) and Sensitive PDF package
  `02-his/handoff/lab-result-pdf-sensitive-v3.zip` await Report team/runtime verification.
- Immunology LAB NO/sticker remains design-only.
