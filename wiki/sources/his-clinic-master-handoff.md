---
type: source
title: HIS — Clinic Master handoff
created: 2026-08-16
updated: 2026-08-16
tags: [his, clinic-master, handoff, sdform]
source_file: "codex-backup/CLINIC_MASTER_HANDOFF.md (also mirrored at HIS/handoff/CLINIC_MASTER_HANDOFF.md in this vault)"
source_type: note
source_date: 2026-08-08
author: user (developer)
---

# HIS — Clinic Master handoff

> A separate initiative from the LAB Workbench work ([[his-lab-workbench-handoff]] and related
> pages) — a generic **Clinic Master** pattern letting an admin register any "outside clinic" /
> specialty clinic, point it at a target form, and drive a shared queue/status UI off that config.
> Read and discussed at length earlier in this same session, but never written up as a wiki page
> until now. Ingested 2026-08-16.

## Scope and definition of done

The end state: an admin defines clinics from one place; users register a patient, pick a clinic,
open the clinic's target form, record treatment status, and close the encounter — all searchable
and reportable afterward. Concretely: Clinic Master is creatable/editable/disable-able; users pick
a clinic from master data (no free-typed duplicates per form); the target form opens bound to the
right patient/visit; queue filters and status buttons match stored values; user/unit permissions
are enforced; there's audit + validation + test cases + a user guide; disabling a clinic or
changing its target form never breaks old data or makes it unopenable.

## Form built so far — `clinic-master.json`

Already exists in this vault at `HIS/sdform_module/clinic-master.json` (`modelName: formData`,
`refName: sdForm`, layout `PC`, `labelPosition: top`) — **UI and field schema only, no
`functions`/`onFormCreated`/`onFormMounted`/`onFormDataChange` or any event yet.**

| field | label | type/source | required | role |
|---|---|---|---|---|
| `code` | รหัสคลินิก | Text, `validation: [unique, code]` | ✓ | business key, never rename once in use |
| `name` | ชื่อคลินิก | Text | ✓ | display name |
| `target_form` | ฟอร์มเป้าหมายของคลินิก | Select Data List (`sdform-db-list`) | ✓ | which form opens/records data |
| `status_field` | ฟิลด์สถานะในฟอร์มเป้าหมาย | Select By Path, sourced from `target_form.form_db.schema` | ✓ | tells a **shared queue screen** which field name in the target form holds status — not a control that renders anything inside the target form itself |
| `clinic_type` | ประเภทคลินิก | Static select | ✓ | `outside_clinic \| specialty_clinic \| disease_clinic \| external_service` |
| `owner_unit` | หน่วยงานรับผิดชอบ | Select By Form (`unit_type = 'clinic'`) | – | routing/permission metadata |
| `by_form` | ผูกข้อมูลตาม | Radio, default `vid` | – | `pid` = patient-level, `vid` = visit-level |
| `owner_user` | มอบหมายให้ผู้ใช้ | Select Data List (`user-list`) | – | routing/permission metadata |
| `status_options[]` | ตั้งค่าสถานะของคลินิก | Sub Form: `op_value`, `op_label`, `op_color` | – | the clinic's own custom status list, decoupled from whatever the target form's own status control looks like |
| `desc`, `sort`, `enable`, `is_show` | — | Textarea / Number / Switch / Switch | – | master-data hygiene (description, display order, active flag, "show immediately" flag) |

## Flow — admin setup (done in the form itself)

Open Clinic Master → fill `code`/`name` → pick `clinic_type` → pick `target_form` → pick
`status_field` from that form's loaded schema → define `status_options` (value/label/color) →
optionally set `owner_unit`/`owner_user`/`by_form` → set `sort`/`enable`/`is_show`/`desc` → save.

## Flow — using the master (not yet built; the real work)

1. Registration screen loads only `enable = true` clinics.
2. Filter by the acting user's permission — not in `owner_user` and not in `owner_unit` → hide or
   block per policy.
3. On clinic selection, store at least `clinic.value` + `clinic.label` on the visit/record.
4. Read `target_form` to open the destination form.
5. Read `status_field` + `status_options` to build filters/badges/transitions/validation on a
   **shared queue screen** — this is the field's only real purpose (confirmed through discussion
   this session): it lets one generic queue read status across many differently-shaped target
   forms without per-clinic hardcoded field names. It does not control anything rendered inside
   the target form itself, which defines its own status UI independently.
6. Pass patient/visit context (HN, VN/visit id, clinic id) into the target form.
7. On save, verify patient/visit references weren't swapped.

**None of this exists in `clinic-master.json` yet** — confirmed the biggest open gap.

## Data contract (proposed, names to confirm against real schema)

