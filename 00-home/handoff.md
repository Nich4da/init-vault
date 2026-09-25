---
type: meta
title: Conversation Reset Handoff
updated: 2026-09-18
status: inactive
---

# Conversation Reset Handoff

## Resolved reset — X-ray cancellation scope corrected (2026-09-18)

The user confirmed the selected-item scope in the clean chat. The local Worklist
Form now sends checked `item_ids` with `cancel_order`; the API preflights and
cancels only those X-ray items, sends `IsDeleted:true` only for their Accession
numbers, and retains an Order-keyed audit with `item_ids` plus `history[]` for
later selections. A resulted sibling is not read as a blocker. Empty selection
is disabled in the Form and rejected by the API. Old Form calls without
`item_ids` fail closed. Dispatch blocks only selected items during RIS pending;
legacy whole-Order records remain a whole-Order block. No live cancellation or
production DB write was made.

The new selected-item, sibling-result, multi-selection, retry, audit-history,
and dispatch-scope tests pass, as do the related X-ray API/Form/retest suites
and SDForm validator. Of 16 X-ray suites, 14 pass; two unrelated existing suites
fail against their own RIS schema fixtures/messages (`test_xray_order_ris_params`
and `test_xray_ris_team_apis`). Runtime import and RIS ACK/queue UAT remain.
Replace Worklist Process `6a957009422c1ca959829e45` first, then Dispatch
Process `6a967029422c1ca959829edc`, then import the generated
`Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json` together before UAT.
No commit or push was made in the dirty shared worktree.

- **Trigger:** The prior implementation and explanation treated `cancel_order` as whole-Order only. The user clarified that the *same button* must cancel only the checked X-ray item(s) under an Order; selecting `SM20260910DX002` in `R2609100001` must not touch sibling `SM20260910DX001`, which already has a result. This is a material scope correction to a live clinical workflow.
- **Confirmed intent:** For each checked, eligible item already sent to RIS, resend its stored Order JSON through the existing X-ray Order Process/GetOrder with the *same* Accession and `IsDeleted: true`. Unselected siblings retain their current state and are not sent. The same button may operate on one or multiple selected items. Preserve successful normal dispatch and no-Accession paths.
- **Verified current state:** Local Form generator `Form-Builder/seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js` has checkboxes, but `submitCancelOrder` sends only `order_id`, `order_number`, and reason, not selected item IDs. Local `Form-Builder/API/api-factory/processes/xray_cpoe_worklist_api.js` loads all X-ray items, makes `risTargets` from all active Accession items, uses one cancellation record keyed by Order ID, and sets every cancellable item to `cancelled`. Its result guard blocks the whole Order if any sibling has a result. Live Worklist/Dispatch `module_api` marker queries on 2026-09-18 found the recent RIS-cancel/dispatch-guard code, but full byte parity was not established. Local Form import status is unverified.
- **Test evidence:** Read-only HIS inspection found `SM20260910DX002` in `R2609100001` (`dispatched`, `IsDeleted:false`, no result), plus sibling `SM20260910DX001` (has result). Local cancel suite and an exact-shape two-Accession dry-run passed, proving current code rejects before RIS/HIS writes. **No live cancellation was sent.** The dry-run result reflects the incomplete whole-Order contract, not the user's corrected intent.
- **Changed paths / Git:** No implementation edits in this clarification turn. Update only this handoff and `00-home/hotcache.md`. X-ray API/Form/generator/test artifacts remain untracked in a heavily dirty shared worktree; numerous unrelated modified/untracked files exist. Do not broadly stage, commit, overwrite, or delete.
- **Rejected assumption:** A resulted sibling must *not* block cancellation of a different checked, pre-result Accession. Do not use `R2609100001` for a live cancellation until item scope is implemented and verified.
- **Open design detail:** Define empty selection safely (recommended: disable cancel), and how cancellation audit/retry is keyed per item or selected set without breaking existing whole-Order history. Avoid treating a partially cancelled Order as wholly cancelled.
- **Historical next step at reset:** Start a clean chat; read `00-home/hotcache.md` first, then this handoff. Restate the selected-item contract and wait for confirmation before edits. This was completed locally as summarized above; live UAT remains.

