# EMR History · LAB Result Cards v2 — replacement handoff

Updated: 2026-10-21

## Ownership and delivery mode

Live Form `EMR History` (`6a96557e422c1ca959829eae`) shows `Created By: QSNICH Admin`.
Codex therefore did not Edit, Save, or Publish the live Form. This package is a
local replacement for an authorized owner to apply.

The shared result Form `lab_popup_result` (`6ad789a39291822e416c02e7`) remains
unchanged. X-ray UI, Process wiring, report viewer, image viewer, and previous-
result flow remain unchanged.

## Replace only these `emr_view` fields

1. Vue Template:
   `02-his/form-factory/emr-history-template-FULL-v1.txt`
2. `onCreated`:
   `02-his/form-factory/emr-history-onCreated-FULL-v2-REPLACE.txt`

The `.html` Template copy and
`Form-Builder/API/form-factory/events/emr-history-onCreated-FULL-v1.js` are
byte-identical mirrors of those paste-ready files.

## Confirmed LAB presentation

- Default filter is `ทั้งหมด`; available rooms are BC, HM, HH, ML, IM, MI-OUT,
  MB, MY, BB, and BG.
- One bordered sub-card represents one LAB Order. The generic LAB order summary
  and Order/LAB No./room/status header metadata are not repeated.
- Standard rooms show five columns only: test, result, unit, Ref. Range, and
  interpretation. The five columns use fluid tracks and wrap within the card;
  the EMR card never creates a horizontal scrollbar.
- Room filters wrap to the next line instead of scrolling horizontally. Wide
  historical comparison remains intentionally scrollable only inside the
  shared `lab_popup_result` Form.
- Result/Profile rows preserve the API order; the UI does not re-sort them.
- MB shows two columns only. The test column is capped at 240 px and the raw
  result uses all remaining horizontal width before wrapping. Unit, Ref. Range,
  and interpretation are not rendered for MB.
- Every Order card has compact `PDF` and `ดูผลทั้งใบ` actions at lower-right.
  `ดูผลทั้งใบ` opens the existing shared Form `lab_popup_result`; the EMR card
  does not contain a duplicate LAB whole-result dialog.
- IM/MI-OUT remain masked until doctor re-auth. The five-minute screen grant is
  preserved. Sensitive PDF always requires a separate re-auth on every click
  and never receives the screen grant.
- Manually hidden results remain redacted in their original API position.

## Verification

```bash
node Form-Builder/API/tests-tools/tests/test_emr_history_lab_result_card.js
node Form-Builder/API/tests-tools/tests/test_emr_lab_result_popup_wiring.js
node Form-Builder/API/tests-tools/tests/test_emr_xray_result_history_ui.js
node Form-Builder/API/tests-tools/tests/test_emr_sensitive_result_ui.js
node Form-Builder/API/tests-tools/tests/test_emr_sensitive_result_reauth.js
node Form-Builder/API/tests-tools/tests/test_emr_lab_full_result_dialog.js
node Form-Builder/API/tests-tools/tests/test_emr_lab_batch_grouping_and_manual_hide.js
```

All commands passed locally on 2026-10-21. Builder/Preview UAT by an authorized
owner remains required after pasting the two replacement fields.
