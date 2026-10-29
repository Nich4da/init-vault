# QSNICH EMR v2 Form Factory model reference

## Provenance and safety

- Exported read-only from Form Factory on 2026-10-24 (Asia/Bangkok) through `Export Model`.
- Live form: `EMR v2`, Form ID `6ada06229291822e416c21cb`, authoritative owner `QSNICH Admin`.
- Repository snapshot: `Form-Builder/SDForm/form-factory/forms/emr-v2-form-model-export-sanitized-2026-10-24.json`.
- Sanitized snapshot SHA-256: `a3562f62a3237fa3b20d0363d9335732f49cb86aaecfa25cf5b32f6c5e811af8`.
- The raw export contained one hard-coded JWT query token in the Refer public-app URL. The repository snapshot replaces only that token with `[REDACTED_JWT_FROM_LIVE_EXPORT]`; never restore, publish, log, or copy the raw token.
- No live Save, Publish, clinical action, patient write, or Factory mutation occurred. No patient values or screenshots are packaged.
- Static validation passed. It warned that the root `scan-code-ui` sits outside a container so its `columnSpan` has no effect, and that no template exists for comparing `scan-code-ui` options.

This is evidence of the exported client model. It does not prove server process code, authorization, clinical correctness, or runtime success.

## Model shape

The export uses the SDForm v3 contract:

- Top-level keys: `fields`, `formConfig`.
- `formConfig`: `modelName=formData`, `refName=sdForm`, `rulesName=rules`, `layoutType=PC`, top-position labels, right-aligned label class, 120 px label width, `jsonVersion=3`.
- Form-level `functions` and all five form events are empty. Operational behavior lives inside widget options and button handlers.
- `formConfig.cssCode` is about 64k JavaScript string characters.
- 49 component nodes: 12 `vue-ui`, 10 `tab-pane`, 8 `grid-col`, 4 `grid`, 3 each of `tab`, `card`, `list-ui`, and `button-ui`, plus one `text-input`, one `apexchart-ui`, and one `scan-code-ui`.
- The 12 `vue-ui` widgets contain about 156k characters of template, 305k of `onCreated`, 33k of `onMounted`, and 1k of `onUnmount` code.
- The export embeds 82 unique 24-character artifact IDs. Treat these as tight deployment coupling, not portable configuration.

## Widget topology

```text
main_app tab
├─ Unit Queue → visit_unit list
├─ My Room
│  ├─ call-next button
│  ├─ Check-in button
│  └─ visit_room list
├─ EMR
│  ├─ opd_card patient header and visit orchestrator
│  ├─ emr_box three-column grid
│  │  ├─ left: m_history + history/registry tabs
│  │  │  ├─ treat_summary
│  │  │  └─ registry_card
│  │  ├─ center: emr2_soap
│  │  └─ right: order tabs
│  │     ├─ order_card
│  │     ├─ item_card
│  │     ├─ vx_today_card
│  │     ├─ appt_box
│  │     └─ cost_summary
│  ├─ action_bar_card
│  │  ├─ emr2_labs
│  │  └─ action_bar_btns
│  ├─ refer_emr_card
│  ├─ hidden sys_box → vid field
│  └─ off-screen BMI ApexChart preload
├─ Completed → visit_done list
└─ root scan_code listener
```

The three EMR columns use the runtime classes `emr2-col-left`, `emr2-col-center`, and `emr2-col-right`. The visual reference records the observed 24-column `6 / 11 / 7` result.

## Primary state flow

`opd_card` is the client orchestrator.

1. A queue-row action stores the selected Visit Tran on `form.$examTran` and switches to the EMR tab.
2. `opd_card.vueState.setTran(row)` sets its local `tran`, loads BMI, vitals, exam timer, and vaccine context, then shows or hides the EMR body and action bar.
3. On the next tick it writes the Visit ID to hidden field `vid` and calls sibling methods through `getFieldRef`:
   - `m_history.mhLoadFromTran`
   - `treat_summary.tsLoadFromTran`
   - `registry_card.load`
   - `emr2_soap.e2Load`
   - `order_card.ordLoad`
   - `item_card.itmLoad`
   - `vx_today_card` through header vaccine state
   - `appt_box.aptLoad`
   - `emr2_labs.e2lLoad`
   - `refer_emr_card.rfoLoad`
