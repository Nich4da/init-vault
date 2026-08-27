# QSNICH HIS-LIS Integration Reference

## Scope and source files

Use this reference for LISconnect, HIS-to-LIS order submission, LIS-to-HIS
results, status synchronization, CPOE mapping, and integration diagrams.

Authoritative local sources:

- `/Users/nichada/Documents/LIS/his-order-submit-spec.md`
- `/Users/nichada/Documents/LIS/his-order-sample.json`
- `/Users/nichada/Documents/LIS/his-result-sample.json`

The current order specification is dated 2026-08-06 and excludes Blood Bank.
Re-read the source files when they change; do not treat this reference as a
replacement for a newer contract.

## HIS to LIS order flow

1. Require HIS to create `order_no` and `labno` before transmission.
2. Send `POST {AGENT_URL}/api/orders` with `X-Agent-Key` and JSON content.
3. Validate auth, JSON, `labno`, non-empty `items[]`, and routing as one order.
4. Commit to the queue before returning `202 Accepted` and `dispatch_id`.
5. Treat `200 duplicate:true` for an existing `order_no` as safe success.
6. Convert JSON to HL7 `ORM^O01` and emit a TIS-620 `.req` file.
7. Let LIS register and process the order by Lab No.

Use `order_no` as the outbound idempotency key. Do not create a second file for
a duplicate retry.

Current item fields are `seq`, `test_code`, `test_name`, `specimen_code`,
`specimen_name`, `collector_code`, and `collector_name`. The header-level
`priority` is distributed to each OBR-5 by LISconnect.

## LIS to HIS result flow

1. Read and parse the LIS `.res` file.
2. Convert the HL7 result to the result JSON contract.
3. Call `POST {baseUrl}/v1/process/{hl7_result_upsert_pid}` with Bearer JWT.
4. Match `filler_order_no` to Lab No. and cross-check `order_no` and `visit_id`.
5. Deduplicate messages by `result_uid`.
6. Append each `report_seq` and `stage`; never overwrite a prior report.
7. Increment `result_version` for corrections and preserve prior values/audit.
8. Recalculate partial versus complete status after every receipt.

Current result item fields are `obs_code`, `obs_name`, `value`, `units`,
`ref_range`, `obx_status`, `change_kind`, `receipt_seq`, `result_version`,
`critical_low_rule`, and `critical_high_rule`.

Treat `receipt_seq` as message receipt count, not result version. A preliminary
result may omit verifier identity. Preserve LIS identities even when HIS cannot
map them; mark them `unmapped_identity` instead of dropping the result.

## Status synchronization

Use a separate `hl7_order_status_sync` process. Support:

`new`, `queued`, `sending`, `sent`, `in_progress`, `resulted`, `stalled`,
`failed`, `cancel_requested`, `cancelled`, and `cancel_rejected`.

Reserve `awaiting_result` and `ack_err` for a later MLLP phase.

## Response and retry rules

- Treat `400`, `413`, and `415` as request/data errors; do not retry silently.
- Treat `401` and `403` as configuration/security failures; stop and alert.
- Treat `422` as a complete order rejection; show the reason and never route a
  partial subset of the items.
- Keep the HIS status `new` for `500` or `503` and retry/reconcile later.
- Reject the entire order to DLQ when characters cannot be encoded in TIS-620.
- Send Thailand-local timestamps or ISO timestamps with `+07:00`, not UTC `Z`
  interpreted as local time.

## Critical values

For machine LIS/Mlab results, require the integration contract to carry the
computed critical decision explicitly, for example `is_critical` and/or an
agreed interpretation code such as `LL`, `HH`, or `AA`. Store that decision and
let HIS display/alert from it; do not recalculate the threshold in HIS.

Treat `critical_low_rule` and `critical_high_rule` as source snapshots or audit
context. Do not infer that a result is critical merely because either field is
present: some payloads may include the applicable rule even when the measured
value is normal. If the current schema has only rule text and no explicit
decision, keep this as a blocking contract gap and reconcile the Agent/API
before production use. Never invent thresholds, units, reference ranges, or a
clinical interpretation.

Manual-only laboratories may use Lab-approved manual critical rules, but keep
that workflow distinct from machine-result ingestion and audit every manual
decision.

## Result persistence and UI separation

Use three data layers for inbound results when the implementation requires an
auditable technical receipt plus normalized clinical data:

1. Append one technical Receipt per `result_uid`.
2. Upsert one Report header/workspace per stable order/LAB NO./visit report key.
3. Upsert Result Item rows from `items[]` by report and result component/version.

An API that already performs these writes is the connector between the three
data forms. Do not add a second connector merely because the aggregate Lab UI
has not been created. Build the UI separately: result-tab ListView → `ดูผล` →
Viewer → Result Items filtered by Report id.

Verify persistence and presentation independently. A successful partial result
and duplicate retry demonstrate only partial persistence/idempotency; they do
not replace real-order transport, multi-item final/corrected, viewer, upload,
permission, and concurrency tests.

## CPOE mapping decisions

- Allow one CPOE Item to map to multiple LIS codes.
- Block ordering when required LIS mapping is incomplete; do not fall back to a
  Manual order that will fail at LIS transmission.
- Keep mappings editable so authorized users can complete missing records later.
- Model mappings as child records rather than one LIS code on the CPOE Item.
- Require `his_code_id` for the intended integration, subject to the final API
  contract from the Center Lab/LIS integration team.

## Unresolved contract gaps

The current transport spec and samples do not explicitly name `his_code_id`,
`lis_code_id`, TMLT, or `c_specimen`. Confirm before implementing:

1. Whether outbound `items[].test_code` is `his_code_id`, an LIS order code, or
   another identifier.
2. Whether inbound `items[].obs_code` equals the order code or identifies a
   reportable result component.
3. Whether `c_specimen` maps to outbound `items[].specimen_code`.
4. Whether TMLT is master-only or belongs in the API contract.
5. Which OBX/result components are required before an order is complete.

Never silently equate these identifiers.

## Cancellation

- Cancel an unsent order in HIS only.
- For a sent order without results, emit cancellation with `ORC-1=CA`.
- If results already exist, preserve `409 cancel_rejected`, show the reason, and
  do not retry silently.

## Diagram guidance

Prefer a simple two-column flow for stakeholders:

1. HIS sends order to LIS.
2. LIS returns result to HIS.

Keep detailed errors, states, and field mapping in accompanying notes rather
than putting every branch into the presentation diagram. Avoid patient data,
decorative styling, long horizontal chains, and crossing edges.

Workspace examples:

- `/Users/nichada/Documents/codex-backup/LIS_HIS_Integration_Flow_Simple.mmd`
- `/Users/nichada/Documents/codex-backup/LIS_HIS_Integration_Flow.mmd`
- `/Users/nichada/Documents/codex-backup/LIS_HIS_Integration_Flow_Notes.md`

## Safety and non-regression

- Separate Order, Specimen, Report, and Result Item identifiers.
- Do not persist or reproduce real patient identifiers/results in docs or tests.
- Do not claim production readiness without end-to-end evidence.
- Preserve working receive, reject, specimen, status, priority, search, and
  ListView behavior when adding integration features.
