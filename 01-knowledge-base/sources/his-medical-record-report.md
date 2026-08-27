---
type: source
title: HIS — ใบปกเวชระเบียนผู้ป่วยนอก + บัตรฉีก (report + SQL, slow-load diagnosis, queue-number fix)
created: 2026-08-17
updated: 2026-08-27
tags: [his, report-factory, sql-factory, performance, active-build, confirmed-live]
source_file: "/Users/nichada/Downloads/backup-data_report-factory_2026_08_17_21_01_15.zip + backup-data_sql-factory_2026_08_17_21_04_17.zip"
source_type: note
source_date: 2026-08-17
author: user (developer)
---

# HIS — ใบปกเวชระเบียนผู้ป่วยนอก + บัตรฉีก

> The `[[his-medical-record-report]]` link had been sitting greyed-out in [[his-data-model]]'s
> "Related" section since 2026-07-20. This is that page — filed after debugging a real
> slow-loading complaint on 2026-08-17. **Update 2026-08-18: everything below is now verified
> against live data via the `mongo-his` MCP and live-tested in SQL Factory / Report Factory** —
> see "Verified 2026-08-18" for the confirmed final state, the platform gotchas found along the
> way, and one still-open production bug.

## What the report is

**Report Factory name:** "ใบนำส่ง OPD (barcode)" (form-level `pdf_name`) — a lightweight routing
slip: logo (external URL, not embedded), 2 barcodes (`{{hn}}`, `{{vn}}`), a couple of HTML tables.
10 content widgets total, no embedded base64 images — **the report content itself is not the
performance problem**.

**SQL Factory name:** "ใบปกเวชระเบียนผู้ป่วยนอก + บัตรฉีก" (`_id`
`6a5dc9791aca557f203e2814`) — the query that supplies its data, `pdf_from: zdata_person`,
one param `xparentx` (label "Visit ID", `param_default: "6a6719623f778964ee0afba8"` — a real test
visit id captured in the 2026-08-17 export, useful for future testing).

## Original query (as exported 2026-08-17)

```sql
FROM   zdata_person
JOIN   zdata_visit  ON  zdata_person._id = zdata_visit.xparentx     -- hint: UNWIND
WHERE  zdata_visit._id = CONVERT(:xparentx, 'objectId')
  AND  zdata_visit.xrstatx  NOT IN (0,3)
  AND  zdata_person.xrstatx NOT IN (0,3)
```

Selects ~28 person/visit fields (name, address, allergy, insurance labels via `IFNULL`/`CASE`
custom expressions, `visit_date`, a `CASE`-mapped `visit_type_text`, etc.) — nothing unusual there.

## Performance diagnosis: query starts from the wrong table

**Symptom reported by user:** the report loads "ค่อนข้างช้า" (fairly slow).

**Finding:** the query is `FROM zdata_person`, joined out to `zdata_visit`, but the actual filter
(`WHERE zdata_visit._id = ...`) targets the **joined** collection's `_id`, not the base table's.
Compare to the one other real SQL Factory example on record ([[sql-factory]]'s `vms_car`
example): `` `_id` = CONVERT(:_id,'objectId') `` filtered **directly on the `FROM` table** — the
fast, index-friendly shape. This report's query does the opposite: it (likely) evaluates the
`zdata_person` ⋈ `zdata_visit` join across some/all of both collections before narrowing down to
the one matching visit, instead of filtering `zdata_visit` to one indexed document first and then
looking up its one person.

**Recommended fix:** flip the query to drive `FROM zdata_visit`, filtered by `_id` (indexed, O(1))
first, then join out to `zdata_person`:

```sql
FROM   zdata_visit
WHERE  zdata_visit._id = CONVERT(:xparentx, 'objectId')
JOIN   zdata_person ON zdata_person._id = zdata_visit.pid.value   -- see his-data-model join key
  AND  zdata_visit.xrstatx  NOT IN (0,3)
  AND  zdata_person.xrstatx NOT IN (0,3)
```

**✅ Confirmed 2026-08-18 — the original join condition was fine after all.** Queried
`zdata_visit.xparentx` directly against `zdata_visit.pid.value` for the report's test visit
(`6a6719623f778964ee0afba8`) plus 10 more random visits: **identical on every one.**
`xparentx` is SDForm's standard generic parent-link field (same pattern as
`zdata_person_insurance.xparentx`) — it just wasn't documented in [[his-data-model]] as an
alternate to `pid.value`. The only real bug was ever the `FROM`/`WHERE` mismatch, not the join
key. [[his-data-model]] updated with this equivalence.