## Resolution — HL7 inbound correction identity and Gateway metadata (2026-09-07)

The clean follow-up completed the authorized surgical fix. The canonical receiver
now removes only Gateway `xpartnerx` before clinical schema validation, hashing,
and Receipt raw-payload storage; every other unknown top-level field still fails
closed. Agent corrected resends no longer accept or require `corrected_by` or
`corrected_at`, update the existing observation row, and preserve any existing
`last_edited_by`/`last_edited_at`. A focused Worklist regression proves the manual
pencil path still writes those fields from the logged-in HIS username.

The v2 schema, canonical contract, API deployment guide, receiver tests, form/schema
tests, and external dry-run cases were updated. A new no-network runner executes
seven Node regressions plus validation of the three canonical data Forms; it passes.
Three legacy test entrypoints were repaired to resolve their migrated fixture paths.

Runtime replacement target is only Process `hl7_result_upsert_api`
`6a8da8a6f851000f28e50299`. Do not replace the Receipt, Report, Result Item,
Worklist, Receive, Outbound, or Lab No. artifacts for this fix. Valid clinical E2E
remains pending after replacement; no external request, DB write, commit, or push
was performed. The separate Scan HN normalization/banner task remains pending and
does not keep this correction-identity reset active.

## Isolated Cpoe_test_order Hematology visual merge — 2026-09-04

User authorized only the Hemato presentation change in `Cpoe_test_order`
`6a995d064744260ea8c9498c`. The generated clone now combines catalog sections HM and HH
into one visual rail tab labelled `HM / HH` + `Hematology`, while each item retains its real
HM or HH source code in the cart. Inside the merged tab, section headers divide
`HM · Hematology` and `HH · Hematology-Homeostasis`; existing lab-group cards, set rules,
save/send APIs, other sections, and the source `CPOE_app.json` are unchanged. A single-section
LAB scope is deliberately not merged. Generator, targeted runtime simulation, original VN
regression, LAB-scope regression, exact diff-path guard, and SDForm validator pass. Runtime
pending: import `Form-Builder/SDForm/form-factory/forms/cpoe-order-app-vn-picker-v1.json`
over the existing test Form, hard-refresh, and visually verify both sections and a mixed HM/HH cart.
No API/DB write, commit, or push was made.

## Isolated LAB Create button target — 2026-09-04

The user authorized only the LAB Worklist `สร้างรายการใหม่` target change. Read-only live
inspection confirms enabled Form `Cpoe_test_order` is `6a995d064744260ea8c9498c`, the same
target already used by X-ray. The LAB generator, generated Form, and one target assertion now
use that ID. Existing LAB launch parameters (`manual_visit`, `source: lab-worklist`, `lab_scope`,
organization and section codes) are unchanged. No API, Receive, Agent, result, or other button
logic was changed. Form test, SDForm validator, and diff check pass; runtime import/click remains.

## Isolated Worklist Receive correction — 2026-09-04

The recurring red `e is not a function` is now proven from the deployed initCraft v1.6
frontend bundle. Its helper signature is `confirm(message, callback, type, title)`, but the
Worklist passed the title as argument 2 and then awaited the call. On OK, the platform tried
to invoke that string. The generated Form now supplies a real callback and starts the existing
Receive flow only after confirmation; Receive and Agent Process bodies were not changed.

Read-only DB inspection of the reported C43 Item found `current_status: accepted` but no Lab
Work Item, LAB NO., receipt evidence, or Outbound row. Previously successful Work Items remain
intact. The LAB NO. Generator now narrowly recovers this interrupted state only when a legacy
waiting-compatible status has no Work Item and no source receipt evidence. Fresh `sent`, existing
Work Item, and protected non-waiting paths retain their old behavior. Tests and SDForm validation
pass. Runtime pending: replace only Lab No. Generator `6a94f1ed422c1ca959829d6e`, import the
generated Worklist Form over the existing Form, hard-refresh, and test. Do not replace Receive,
Agent Submit, or the Worklist Process for this correction. No DB write, commit, or push was made.