4. Widgets that mount after selection also read `form.$examTran` so a late-mounted tab can recover context.

Two generated guards reduce duplicate work:

- `form.$e2Loaded` suppresses the same visit load arriving through feed and self-mount paths within two seconds.
- `form.$e2Req` coalesces identical in-flight `runProcess` calls and briefly reuses the result for 300 ms; later callbacks receive copied `res.data`.

Do not replace those guards with long-lived caching. The short windows intentionally avoid stale clinical data after writes.

## Queue contracts

All three lists read Visit Tran Form `6a461235e521219e514d1c4b`, limit to 30 rows, and use Bangkok-local calendar logic by adding seven hours before deriving the date.

| List | Filter intent | Ordering | Important behavior |
|---|---|---|---|
| `visit_unit` | today's `waiting` visits in the current unit, front desk/current room, with room queue-type handling | priority descending, queue timestamp ascending | loads `call_limit` through `queue-call-front` (`6ab0bb0afc8b9ef3e717b010`) and hides unsafe cross-row call actions until known |
| `visit_room` | today's `called`, `in_progress`, or `skipped` visits in the current unit and room | priority descending, queue timestamp ascending | polls vaccine dispatch state every 20 seconds and clears the timer on unmount |
| `visit_done` | today's `done` visits in the current unit | checkout time descending | searchable by VN, HN, first name, and last name |

Row actions:

- Unit Queue: call, history-taking, move room, transfer.
- My Room: history-taking, open EMR, skip/recall, move room, transfer, vaccine administration.
- Completed: open EMR read-only/history context.

## Component contracts

| Widget | Responsibility | Main integration surface |
|---|---|---|
| `opd_card` | patient banner, allergy/vaccine safety strip, BMI/vitals/growth, timer, print/history/fullscreen, visit fan-out | Person Form `6a37d3bd4cfbfdbe257fc912`; BMI `6a4689ef39179670f85ba2a2`; Vital Sign `6a470b4939179670f85ba2d8`; allergy sync `6a50cc20e97c6d6bbf111ce0`; OPD report `6a9679108ef1cc1e027f27ed` |
| `m_history` | personal medical-history summary/edit state | history Form `6a940562422c1ca959829d51`; process `6a94062170aba128180fbce9` |
| `treat_summary` | prior-visit summary, current/historical LAB and X-ray result views, sensitive-result re-auth and PDF grants | summary `6a9574cc1812c7078a067299`; LAB board `6ab3be31cec3020e8562a2c9`; X-ray history `6ad58d76481c196fbb339ae8`; EMR History `6a96557e422c1ca959829eae` |
| `registry_card` | disease registry list and visit/person navigation | registry process `6a51a09c6e185ae01ab5bb4d`; Visit `6a40fdec4b6dfdf45acbfbce`; Person `6a37d3bd4cfbfdbe257fc912` |
| `emr2_soap` | current-visit SOAP, clinic journey, consult, clinic subforms, density modes | SOAP process `6ada1ba0abcbb06488ffb615`; Clinical Note `6a957607422c1ca959829e59`; Visit Tran `6a461235e521219e514d1c4b`; S/O/P/A/Consult Forms mapped by ID in the model |
| `order_card` | medication orders by clinic, send/cancel/recall/edit | Drug Order `6a70b8cd74be9b0d6e2dca74`; list/send/cancel processes `6a71fe5f29c75d41e9c7e9cb`, `6a757d1bf7bf7668d7673c63`, `6a7822e11eb17ebfd41dd4d4` |
| `item_card` | LAB/X-ray/service orders by clinic, result-refresh bridge, cost source | CPOE Order App `6a927860422c1ca959829d26`; same list/send/cancel processes as `order_card`; Visit-scoped WebSocket with explicit unmount cleanup |
| `vx_today_card` | due/recommended vaccine view and send state | `vx-engine` `6ad5f14921fe5a1471b50fce`; `vx-order` `6ad63a8ef2880767e1b78170` |
| `appt_box` | current-patient appointments | APPT Booking `6a8c472df851000f28e50229`; Doctor Booking `6a97b33a422c1ca959829fe1` |
| `cost_summary` | derives visit totals from `item_card` order state | sibling-state read; excludes cancelled/reversed and reports draft counts separately |
| `emr2_labs` | current-VN LAB/X-ray result counts and drawer | LAB board `6ab3be31cec3020e8562a2c9` |
| `refer_emr_card` | Refer In/Out workflow, registration, hospital search, case actions, appointment coordination | 23 named process IDs in its `REFER_API` map; button bridge through `globalThis.__emr2ReferOpen` |