**Fix applied and confirmed working 2026-08-18** — cloned into a new SQL Factory record ("...
(optimized FROM visit)", Clone Data / insert-new-id, original left untouched) with `sql_from`
flipped to `zdata_visit` and the join reversed to bring in `zdata_person`. **Hit a real platform
gotcha doing this via file import** — see [[sql-factory]] "Two representations of JOIN" — editing
only the top-level `sql_join` silently did nothing; the actually-executed graph lives in
`sql_options.join`, a second copy the builder UI doesn't obviously expose. Fixed by editing both.
SQL Test with the same `xparentx` now returns the correct row.

## Second finding: the queue number ("D001"-style codes) is not in `zdata_visit`

Separate ask in the same session: add the OPD queue number (as seen on the live EMR "My Room"
screen, e.g. **D001**) to this report.

`zdata_visit.visit_priority` (label "คิวตรวจ" — easy to mistake for "queue number") is **not**
the queue code. Confirmed in `visit.json`: it's a Radio Button, `10 = ตามคิว` (routine — matches
what the user saw stored as English "routine"), `20 = เร่งด่วน`, `30 = STAT`. It only drives sort
order (`orderBy: vid.visit_priority DESC` in the EMR queue), not the displayed text.

The real queue code is computed client-side in `Form-Builder/SDForm/sdform_module/EMR_form/EMR.json`'s
`visit_unit`/`visit_room` ListViews:

```js
function(){
  var l = row.queue_label;
  if (l) return l;
  var n = row.queue_no;
  return n ? ((row.qtype || '') + ('00'+n).slice(-3)) : '-';
}
```

i.e. `qtype` (a letter, e.g. `"D"`) + `queue_no` zero-padded to 3 digits — e.g. `qtype="D"`,
`queue_no=1` → **"D001"**.

**✅ Correction 2026-08-18 — `queue_label` is real, not dead code.** Queried
`zdata_visit_tran` directly: the test visit's transaction row has `queue_label: "D002"`,
pre-formatted and zero-padded, matching what the EMR shows live. Sampled 188 rows: **103 have a
populated `queue_label`, 85 are null** — every null row predates ~2026-07-20, every row from
~2026-07-27 onward is populated. The app started writing this field back around then. So the
client-side "check `queue_label`, else compute from `qtype`+`queue_no`" logic in `EMR.json` is a
genuine fallback for pre-cutover visits, not defensive dead code as first assumed.

**Why it never showed up in SQL Factory's field picker:** the picker is driven by the **Visit
Tran SdForm's declared field schema**, not the raw MongoDB collection — `queue_label` isn't
declared there even though the collection has it. Confirmed a plain (non-dropdown) **Custom**
expression can still reference it directly by raw path, same as other fields already used this
way in the query (e.g. `` `zdata_person`.`prename.prename_full_name` ``).

**These fields live on a separate collection from `zdata_visit`**: the `visit_unit`/`visit_room`
ListViews in `EMR.json` use `formId: 6a461235e521219e514d1c4b` (**Visit Tran**), confirmed as
`` `queue_no`.value = zdata_visit_tran `` in the live SQL Factory table picker on 2026-08-17
(matches the `zdata_visit_tran` stub already in [[his-data-model]], previously undocumented beyond
"exam transaction (backs the EMR)"). `zdata_visit_tran` joins back to the visit via a `vid` field
(object with `.value`) — the EMR's `orderBy: [vid.visit_priority DESC, queue_ts ASC]` confirms
`vid` is the nested visit reference and `queue_ts` is a separate sequencing field (not a label —
flagged after the user initially mis-mapped it to `AS queue_label` in the builder).

### Recommended JOIN + SELECT to add to this report's SQL

| Type | Hint | SdForm | Table | ON |
|---|---|---|---|---|
| LEFT JOIN | UNWIND | Visit Tran (v1) | `zdata_visit_tran` | `` `zdata_visit`.`_id` = `zdata_visit_tran`.`vid.value` `` |