## Isolated Worklist result-view change — 2026-09-04

The user explicitly limited the latest task to the LAB Worklist “ดูผล” flow. Local API/Form
changes now treat the disabled legacy Result Item Form as an empty optional compatibility source,
while canonical Result Item lookup still fails closed. The popup initializes from the selected
Worklist row and therefore shows patient name, HN/VN, LAB NO., specimen, ward/clinic and receipt
time before the result lookup finishes; API data is merged afterward. Its layout follows
`02-his/ui/lab-worklist-mockup.html` with a patient card, result grid and critical banner.
This change does not modify Receive, Agent dispatch, inbound callback/schema, or the unresolved
Agent-resend versus manual-HIS identity contract below. Worklist API/Form tests and SDForm
validation pass. Runtime remains pending: replace Process `6a9434c3422c1ca959829d5e`, import
`Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json` over the existing Form, then reopen
“ออกผล → ดูผล”. No commit or push was made.

## Latest authorized isolated change — 2026-09-03

**Correction after runtime UAT at 21:20:** C34 returned `e is not a function`; the UI
reported receive 0. Read-only DB found the CPOE Item in `accepted` but no matching Lab
Work Item or Outbound, so the earlier statement that fresh-item Receive UAT was ready was
premature. The live Receive body exactly matched local. The likely runtime gap is that a
nested Process does not bind `this.mongoTxn`; LAB NO. generation then fails. Local Lab No.
Generator and Receive now guard that helper and fall back to the existing idempotent
standalone path when absent. Eight LAB suites, including missing-helper regressions, pass.
Both Process bodies must be replaced before another runtime UAT. Do not reuse C34 as a
fresh Item; repair its inconsistent state explicitly or select a different `sent` UAT Item.

**21:32 follow-up:** user replaced both bodies; read-only hashes/lengths match local exactly
(Lab No. updated 21:30, Receive 21:31). The new response is no longer the runtime exception:
it is `lab_no_failed` / Item not waiting for receipt. DB shows both C34 and C64 in the
selected Order are `rejected`, although the stale page still labels them `รอรับ`. Hard-refresh
and create/select a genuinely new `sent` Item. Reusing that Order requires an explicit audited
repair; do not directly force a clinical status without approval.

**21:39 fresh-item UAT:** Receive succeeded for two valid Items. LAB NOs
`106909030005` and `106909030006` are visible in the UI; read-only DB confirms two
`zdata_lab_work_item` rows with `work_status: received` and two matching
`zdata_lab_outband_order` rows with `hl7_status: new`, `retryable: true`, attempt 1,
and `agent_unreachable` / `timeout of 5000ms exceeded`. Creation times 21:39:43 and
21:39:49 prove the Form runs Items sequentially and each Receive blocks on the five-second
Agent attempt before moving to the next Item and refreshing. The red `e is not a function`
toast still appears before the final warning, but the backend request completes and persists;
it is now isolated to the client/Form-platform callback path, not LAB NO generation. Do not
change the connector from inference alone; capture its Console stack or Network Initiator first.

The user explicitly superseded the older receive-button pause for one narrow change:
the existing `รับ specimen` button must receive selected Item(s) and send each persisted
Outbound Order to Agent automatically. This is implemented locally with persistence-first,
post-commit Agent Submit, transport audit, and no rollback of receipt on transport failure.
The user confirms the Submit/Receive APIs were replaced and considers outbound Submit complete:
direct Mac/VPN→Agent transport passed, while live Gateway→Submit→Outbound persistence/audit
also passed. The remaining blocker is only the initCraft server/VPN route to Agent; it does
not block a fresh-item Receive UAT for LAB NO./Work Item/Outbound/CPOE persistence. Eight
related LAB regression suites pass; the 21:20 fresh-item button UAT failed as documented
above and must be repeated only after the two Process replacements.
The reset stays active only for the separate Agent-resend versus manual-HIS correction
identity issue below; do not mix those fields into this outbound flow.

