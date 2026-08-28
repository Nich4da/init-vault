---
type: meta
title: Hot Cache
updated: 2026-08-28
---

# 🔥 Hot Cache — read this first

> Working-state cache; cap 500 words. Vault: `/Users/nichada/Documents/Initcraft skill`.

## Current — LAB one-page HTML mockup

- Conversation reset resolved; `00-home/handoff.md` is inactive.
- Working UI: `02-his/ui/lab-workbench-stock-pattern-mockup.html`. It is one page,
  follows the draw.io/Drug visual pattern, retains all LAB data, has one Date Range,
  five status filters, searchable specimen dropdowns, item/bulk receive-reject actions,
  colored patient pills, and readonly result popup with pencil-edit confirmation.
- HTML/JS parsing and desktop/mobile browser checks passed. The file remains untracked.

## Completed mockup behavior

- Kept the existing `ออกผลแล้ว` filter only. Result order badges now distinguish
  `ออกผลบางส่วน` and `ออกผลครบ`; no additional filter chip.
- Partial means at least one test has a result and at least one is pending. The order
  result popup shows every test: completed result components continue downward in the
  current pattern; pending tests show `รอผล`; long text wraps and grows the row.
- Partial-order PDF remains visible but disabled. Complete-order PDF uses the latest
  corrected result. Top `ดูผล` opens all results; per-test `ดูผล` remains. Waiting and
  received orders keep top action `ดู` for patient EMR.
- Resulted + normalized exact HN shows all years; explicit Date Range narrows it.
  Otherwise lists default to today. Date filtering uses request, receive, result, or
  rejection timestamp according to row status. Calendar now navigates months/years.
- Unified cancelled wording as `ปฏิเสธ`. Added one rejected mock order, expanded test
  detail, reason/canceller popup, and a custom confirmation flow for `ตรวจใหม่`.
  Retest preserves the original, creates linked Order/Lab numbers and current local
  request time, copies patient/doctor/priority/coverage/tests, then opens in waiting.
- Visible Agent/API remarks record two unresolved contracts: required components and
  test-level completeness; mixed accept/reject support and resulting order status.
- Keep current aggregate mock counts.
- Added native-dialog fallback for the in-app browser.

## Verification

- JavaScript syntax and duplicate-ID checks passed; no browser console errors.
- Browser checks passed partial/complete popup composition, pending rows, PDF gating,
  per-test versus all-test editing, exact-HN all-history search, Date Range narrowing,
  month navigation, rejection popup, retest linkage/copying, and original preservation.
- Responsive check passed at 390 px: body has no page overflow; dense worklist stays in
  its horizontal scroller. Desktop tested at 1440 px.

## Integration checkpoint

- HL7 result receiver and three Forms remain UAT candidates, not production-ready.
  Authoritative note: `02-his/handoff/lab-result-api-readiness.md`.
- Preserve append-only final/corrected history and idempotency. Agent/API must define
  which result components are required before a multi-component test is complete; UI
  must not infer clinical completion.

## Guardrails

- Before SDForm edits read `02-initcraft/governance/from-codex-backup/SDFORM_JSON_RULES.md`
  and run `Form-Builder/seed/tests-tools/validators/check_sdform_json.py`.
- Existing `backup/`, promoted best practices, source materials, credentials, and
  unrelated local changes are immutable/out of scope.
- Refresh this cache after state changes. Conversation reset handoff is inactive.
