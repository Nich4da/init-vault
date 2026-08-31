# HL7 Result Upsert API and Three-Form Readiness

Updated: 2026-08-27 (Asia/Bangkok)

## Scope

This checkpoint covers the local API Factory process
`Form-Builder/API/api-factory/processes/hl7_result_upsert_api.js` and the working
SDForm candidates for Technical Receipt, Result Report, and Result Item. It also
checks the Viewer that reads Report Items.

## Current verdict

The package is a **UAT-ready candidate, not production-ready**.

- Prior deployed evidence proves one matching partial payload and a processed
  duplicate retry created/linked Receipt, Report, and one Result Item correctly.
- Current local regression tests prove partial, multi-item final, corrected,
  stale/version conflict, unmatched, critical-decision, and duplicate behavior
  against the process-body harness.
- The three data-form JSON files and Viewer pass the repository SDForm validator.
- The local API now enforces v2 schema string lengths and no longer acknowledges
  a duplicate unprocessed receipt as successful.
- These latest API changes are not yet deployed to live process
  `6a8da8a6f851000f28e50299`.

## Verification run

- `node Form-Builder/API/tests-tools/tests/test_hl7_result_upsert_api.js`
- `node Form-Builder/API/tests-tools/tests/test_agent_result_forms_v1.js`
- `node Form-Builder/API/report_factory/tests/test_result_report_viewer_v1.js`
- `python3 Form-Builder/seed/tests-tools/validators/check_sdform_json.py` against
  the three `*_Agent_Result_v1.json` data forms and Viewer — exit 0.

Static validation proves structure and local logic only. It does not prove the
deployed Builder/runtime or the external Agent/LIS transport.

## Release blockers

1. Deploy the reviewed local process body and repeat safe UAT.
2. Run one real UAT order end-to-end: HIS → Agent → LIS → Agent → HIS.
3. Verify multi-item final and corrected callbacks in the deployed runtime,
   including stale versions and both processed/unprocessed duplicate retries.
4. Verify service-account/process permissions, concurrency/unique idempotency,
   partial-write recovery, and operational reconciliation.
5. Verify the Lab result-tab `ดูผล` path, Viewer refresh, permissions, and file
   attachment persistence.

## SDForm Best Practice evaluation

Keep all four JSON files as working candidates in `form-factory/forms/`. Do not
promote them yet: the claimed data/API workflow needs deployed runtime evidence,
the newest API body is not deployed, and environment-specific Form IDs must be
replaced with documented placeholders in any future sanitized promoted copy.