## Paused LAB workflow checkpoint — 2026-09-02

The user has notified the Agent team and paused LAB work here. This checkpoint is
documentation only: no API, Form, schema, test, commit, or push was changed.

### Current process

1. CPOE sends a LAB order.
2. LAB receives the specimen and creates/updates Lab Work Item, LAB NO., and the
   outbound snapshot, then calls Agent Submit after commit. Agent failure does not roll back receipt.
3. Agent Submit may send the outbound message to LIS/Agent.
4. LIS/Agent sends the result to `hl7_result_upsert` as raw JSON
   `{ "params": { ...result fields..., "items": [...] } }`.
5. The callback writes Receipt → Result Report → Result Item → Lab Work Item.
6. The user reports CPOE Item options and all four Process bodies were deployed on 2026-09-02;
   the callback needs another replacement for the later temporary no-role change.

The latest Agent Postman test reached the callback process but returned HTTP 200
with inner `data.success: false`, `code: "FORBIDDEN"`, before payload validation.
On explicit user request, the local callback now temporarily has no active role
guard, so normal roles, guest, no-role, and missing `userInfo` reach schema validation.
The original and guest-only guards remain in a comment.

**Superseding gateway update — 2026-09-03:** initCraft added the External API gateway.
Action `lis.receive` is enabled and maps to Process `6a8da8a6f851000f28e50299`; a dedicated
API key is active, scoped only to `lis.receive`, and linked to a LIS service account.
The endpoint is `POST https://apihis.softmax-one.com/api/v1/external/lis.receive`, using
`x-api-key` and body `{ "params": <result payload> }`. The old JWT/public-token gateway
blocker is therefore resolved. Invalid-payload smoke reached the mapped Process; valid inbound E2E remains;
the temporary no-role Process guard and correction-identity mismatch are not resolved
by the gateway change.

Live auth smoke was rechecked on 2026-09-03 18:52:55 ICT with the newly issued key:
`lis.test` + `ping: hello` returned HTTP 200, `data.status: ok`, trace
`20260903185255-ino4fc` in 0.12s. The key itself is not stored. This verifies gateway
authentication and action execution, not `lis.receive` payload handling or writes.

Historical no-write evidence: `lis.receive` returned HTTP 200 with inner
`code: INVALID_PAYLOAD`, trace `20260903185530-9nufw1`, proving its scope and action
mapping also pass. The response shows the gateway injected `xpartnerx` into the empty
Process params and the strict allowlist rejected it. The user confirmed later on
2026-09-03 that the team stopped this injection and confirmed the new contract. No
Receipt/write path was reached in the smoke; inbound clinical E2E remains deferred while
Submit is handled first.

A second historical smoke using `{params:{payload:{}}}` returned the expected missing-field
errors without the `xpartnerx` error (HTTP 200, trace `20260903185630-1zcr27`). This
confirmed where metadata had been added; it is retained as diagnosis, not the current
contract requirement.