## Action-bar behavior

`action_bar_btns` contains eight actions:

1. Medical certificate opens Form `6ac5b9c4481c196fbb32d445`.
2. Refer opens the hidden `refer_emr_card` bridge.
3. Admit currently only reports that the feature is unavailable; it is a placeholder, not a completed workflow.
4. Complete visit performs preflight checks and can send eligible draft orders before terminal state change.
5. Move room opens the move-room flow.
6. Custom transfer opens transfer selection.
7. Automatic transfer performs preflight/order send plus routing processes.
8. Complete + transfer combines terminal and routing behavior.

These handlers are large synchronous `button-ui` strings. They explicitly warn not to introduce top-level `await` or redeclare the compiler parameters `btn` and `index`.

## Implementation conventions

- Custom UI uses Element Plus templates in `options.content` and reactive state in `this.vueState`.
- API calls use `this.getFormRef().userState.runProcess`; Form reads use `crudGetAll`; popup Forms use `openForm` with explicit close/refresh callbacks.
- Sibling orchestration uses `getFieldRef(name).vueState.method(...)`; this is a runtime contract. Renaming a field without updating every reference breaks fan-out silently.
- Cross-widget current-visit state uses `form.$examTran`; dedupe uses `form.$e2Feed`, `form.$e2Loaded`, and `form.$e2Req`.
- `item_card` listens through `connectWebSocket` and unregisters on unmount. `visit_room` owns a 20-second interval and clears it on unmount. `refer_emr_card` registers capture-phase DOM listeners and must retain its cleanup path.
- Generator comments name `gen-emr-v2-model.cjs` and `gen-checkin-model.mjs`. Blocks marked `emr2-feed`, `emr2-hook`, `emr2-once-addon`, `emr2-req-addon`, `emr2-orders-addon`, and similar are generated seams.
- Several copied comments still name legacy EMR Form `6a4f64e7f8cdfc54cec16488`. The live exported v2 Form is `6ada06229291822e416c21cb`; treat the old ID as source-history residue unless a call actually targets it.

## Security and review findings

- The raw export had one embedded JWT in `refer_emr_card`'s public-app URL. The sanitized repository snapshot is the only permissible reference copy.
- `treat_summary` includes a password input for sensitive-result re-auth. The password defaults to empty, is cleared from reactive state before the process call, and no literal credential was found. Re-auth and access control still require server-side verification.
- `treat_summary` hard-codes `http://localhost:9090` as an enabled X-ray viewer base. Treat this as an environment dependency requiring explicit validation on each workstation.
- Several widgets use `innerHTML`, global DOM listeners, or `globalThis` bridges. Keep rendering inputs trusted/sanitized and preserve cleanup on unmount.
- Adult vital warning/danger thresholds are hard-coded in `opd_card`. They are implementation facts, not validated clinical policy.
- The form imports Google Fonts at runtime. Network failure must not make the clinical UI unusable.
- The root `scan_code` widget is intentionally outside `main_app`; validator confirms its `columnSpan` is ineffective there.

## Editing and verification checklist

1. Confirm the exact owning artifact and delivery mode before any live Save or Publish. This exported Form is owned by `QSNICH Admin`, so treat it as read-only unless ownership changes or explicit authority is established.
2. Work from a new local copy; do not overwrite immutable backups or the sanitized evidence snapshot.
3. Locate the smallest owning widget and every `getFieldRef`/global bridge that depends on it.
4. If a block is generator-marked, update the authoritative generator/source fragment when available and regenerate the model.
5. Keep IDs, queue filters, Bangkok date handling, cleanup handlers, and cross-clinic read-only rules intact unless the requirement explicitly changes them.
6. Run `Form-Builder/seed/tests-tools/validators/check_sdform_json.py` on the candidate.
7. Test Builder load, Preview, runtime selection changes, late-mounted tabs, same-patient reload, patient switching, empty/loading/error states, permission denial, WebSocket/timer cleanup, and all affected terminal-action preflights.
8. Never import the sanitized evidence snapshot into production without restoring the Refer integration through a secure configuration mechanism; the JWT placeholder is intentionally nonfunctional.
