# Trade Drug / PIS Label Preview

Use this reference for the verified `label_preview` Components widget in the Trade Drug form.

## Resume trigger and current checkpoint (2026-08-07)

When the user says **"ฉลากยา"** or asks to continue the drug-label work, restore this checkpoint first.

### Current state

- The component lists every SIG from `gp_ref.sigs`.
- The old blue **แสดงตัวอย่าง** button and custom modal were removed in the latest version.
- Each SIG has a green **เลือกพิมพ์ฉลากนี้** button which writes its Trade Drug ID and array index into staging fields.
- The saved-record pipeline works: Component -> `drug_id`/`sig_index` -> Report UI -> SQL -> Report Factory PDF.
- Manual Report Factory testing works, and edit/view of an existing Trade Drug record works because runtime `dataId` exists.
- Form Builder Preview and a new unsaved Trade Drug do not have a real record `_id`; warning `3000 ไม่พบ Drug ID ของรายการยา` is expected there.
- The earlier test appeared to work before saving only because a known existing Trade Drug ID was supplied manually.
- Work is paused before deciding how unsaved/new records should behave. Do not redesign the verified saved-record pipeline.

### Pending decision

1. **Save first (recommended):** Submit, reopen the saved record, select a SIG, then open Report UI.
2. **Hybrid:** restore local component preview only for unsaved records; use Report UI for saved records.
3. **Auto-save draft:** save before reporting; more complex and not implemented.

## Verified IDs and asset

| Purpose | ID / path |
|---|---|
| Original Trade Drug form | `6a5fb732a608039c539ebb4f` |
| Clone/test Trade Drug form | `6a70785274be9b0d6e2dca4b` |
| Original SQL baseline | `6a730b17c26bf53d1bac3b21` |
| Cloned label-report SQL | `6a74b09ac26bf53d1bacf142` |
| Drug-label report | `6a744cf8c26bf53d1bacf132` |
| Two-SIG test record (`TRAKAI A`) | `6a697d7bc91cb8030e26d776` |
| One-SIG test record (`ZIAGEN`) | `6a7454d9c26bf53d1bacf135` |
| Clone-form test record | `6a74cb24c26bf53d1bacf155` |
| Generic snapshot in clone | `6a68f411c91cb8030e26d747` |
| High-resolution background | `/Users/nichada/Documents/codex-backup/ฉลากยา(bg3).png` |

## Verified SQL and Report UI contract

- SQL source: `Trade Drug (v1)` / `zdata_pis_drug_trade`.
- Staging Variable Names and report parameters must be exactly `drug_id` and `sig_index`.
- Do not use the Generic ID (`gp_ref.value`) as `drug_id`; SQL expects the Trade Drug document `_id`.
- Do not point this SQL at the clone collection when sending an original Trade Drug ID.
- Direct `:sig_index` works; `TO_INT(:sig_index)` caused Query Error in this environment.

WHERE:

```sql
`_id` = TO_OBJECTID(:drug_id)
AND `is_active` = true
AND :sig_index >= 0
```

SIG Select customs:

```sql
IFNULL(ARRAY_ELEM_AT(`gp_ref.sigs.sig_label_th`, :sig_index), '')
IFNULL(ARRAY_ELEM_AT(`gp_ref.sigs.sig_label1`, :sig_index), '')
IFNULL(ARRAY_ELEM_AT(`gp_ref.sigs.sig_label2`, :sig_index), '')
IFNULL(ARRAY_ELEM_AT(`gp_ref.sigs.sig_indication`, :sig_index), '')
IFNULL(ARRAY_ELEM_AT(`gp_ref.sigs.sig_note`, :sig_index), '')
```

Other aliases are `_id AS drug_id`, `item_name`, `special_symbol`, `gp_ref.generic_name AS generic_name`, `patient_name`, and `hn`.

Verified tests:

- `drug_id=6a697d7bc91cb8030e26d776`, `sig_index=0` returns SIG 1.
- `drug_id=6a697d7bc91cb8030e26d776`, `sig_index=1` returns SIG 2.

Report bindings are flat:

```text
{{patient_name}} {{hn}} {{item_name}} {{special_symbol}} {{generic_name}}
{{sig_label_th}} {{sig_label1}} {{sig_label2}} {{sig_indication}} {{sig_note}}
```

Do not use `{{sig.sig_label_th}}` with this cloned SQL.

## Latest component behavior

- It reads `gp_ref.sigs`, shows one bordered text box per SIG, and exposes only the green print-selection button.
- The selection function resolves saved runtime `dataId` and writes `drug_id` plus `sig_index` to the form.
- A selected-state tag may appear next to the chosen SIG.
- `onMounted` and `onUnmount` need no modal cleanup now that the custom modal was removed.