Outbound Submit retest on 2026-09-03: `lis.submit` invalid smoke passed gateway/role/
validation. The user then connected VPN and authorized another test of the stored,
idempotent UAT Order. External `lis.submit` still returned gateway HTTP 200 with inner
`agent_unreachable`, `network_code: ECONNABORTED`, `timeout of 5000ms exceeded`, HTTP null,
trace `20260903192649-5rmq8w` in 5.187s. The identical payload sent directly Mac→Agent
returned HTTP 200 in 0.027s with `duplicate:true`, `order_ref:13`, `dispatch_id:12`, and
route `rax-file`. This proves the user's VPN covers the Mac but does not provide the
initCraft runtime's outbound route. External API log status 200 means gateway execution,
not Agent acceptance. The user corrected the desired contract: a public/Gateway
`lis.submit` must persist its Order in `zdata_lab_outband_order`, not act as transport-only.
This is now implemented locally as persist/claim before Agent transport and final audit
afterward; Agent timeout still leaves a retryable `new` record with attempt/error evidence.
Receive passes an internal audit-owner flag so its existing persistence-first flow does not
double-count attempts. Seven related LAB suites pass. After the user replaced the live
Processes, runtime retest at 19:45 updated the existing UAT Outbound from attempt 0 to 1,
stored `new` + `agent_unreachable`/`ECONNABORTED`, and returned its Outbound id; trace
`20260903194549-idgceh`. This proves the new persistence/audit contract. The record itself
predated this retest because Receive had created it earlier. Infra must still fix server
reachability for Agent delivery to succeed. A further retest after the user reconnected the
Agent VPN at 19:57 still timed out with `ECONNABORTED`; trace
`20260903195745-1tve7t`. The same Outbound was correctly updated from attempt 1 to 2 with
another failure-history entry. Therefore reconnecting that VPN did not restore the route
from the initCraft runtime to Agent. The user now plans a fresh-item Receive UAT before
Agent reachability is fixed; expected persistence is LAB NO. + Work Item `received` +
Outbound `new`/retryable + CPOE Item `accepted`, with a transport warning rather than rollback.

### Implemented locally — CPOE item status contract

- Add `rejected` (ปฏิเสธ) and `completed` (ออกผลแล้ว) to the CPOE Order Item
  `current_status` options; `accepted` already exists.
- Receive specimen → `accepted`.
- LAB cancel/reject, at whole-order or item level → affected items `rejected`.
- Agent `overall_status: in_progress` → leave CPOE unchanged.
- Agent complete `resulted` or `corrected` → `completed`.
- Agent `cancelled` → `rejected`.
- Update item records only, not the CPOE Order header. Use compare-and-set and do
  not downgrade a terminal `completed` or `rejected` item.
- The contract is wired locally into `lab_cpoe_receive_api.js`,
  `Lab_Reject_Specimen.js`, Worklist `cancel_order`, and
  `hl7_result_upsert_api.js`; focused tests pass. Live Process/Form replacement and runtime
  E2E remain pending.

### Work remaining when LAB resumes

0. **RESOLVED 2026-09-03:** initCraft replaced the unsuitable JWT/public-token route with the
   External API action/key/service-account gateway described above. Do not resume the old
   token/guard/VPN experiments.
1. In a clean chat, resolve the active correction-identity reset below: Agent
   resend replaces the current same-observation value; only the manual HIS pencil
   action records the logged-in HIS editor/time. Remove Agent requirements for
   `corrected_by` and `corrected_at` from code/schema/tests/contract.
2. Replace/import the local CPOE Item options and four Process bodies, then verify the
   compare-and-set transitions in runtime without changing the CPOE Order header.
3. After the initCraft blocker is resolved, provision the supported Agent credential and rerun
   the callback with a no-write smoke before a valid UAT payload.
4. Verify Receipt, Result Report, Result Item, Work Item, and CPOE after the call;
   cover complete, corrected, cancelled, retry/idempotency, and no partial update.
5. Confirm the Agent's production observation code mapping (`test_code` versus
   `obs_code`) before production use.
6. Runtime-check the already-local Worklist Scan HN Thai Kedmanee normalization,
   scan-after-clear behavior, and banner removal.

## Active reset — Agent resend versus manual HIS correction (2026-09-02)

### Reset trigger

Commit `83ae7b2` was pushed after incorrectly interpreting an Agent `corrected`
callback as the source of the human correction identity. The user has now
confirmed that Agent result delivery and manual HIS editing are separate flows.
The incorrect callback/schema requirement is already present on `origin/main`,
so do not continue implementation in this conversation or revert the whole
commit.

### Confirmed intent

1. An Agent resend for the same LAB test/observation replaces the value in the
   existing current Result Item field. It does not create another clinical row.
2. The `ผลก่อนหน้า` column is longitudinal HIS history: the latest completed
   value of the same test from an earlier Order/Visit for that HN. It is not the
   prior Agent payload or result version.
