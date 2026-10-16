---
title: LAB Worklist Interactive UAT
updated: 2026-10-04
status: completed
scope: starterkit-worklist-ui
---

# LAB Worklist Interactive UAT

## Scope and safety boundary

- Runtime: StarterKit LAB Worklist (`appId=6a7d5a4374a0be190cc3275b`), 2026-10-04.
- Tested Worklist search, date range, status filters, result lookup/read permissions,
  specimen reselection, validation, item rejection, and Section/Order cancellation.
- All mutations used synthetic HN `6999001` in `m1005 งานจุลชีววิทยา`.
- **The `รับ specimen` button was never clicked.** Receive, LAB NO generation at receive,
  Agent dispatch, Finance, result entry, PDF/print, and EMR mutation were out of scope.

## UAT seeds

| Order | Purpose | LAB NO. | Final state |
|---|---|---|---|
| `R2610040010` | fresh specimen-reselection case | `406910040014` | waiting; `Others` changed to `Stool` |
| `R2610040011` | fresh whole-Order cancellation case | `406910040015` | cancelled; reason `อื่น ๆ` |
| `R2610040012` | fresh mixed-status case | `406910040016`, `406910040017` | M1 rejected; M8 remains waiting |
| `R2610040005` | free-text Source regression case | `406910040006` | waiting; changed again `Stool` to `Others`, Source unchanged |

## Results

### Search, date range, and status filters

| Case | Result |
|---|---|
| Exact Order No. with blank dates | PASS — one exact Order; Order search bypassed date |
| Order No. without `R`: `2610040010` | PASS — resolved to `R2610040010` |
| HN / VN / patient name | PASS — matching Orders returned |
| LAB NO. `406910040014` | PASS — exact Order returned |
| Impossible term | PASS — empty-state guidance displayed |
| `04/10/2026` only | PASS — 11 MB Orders after this run |
| `03/10/2026` only | PASS — one historical Order |
| `03/10/2026`–`04/10/2026` | PASS — inclusive 12 Orders |
| Reversed range | PASS — range normalized instead of failing |
| Waiting filter | PASS — mixed Order `R2610040012` remained visible |
| Cancelled/rejected filter | PASS — the same mixed Order remained visible |

Final 04/10 counters were 6 waiting, 0 received, 3 partial, 0 complete,
4 cancelled/rejected, and 11 total. Status buckets intentionally overlap for mixed Orders.

### Result lookup and permissions

- Blank HN/date correctly required an HN or date range.
- HN lookup with blank dates returned three result Orders and 27 ordered rows with
  `อ่านอย่างเดียว · ทุกห้องแลป`.
- The Microbiology result popup was read-only and displayed LAB NO., specimen,
  result stage/timestamps, and a Gram-stain result without edit controls.
- A Blood Bank result popup was read-only and displayed two tests, no result rows,
  and one attachment without edit controls.
- The same three result Orders / 27 ordered rows and read-only indicator were returned
  from every LAB unit `m1000` through `m1007`.

| Unit | Result |
|---|---|
| `m1000` กลุ่มงานพยาธิวิทยาคลินิกและเทคนิคการแพทย์ | PASS |
| `m1001` งานชีวเคมี | PASS |
| `m1002` งานธนาคารเลือด | PASS |
| `m1003` งานจุลทรรศน์คลินิก | PASS |
| `m1004` งานโลหิตวิทยา | PASS |
| `m1005` งานจุลชีววิทยา | PASS |
| `m1006` งานภูมิคุ้มกันวิทยา | PASS |
| `m1007` งานชีวโมเลกุลและพันธุศาสตร์ | PASS |

### Specimen, rejection, cancellation, and validation

- New Order validation kept Send disabled while required specimen data was missing.
- Duplicate-test confirmation displayed the prior Order and required explicit confirmation.
- Specimen reselection persisted and displayed success code `2200`.
- Free-text Source regression was revalidated on `R2610040005`: changing specimen to
  `Others` left `Source: UAT-WORKLIST-SPECIMEN-CHANGE-20261004` unchanged.
- Reject with no selected item was disabled. The reject form blocked blank reason,
  and closing before Submit left both items waiting.
- Rejecting only M1 stored reason/detail/operator, disabled its checkbox, and left M8 waiting.
- Cancel confirmation stayed disabled until a reason was selected; closing the dialog first
  left the Order waiting.
- Cancelling `R2610040011` stored reason/operator and disabled receive/reject/cancel controls.
- The mixed Order appeared in both operational and terminal filters as designed.

## Findings

No new blocking defect was found in the requested scope. The two previously corrected
regressions remain fixed at runtime:

1. Source remains the saved free-text value after specimen reselection.
2. A mixed waiting/rejected Order appears in both `รอรับ` and `ยกเลิก / ปฏิเสธ`.

`ตรวจใหม่` and every receive-related path remain untested by explicit instruction.

## Final UI state

Returned to `m1005 งานจุลชีววิทยา` → `รายการวันนี้` → `04/10/2026`–`04/10/2026`
→ status `ทั้งหมด`, blank search term, all rows collapsed.
