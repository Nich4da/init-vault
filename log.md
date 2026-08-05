---
type: synthesis
title: Wiki Log
created: 2026-07-16
updated: 2026-07-16
tags: [meta, log]
---

# Wiki Log

Append-only, chronological. Newest at the bottom. Each entry header is
`## [YYYY-MM-DD] <op> | <title>` so the log stays greppable:
`grep "^## \[" log.md | tail -5`.

---

## [2026-07-16] schema | Wiki initialized
- Created `CLAUDE.md` schema, `index.md` catalog, and this log.
- Set up folder layout: `raw/` (+ `raw/assets/`), `wiki/{sources,entities,concepts,syntheses}`.
- Vault was a fresh Obsidian vault (only `.obsidian/` present).

## [2026-07-16] ingest | LLM Wiki (the founding idea)
- Saved source to `raw/llm-wiki-idea.md`.
- Created source page [[llm-wiki-idea]].
- Created entities [[obsidian]], [[memex]]; concepts [[persistent-wiki-pattern]], [[ingest-query-lint]].
- Updated `index.md` (1 source, 2 entities, 2 concepts).
- No contradictions (first source). Open questions: whether to add a `qmd` search tool as the wiki grows.

## [2026-07-16] ingest | LLM-ApiDocs.md + LLM-FieldDocs.md (initCraft/SDForm reference)
- Ingested two large reference docs together; they establish the wiki's **domain = [[initcraft|initCraft / SDForm]]**.
- New sources: [[llm-api-docs]] (server `app.*`, 65 fns), [[llm-field-docs]] (~83 components + client `this.*`).
- New entities: [[initcraft]], [[sdform]], [[mongodb]].
- New concepts: [[server-api-app]], [[client-api-this]], [[field-components]], [[xformdatax]], [[dataprovider]], [[zdata-collections]], [[mongo-transactions]].
- Updated `index.md` → 3 sources · 5 entities · 9 concepts. Added a "Planned pages" list (greyed links).
- ⚠ 2 contradictions flagged in [[zdata-collections]]: (a) `rstat` numbering differs client `submitForm` (1=draft,2=submit) vs server `sdformSetOne` (0=draft…3=deleted); (b) `xrstatx` typed as number in some examples, string `'1'` in another.
- Data gaps / next sources: [[sql-factory]] query docs, [[api-factory]]/[[form-factory]] module overviews, `mongoTxn`/`withVersion` signatures, [[openform]] full option reference.

## [2026-07-17] ingest | HIS forms (patient.json + EMR.json) + module_api/module_sql study
- Ingested two exported [[form-model-json|VForm]] models from `HIS/sdform_module/`: [[his-patient-form]] (29 widgets) and [[his-emr-form]] (37 widgets) — the wiki's **first real application**, a Hospital Information System.
- New entity [[his]] (the app) + [[erp-mongodb]] (live DB reference from a read-only inspection).
- Filled long-greyed concept pages: [[api-factory]], [[sql-factory]], [[openform]]. New concepts: [[crudgetall]], [[runprocess]], [[vue-ui-pattern]], [[form-model-json]].
- Studied MongoDB read-only (via `erp-mongodb-readonly`, `ro` user): `module_api` (41 procs — pulled `calculcate_bmi`, `gen_auto_running_number_by_form`), `module_sql` (9 queries — `vms_car`, `query_bmi_list`). `erp` now ~70 collections (was ~46 on 2026-07-02).
- Updated [[client-api-this]] (getFieldRef/vueState + connector links), [[xformdatax]] (real `calculcate_bmi` example), [[initcraft]] (HIS as first app), [[mongodb]], [[index]].
- ✅ **Resolved** the `xrstatx` open question: stored as **int** (values 1/3 observed across `zdata_*` + `module_api`) — prefer numeric filters.
- Key id facts: `sdform_manage._id`=ObjectId; `module_api`/`module_sql` `_id`=24-hex **string** (=`dataid`). The HIS forms' referenced form/process ids are **newer than this DB snapshot** (not present).
- ⚠ Still open: the `rstat` numbering conflict (save-mode flag vs stored status); HIS backing forms/processes unverifiable against this snapshot.