3. “แก้ไขผล” means a user manually clicks the HIS pencil icon. Only this flow
   records the editor and edit time, using the currently logged-in HIS user.
4. Agent payloads must not be required to send `corrected_by` or `corrected_at`
   for this manual-edit audit.
5. Keep the Scan HN, completed-history, previous-before-current UI, and Result
   Item overwrite behavior from `83ae7b2`; fix only the mistaken correction
   identity contract and its dependent tests/docs.

### User authorization received 2026-09-07

The user explicitly authorized the surgical correction-identity/security fix and asked for the exact initCraft replacement list. This does not waive the clean-task requirement. The implementation task must edit only the inbound receiver contract and dependent local schema/tests/docs, verify the existing manual-pencil path, and leave Worklist UI, Receive specimen, outbound Submit, Lab No., and the three live data Forms unchanged.

### Incorrect work already pushed

- `Form-Builder/API/api-factory/processes/hl7_result_upsert_api.js` accepts and
  requires `corrected_by`/`corrected_at` for corrected payloads and derives
  `last_edited_by`/`last_edited_at` from them.
- `Form-Builder/SDForm/api-factory/schemas/agent-to-his-result-v2.schema.json`
  exposes the same mistaken contract.
- Agent callback/schema tests and `design/lab-result-canonical-contract.md`
  encode the same assumption.
- `00-home/hotcache.md` currently describes the mistaken behavior.

No implementation file was edited after the user's correction. Preserve all
unrelated dirty workspace files and do not use `git add -A`.

### Additional confirmed Scan HN runtime issue

- Runtime scan succeeded initially, including on `ทั้งหมด`, but later scanning
  HN `6900001` on `รอรับ` produced `อ่าน HN ไม่ได้: ุตจจจจๅ`.
- This is Thai Kedmanee keyboard-layout translation, not an unreadable barcode:
  `ุ=6`, `ต=9`, `จ=0`, `ๅ=1`. The notification proves the document-level scan
  listener is still active after `ล้าง HN ที่สแกน`.
- Remove the banner copy `คง HN นี้ไว้เมื่อเปลี่ยนแท็บสถานะ`.
- The follow-up must normalize Thai-layout scanner characters to digits before
  numeric HN validation, then test repeated scans and scan-after-clear on
  `ทั้งหมด`, `รอรับ`, and `ออกผลครบ`. Keep one shared root scan handler; no
  status-specific handler is needed.
- User explicitly instructed: never commit or push unless requested.

### Exact next step

Open a clean chat that reads Hot Cache and this active handoff. Restate the five
confirmed rules above and wait for confirmation before editing. Then make a
surgical follow-up commit that removes the Agent correction-identity requirement,
keeps Agent same-observation overwrite, verifies the pencil handler takes the
logged-in HIS user, updates tests/schema/contract/Hot Cache, and runs the focused
LAB regression suite. Also apply and test the confirmed Scan HN normalization
and banner-copy removal above. Do not revert the full `83ae7b2` commit. Leave all
changes local until the user explicitly requests commit/push.

## Prior reset history

## Resolution

The clean chat restored the LAB Worklist baseline locally without changing the
receive implementation. The Form now uses the original `userState.runProcess`
connector for Worklist Process `6a9434c3422c1ca959829d5e`; the `รับ specimen`
button is back to its pre-wiring write-block and contains no Receive Process ID
or receive handler. The matching generator and Form test were updated, the JSON
was regenerated, and Worklist API/Form tests plus the SDForm validator passed.

The four API sources and matching tests were subsequently restored byte-for-byte
to the same pre-button checkpoint: Worklist, Agent submit, Lab No., and Receive.
Lab No. already matched. The restored Receive source has no UAT receive-only or
`submit_agent` branch; the Form still does not call Receive. All four API tests,
the Form test, SDForm validator, and diff check pass.

The user must replace the existing four API Process bodies by their existing IDs,
import/replace the restored Form, and verify rows/counts in the real App. Do not
change the receive button until the user explicitly confirms the baseline works.

