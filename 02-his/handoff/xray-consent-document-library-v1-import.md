# X-ray consent document library v1 — import handoff

Updated: 2026-09-17

## Current state

- UI Form record **X-ray · คลังหนังสือยินยอม** exists in HIS: `6aab93911c5232627d0c6ee1`.
  It is a Pro/UI form, public to app users, with Popup Size 90.
- At the last agent check before import, its Builder canvas was empty. The user
  confirmed on 2026-09-17 that the library, PDF preview, and print work in HIS;
  no separate sample document or print capture was provided.
- Worklist Form ID: `6a953fb6422c1ca959829e14`. The user's 14:25 screenshots show the
  consent button in the live Worklist, with toolbar controls overlapping when the sidebar expands.
  The local replacement JSON has since been corrected and has not been verified live.
- At 15:02 the live Worklist still displayed five selected machine tags per row. A
  read-only DOM inspection found `.xr-modality-field.is-picked`, but the loaded
  stylesheet had only the old `flex-wrap` rule; the three-column grid rule was
  absent. The replacement file now includes a specific `display:grid!important`
  rule for the selected machine field. After that model was imported, the user's
  15:07 screenshots showed large gaps between tags. Live DOM inspection confirmed
  the Element Plus filter input was a grid child with a 126px minimum contribution,
  widening the second tag column. The latest local model activates grid only after
  three selected machines and positions the input in the remaining row space without
  widening tag columns. Import it into the **existing Worklist Form**, publish,
  reload, and verify four, five, and six selections. The latest layout is not yet
  verified live. An attempted local synthetic browser preview was rejected by the
  browser URL policy; do not retry via another browser surface.
- The next live screenshot shows the tags correctly in two rows but a blank area at
  the right of the select. DOM measurements with six selected codes: three tag
  columns occupy about 146px, while the select is 250px wide and its hidden input
  is 0px. The width calculation still reserved 88px for that input. That replacement
  removed the reserve only at three or more tags, leaving a width jump at two.
- The 15:21 screenshots and live DOM check confirm two short codes make a 250px
  select while three short codes make a 184px select. The current replacement uses
  one nominal 186px base for zero, one, two, three, and later short codes; only
  genuinely longer codes enlarge it. The user subsequently confirmed the latest
  machine filter UI **passed** on HIS. This closes the chip layout UAT. The user
  subsequently confirmed machine filtering and status chip counts on HIS, as well
  as consent library preview/print. The earlier screenshots showed zero rows;
  no separate Order ID or example print was supplied with the confirmation.
- Browser automation was blocked from opening the local JSON file by browser URL policy.
  No model import or live preview was claimed.
- Local TOR tracking in `Form-Builder/SDForm/X-ray/spec.md` marks §3.4.3.1
  **บันทึกหนังสือยินยอมการเข้ารับบริการ** as **partial**. The user confirmed the
  catalog's preview/print; it does not save a signed consent against a patient.

## Files and import order

1. Open the new Form ID in SDForm Builder. Use the menu beside Preview → **Import Model**.
   Paste the complete contents of
   `Form-Builder/SDForm/X-ray/xray-consent-document-library-v1.json`, import,
   inspect the canvas immediately with nothing selected, open Preview, then Publisher.
2. In the new Form, search `MRI` and `report 5 EN`; select a folder and open the
   corresponding **ดูตัวอย่าง / พิมพ์** action. Confirm the Report Factory PDF preview
   and browser print control work.
3. Replace the existing X-ray Worklist Form ID with the corrected responsive file
   `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json`. Reload X-ray and confirm
   **นัดล่วงหน้า** stays level with **สร้างรายการใหม่**, **หนังสือยินยอม** appears on
   the next line directly below it, and all toolbar controls wrap without overlap
   with both collapsed and expanded sidebars. Then open the new library.
   Select at least four machines: no more than three code tags should appear on one
   line, and the fourth should wrap below while every selected machine still filters.
   Recheck search, appointment button, create order, viewer, and HN print.

Do not use **Import Form** on the SDForm list for these model JSON files; that action
imports an entire Form record and may upsert another record.

## Report Factory catalog

| Folder | TH | EN |
|---|---|---|
| รับทราบและยินยอมตรวจพิเศษ | `6aa3b2df8f9a0e702f2deacf` | `6aa3ba38b92813319a86e9d7` |
| ยินยอมตรวจ FLU / IVP / CT | `6aa3c0556c01b91cd929807a` | `6aa3c059951e69eaf6f574c0` |
| ยินยอมรับการรักษา | `6aa3c05c4450eda3107a5bcd` | `6aa3c05f91aa378567d9cdbd` |
| ประวัติก่อนตรวจ MRI / สารทึบ | `6aa3c06118ba3bc2899b37ec` | `6aa3c0696943d27dbf198b07` |
| ยินยอมบันทึกภาพและข้อมูล | `6aa3c06f23e6140d107bc6c3` | `6aa3c076d0cf5dff9d8d716a` |

All ten `module_report` records were confirmed read-only on 2026-09-17:
`pdf_type=report`, `pdf_share=public`, no required `pdf_params`, and the same
`static_report_dummy_row` SQL provider. The new Form is a catalog of existing PDF
templates; it does not store uploaded files or signed patient consent documents.

## Local verification

- `test_xray_consent_document_library.js`: five folders, ten distinct Report IDs,
  search by Thai/title/system name, selection, and Worklist button wiring.
- Existing `test_xray_cpoe_worklist_form.js` passed without assertion changes.
- SDForm JSON validator exited 0 for both Form JSON files. The user confirmed
  runtime library/preview/print and machine filtering on HIS; no case IDs or
  print captures were provided for independent replay.