```json
{
  "clinic": { "value": "<clinic-master-id>", "code": "COVID", "label": "คลินิกโรคติดเชื้อ" },
  "patient_id": "<patient-id>",
  "visit_id": "<visit-id>",
  "status": "<status-op_value>",
  "target_form_id": "<form-id>",
  "created_by": "<user-id>",
  "updated_at": "<datetime>"
}
```

Never use `label` as a key — only master id/code and status value, since labels can be renamed or
translated.

**Gap found during discussion, not yet in the handoff's own P0–P2 list:** this contract has no
field for a doctor's **free-text order/consult note** — e.g. ordering an outside-clinic consult
(nutrition etc.) where the ordering doctor writes instructions that the receiving clinic's target
form must display read-only. Recommended fix (not yet implemented): add an `order_note` field to
this data contract, and have the target form show it as a readonly context item near the
existing patient-context bar, rather than adding a bespoke field to every target form
individually.

## Work remaining (as recorded, P0 → P2)

- **P0 — confirm before building:** real Clinic Master form/collection in the target environment;
  every target form's real form id/table; whether `target_form` stores an ObjectId, form id, or
  object value; the visit-side clinic-reference field standard; `pid` vs `vid` per clinic; allowed
  status/transitions per clinic.
- **P1 — integration:** clinic selector on registration; save clinic reference with
  patient/visit context; open `target_form` with correct context; permission guard from
  `owner_unit`/`owner_user`; query/list filtered by clinic+status; status-change button + list
  refresh.
- **P1 — validation/integrity:** block save if target form/status field deleted or disabled; guard
  status-value type consistency (string vs number); block cross-patient/visit access via
  URL/payload tampering; duplicate rules across code/type/time window; created/updated-by +
  timestamp + edit reason.
- **P2 — screens/reports:** clinic list (search/sort/filter/enable-disable); clinic queue
  (status/date/owner/visit filters); detail view (patient/visit/clinic/status history); per
  clinic/status/period report; export by permission.
- **P2 — test/deploy:** at least one clinic per type; target forms with differently-named status
  fields; `enable=false`/rename/reassign/retarget behavior; permission levels (admin/unit/assigned
  user/no access); duplicate-submit/refresh/timeout/multi-tab; backup/export before
  production changes; UAT sign-off.

## Cautions recorded

Never rename `code` once referenced; never delete a `target_form`/status field a master still
uses without migrating old records; never query by label instead of `op_value`; never bind only by
HN — always carry patient id + the agreed level (`pid`/`vid`); switching `vid`→`pid` needs impact
testing on duplicate visits and historical reports; `ฟอร์มปลายทาง.json` is only an illustrative
example, not a confirmed production target.

## Confirmed: `disease.json` is a structural twin, not a duplicate to merge

Checked directly: `disease.json`'s field list (`code, target_form, collection_type, owner_unit,
name, status_field, by_form, owner_user, status_options[op_value/op_label/op_color], desc, sort,
enable, is_show`) is **the same generic master pattern as `clinic-master.json`**, just with
`collection_type` where Clinic Master has `clinic_type`. This matches the handoff's own note in
its file table: useful to compare pattern against, but "ไม่ควรนำไปแทน Clinic Master โดยไม่ตรวจ
requirement" (should not replace Clinic Master without checking requirements) — treat as a
sibling master (disease registry) built on the same generic config-driven approach, not as
competing or redundant with Clinic Master.

## Key takeaways

- Clinic Master and the LAB Workbench initiative are **architecturally similar in spirit**
  (generic master + shared queue driven by config) but were built by different sessions with no
  evidence either team was aware of the other's approach — worth comparing patterns if either is
  revisited (e.g. the LAB Workbench's `lab_section`-filtered single app vs. Clinic Master's
  per-record `target_form` pointer are two different solutions to "avoid duplicating the same
  screen per category").
- **Retire the `lab-unit-master.json` file built earlier this session** (`HIS/sdform_module/lab-unit-master.json`,
  a code/name/code_prefix/location/phone/receiving_hours reference form) — it was designed before
  this ingest surfaced that a real, already-populated **Lab/Section Master** exists in production
  (`ประเภทการตรวจ`, form `6a79986bd5218a5b6a26bd15`, collection `zdata_section_code`; see
  [[his-lab-workbench-handoff]]). Do not import `lab-unit-master.json` into initCraft.

## Entities & concepts touched
- [[his-lab-workbench-handoff]] — the parallel LAB initiative discovered in the same ingest.
- [[his-visit-form]] · [[his-emr-form]] — the visit/EMR shapes any target form must fit into.

## Contradictions / open questions
- Whether Clinic Master and the LAB Workbench's `lab_section`/`section_code` routing should ever
  be unified (e.g. could a "clinic" be modeled as just another routed section?) is unexamined —
  no source states an opinion either way.
- The `order_note` free-text gap above is a recommendation made during discussion, not a decision
  the user has confirmed as final.