## Scope

- This is a Drug Master preview, not the patient dispensing/printing workflow.
- Step 1 does not require SQL Factory or Report Factory. Those belong to the later patient/dispensing print flow.
- Mock patient name and HN are visual placeholders only and must not be persisted as Drug Master data.

## Verified field mapping

```text
main drug name       = item_name + special_symbol
parenthesized name   = gp_ref.generic_name
directions           = gp_ref.sigs[].sig_label_th
auxiliary line 1     = gp_ref.sigs[].sig_label1
auxiliary line 2     = gp_ref.sigs[].sig_label2
optional indication  = gp_ref.sigs[].sig_indication
optional note        = gp_ref.sigs[].sig_note
```

`item_name` is a required Trade Drug field populated by the existing `tpu_id.onChange` handler from `tpu.tpu_fsn`. If preview shows `-`, first verify that TMT TPU was selected and Item name is visibly populated; `required` validates submission but does not populate an untouched Preview form.

`gp_ref.generic_name` is the Generic Drug form's `generic_name`, auto-filled from Generic Product `gp.fsn`. It is not `name_th`. Do not substitute `active_ingredient` or an unrelated Select master `name_th` without inspecting the actual record.

## Data-source rule

The supplied working component reads embedded Generic data from:

```js
const model = field.formModel || {};
const generic = model.gp_ref || {};
const sigs = Array.isArray(generic.sigs) ? generic.sigs : [];
```

Do not assume `this.vueState.gp_ref` exists. In the verified preview it did not, and switching `getSigs()` to `vueState.gp_ref` made every label disappear.

Do not choose a `gp_ref` merely because it contains `sigs` while mixing `vueData`, `globalModel`, and `formModel`; that can silently select an old Generic snapshot. If the selected Generic shown in the field differs from the preview, inspect the current form data shape before changing sources.

For `item_name`, preserve the original direct form-model behavior unless runtime inspection proves a different live source:

```js
const model = field.formModel || {};
const itemName = model.item_name || "";
```

When a field is unexpectedly blank, inspect actual runtime values and the visible source field. Do not infer that a database field is available in every runtime object.

## Physical layout

- Landscape label: 8 cm wide × 6 cm high.
- CSS reference conversion at 96 DPI: `302px × 227px` (exact 302.36 × 226.77).
- Lock width, height, and label text size in preview controls.
- Label text: `10px`; telephone: `8px`.
- Purple: `#b186b8`.
- Outer paper: `302px × 227px`, white, 8px radius.
- Inner purple border: inset about 3px vertically and 4px horizontally, 8px radius.
- Header order: logo left, institute name, telephone right.
- Verified logo URL: `https://apihis.softmax-one.com/assets/sdform/6a607f2ba608039c539ebb7c/picture/2026/2026_08/2026_08_03/6a58678ad448dfc9d33e2ba8/logo2_all__2026_08_03_21_07_0796585.png`

## Components runtime pattern

- Assign template-callable state and methods to `this.vueState` in `onCreated`.
- Keep the Template as one root element.
- Avoid a teleported `el-dialog append-to-body` in this preview. Closing it produced `Unable to display this content`.
- Use an inline fixed overlay controlled by `vueState.previewVisible` instead.
- `closePreview()` should only set `previewVisible = false`; do not clear `currentSig` or rebuild the form.
- Do not call `setFormModel()` for a preview.
- Use the uploaded initCraft asset URL for the logo. A Windows path cannot load in the browser, and embedding the original multi-megabyte PNG in JSON risks `sdform__backup_*` quota errors.

## Debug order

1. Confirm TMT TPU is selected and Item name is visibly populated.
2. Confirm `field.formModel.item_name` and `field.formModel.gp_ref` in the same preview session.
3. Compare selected Generic with `gp_ref.generic_name`; mismatch indicates a stale runtime snapshot.
4. Confirm `gp_ref.sigs` is an array before changing Template logic.
5. Keep the last verified working source while investigating; do not replace all sources at once.

## Discarded approaches

- `vueState.gp_ref` as a universal source: not present in this component runtime.
- Selecting whichever candidate model has a nonempty `sigs`: can show stale Generic data.
- `el-dialog append-to-body` for this builder preview: unstable on close.
- Local `C:\...\logo.png` paths: inaccessible to the web runtime.
- Embedding the 2 MB source logo as base64: inflates JSON and can exhaust browser backup storage.