## [2026-07-17] ingest | Report Factory work — ใบฎีกาจ่ายยา + pdfmake gotchas
- Filed the day's **Report Factory** work (user builds reports for สถาบันสุขภาพเด็กฯ HIS).
- New concept [[report-factory]] — two-layer model (Report Content vs Table Column Setting), content widgets, Table Layout, Custom Header, `pdf_*` fields, and **hands-on pdfmake/html gotchas**: Thai via bundled `THSarabun` (not CSS); CSS padding/margin on `<td>` ignored → position via `<colgroup><col width>`; table overflow → `Width *` + fixed / landscape; bold via `font-weight`/`<b>`.
- New synthesis [[his-med-dispense-voucher-report]] — the ใบฎีกาจ่ายยา report (header html, 7-col item table, footer signature block, placeholder names). Status = layout done, **SQL not wired** (report was wrongly pointed at PERSON form).
- Updated `index.md` (17 concepts · 1 synthesis).
- Context: connected read-only to the **real HIS db `his`** (159.223.80.155) this session — discovered `zdata_person`, `zdata_visit`, `zdata_room`, insurance chain, and studied `zdata_section`/`zdata_service_type` (mapping analysis not yet filed).
- Next: step 2 — find the pharmacy requisition/dispense collection in `his`, build the SQL, wire `pdf_sql` + replace `{{}}`/column Fields.

## [2026-07-19] ingest | HIS system flow diagram ("architecture")
- Ingested the draw.io **"architecture" flow diagram** of the [[his|HIS]] OPD journey (from a screenshot; the `.drawio` on Google Drive `1cN65pFSZG1zCya3A5Wm53LIfUHXjnF89` is **not yet in `raw/`** — Drive connector token was expired).
- New source [[his-system-flow]] (faithful node/edge transcription) + new synthesis [[his-opd-flow]] (narrated end-to-end journey + module→transaction-table map).
- New concept pages for the clinical/finance modules: [[cpoe]], [[pis]], [[lis]], [[his-billing]], [[his-claims]], [[his-data-integrations]].
- Flow: Person (HN) → เช็คสิทธิ์ → visit (VN) → opd_trans (EMR) → [Cinical Doc→IOT · Diag→coder · CPOE/PIS→order_tran · LIS↔ผลแล็บ] → FA (fa_trans / ปิดสิทธิ์ รับรู้ยอดเงิน) → End → ระบบเคลม (CSOP จ่ายตรง/โครงการ · e-claim บัตรทอง) + standalone feeds 43 แฟ้ม / FDH / refer.
- Linked into existing pages: [[his]] (new "End-to-end flow" section), [[his-med-dispense-voucher-report]] (report backs the **PIS / order_tran** step). Updated `index.md` (6 sources · 7 entities · 23 concepts · 2 syntheses).
- ⚠ Open / to confirm with user: ambiguous labels **IOT, coder, FA, CSOP, FDH**; three transaction collections (`opd_trans`, `order_tran`, `fa_trans`) **unverified** against live `his` db — natural next step is a read-only Mongo check.

## [2026-07-19] ingest | Report Factory skill doc-set (SKILL.md + binding/fields/latex)
- Ingested a new **skill doc-set** at `HIS/report_factory/` (SKILL.md + references/{binding,fields,latex}.md), reverse-engineered from the real renderer (`SdReport.vue`, `TLatexReport.ts`) — the **authoritative** Report Factory reference.
- New source [[report-factory-skill]]; new concept [[report-latex]] (LaTeX = separate Nunjucks `\VAR{}`/`\BLOCK{}` + Tectonic server model, no `{{}}`/pdf_content/pdf_column).
- **Upgraded [[report-factory]]** from hands-on notes to source-backed: render pipeline (`createReport`→`typeReport`), `{{col}}`→`strtr` binding (row[0] scope for text/html/img/qr/barcode/sub_report; only `table` iterates rows), full `pdf_column`/`content`/`pdf_params`/page-setup field lists, output support matrix (Excel = table/subtable/sub_report only), qr/barcode/subtable/sub_report rendering. Kept the html/pdfmake gotchas.
- Key correction folded in: **`content_var` is inert at runtime** — bind only via `{{field}}` matching the exact SQL column.
- Updated [[his-med-dispense-voucher-report]]: added the confirmed binding mechanism + **root cause** of its Field-dropdown issue (`col_field`/`pdf_form_id` come from the selected `pdf_sql` — fix = pick the right pharmacy SQL provider).
- Updated `index.md` (7 sources · 7 entities · 24 concepts · 2 syntheses).
- ⚠ Minor open: `pdf_tb_layout` UI "Table"/full-grid = default(empty) vs 3 named border options — worth a UI check. Deeper syntax ref not ingested: `initcraft/public/LLM-Report.md`.

