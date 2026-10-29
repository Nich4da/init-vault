# EMR X-ray Result / History v1 — replacement handoff

Updated: 2026-10-19

## Decision

Create a separate read-only API Process named `emr-xray-history-get`.

Confirmed Process ID: `6ad58d76481c196fbb339ae8`.

Do **not** extend or replace `emr-lab-board-get`. Its LAB response contract and its
legacy flat `xray_results[]` remain untouched, so existing LAB/Treat Summary flows
continue to work while the new X-ray UI is deployed independently.

The new Process derives HN/VN from `visit_id`, groups X-ray as
Order → room/modality → exam, joins the current report by `AccessionNo`, and returns
at most five previous results for the same HN + exact `ExamUid`. It never matches by
exam name and performs no writes.

## Files

1. API Factory body:
   `Form-Builder/API/api-factory/processes/emr-xray-history-get.js`
2. EMR History Vue `onCreated`:
   `Form-Builder/API/form-factory/events/emr-history-onCreated-FULL-v1.js`
3. EMR History Vue Template:
   `02-his/form-factory/emr-history-template-FULL-v1.txt`
4. EMR Card / Treat Summary Vue `onCreated`:
   `Form-Builder/API/form-factory/events/treat-summary-onCreated-FULL-v1.js`
5. EMR Card / Treat Summary Vue Template:
   `02-his/form-factory/treat-summary-template-FULL-v1.txt`

The `.html` copies beside both templates are byte-identical preview/source copies.

## Deployment order

1. The API Factory Process `emr-xray-history-get` already exists as
   `6ad58d76481c196fbb339ae8`; that ID is already inserted in files 2 and 4.
2. In EMR History, replace only the `emr_view` Vue Template and `onCreated` with
   files 3 and 2.
3. In the EMR Card, replace only the `treat_summary` X-ray-capable Vue Template and
   `onCreated` with files 5 and 4 only when deploying the earlier compact-card
   X-ray feature. The current previous-result filter delta does not require another
   Treat Summary replacement.
4. Hard reload and test with one Visit containing at least two X-ray Orders and one
   Radio Exam code that has previous results.

## Expected UI

- Compact Card: collapsible Order → room/modality → exam; exam actions are
  `ดูผลอ่าน` then `ดูภาพ`.
- EMR History: the same Order-first structure plus `ผลก่อนหน้า`; the action is
  always visible and an empty result opens a tidy `ไม่มีผลก่อนหน้า` state.
- LAB and X-ray previous-result popups default to three results and let the doctor
  choose 1, 2, 3, 4, or 5 previous occurrences. This is presentation filtering
  only; it does not mutate or re-query the API response.
- Standard LAB keeps the Worklist result sheet and moves previous values behind
  `ผลก่อนหน้า`. Critical/abnormal colour uses only the stored result flag.
- MB/MLab keeps raw Agent text unparsed and opens each historical sheet inline as
  an accordion. MY keeps one historical occurrence together and expands every
  specimen/site position returned for that occurrence.
- Sensitive/HIV remains fail-closed and follows the existing re-auth flow before
  any result or prior value can be shown.
- `Final` appears once at Order level, not on each exam row.
- The report popup contains the report and Close only; it does not repeat `ดูภาพ`.
- The image action uses the existing Worklist RIS viewer contract:
  Accession No. first, HN fallback.

## Safety / regression boundary

- No live Form/API/Report/SQL artifact was edited by Codex.
- The 2026-10-19 previous-result update changes only the local EMR History
  replacement template/onCreated presentation. `emr-lab-board-get`,
  `emr-xray-history-get`, Treat Summary, Visit navigation, finance, SOAP, generic
  order groups, and queue flow remain unchanged.
- Treat Summary opens the medicine tab first every time; loading LAB/X-ray data does
  not auto-switch the selected tab.

## Verification

```bash
node Form-Builder/API/tests-tools/tests/test_emr_xray_history_get.js
node Form-Builder/API/tests-tools/tests/test_emr_xray_result_history_ui.js
node Form-Builder/API/tests-tools/tests/test_emr_history_lab_result_card.js
node Form-Builder/API/tests-tools/tests/test_emr_sensitive_result_ui.js
node Form-Builder/API/tests-tools/tests/test_emr_sensitive_result_reauth.js
node Form-Builder/API/tests-tools/tests/test_emr_lab_full_result_dialog.js
node Form-Builder/API/tests-tools/tests/test_emr_lab_batch_grouping_and_manual_hide.js
```

All listed tests passed locally on 2026-10-19. Builder/runtime UAT remains required
after replacing the EMR History Vue Template and onCreated artifacts.
