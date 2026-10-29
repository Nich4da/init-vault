---
type: meta
title: Hot Cache
updated: 2026-10-29
---

# 🔥 Hot Cache — read this first

## Current LAB remainder — exactly two items

1. Production transport/result UAT: one real maternal round-trip; multi-item
   Partial/Final/Corrected; duplicate/idempotency; Boolean `is_critical`; reconciliation/Revision
   Log; attachment MIME/permission/reopen; and actual LAB/EMR-button runtime tests.
2. Blood Bank master debt: 103 active BB CPOE Items; 29 have `lab_item.tmt_code`, 74 do not
   (18 no `lab_item`, 56 blank/null code). The verified system field is **TMT Code**, not TMLT;
   reimbursement codes are separate. Resolve incomplete BB38, stale BB2/BB4/BB67 and BB1 hidden text.

Both wait for the team; EMR LAB History is team-assigned. Maternal override `R2610290002` remains
Live/local: LAB NO. `506910290001` omitted the flag; `506910290002` sent Boolean `true`; both got
HTTP 202 once and remain `queued`. Do not resend; reconcile, then remove the override.

## LAB list filter performance UAT

- BB Today 1.1–1.75 s, cross-section 0.897 s, HN all dates 1.763 s. Causes: ignored
  `include_specimens`, late filters, 608 Items, missing `source_specimen_record_id` index.
- Seven approved tracks remain unimplemented. Next: Track 1 baseline, then reduce calls/pipeline cost.

## MY manual-result master → Worklist verification

- Live read-only 2026-10-29: `LAB Manual Result Detail Settings` (`6acc8587481c196fbb332c60`)
  has 37 active MY rows. M1000 Worklist reads them in its MY popup and saves via
  `save_pathology_results`; 28 live MY Result Items include matching master values. Linkage is
  verified without writes.
- 2026-10-29 read-only/UAT check: live `lab_cpoe_worklist` is byte-equivalent to local
  (266858 chars, FNV-1a `a636260f`). MY lifecycle matrix passed 45 Partial→Final→Corrected cases:
  save gives `resulted`, finalize gives `completed`, correction preserves `completed` and history;
  Receive calls = 0, live writes = 0. `test_lab_uat` owner is Nichada and is locked away from
  Receive/Agent/LIS/finance, but it currently allowlists only HN `6900002`.
- Requested live MY seed on HN `6900001` is pending write gates. Latest Visit is
  `6ae2c8c307a7861e1037858e` / VN `6900475`; no seed run exists for this HN. Creating the seed
  would add records to non-user-owned `CPOE Order` and `CPOE Order Item` (owner `SuperAdmin
  InitAPI`), so three sequential confirmations are required. PDF latest-corrected value is not yet
  runtime-proven; standard Report/SQL are read-only (`Parinya Tumchay`). Full regressions still
  stop on unrelated sensitive-empty-state/radiology-organization assertions.

## LAB Order Request redesign mockup

- PHI-free formal A4 v2 passed checks; Live untouched. Await approval before Report-skill and
  Typst/production work: `output/pdf/lab-order-request-government-mockup-v2.pdf`.

## Completed continuity

- Worklist PDF/HN/EMR wrappers passed local/live checks; `sd-report` no longer moves other actions.
- Reject/cancel writes Work Item + CPOE Item, not the Order header. History still conflicts with the
  confirmed rule to show LAB-order Visits even when result is missing; decision pending.
- Per-Order Report runtime UAT passed all 10 sections; MB used microbiology, others standard;
  unauthorized IM/MI-OUT stayed redacted.
- Duplicate live Reports named `LAB Order Request v1`: use referenced ID
  `6a977ac8422c1ca959829f97`, not QSNICH Admin duplicate `6a97aaf2422c1ca959829fdc`.
- Ten-room Manual suite is Final; UAT outbounds remain `uat_bypassed`, attempt 0, no Agent/LIS call.
- Local/Live receive API copies only an exact CPOE Order Boolean with a type guard.
- 2026-10-29: `8454e01` pushed. CLAUDE.md §16: Claude-only wiki-capture habit; Git/Obsidian ignore `outputs/`.