*(LEFT not INNER — a visit without a queue-transaction row yet shouldn't break the whole report.)*

| Field | Custom | AS |
|---|---|---|
| `[queue_no] หมายเลขคิว` | — | `queue_no` |
| `[queue_ts] ลำดับคิว` | — | `queue_seq` *(sequencing field, not a display label — don't name this `queue_label`)* |
| `[qtype] Type` | — | `queue_type` |
| `[queue_no] หมายเลขคิว` *(ref, Field unused)* | `` `zdata_visit_tran`.`queue_label` `` | `queue_display` |

**✅ Final, confirmed-working approach (2026-08-18):** select `queue_label` directly, no function
at all — SQL Test on the live visit returns `"D002"` exactly. This is the version actually shipped.

**A `CONCAT(...RIGHT(...))` zero-pad attempt was tried first and confirmed BROKEN** — nested
`CONCAT(IFNULL(...), RIGHT(CONCAT('00', ...), 3))` produced a silent `{"message":"Query Error.",
"sql":""}` (the backend failed to even generate SQL text). Removing just that one field fixed it
immediately, isolating `RIGHT` (or that specific `RIGHT`+`CONCAT` combination) as unsupported by
this dialect. **`CONCAT` alone is fine** — the pre-existing `insurance_display` field in this same
query already nests `CONCAT`+`CASE`+`IFNULL`+`ARRAY_ELEM_AT`+`SIZE_OF_ARRAY` successfully, and a
later `age_display` field (below) confirms it again. Confirmed function vocabulary for this
dialect is now: `CASE WHEN...END`, `IFNULL`, `CONVERT(...,'objectId')`, `SIZE_OF_ARRAY`, `CONCAT`,
`ARRAY_ELEM_AT`, `PARSE_JSON` — **`RIGHT` is the one confirmed-broken function.** See [[sql-factory]].

### Bonus field added same session: `age_display` (ปี/เดือน/วัน breakdown)
User asked for age as "62 ปี 8 เดือน 3 วัน" instead of the bare `age` int. Found
`zdata_person.legacy.age_month` / `legacy.age_day` (strings) live in Mongo, sitting next to
`legacy.birth` (Thai-BE date string) — confirmed real via direct query (HN 40290357: `age=62`,
`legacy.age_month="8"`, `legacy.age_day="3"`). **Caveat: `legacy.*` is a one-time migration
snapshot from the old HOSXP system, not a live-computed field** — populated on ~94,432 migrated
patients but **completely absent on patients registered directly in the new system** (confirmed:
the test person `6900025`, created 2026-07-27, has no `legacy` object at all). Any report using
this field will silently show blank month/day for every new registration going forward — accepted
as a known tradeoff rather than attempting live date-diff math (unverified whether this dialect
has date functions at all).

```
CONCAT(IFNULL(`zdata_person`.`age`,''), ' ปี ', IFNULL(`zdata_person`.`legacy.age_month`,'0'), ' เดือน ', IFNULL(`zdata_person`.`legacy.age_day`,'0'), ' วัน')
```
AS `age_display` → confirmed live: `"62 ปี 8 เดือน 3 วัน"`.

## Report Factory changes, same session (2026-08-18)

- **Header redesign:** removed the external-URL logo image widget and centered the "ใบนำทาง" line
  (was right-aligned) to match a 2-line-centered-text mockup, above the existing `{{queue_display}}`
  box widget. Applied via direct edit of the exported `pdf_content` widget array (JSON), re-zipped,
  re-imported.
- The queue-number box widget itself ended up as a plain `text` widget (`{{queue_display}}`,
  fontsize 70, bold, centered) rather than the custom HTML `<table>` box first proposed — simpler,
  and sidesteps an HTML double-border/centering bug hit along the way (an outer wrapper `<table>`
  used only for centering picked up the report's default table border; never fully chased down
  since the plain-text widget approach made it moot).

## 🆕 Deployment pipeline discovered (2026-08-18)

Report/SQL edits do **not** reach the live app just by saving. The real chain for this report:
**Report Factory (edit/preview)** → bound into a **ListView "Report Items" widget** inside the
Patient **SDForm** (`form_id 6a4c943549285083acfeb080`) → published via **App Factory** → live in
the **QSNICH** production app (`his.softmax-one.com`, a separately-branded deployed instance).
Report Factory's own "Preview" button always reflects the latest save; the other two layers do not
automatically resync — confirmed the hard way while chasing the bug below. Worth checking on any
future report change: did it reach App Factory, not just Report/SQL Factory.

## ⚠ Open bug, unresolved — `{{prename_text}}` not resolving outside Report Factory Preview

`prename_text` (`` `zdata_person`.`prename.prename_full_name` `` AS `prename_text`) is an
**original field, present since before this session touched the query**, and Report Factory's own
Preview renders it correctly ("นางสาว เปรมปิติ ลาโสม"). But it renders as the **literal unresolved
tag `{{prename_text}}`** in two other places that should show the same data: the SDForm Patient
form-builder's "Report Items" widget preview, and the live QSNICH app — both on a real patient
(HN 40290357). Hard refresh does not fix it, ruling out plain browser cache. All other fields
(`hn`, `p_fname`, `p_lname`, age, blood group) render fine in both broken locations — only this one
field fails, which rules out the query itself being broken (a broken query would blank everything,
not one field). **Leading theory:** the "Report Items" widget and/or the QSNICH deployment cache a
compiled report template separately from Report Factory's live preview, frozen from before
`prename_text` existed. Untested fix suggested: in the widget's Report dropdown, deselect and
reselect the report to force a resync. **Not yet confirmed either way — pick this up first next
session.**

## Key takeaways
- **General lesson for this codebase:** a query's `FROM` table should be the one the `WHERE`
  clause's selective filter (usually `_id`) targets — joining "outward" from an unfiltered base
  table before applying the real filter is the concrete anti-pattern found here, and worth
  checking on any other SQL Factory query that feels slow.
- `zdata_visit_tran` (already stubbed in [[his-data-model]]) is confirmed to hold OPD queue state
  (`qtype`, `queue_no`, `queue_ts`, `queue_label`, `vtran_status`, `unit_to`, `room_to`,
  `doctor_to`, `checkin_at`) — this vault previously only knew it "backs the EMR" with no field
  detail.
- **SQL Factory stores the JOIN graph twice** (`sql_join` display copy + `sql_options.join`
  executed copy) — editing a query via raw JSON file import must update both or the change is a
  silent no-op. See [[sql-factory]].
- **Confirmed SQL Factory function vocabulary is wider than first assumed:** `CASE`, `IFNULL`,
  `CONVERT`, `SIZE_OF_ARRAY`, `CONCAT` (including nested), `ARRAY_ELEM_AT`, `PARSE_JSON` all work.
  Only `RIGHT` is confirmed broken so far.
- **Saving a report/SQL is not the same as it being live** — this platform has a
  Report Factory → Report Items widget (SDForm) → App Factory publish chain before a change
  reaches a real deployed app; see "Deployment pipeline discovered" above.
- `zdata_person.legacy.*` (age_month/age_day/birth and more) is a **frozen HOSXP migration
  snapshot**, absent on every patient registered after the new system went live — a real
  data-quality gap for any report leaning on it, not just this one.

## Entities & concepts touched
- [[his-data-model]] — updated with confirmed `zdata_visit_tran` fields, the `xparentx`/`pid.value`
  equivalence, and the `legacy.*` migration-snapshot caveat.
- [[sql-factory]] — the dual JOIN representation gotcha, confirmed function vocabulary, JSON export
  schema notes (`sql_from`/`sql_join`/`sql_options`/`sql_select`).
- [[his-emr-form]] — source of the `queueLabel` computation this report replicates in SQL.
- [[report-factory]] — the report-side binding (`{{}}` mustache) this feeds into, plus the newly
  documented Report Items → App Factory publish step.

## Contradictions / open questions
- **Still open:** `{{prename_text}}` unresolved outside Report Factory's own Preview — see the
  dedicated section above. Pick up first next session.
- ~~Original query's `zdata_person._id = zdata_visit.xparentx` join condition doesn't match the
  join key documented in [[his-data-model]]~~ — **resolved 2026-08-18**: confirmed live that
  `xparentx` and `pid.value` hold the same value on every visit sampled; not a bug.
- Whether the `FROM zdata_visit` rewrite is measurably faster in production scale was not
  timed — this test dataset is too small (tens of visits) for the difference to be visible; the
  fix is applied on structural grounds (indexed `_id` filter first) same as before.
- The HTML `<table>` double-border/centering bug on the queue-number box was sidestepped (switched
  to a plain `text` widget) rather than root-caused — leave for later if the box ever needs to move
  back to HTML.
