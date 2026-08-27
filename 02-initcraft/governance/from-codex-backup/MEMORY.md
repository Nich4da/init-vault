# Persistent Memory Pointer

For Manual/LIS laboratory result-entry work, read [LAB_MANUAL_RESULT_HANDOFF.md](LAB_MANUAL_RESULT_HANDOFF.md) first. This is the latest authoritative checkpoint for `Lab_Result_Definition_Master`, `Result_Report_Manual_Entry`, `Lab_Result_Item`, Unit Master relationships, result completeness, critical values, and the next implementation steps. If the user says “ทำต่อ” in the context of entering Lab results, use its **Resume trigger** and do not fall back to the older dropdown checkpoint below.

For HIS-LIS interface work involving LISconnect, `his-order-sample.json`, `his-result-sample.json`, `.req`, `.res`, `order_no`, `labno`, `his_code_id`, `test_code`, `obs_code`, OBR/OBX, order-status synchronization, partial/final/corrected results, or CPOE-to-LIS mapping, read [LIS_HIS_INTEGRATION_HANDOFF.md](LIS_HIS_INTEGRATION_HANDOFF.md) completely. Treat its **contract gaps** as unresolved until the integration team confirms them; do not silently equate `his_code_id`, `test_code`, and `obs_code`.

For the Lab Workbench initiative, read [LAB_WORKBENCH_HANDOFF.md](LAB_WORKBENCH_HANDOFF.md) and the latest section of [LAB_SESSION_MEMORY.md](LAB_SESSION_MEMORY.md) before editing forms, APIs, or workflow JSON. If the user starts a new session with “ทำต่อ”, first use the saved reply in the latest **คำตอบล่าสุดเมื่อผู้ใช้พิมพ์ว่า “ทำต่อ”** section of `LAB_SESSION_MEMORY.md`.


Before creating or editing any SDForm/initCraft form JSON, read [SDFORM_JSON_RULES.md](SDFORM_JSON_RULES.md) and run `python3 check_sdform_json.py <file.json>` until it exits 0. Hand-authored `options` that are missing keys make the Builder canvas render empty while Tree View still lists every widget — this has already cost three delivery rounds (2026-08-23, 08-24, 08-25).

Core decision: one Lab Workbench App Factory implementation, filtered and authorized by `lab_section`; do not duplicate the same workflow App for each laboratory.

## Current Lab result pipeline checkpoint — 2026-08-25

- The live inbound persistence path is already wired by API; do **not** add a second connector between the three data forms:
  1. `Lab_Result_Inbound_Receive` (`6a8b1c03f851000f28e501ef`) → `zdata_lab_result_inbound`
  2. `Result_Report_Manual_Entry` (`6a8d4334f851000f28e5025b`) → `zdata_lab_report_manual_entry`
  3. `LAB_result_item` (`6a8bc91df851000f28e501fb`) → `zdata_lab_result_item`
- `hl7_result_upsert_api` process id is `6a8da8a6f851000f28e50299`. A UAT partial-result receipt and a duplicate retry have passed: the first call created Receipt → Report → Result Item and updated work status; the retry returned `DUPLICATE_RESULT_UID` without creating a second result.
- `Result Report Viewer` (`6a8d5620f851000f28e50270`) is a separate `form_ui` used as the future popup behind the Lab Workbench result-list button. It is not a fourth transaction store.
- User decision: **park the combined Lab UI/App for now**. Do not create or redesign the aggregate Lab UI until the user resumes that work.
- Do not claim production readiness. Still required: one real Order end-to-end through HIS → Agent → LIS → Agent → API, multi-item final/corrected tests, UI ListView/viewer wiring, upload verification, Manual Microbiology behavior, permissions, and retry/concurrency checks.
- Critical contract remains a release blocker: machine LIS/Mlab results should carry an explicit computed critical decision (`is_critical` and/or an agreed interpretation code). HIS should display/alert from that decision and must not infer a clinical critical event merely because threshold/rule text is present. Threshold fields may be retained as snapshots.
- Next execution step while the aggregate UI is parked: create a real UAT Lab Order through the normal HIS flow and verify the complete transport and persistence chain. After that, resume the Lab Workbench `form_ui` and connect its `ดูผล` button to the Viewer using the Report id.
