# LAB SDForm Working Area

This directory is the user-approved working location for the new LAB Workbench SDForm implementation.

## Current working artifact

- `lab-cpoe-worklist-waiting-v1.json` — local CPOE-backed LAB worklist candidate;
  the CPOE Order header stays read-only while LAB writes operational collections and syncs only
  the affected CPOE Item `current_status`.
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
- The default Worklist and status counts are scoped to the current Bangkok day.
  Crossing midnight resets the visible query to the new day without deleting records;
  prior-day waiting rows disappear from the default view. Exact-HN completed history
  uses the guarded `all_dates` path and remains available across past/current records.
- The API filters CPOE Items by allowed section, then groups by
  `order_id + section_code`. The same Order ID/No. can therefore appear as
  separate Bio and Hemato rows while each row contains only its own Section Items.
- Age is displayed exactly from the patient snapshot (for example `3y 3m 3d`),
  and specimen is an Element Plus dropdown backed by the Worklist Process.
- Doctor display removes an email suffix and shows only the available person name.
- Cancelled/rejected Order rows hide PDF and EMR and show `ตรวจใหม่` instead. This
  action is currently a UI mock: it only explains that a real retest will create a
  linked new Order No. and will receive a LAB NO. only when specimen is received;
  it does not call a Write API or mutate CPOE/LAB data.
- The Order PDF is connected to Report `6a977ac8422c1ca959829f97`. The Worklist
  passes the row's CPOE `order_id`, the same `visit_id` used by the EMR deep link,
  and LAB `section_code`; SQL fails closed unless all three match. Missing context
  disables PDF instead of opening an unscoped report. Order No. comes from CPOE and
  LAB NO. remains blank until receipt creates it in LAB Work Item. Import the current
  SQL/Report Restore packages before replacing the Worklist; see
  `../../../02-his/handoff/lab-order-request-report-v1-import.md`.
- Create opens the enabled `Cpoe_test_order` Form `6a995d064744260ea8c9498c` in manual-VN mode;
  the CPOE source now searches Visit by VN and reuses its patient card. EMR opens
  Form `6a4f64e7f8cdfc54cec16488` at the Order Visit through a read-only deep link.
- These are updates to the existing main CPOE and EMR Form IDs, not new LAB-only
  Forms. Do not import either JSON as a duplicate Form; apply the manual-VN and
  Visit deep-link changes to those existing Forms in place.
- Receive is wired to Process `6a94f634422c1ca959829d70`: it creates/reserves LAB NO.,
  records the receipt in Lab Work Item, creates/refreshes the Outbound Order, then calls
  Agent Submit Process `6a9468c7422c1ca959829d6a` automatically after the receipt commit.
  Agent failure never rolls back receipt/LAB NO.; the Outbound row retains retry/error audit.
  The deployed initCraft v1.6 `field.confirm` helper is callback-based
  (`confirm(message, callback, type, title)`). The Worklist therefore starts Receive only from
  that callback; passing a title as argument 2 makes the runtime invoke a string and display
  `e is not a function` before the backend result.
  Item rejection is wired to Process `6a79ff46d5218a5b6a26bebc`.
  Order-row cancellation calls `action=cancel_order` on the existing Worklist Process:
  it requires a reason, sends the row's `section_code`, writes a Section-scoped audit lock,
  and cancels only eligible Work Items in that Section while preserving the original Order ID.
  An Outbound row is cancelled only before its first Agent attempt; after dispatch the API
  fails closed until the LIS cancellation contract exists.
- Static JSON/event/binding checks and SDForm validation pass; Builder/Preview
  and deployed runtime evidence are still required.

## LAB persistence artifacts

- Lab Work Item is the central operational record for receive/process/result/reject state.
  The user recreated it as Form ID `6a95c750422c1ca959829e8a` on 2026-09-01.
  Its live collection is `zdata_lab_work_item`. CPOE Order remains a read-only source; the
  linked CPOE Item receives only the approved compare-and-set status projection.
- Cancellation is recorded in `zdata_lab_order_cancellation` with explicit `cancel_scope=section`,
  Section code, and affected Item IDs. Its `pending/applied/conflict` state makes retries idempotent
  while each affected Work Item retains reason/actor/time. Legacy Order-scoped records remain readable. The
  cancellation never mutates the CPOE Order header and compare-and-sets affected CPOE Items to
  `rejected` without downgrading an existing terminal `completed` or `rejected`.
- Local status projection is: receive → `accepted`; item rejection/Section-row cancellation →
  `rejected`; Agent `in_progress` → unchanged; Agent `resulted/corrected` → `completed`; Agent
  `cancelled` → `rejected`. The CPOE Order Item Form now exposes `rejected` and `completed` in
  `current_status`. Local tests and validation pass; live replacement/runtime E2E remain pending.
