---
type: concept
title: HIS data model (his MongoDB — zdata_person / zdata_visit / …)
created: 2026-07-20
updated: 2026-08-17
tags: [initcraft, his, mongodb, data-model, schema, reference]
sources: ["[[his-patient-form]]", "[[his-visit-form]]", "[[his-medical-record-report]]"]
---

# HIS data model (`his` MongoDB)

Live read-only schema of the **`his`** database — the real [[his|HIS]] data, on a **separate
server (159.223.80.155)** from the [[erp-mongodb|`erp`]] instance. ~78 `zdata_*` collections.
Read-only via the `erp-mongodb-readonly` helper (see [[erp-mongodb]] for connection notes).
**⚠ Production PII** (Thai CID, names, addresses) — inspect read-only; never copy patient values
into the wiki. Schema-level only below.

## Core collections
| Collection | Rows* | What it is |
|---|---|---|
| `zdata_person` | 8 | patient master (demographics, address, insurance, relatives, allergy) |
| `zdata_visit` | 62 | encounter (VN, visit_date, service, `pid` link, insurance snapshot) |
| `zdata_visit_tran` | — | exam/queue transaction (backs the [[his-emr-form|EMR]] unit & room queues); **fields confirmed 2026-08-17**, see below |
| `zdata_patient_assessment` | 2 | per-visit vitals + CC/PI + allergy + underlying disease |
| `zdata_person_relate` | 13 | **master** of relationship types (code/name/sort) — *not* a person's relatives |
| `zdata_person_insurance` | — | insurance rows (`xparentx` = person `_id`) |
| `zdata_inscl_main` / `_sub` / `_hos` / `_hos_sub` | — | insurance code masters ([[his-insurance]]) |
| `zdata_person_prename` / `_education` / `_mstatus` / `_occupation` / `_race_nation` / `_religion` | — | coded-field masters |
_*row counts as sampled 2026-07-20 (tiny — looks like a test/seed dataset)._