## [2026-07-20] ingest | HIS visit.json + patient.json update + Mongo blocker
- Ingested **visit.json** → new source [[his-visit-form]] (form `6a40fdec…`): `vn` autonumber (`69`+5, readonly, gen on new visit), `visit_date`, service/clinic/doctor/type/priority, `cc`, `visit_diag`, discharge `typeout`, money (`vcost/vprice/vpayprice/vactualpay`), status switches, denormalized `birth_date/gender_text/abogroup_text`. **person↔visit link = `pid.value` → person `_id`** (not hn).
- **patient.json update** folded into [[his-patient-form]]: `person_info` vue-ui now has a rich inline HTML banner + สิทธิ display + 3 buttons (editPerson/checkRight/**openVisit**→new VN). Coded maps in-template (gender 1/2, abogroup 1-5/9, birth_date AD→Thai BE).
- New concept [[his-insurance]] (`inscl_*`): rights on PERSON (`inscl_main_code/sub_code/hos_main/hos_sub/hos[]`), verified via process `6a4ccaef…` (checkRight), snapshotted onto visit via process `6a4c7050…` (onFormMounted). = the เช็คสิทธิ์ step of [[his-opd-flow]].
- Updated [[his]] (visit + data-model quick facts), `index.md` (8 sources · 7 entities · 25 concepts · 2 syntheses).
- ⚠️ **Mongo BLOCKED:** read-only `MDB_MCP_CONNECTION_STRING` reaches only `erp` (88 forms, master data) — `zdata_person`/`zdata_visit`/`zdata_patient_assessment` all `exists:false`; db `his` = empty. The real `his` (159.223.80.155) needs its own read-only URI in the env var. Real field types/relate/age still unverified.

## [2026-07-20] ingest | HIS live MongoDB data model (his db, read-only)
- Resolved the Mongo blocker: the `his` data is on a **different server (159.223.80.155)** than the env-var `erp` instance. Connected read-only (user-provided URI, in-process, not persisted) → db `his` = 78 collections.
- New concept [[his-data-model]] — schema-level (no PII) of `zdata_person` (8), `zdata_visit` (62), `zdata_patient_assessment` (2), `zdata_person_relate` (master), `zdata_person_insurance`, `zdata_inscl_*`, coded-field masters.
- **Join keys confirmed:** `zdata_visit.pid.value` → `zdata_person._id`; `zdata_patient_assessment.vid.value` → `zdata_visit._id`; sub-collections `xparentx` = parent `_id`.
- **`zdata_visit.pid` denormalizes** hn/prename/p_fname/p_lname/age/birth_date/p_gender/p_abogroup/p_phone/p_pic — but **NOT** p_cid/address/relate/allergy (→ need person join).
- Real fields: person `relate[]` (r_code/r_fname/r_lname/r_cid/r_occup…), `allergy_main[]`, current address `now_*`, coded fields are `{label,value}` objects, `age` = stored int, `birth_date` = str AD. Assessment has vitals + drug_allergy/food_allergy/underlying_disease/cc/pi.
- ⚠️ Env var `MDB_MCP_CONNECTION_STRING` still points to the wrong (erp) server; `.env` correctly holds NO URI. Persistence fix = set the Windows User env var to the `his` read-only URI (ideally a read-only DB user, not root). Root URI was pasted in chat → rotate.

## [2026-07-31] ingest | LAB (งานชีวเคมี) — requirement memo + paper request form + built order component
- New project kick-off: the **[[lis|LAB/LIS]] module**. Three sources ingested at once (2 photographed docs transcribed into `raw/`, 1 form JSON already in the vault).
- New source [[his-lab-biochem-requirements]] (`raw/his-lab-biochem-requirements.md`) — the lab unit's memo: **4 modules unused** (3.4.4.1 / 3.4.4.3 / 3.4.4.10 one-click Order Work List / 3.4.4.11 PCT out-lab), **4 modules used but missing from spec** (Lab Request Monitoring, สถานะการสั่งแลป, ข้อมูลห้องแลป, บันทึกความเสี่ยง), and **11 add/fix requests**.
- New source [[his-lab-che-request-form]] (`raw/his-lab-che-request-form.md`) — paper ใบส่งตรวจ **C-20 / L3.1** (form no. 148-1-8/เม.ย.69): header (Name/HN/Age/Ward/Tel + แพทย์ที่สั่งตรวจ + **Lab No. "สำหรับเจ้าหน้าที่ Lab เท่านั้น"**), **สิ่งส่งตรวจ block** (Blood→Clotted/iCa/Li-Hep/NaF/EDTA · Urine→spot/24h+ml · CSF · Body fluid+ระบุ · ผู้เก็บ/เวลาเก็บ), **25 groups / 90 codes** in 4 columns, note "สั่ง Globulin = C2 + C3", no prices.
- New source [[his-lab-che-order-component]] (`HIS/sdform_module/Lab_CHE_Order_Component.json`) — 3 fields: `lab_patient_header` (vue-ui banner + BMI/vitals/history/SVG charts, reads `getFormRef().$labTran`), hidden `selected_items_json`, `lab_che_order_ui` (tick sheet). **Verified: all 90 codes present, grouping/order matches the paper form** → requirement 2 is DONE.
- **Rewrote [[lis]]** from a 3-line stub to the module's concept page: the **รอรับเข้า → รับเข้าดำเนินการ → ออกผลแล้ว** pipeline, LAB NO. as lab-owned & mutable, specimen-as-data, per-item modifiers (GTT นาที / urine 24h ml), critical values in 3 places, ปกปิดผล, manual-entry fallback, "สำเนาพิมพ์ออนไลน์" print semantics, master data (HIS→LIS code map, price per สิทธิ, reject reasons).
- New synthesis [[his-lab-module-plan]] — scope in/out, **9 screens (S1–S9)**, gap analysis (built vs missing), **proposed `zdata_lab_order` / `_item` / `_result` / `_test` / `_price` / `_reject_reason` / `_risk` model**, 6-step build order, **10 blocking decisions**.
- Updated `index.md` (11 sources · 7 entities · 26 concepts · 3 syntheses) + [[his]].
- ⚠ Biggest open question: **how orders actually reach the LIS today** — the one-click push (3.4.4.10) is listed as *unused* yet results clearly flow back. Also unresolved: the `3.4.4.x` spec doc itself, Report LIS sort order, critical-value ownership/age bands, ปกปิดผล governance, advance-order source (req.1 vs unused ผู้ป่วยนัด list), IPD scope, price source, 6 faint items on the form, and whether CHE is a pilot or the whole project.

## [2026-08-04] ingest | Open Design repo (nexu-io/open-design) — second domain opened
- Checked first: `grep -i "open-design|nexu"` over the whole vault returned **nothing** → not previously ingested, despite a local copy sitting at `../open-design/` since 2026-08-04.
- New source [[open-design-repo]] — read `README.md`, `AGENTS.md` (`CLAUDE.md` is just `@AGENTS.md`), `CONTEXT.md` in full; sampled `docs/skills-protocol.md`, `plugins/spec/SPEC.md`, `design-systems/{linear-app,claude}/`, `skills/*/SKILL.md`.
- New entity [[open-design]] — Apache-2.0 local-first design workspace, "the open-source Claude Design alternative". Ships **no agent**: spawns the 25 coding-agent CLIs on your `PATH` (26 runtime defs), or BYOK via an SSRF-guarded proxy. Desktop (Electron) + daemon (Node 24/Express/SSE/SQLite) + `od` CLI + stdio MCP server. Surfaces: prototype · live artifact · deck · image · video (HyperFrames HTML→MP4) · audio.
- New concept [[design-md]] — the brand-as-markdown contract (9 sections, roles not raw hexes); package may add `manifest.json` / `tokens.css` / `design-tokens.json` / component fixtures / `source/evidence.md`.
- New concept [[skill-md]] — the Claude Code Agent Skills format adopted verbatim + an `od:` block (`mode`/`surface`/`scenario`/`craft.requires`) and multilingual `triggers:`. **Same object as this project's own `.claude/skills/`.**
- New concept [[od-plugin]] — `open-design.json` + type payload; `od.capabilities[]` declare-the-minimum, `od plugin scaffold|validate|apply`, PR-based marketplace.
- **Counts verified against the local copy, not the README:** `skills/` **162** dirs (README says "100+") · `design-systems/` **151** packages ✅ · `design-templates/` **114** dirs · `plugins/_official/` **460** dirs (= 277 + 183) ✅ · `runtimes/defs/` **27** `.ts` files.
- Updated `index.md` (12 sources · 8 entities · 29 concepts · 3 syntheses) + a new **"Second domain"** line, since Open Design is unrelated to [[initcraft]] / [[his]].
- **Repo conventions flagged as worth stealing for this vault / HIS docs:** `AGENTS.md` as the single agent entry point with per-layer files that must not restate each other · the "Daemon data directory contract" single-source-of-truth section that forbids concrete examples elsewhere and names its own escape candidates · `CONTEXT.md` as a glossary where every term carries an explicit `_Avoid_:` list · the UI/CLI dual-track rule (endpoint + UI + `od` subcommand in one PR) · the red-spec-first bug playbook.
- ⚠ Open questions: **why this was ingested is not recorded** — `.claude/commands/od-contribute.md` and an empty `open-design-stage/` hint at contributing, but that's inference. Local copy is **not a git repo** (unpacked from `open-design-main.zip`) so the snapshot can't be pinned to a commit; `package.json` says **0.16.1** while the README roadmap stops at 0.13.0 and `docs/roadmap.md` + `docs/spec.md` are marked archived. `open-design-extracted/` is a second unread copy. Windows-native support is **best-effort only** (corepack EPERM; `better-sqlite3` compiles from source on Node 24) — relevant, this machine is Windows 11.

## [2026-08-04] ingest | LAB units 2 & 3 (ชีวโมเลกุล + ภูมิคุ้มกัน) + module_packages backups
- User dropped requirement/real-data photos into `HIS/data/` and three module exports into `HIS/sdform_module/`. Six new images read in full; the four `data/Biochemistry/*.PNG` were confirmed to be the already-transcribed 07-31 docs and were **not** re-ingested.
- New raw transcription `raw/his-lab-bg-request-forms.md` → source [[his-lab-bg-request-forms]]. **Three** genetics forms: `C-20/L8.1` (FM-LAB-BG-660-00: Cytogenetic + Molecular cytogenetic + Newborn Screening + Additional), `C-20/L8.2` (FM-LAB-BG-661-01, **2 หน้า**: Molecular analysis + Gene sequencing + Point mutations), and the standalone **`BG49` Urine organic acid** sheet.
- New raw transcription `raw/his-lab-immuno-request-forms.md` → source [[his-lab-immuno-request-forms]]. Two sheets: `C-20/L5.1-1` in-house (6 groups, ~100 tests) and `C-20/L5.1-2` **OUT LAB** (flat A→Z, ~200 tests), both ฉบับปรับปรุง 16 เม.ย. 2564.
- **This kills the "CHE = the project" assumption — it is a pilot.** Four things the CHE-shaped design cannot express: (1) **composite codes** — `BG17+21`, `BG16+20`, `BG17+19+22` with the printed rule `*,** สั่งตรวจด้วย 2,3 รหัสการทดสอบตามลำดับ` (~50 rows; biochem's "Globulin = C2+C3" was the same thing seen once); (2) **per-test required fields & single-select sub-options** — `BG49` demands `urine creatinine mg/dl`, `BG50 FISH` picks one Chr locus; (3) **clinical narrative inside the order** — `BG1` reserves half a page for History/PE/Diagnosis; (4) **out lab in two different shapes** — a per-test `: Out lab` flag (genetics) *and* an entire parallel catalogue (immunology).
- Also new at order level: **urgency** `☐ ด่วน OR ☐ ด่วน อุบัติเหตุ ☐ ด่วน เพราะ___` (immuno), **สิทธิการรักษา printed on the request**, **panels** (`IM120` 27 allergens, `IM121` 36 allergens), **external allergen codes** (`d1`/`f1`/`e1`/`i1`/`fx5` alongside the HIS code), and a **referring-hospital** header on `BG49` (โรงพยาบาล, not Ward) → the genetics lab accepts specimens from other hospitals.
- **First printed price anywhere:** `BG45 TSH (DBS) = 125 บาท`. First explicit **TAT/method**: `BG49` = 10 วันทำการ, Qualitative, GCMS. Receiving desk has **hours** (จันทร์–ศุกร์ 08.30–15.30) → รับเข้า is not 24/7.
- **Header comparison across all 3 units: no two match.** Built the table in [[his-lab-immuno-request-forms]]; conclusion = the order header must be driven by a new `zdata_lab_unit.header_fields[]`, not hard-coded.
- New source [[his-module-packages-backup]] + new concept [[module-packages]] — the App Factory registry that publishes a form as a module: `app_code`/`app_name`/`app_desc`/`app_logo[]`/`tool_license` + `app_packages[]` tabs (`tab_form.value` → formId, `tab_icon`, `tab_label`, `tab_roles`). **Permissions (`app_assign_roles`, `tab_roles`) are `null` on every HIS module.**
- 🆕 **[[pis|PIS]] has started:** `pis_drug` / "Drug & Stock" / *Pharmacy Back Office*, tab "Drug Items", `xunitx = B001 เภสัชกรรม`, created 2026-07-29, updated 2026-08-02. Form body `6a68f6cec91cb8030e26d75d` **not exported** — fields unknown. Possibly related to `HIS/data/cpoe_items_cleaned_2026_07_29.xlsx` (same date).
- Rewrote [[lis]] with a "the lab units" section (3-unit table + what each breaks) and expanded master data; updated [[pis]]; **revised the scope, data model, and open decisions of [[his-lab-module-plan]]** — `zdata_lab_test` gains `components[]`/`out_lab`/`external_codes[]`/`extra_fields[]`/`sub_options[]`/`tat_days`/`method`/`result_type`/`instructions`, plus a new `zdata_lab_unit` master; decision #10 answered (pilot) and **8 new blocking decisions (#11–18)** added.
- Updated `index.md` (15 sources · 8 entities · 30 concepts · 3 syntheses).
- ⚠ **Data-quality warnings recorded on both raw files:** genetics gene/exon/`c.`/`p.` notation is OCR-risky; the immunology out-lab sheet cannot distinguish `I0` (zero) from `IO` (letter O), producing apparent duplicate codes (`I0010`, `I0011`, `I0019`, `I0042`…). **Neither transcription may be used as a master list** — the lab's electronic catalogues are now a blocking ask (#13). Also unresolved: a handwritten note beside `BG39` (reads ~`6360`), missing `IL36`, and whether the four code namespaces share one master.

## [2026-08-04] query | LAB worklist UI — 3-tab design (S2/S3/S4)
- Request: design the lab's main working window in **Figma** (3 tabs: รอรับ / รับเข้าแล้ว / ออกผลแล้ว), where the existing list-order screen sits inside tab 2 per selected patient.
- ⚠ **No Figma integration exists in this environment** — can neither write to nor read the linked file. Delivered instead as a **clickable HTML mockup**, `HIS/ui/lab-worklist-mockup.html` (importable to Figma via `html.to.design`, and reusable as the [[vue-ui-pattern|`vue-ui`]] skeleton). Also published as an artifact.
- New synthesis [[his-lab-worklist-ui]] — records the structure, every design decision mapped to the requirement that backs it, and what is invented vs sourced.
- Structure: each tab is a **master–detail split** (queue 380px | detail). Tab 1 = S3 รายละเอียดคำขอ (edit/delete lines, ออก/แก้ LAB NO., รับเข้า with time stamp, ปฏิเสธ + reason, สิทธิ/ชำระเงิน, พิมพ์ใบสั่งตรวจ). Tab 2 = the existing order list per patient + **ลงผล Manual (LIS ล่ม)** + explicit **รอผล** on every unresolved line. Tab 3 = S4 results with value/unit/Ref.Range/comment, ปกปิดผล at 50% with audit trail, and the **สำเนาพิมพ์ออนไลน์ + ผู้พิมพ์ + datetime + page 1/2** footer.
- Two design decisions worth keeping: **left severity stripe** on every queue row (state readable peripherally), and **LAB NO. as a monospace plate that itself turns red + ⚠** — because req. 8 says the critical alert must be *"ตรง LAB NO."*, which a floating badge next to it does not satisfy.
- Visual system **inherited, not invented**: reuses the Element Plus tokens and `.lab-*` conventions already in [[his-lab-che-order-component]]'s `cssCode`, so mockup and real component render identically. Thai type via a system stack (no web font → no silent fallback); light + dark defined at token level.
- ⚠ Three things flagged **inside the mockup itself** as invented: the **ด่วน** control (exists on immunology's L5.1-1, **not** on biochem's L3.1 — cut it if ชีวเคมี doesn't use it) · **ราคา** (placeholders; no source — decision 8) · **result ordering** (grouped by paper form; req. 5 wants Report LIS order — decision 3). All patients/values fabricated; test codes real.
- Not covered: S1 (built), S5/S6/S7/S8/S9, and the **multi-unit header problem** — this design assumes one unit; genetics/immunology still need the `zdata_lab_unit`-driven header.