- The canonical Work Item schema now includes `visit_id`. LAB NO. generation writes it for
  new records and Receive retries backfill it on older received records so Agent callbacks can
  require the full `order_no + lab_no + HN + Visit ID` identity.
- Result persistence is standardized on Report `6a8d4334f851000f28e5025b` and Result Item
  `6a8bc91df851000f28e501fb`. Legacy Result Item `6a7aa641935ed08882467374` is read-only
  fallback; Worklist Manual writes must not create new rows there. Because that legacy Form can
  be disabled after migration, an unavailable legacy lookup is now treated as an empty optional
  source instead of failing the result viewer.
- The Worklist result dialog follows `../../../02-his/ui/lab-workbench-stock-pattern-mockup.html`:
  its compact header shows HN/result count, with the pencil and mode badge beside the title; the
  patient-summary card and repeated per-cell labels are intentionally omitted. The result table
  uses the approved profile row and `# / status / รายการ / ค่าก่อนหน้า / ค่าที่ตรวจได้ / unit /
  แปลผล / ค่าปกติ` columns, then merges canonical Result Item values and longitudinal prior
  results from the API. The pencil works in both Item and Order views after specimen receipt:
  Item mode creates/corrects one Item, while Order mode keeps an independent editor per child
  Item and saves only changed rows. Manual entry is available to every authorized LAB Section;
  existing Agent/LIS corrections preserve result source, status and the explicit critical decision
  while recording only the latest HIS editor/time.
- `ไฟล์แนบผลตรวจ` is always rendered below the result table inside the scrollable dialog, so it
  remains reachable for long multi-item results. It uses the proven Builder-exported File Upload
  definition and built-in file storage: PDF/JPG/JPEG/PNG, 10 MB per file, at most 3 files and
  30 MB total per Report. The current metadata array is stored in a stable attachment Result
  Report keyed `attachment-order|<orderId>|<sectionCode>` and overwrites on confirmed edits.
  Upload is Order-only and available as soon as the Order result popup can open, including before
  specimen receipt; uploading alone never changes LAB or CPOE status. Local tests/validation pass;
  re-import and deployed runtime UAT remain required.
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
  Outbound snapshot idempotently, and never call Agent inside the transaction. After commit,
  Receive claims the Outbound row and calls Agent Submit once; concurrent/repeated receipt skips
  a row already queued. The Worklist
  overlays status/LAB NO. from Work Item so a refresh does not fall back to CPOE `sent`.
- LAB NO. and Receive use `mongoTxn` on replica sets. On standalone MongoDB they fall back to
  atomic counter / compare-and-set writes; Work Item and Outbound `_id` values keep retries
  idempotent. A failed concurrent allocation may leave a sequence gap, which is never reused.
- LAB NO. generation also has a narrow recovery for an interrupted legacy receipt: a CPOE Item
  in `accepted`, `prepared`, `ready`, or `dispensed` may re-enter reservation only when no Work
  Item exists and the source Item contains neither `lab_no` nor `received_at`. Existing Work
  Items are still returned idempotently, normal `sent` Items are unchanged, and any receipt
  evidence keeps the non-`sent` Item blocked to prevent a duplicate LAB NO.
- Receive maps CPOE priority `1→R`, `2→A`, `3/4/5→S` (and accepts R/A/S or their text names).
  `collected_at` is optional: copy and validate it when the order source supplies it, otherwise
  omit the field without fabricating a collection time or blocking Outbound readiness.
- Receive builds the Outbound snapshot only after receipt persistence is resolved. A retry of an
  already-received Item reuses the original Work Item `received_at`; it must not replace that value
  with the retry time.
- Deployed runtime retry of safe mock Item `6a956902422c1ca959829e3b` confirmed Work Item and
  Outbound carry the same original receipt time. The local one-button flow is now wired; deployed
  Process replacement and a new safe runtime receipt are still required for end-to-end proof.
- Direct VPN curl reached Agent and passed key validation, but Agent rejected the approved 12-digit
  `SSYYMMDDNNNN` LAB NO. because its current pattern still expects 10-digit `YYMMDDNNNN`. Keep the
  stored HIS LAB NO. stable; the Agent contract/configuration must be updated before retry.
- Agent updated the pattern and direct VPN curl then returned `202 Accepted`, `duplicate:false`,
  `dispatch_id:12`, routed to `rax-file`. This proves queuing at Agent, not LIS receipt or Outbound
  persistence; direct curl bypasses the initCraft transport log update.
- Historical test: the same payload through Agent Submit Process returned `agent_unreachable`
  with no HTTP status while direct Mac/VPN curl worked. On 2026-09-03 the initCraft team reported
  outbound POST fixed; a new one-button runtime UAT must still prove the server route and Outbound
  audit update before production use.

## Canonical design inputs

- `../../../design/Lab_design.md`
- `../../../design/lab-worklist-ui-design-update.md` — approved visual-only alignment with the X-ray Worklist pattern; LAB status semantics and flow remain unchanged.
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