## Reset trigger

The LAB receive work was repeatedly misunderstood. The user wanted the last known working LAB Worklist flow restored first, then a single isolated change to the receive-specimen button. Instead, changes were mixed across the Form connector, Receive orchestration, Agent gating, and UAT receive-only behavior.

Runtime regressions now reported:

- v2/raw-fetch Form caused all Worklist rows and counts to disappear with `โหลดรายการไม่สำเร็จ`.
- v3 attempted to restore the connector and add receive-only UAT, but live receipt returns `lab_no_failed` with nested message `API run success`.
- `e is not a function` still occurs.

No current package is approved as the baseline. Stop implementation rather than patching again.

## Confirmed user intent

1. Restore the exact previous LAB Worklist/API flow that was known to load rows and work before receive-button changes.
2. Do not change the receive-specimen button during baseline restoration.
3. Let the user verify the restored baseline in the real App.
4. Only after explicit confirmation, diagnose and change the receive button as one isolated unit.
5. Agent submission is out of scope until the local Worklist flow is stable.

Deferred receive requirement (do not implement during baseline restore): receipt should eventually be allowed without a specimen collection time so the page flow can be tested, while preserving the real collection time for later source delivery.

## Completed versus unverified work

Completed locally but **not runtime-approved**:

- Receive API variants for Agent waiting states and UAT receive-only.
- Form connector variants using raw fetch and callback `runProcess`.
- Packages `lab-cpoe-reimport-20260831-v2` and `lab-cpoe-uat-receive-only-20260831-v3`.
- Automated API/Form tests and static SDForm validation passed, but live behavior disproved their adequacy.

Do not import either v2 or v3 as a baseline.

Database inspection was stopped on user instruction. Only database names were listed read-only; no LAB collection was queried and no database write occurred.

## Changed paths and Git state

Checkpoint commit `b41a525` contains the earlier mixed LAB/X-ray checkpoint. Post-checkpoint, these LAB paths are modified or untracked:

- `Form-Builder/API/api-factory/processes/lab_cpoe_receive_api.js`
- `Form-Builder/API/tests-tools/tests/test_lab_cpoe_receive_api.js`
- `Form-Builder/API/tests-tools/tests/test_lab_cpoe_worklist_form.js`
- `Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json`
- `Form-Builder/seed/tests-tools/scripts/update_lab_cpoe_worklist_ui.js`
- `02-his/handoff/lab-cpoe-uat-receive-only-20260831-v3/`
- `02-his/handoff/lab-cpoe-uat-receive-only-20260831-v3.zip`
- `00-home/hotcache.md`

There are unrelated Obsidian/user changes. Do not use `git add -A`, do not commit this incomplete reset state, and do not discard user-owned changes.

## Checks performed

- Local tests passed for Receive, Worklist, Lab No., Form behavior, and SDForm structure.
- Live evidence overrides those tests: list loading, Lab No. generation, and the runtime exception remain broken.
- No verified runtime network trace or exact live Process revision has been captured.

## Rejected assumptions

- Do not assume `globalThis.fetch` is a safe replacement for the previously working connector.
- Do not assume callback `runProcess` is the sole cause of `e is not a function` without a live stack/network trace.
- Do not treat `API run success` as a successful Lab No. generation; the nested Process result is `success:false`.
- Do not keep patching Receive while the baseline itself is unverified.
- Do not use v2 or v3 merely because automated tests pass.

## Open decision

The exact baseline artifact must be identified. Prefer a user export of the last working Form and the exact live Process bodies/IDs. If unavailable, inspect Git/package history read-only and present one candidate baseline for user confirmation before editing.

## Exact next step

Open a new chat. It must read `00-home/hotcache.md` first and this active handoff second. The new chat should restate:

> Restore the last known working LAB Worklist baseline only; make no receive-button change yet.

Then inventory the candidate baseline files and live IDs read-only, present the proposed restore set, and wait for user confirmation before any file edit or import package is created.