## Join keys (for reports/queries)
- **person ↔ visit:** `zdata_visit.pid.value` → `zdata_person._id`. **`zdata_visit.xparentx` is a
  confirmed-equivalent alternate** (SDForm's generic parent-link field) — checked live 2026-08-18
  against 11 visits, identical to `pid.value` on every one. Either works as a join key.
- **assessment ↔ visit:** `zdata_patient_assessment.vid.value` → `zdata_visit._id` (`vid` also carries
  `vid.pid`). *(vid.value = visit _id assumed — standard `select-form-input` pattern.)*
- **visit tran ↔ visit:** `zdata_visit_tran.vid.value` → `zdata_visit._id` (same pattern).
- Child/sub-collections use **`xparentx` = parent `_id`** (e.g. `zdata_person_insurance`).

## `zdata_person` — key fields
- **Identity:** `_id` (ObjectId), `hn` (str), `prename` (obj `{value,label,prename_full_name}`),
  `p_fname`, `p_lname`, `p_gender`, `age` (**int**), `birth_date` (**str, AD `YYYY-MM-DD`**),
  `p_cid`, `p_ppn`/`p_foreign`/`p_stateless`/`p_temp` (alt ids), `p_idtype`, `p_mom_cid`,
  `p_twin`, `birth_order`.
- **Coded (obj `{label,value}`):** `prename`, `p_race`, `p_nation`, `p_religion`, `p_occupation`,
  `p_mstatus`, `p_education`, `p_fstatus`, `amphur`, `province`, `tambon`, `now_amphur`,
  `now_province`, `now_tambon` (+ `p_abogroup` code).
- **Address — registered:** `house`, `moo`, `lane`, `village`, `road`, `tambon`, `amphur`,
  `province`, `zipcode` (+ `regis_province`, `original_province`).
- **Address — current:** `now_house`, `now_moo`, `now_lane`, `now_village`, `now_road`,
  `now_tambon`, `now_amphur`, `now_province`, `now_zipcode` ← the doc/report uses these.
- **Contact:** `p_phone`, `p_email`, `line_id`.
- **Insurance ([[his-insurance]]):** `inscl_main_code`, `inscl_sub_code`, `inscl_hos_main`,
  `inscl_hos_sub`, `inscl_hos` (**list** of `{inscl_item_main, inscl_item_sub}`).
- **Relatives:** **`relate` (list)** — each `{ r_code (relationship), r_fname, r_lname, r_cid,
  r_abogroup, r_occup (obj), r_contact, r_telecom }`. บิดา/มารดา/ผู้ปกครอง distinguished by `r_code`
  (resolved against the `zdata_person_relate` master).
- **Medical:** `allergy_main` (**list** `{allergy_item, allergy_type, allergy_lvl, allergy_state}`)
  — the ประวัติการแพ้ยา source; `ailment_main` (list); `or_main`.
- **Other:** `p_pic` (list `{url,…}`), `death_status`, `delivery_rajavithi`, `p_income`, `p_tags`.
- **`legacy` (object, confirmed 2026-08-18) — frozen HOSXP migration snapshot, NOT live-computed:**
  holds `birth` (Thai-BE date string), `age_month`, `age_day` (both strings — the y/m/d breakdown
  the UI needs, since `age` alone is years-only), plus ~50 other old-system fields
  (`hosxp_pcu`, `old_hn`, `father_fname`, etc). Populated on ~94,432 patients migrated from the old
  system; **completely absent on patients registered directly in the new system** (e.g. the
  post-launch test person `6900025`, created 2026-07-27, has no `legacy` object at all). Treat any
  `legacy.*` field as "works for old patients, blank for new ones going forward," not a general
  live field.

## `zdata_visit` — key fields
- **Header:** `vn` (str, `69`+5 autonumber), `visit_date` (str), `dataid`.
- **`pid` (object) — the patient link AND a denormalized snapshot:** `pid.value` = person `_id`;
  also carries `pid.hn`, `pid.prename{value,label,prename_full_name}`, `pid.p_fname`, `pid.p_lname`,
  `pid.p_gender`, `pid.age`, `pid.birth_date`, `pid.p_abogroup`, `pid.p_phone`, `pid.p_pic[]`,
  `pid.p_email`, `pid.identity_keys`, `pid.label`. **⚠ No `p_cid`, no address, no `relate`, no
  allergy in `pid`** → those need the `zdata_person` join.
- **Service:** `visit_service`, `visit_type_time`, `visit_clinic`, `visit_type`, `visit_priority`,
  `visit_doctor`, `visit_note`, `cc`, `visit_diag`.
- **Insurance snapshot:** `inscl_hos` (list, `{inscl_item_main,inscl_item_sub}` each `{label,value}`).
- **Status:** `visit_status`, `consult_status`, `payment_status`, `fu_status`, `admit_status`,
  `refer_status`, `queue_status`, `close_date`, `appoint`, `order_num`.
- **Money:** `vcost`, `vprice`, `vpayprice`, `vactualpay`. **Discharge:** `typeout`.
- **Denormalized:** `birth_date`, `gender_text`, `abogroup_text`, `first_visit`, `diff_day_visit`.

## `zdata_visit_tran` — key fields (confirmed 2026-08-17, via [[his-medical-record-report]])
One row per unit/room queue-stop within a visit (a visit can pass through several). Confirmed
fields: `vid` (object, `.value` → `zdata_visit._id` — the join key), `unit_to`/`room_to` (coded
`{value,label}`, destination unit/room), `doctor_to` (coded), `vtran_status`
(`waiting|called|in_progress|skipped`), `checkin_at`, `qtype` (letter prefix, e.g. `"D"`),
`queue_no` (int), `queue_ts` (sequencing field for FIFO order — **not** a display label despite
the name suggesting otherwise), `queue_label` (**confirmed real and populated 2026-08-18** — a
pre-formatted, zero-padded display string like `"D002"`, matching `qtype`+`queue_no`. Populated
only from ~2026-07-27 onward — null on every row before ~2026-07-20, so still needs the
`qtype`+`queue_no` client-side fallback for older visits. **Not exposed in SQL Factory's field
picker** — it's undeclared in the Visit Tran SdForm schema even though the raw collection has it;
reachable only via a manually-typed Custom expression, not the Field dropdown).

## `zdata_patient_assessment` — key fields
Per-visit assessment (links via `vid`): **vitals** `bp_h`/`bp_l`, `pulse`, `temp`, `rr`, `stature`,
`bmi`, `bsa`; **clinical** `cc`, `pi`, `drug_allergy` (str), `food_allergy` (str),
`underlying_disease` (str). ← candidate source for ประวัติการแพ้ยา / ปัญหาการเจ็บป่วยที่สำคัญ.

## Notes
- **Coded fields are stored as `{label,value}` objects** — read `.label` for display (in LaTeX,
  `\VAR{field.label}`; [[report-factory]] form-model conversion may also flatten them).
- `age` is a **stored int** on person (and snapshotted as `pid.age` on the visit) — not computed at
  query time. The detailed "62 ปี 8 เดือน 3 วัน" form is available **only for migrated patients**
  via `legacy.age_month`/`legacy.age_day` (see above) — no live date-diff compute confirmed for
  new patients.
- Dataset is tiny (8 persons / 62 visits) → a **test/seed** instance.

## Related
- Forms: [[his-patient-form]] · [[his-visit-form]] · [[his-emr-form]]. Insurance: [[his-insurance]].
- Report use: [[his-medical-record-report]] — SQL joins `visit → person`, plus the
  `zdata_visit_tran` queue-number join fix. Conventions: [[zdata-collections]].
- DB access: `mongo-his` read-only MCP, configured 2026-08-17 (see hotcache for setup notes).
