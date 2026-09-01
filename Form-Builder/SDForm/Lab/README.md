# LAB SDForm Working Area

This directory is the user-approved working location for the new LAB Workbench SDForm implementation.

## Current working artifact

- `lab-cpoe-worklist-waiting-v1.json` — local CPOE-backed LAB worklist candidate;
  CPOE source records stay read-only while LAB writes use dedicated operational collections.
- Bound to API Factory Process ID `6a9434c3422c1ca959829d5e` through the
  authenticated `runProcess` connector.
- Uses the compact structural pattern from Drug & Stock > Stock: small search
  toolbar, status chips, aligned list header, expandable Order rows and a
  borderless nested Item grid. LAB content and actions remain specific to the LAB design.
- The visible list summary is intentionally limited to `แสดง X Order จากทั้งหมด Y`;
  routing sections and implementation-state notes are not shown in the user UI.
- Search/date filters, Order-level pagination and Item-level selection remain
  connected to the Worklist Process. There is no room/Section picker
  in this Form: the authenticated App Organization determines the allowed
  sections, and changing Organization reloads the worklist automatically.
- The API filters CPOE Items by allowed section before grouping them back into
  Orders. The same Order No. can therefore appear in Bio and Hemato while each
  room sees only its own Items.
- Age is displayed exactly from the patient snapshot (for example `3y 3m 3d`),
  and specimen is an Element Plus dropdown backed by the Worklist Process.
- Doctor display removes an email suffix and shows only the available person name.
- Cancelled/rejected Order rows hide PDF and EMR and show `ตรวจใหม่` instead. This
  action is currently a UI mock: it only explains that a real retest will create a
  linked new Order No. and will receive a LAB NO. only when specimen is received;
  it does not call a Write API or mutate CPOE/LAB data.
- Create opens CPOE Order App `6a927860422c1ca959829d26` in manual-VN mode;
  the CPOE source now searches Visit by VN and reuses its patient card. EMR opens
  Form `6a4f64e7f8cdfc54cec16488` at the Order Visit through a read-only deep link.
- These are updates to the existing main CPOE and EMR Form IDs, not new LAB-only
  Forms. Do not import either JSON as a duplicate Form; apply the manual-VN and
  Visit deep-link changes to those existing Forms in place.
- Receive is wired to Process `6a94f634422c1ca959829d70`: it creates/reserves LAB NO.,
  records the receipt in Lab Work Item and creates/refreshes the Outbound Order without
  dispatching to Agent. Item rejection is wired to Process `6a79ff46d5218a5b6a26bebc`.
  Whole-Order cancellation calls `action=cancel_order` on the existing Worklist Process:
  it requires a reason, writes an Order-level audit lock, and cancels all eligible Work Items.
  An Outbound row is cancelled only before its first Agent attempt; after dispatch the API
  fails closed until the LIS cancellation contract exists.
- Static JSON/event/binding checks and SDForm validation pass; Builder/Preview
  and deployed runtime evidence are still required.

## LAB persistence artifacts

- Lab Work Item is the central operational record for receive/process/result/reject state.
  The user recreated it as Form ID `6a95c750422c1ca959829e8a` on 2026-09-01.
  Its live collection is `zdata_lab_work_item`. CPOE Order/Item remains a read-only source
  and trace reference for the receive/LAB NO./manual-result status flow.
- Whole-Order cancellation is recorded once in `zdata_lab_order_cancellation`, keyed by the
  source CPOE Order `_id`. Its `pending/applied/conflict` state makes retries idempotent on the
  standalone MongoDB server, while each affected Work Item retains reason/actor/time. The
  cancellation does not mutate CPOE Order or CPOE Item records.
- The canonical Work Item schema now includes `visit_id`. LAB NO. generation writes it for
  new records and Receive retries backfill it on older received records so Agent callbacks can
  require the full `order_no + lab_no + HN + Visit ID` identity.
- Result persistence is standardized on Report `6a8d4334f851000f28e5025b` and Result Item
  `6a8bc91df851000f28e501fb`. Legacy Result Item `6a7aa641935ed08882467374` is read-only
  fallback; Worklist Manual writes must not create new rows there.
- `lab-outbound-order-v1.json` — import candidate for one Agent transport record per
  `order_no`. It links to `work_item_id` and source CPOE IDs, stores the normalized
  request/response snapshots, current `hl7_status`, `dispatch_id`, retry/error fields,
  timestamps and append-only attempt summary JSON.
- The Outbound Form must never store Agent URL, Agent key, bearer token or other
  credentials. Those remain only in the protected API Factory Process.
- First import Form ID `6a95cb80422c1ca959829e8c` parsed in Tree view but its Builder
  canvas was blank. The corrected candidate uses one shallow `grid → grid-col → field`
  level with unique keys/IDs and passes static validation; re-imported Builder/Preview,
  permissions, unique `order_no` enforcement and runtime API writes remain unverified.
- The corrected Outbound form now displays in Builder. Its live collection name is exactly
  `zdata_lab_outband_order` (`outband`, not `outbound`) and must be used verbatim by APIs.
- Local LAB NO./Receive APIs now reserve one Work Item per CPOE Item, persist receipt plus one
  Outbound snapshot idempotently, and never call Agent inside the transaction. The Worklist
  overlays status/LAB NO. from Work Item so a refresh does not fall back to CPOE `sent`.
- LAB NO. and Receive use `mongoTxn` on replica sets. On standalone MongoDB they fall back to
  atomic counter / compare-and-set writes; Work Item and Outbound `_id` values keep retries
  idempotent. A failed concurrent allocation may leave a sequence gap, which is never reused.
- Receive maps CPOE priority `1→R`, `2→A`, `3/4/5→S` (and accepts R/A/S or their text names).
  `collected_at` is optional: copy and validate it when the order source supplies it, otherwise
  omit the field without fabricating a collection time or blocking Outbound readiness.
- Receive builds the Outbound snapshot only after receipt persistence is resolved. A retry of an
  already-received Item reuses the original Work Item `received_at`; it must not replace that value
  with the retry time.
- Deployed runtime retry of safe mock Item `6a956902422c1ca959829e3b` confirmed Work Item and
  Outbound carry the same original receipt time. Next runtime step is testing Agent Submit directly
  with the stored Outbound payload before wiring dispatch/reconcile into the Worklist.
- Direct VPN curl reached Agent and passed key validation, but Agent rejected the approved 12-digit
  `SSYYMMDDNNNN` LAB NO. because its current pattern still expects 10-digit `YYMMDDNNNN`. Keep the
  stored HIS LAB NO. stable; the Agent contract/configuration must be updated before retry.
- Agent updated the pattern and direct VPN curl then returned `202 Accepted`, `duplicate:false`,
  `dispatch_id:12`, routed to `rax-file`. This proves queuing at Agent, not LIS receipt or Outbound
  persistence; direct curl bypasses the initCraft transport log update.
- The same payload through Agent Submit Process still returns `agent_unreachable` with no HTTP
  status. Mac VPN connectivity does not extend to the server-side API Factory runtime; production
  dispatch requires an approved server-to-Agent VPN/private route, firewall allowlist, or relay.

## Canonical design inputs

- `../../../design/Lab_design.md`
- `../../../design/Lab_design-contract.md`
- `../../../design/Lab_implementation-handoff.md`
- `../../../design/lab-result-canonical-contract.md`
- `../../../02-his/ui/lab-workbench-stock-pattern-mockup.html`

## Guardrails

- Read `../../../02-initcraft/governance/from-codex-backup/SDFORM_JSON_RULES.md` before creating or editing SDForm JSON.
- Validate every candidate with `../../seed/tests-tools/validators/check_sdform_json.py`.
- Keep working JSON here; do not edit existing files under `../backup/` or `../best-practices/`.
- Do not include credentials, environment URIs, production patient identifiers or real clinical results.
- Static validation does not prove Builder/Preview/runtime behavior.
