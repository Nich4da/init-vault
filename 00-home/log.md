---
type: synthesis
title: Wiki Log
created: 2026-07-16
updated: 2026-09-15
tags: [meta, log]
---

# Wiki Log

Append-only, chronological. Newest at the bottom. Each entry header is
`## [YYYY-MM-DD] <op> | <title>` so the log stays greppable:
`grep "^## \[" 00-home/log.md | tail -5`.

---

## [2026-07-16] schema | Wiki initialized
- Created `CLAUDE.md` schema, `00-home/index.md` catalog, and this log.
- Set up folder layout: `03-source-materials/` (+ `03-source-materials/assets/`), `01-knowledge-base/{sources,entities,concepts,syntheses}`.
- Vault was a fresh Obsidian vault (only `.obsidian/` present).

## [2026-07-16] ingest | LLM Wiki (the founding idea)
- Saved source to `03-source-materials/llm-wiki-idea.md`.
- Created source page [[llm-wiki-idea]].
- Created entities [[obsidian]], [[memex]]; concepts [[persistent-wiki-pattern]], [[ingest-query-lint]].
- Updated `00-home/index.md` (1 source, 2 entities, 2 concepts).
- No contradictions (first source). Open questions: whether to add a `qmd` search tool as the wiki grows.

## [2026-07-16] ingest | LLM-ApiDocs.md + LLM-FieldDocs.md (initCraft/SDForm reference)
- Ingested two large reference docs together; they establish the wiki's **domain = [[initcraft|initCraft / SDForm]]**.
- New sources: [[llm-api-docs]] (server `app.*`, 65 fns), [[llm-field-docs]] (~83 components + client `this.*`).
- New entities: [[initcraft]], [[sdform]], [[mongodb]].
- New concepts: [[server-api-app]], [[client-api-this]], [[field-components]], [[xformdatax]], [[dataprovider]], [[zdata-collections]], [[mongo-transactions]].
- Updated `00-home/index.md` → 3 sources · 5 entities · 9 concepts. Added a "Planned pages" list (greyed links).
- ⚠ 2 contradictions flagged in [[zdata-collections]]: (a) `rstat` numbering differs client `submitForm` (1=draft,2=submit) vs server `sdformSetOne` (0=draft…3=deleted); (b) `xrstatx` typed as number in some examples, string `'1'` in another.
- Data gaps / next sources: [[sql-factory]] query docs, [[api-factory]]/[[form-factory]] module overviews, `mongoTxn`/`withVersion` signatures, [[openform]] full option reference.

## [2026-07-17] ingest | HIS forms (patient.json + EMR.json) + module_api/module_sql study
- Ingested two exported [[form-model-json|VForm]] models from `SDForm/sdform_module/`: [[his-patient-form]] (29 widgets) and [[his-emr-form]] (37 widgets) — the wiki's **first real application**, a Hospital Information System.
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
- Updated `00-home/index.md` (17 concepts · 1 synthesis).
- Context: connected read-only to the **real HIS db `his`** (159.223.80.155) this session — discovered `zdata_person`, `zdata_visit`, `zdata_room`, insurance chain, and studied `zdata_section`/`zdata_service_type` (mapping analysis not yet filed).
- Next: step 2 — find the pharmacy requisition/dispense collection in `his`, build the SQL, wire `pdf_sql` + replace `{{}}`/column Fields.

## [2026-07-19] ingest | HIS system flow diagram ("architecture")
- Ingested the draw.io **"architecture" flow diagram** of the [[his|HIS]] OPD journey (from a screenshot; the `.drawio` on Google Drive `1cN65pFSZG1zCya3A5Wm53LIfUHXjnF89` is **not yet in `03-source-materials/`** — Drive connector token was expired).
- New source [[his-system-flow]] (faithful node/edge transcription) + new synthesis [[his-opd-flow]] (narrated end-to-end journey + module→transaction-table map).
- New concept pages for the clinical/finance modules: [[cpoe]], [[pis]], [[lis]], [[his-billing]], [[his-claims]], [[his-data-integrations]].
- Flow: Person (HN) → เช็คสิทธิ์ → visit (VN) → opd_trans (EMR) → [Cinical Doc→IOT · Diag→coder · CPOE/PIS→order_tran · LIS↔ผลแล็บ] → FA (fa_trans / ปิดสิทธิ์ รับรู้ยอดเงิน) → End → ระบบเคลม (CSOP จ่ายตรง/โครงการ · e-claim บัตรทอง) + standalone feeds 43 แฟ้ม / FDH / refer.
- Linked into existing pages: [[his]] (new "End-to-end flow" section), [[his-med-dispense-voucher-report]] (report backs the **PIS / order_tran** step). Updated `00-home/index.md` (6 sources · 7 entities · 23 concepts · 2 syntheses).
- ⚠ Open / to confirm with user: ambiguous labels **IOT, coder, FA, CSOP, FDH**; three transaction collections (`opd_trans`, `order_tran`, `fa_trans`) **unverified** against live `his` db — natural next step is a read-only Mongo check.

## [2026-07-19] ingest | Report Factory skill doc-set (SKILL.md + binding/fields/latex)
- Ingested a new **skill doc-set** at `02-his/report_factory/` (SKILL.md + references/{binding,fields,latex}.md), reverse-engineered from the real renderer (`SdReport.vue`, `TLatexReport.ts`) — the **authoritative** Report Factory reference.
- New source [[report-factory-skill]]; new concept [[report-latex]] (LaTeX = separate Nunjucks `\VAR{}`/`\BLOCK{}` + Tectonic server model, no `{{}}`/pdf_content/pdf_column).
- **Upgraded [[report-factory]]** from hands-on notes to source-backed: render pipeline (`createReport`→`typeReport`), `{{col}}`→`strtr` binding (row[0] scope for text/html/img/qr/barcode/sub_report; only `table` iterates rows), full `pdf_column`/`content`/`pdf_params`/page-setup field lists, output support matrix (Excel = table/subtable/sub_report only), qr/barcode/subtable/sub_report rendering. Kept the html/pdfmake gotchas.
- Key correction folded in: **`content_var` is inert at runtime** — bind only via `{{field}}` matching the exact SQL column.
- Updated [[his-med-dispense-voucher-report]]: added the confirmed binding mechanism + **root cause** of its Field-dropdown issue (`col_field`/`pdf_form_id` come from the selected `pdf_sql` — fix = pick the right pharmacy SQL provider).
- Updated `00-home/index.md` (7 sources · 7 entities · 24 concepts · 2 syntheses).
- ⚠ Minor open: `pdf_tb_layout` UI "Table"/full-grid = default(empty) vs 3 named border options — worth a UI check. Deeper syntax ref not ingested: `initcraft/public/LLM-Report.md`.

## [2026-07-20] ingest | HIS visit.json + patient.json update + Mongo blocker
- Ingested **visit.json** → new source [[his-visit-form]] (form `6a40fdec…`): `vn` autonumber (`69`+5, readonly, gen on new visit), `visit_date`, service/clinic/doctor/type/priority, `cc`, `visit_diag`, discharge `typeout`, money (`vcost/vprice/vpayprice/vactualpay`), status switches, denormalized `birth_date/gender_text/abogroup_text`. **person↔visit link = `pid.value` → person `_id`** (not hn).
- **patient.json update** folded into [[his-patient-form]]: `person_info` vue-ui now has a rich inline HTML banner + สิทธิ display + 3 buttons (editPerson/checkRight/**openVisit**→new VN). Coded maps in-template (gender 1/2, abogroup 1-5/9, birth_date AD→Thai BE).
- New concept [[his-insurance]] (`inscl_*`): rights on PERSON (`inscl_main_code/sub_code/hos_main/hos_sub/hos[]`), verified via process `6a4ccaef…` (checkRight), snapshotted onto visit via process `6a4c7050…` (onFormMounted). = the เช็คสิทธิ์ step of [[his-opd-flow]].
- Updated [[his]] (visit + data-model quick facts), `00-home/index.md` (8 sources · 7 entities · 25 concepts · 2 syntheses).
- ⚠️ **Mongo BLOCKED:** read-only `MDB_MCP_CONNECTION_STRING` reaches only `erp` (88 forms, master data) — `zdata_person`/`zdata_visit`/`zdata_patient_assessment` all `exists:false`; db `his` = empty. The real `his` (159.223.80.155) needs its own read-only URI in the env var. Real field types/relate/age still unverified.

## [2026-07-20] ingest | HIS live MongoDB data model (his db, read-only)
- Resolved the Mongo blocker: the `his` data is on a **different server (159.223.80.155)** than the env-var `erp` instance. Connected read-only (user-provided URI, in-process, not persisted) → db `his` = 78 collections.
- New concept [[his-data-model]] — schema-level (no PII) of `zdata_person` (8), `zdata_visit` (62), `zdata_patient_assessment` (2), `zdata_person_relate` (master), `zdata_person_insurance`, `zdata_inscl_*`, coded-field masters.
- **Join keys confirmed:** `zdata_visit.pid.value` → `zdata_person._id`; `zdata_patient_assessment.vid.value` → `zdata_visit._id`; sub-collections `xparentx` = parent `_id`.
- **`zdata_visit.pid` denormalizes** hn/prename/p_fname/p_lname/age/birth_date/p_gender/p_abogroup/p_phone/p_pic — but **NOT** p_cid/address/relate/allergy (→ need person join).
- Real fields: person `relate[]` (r_code/r_fname/r_lname/r_cid/r_occup…), `allergy_main[]`, current address `now_*`, coded fields are `{label,value}` objects, `age` = stored int, `birth_date` = str AD. Assessment has vitals + drug_allergy/food_allergy/underlying_disease/cc/pi.
- ⚠️ Env var `MDB_MCP_CONNECTION_STRING` still points to the wrong (erp) server; `.env` correctly holds NO URI. Persistence fix = set the Windows User env var to the `his` read-only URI (ideally a read-only DB user, not root). Root URI was pasted in chat → rotate.

## [2026-07-31] ingest | LAB (งานชีวเคมี) — requirement memo + paper request form + built order component
- New project kick-off: the **[[lis|LAB/LIS]] module**. Three sources ingested at once (2 photographed docs transcribed into `03-source-materials/`, 1 form JSON already in the vault).
- New source [[his-lab-biochem-requirements]] (`03-source-materials/his-lab-biochem-requirements.md`) — the lab unit's memo: **4 modules unused** (3.4.4.1 / 3.4.4.3 / 3.4.4.10 one-click Order Work List / 3.4.4.11 PCT out-lab), **4 modules used but missing from spec** (Lab Request Monitoring, สถานะการสั่งแลป, ข้อมูลห้องแลป, บันทึกความเสี่ยง), and **11 add/fix requests**.
- New source [[his-lab-che-request-form]] (`03-source-materials/his-lab-che-request-form.md`) — paper ใบส่งตรวจ **C-20 / L3.1** (form no. 148-1-8/เม.ย.69): header (Name/HN/Age/Ward/Tel + แพทย์ที่สั่งตรวจ + **Lab No. "สำหรับเจ้าหน้าที่ Lab เท่านั้น"**), **สิ่งส่งตรวจ block** (Blood→Clotted/iCa/Li-Hep/NaF/EDTA · Urine→spot/24h+ml · CSF · Body fluid+ระบุ · ผู้เก็บ/เวลาเก็บ), **25 groups / 90 codes** in 4 columns, note "สั่ง Globulin = C2 + C3", no prices.
- New source [[his-lab-che-order-component]] (`SDForm/sdform_module/Lab_CHE_Order_Component.json`) — 3 fields: `lab_patient_header` (vue-ui banner + BMI/vitals/history/SVG charts, reads `getFormRef().$labTran`), hidden `selected_items_json`, `lab_che_order_ui` (tick sheet). **Verified: all 90 codes present, grouping/order matches the paper form** → requirement 2 is DONE.
- **Rewrote [[lis]]** from a 3-line stub to the module's concept page: the **รอรับเข้า → รับเข้าดำเนินการ → ออกผลแล้ว** pipeline, LAB NO. as lab-owned & mutable, specimen-as-data, per-item modifiers (GTT นาที / urine 24h ml), critical values in 3 places, ปกปิดผล, manual-entry fallback, "สำเนาพิมพ์ออนไลน์" print semantics, master data (HIS→LIS code map, price per สิทธิ, reject reasons).
- New synthesis [[his-lab-module-plan]] — scope in/out, **9 screens (S1–S9)**, gap analysis (built vs missing), **proposed `zdata_lab_order` / `_item` / `_result` / `_test` / `_price` / `_reject_reason` / `_risk` model**, 6-step build order, **10 blocking decisions**.
- Updated `00-home/index.md` (11 sources · 7 entities · 26 concepts · 3 syntheses) + [[his]].
- ⚠ Biggest open question: **how orders actually reach the LIS today** — the one-click push (3.4.4.10) is listed as *unused* yet results clearly flow back. Also unresolved: the `3.4.4.x` spec doc itself, Report LIS sort order, critical-value ownership/age bands, ปกปิดผล governance, advance-order source (req.1 vs unused ผู้ป่วยนัด list), IPD scope, price source, 6 faint items on the form, and whether CHE is a pilot or the whole project.

## [2026-08-04] ingest | Open Design repo (nexu-io/open-design) — second domain opened
- Checked first: `grep -i "open-design|nexu"` over the whole vault returned **nothing** → not previously ingested, despite a local copy sitting at `../open-design/` since 2026-08-04.
- New source [[open-design-repo]] — read `README.md`, `AGENTS.md` (`CLAUDE.md` is just `@AGENTS.md`), `CONTEXT.md` in full; sampled `docs/skills-protocol.md`, `plugins/spec/SPEC.md`, `design-systems/{linear-app,claude}/`, `skills/*/SKILL.md`.
- New entity [[open-design]] — Apache-2.0 local-first design workspace, "the open-source Claude Design alternative". Ships **no agent**: spawns the 25 coding-agent CLIs on your `PATH` (26 runtime defs), or BYOK via an SSRF-guarded proxy. Desktop (Electron) + daemon (Node 24/Express/SSE/SQLite) + `od` CLI + stdio MCP server. Surfaces: prototype · live artifact · deck · image · video (HyperFrames HTML→MP4) · audio.
- New concept [[design-md]] — the brand-as-markdown contract (9 sections, roles not raw hexes); package may add `manifest.json` / `tokens.css` / `design-tokens.json` / component fixtures / `source/evidence.md`.
- New concept [[skill-md]] — the Claude Code Agent Skills format adopted verbatim + an `od:` block (`mode`/`surface`/`scenario`/`craft.requires`) and multilingual `triggers:`. **Same object as this project's own `.claude/skills/`.**
- New concept [[od-plugin]] — `open-design.json` + type payload; `od.capabilities[]` declare-the-minimum, `od plugin scaffold|validate|apply`, PR-based marketplace.
- **Counts verified against the local copy, not the README:** `skills/` **162** dirs (README says "100+") · `design-systems/` **151** packages ✅ · `design-templates/` **114** dirs · `plugins/_official/` **460** dirs (= 277 + 183) ✅ · `runtimes/defs/` **27** `.ts` files.
- Updated `00-home/index.md` (12 sources · 8 entities · 29 concepts · 3 syntheses) + a new **"Second domain"** line, since Open Design is unrelated to [[initcraft]] / [[his]].
- **Repo conventions flagged as worth stealing for this vault / HIS docs:** `AGENTS.md` as the single agent entry point with per-layer files that must not restate each other · the "Daemon data directory contract" single-source-of-truth section that forbids concrete examples elsewhere and names its own escape candidates · `CONTEXT.md` as a glossary where every term carries an explicit `_Avoid_:` list · the UI/CLI dual-track rule (endpoint + UI + `od` subcommand in one PR) · the red-spec-first bug playbook.
- ⚠ Open questions: **why this was ingested is not recorded** — `.claude/commands/od-contribute.md` and an empty `open-design-stage/` hint at contributing, but that's inference. Local copy is **not a git repo** (unpacked from `open-design-main.zip`) so the snapshot can't be pinned to a commit; `package.json` says **0.16.1** while the README roadmap stops at 0.13.0 and `docs/roadmap.md` + `docs/spec.md` are marked archived. `open-design-extracted/` is a second unread copy. Windows-native support is **best-effort only** (corepack EPERM; `better-sqlite3` compiles from source on Node 24) — relevant, this machine is Windows 11.

## [2026-08-04] ingest | LAB units 2 & 3 (ชีวโมเลกุล + ภูมิคุ้มกัน) + module_packages backups
- User dropped requirement/real-data photos into `02-his/data/` and three module exports into `SDForm/sdform_module/`. Six new images read in full; the four `data/Biochemistry/*.PNG` were confirmed to be the already-transcribed 07-31 docs and were **not** re-ingested.
- New raw transcription `03-source-materials/his-lab-bg-request-forms.md` → source [[his-lab-bg-request-forms]]. **Three** genetics forms: `C-20/L8.1` (FM-LAB-BG-660-00: Cytogenetic + Molecular cytogenetic + Newborn Screening + Additional), `C-20/L8.2` (FM-LAB-BG-661-01, **2 หน้า**: Molecular analysis + Gene sequencing + Point mutations), and the standalone **`BG49` Urine organic acid** sheet.
- New raw transcription `03-source-materials/his-lab-immuno-request-forms.md` → source [[his-lab-immuno-request-forms]]. Two sheets: `C-20/L5.1-1` in-house (6 groups, ~100 tests) and `C-20/L5.1-2` **OUT LAB** (flat A→Z, ~200 tests), both ฉบับปรับปรุง 16 เม.ย. 2564.
- **This kills the "CHE = the project" assumption — it is a pilot.** Four things the CHE-shaped design cannot express: (1) **composite codes** — `BG17+21`, `BG16+20`, `BG17+19+22` with the printed rule `*,** สั่งตรวจด้วย 2,3 รหัสการทดสอบตามลำดับ` (~50 rows; biochem's "Globulin = C2+C3" was the same thing seen once); (2) **per-test required fields & single-select sub-options** — `BG49` demands `urine creatinine mg/dl`, `BG50 FISH` picks one Chr locus; (3) **clinical narrative inside the order** — `BG1` reserves half a page for History/PE/Diagnosis; (4) **out lab in two different shapes** — a per-test `: Out lab` flag (genetics) *and* an entire parallel catalogue (immunology).
- Also new at order level: **urgency** `☐ ด่วน OR ☐ ด่วน อุบัติเหตุ ☐ ด่วน เพราะ___` (immuno), **สิทธิการรักษา printed on the request**, **panels** (`IM120` 27 allergens, `IM121` 36 allergens), **external allergen codes** (`d1`/`f1`/`e1`/`i1`/`fx5` alongside the HIS code), and a **referring-hospital** header on `BG49` (โรงพยาบาล, not Ward) → the genetics lab accepts specimens from other hospitals.
- **First printed price anywhere:** `BG45 TSH (DBS) = 125 บาท`. First explicit **TAT/method**: `BG49` = 10 วันทำการ, Qualitative, GCMS. Receiving desk has **hours** (จันทร์–ศุกร์ 08.30–15.30) → รับเข้า is not 24/7.
- **Header comparison across all 3 units: no two match.** Built the table in [[his-lab-immuno-request-forms]]; conclusion = the order header must be driven by a new `zdata_lab_unit.header_fields[]`, not hard-coded.
- New source [[his-module-packages-backup]] + new concept [[module-packages]] — the App Factory registry that publishes a form as a module: `app_code`/`app_name`/`app_desc`/`app_logo[]`/`tool_license` + `app_packages[]` tabs (`tab_form.value` → formId, `tab_icon`, `tab_label`, `tab_roles`). **Permissions (`app_assign_roles`, `tab_roles`) are `null` on every HIS module.**
- 🆕 **[[pis|PIS]] has started:** `pis_drug` / "Drug & Stock" / *Pharmacy Back Office*, tab "Drug Items", `xunitx = B001 เภสัชกรรม`, created 2026-07-29, updated 2026-08-02. Form body `6a68f6cec91cb8030e26d75d` **not exported** — fields unknown. Possibly related to `02-his/data/cpoe_items_cleaned_2026_07_29.xlsx` (same date).
- Rewrote [[lis]] with a "the lab units" section (3-unit table + what each breaks) and expanded master data; updated [[pis]]; **revised the scope, data model, and open decisions of [[his-lab-module-plan]]** — `zdata_lab_test` gains `components[]`/`out_lab`/`external_codes[]`/`extra_fields[]`/`sub_options[]`/`tat_days`/`method`/`result_type`/`instructions`, plus a new `zdata_lab_unit` master; decision #10 answered (pilot) and **8 new blocking decisions (#11–18)** added.
- Updated `00-home/index.md` (15 sources · 8 entities · 30 concepts · 3 syntheses).
- ⚠ **Data-quality warnings recorded on both raw files:** genetics gene/exon/`c.`/`p.` notation is OCR-risky; the immunology out-lab sheet cannot distinguish `I0` (zero) from `IO` (letter O), producing apparent duplicate codes (`I0010`, `I0011`, `I0019`, `I0042`…). **Neither transcription may be used as a master list** — the lab's electronic catalogues are now a blocking ask (#13). Also unresolved: a handwritten note beside `BG39` (reads ~`6360`), missing `IL36`, and whether the four code namespaces share one master.

## [2026-08-04] query | LAB worklist UI — 3-tab design (S2/S3/S4)
- Request: design the lab's main working window in **Figma** (3 tabs: รอรับ / รับเข้าแล้ว / ออกผลแล้ว), where the existing list-order screen sits inside tab 2 per selected patient.
- ⚠ **No Figma integration exists in this environment** — can neither write to nor read the linked file. Delivered instead as a **clickable HTML mockup**, `02-his/ui/lab-worklist-mockup.html` (importable to Figma via `html.to.design`, and reusable as the [[vue-ui-pattern|`vue-ui`]] skeleton). Also published as an artifact.
- New synthesis [[his-lab-worklist-ui]] — records the structure, every design decision mapped to the requirement that backs it, and what is invented vs sourced.
- Structure: each tab is a **master–detail split** (queue 380px | detail). Tab 1 = S3 รายละเอียดคำขอ (edit/delete lines, ออก/แก้ LAB NO., รับเข้า with time stamp, ปฏิเสธ + reason, สิทธิ/ชำระเงิน, พิมพ์ใบสั่งตรวจ). Tab 2 = the existing order list per patient + **ลงผล Manual (LIS ล่ม)** + explicit **รอผล** on every unresolved line. Tab 3 = S4 results with value/unit/Ref.Range/comment, ปกปิดผล at 50% with audit trail, and the **สำเนาพิมพ์ออนไลน์ + ผู้พิมพ์ + datetime + page 1/2** footer.
- Two design decisions worth keeping: **left severity stripe** on every queue row (state readable peripherally), and **LAB NO. as a monospace plate that itself turns red + ⚠** — because req. 8 says the critical alert must be *"ตรง LAB NO."*, which a floating badge next to it does not satisfy.
- Visual system **inherited, not invented**: reuses the Element Plus tokens and `.lab-*` conventions already in [[his-lab-che-order-component]]'s `cssCode`, so mockup and real component render identically. Thai type via a system stack (no web font → no silent fallback); light + dark defined at token level.
- ⚠ Three things flagged **inside the mockup itself** as invented: the **ด่วน** control (exists on immunology's L5.1-1, **not** on biochem's L3.1 — cut it if ชีวเคมี doesn't use it) · **ราคา** (placeholders; no source — decision 8) · **result ordering** (grouped by paper form; req. 5 wants Report LIS order — decision 3). All patients/values fabricated; test codes real.
- Not covered: S1 (built), S5/S6/S7/S8/S9, and the **multi-unit header problem** — this design assumes one unit; genetics/immunology still need the `zdata_lab_unit`-driven header.

## [2026-08-16] ingest | codex-backup — parallel LAB Workbench + Clinic Master workspace
- User pointed at `/Users/nichada/Documents/codex-backup` — a **separate AI coding session's workspace** (a "codex" CLI agent working directly against initCraft, untracked by this vault) — and asked for a deep ingest, one source page per milestone.
- **This supersedes [[his-lab-module-plan]].** The plan (frozen 2026-08-04, CHE-pilot framing, proposed `zdata_lab_order`/`_item`/`_test`/`_unit` model) was never implemented past [[his-lab-che-order-component]]. The parallel workspace spent 2026-08-08 → 08-16 actually building the LAB module with a different architecture: **one shared Lab Workbench app filtered by `lab_section`**, not one app per unit. Added a dated supersession notice to the plan page; kept its content for history.
- Six new sources on the real build, in dependency order: [[his-lab-workbench-handoff]] (core architecture, non-negotiable decisions, shared Order/Result Item model, existing production form IDs) → [[his-lab-center-cpoe-master]] (doctor CPOE screen bound to a 1,605-record LAB+Xray master; `room_code` mapping; a LAB/Xray top-level grouping bug found and fixed) → [[his-lab-center-specimen-hub]] (3 build attempts at a central specimen-check screen — 2 abandoned to a `vue-ui` proxy/`activeTab` render error, 1 safe native-ListView version; a `form_ui` zero-row bug left unresolved) → [[his-lab-work-item-bridge]] (the architecture that replaced debugging the hub: canonical `zdata_specimen_collection_status` queue → idempotent bridge API → shared `zdata_lab_cen_crud` Work Item queue) → [[his-lab-specimen-status-session-aug16]] (the freshest material — same-week VN patient-snapshot hydration, EMR-style receive navigation cloning the real `opd_card`, an edit-audit trail `order_change_history_json`, two dev-only bypass switches) → [[his-lab-bio-workspace]] (Biochemistry's actually-working order/receive/reject lifecycle, the reference every other section generalizes from; found a `start_process` state-machine mismatch that skips `processing`).
- Separately, [[his-clinic-master-handoff]] — a different initiative (generic Clinic Master → target form + shared status queue) discussed at length earlier this session but only now written up as a source page; confirmed `disease.json` is a structural twin of `clinic-master.json` (same generic master pattern); found a real gap (no field for a doctor's free-text consult order) not in the original handoff's own task list.
- [[his-lab-misc-artifacts]] — two confirmed-superseded predecessor scripts, plus an **unlogged, previously-unrecorded drug-label printing side project** (2026-08-06: Figma exports, SQL/Report Factory backups, a live `label-preview` component) that this vault had never read before.
- ⚠ **Naming-collision finding:** the file built earlier this session, `SDForm/sdform_module/lab-unit-master.json` (a generic lab-department/section reference master), is **redundant** — a real, already-populated **Lab/Section Master** exists in production (`ประเภทการตรวจ`, form `6a79986bd5218a5b6a26bd15`, collection `zdata_section_code`) and is already the live routing key everywhere. Flagged to retire that file, not import it.
- ⚠ **`his-lab-che-order-component.md` (2026-07-31) is now outdated** — `Lab_Bio_Order_CRUD.json` is a materially more complete successor with a real save target and full receive/reject/recheck lifecycle. Not yet edited (kept ingest scope to new pages); flagged for a follow-up pass.
- Data gaps flagged, not yet ingested: `SDForm/sdform_module/EMR_form/lab_center_order.json` (290KB), `Labcenter.json` (488KB), and the Aug-13 `EMR.json` (248KB) already sit in this vault as the direct input/output of the CPOE-master build script but have not been read.
- Updated `00-home/index.md` (15 → **23 sources**), added a top-of-file pointer to the new material, and marked [[his-lab-module-plan]]'s index entry superseded.

## [2026-08-17] query | slow report diagnosis + queue-number field + mongo-his MCP installed
- User reported a slow-loading report and asked to check two fresh exports: `backup-data_report-factory_2026_08_17_21_01_15.zip` (Report Factory) + `backup-data_sql-factory_2026_08_17_21_04_17.zip` (SQL Factory). Filed the whole investigation as [[his-medical-record-report]] — fulfilling a greyed-out link that had sat in [[his-data-model]] since 2026-07-20.
- **Diagnosis:** the report's SQL (`ใบปกเวชระเบียนผู้ป่วยนอก + บัตรฉีก`) is `FROM zdata_person` joined out to `zdata_visit`, but filters on the *joined* table's `_id` — backwards from the one other working example on file ([[sql-factory]]'s `vms_car`, which filters `_id` directly on `FROM`). Recommended flipping to `FROM zdata_visit WHERE _id = :xparentx` first. Also flagged the join condition (`zdata_visit.xparentx`) doesn't match [[his-data-model]]'s documented join key (`zdata_visit.pid.value`) — possibly wrong independent of performance.
- **Second ask, same session:** add the OPD queue number (e.g. "D001", seen live in the EMR "My Room" screen) to the report. Confirmed `zdata_visit.visit_priority` is a false friend — it's a priority *enum* (`10 ตามคิว / 20 เร่งด่วน / 30 STAT`, matches the "routine" the user saw in the DB), used only for sort order, not the displayed code. Traced the real fields via `EMR.json`'s queue-label JS (`qtype` + zero-padded `queue_no`) to a previously undocumented collection, **confirmed live in the SQL Factory field picker**: `zdata_visit_tran` (form `6a461235e521219e514d1c4b`, "Visit Tran"), joined via `vid.value`. Updated [[his-data-model]] with the newly-confirmed `zdata_visit_tran` field list and a new join-key entry. Gave a full JOIN/SELECT spec to add to the report's SQL, including an unverified `CONCAT`/`RIGHT` custom expression (no confirmed function vocabulary for this SQL dialect beyond `CASE`/`IFNULL`/`CONVERT`/`SIZE_OF_ARRAY`).
- **Installed `mongo-his`** — a read-only MongoDB MCP server (`mongodb-mcp-server`), project-scoped to this vault, connection stored in a new `.env` (already covered by `.gitignore`, chmod 600) + duplicated into `~/.claude.json` by `claude mcp add` (expected/normal). ⚠ The connection uses the `root` DB user — `--readOnly` is enforced only by the MCP server software, not real DB-level permissions; recommended a dedicated read-only Mongo user as a stronger follow-up. ⚠ **The Mongo root password was pasted into chat in plaintext** (second time this has happened in this project) — user was told to rotate it.
- **Newly-added MCP tools did not load into the already-running session** — `claude mcp list` confirmed the server as connected, but `ToolSearch` found none of its tools. This needs a session restart before any of the above (join direction fix, queue field names, `CONCAT`/`RIGHT` support) can actually be verified against live data — recorded as an explicit "verification pending" section in the new page rather than claimed as confirmed.
- Updated `00-home/index.md` (23 → **24 sources**), `his-data-model.md` (`zdata_visit_tran` fields + join key + Related), and this log entry. Also saved a **reference**-type memory entry for the `mongo-his` MCP (cross-session pointer, since MCP config lives outside this repo).

## [2026-08-18] query | his-medical-record-report verified live + shipped, new platform gotchas found
- Follow-on to 2026-08-17's session: `mongo-his` MCP now loaded (session had been restarted), used it to verify every unconfirmed claim from that session against live `his` data before touching the live report.
- **Confirmed correct, not a bug:** `zdata_visit.xparentx` and `zdata_visit.pid.value` hold the same value on every visit sampled (11 visits) — the original join condition was fine all along; only the `FROM`/`WHERE` direction was ever the real performance bug. Updated [[his-data-model]].
- **Corrected a wrong prior claim:** `zdata_visit_tran.queue_label` **is** a real, populated field (contrary to 2026-08-17's "dead defensive code" conclusion) — populated on visits from ~2026-07-27 onward (null before ~2026-07-20). Not exposed in SQL Factory's field picker (undeclared in the Visit Tran SdForm schema) but reachable via a raw Custom expression. Final `queue_display` field ships as a direct reference to it, no function needed.
- **Found and fixed a real platform bug while applying the FROM/JOIN fix via file import:** SQL Factory documents store the JOIN graph in two places, `sql_join` (display copy) and `sql_options.join` (the one actually executed) — edited only the first on the first attempt, producing a query whose JOIN silently kept the old, broken condition (0 rows, no error). Fixed by editing both; documented as a standing gotcha in [[sql-factory]].
- **Found the dialect's real function boundary:** a nested `CONCAT(...RIGHT(CONCAT(...)))` zero-pad expression failed with an empty-`sql` "Query Error." — isolated to `RIGHT` specifically; plain `CONCAT` (even nested with `CASE`/`IFNULL`/`ARRAY_ELEM_AT`/`SIZE_OF_ARRAY`) is confirmed working, proven by both a pre-existing field in the same query and a new `age_display` field added this session (`CONCAT` of `age`+`legacy.age_month`+`legacy.age_day` → "62 ปี 8 เดือน 3 วัน"). Found `legacy.age_month`/`legacy.age_day` are a frozen HOSXP migration snapshot — populated on ~94k migrated patients, absent on every patient registered after the new system's launch.
- Cloned the fixed SQL as a new SQL Factory record (Clone Data / insert-new-id, original left untouched) and confirmed it returns correct data. Edited the report's header widgets (removed external logo, centered the title line) via the same JSON-export-edit-reimport workflow.
- **New discovery: a report edit isn't live just by saving.** Traced the real publish chain — Report Factory (edit/preview) → a "Report Items" widget bound to a form's ListView → App Factory publish → the deployed app (QSNICH). Documented in [[report-factory]].
- **Left one bug open, unresolved:** `{{prename_text}}` renders correctly in Report Factory's own Preview but shows as the literal unresolved tag in both the SDForm widget preview and the live QSNICH app, on a real patient — survives a hard refresh. Leading theory is a stale compiled-template cache in the widget/deployed-app layer, not yet confirmed. Flagged prominently to pick up first next session.
- User connected the **Claude in Chrome** browser extension mid-session (`/chrome`) — same "needs a session restart before its tools load" caveat as `mongo-his` applied; not usable yet this session.
- Updated `00-home/index.md` (his-medical-record-report one-liner), [[his-data-model]] (`legacy.*` fields, `queue_label`, `xparentx` equivalence), [[sql-factory]] (dual-JOIN gotcha, confirmed function list, Custom-expression-can-reach-undeclared-fields note), [[report-factory]] (publish chain, open cache bug), and this log entry.

## [2026-08-24] note | HIS↔LISconnect flow deck — ออกแบบใหม่ตาม design system "FA V2"
- **ขอบเขต**: `02-his/draw_design/request_reciece_agents_flow.drawio` — เดิม 4 หน้า (สเก็ตช์ + งานรอบก่อน 2 หน้า + หน้าว่าง)
  → ตอนนี้ **12 หน้า**: 9 หน้าใหม่ + `Raw · Screenshots` (Page-1 เดิม ย้ายมาท้ายไฟล์) + `(v1)` 2 หน้าเดิมที่ถูกแทนที่
- **หน้าใหม่**: Overview · Receive Flow · Order Submit Flow · Order Payload · Result Callback ·
  Status Lifecycle · Field Mapping · Errors & Edge Cases · Open Questions
- **แหล่งข้อมูล**: `/Users/nichada/Documents/LIS/` — `his-order-submit-spec.md` (68 KB, ลงวันที่ 2026-08-23),
  `his-order-sample.json`, `his-result-sample.json` — **อยู่นอก vault ยังไม่ได้ ingest**
- **ตัวอย่างดีไซน์ที่ผู้ใช้ให้มา** = ผัง "FA V2 · ห้องการเงิน" 13 หน้าบน Google Drive (public, ดึงมาได้)
  ถอด design token ออกมาใช้ทั้งชุด — ดู `[[his-lis-flow-deck]]` ถ้าเขียนหน้า wiki ภายหลัง
- สร้างด้วย generator (Python) + renderer ตรวจ layout ด้วยภาพก่อนติดตั้ง — script อยู่ใน scratchpad ยังไม่ได้เก็บเข้า repo

## [2026-08-25] query | SDForm import: preview ว่างแต่ Tree View มี widget — หาสาเหตุได้แล้ว
- **อาการ**: import JSON เข้า form-builder → canvas ว่าง แต่ Tree View ขึ้นครบ · คลิกในพื้นที่ว่างแล้ว widget โผล่
- **สาเหตุจริง: `options` ของ widget ไม่ครบชุด** (ไม่ใช่ `id`, ไม่ใช่ cssCode, ไม่ใช่โครงสร้าง root)
  - `text-input` ต้องมี **43 ช่อง** — ไฟล์ที่เขียนเองมีแค่ 25 ขาด 18 (`labelWidth` `labelAlign` `size`
    `labelColor` `prefixIcon` `suffixIcon` `showWordLimit` `minLength` `appendButton` …)
- **หลักฐาน** (สแกน 57 ไฟล์ใน `~/Documents/codex-backup/`): ทุกไฟล์ที่ options ไม่ครบ = preview ว่าง ·
  ทุกไฟล์ที่ options ครบ = ใช้งานได้ **แม้จะตั้ง `id` เองแบบ kebab ก็ตาม**
  (`Lab_Bio_Order_CRUD.json` 32 widget · `Center_Lab_Order_Master_Bound.json` 3 widget — id ตั้งเอง แต่ options ครบ → ทำงานได้)
- **ตัดออกแล้ว**: รูปแบบ `id` · `key` (ไฟล์ที่ใช้งานได้จริงมี key ซ้ำกัน 40/47 ตัว = ไม่ใช่ identity) ·
  cssCode (ไม่มี display:none) · widget เดี่ยวที่ root (`disease.json` ของระบบก็มี textarea เดี่ยวที่ root)
- **แก้แล้ว**: `codex-backup/Result_Report_Manual_UI_FIXED.json` — เติม 108 ช่อง + `key` ที่หายของ `list-ui`
  โดยไม่แตะ id / label / name / formConfig เดิม
- ⚠️ `file-upload-input` (32 ช่อง) ไม่มีฟอร์มอ้างอิงในเครื่อง — ยังยืนยันไม่ได้ว่าครบ

## [2026-08-25] note | ตั้งกฎเหล็ก SDForm JSON + validator ให้ Codex ใน ~/Documents/codex-backup
- **ปัญหา**: กฎเดิมใน `AGENTS.md` (เขียนไว้ 2026-08-23 หลังเคสแรก) กว้างเกินไป — บอกแค่ "compare
  options schemas with a known working exported form" ไม่มีตัวเลข ไม่มีเครื่องมือ → **เกิดซ้ำอีก 08-24**
- **ไฟล์ใหม่ใน `~/Documents/codex-backup/`**
  - `SDFORM_JSON_RULES.md` — กฎเหล็กฉบับเต็ม: อาการ · หลักฐาน · **ตารางจำนวนช่อง options ต่อ
    component 23 ชนิด** · ฟอร์มแม่แบบที่ก๊อปได้ · สิ่งที่ตัดออกแล้ว (id/key/cssCode/root) · ข้อจำกัด
  - `check_sdform_json.py` — validator รันก่อนส่งไฟล์ทุกครั้ง exit 1 = ห้ามส่ง
    ดึงชุด options มาตรฐานจากฟอร์มแม่แบบในโฟลเดอร์เอง (ไม่ hardcode → ไม่ล้าสมัย)
    ใช้ **intersection** ไม่ใช่ union เพราะ union เข้มเกินจน `person.json` ของระบบเองยังไม่ผ่าน
  - `Result_Report_Manual_UI_FIXED.json` — ไฟล์ที่แก้แล้ว ผ่าน validator
- **แก้ไฟล์เดิม** (ต่อยอด ไม่ทับ): `AGENTS.md` เพิ่มหัวข้อ 🔴 HIGHEST PRIORITY ไว้บนสุด +
  ชี้ validator ในหัวข้อ Mandatory Delivery Verification · `MEMORY.md` เพิ่ม pointer
- **ทดสอบ validator**: ฟอร์มแม่แบบ 10 ไฟล์ผ่านหมด · ไฟล์ที่รู้ว่าพัง 3 ไฟล์ไม่ผ่านหมด
- ⚠️ ระหว่างทางเคยตั้งกฎผิดว่า "ทุก widget ต้องมี key" — `Lab_Bio_Order_CRUD.json` ที่ใช้งานจริง
  ไม่มี key ใน 27/33 widget แต่ทำงานได้ จึงถอดออกเป็นแค่ข้อสังเกต

## [2026-08-25] note | SDForm preview ว่าง — เจอ 4 สาเหตุ ยังเหลือ list-ui, handoff ให้ Codex แล้ว
- **แก้ข้อสรุปเดิมของวันนี้**: "options ไม่ครบ" เป็นเงื่อนไข **จำเป็นแต่ไม่พอ** — รวมแล้วมี 4 ข้อ
  | ก | `options` ครบชุดตามแม่แบบ | ✅ ยืนยัน |
  | ข | มี container ห่อ · ลูกอยู่ใน **`.fields` ไม่ใช่ `.widgetList`** | ✅ ยืนยัน |
  | ค | ห้ามใส่ `key` ให้ component ที่แม่แบบไม่เคยใส่ (`list-ui`) | ⚠️ ยังไม่พิสูจน์ว่าเป็นสาเหตุ |
  | ง | ห้ามแต่งค่า presentation เอง (`labelIconClass:"el-paperclip"` ฯลฯ) | ✅ ยืนยัน — แก้ file-upload ได้ด้วยข้อนี้ |
- 🔴 **บทเรียนสำคัญ**: เคยสรุปว่า "ขึ้นแล้ว" 2 ครั้งแล้วผิดทั้งคู่ เพราะภาพหน้าจอมี widget ถูกเลือกอยู่
  ซึ่งการเลือกทำให้ canvas re-render — **หลักฐานต้องเป็นภาพหลัง import ที่ไม่คลิกอะไรเลย
  และ Property panel แสดง Form Setting** เขียนเป็นกติกาลงเอกสารแล้ว
- ข้อ ข กับ ค เกิดเพราะ**คำสั่งที่เขียนให้ Codex ผิดเอง** (`cols[].widgetList` และ "ใส่ key ให้ครบ")
- ยืนยันแล้วว่า render ได้: `text-input` ในกริด · `file-upload-input` ที่ root
  **ยังไม่เคยยืนยัน**: `list-ui` — handoff ต่อที่ `codex-backup/HANDOFF_SDFORM_LIST_UI.md`
- ได้แม่แบบใหม่จากผู้ใช้: `TEMPLATE_file_upload_from_builder.json` (ลาก widget จาก palette แล้ว export)
  → วิธีนี้ใช้เก็บแม่แบบ component ที่ยังไม่มีได้ทุกตัว

## [2026-08-27] schema | Relocated and categorized the InitCraft vault
- ย้าย vault ทั้ง repository จาก `~/Documents/init-vault` ไปที่ `~/Documents/Initcraft skill` โดยคง Git history และการตั้งค่า Obsidian ไว้
- จัดโครงสร้างใหม่เป็น `00-home/`, `01-knowledge-base/`, `02-his/` และ `03-source-materials/`
- ปรับพาธอ้างอิง คู่มือ `CLAUDE.md` และ workspace ของ Obsidian ให้ตรงกับโครงสร้างใหม่
- เพิ่ม `README.md` เป็นแผนผังเริ่มต้น และเพิ่ม `.DS_Store` ใน `.gitignore`

## [2026-08-27] ingest | Consolidated initCraft skills and factory artifacts
- คัดลอกแบบ non-destructive จาก active skills และ `~/Documents/codex-backup`; ไม่ลบต้นฉบับ
- เพิ่ม `02-initcraft/` สำหรับ skills/governance/manifest และแยก artifacts ใน `02-his/` ตาม
  Form Factory, API Factory, SQL Factory, Report Factory, tests/tools, data imports และ architecture
- ตรวจ active skills 8 ชุดด้วย recursive diff และตรวจ SDForm export 73/73 ไฟล์
- ไม่รับ `.env`, credential, session/SQLite state, plugin cache, `.DS_Store` หรือ compiled files
- เพิ่ม [[initcraft-library-migration]] และเชื่อมหน้าความรู้ของ Form/API/SQL/Report/Skill เข้ากับคลังใหม่

## [2026-08-27] schema | Separated JSON into SDForm and JavaScript into API
- ย้าย JSON 107 ไฟล์ไป `SDForm/` และ JavaScript 40 ไฟล์ไป `API/`
- คง path หมวดย่อยเดิมเพื่อป้องกันชื่อซ้ำ (`EMR.json`, `disease.json`, `Mockup_V2.json`)
- ไม่แตะไฟล์ JSON/JavaScript ภายใน active skill packages และไม่ลบต้นฉบับใน `codex-backup`
- อัปเดต schema, manifest, index, hotcache, concept pages และ checksums ให้ชี้ตำแหน่งใหม่

## [2026-08-27] schema | Separated Python artifacts into seed
- ย้าย Python artifacts 32 ไฟล์ไป `seed/` และคง path หมวดย่อยเดิม
- ไม่ย้าย `erp_mongo_readonly.py` เพราะเป็น executable resource ภายใน active skill package
- อัปเดต schema, manifest, index, hotcache และ checksum ให้ชี้ตำแหน่งใหม่

## [2026-08-27] schema | Grouped artifact libraries under Form-Builder
- ย้าย `SDForm/`, `API/` และ `seed/` จาก root ของ vault ไปไว้ใต้ `Form-Builder/`
- คงโครงสร้างย่อยและเนื้อหาไฟล์ทั้งหมด โดยจำนวนไฟล์ก่อนและหลังย้ายตรงกัน
- อัปเดต README, AGENTS, CLAUDE schema, migration manifest, index, hot cache,
  knowledge-base paths และ checksum catalog ให้ชี้ตำแหน่งใหม่
- ไม่แก้ source material แบบ immutable และไม่ย้อนหลังเปลี่ยน log entries เดิม

## [2026-08-27] schema | Added Form and API template backup folders
- เพิ่ม `Form-Builder/SDForm/backup/` สำหรับต้นแบบ Form JSON แบบมีเวอร์ชัน
- เพิ่ม `Form-Builder/API/backup/` สำหรับต้นแบบ API Factory JavaScript แบบมีเวอร์ชัน
- เพิ่ม README กำกับการตั้งชื่อ การลบข้อมูลจริง/ความลับ และการตรวจสอบก่อนนำกลับไปใช้
- อัปเดตแผนผัง repository, migration manifest, knowledge page และ hot cache ให้ชี้ตำแหน่งใหม่

## [2026-08-27] schema | Established the hot-cache-first protocol
- กำหนดให้ทุก turn อ่าน `00-home/hotcache.md` ก่อนเปิดไฟล์อื่นใน repository
- อนุญาตให้ตอบคำถามแบบ read-only จาก Hot Cache ได้ทันทีเมื่อข้อมูลเพียงพอ
- งานแก้ไข ข้อมูลไม่แน่นอน การอ้างหลักฐาน และการตัดสินใจที่มีความเสี่ยงยังต้องตรวจไฟล์ authoritative
- กำหนดเพดาน Hot Cache ไม่เกิน 500 คำ และให้สรุปบทสนทนา สถานะ การตัดสินใจ blocker และ next step ล่าสุด

## [2026-08-27] schema | Made Form and API backup folders read-only
- กำหนด `Form-Builder/SDForm/backup/` และ `Form-Builder/API/backup/` เป็นคลังอ้างอิงสำหรับเปิดดูหรือคัดลอกเท่านั้น
- ห้ามแก้ ลบ เปลี่ยนชื่อ ย้าย reformat หรือเขียนทับ snapshot เดิมภายใน `backup/`
- Form ใหม่ให้ทำงานนอก backup โดยปกติที่ `Form-Builder/SDForm/form-factory/forms/`
- API process ใหม่ให้ทำงานนอก backup โดยปกติที่ `Form-Builder/API/api-factory/processes/`
- เพิ่ม snapshot ใน backup ได้เมื่อผู้ใช้สั่งโดยชัดเจนเท่านั้น และต้องเพิ่มเป็นไฟล์เวอร์ชันใหม่

## [2026-08-27] schema | Added end-of-task context checkpoint
- กำหนดให้ประเมิน context ก่อนส่งคำตอบสุดท้ายของทุกงานที่เสร็จ
- ทุกงานที่เปลี่ยน repository ต้องอัปเดต Hot Cache พร้อม outcome, path, verification, blocker และ next step
- ถ้า context ต่ำ ให้หยุดเริ่มงานใหม่ ตรวจงาน แล้ว commit เฉพาะไฟล์ของงานที่แยกได้อย่างปลอดภัยพร้อม Hot Cache
- ห้ามใช้ `git add -A` ใน dirty worktree และห้ามรวมไฟล์เดิม/ไฟล์ผู้ใช้/ไฟล์ที่ยังไม่ตรวจ
- ถ้าแยก commit ไม่ได้ ให้บันทึก blocker และแจ้งผู้ใช้แทน; แนะนำเปิดแชตใหม่เฉพาะเมื่อ context ต่ำ

## [2026-08-27] schema | Added misplaced-file decision gate
- เมื่อพบไฟล์ผิดหมวด ให้แจ้ง path ปัจจุบัน เหตุผล path แนะนำ ทางเลือก และผลกระทบก่อนเปลี่ยนไฟล์
- ห้ามย้าย คัดลอก ลบ เปลี่ยนชื่อ หรือแก้ reference โดยอัตโนมัติ หากผู้ใช้ยังไม่เลือกปลายทาง
- ให้ผู้ใช้เลือกเก็บที่เดิม ใช้ path แนะนำ หรือระบุ path ใหม่เอง
- หลังอนุมัติต้องตรวจชื่อชน ย้ายเฉพาะไฟล์ที่อนุมัติ อัปเดต reference/index/log/Hot Cache/manifest/checksum และตรวจ path ปลายทาง
- กฎ immutable มีลำดับสูงกว่า: source material และ backup snapshot ต้องคงต้นฉบับไว้และเสนอ copy แทน

## [2026-08-27] schema | Added conversation reset handoff protocol
- เพิ่ม `00-home/handoff.md` เป็น handoff กลางสำหรับ reset บทสนทนา โดยมีสถานะ active/inactive
- เมื่อ intent สับสน เข้าใจผิดซ้ำ หรือไม่สามารถสรุป objective เดียวได้ ให้หยุด implementation และไม่เดาต่อ
- ถ้า clarification สั้นหนึ่งครั้งยังแก้ไม่ได้ ให้บันทึก intent ที่ยืนยัน งานที่เสร็จ/ยังไม่ยืนยัน path, Git state, checks, assumption ที่ปฏิเสธ และ next step
- แชตเดิมต้องหยุดทำงานและแจ้งผู้ใช้เปิดแชตใหม่ ซึ่งอ่าน Hot Cache ก่อน แล้วอ่าน handoff และยืนยัน objective ก่อนแก้ไฟล์
- ห้าม commit งานที่เกิดจากความเข้าใจผิด งานไม่เสร็จ หรือยังไม่ตรวจสอบ; เมื่อแก้จบในแชตใหม่ให้ mark handoff inactive

## [2026-08-27] schema | Added Obsidian Web Clipper inbox
- ผู้ใช้ยืนยันให้สร้าง `03-source-materials/web-clips/` เป็นปลายทางของ Obsidian Web Clipper
- เพิ่ม README กำกับว่า clip เป็น immutable source snapshot และห้ามเก็บ credential/session/patient/production secrets
- กำหนดไฟล์แนบไว้ที่ `03-source-materials/assets/` และให้สร้าง synthesis แยกใน `01-knowledge-base/sources/`
- อัปเดต README, CLAUDE, AGENTS และ Hot Cache ให้ชี้ path ใหม่

## [2026-08-27] note | Relocated root Web Clipper note to source materials
- ผู้ใช้ยืนยัน default Web Clipper path เป็น `03-source-materials/web-clips/`
- ตรวจแล้วไม่มีชื่อชนและย้าย `web-clips/Element Plus.md` ไป `03-source-materials/web-clips/Element Plus.md`
- ลบเฉพาะโฟลเดอร์ `web-clips/` ที่รากหลังจากว่างแล้ว
- ยังไม่เปลี่ยนชื่อไฟล์เป็น `element-plus.md` เพราะผู้ใช้อนุมัติเฉพาะ path; รอการตัดสินใจตาม naming convention

## [2026-08-27] note | Normalized first Web Clipper filename
- ผู้ใช้อนุมัติให้เปลี่ยนชื่อ `03-source-materials/web-clips/Element Plus.md`
  เป็น `03-source-materials/web-clips/element-plus.md`
- ตรวจแล้วไม่มีชื่อชนและไม่มี reference อื่นที่ต้องแก้
- เนื้อหา source ไม่ถูกแก้ไข เปลี่ยนเฉพาะชื่อไฟล์ระหว่างขั้นตอน intake

## [2026-08-27] ingest | Element Plus component overview Web Clip
- อ่าน `03-source-materials/web-clips/element-plus.md` ครบทั้งไฟล์และเก็บต้นฉบับแบบ immutable
- เพิ่ม [[element-plus-component-overview]] สรุป official overview: Vue 3 component library, 82 components ใน 7 หมวด
- เพิ่ม entity [[element-plus]] และเชื่อม `el-*` vocabulary กับ initCraft โดยไม่สรุปเกินหลักฐานว่า support ทุก component
- อัปเดต [[field-components]] เพื่อแยก official Element Plus catalog ออกจาก ~83 SDForm widgets ของ initCraft
- อัปเดต index เป็น 26 sources · 9 entities · 30 concepts · 4 syntheses และ refresh Hot Cache

## [2026-08-27] ingest | draw.io MCP and custom LLM Web Clips
- อ่าน Web Clips ใหม่ 2 ไฟล์ครบทั้งไฟล์จาก `03-source-materials/web-clips/` โดยไม่แก้ source แบบ immutable
- เพิ่ม [[draw-io-mcp-server]] และ [[draw-io-custom-llm-backends]] แยก integration overview ออกจาก editor configuration
- เพิ่ม entity [[draw-io]] และ concepts [[model-context-protocol]], [[ai-diagram-generation]] พร้อมแยก documented capability ออกจาก installed/runtime status
- บันทึก data boundary ของ diagram attachment และกฎไม่เก็บ API key จริงใน vault; ภาพใน clip ยังคงเป็น URL ภายนอก
- อัปเดต index เป็น 28 sources · 10 entities · 32 concepts · 4 syntheses

## [2026-08-27] note | Diagrammed Agent final-result data relation
- ตรวจ `Form-Builder/SDForm/api-factory/examples/agent_result_final.json` แบบ schema-only โดยไม่แสดงข้อมูลผู้ป่วยหรือค่าผลตรวจ
- สร้าง FigJam `Agent Result Final Data Relation`: https://www.figma.com/board/UeaU1CfdwB4q80bIRxws3t
- แสดง payload → match/deduplicate/normalize → Technical Receipt, Result Report และ Result Items แบบ 1:N
- ยืนยันว่า JSON ตัวอย่างมี `items[]` 2 รายการ และ `result_version`/`receipt_seq` เก็บเป็น string; receipt count ไม่ใช่ result version

## [2026-08-27] note | Corrected Agent result diagram to draw.io
- ผู้ใช้ยืนยันว่า deliverable ต้องเป็น draw.io; FigJam เดิมถูก mark ว่า superseded และยังไม่ลบ
- เพิ่ม `02-his/draw_design/agent_result_final_relation.drawio` และ PNG preview โดยไม่แก้ source JSON
- ตรวจ XML ด้วย `xmllint` และ render ผ่าน draw.io Desktop 31.3.2 เป็น PNG 1948×1167
- Diagram ไม่แสดง identifier/ค่าผลของผู้ป่วย และแยก result_uid, report_seq/stage, result_version, receipt_seq ตามบทบาท
- เพิ่ม SHA-256 ของไฟล์ใหม่ทั้งสองใน `02-initcraft/checksums.sha256`

## [2026-08-27] skill | Installed audited OpenDesign core design skills
- ตรวจ upstream `nexu-io/open-design` และยึดหลักฐานที่ commit `9881cff70e02be86c2a58130af512011ba23d4af`
- ติดตั้ง `design-brief`, `reference-design-contract`, `frontend-design` และ `web-design-guidelines` ที่ `~/.codex/skills/`
- ตรวจ frontmatter, side files และ recursive diff กับ source ที่ audit แล้ว ผลผ่านทั้งหมด
- ไม่ติดตั้ง catalogue stub, `brand-extract` ที่พึ่ง `od`/`agent-browser` runtime หรือ `taste-skill` ที่ไม่รองรับ dashboard/form โดยตรง
- สกิลจะถูก discover ใน task/turn ถัดไป และต้องใช้ร่วมกับกฎ initCraft/Element Plus/SDForm ที่มีอยู่

## [2026-08-27] note | Prepared verified vault migration commit
- ผู้ใช้อนุญาตให้ commit Git สำหรับ repository migration ที่ค้างอยู่ทั้งชุด
- ตรวจ `02-initcraft/checksums.sha256` ครบ 293 รายการและผ่านทั้งหมด
- ยืนยันว่า root `.env` ถูก ignore และการสแกนไม่พบ credential จริงใน candidate paths
- กำหนด stage เฉพาะ migration paths แบบระบุชื่อ; ไม่รวม `.obsidian/graph.json` และ `.obsidian/workspace.json` ซึ่งเป็น UI state

## [2026-08-27] schema | Added SDForm best-practice promotion policy
- เพิ่ม `Form-Builder/SDForm/best-practices/` สำหรับ Form ที่พิสูจน์แล้วว่าทำตามเป้าหมายเฉพาะและนำกลับมาใช้ซ้ำได้
- แยก best practice ออกจาก `backup/`: เก็บ working source ไว้ที่เดิมและ promote เป็นสำเนาที่ sanitize แล้วพร้อม evidence sidecar
- กำหนดว่า static validation อย่างเดียวไม่พอ; เป้าหมายด้าน UI ต้องมี Builder/Preview evidence และเป้าหมายด้าน data/workflow ต้องมี runtime evidence
- ต้นแบบที่ promote แล้วเป็น immutable; การ reuse ต้อง copy ไป `form-factory/forms/` และ improvement ต้องสร้าง version ใหม่
- อัปเดต CLAUDE, AGENTS, README, SDForm README, migration manifest และ Hot Cache ตามกฎใหม่

## [2026-08-27] note | Revalidated HL7 result API and three result forms
- ซ่อม path ของ API/form/Viewer regression tests และ SDForm validator หลังย้าย artifact library
- `hl7_result_upsert_api.js` บังคับ string length ตาม Agent result schema v2 และไม่ตอบ success ให้ duplicate receipt ที่ยัง error/unmatched
- API regression ผ่าน partial, final, corrected, duplicate, unmatched, stale/version conflict และ critical-decision cases
- Receipt, Report, Result Item และ Viewer ผ่าน SDForm static validator; prior live evidence ยังพิสูจน์เฉพาะ partial + processed duplicate
- เพิ่ม `02-his/handoff/lab-result-api-readiness.md`; สถานะเป็น UAT-ready candidate ยังไม่ production-ready และยังไม่ promote เป็น Best Practice

## [2026-08-30] design | Frozen LAB mockup as SDForm implementation contract
- ผู้ใช้กำหนดให้สร้าง `design/` และ `Form-Builder/SDForm/Lab/` เป็น path ใหม่สำหรับสเปกและงาน Form ระบบ LAB
- เพิ่ม `design/Lab_design.md` รวม visual tokens, typography, spacing, exact component dimensions, one-page layout, interaction, status/search/date/result rules, integration boundaries, open decisions และ acceptance checklist
- เพิ่ม decision record และ concise implementation handoff ตาม reference-design-contract พร้อมแยก observed/provided/inferred evidence
- เพิ่ม `Form-Builder/SDForm/Lab/README.md`; รอบนี้ยังไม่สร้างหรือแก้ SDForm JSON
- อัปเดต README, AGENTS, CLAUDE และ Index ให้ path ใหม่เป็นส่วนหนึ่งของโครง repository ที่ผู้ใช้อนุมัติ

## [2026-08-30] design | Defined CPOE-to-LAB integration execution checklist
- ยืนยัน CPOE Order เป็นหัวใบ/การเงินหนึ่งใบ, LAB NO. ต่อ Item, หลาย section ต่อ Order และ routing ด้วย Item section
- ตรวจ MongoDB แบบ read-only พบ `sub_order` group แตกเป็น child transaction rows จริง แต่ transaction ไม่เก็บ set provenance; `lab_parent` เป็น exclusive parent/child คนละกติกา
- เพิ่ม `design/lab-cpoe-integration-checklist.md`: ไม่สร้าง Order mirror, เริ่มด้วย Item-first worklist API, join Order/master/section/Organization และใช้ snapshot-first/fallback-master
- แยก P0 read API, P1 additive CPOE fixes, P2 LAB JSON, P3 receive/reject/reorder, P4 reuse Result Receipt/Report/Item pipeline
- เพิ่ม checklist ใน implementation handoff และ Index; ไม่มีการเขียนฐานข้อมูลหรือแก้ SDForm JSON

## [2026-08-30] design | Confirmed LAB result overwrite and EMR diagnosis source
- ผู้ใช้ยืนยันว่าแก้ผลให้ทับ current Result Item และทับชื่อ/เวลาเป็นผู้แก้ล่าสุด ไม่เก็บรายชื่อผู้แก้ก่อนหน้าใน clinical result
- Technical Receipt ยังแยกไว้สำหรับรับ Agent payload/deduplicate; result API/tests เดิมที่คาดหวัง append corrected snapshots ต้องปรับในรอบ result integration
- ยืนยัน Diagnosis มาจาก EMR treatment ของ VN และปุ่ม EMR ผูกกับแต่ละ Order
- เพิ่ม UAT orders ใน checklist: C1 parent, C25-CD group และ Order ข้าม section C2 + MS1

## [2026-08-30] implementation | Started LAB CPOE worklist Step 1
- เพิ่ม read-only API Factory body `lab_cpoe_worklist_api.js`: Item-first, section/Organization fail-closed routing, snapshot-first/master fallback, Order grouping, exact HN/date/priority/pagination
- เพิ่ม local AsyncFunction test ครอบคลุม BC unit access, denied cross-section request, manager multi-section, status defaults, priority filtering, invalid date, missing unit และ unauthenticated caller; test ผ่าน
- ตรวจ MongoDB pipeline แบบ read-only: BC sent Orders join ได้และคืน specimen completeness; C25-CD draft children ทั้ง 4 derive `set_code=C25-CD` ได้
- ไม่ deploy API, ไม่เขียนฐานข้อมูล และยังไม่สร้าง LAB SDForm JSON

## [2026-08-30] implementation | Wired LAB CPOE worklist SDForm v1
- ผู้ใช้สร้าง API Factory Process `6a9434c3422c1ca959829d5e`; บันทึก ID ใน local API artifact/checklist โดยยังไม่อ้างว่า deployed runtime ผ่าน
- เพิ่ม `Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json` จาก grid/vue-ui templates ที่มีอยู่ ไม่แก้ backup/best-practice
- Candidate เรียก process ผ่าน authenticated `runProcess`, มี 4 status filters, exact HN/date/priority, pagination, expandable Orders, Item selection และแสดง specimen completeness
- ปุ่ม Receive/Reject/Cancel/EMR ถูก guard ไว้จนมี write API/form mapping; JSON, event syntax, process-binding harness, SDForm validator และ API regression ผ่าน
- ยังต้อง import เข้า Builder โดยไม่เลือก widget, ตรวจ Preview และทดสอบ response จริงด้วยบัญชี LAB

## [2026-08-30] implementation | Realigned LAB SDForm v1 to canonical HTML
- ปรับ `lab-cpoe-worklist-waiting-v1.json` ให้ใช้ header, toolbar, status chips, 12-column patient row, expanded Item table และ responsive layout ตาม `lab-workbench-stock-pattern-mockup.html`
- ถอด Organization badge, Priority/Clear toolbar, worklist column-header row, section list, panel provenance และข้อความ `read-only v1` ออกจาก UI
- ข้อความเหนือรายการเหลือเฉพาะ `แสดง X Order จากทั้งหมด Y`; ปุ่มรับ specimen/ปฏิเสธ/ยกเลิกยังคงอยู่ตามแบบและยัง guard ระหว่างรอ write API
- JSON/event parse, static UI contract, process-binding harness, SDForm validator และ API regression ผ่าน; Builder/Preview/deployed runtime ยังต้องตรวจจริง

## [2026-08-30] implementation | Applied Drug & Stock Stock structure to LAB worklist
- ใช้ `Form-Builder/SDForm/sdform_module/Drug&Stock/Drug&Stock` tab Stock และ screenshot ผู้ใช้เป็นโครงอ้างอิง: compact Element Plus toolbar, dropdown, status chips, aligned header และ expandable row; รายละเอียด clinical/LAB ยังใช้ดีไซน์ LAB เดิม
- เพิ่ม Section dropdown จาก `sections` ที่ API คืนเฉพาะ authenticated Organization context; การเลือก dropdown ส่ง `section_codes` กลับ API ซึ่งยังปฏิเสธ section นอกสิทธิ์แบบ fail-closed
- เพิ่ม live Organization-unit watcher แบบเดียวกับ App Viewer pattern: เปลี่ยน unit แล้วล้าง section/expansion และโหลดรายการ/counts ใหม่ พร้อม request sequence ป้องกัน response เก่าทับผลใหม่
- ชื่อแพทย์ตัด email suffix ออกจากข้อความแสดงผล; responsive ยุบ header ที่ tablet และแปลง Order/Item details เป็น card layout บน mobile
- API regression, JSON/event parse, doctor/section behavior harness และ SDForm validator ผ่าน; deployed Process body และ Builder/Preview ยังต้องอัปเดต/ตรวจจริง

## [2026-08-30] implementation | Finalized Organization-routed LAB worklist UI and CPOE/EMR entry points
- ถอด header/subtitle และ Section dropdown ออกจาก LAB Form; หน้าเริ่มที่ search toolbar และ reload ตาม App Organization โดยอัตโนมัติ
- เปลี่ยน expanded Item จาก boxed table เป็น borderless grid แบบ Drug & Stock, คืน specimen dropdown และแสดงอายุ snapshot ตรงตัว เช่น `3y 3m 3d`
- API คืน age จาก `order.vid.pid.age`, specimen options จาก master และ regression บังคับให้ section filter เกิดก่อน Order grouping เพื่อรองรับ Order เดียวข้าม Bio/Hemato
- ปุ่ม Create เปิด CPOE Order App `6a927860422c1ca959829d26`; เพิ่ม manual VN search + patient card ใน `CPOE_app.json`
- ปุ่ม EMR เปิด `6a4f64e7f8cdfc54cec16488` read-only; `EMR.json` รองรับ deep-link ไป Visit Tran `6a461235e521219e514d1c4b`
- ยืนยันว่า CPOE/EMR ทั้งสองจุด reuse Form หลัก ID เดิม ไม่สร้าง Form ใหม่; JSON เป็น working definition สำหรับอัปเดต behavior ของ Form เดิมเท่านั้น
- API/Form tests, lifecycle compile, JSON parse, `git diff --check` และ SDForm validator ผ่าน; Builder/Preview/deployed runtime ยังรอทดสอบ

## [2026-08-31] implementation | Built the first X-ray CPOE worklist SDForm
- เพิ่ม `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json` โดยก๊อปโครง container/`options` ทั้งชุดจาก `Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json` ตาม `SDFORM_JSON_RULES.md` — ไม่แตะไฟล์ LAB, `backup/` และ `best-practices/`
- เพิ่ม generator `Form-Builder/seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js` (regenerate ได้ ไม่ต้องแก้ JSON ด้วยมือ) และ behaviour test `Form-Builder/API/tests-tools/tests/test_xray_cpoe_worklist_form.js`
- ตัวกรองครบสี่ชั้นซ้อนกัน: ค้นหา (q + hn เมื่อดูเป็นรหัส) · Date Range · dropdown เครื่อง · status chips 4 ตัว — เครื่องกรองทันทีโดยไม่ต้องกด Search, reset ไปหน้า 1 และคงค่าเมื่อเปลี่ยน chip/หน้า; ตัวเลขบน chip นับภายใต้ตัวกรองเครื่องปัจจุบัน
- รายชื่อเครื่องมาจาก `data.modalities[]` ของ API เท่านั้น ถ้าไม่มีจึงรวบรวมจากรายการที่โหลดมา และ disable dropdown พร้อมเหตุผลเมื่อไม่มีข้อมูล — ไม่มีรายการ 19 ค่า hard-code ในฟอร์ม (decision X2 ยังค้าง)
- เทมเพลตอ่านจาก `s.view` ที่ `recompute()` เตรียมไว้ทั้งหมด: 1 order = 1 test, Accession No. อยู่ระดับ test, ไม่มี specimen/Lab No./checkbox, ปุ่มท้ายแถวคอลัมน์เดียวไม่มีช่อง `–`, ใบที่ยกเลิกเหลือ `EMR`
- test จับบั๊กจริงหนึ่งข้อ: `resulted` เคยถูกนับเป็น chip `รอรับ/รอผลอ่าน` ทั้งที่แถวแสดง `ออกผลครบ` — แก้ `statusMap` ให้ `complete` = `['resulted','completed']` ตาม Appendix A.3
- write path (`ส่งเข้าเครื่อง`/`ยกเลิก order`/`ตรวจใหม่`) ยัง guard ไว้จนกว่าจะมี `xray-cpoe-dispatch`; ปุ่ม `ดูภาพ` แจ้งรอเชื่อม RIS (X17)
- `WORKLIST_PROCESS_ID` ยังว่าง เพราะ Process `xray-cpoe-worklist` ยังไม่ถูกสร้าง — ฟอร์มเตือนบนหน้าจอแทนการหมุนค้าง
- ผ่าน: SDForm validator (exit 0, 2 widget) · behaviour test · JS syntax ของ `onCreated`/`onMounted` · `git diff --check` · สแกนไม่พบ credential/URI/ข้อมูลผู้ป่วย
- ยังไม่ได้ตรวจ: **Builder/Preview จริง** และ runtime จริง

## [2026-08-31] implementation | Enabled LAB receive-only flow and Item result table
- เปลี่ยน `lab_cpoe_receive_api.js` Process `6a94f634422c1ca959829d70` เป็น HIS-only ชั่วคราว: สร้าง LAB NO. ผ่าน `6a94f1ed422c1ca959829d6e`, บันทึก Item `accepted` พร้อมเวลารับ/ผู้รับ และไม่เรียก Agent ระหว่างรอ VPN
- ปลด write-block ปุ่ม `รับ specimen` ใน LAB Worklist; เลือกครั้งละ 1 Item, ยืนยันก่อนรับ, update Lab No./เวลารับใน UI แล้ว reload worklist/counts
- เปิดแท็บออกผลได้ตั้งแต่ Item ยังรอรับ และปรับตารางเป็น `ลำดับ / รายการสั่งตรวจ / เวลาออกผล / ผลตรวจ / สถานะ`; critical tag ใช้เฉพาะ explicit decision ไม่อนุมานจาก H/L หรือ reference range
- Worklist API อนุญาต read-only result lookup ก่อนรับและทุก LAB section แต่คง Manual save เฉพาะ Mycology; project Item fields เพิ่ม `resulted_at`, `is_critical`, `result_summary`
- ผ่าน Agent baseline, Lab No., Receive-only, Worklist API, Form behavior, SDForm validator (exit 0, 2 widget) และ `git diff --check`; Builder/Preview/deployed runtime UAT ยังรอ

## [2026-08-31] implementation | Wrote the X-ray CPOE worklist API (read-only)
- เพิ่ม `Form-Builder/API/api-factory/processes/xray_cpoe_worklist_api.js` โดยลอกโครง query/permission จาก `lab_cpoe_worklist_api.js` — อ่าน `zdata_cpoe_order_item` ที่ `service_type='xray'` join master → `zdata_section` → `zdata_cpoe_order` แล้ว group กลับเป็นหนึ่ง Order
- read-only ล้วน: มีแค่ `action:'list'` และ `action:'get_report'` ไม่มี `dbUpdate`/`dbInsert` — การรับ/ส่งเข้าเครื่อง/ออก accession รอ `xray-cpoe-dispatch` (X3, X4, X14)
- ขอบเขตหน่วยงาน fail-closed: resolve Section รังสีจาก `st_id.code='xray'` หรือมี `modality_type` แล้วจับคู่กับ Organization ผ่าน `section.unit` · ถ้าจับคู่ไม่ได้คืนรายการว่างพร้อมเหตุผล ไม่เดา mapping (`XRAY_ORGANIZATION_SECTION_CODES` ปล่อยว่างไว้จนกว่า X2/X8 จะเคาะ)
- ตัวกรองเครื่องเป็นตัวกรองการแสดงผลเท่านั้น อยู่ใน facet `rows`/`meta`/`buckets` · facet `modality_counts` ไม่ถูกกรอง dropdown จึงยังเห็นทุกเครื่องหลังเลือกไปแล้ว · ตัวกรองสถานะอยู่เฉพาะ `rows`/`meta` chip จึงนับได้ครบสี่ช่องในคำขอเดียว (ฟอร์มไม่ต้องยิงนับซ้ำอีก 4 ครั้ง)
- แกน Date Range เป็น **เวลาของสถานะ** ตาม `Xray_design.md` §7 (รอรับ→เวลาสั่ง · ส่งเครื่องแล้ว→เวลาส่งเครื่อง · ออกผล→เวลาออกผล · ยกเลิก→เวลายกเลิก) ไม่ใช่ `order.created_at` แบบ LAB
- ค่าเริ่มต้นของช่วงวันที่คือวันปัจจุบัน ยกเว้นค้น HN แบบตรงตัวซึ่งดึงประวัติข้ามวันได้ (Appendix B) · API คืน `data.date_scope` และฟอร์มแสดงในบรรทัดสรุปเพื่อไม่ให้ผู้ใช้เดาเอง
- free text `q` ถูก escape regex ก่อนเสมอ · `hn` ยังเป็น exact match
- `get_report` อ่าน Result Item ตาม `source_item_id` และ map เฉพาะฟิลด์ที่มีจริง ถ้าไม่มีคืน `has_report:false` พร้อมบอกว่าโครงสร้างผลอ่านยังไม่ถูกผูก (X6) — ไม่เดา schema
- ผ่าน: regression test ใหม่ `test_xray_cpoe_worklist_api.js` · form test · LAB regression 4 ชุด · SDForm validator · `git diff --check` · สแกนไม่พบ credential/URI/ข้อมูลผู้ป่วย
- ยังไม่ได้ทำ: สร้าง Process ใน API Factory, ใส่ ID ที่ `WORKLIST_PROCESS_ID`, ตรวจ Builder/Preview และ runtime จริง

## [2026-08-31] implementation | Wired the X-ray Form to Process 6a957009422c1ca959829e45
- ผู้ใช้แจ้ง Process ID ของ `xray-cpoe-worklist`; ใส่ค่าใน `WORKLIST_PROCESS_ID` ที่ generator แล้ว regenerate `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json` — ไม่แก้ JSON ด้วยมือ
- อัปเดตหัวไฟล์ `xray_cpoe_worklist_api.js` ให้บันทึก Process ID ตามที่ผู้ใช้แจ้ง โดยระบุว่ายังไม่ยืนยัน deployed runtime
- แก้ form test: ยืนยันว่า `onCreated` ถือ ID จริง, ทุก call ยิงไปที่ ID นั้น, `view.configWarning` ว่าง และถ้า ID ถูกล้างออกฟอร์มยังเตือนเหมือนเดิม
- ผ่าน: X-ray API/Form tests · LAB regression 4 ชุด · SDForm validator exit 0 · `git diff --check`
- ขั้นถัดไปเป็นของผู้ใช้: import ฟอร์มเข้า Builder แล้วดูทันทีโดยไม่คลิกอะไร, hard refresh App, ตรวจว่ารายการ/chip/dropdown เครื่องคืนค่าจากข้อมูลจริง

## [2026-08-31] implementation | Reworked X-ray scope to Organization and modality to master.xray_item
- ผู้ใช้ import ฟอร์มเข้า App จริงแล้ว: หน้าจอ render ครบ แต่รายการว่างและ dropdown เครื่องถูก disable — สาเหตุคือสมมติฐานเดิมสองข้อผิด
- **ผิดข้อ 1 (ขอบเขต)**: ผูกกับ Section รังสีใน `zdata_section` ซึ่งไม่มีแถวรังสีให้ resolve · ผู้ใช้เลือกให้ผูกกับ **Organization ของหน่วยรังสี** แทน · เพิ่ม `XRAY_ORGANIZATION_CODES` ที่หัวไฟล์ ปล่อยว่างไว้ fail-closed และข้อความบอกรหัส Organization ปัจจุบันให้ผู้ดูแลนำมาเติมได้ทันที
- **ผิดข้อ 2 (เครื่อง)**: master ของเครื่องไม่ใช่ `section.modality_type` แต่เป็นช่อง Modality ของ master **Radio Exam** (`6a8fde8a4c725771c62b1bc1`) · ผู้ใช้เลือกให้อ่านจาก `master.xray_item.modality` เป็นทางหลัก (ref field `xray_item` ยืนยันแล้วใน `CPOE Order Item.json`) พร้อมทางสำรอง `xray_item.modality_type` → `section.modality_type`
- `modalities[]` คืน enum 11 ค่าของ master ทุกครั้งพร้อมจำนวนจริง (DX MG US CT RF CR VCUG MR IO UN OT) · code ที่พบในข้อมูลแต่ไม่มีใน enum ถูกต่อท้ายให้เลือกได้ ไม่หายเงียบ · ค่าที่ไม่ใช่ string ถูกกันด้วย `$type` ไม่ทำ pipeline พัง
- รายการที่ยังไม่ผูกเครื่องถูกนับเป็น `modality_unmapped` และแจ้งเตือนบนหน้าจอ ตาม `Xray_design.md` §5.4 ที่ถือว่าเป็นข้อผิดพลาดของข้อมูล
- แก้ฟอร์มให้แสดงข้อความที่ API ส่งกลับมาเมื่อ `success:true` แต่รายการว่าง — เดิมถูกกลืนทิ้ง ผู้ใช้เห็นแค่ "ไม่พบรายการ" โดยไม่รู้เหตุผล
- ผ่าน: X-ray API/Form tests (เขียนใหม่ทั้งชุด) · LAB regression 4 ชุด · SDForm validator exit 0 · `git diff --check`
- ค้าง: ผู้ใช้ต้องแจ้งรหัส Organization ของหน่วยรังสี เพื่อใส่ใน `XRAY_ORGANIZATION_CODES` แล้ว deploy Process ซ้ำ

## [2026-08-31] implementation | X-ray Process reads zdata_organization to self-diagnose scope
- ผู้ใช้ยืนยัน Organization master = `zdata_organization` (Form ID `6a3790c04cfbfdbe257f86fb`) ซึ่งตรงกับ `formId` ที่ช่อง `unit` ของ Section master อ้างถึง — ฟิลด์ `unit_code`, `unit_name`, `unit_parent.unit_code`, `unit_parent.unit_name`
- ตอนที่ Organization ยังไม่ผ่านขอบเขต Process จะอ่าน `zdata_organization` แล้วบอกในข้อความว่า Organization ปัจจุบันคือรหัส/ชื่ออะไร และหน่วยงานไหน "น่าจะ" เป็นรังสี (จับคำ รังสี/เอกซเรย์/x-ray/radio ที่ชื่อหรือชื่อหน่วยแม่) พร้อมคืน `organization_current` และ `organization_candidates`
- คำใบ้จากชื่อเป็นแค่ข้อความแนะนำ **ไม่ใช่เกณฑ์ให้สิทธิ์** — สิทธิ์ยังมาจาก `XRAY_ORGANIZATION_CODES` อย่างเดียว และยังไม่แตะข้อมูลผู้ป่วยจนกว่าจะผ่านขอบเขต (เทสต์บังคับข้อนี้)
- อ่าน Organization master ไม่สำเร็จก็ยังตอบได้ตามปกติ ไม่ล้ม
- ผ่าน: X-ray API/Form tests · LAB regression 4 ชุด · SDForm validator exit 0 · `git diff --check`

## [2026-08-31] implementation | Wired X-ray scope to Organization m0901
- diagnostic ที่เพิ่งใส่ทำงานจริง: หน้าจอรายงานว่า Organization ปัจจุบันคือ `19.P` (คลินิกวัคซีน) และเสนอ `m0900` (กลุ่มงานรังสีวิทยา) กับ `m0901` (งานรังสีวิทยา)
- ผู้ใช้เลือก **`m0901`** → ตั้ง `XRAY_ORGANIZATION_CODES = ['m0901']` ใน `xray_cpoe_worklist_api.js`
- **ไม่เปิดสิทธิ์ให้ `m0900`** ทั้งที่ชื่อสื่อถึงรังสีเหมือนกัน — ผู้ใช้ระบุมาแค่ตัวเดียว เพิ่มทีหลังได้ด้วยการแก้ array บรรทัดเดียว
- regression บังคับพฤติกรรมนี้: user ที่อยู่ `m0900` ต้องถูกปฏิเสธและ **ห้ามแตะ `zdata_cpoe_order_item`** พิสูจน์ว่าคำใบ้จากชื่อไม่ใช่เกณฑ์ให้สิทธิ์
- เทียบรหัสแบบไม่สนตัวพิมพ์ (master เขียน `m0901` ตัวเล็ก) — มีเทสต์คุม
- fixture ของเทสต์เปลี่ยนมาใช้รหัสจริงจากหน้าจอ (`19.P`, `m0900`, `m0901`)
- ผ่าน: X-ray API/Form tests · LAB regression 4 ชุด · SDForm validator exit 0 · `git diff --check`
- เหลือ: วาง Process ใหม่ + import ฟอร์ม แล้วสลับ Organization เป็น `m0901` เพื่อดูรายการจริง

## [2026-08-31] implementation | Wrote the X-ray Accession No. generator
- เพิ่ม `Form-Builder/API/api-factory/processes/xray_accession_generate_api.js` โดยลอก pattern จาก `lab_no_generate_api.js` ทั้งชุด: `mongoTxn` เดียว · counter collection แยก (`zdata_xray_accession_counter`) · `findOneAndUpdate` แบบ pipeline · collision check · conditional `updateOne` ที่บังคับว่าเลขต้องยังว่าง
- รูปแบบ `YYYYMMDD + MODALITY_CODE + NNN` เช่น `20260831CT001` — ปีเป็น **ค.ศ.** (ต่างจาก LAB NO. ที่ใช้ พ.ศ.) · running แยกตาม modality และแยกตามวัน
- **decision X15/X16 ยึดตาม mockup ที่ผู้ใช้ตรวจแล้ว 4 รอบ**: ความยาวไม่คงที่ 13–15 ตัว และ code เป็นตัวพิมพ์ใหญ่ · ทั้งสองข้อทำเป็นค่าคงที่ `ACCESSION_UPPERCASE` / `PAD_MODALITY_TO` แก้บรรทัดเดียวได้ถ้าจะเปลี่ยน
- **X12**: ครบ 999 ในเครื่อง/วันเดียวกันแล้ววนกลับ 001 และถ้าเลขที่วนกลับยังถูกใช้อยู่จะหยุดพร้อมบอกเหตุผล ไม่ออกเลขซ้ำ
- modality อ่านจาก `master.xray_item.modality` เป็นทางหลัก ทางสำรองเดียวกับ worklist เพื่อให้สองที่ได้ค่าเดียวกันเสมอ · ไม่มีเครื่อง = หยุดและบอกให้ไปแก้ item master (design §5.4)
- ขอบเขต `XRAY_ORGANIZATION_CODES = ['m0901']` ตรงกับ worklist · เทสต์บังคับว่าทุกกรณีที่ปฏิเสธ **ต้องไม่กิน running number**
- Process นี้ออกเลขอย่างเดียว ไม่บันทึกการรับและไม่เรียก Agent — ลำดับเต็มยังเป็นของ `xray-cpoe-dispatch` (X3)
- ผ่าน: test ใหม่ · X-ray worklist API/Form · LAB regression 5 ชุด (รวม lab_no) · SDForm validator · `git diff --check` · ไม่พบ credential

## [2026-08-31] implementation | Studied the RIS Order contract and built its parameter fixture
- ผู้ใช้อัปโหลด `Form-Builder/SDForm/X-ray/xray_order.json` — เป็น **สัญญา RIS Order** (POST application/json) ไม่ใช่ฟอร์มใบสั่งภายใน · 71 ฟิลด์แบบ PascalCase สไตล์ HL7 (`MessageControlId`, `AccessionNo`, `ExamUid`, `RadiologistUid`, `OrganizationUid`)
- สกัดสัญญาได้: บังคับ 11 ฟิลด์ (`Hn PatientFName PatientGender PatientDob PatientSsn PatientClassUid VisitNo AdmissionNo AccessionNo ExamUid ExamName`) · default `Priority=R` `Status=A` `IsDeleted=false` · enum `Gender M/F/U` `Class O/I/E` `Priority R/S/U` `Status N/A` · วันที่ `YYYY-MM-DD` · **`AccessionNo` ยาวไม่เกิน 16 อักษร**
- เลขจาก `xray_accession_generate_api` ยาว 13–15 อักษร จึงอยู่ในลิมิต — เทสต์ยืนยันข้อนี้ไว้แล้ว
- เพิ่ม `Form-Builder/SDForm/tests-tools/fixtures/xray_order_ris_params.json` — 20 เคส (9 accept / 11 reject) ครอบคลุม enum ทุกค่า, OPD/IPD/ER, ขอบเขต 16 อักษร, และเคสยกเลิกด้วย `IsDeleted`
- เพิ่ม `Form-Builder/API/tests-tools/tests/test_xray_order_ris_params.js` ที่ **อ่านสัญญาสดจากฟอร์มทุกครั้ง** — ถ้าฟอร์มเปลี่ยน required/format/ชนิดฟิลด์ เทสต์จะพังก่อนที่ payload ผิดสัญญาจะถูกยิงเข้า RIS · บังคับข้อมูลผู้ป่วยในไฟล์ทดสอบเป็นค่าสมมติล้วน
- พบข้อขัดแย้งที่ต้องเคาะ: **`AdmissionNo` ถูกทำเป็นฟิลด์บังคับ แต่ผู้ป่วยนอกไม่มีเลข AN** และ `PatientSsn` บังคับแต่ผู้ป่วยต่างชาติอาจไม่มี — บันทึกไว้ใน `needs_confirmation` ของ fixture พร้อมอีก 4 ข้อ (พฤติกรรมกับ field แปลกปลอม, IsDeleted เป็นช่องทางยกเลิกจริงไหม, MessageControlId ต้อง unique ไหม, endpoint/auth ของ RIS)
- เพิ่ม `source_mapping_proposal` ในไฟล์ fixture: แผนที่จาก payload ของ worklist API ไปยังฟิลด์ RIS **ระบุชัดว่าเป็นข้อเสนอ ยังไม่ยืนยัน** เพื่อใช้เป็นจุดตั้งต้นของ `xray-cpoe-dispatch` (X3)
- ผ่าน: เทสต์ใหม่ · X-ray อีก 3 ชุด · LAB regression 5 ชุด · `git diff --check`

## [2026-08-31] implementation | Recorded the RIS ACK contract and added a case runner
- ผู้ใช้ยิง RIS Order endpoint ด้วย body ว่าง แล้วส่ง response กลับมา — ได้สัญญาฝั่งตอบกลับเพิ่ม: envelope `{message, data, error}` หุ้ม ACK ที่มี `AcknowledgementCode` (เห็นจริงแล้วคือ `AE` = Application Error), `TextMessage`, `MessageControlId`, `AccessionNo`, `Status`, `Operation`, และตัวช่วยวินิจฉัย `ReceivedRootKeys` / `ReceivedInputKeys`
- **ยืนยันสำคัญ**: รายชื่อฟิลด์บังคับที่ RIS ตอบกลับ **ตรงกับ required 11 ตัวที่ derive จาก `xray_order.json` ทุกตัว** — ฟอร์มกับ validator ฝั่ง RIS ตรงกัน เทสต์ล็อกข้อนี้ไว้แล้ว
- `ReceivedRootKeys`/`ReceivedInputKeys` ว่างทั้งคู่แปลว่า payload ไปไม่ถึง process ไม่ใช่ค่าผิด และบอกใบ้ว่า process อ่านทั้ง `params` ระดับ root และ `params.input`
- เพิ่ม `Form-Builder/API/tests-tools/scripts/post_xray_order_case.js` — พิมพ์/ยิงเคสจาก fixture ได้ทีละเคส · endpoint กับ token อ่านจาก env `XRAY_RIS_URL` / `XRAY_RIS_TOKEN` เท่านั้น · ไม่ใส่ `--send` = ไม่ติดต่อระบบภายนอกเลย
- **ไม่เก็บ token หรือ URL ของ environment ลงรีโป** — เทสต์มี assertion ห้าม JWT และห้าม URL ของ host จริงโผล่ในไฟล์ fixture
- ผ่าน: X-ray 4 ชุด · LAB regression 5 ชุด · `git diff --check`

## [2026-08-31] note | X-ray worklist — modality column shows full machine name
- Answered what the **เวลาสถานะ** column means: the latest status event per order
  (cancelled_at / max resulted_at / min dispatched_at / "–" while waiting), which is also
  the axis the Date Range filter uses (`date_scope.axis = 'status_time'`).
- `.xr-modality-tag` now wraps instead of clipping (`white-space:normal`, ellipsis removed);
  the เครื่อง column widened 92→118px (patient row), 96→118px (test table), 110→118px
  (result list); container `min-width` 1310→1336 / 1180→1202 / 940→948.
- Regenerated `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json` from its generator.
- `test_xray_cpoe_worklist_form.js` updated to the new geometry and now asserts the modality
  name is never truncated. 4 X-ray suites + LAB regression (5) pass; validator exit 0.

## [2026-09-01] implementation | Added LAB Outbound Order persistence form
- ผู้ใช้สร้าง Lab Work Item ใหม่เป็น Form ID `6a95c750422c1ca959829e8a`; อัปเดต active Work Item bridge ให้ชี้ ID นี้ โดยคง historical source note ของ ID เดิมไว้ตามเวลาเดิม
- เพิ่ม `Form-Builder/SDForm/Lab/lab-outbound-order-v1.json` เป็น technical record หนึ่งแถวต่อ `order_no`: เชื่อม Work Item/CPOE แบบ read-only, เก็บ normalized payload/response, `hl7_status`, `dispatch_id`, retry/error/timestamps และ attempt summary โดยไม่มี credential
- เพิ่ม generator และ regression test; SDForm validator ผ่าน 60 widget, form test ผ่าน และ `git diff --check` ผ่าน
- ยังไม่ต่อ Agent: LAB NO. generator/Receive ปัจจุบันยังเขียน CPOE Item ต้อง refactor ให้เขียน Work Item/Outbound Order ก่อน

## [2026-09-01] note | X-ray Accession No. — new SM-prefixed format and no-wrap policy
- User format: `SM` + `YYYY` + `MM` + `DD` + modality + 3-digit running, counter split per
  modality per day. Confirmed the policy before writing.
- Flagged and resolved three problems in the request:
  1. the user's own message said both "wrap to 001" and "stop with an error" — chose the
     hard stop; a duplicate Accession No. in PACS attaches a report to the wrong study and
     cannot be undone, while an error is recoverable. Warns from sequence 950.
  2. "Counter แยกตาม Section" would collide: Section is not printed in the number, so two
     sections both emit `SM20260901DX001`. Counter key is now exactly the printed fields —
     `xray_accession:SM:<YYYYMMDD>:<MOD2>`.
  3. `VCUG` made the number 17 chars, over the RIS `AccessionNo` limit of 16. Modality is
     now a fixed 2-char segment via `MODALITY_SEGMENT_ALIAS` (`VCUG→VC`); an unaliased
     longer code refuses rather than auto-truncating into a possible collision.
- Other confirmed decisions: unmapped modality refuses instead of falling back to `UN`;
  the date is the issue date, not the order date; year is Gregorian and a Buddhist-calendar
  server now fails loudly instead of emitting `SM2569...`.
- Rewrote `Form-Builder/API/api-factory/processes/xray_accession_generate_api.js` and
  `test_xray_accession_generate_api.js` (mock txn now rolls back, so the test proves a
  failed attempt does not burn a number). 4 X-ray + 5 LAB suites pass.
- Still not deployed — needs a Process ID from API Factory.

## [2026-09-01] note | X-ray accession generator deployed as Process 6a95cd58422c1ca959829e8d
- Recorded the ID in the process header, `Form-Builder/SDForm/X-ray/spec.md` (§3 table),
  and `design.md` (file table); marked decision D-X14 resolved.
- Rewrote `spec.md` §4.3 to the confirmed `SM + YYYYMMDD + MOD2 + NNN` format and the
  no-wrap / counter-key / no-UN-fallback rules.
- `test_xray_accession_generate_api.js` now asserts the header carries that exact ID, so
  dispatch (X3) can reference it without guessing. 4 X-ray suites pass.

## [2026-09-01] fix | Rebuilt blank LAB Outbound Order form structure
- Runtime evidence from Form ID `6a95cb80422c1ca959829e8c`: Tree view parsed the imported
  widgets but the initCraft v1.6.0 Builder canvas was blank. The first generated JSON had
  passed the static validator, so that result did not prove Builder compatibility.
- Root cause/risk removed: the generator cloned repeated component `key` values and nested
  `grid → card → grid → grid-col`. Rebuilt the form using the proven shallow pattern
  `grid → grid-col → one field`, with unique numeric keys/IDs and no cards.
- Preserved all 38 persistence fields and data types. Added regression assertions for one
  grid, 38 one-field columns, 77 unique rendered component keys, and zero cards.
- `lab-outbound-order-v1.json` now passes the SDForm validator (39 counted widgets), its
  dedicated regression passes, and generation is deterministic. Builder/Preview still
  requires user re-import verification because the Codex browser session is not signed in.

## [2026-09-01] note | X-ray Form wired to the accession Process
- `ACCESSION_PROCESS_ID='6a95cd58422c1ca959829e8d'` added to the widget's `onCreated`, with
  the request/response contract documented beside it.
- New `s.issueAccession(row,item)`: sends `{item_id}` only, shows the returned number, relays
  the API's refusal text and the 950 warning verbatim, guards double-clicks with `s.issuing`,
  then reloads the list.
- The button lives inside the Accession No. cell and appears only while that cell is blank —
  no new column, no geometry change.
- `ส่งเข้าเครื่อง` deliberately still calls `explainWriteBlock`: issuing a number is not
  dispatching. The full sequence stays with `xray-cpoe-dispatch` (D-X3).
- Form regenerated; validator exit 0. Test now locks the wired ID, the `item_id`-only payload,
  the warning path, the refusal path, and the missing-item_id guard. 4 X-ray + 5 LAB pass.

## [2026-09-01] implementation | LAB receive now persists Work Item and Outbound without changing CPOE

- User confirmed the corrected Outbound Form displays and supplied the canonical live mapping:
  Work Item `6a95c750422c1ca959829e8a` → `zdata_lab_work_item`; Outbound
  `6a95cb80422c1ca959829e8c` → `zdata_lab_outband_order`. The `outband` spelling is the
  real collection name. Read-only schema inspection found both collections empty before UAT.
- Reworked `lab_no_generate_api.js`: CPOE is read-only; the LAB NO. transaction now allocates
  `SSYYMMDDNNNN` and inserts one Work Item per source CPOE Item. The Work Item reuses the
  source Item ObjectId, so retries/concurrent inserts cannot create a second operational row.
- Reworked `lab_cpoe_receive_api.js`: one transaction changes Work Item to `received` and
  creates/refreshes one Outbound `new`; no Agent/network call occurs. Missing collection time
  parks transport as `awaiting_collection`; other mapping gaps use `awaiting_outbound_data`;
  receipt still succeeds and no collection timestamp is invented.
- Agent `order_no` is the Work Item ID, giving each item its own stable idempotency key while
  retaining source CPOE Order/Item IDs separately. A ready snapshot passes the existing Agent
  submit schema validator.
- Worklist aggregation now joins `zdata_lab_work_item` and derives effective Item status/LAB
  NO./receipt fields from it. Mycology manual-result status updates Work Item rather than CPOE.
- Passed focused LAB suites: LAB NO., Receive, Worklist API, Worklist Form, Outbound Form, and
  Agent submit; `git diff --check` passed. Full wildcard run still stops on the pre-existing
  missing `Lab_Result_Inbound_ListView_EMR_Person.json` fixture.
- Deployment remains manual: update bodies for Processes `6a94f1ed422c1ca959829d6e`,
  `6a94f634422c1ca959829d70`, and `6a9434c3422c1ca959829d5e`; run one DB-only UAT before
  wiring dispatch/reconcile to Agent.

## [2026-09-01] fix | Receive unwraps the real initCraft subprocess envelope

- Playground evidence showed LAB NO. subprocess responses wrapped as
  `{success:true,message:'API run success',data:{success:false,message:'...'}}`.
  The old adapter only unwrapped `data` when the outer object had no `success`, so Receive
  hid the actual LAB NO. result behind `lab_no_failed / API run success`.
- Updated `lab_cpoe_receive_api.js` to unwrap `data` when that nested object owns a
  `success` field. Direct `{success,data}` subprocess responses remain supported.
- Added regression coverage for wrapped success, wrapped failure with the original error
  message preserved, and direct success. Receive, LAB NO., and Worklist API tests pass;
  focused `git diff --check` passes.
- This is a permanent transport-adapter compatibility fix, not a UAT bypass. Organization
  enforcement remains unchanged; test the redeployed Receive body from MyStarterKit where
  the LAB Organization context exists, not from the Organization-less Playground.

## [2026-09-01] note | Studied the team's RIS Order API; accession test fixture added
- Read `Form-Builder/API/api-factory/xray_api_order.js` (team-written, Process
  `6a8f1ef87632d182ef6914fe`). Findings that change our plan:
  - it writes Form `6a8f1ea97632d182ef6914fd` → `zdata_xray_order`;
  - `xray_order_log.json` is **byte-identical** to `xray_order.json` — one form, not a log,
    and upserts overwrite, so there is no audit trail of RIS messages;
  - **AccessionNo is the sole business key** (found ⇒ update, not found ⇒ insert), so a
    dispatch retry cannot create a duplicate order;
  - the body must sit at `params` root — unwrappers are `params/body/data/payload/"New item"`,
    so the `params.input` shape we kept as an alternate is dead;
  - it accepts `Status: C` which the form does not declare, and requires SSN to be 13 digits;
  - it writes with `app.dbInsert`/`app.dbUpdate` because `sdformSetOne` fails on imported
    forms, and broadcasts with `app.wsSend` only after commit, inside try/catch.
- Folded all of it into `xray_order_ris_params.json` (`server_logic`, corrected `transport`,
  ACK codes from source, `resolved` list) and locked it against the team's source in
  `test_xray_order_ris_params.js`.
- Added `Form-Builder/SDForm/tests-tools/fixtures/xray_accession_params.json` (11 cases,
  placeholder ids only) and `test_xray_accession_params.js`, which checks every expected
  message exists in the Process and that the Process never writes `current_status`.
- **Repo move:** `SDForm/Lab/` and `SDForm/X-ray/` are now under `SDForm/sdform_module/`.
  Tests and the X-ray generator resolve either root via `sdformPath()`, so X-ray and the LAB
  worklist suites pass again. `test_lab_outbound_order_form.js` and
  `build_lab_outbound_order_form.py` still hardcode the old path and fail — LAB-owned, left
  untouched. CLAUDE.md §2 still documents the old layout and needs a ruling.

## [2026-09-01] note | Folder ruling and dispatch direction confirmed by the user
- `Form-Builder/SDForm/Lab/` and `Form-Builder/SDForm/X-ray/` moved **back** out of
  `sdform_module/` per CLAUDE.md §2. Nothing was tracked under the sdform_module paths, so the
  move restored `X-ray/design.md`, `X-ray/spec.md`, `Lab/README.md` and
  `Lab/lab-cpoe-worklist-waiting-v1.json` to their tracked paths.
- Removed the temporary `sdformPath()` resolvers from the three tests and the X-ray generator;
  every path is canonical again, so a wrong location now fails loudly instead of being accepted.
- `test_lab_outbound_order_form.js` passes again without being edited.
- **D-X3 direction confirmed:** the `ส่งเข้าเครื่อง` button runs the whole dispatch — issue the
  accession, commit the receive, then send the order to RIS **through the team's API**
  (`xray_api_order.js`), not a second writer of our own. Recorded in `spec.md` §4.2 with the
  source findings that matter (AccessionNo upsert ⇒ retry-safe, `params` root only,
  `app.dbInsert`/`dbUpdate` instead of `sdformSetOne`, no message log in that table).
- Verified after the move: 5 X-ray suites, 6 LAB suites, validator exit 0, `git diff --check`.
  The four `test_lab_result_*` / `test_lab_workbench_*` failures remain pre-existing.

## [2026-09-01] fix | Prepared Worklist Form with receive-specimen enabled
- Runtime toast `รับ specimen ยังไม่เปิดใช้จนกว่าจะมี write API` identified the deployed
  MyStarterKit Worklist as the old Form revision; the current local candidate does not route
  Receive through `explainWriteBlock`.
- Regenerated `lab-cpoe-worklist-waiting-v1.json`: the button calls `receiveSelected`, which
  sends `{item_id}` to Receive Process `6a94f634422c1ca959829d70`. The confirmation now states
  that receipt creates LAB NO./Work Item/Outbound Order but does not dispatch Agent.
- Updated the LAB README: Receive is enabled; only reject/cancel still await write APIs.
- Passed Worklist Form, Receive, LAB NO., Worklist API, and Outbound Form tests; SDForm
  validation and `git diff --check` pass. Deployment remains manual: replace the existing
  Worklist Form, Publish, then test from MyStarterKit under a LAB Organization.

## [2026-09-01] fix | Added standalone MongoDB fallback to LAB receive flow
- Live MyStarterKit reached Receive successfully, then LAB NO. failed with MongoDB error
  `Transaction numbers are only allowed on a replica set member or mongos`; this proves the
  current database is standalone and the earlier Form wiring is working.
- `lab_no_generate_api.js` now prefers `mongoTxn` but falls back to atomic
  `findOneAndUpdate` counter allocation plus Work Item `_id` idempotency. Concurrent/crashed
  attempts may leave a sequence gap; numbers are never reused and duplicates remain blocked.
- `lab_cpoe_receive_api.js` has the same compatibility gate and uses compare-and-set Work
  Item receipt plus idempotent Outbound insertion on standalone MongoDB. CPOE remains read-only
  and Agent dispatch remains outside Receive.
- Added standalone regression cases. LAB NO., Receive, Worklist API/Form, Outbound Form, and
  `git diff --check` pass. Deploy both LAB NO. and Receive Process bodies before retesting.

## [2026-09-01] note | First standalone LAB receive persisted successfully
- MyStarterKit successfully received mock Item `6a956902422c1ca959829e3b` (C34 Gamma GT) after
  deploying the standalone-compatible LAB NO./Receive bodies.
- Read-only DB verification found exactly one active Work Item with LAB NO. `106909010001`,
  `work_status=received`, and exactly one matching Outbound with `hl7_status=new`; the source
  CPOE Item remains `current_status=sent`, confirming the read-only CPOE boundary.
- Outbound is not Agent-ready: `last_error_code=awaiting_outbound_data`, with missing fields
  `priority` and `items[0].collected_at`. No Agent attempt occurred (`attempt_count=0`).
- The supplied `statuses:["cancelled"]` Worklist response is a normal count/refresh request
  for another cancelled Order and is unrelated to the received Item.
- Next: confirm/restore CPOE priority-to-Agent mapping and choose the authoritative collection
  timestamp source, then reconcile the Outbound snapshot before testing Agent dispatch.

## [2026-09-01] fix | Restored priority mapping and made collection time optional
- User confirmed collection time comes from the ordering form when available, but an empty
  `collected_at` must not block laboratories that do not require it. No fallback timestamp may
  be fabricated; `received_at` remains the actual receipt timestamp.
- Updated Receive priority mapping: `1→R`, `2→A`, `3/4/5→S`, plus R/A/S and routine/urgent/stat
  equivalents. Missing/unknown priority still blocks readiness as `awaiting_outbound_data`.
- Receive now omits `items[0].collected_at` when empty instead of marking the Outbound pending.
  Agent Submit keeps the field in its allow-list and validates it when present, but no longer
  requires it.
- Fixed a corrupted `toLowerCสรase()` call in Receive to `toLowerCase()`; this was a concrete
  source of `... is not a function` runtime failure.
- Expanded regression coverage for missing collection time and all priority mappings. Agent
  Submit, Receive, LAB NO., Worklist API/Form, Outbound Form, and `git diff --check` pass.
- Deployment: replace Receive Process `6a94f634422c1ca959829d70` and Agent Submit Process
  `6a9468c7422c1ca959829d6a`. Existing C34 Outbound remains unchanged until deferred Reconcile.

## [2026-09-01] note | Probed the live RIS endpoint — blocked at the gateway, nothing written
- Sent only deliberately invalid bodies so no order could be created. Every request stopped at
  the API Factory gateway; the team's process was never reached and no ACK was produced.
- Two transport facts established, both now locked by `test_xray_order_ris_params.js`:
  - the body must carry a top-level `params` property — `{}` returns
    "body must have required property 'params'", and the gateway checks this **before** the token;
  - the token belongs in **`Authorization: Bearer`**. `?token=`, `token:` and `x-token:` all
    return "Missing token header", while `Authorization` returns "Token not valid" — proof the
    gateway reads that slot and rejected the value.
- The supplied guest token is not accepted. Decoded locally: `user: guest`,
  `processId: 6a8f1ef87632d182ef6914fe` (matches `xray_api_order.js`), issued 2026-08-27 23:41
  น. ไทย, **no `exp` claim**, so validity is tracked server-side — it was revoked or rotated.
  A fresh public token is needed before any send test.
- `post_xray_order_case.js` now sends the Authorization header (keeping `?token=` as a fallback)
  and explains both failure modes when it sees them.
- User decision: `AdmissionNo` and `PatientSsn` **should be relaxed to optional**; the team is
  fixing the API and the user will re-upload it. Recorded in the fixture's `pending_on_team`
  and asserted, so dispatch is not designed around today's strict rules.
- No token, JWT, or environment host was written to the repository.

## 2026-09-01 — LAB Receive retry ready; timestamp-stability issue found

- Live Receive retry for C34 Item `6a956902422c1ca959829e3b` returned `already_received: true`, Outbound `ready`, and no missing fields; LAB NO. stayed `106909010001`.
- Read-only verification found Work Item receipt time `09:06:13`, while the refreshed Outbound payload used retry time `09:22:45`.
- Decision: do not dispatch this Order to Agent until Receive reuses the original stored receipt time on idempotent retries and the Outbound snapshot is refreshed and verified.

## 2026-09-01 — Verified LAB persistence after another Receive retry

- Read-only MongoDB checks found exactly one active Work Item and one active Outbound for Item `6a956902422c1ca959829e3b`.
- Work Item remains `received` with LAB NO. `106909010001` and original receipt time `09:06:13`.
- Outbound remains `new`, retryable, with `attempt_count: 0` and no Agent response; its payload receipt time changed again to the latest retry time `09:26:38`, confirming the timestamp-stability fix has not been deployed yet.

## [2026-09-01] note | Preserve LAB receipt time across Receive retries

- Refactored `lab_cpoe_receive_api.js` to create the Outbound snapshot only after the receipt write or concurrent winner is known.
- First receipt still records the current server time; later retries reuse the persisted Work Item `received_at` instead of replacing it with retry time.
- Added a regression assertion that advances the retry clock and confirms the Outbound payload retains the original receipt timestamp.
- Receive, Agent Submit, and LAB NO. focused tests plus `git diff --check` passed. Deployment and live DB verification remain next.

## [2026-09-01] note | Timestamp-stable Receive verified in live DB

- Deployed Receive retry returned `already_received: true`, `ready`, and no missing fields for Item `6a956902422c1ca959829e3b`.
- Read-only DB verification confirmed Work Item `received_at` `09:06:13` and Outbound payload `received_at` `09:06:13+07:00` match.
- Outbound remains `new`, retryable, and unattempted with no Agent response. Direct Agent Submit test is next.

## [2026-09-01] note | Direct Agent Submit reached network failure

- Direct Agent Submit accepted the stored Outbound payload but returned `agent_unreachable`, `http_status: null`, and `retryable: true`.
- This means API Factory received no HTTP response; payload validation, LAB NO., and receipt persistence are not the failure point.
- The current non-JSON fallback reason is misleading for a connection exception. Verify the configured value is a base URL without `/api/orders` and test network reachability from the initCraft server runtime, not only from a VPN-connected Mac.

## [2026-09-01] note | Agent LAB NO. pattern mismatch confirmed

- VPN curl with the Agent key reached the endpoint; an empty payload returned the expected `422`, proving Mac-to-Agent reachability and credential acceptance.
- The real payload was rejected with `422` because Agent expects the documented 10-digit `YYMMDDNNNN`, while HIS now generates the approved 12-digit `SSYYMMDDNNNN` value `106909010001`.
- Preserve the Work Item LAB NO. and idempotency key. Agent configuration/contract must accept the 12-digit form before retrying the same Order.

## [2026-09-01] note | Agent accepted the 12-digit LAB Order

- After Agent updated its LAB NO. pattern, direct VPN curl with the unchanged Order returned `202 Accepted`.
- Agent reported `order_ref:13`, `dispatch_id:12`, `duplicate:false`, and `routed_to:["rax-file"]`.
- This verifies HIS payload to Agent queue only. The curl bypassed initCraft Outbound persistence and does not yet prove LIS receipt; retrying through Agent Submit Process with the same idempotency key is next.

## [2026-09-01] note | API Factory-to-Agent route is blocked

- Retrying the accepted Order through Agent Submit Process still returned `agent_unreachable` with `http_status: null`.
- Because the identical payload succeeds from the VPN-connected Mac, the remaining blocker is network reachability from the server-side initCraft API Factory runtime to the hospital-private Agent.
- Infra must provide an approved VPN/private route, firewall allowlist, or relay. Do not move the Agent key into the browser/Form as a workaround.

## [2026-09-01] decision | Pause Agent dispatch; design Result attachments

- Agent Submit remains parked until initCraft server has an approved VPN/private route to the hospital Agent.
- The Worklist `ดูผล` popup will place `ไฟล์แนบผลตรวจ` below its result table.
- Use a separate append-only Attachment Log linked to Result Report + Work Item; store file binary in file storage, never base64 in the clinical record. Replacement creates a new row and removal is soft-voided.
- Recommended initial policy: PDF/JPEG/PNG, 10 MB per file, 5 files and 30 MB total per Report. The real gateway/storage hard limit still needs verification.
- Before SDForm wiring, export a real File Upload widget from Builder. Existing hand-authored `file-upload-input` candidates are not trusted runtime evidence.

## [2026-09-01] decision | Result attachment is PDF-only

- User changed the result attachment policy from PDF/images to PDF only.
- Builder validation message `File must be pdf format!` occurs before any request, so an empty Network/Console is consistent with client-side rejection.
- Configure `fileTypes` as the extension value `["pdf"]` (no dot and no MIME string), then verify the selected file has a real lowercase `.pdf` name. After validation passes, separately verify the upload URL/default storage request and returned metadata.

## [2026-09-01] decision | Result attachment also accepts images

- Latest allowed extensions are `pdf`, `jpg`, `jpeg`, and `png`.
- Recommended widget limits are 3 files and 10 MB per file, bounding one Report at 30 MB before server-side enforcement.

## [2026-09-01] evidence | File Upload test export identified

- Local export: `Form-Builder/SDForm/sdform_module/test_widget_uploadfile.json`; candidate Form/collection `6a96508f422c1ca959829e9a` / `zdata_6a96508f422c1ca959829e9a`.
- Widget `file_upload_input30660` currently has `multipleSelect:false`, limit 3, 10 MB, types PDF/JPEG/JPG, blank `uploadURL`, and no upload event handlers; PNG is not yet included.
- Read-only ERP connection did not list the collection or matching `sdform_manage` record and returned zero rows. The Form may be unpublished/unwritten or exist in another environment; recheck after Publish and first saved test record.

## [2026-09-01] evidence | Built-in File Upload persisted files

- The test Form saved one record containing two successful PDF entries. Each entry includes original name/size plus response `fileId`, storage-relative `fileName`, `filePath`, `fileType`, MIME, `formId`, and URL.
- A blank exported `uploadURL` is not a blocker in this runtime; SDForm supplied its built-in upload endpoint. The next proof is edit/reopen persistence and adding one harmless third file.
- The configured read-only ERP MCP still cannot see this Form/collection, indicating environment mismatch; UI evidence is valid for the current HIS runtime but DB verification must use the matching connection.

## [2026-09-01] evidence | File Upload edit preserved and appended

- Editing the test record preserved both existing PDF entries and their original `fileId` values.
- Adding a third PDF produced a new successful entry with a new `fileId`; the field now contains three entries, proving edit-time append without recreating earlier files.
- Next safe test is removing only the disposable third entry, saving, and reopening to determine whether the widget merely updates record metadata or also deletes the stored file. Production LAB removal will still use soft-void logging.

## [2026-09-01] evidence | File Upload removal overwrites record metadata

- After removing one attachment and saving, the record array contained only the two retained files; their original `fileId` values remained stable and the removed file entry disappeared.
- This proves the base File Upload field does not preserve attachment-removal history in its Form record. It does not prove whether the physical storage object was deleted.
- Production LAB attachments must record every upload as a separate log row and represent removal with soft-void metadata rather than relying on the mutable upload array.

## [2026-09-01] decision | Reuse the existing upload test export

- `test_widget_uploadfile.json` is the intended working export; no second export filename is expected.
- Keep the proven test source unchanged and copy its widget definition into the LAB implementation, changing only the LAB copy to include PNG and enable multi-select.

## [2026-09-01] requirement | External LAB document result

- External LAB requests still originate as HIS LAB Order/Item records; the clinical result may arrive later only as an attached document.
- A separate Attachment Log is recommended because the native upload array loses removed metadata. The binary remains in built-in file storage; the log stores references and audit metadata only.
- `list`, `register`, and `void` are actions in one Process and can extend the existing Worklist Process rather than creating three Processes.
- Proposed status rule pending user confirmation: uploading any file is not enough to complete a result. Only a file marked `final_result` plus an explicit `ยืนยันออกผล` action completes that Item; Order completion remains an aggregate of its Items.

## [2026-09-01] decision | External LAB result is current Order-level document

- User confirmed external LAB returns one document set for the whole external Order, not separate result files per test Item.
- Replace the earlier append-only Attachment Log proposal: store the current attachment metadata array on the existing Result Report, overwrite on confirmed edits, and retain only the latest confirmer/time, matching current-value clinical result semantics.
- No separate Attachment Log form and no `list/register/void` actions. Extend the existing Worklist Process with `get_external_result` and `save_external_result`.
- Upload alone does not complete results. `ยืนยันออกผล` validates at least one successful file, upserts the Report and latest confirmer/time, then completes the external Items in that Order.
- Still require a reliable external-order/item marker so a mixed CPOE Order cannot accidentally complete internal LAB Items.

## [2026-09-01] audit | Agent-result package inventory and integration drift

- The Agent JSON callback package has four actual forms: three data forms (`Lab_Result_Inbound_Receive`, `Result_Report_Manual_Entry`, `LAB_result_item`) and one no-table UI (`Result Report Viewer`). Its direct inbound API is `hl7_result_upsert` / deployed Process `6a8da8a6f851000f28e50299`.
- The many local JSON filenames are working versions/tests, not additional live forms.
- The inbound Process still targets legacy Status Form `6a7daa3e8d398c11cf2fe869`, not current Lab Work Item `6a95c750422c1ca959829e8a`.
- Agent materialization uses Result Item Form `6a8bc91df851000f28e501fb`, while current `lab_cpoe_worklist_api` Manual Mycology actions use older Result Item Form `6a7aa641935ed08882467374`.
- Before real Agent callback UAT, select one canonical Work Item/Result Item contract and update mappings/tests; the External LAB attachment feature itself should extend Report + Viewer + current Worklist API, not the technical Receipt.

## [2026-09-01] schema | Canonical LAB Result contract organized

- Canonical chain is now Work Item `6a95c750422c1ca959829e8a` → Result Report `6a8d4334f851000f28e5025b` → Result Item `6a8bc91df851000f28e501fb`; Technical Receipt remains `6a8b1c03f851000f28e501ef`.
- `hl7_result_upsert_api.js` now matches callbacks against the current Work Item by LAB NO. plus Work Item ID/HN/Visit ID, and no longer targets legacy Status Form `6a7daa3e8d398c11cf2fe869`.
- `lab_cpoe_worklist_api.js` now writes Manual Mycology through a canonical Report + Item. Legacy Item `6a7aa641935ed08882467374` remains read-only fallback for old records.
- Work Item schema/generator now include `visit_id`; Receive backfills identity fields on retry without changing the original receipt time. `prepare_manual_lab_results_api.js` is marked legacy/do-not-deploy.
- Added `design/lab-result-canonical-contract.md`. All targeted Agent-result, Worklist, LAB NO., Receive and Agent-submit tests passed; five SDForm candidates passed the validator. Builder/runtime/deployed callback remain unverified.

## [2026-09-01] note | Canonical LAB Result files replaced in initCraft

- User reports replacing/re-importing the Work Item form and all four updated Process bodies: LAB NO., Receive, Worklist, and `hl7_result_upsert`.
- Deployment presence is user-reported; runtime behavior is not yet verified.
- First safe verification is an idempotent Receive retry for UAT Item `6a956902422c1ca959829e3b`, confirming `visit_id` backfill while LAB NO. `106909010001` and `received_at` `2026-09-01 09:06:13` remain unchanged.

## [2026-09-01] runtime | Canonical Receive retry verified

- `lab_cpoe_receive_api` returned success for UAT Item `6a956902422c1ca959829e3b` with `already_received: true`, `outbound_readiness: ready`, and no missing fields.
- LAB NO. remained `106909010001`; original receipt time remained `2026-09-01 09:06:13`.
- Read-only HIS MongoDB verified the Work Item stores `visit_id: 6900206`, `work_status: received`, the same LAB NO./receipt time, and `received_by: Earn_admin`.
- The matching `zdata_lab_outband_order` record exists with the same Work Item/order identity, LAB NO., `visit_id: 6900206`, and `hl7_status: new`.
- Next safe runtime check is direct `hl7_result_upsert` UAT, followed by read-only inspection of canonical Result Report and Result Item records.

## [2026-09-01] audit | UAT inbound result code alias gap

- UAT Work Item `6a956902422c1ca959829e3b` stores `item_code: C34` and outbound `test_code: 1034CD` for Gamma GT.
- Current `hl7_result_upsert_api` builds one ordered code per Item using first non-empty `his_code_id`, `item_code`, `test_code`, `obs_code`, `code`; this record therefore matches inbound `obs_code: C34`, not `1034CD`.
- A controlled partial callback can test inbound transport now with `C34`. Before production callback UAT, confirm which code Agent emits; if it emits `1034CD`, expand API alias matching. No Form schema change is required for this gap.

## [2026-09-01] requirement | Pre-receipt CBC room rerouting

- Agent inbound-result UAT is parked while the Agent team tests the public callback; inspect Receipt, Report, Result Item, and Work Item after its response arrives.
- New requirement: orders in the two CBC-capable rooms need an Item-level `ส่งเข้าห้อง` action while waiting for receipt, to correct a physician's room selection.
- Live Section master identifies `HM` as งานโลหิตวิทยา and `ML` as งานจุลทรรศนศาสตร์คลินิก. `HH` is Hematology-Homeostasis and is not assumed to be the requested second room.
- Five CBC-labelled Item masters were observed: `HM1`, `MS1`, `NAP-MS-1`, `MS1-R`, and `HM1-R`; eligibility is not yet confirmed. Their nested `lab_item` snapshots all currently point to `HH` / `2201EB`, so do not use that nested value to infer requested routing without user confirmation.
- Proposed design: preserve CPOE read-only; create/update an audited pre-receive routing overlay in the existing Lab Work Item without reserving a LAB NO.; Worklist uses the effective routed Section; LAB NO./Outbound use the destination Section only when receipt occurs.
- Open decisions: button for only eligible CBC codes or every Item in HM/ML; automatic opposite-room destination or selector; whether a reason is mandatory; whether rerouting back is allowed before receipt. No implementation yet.

## [2026-09-01] audit | CBC routing UX and legacy specimen rejection

- User confirmed routing applies only to eligible CBC Items, automatically targets the opposite room between `HM` and `ML`, opens a confirmation dialog, and requires a reason.
- `Lab_Bio_Rejection.json` and `sdform_module/lab_reject.json` contain the same form content (only the final newline differs). Their reason list is specimen-rejection-specific, so only the dialog/required-reason UX should be copied for CBC routing.
- Legacy `Lab_Bio_Reject_Specimen_API.js` targets `zdata_specimen_collection_status` plus rejection records in `zdata_lab_receive`; it is not compatible with the current canonical `zdata_lab_work_item` flow and must not be called for room routing.
- Actual specimen rejection can be ported later as a current Work Item action/API while preserving the legacy artifact for old screens. CBC routing needs separate routing fields/history so it never appears as a rejection.
- Remaining eligibility decision: only normal CBC `HM1`/`MS1`, or all five CBC-labelled masters (`HM1`, `MS1`, `NAP-MS-1`, `MS1-R`, `HM1-R`). No implementation yet.

## [2026-09-01] query | Recommend pull-based CBC room queue

- Scope is all five CBC-labelled codes: `HM1`, `MS1`, `HM1-R`, `MS1-R`, and `NAP-MS-1`.
- The old-system behavior described by the user is best modeled as a shared `CBC รอดึงเข้าห้อง` queue available only to HM/ML staff. It shows unreceived CBC Items whose effective room is the opposite room.
- Recommended action is pull, not ordinary push: the signed-in room is the destination, so users do not select a room. Confirm dialog and a required routing reason remain mandatory.
- A successful atomic claim moves the Item from the shared queue to the current room's waiting-receive list; simultaneous claims allow only one winner. Source CPOE and original Section remain unchanged; effective routing and audit live in Lab Work Item.
- If a pull was wrong, use a separately permissioned `คืนห้องเดิม` action before receipt rather than giving all users a generic send-out button. Design awaits user confirmation; no Form/API implementation yet.

## [2026-09-01] decision | Keep CBC routing inside the existing Worklist

- User rejected an additional CBC tab because the Worklist was intentionally consolidated into one page.
- Revised UI: HM/ML waiting-receive list also includes unreceived CBC candidates from the opposite room. Each candidate is visually marked with its source room and has an Item-level `ดึงเข้าห้อง…` action; receipt is disabled until the pull succeeds.
- A compact `CBC จากอีกห้อง (N)` control may filter the same list for convenience but must not create another tab or workflow page.
- After Confirm plus mandatory reason, the Item becomes a normal current-room waiting item. CPOE stays unchanged; routing audit remains in Work Item and LAB NO. is still generated only at receipt. No implementation yet.

## [2026-09-01] correction | CBC room transfer may require code-pair mapping

- Clarified why wrong-room CBC can occur despite separate rooms: the order master exposes clinically similar CBC Items whose selected code already owns a Section (`HM1`→HM, `MS1`→ML; analogous Research pair). Choosing the wrong room-specific Item routes the order to that room's Worklist.
- This invalidates the earlier assumption that every one of the five CBC-labelled codes can simply retain its original code while changing only the effective Section.
- Before implementation, LAB/LIS owners must confirm whether the old `ส่งเข้าห้องตัวเอง` function changed only work ownership or also substituted the paired CPOE/LIS test code. Safe candidate pairs are `HM1↔MS1` and `HM1-R↔MS1-R`; `NAP-MS-1` has no confirmed HM counterpart.
- Preserve original CPOE Item regardless. If code substitution is required, store original plus effective routing/test identities in Work Item/Outbound and never silently equate CPOE item code, outbound test code, LIS code, or result `obs_code`.

## [2026-09-01] note | Team shipped the relaxation — required list is now 9
- Re-read the re-uploaded `Form-Builder/API/api-factory/xray_api_order.js`. Changes:
  - `required` 11 → 9: **`AdmissionNo` and `PatientSsn` removed**;
  - the `/^\d{13}$/` check on `PatientSsn` is **gone entirely**, so the field is now free-form;
  - both stay in `allowedFields`, so they are still stored when sent;
  - everything else is unchanged — enums, AccessionNo ≤ 16, numeric rules, upsert by
    AccessionNo, `dbInsert`/`dbUpdate`, `wsSend` after commit.
- `test_xray_order_ris_params.js` caught the drift on the first run, as designed.
- The form and the API now diverge on purpose (`xray_order.json` still marks 11 required).
  The test no longer demands equality; it asserts the API never requires a field the form does
  not declare, and that the difference is exactly the recorded relaxation — so a *new* drift
  still fails. Case validation now runs against the API's list, which is the runtime authority.
- Fixture updates: `minimal_required_only` is now exactly the 9 required fields;
  `missing_admission_no` became `opd_without_admission_no` (**accept** — the real OPD case);
  `foreign_patient_no_ssn_placeholder` became `foreign_patient_without_ssn` and now **omits**
  the field instead of sending a fake 13-zero id. 10 accept / 10 reject.
- Recorded in `spec.md` §4.2, moved from `pending_on_team` to `resolved`.
- Still blocked on a fresh public token before any live send test.

## [2026-09-01] note | xray-cpoe-dispatch (X3) written — the loop is complete in code
- User settled the mapping: `PatientClassUid` is **I/O only** (AN present ⇒ I), **E dropped**;
  `ExamUid` = CPOE `item_code`; `ModalityTypeUid` = the code (`DX`); send whatever fields make
  sense and let RIS map the rest.
- New `Form-Builder/API/api-factory/processes/xray_cpoe_dispatch_api.js`. One Process, whole
  sequence server-side: issue accession → commit the receive in a transaction → send to RIS →
  store the transport outcome. Both hops use `app.runProcess(id, params, userInfo)`, found in
  `02-initcraft/skills/.../build-a-process.md`, so **no public token and no outbound HTTP we own**.
- Retry is first-class: an item whose transport failed keeps its accession and is re-sent, which
  the RIS upserts on `AccessionNo` instead of duplicating. `retry_only` limits a run to those.
- A RIS failure never rolls back the accession or the receive — that is asserted, including the
  network-exception path. A failure *before* the receive leaves the item untouched.
- Birth dates stored in พ.ศ. are converted to ค.ศ.; an unreadable date is omitted, never guessed.
  Empty optional fields are omitted rather than sent blank.
- Form wired: `ส่งเข้าเครื่อง` now calls `dispatchOrder(row)` and relabels to `ส่งเข้าเครื่องใหม่`
  when transport failed. `DISPATCH_PROCESS_ID` is empty until the Process is deployed; the button
  says exactly which constant to fill.
- 6 X-ray suites + 6 LAB suites pass, validator exit 0, `git diff --check` clean.

## [2026-09-01] note | Dispatch deployed as Process 6a967029422c1ca959829edc
- Recorded the ID in the process header, `spec.md` §4.2, `design.md`, and the generator's
  `DISPATCH_PROCESS_ID`; regenerated the Form.
- `test_xray_cpoe_dispatch_api.js` now asserts the header carries that exact ID.
- `test_xray_cpoe_worklist_form.js` exercises the wired button against the real ID and still
  covers the unconfigured case by blanking the constant, so clearing it can never fail silently.
- 6 X-ray suites + 6 LAB suites pass, validator exit 0, `git diff --check` clean.
- Remaining: re-import the Form and run the first real dispatch. Nothing else is blocking.

## [2026-09-01] note | Radiology scope widened to m0900 + m0901 + CT
- The empty worklist was not a data or code problem: the user was signed in as **M0900** while
  `XRAY_ORGANIZATION_CODES` allowed only `m0901`, so the fail-closed gate refused before any
  query ran. The worklist Process had not been touched since 31 Aug.
- User supplied the real tree: `m0900` กลุ่มงานรังสีวิทยา (xray) → `m0901` งานรังสีวิทยา (X-ray)
  and `CT` CT scan / CT-MRI SCAN (which holds the CT and MRI exam rooms). All three are now
  allowed, in all three X-ray Processes.
- Recorded an important property found while checking: the organization is **only an access
  gate**. The query filters on `service_type = 'xray'` and status alone, so every allowed org
  sees the whole radiology worklist. The user confirmed that is wanted for now; per-org filtering
  by modality would be a separate feature.
- Tests updated to match: `m0900` and `CT` are now allowed cases in all three suites, the
  dispatch suite asserts `OrganizationUid` carries the sending org, and a new fabricated unit
  `m0950 งานรังสีรักษา` keeps the guarantee that a radiology-sounding **name** never grants access.
- 6 X-ray suites pass. **All three Processes must be re-pasted** — the scope constant changed in
  each one.

## [2026-09-01] note | Chips counted 1 while the table was empty — status-list desync
- Cause: the API's `buckets` facet (which feeds the chips) applies no status filter, while
  `rows`/`meta` (which feed the table) filter on the `statuses[]` the form sends. The form
  hardcoded 10 statuses; `STATUS_VOCABULARY` in the API has 14. The missing ones were **`draft`**
  (bucket active) and `rejected`/`returned`/`reversed` (bucket cancelled).
- By elimination the user's single order is in **`draft`**: it is counted in the active bucket
  but excluded from the table, which is exactly what the screen showed.
- Fix, form-side only (no Process redeploy): the `all` chip now sends **no** `statuses` so the API
  falls back to its own vocabulary, and the three bucket chips list exactly what the API puts in
  each bucket.
- `test_xray_cpoe_worklist_form.js` now parses `STATUS_VOCABULARY` out of the worklist API source
  and asserts each chip requests exactly that bucket's statuses, so this desync cannot recur
  silently. `all` must stay empty.
- 6 X-ray suites pass, validator exit 0. **Only the Form needs re-importing.**
- Open question for the user: should a `draft` CPOE order be actionable in radiology at all? It
  now shows as รอรับ and can be dispatched.

## [2026-09-01] note | draft removed from the radiology vocabulary
- User's rule: an order the doctor has not submitted is not an order, so radiology must **not see
  or count it** — not merely be unable to dispatch it.
- Removed `draft` from `STATUS_VOCABULARY` in `xray_cpoe_worklist_api.js`. That constant is the
  pipeline's first `$match`, so a draft is now excluded from the chip buckets and the table
  together — no possibility of the counts-over-empty-table symptom returning for this status.
- Dropped it from the form's `active` list to keep the mirror exact.
- `test_xray_cpoe_worklist_api.js` now asserts `draft` is absent from the vocabulary, and the form
  test's vocabulary mirror keeps both sides aligned.
- Documented as `spec.md` §4.2.1 with the full bucket table.
- The visible consequence: the user's single order is a draft, so the screen will correctly show
  0 everywhere until a doctor actually submits one. Testing dispatch needs a submitted order.
- 6 X-ray suites + LAB regression pass, validator exit 0, `git diff --check` clean.
- **Re-paste the worklist Process and re-import the Form.**

## [2026-09-01] note | Removed the manual "ออกเลข" button — dispatch owns the accession
- The button was scaffolding from when dispatch did not exist. With dispatch deployed it became a
  second path that could leave an item holding a number while still "รอรับ" and unknown to RIS.
- Removed from the template, the CSS, `s.issuing`, `buildItem`, the `issueAccession` method, and
  the `ACCESSION_PROCESS_ID` constant. The Accession cell now just prints the number.
- `test_xray_cpoe_worklist_form.js` asserts none of it can come back and that the form never calls
  the accession Process directly.
- 6 X-ray suites pass, validator exit 0. **Only the Form needs re-importing.**
- **Observed in live data:** the first real order carries **two** items (`RD015 Neck AP`,
  `RD016 Lateral neck`), which contradicts `spec.md` §1 "1 order = 1 accession = 1 test". Dispatch
  already loops every waiting item and issues one accession each, so the write path is correct,
  but the summary row shows only `items[0]` — name, code and modality — so the second test is
  invisible until the row is expanded. Raised with the user; not changed yet.

## [2026-09-01] implementation | LAB Worklist EMR button opens EMR History by VN
- Changed the LAB Worklist EMR target to Form `6a96557e422c1ca959829eae` and pass VN plus the
  Worklist Visit ID as a cross-check; the popup no longer treats Visit ID as `parentId`.
- `EMR_history.json` resolves exact VN through Visit Form `6a40fdec4b6dfdf45acbfbce`, then calls
  existing History Process `6a9662a75723cd050ea497e0`. Duplicate VN is accepted only when one row
  matches the supplied Visit ID; mismatch/not-found fails closed so another patient's EMR cannot
  be opened accidentally. Direct `visit_id/history_id` opening remains available as fallback.
- Wrapped the previously root-level `emr_view` widget in a standard 24-column grid; this fixed the
  validator/Builder risk where Tree can see the widget but canvas cannot render it.
- Added a repeatable wiring script and a dedicated VN-mapping regression test; updated the LAB
  Worklist Form test. Both tests pass, both SDForm JSON files validate, and `git diff --check` is
  clean.
- Parked blockers in Hot Cache: initCraft server route to Agent; Agent inbound test/code alias;
  CBC cross-room ownership/code-mapping policy; canonical external-LAB marker; X-ray multi-item UI.

## [2026-09-01] correction | LAB EMR uses the existing Visit ObjectId directly
- User clarified that Worklist `visit_id` is already the ObjectId of the Visit record that owns
  the VN. A VN-to-Visit lookup would therefore duplicate a resolved relationship.
- Removed the temporary VN resolver, duplicate/mismatch branch, grid wrapper, dedicated test and
  wiring scripts. Restored `EMR_history.json` to its uploaded direct `visit_id/history_id` behavior.
- The only retained integration change is in LAB Worklist: EMR points to Form
  `6a96557e422c1ca959829eae`, requires `visit_id`, and passes it in `openForm.params.visit_id`.

## [2026-09-01] note | 1 order = many tests = many accessions, with LAB-style checkboxes
- Live data settled it: a real order carries two tests. User's rule — X-ray works like LAB, one
  order can hold several tests and each gets its own accession, and the user ticks which ones to
  send. The old "1 order = 1 accession = 1 test" line in `design.md` is struck through, not deleted.
- Dispatch now takes `item_ids[]`. Omitted ⇒ every dispatchable item, as before. Supplied ⇒ only
  those. Ids that are not 24-hex are rejected outright rather than silently collapsing to "no
  selection", which would have dispatched the whole order. Ticking an item that is not in a
  dispatchable state, or not in the order, returns a specific reason instead of "no items".
- Form mirrors LAB: a `เลือก` column with `el-checkbox`, disabled unless the item is waiting or its
  transport failed; `ส่งเข้าเครื่อง` is disabled until something is ticked and shows the count;
  selection clears when the row collapses, when the list reloads, and after a successful dispatch.
- The summary row no longer pretends there is one test — it shows `+ อีก N รายการ` and the tooltip
  lists every test name.
- Item grid grew a 44px column (`min-width` 1202→1256).
- Tests: dispatch suite now runs a two-item order and proves each test gets its own accession and
  its own RIS order, that an unticked item is left completely untouched, and that a malformed
  selection never falls back to dispatching everything. Form suite covers tick/untick, the
  item_ids payload, the refusal when nothing is ticked, and the cleared selection.
- 6 X-ray suites + LAB regression pass, validator exit 0, `git diff --check` clean.
- **Re-paste the dispatch Process and re-import the Form.**

## [2026-09-01] note | ส่งเข้าเครื่อง reached the API but got "Order นี้ไม่มีรายการทางรังสี"
- The button works; dispatch itself could not find the order's items even though the worklist
  renders two of them. The two read the data differently: the worklist joins with `$lookup`
  (`order_ref_id` → `_id`), dispatch used `find({ order_ref_id: ObjectId })`, which misses when the
  field is stored as a string.
- Dispatch now matches `order_ref_id` **or** `xparentx`, against both the ObjectId and the string
  form, and reads `service_type` whether it is `{value:'xray'}` or the bare string `'xray'`.
- Rather than guess again, the refusal is now self-diagnosing: no items at all says the link field
  is wrong; items found but not radiology lists the `service_type` values actually seen, and both
  return `data.items_found` / `data.service_types`.
- Form fix: a hard refusal no longer clears the ticked boxes or reloads the list. Nothing changed
  server-side, so making the user re-tick was pure friction.
- Tests cover both storage shapes, the orphaned-link message, and the wrong-service_type message.
- 6 X-ray suites + LAB regression pass, validator exit 0, `git diff --check` clean.
- **Re-paste the dispatch Process and re-import the Form**, then press again — if it still refuses,
  the message will now name the cause.

## [2026-09-01] note | Whole item row is clickable for selection
- User asked to stop having to aim at the checkbox — clicking anywhere in an item row now toggles
  it. Added `selectRow(item,$event)` on the X-ray item row, with `is-selectable` (pointer + hover)
  and `is-selected` (tinted) classes so the row states are visible.
- Three deliberate escapes, each tested: a click on the checkbox itself is ignored by the row
  handler (the checkbox already fires `toggleItem`, so handling both would cancel out); clicks on a
  button, link, input or select inside the row belong to that control; and a click that merely ends
  a text selection does not toggle, so an accession number can still be dragged and copied.
- Rows that are not dispatchable stay inert and show no pointer.
- 6 X-ray suites pass, validator exit 0, `git diff --check` clean. **Form re-import only.**
- The user's screenshot was actually a **LAB** row. LAB's form and generator were being edited by
  the parallel session eight seconds before I looked, so I did not touch them; raised with the user
  instead of risking a collision.

## [2026-09-01] note | Dropped the duplicate เวลาสั่ง column from the item table
- The order-level row already shows เวลาสั่ง / Order No., so repeating it per test was noise.
- Item grid is back to 9 columns (`44px 150px minmax(215px,1.9fr) 118px 132px 116px 108px …`),
  `min-width` 1256 → 1130 — narrower than before the เลือก column was added.
- Removed the now-unused `ordered_text` from `buildItem` rather than leaving a dead field.
- Tests assert the item table has no `data-label="เวลาสั่ง"`, that `ordered_text` is gone, and that
  the order-level `เวลาสั่ง / Order No.` is still there.
- 6 X-ray suites pass, validator exit 0, `git diff --check` clean. **Form re-import only.**

## [2026-09-01] decision | LAB rejection now writes one Lab Work Item
- Reused `lab_reject` (`6a7713fdcc7d0a8451130331`) as the mandatory reason/audit popup and
  rewrote Process `6a79ff46d5218a5b6a26bebc` to target one CPOE Item's
  `zdata_lab_work_item`, not the legacy whole `zdata_specimen_collection_status` row.
- A rejection before receipt creates a `rejected` Work Item without allocating LAB NO.; an
  existing `waiting_receive` Work Item changes through compare-and-set. Received, processing,
  result, completed, cancelled and Outbound-linked Items fail closed. CPOE and Outbound remain
  read-only.
- Worklist saves the reason first, passes its record ID to the Process, closes only after the
  status succeeds, and shows `rejected` in the `ยกเลิก / ปฏิเสธ` filter. Whole-order cancellation
  remains write-blocked and legacy `recheck` is intentionally unsupported in this Process.
- Added `rejection_record_id` to Work Item and made LAB NO. optional for the pre-receipt rejected
  state. New API/UI tests pass; Worklist API, Receive and LAB NO. regression tests pass; all three
  affected SDForms validate; `git diff --check` is clean.

## [2026-09-01] fix | Worklist shows the selected rejection reason
- Runtime UAT showed `rejected_by` but a dash in the rejection column. The Work Item contained
  `reject_reason_code`, while Worklist projected only `reject_reason_detail`; an empty detail is
  not null, so `$ifNull` never fell back.
- Worklist API now returns `reject_reason_code` and `reject_reason_detail`, and falls back from an
  empty detail to the code. The Form maps all current `lab_reject` codes to their Thai labels and
  appends detail as `เหตุผล · รายละเอียด` when supplied. It also supports the old one-field
  payload during rolling deployment.
- Worklist API/Form tests pass, SDForm validator exits 0, and `git diff --check` is clean.

## [2026-09-01] note | Three UI adjustments to the X-ray worklist
- **Spacing.** เครื่อง sat flush against เวลาสั่ง / Order No. at order level and เวลาส่งเข้าเครื่อง at
  item level. Added `padding-right:14px` to both modality cells instead of widening the grid gap,
  so the gutter appears without making either table wider.
- **Modality tag.** It was `display:inline-block` inside a narrow cell, so after wrapping the box
  took the column width rather than the text width and looked loose. `width:fit-content` makes it
  hug the wrapped text; padding 2/7 → 3/8, line-height 1.3 → 1.35, radius 4 → 5.
- **รายการตรวจ at order level** now shows the **count** (`2 รายการ`) like LAB's `item_count`, with an
  `el-tooltip` listing every test name and code on hover. Showing only the first test name was
  actively misleading once an order could hold several. The popper is teleported out of the page
  root, so `.xray-cpoe-test-popper` is styled unprefixed — and it escapes the table's `overflow-x`
  clipping, which a hand-rolled absolute popup would not have.
- Dropped the now-unused `.xr-test-more` CSS and the `test_name`/`test_code`/`test_all`/`more_tests`
  row fields.
- Tests assert the count replaces the single name, the tooltip lists every test, the unprefixed
  popper class exists, and both spacing/tag rules are present.
- 6 X-ray suites pass, validator exit 0, `git diff --check` clean. **Form re-import only.**

## [2026-09-01] note | Item code on its own line; modality pulled away from the time columns
- `.xr-test-code-inline` is now `display:block`, so `RD015` sits under `Neck AP` instead of beside
  it. Font sizes untouched, as the user asked.
- The 14px gutter added earlier was not enough: เครื่อง still read as touching เวลาสั่ง at order
  level and เวลาส่งเข้าเครื่อง at item level. Raised to **26px** and widened the modality column
  118 → 130 by the same amount, so the tag keeps exactly the space it had (130−26 = 104 = 118−14)
  and does not start wrapping more often.
- Order row also reclaims width from รายการตรวจ, which now only holds `N รายการ`:
  `minmax(145px,1.25fr)` → `92px`. Net effect is เครื่อง sits closer to รายการตรวจ and clearly
  apart from the time column. `min-width` 1336 → 1295 (order), 1130 → 1142 (item).
- Tests pin both grid templates, both min-widths, the 26px gutter, and the block-level item code.
- 6 X-ray suites pass, validator exit 0, `git diff --check` clean. **Form re-import only.**

## [2026-09-01] note | X-ray EMR button now opens EMR History, wired exactly like LAB
- `EMR_FORM_ID` 6a4f64e7f8cdfc54cec16488 → **6a96557e422c1ca959829eae** (EMR History).
- The ID was not the only difference, and probably not the reason it never worked: X-ray passed
  `visitId` as `openForm`'s **third argument** (the dataId) while LAB passes `''` there and sends
  `visit_id` inside `params`. Copied LAB's call shape verbatim, including
  `source`/`xray_deep_link` and `readonly` + `popupType:'dialog'`.
- Dropped `vn` from the row's `emr` object and from the call — LAB does not send it and nothing
  else read it.
- Verified both forms now produce byte-identical `openForm(EMR_FORM_ID,'','',null,{…})` calls,
  differing only in the `source` string.
- Test pins the form ID, the empty third argument, and every params/option key.
- 6 X-ray suites pass, validator exit 0, `git diff --check` clean. **Form re-import only.**

## [2026-09-01] note | Diagnosis pulled from the EMR Diagnosis form
- `EMR.json` embeds the Diagnosis form as a `record-ui` with `formId 6a47a9cc8ca8083d715e3486`, and
  its `customContent` shows `primary_dx` is `{value: <ICD>, label: <name>}` — not a plain string.
- Worklist API now fetches it with `app.sdformGetAll({providerId: <form id>, providerType:'FORM'})`,
  which avoids needing the collection name (same tool the team's RIS process uses).
- The link field between a diagnosis row and a visit was not documented anywhere, so the API tries
  `xparentx` → `visit_id` → `vid` and **reports the one that worked** in `data.diagnosis_link_field`
  alongside `diagnosis_found`. One query covers every visit on the page via an `IN` list built from
  ids already validated as 24-hex.
- Newest row per visit wins (`orderBy xupdatx DESC`); deleted rows excluded. A visit with no
  diagnosis stays `null` — never guessed. The whole block is wrapped so a failure leaves the column
  empty instead of breaking the worklist, which is the point: this is a secondary column.
- Form: `diagnosisText` reads the `{code,name,text}` object (still accepts a plain string), and the
  JS character truncation is gone — the full text goes into the DOM and CSS ellipsis trims it to the
  real column width, with `el-tooltip` showing all of it on hover. The dx popper is capped at 420px
  and wraps, unlike the test-list popper which is nowrap.
- Tests: API suite proves the field probing, the newest-row rule, the code-less case, and that an
  empty result leaves the worklist working. Form suite proves the object is flattened, that no
  tooltip appears without a diagnosis, and that `s.shorten` is no longer used for dx.
- 6 X-ray suites pass, validator exit 0, `git diff --check` clean.
- **Re-paste the worklist Process and re-import the Form.** If Diagnosis stays empty, the response
  now carries `diagnosis_link_field`/`diagnosis_found` to say why.

## [2026-09-01] note | Diagnosis: replaced my guessed lookup with LAB's proven one
- The first attempt showed nothing. Checking `lab_cpoe_worklist_api.js` — which the user said
  already works — showed I had guessed wrong on both counts:
  - **collection** is `zdata_diagnosis`; I had avoided naming it by going through `sdformGetAll`
    with the form id, which is a different access path entirely;
  - **link field** is `vid.value`. `vid` is an object, so none of my three candidates
    (`xparentx`, `visit_id`, `vid`) could ever have matched.
- Rewrote it as a `$lookup` inside the `rows` facet, byte-identical to LAB: joined **after**
  `$skip`/`$limit` so only the visits on the page are read, `$expr: {$eq:['$vid.value','$$visit_id']}`,
  newest first by `updated_at`/`created_at`, `$limit: 1`, and `primary_dx` kept raw.
- The projection now carries `_diagnosis_visit_id: '$order.xparentx'` **without** `$toString` —
  the join compares against a stored value, so converting it would break the type match. Both it
  and `diagnosis_record` are stripped before the rows leave the server.
- Form: `diagnosisText` is back to the LAB one-liner. `s.text` picks `label` and falls back to
  `value`, so a diagnosis with no name still shows its ICD code instead of nothing.
- Removed the `sdformGetAll` probe, its constants, and the `diagnosis_link_field`/`diagnosis_found`
  diagnostics — the path is no longer a guess, so there is nothing to report.
- The API test now asserts the real pipeline: collection name, the `vid.value` expression, the
  newest-wins sort, that the join comes after `$limit`, and that neither join field leaks to the
  client. Verified the X-ray and LAB `$lookup` blocks are textually identical.
- 6 X-ray suites pass, validator exit 0, `git diff --check` clean.

## [2026-09-01] note | X-ray dispatch: standalone MongoDB fix, one-item-per-send, item reject

- Root cause of "สถานะเปลี่ยนแต่ไม่มีเลข Accession": MongoDB is standalone, so
  `this.mongoTxn` threw on every call. `xray_accession_generate_api.js` and
  `xray_cpoe_dispatch_api.js` now carry the same `transactionUnsupported` fallback
  LAB already uses (`lab_no_generate_api.js`, `lab_cpoe_receive_api.js`).
- Dispatch is one item per call (`{order_id, item_id}`); more than one is refused,
  and an unspecified pick with several candidates is refused rather than guessed.
  The Form single-selects: ticking a new item releases the previous one.
- New `Form-Builder/API/api-factory/processes/xray_cpoe_reject_api.js` — item-level
  reject mirroring `Lab_Reject_Specimen.js`. Allowed only while `sent`; rejecting a
  dispatched item needs the RIS cancel contract (D-X9). Not deployed yet.
- Worklist API projects `rejected_at/by` and `reject_reason*`; accession generator
  now reads a plain-string `service_type` like dispatch and worklist already did.
- Docs: `spec.md` §4.2 rewritten, new §4.3.1 (standalone MongoDB) and §4.4 (reject);
  `design.md` records D-X21, D-X22, D-X23 and restates D-X9 as a blocker.
- 7 X-ray suites pass (new `test_xray_cpoe_reject_api.js`); SDForm validator exit 0.

## [2026-09-01] fix | LAB Reject uses the Worklist effective waiting status

- Runtime showed an Item as `รอรับ` and enabled selection, but Reject Process returned
  `ปฏิเสธได้เฉพาะ Item ที่อยู่ในสถานะรอรับ specimen`.
- Cause: Worklist normalizes legacy CPOE `accepted/prepared/ready/dispensed` to `sent` when no
  Work Item, LAB NO., or `received_at` proves receipt; `Lab_Reject_Specimen.js` still checked the
  stale CPOE status directly.
- Reject now applies the same effective-status rule. A real receipt stamp or LAB NO. remains
  fail-closed, and CPOE stays read-only.
- Reject API plus Worklist API/Form, Receive, and LAB NO. regression suites pass; `git diff
  --check` is clean. Re-paste Process `6a79ff46d5218a5b6a26bebc`; runtime UAT remains pending.

## [2026-09-01] note | X-ray: repair path for half-dispatched items

- The buggy build left real rows at `current_status = 'dispatched'` with no
  `accession_no`. Correct order issues the number first, so that state proves the
  dispatch never finished and RIS never saw the order — safe to resume.
- `xray_accession_generate_api.js` now issues a number for `sent` **or**
  `dispatched` (never `resulted`/`completed`/`cancelled`/`rejected`/`accepted`).
- `xray_cpoe_dispatch_api.js` treats `dispatched` + empty accession as a target and
  resumes without rewinding `current_status` or `dispatched_at`.
- Form shows `ค้าง · ยังไม่ได้เลข` plus a note, and lets the row be ticked again.
- Fixture `xray_accession_params.json`: `already_dispatched_item` replaced by
  `resulted_item` and `half_dispatched_item_repair`.
- All 7 X-ray suites pass; SDForm validator exit 0; `spec.md` §4.3.1 documents it.

## [2026-09-01] note | X-ray: status bucket drift between API and Form

- Runtime refusal "รายการที่เลือกไม่อยู่ในสถานะที่ส่งเข้าเครื่องได้" on a row the Form
  had allowed. Cause: the API tested `current_status === 'dispatched'` literally while
  the Form's `s.itemState` grouped the whole received bucket, so a CPOE row stored as
  `accepted` (or any other active status) could be ticked but never sent.
- Both Processes now use `RECEIVED_STATUSES = [accepted, prepared, ready, dispensed,
  dispatched, in_progress]`, which must equal the worklist `active` bucket minus `sent`.
- `test_xray_cpoe_dispatch_api.js` reads all three sources and fails on any drift;
  verified by temporarily removing one status and watching it fail.
- Refusals now report the real `current_status`, `accession_no`, and `transport_status`
  instead of a bare sentence, in both Processes.
- `needsAccession` in the Form also requires no delivered transport, so a completed
  item can never be offered for repair.
- Accession repair covers the whole received bucket; `resulted`/`completed`/`cancelled`/
  `rejected`/`returned`/`reversed` stay forbidden and the message names the status.
- All 7 X-ray suites pass; SDForm validator exit 0.

## [2026-09-01] implementation | LAB whole-Order cancellation write path

- Enabled `ยกเลิก order` in the LAB Worklist and added an in-page required-reason dialog.
  The Form calls `action=cancel_order` on existing Worklist Process
  `6a9434c3422c1ca959829d5e`; no new Process ID is required.
- Added canonical `zdata_lab_order_cancellation` record keyed by CPOE Order `_id`, with
  `pending/applied/conflict`, reason, actor, time, Sections and Item IDs. The Process cascades
  eligible Work Items to `cancelled`, preserves prior terminal Items and leaves CPOE read-only.
- A never-attempted Outbound is stopped through compare-and-set before its Work Item changes.
  Any attempted/sent Outbound returns `lis_cancel_required`; a race records `conflict` and fails
  closed so HIS cannot silently diverge from Agent/LIS.
- LAB NO., Receive, Reject, specimen correction and result actions now reject an active
  cancellation. Work Item gained hidden cancellation audit fields, and the Worklist projects
  the audit as generic reason/operator columns.
- Added direct cancellation API coverage for two-Item cascade, retry idempotency, preserved
  rejection, received/unsent Outbound, already-sent refusal, race conflict, result refusal,
  Section scope and mandatory reason. Six LAB regression suites pass; both changed SDForms pass
  the repository validator; `git diff --check` is clean. Builder/deployed runtime UAT remains.

## [2026-09-01] note | X-ray: RIS pre-flight, birth-date formats, real failure text

- Runtime progress: `SM20260901CT001` was issued and the receipt committed, so the
  standalone-MongoDB and status-bucket fixes hold. Only the RIS call still failed.
- `xray_cpoe_dispatch_api.js` now checks the team's 9 required fields before calling
  RIS and reports the gap in Thai with `missing_fields[]`, instead of sending a
  payload that is certain to come back `AE Missing required field(s)`.
- `RIS_REQUIRED_FIELDS` is compared against `required` in the team's
  `xray_api_order.js` by `test_xray_cpoe_dispatch_api.js` on every run.
- `toIsoDate` accepts `YYYY-MM-DD`, `YYYY/MM/DD`, `DD/MM/YYYY`, `YYYYMMDD`, and an
  ISO `T` suffix, with Buddhist-year conversion. Unreadable dates still stop the send.
- The Form shows the real `transport.message`; the canned
  "ส่งเครื่องไม่สำเร็จ · ลองใหม่ได้" line is gone at the user's request.
- All 7 X-ray suites pass; SDForm validator exit 0.

## [2026-09-01] implementation | LAB cancelled-row retest mock

- Cancelled/rejected LAB Order rows now hide PDF and EMR and show `ตรวจใหม่` instead,
  including when those rows appear in the all-status list.
- `ตรวจใหม่` is deliberately notification-only until its Write API exists. It does not call
  an API or change CPOE/LAB state; its message preserves the agreed flow: create a linked new
  Order No., then generate LAB NO. only when specimen is received.
- The cancelled filter header changes from PDF/EMR to `ดำเนินการ`; active/result rows retain
  their existing PDF and EMR actions.
- Worklist Form tests, SDForm validation and `git diff --check` pass. Builder/runtime import
  remains pending.

## [2026-09-01] note | X-ray: order cancellation wired, mirroring LAB

- `ยกเลิก order` is live. Implemented as `action: 'cancel_order'` inside the existing
  worklist Process `6a957009422c1ca959829e45`, the same shape as
  `lab_cpoe_worklist_api.js`, so no new Process ID is needed.
- Reason is required free text in a dialog; no separate rejection form, unlike the
  per-item reject flow.
- Audit log `zdata_xray_order_cancellation` keyed by the order `_id`, so pressing twice
  is idempotent. Items change status by compare-and-set; a lost race stamps
  `cancel_status: 'conflict'` and blocks retries until someone checks.
- Boundary is the Accession No.: once issued, RIS may hold the order, so cancel returns
  `ris_cancel_required` and touches nothing (D-X9). Received-but-unnumbered items
  cancel normally. Terminal items keep their own reason and are counted as preserved.
- New `test_xray_cpoe_cancel_order_api.js`; the Form suite covers the dialog. All 8
  X-ray suites pass; SDForm validator exit 0.

## [2026-09-01] note | X-ray worklist: modality codes, multi-modality orders, cancelled-row buttons

- Modality cells now show the short code with the full name on hover, at order level,
  item level, and in the result tab. This reverses the earlier "show the full name"
  change at the user's request — the full text crowded out orders using two machines.
- `row.modalities[]` lists every distinct modality in the order, in item order. The
  summary row previously showed only the first item's machine, so an order holding
  CT + DX looked single-machine.
- Modality columns narrowed to code width: order 130→94px (grid min-width 1295→1259),
  item 130→78px (1142→1090). `.xr-modality-cell` wraps several tags.
- On a cancelled order, `ตรวจใหม่` replaces `EMR` in the row actions and the duplicate
  button in the detail bar is gone.
- Form tests updated, including a new case for a CT+DX order. All 8 X-ray suites pass;
  SDForm validator exit 0.

## [2026-09-01] note | X-ray: re-read the RIS contract, wrote the integration plan

- Read `xray_api_order.js` and all 72 fields of `xray_order.json`.
- Decisive finding: the contract is **outbound only**. No result, report, image, or
  study field exists anywhere — "PACS" appears once, in the AccessionNo description.
  The `Radiologist*` fields are the assigned reader sent with the order, not a result.
  D-X6 and D-X17 therefore need a second contract from the RIS team, not more work on
  this one.
- `zdata_xray_order` is current-state, not a log: AccessionNo is the only business key,
  found ⇒ update, so old messages are overwritten and AE-rejected ones are never stored.
- `xray_order_log.json` is byte-identical to `xray_order.json` (same md5). There is no
  separate log form; the filename is misleading.
- We send 23 of the 71 accepted fields; all 9 required ones are covered. Listed the
  five worth adding from data CPOE already holds.
- Also flagged: form requires 11 fields vs the API's 9; `sdformGetOne` looks up
  AccessionNo without an `xrstatx` filter; no unique index on the business key.
- Wrote `Form-Builder/SDForm/X-ray/ris-integration-plan.md` — 5 steps plus 7 questions
  to send the RIS team in one round. `design.md` D-X6/D-X17 updated to point at it.

## [2026-09-02] implementation | LAB order-request PDF Factory package

- Created SQL Factory export `LAB Order Request PDF v1` (`6a980d10422c1ca959829f10`) and
  Report Factory export `LAB Order Request v1` (`6a980d11422c1ca959829f11`), plus one-file
  ZIP packages and a step-by-step import/UAT guide.
- The SQL is scoped by required CPOE `order_id` and LAB `section_code`, filters active LAB
  Items, and keeps Order No. separate from LAB NO.; LAB NO. remains blank before receipt.
- The A4 portrait report includes hospital/LAB header, Order barcode, patient/order and
  specimen context, a four-column test table, and print audit footer. No source-image patient
  identifiers were copied into the artifacts.
- Replaced the Worklist's PDF mock with `<sd-report>` while preserving the rule that
  cancelled/rejected rows have no PDF or EMR and show notification-only `ตรวจใหม่`.
- Static binding/parameter contract, Worklist suite, SDForm validation and diff check pass.
  SQL Preview, Report Test, Builder/Preview and deployed runtime remain required after import.

## [2026-09-02] note | Corrected LAB report import to Clone-ID sequence

- User confirmed the new SQL/Report must use `Clone Data (Insert new id)` and reported the
  first package failed upload with `Format is invalid`.
- Root cause in the generated package: null creator/update metadata, non-backup filenames and
  preassigned invented SQL/Report IDs. Removed only those invalid generated JSON/ZIP artifacts.
- Rebuilt SQL from a real initCraft backup record, preserving the system's metadata and exact
  `backup-data_sql-factory_*` / `backup-data-module_sql-*` naming. The valid first-stage package
  is `backup-data_sql-factory_2026_09_02_08_00_00.zip`.
- Report generation now requires the SQL ID returned by Clone Data. Worklist generation likewise
  requires the Report ID returned by Report Clone; without it, PDF remains a pending mock and no
  invented ID is embedded. Static contracts, Worklist tests, SDForm validation and ZIP checks pass.

## [2026-09-02] note | X-ray: full RIS contract received, previous "outbound only" call corrected

- User uploaded the remaining forms and processes. The 2026-09-01 conclusion that the
  contract was outbound only was wrong — it was drawn from `xray_order` alone.
- Inbound exists on four routes, all keyed by `AccessionNo`:
  `xray_order_status_change` (`6a861d99f851000f28e44ab2`, Status A=Arrival/C=Completed,
  update only), `xray-api-ris-result` (`6a861de5f851000f28e44ab3` → `zdata_xray_result`),
  `xray_resultreset` (`6a95b6d8422c1ca959829e88`), `xray-api-ris-schedule`
  (`6a861e0bf851000f28e44ab4` → `zdata_xray_schedule`).
- D-X6 resolved: result is `ResultText` (one blob), `ResultDateTime`, `RadiologistUid`,
  `SeverityUid`, `ImageCapturedDateTime`. D-X9 half-resolved: `C` means Completed, not
  cancelled, so `IsDeleted: true` is the only cancel channel left. D-X17 still open —
  no StudyInstanceUid or PACS URL exists in any of the four forms.
- Defects to report to the team: the result endpoint inserts a new row every call and
  never verifies the accession exists; `xray_resultreset` may reset the wrong row when
  results are duplicated; the schedule endpoint still enforces the 13-digit PatientSsn
  and AdmissionNo rules that were relaxed for orders.
- Security: live public JWTs sit in the comment headers of four uploaded process files.
  They are untracked and must not be committed; flagged to the user.
- `ris-integration-plan.md` rewritten with the whole contract, 6 steps and 9 questions;
  `design.md` D-X6/D-X9/D-X17 updated.

## [2026-09-02] note | X-ray: results wired from zdata_xray_result, repeat exam reuses the accession

- Verdict for the user: the team's 5 processes and 4 forms need **no changes** for the
  goal "send the order out, receive the result". They are the RIS-facing boundary and
  landing tables; the missing piece was joining those collections back into our
  worklist, which is our work.
- `get_report` no longer queries the guessed `RESULT_ITEM_FORM_ID`. It reads
  `zdata_xray_result` by `AccessionNo`, sorts by `ResultDateTime`, takes the newest and
  returns `result_versions` so the screen can warn when several exist.
- The worklist pipeline `$lookup`s the latest result per item. Status "ออกผลแล้ว" is now
  derived: `ResultText` present and `ResultDateTime >= dispatched_at`. RIS never writes
  our CPOE item, so waiting on `current_status` would have stalled forever.
- Repeat exam: dispatch accepts an item that already has an accession and is not
  terminal, reuses the same number, moves `dispatched_at`, and records `resent_at` and
  `dispatch_count`. A resulted item returns to "รอผลอ่าน" automatically through the rule
  above. Cancelled/rejected items are still refused.
- Report dialog collapsed to one `ResultText` block; radiologist shows the raw
  `RadiologistUid` because no name mapping exists yet (open question 5).
- All 8 X-ray suites pass; SDForm validator exit 0. Plan and spec §4.6 updated.

## [2026-09-02] fix | Corrected LAB order-report NoQL compile syntax

- SQL Test for existing SQL `6a97754d422c1ca959829f96` returned `Query Error` with an empty
  `sql`, while the supplied Order/Section were independently confirmed to return two active Items.
- Replaced unsupported `SUBSTRING` with 1-indexed `SUBSTR` and scalar `IF(...)` with
  `CASE WHEN ... END`; added regression assertions for both parser hazards.
- Generated `backup-data_sql-factory_2026_09_02_08_10_00.zip` as a Restore Data (Upsert)
  package targeting the existing SQL ID, preserving its creation timestamp. The original Clone
  source was regenerated with the same syntax fixes.
- Static SQL contract and ZIP integrity checks pass. Runtime SQL Test must pass before generating
  or importing the Report Factory package.

## [2026-09-02] fix | Corrected SQL Factory ORDER BY and built LAB Report package

- The next SQL Test returned the rendered query and exposed the remaining deterministic fault:
  `ORDER BY undefined ASC, undefined ASC`.
- Read-only inspection of working `module_sql` records confirmed `sql_order_by` and
  `sql_options.orderBy` require `{column, sort}`; the builder had incorrectly emitted `{field, sort}`.
- Corrected both structures to sort by selected alias `row_no` and added a regression assertion
  forbidding `field` in order-by rows.
- Generated SQL Restore package `backup-data_sql-factory_2026_09_02_08_20_00.zip` for existing
  SQL ID `6a97754d422c1ca959829f96` and Report Clone package
  `backup-data_report-factory_2026_09_02_08_20_00.zip` bound to that SQL.
- Static SQL/Report contract and both ZIP integrity checks pass. Report import may proceed, but
  Preview and Worklist binding remain gated on a successful deployed SQL Test.

## [2026-09-02] fix | Rebuilt LAB report provider from exported NoSQL backup pattern

- User supplied `backup-data_sql-factory_2026_09_02_08_28_18.zip`; its working record uses
  NoSQL aggregate mode with `sql_select: []`, outputs in `sql_options.variable`, parameters in
  `sql_options.param`, and a serialized MongoDB pipeline.
- Replaced the fragile SQL-mode LAB provider definition with the same Factory-native shape.
  The 17-stage pipeline filters by Order/Section, joins Order/Master/Section/Work Item/Diagnosis,
  creates row numbers and projects every binding used by `LAB Order Request v1`.
- Set the provider temporarily public for UAT because Report Preview's data-provider request
  returned 403 while the provider was private; the Report remains private. Restrict both to LAB
  roles after UAT.
- Generated Restore package `backup-data_sql-factory_2026_09_02_08_30_00.zip` targeting existing
  SQL ID `6a97754d422c1ca959829f96`.
- Static contract and ZIP integrity pass. The exact pipeline was also executed read-only against
  the UAT Order/Section and returned two rows (`MS1-R`, `MS1`) with blank LAB NO., without
  returning patient-identifying fields in the check output.

## [2026-09-02] note | X-ray: effective_status keeps chips and rows in sync; UAT checklist written

- User supplied the deployed Form ID `6a953fb6422c1ca959829e14`; recorded in spec §0.
- Found before UAT: chips counted `current_status` while rows derived "ออกผลแล้ว" from
  the RIS result, so the first incoming report would have made the chip say
  "รอผลอ่าน" while the row said "ออกผลครบ" — the same family as the draft bug.
- The pipeline now computes `effective_status` (result present and `ResultDateTime`
  not older than `dispatched_at`, compared with `$dateFromString`/`onError: null`) and
  uses it for the `statuses[]` filter, the chip `bucket`, and the item payload. A test
  forbids `'items.current_status'` from appearing in the pipeline again.
- Wrote `Form-Builder/SDForm/X-ray/uat-checklist.md`: T0–T8 with expected results,
  including a recipe to simulate RIS by calling the team's public result endpoint over
  GET so the result path can be proven without waiting for them.
- All 8 X-ray suites pass; SDForm validator exit 0.

## [2026-09-02] note | X-ray: default date scope no longer hides unfinished work

- Reported symptom "รายการหายไปไหนหมด" with all four chips at 0 and the API still
  answering success. Cause was not a regression: the default scope is `status_date =
  today`, the clock rolled over to 2026-09-02, and every test order was stamped
  2026-09-01. The filter sits before `$facet`, so the chips zeroed out too.
- Fixed the underlying behaviour rather than only explaining it: when the scope is
  defaulted the match is now `status_date = today OR bucket = 'active'`, so an order
  placed yesterday and not yet imaged stays on screen. An explicit Date Range is still
  honoured exactly and never smuggles the backlog back in.
- `date_scope.include_backlog` is returned and the summary line reads
  "วันนี้ + งานค้างทุกวัน (ค่าเริ่มต้น)" so the user is not surprised by yesterday's rows.
- Tests cover both branches; UAT checklist T0 gained the backlog checks and a note to
  read the `ช่วงวันที่:` line first whenever the screen looks empty.
- All 8 X-ray suites pass; SDForm validator exit 0.

## [2026-09-02] schema | Rule 14: never break what already works

- User set a standing rule after repeatedly having to circle back and re-fix parts that
  already worked: check what is already correct before editing, keep changes additive,
  and never hand back new work with an old function missing.
- Added `CLAUDE.md` §14 (14a identify first · 14b a passing test is a contract, never
  weaken an assertion to make new work pass · 14c prove the old behaviour survived ·
  14d ask before changing confirmed behaviour or removing anything · 14e docs and Hot
  Cache are covered too) and a §11 quick-reference row pointing at it.
- Saved the same rule to memory as `never-break-what-already-works` so it carries across
  conversations.
- Applied it retroactively: ran every suite in `Form-Builder/API/tests-tools/tests/`.
  19 pass, 10 fail — all 10 fail with ENOENT on fixtures/sources that do not exist in
  the repo (`Lab_Biochem_initCraft_import.json`, `specimen-collection-status-api.js`,
  `agent-to-his-result.schema.json`, and similar). They fail before any assertion runs,
  are all LAB-side, and are untouched by this session's X-ray work — pre-existing, not
  regressions. Recording them here so nobody re-diagnoses them later.

## [2026-09-02] fix | Restyled LAB Order Report and prepared in-place Restore

- User confirmed the NoSQL provider now returns the expected LAB items, so the working
  SQL ID `6a97754d422c1ca959829f96` and its pipeline were preserved unchanged.
- Compared the current Preview with the supplied paper reference: removed all boxed
  grids from the patient/specimen header, compacted typography and spacing, moved the
  Order barcode to the right, widened A4 side margins, and reduced item-table widths to
  prevent overflow. The LAB item table remains the only true grid.
- Added a Report Restore builder and regression checks for the existing Report ID,
  SQL binding, borderless header blocks, barcode alignment, page margins, and columns.
- Generated `backup-data_report-factory_2026_09_02_08_50_00.zip` targeting Report ID
  `6a977ac8422c1ca959829f97`; import with **Restore Data (Upsert)**, not Clone Data.
- Static contract, JSON identity/binding assertions, ZIP integrity, and `git diff --check`
  pass. initCraft Report Preview is still required for renderer-level visual confirmation.

## [2026-09-02] fix | Added hospital logo and enlarged LAB Report typography

- Preview proved the borderless layout and item grid render correctly, but also showed
  duplicated hospital/report titles beneath the newly inserted hospital logo and text
  that was too small at 100% zoom.
- Added the supplied hospital logo as a centered `image` widget at `250 × 63`. Replaced
  the former three-column header with exactly two borderless columns: Section at left
  and Order No./date/time at right; removed the duplicated middle title completely.
- Raised the patient/specimen font to 12, item table to 11, footer to 10, and overall
  Report font to 12 while preserving A4 margins, barcode, SQL provider and bindings.
- Generated `backup-data_report-factory_2026_09_02_09_05_00.zip` for in-place Upsert of
  Report `6a977ac8422c1ca959829f97`. Static contract, identity/binding assertions, ZIP
  integrity and diff whitespace checks pass; runtime Preview remains the visual gate.

## [2026-09-02] fix | Balanced LAB Report information blocks and matched visible type size

- The `09_05` Preview showed that initCraft renders HTML widget text visibly smaller
  than table text even when the configured numeric sizes are close.
- Raised header/patient/specimen/footer HTML and widget font to 14 while retaining item
  table size 11; this deliberately compensates for the renderer so their visible sizes
  match instead of merely matching configuration numbers.
- Reflowed patient data from three uneven columns into a borderless `52/48` two-column
  block and aligned specimen data to the same rhythm, padding and line height. Logo,
  Section/Order header, barcode, item grid, bindings and SQL pipeline remain intact.
- Generated `backup-data_report-factory_2026_09_02_09_15_00.zip` for Upsert of the same
  Report ID. Static contract, JSON identity/binding/layout assertions, ZIP integrity and
  diff whitespace checks pass; runtime Preview is still required for final visual proof.

## [2026-09-02] fix | Connected Worklist PDF with Order and EMR Visit scope

- Bound verified Report `6a977ac8422c1ca959829f97` into active LAB Worklist rows;
  cancelled/rejected rows still hide PDF/EMR and show the mock `ตรวจใหม่` action.
- Added a shared `orderVisitId()` helper used by both PDF and EMR. PDF now supplies
  `order_id`, `visit_id`, `section_code`, printer and print time; missing Order/Visit/
  Section disables the button instead of rendering an unscoped report.
- Extended the existing NoSQL provider and Report parameters with required `visit_id`.
  The pipeline compares it with stringified `order.xparentx`, so data must match exact
  Order + Visit + Section. Read-only inspection confirmed the test Order has a distinct
  Visit record ID and displayed VN, matching the Worklist/EMR contract.
- Generated SQL and Report Restore packages `09_30_00` for their existing IDs and
  regenerated the existing Worklist JSON. Report/worklist suites, SDForm validator,
  JSON identity/parameter assertions, ZIP integrity and diff whitespace checks pass.

## [2026-09-02] note | X-ray dispatch: HTTP fallback to RIS, sturdier payload

- User asked to make the send work rather than wait on a test round-trip.
- Added a second route to RIS. `app.runProcess` stays primary; when it returns no ACK
  (notably `permissionDenied`) the process falls back to `app.axios.post` against the
  team's public endpoint, body wrapped as `{ params: payload }` because the gateway
  checks that property before the token. Safe to double-send: RIS upserts on
  `AccessionNo`. `item.transport.route` records which path delivered.
- `app.axios` is the runtime's proven HTTP client — copied the idiom from the deployed
  `lab_agent_order_submit_api.js`.
- `RIS_ORDER_PUBLIC_TOKEN` stays empty in the repo and is filled in API Factory only.
  With it empty the fallback is skipped and the failure message names the constant.
- Payload hardening: `firstText()` tries every field name the CPOE snapshot is known to
  use for HN, name, DOB, VN and gender. Added the optional fields we already hold —
  `ReferenceUnitName`, `InsuranceTypeDesc`, `MessageControlId`, and the referring
  doctor split, but only when the source is a structured object; a plain string still
  goes whole into `ReferringDoctorFName` exactly as before.
- Per §14b the old "no environment URL" assertion was narrowed rather than deleted: the
  file may now hold exactly one URL, must still contain no JWT, must keep the token
  constant empty, and must keep `runProcess` ahead of `app.axios.post`.
- All 8 X-ray suites pass; SDForm validator exit 0. Nothing in the worklist or form changed.

## [2026-09-02] note | X-ray: modality filter is multi-select with a per-option clear

- User parked the RIS transport blocker and moved to UI flow.
- The modality dropdown now accepts several machines at once. `s.modality` holds an
  array of codes; empty means no filter, which is exactly what the old "Select all"
  option did, so that option was replaced by `clearable` + placeholder rather than
  dropped. Each picked machine also carries a small ✕ at the right of its dropdown row
  (`unpickModality`) to remove it one at a time; the count sits to its left inside a
  shared `.xr-opt-right` box so the order does not depend on float direction.
- Client-side matching now compares against **every** modality in the order, not the
  first item's, so a CT+DX order matches either filter.
- API `params.modality` takes an array, CSV, or a single value via `listText` and
  filters with `{ modality_codes: { $in: [...] } }`. `data.modality` keeps its old shape
  for existing callers (a single pick returns the same string); `data.modality_codes`
  is added as the precise array.
- `modality_counts` is still unfiltered, so the dropdown keeps every machine and its
  count after several are picked.
- Tests: single-pick behaviour kept intact and extended with multi-pick, duplicate and
  empty-value handling, per-option removal, removal of an unpicked machine (no refetch),
  and a bare-string call for old callers. The new block restores `['CT']` so the
  following test is untouched. All 8 X-ray suites pass; validator exit 0.

## [2026-09-02] note | X-ray modality filter: drop the per-option ✕, one tag then +N

- User confirmed clicking a picked row already deselects it, so the per-option ✕ was
  redundant and asked for it removed. Template and `.xr-opt-clear` styles are gone; the
  `.xr-opt-count` rule is back to exactly its original form.
- `s.unpickModality` is kept as the explicit single-remove path (used by `clearModality`
  and still covered by tests). Per §14d a working method is not deleted just because its
  button went away; a comment records why it has no caller in the template.
- Selection box is one line again: `:max-collapse-tags="1"` shows only the first machine
  then `+N`, with `flex-wrap:nowrap` and a 118px ellipsis on the tag so a long name like
  "DX-Digital Radiography" clips instead of pushing the toolbar taller. Both the old
  `.el-select__tags` and the newer `.el-select__selection` class names are covered.
- Form tests swapped the ✕ assertions for the new ones and added guards that the clear
  icon and its CSS are gone while the method survives. All 8 X-ray suites pass;
  validator exit 0. No API change this round.

## [2026-09-02] note | X-ray worklist table: drop status-time column, always-open results tab, no item tooltip

- Removed the order-level `เวลาสถานะ` column at the user's request; the item table
  already carries `เวลาส่งเข้าเครื่อง`. Nine columns now, `min-width` 1259 → 1149.
  `s.statusTime()` and `row.status_time_*` are deliberately kept: the same value is the
  axis the API filters Date Range on (`status_date`), and restoring the column is one
  cell. A test asserts the calculation survives while the cell is gone.
- The `ผลอ่าน` tab is no longer disabled when an order has no result, so the table
  design can be reviewed; every item shows as `รอผลอ่าน`. Its title now reads
  "ยังไม่มีผลอ่าน — เปิดดูโครงตารางได้".
- Dropped the hover tooltip on item rows and their checkboxes (`:title="item.select_hint"`).
  The `select_hint` text stays in the row data and keeps its tests.
- All 8 X-ray suites pass; validator exit 0. No API change.

## [2026-09-02] note | X-ray: result tab reworked; LAB widget leak into the X-ray form fixed

- Buttons moved to item level as the user asked: the order row now carries only EMR
  (or ตรวจใหม่ when cancelled); ดูผล, ดูภาพ and PDF live on each result row.
  `row.can_pdf` and `row.first_result_item` are kept, just no longer rendered.
- Result table is now `ลำดับ · รายการตรวจ · เครื่อง · ผู้ส่ง · เวลาออกผล · สถานะ · actions`
  (min-width 948 → 1020). Its status uses the full item vocabulary instead of only
  รอผลอ่าน/ออกผลแล้ว, because dispatch is one item at a time and items in the same order
  sit at different stages. ดูผล/ดูภาพ are always clickable; PDF unlocks once a result exists.
- Report dialog gained a ผู้รับรองผล input. It is screen-only and says so; no fake save
  button, because where it is stored and who may certify is still undecided.
- **Found and fixed a real leak**: the generator clones the whole LAB worklist file, so
  the `scan-code-ui` "Scan HN" widget LAB added in `83ae7b2` appeared at the root of the
  X-ray form, unwired. The generator now keeps only its own container
  (`form.fields = [grid]`). The pre-existing `form.fields.length === 1` assertion is what
  caught it — kept and reinforced with a guard that no `scan-code-ui` may ride along.
- All 8 X-ray suites pass; validator back to 2 widgets. No API change.

## [2026-09-02] note | X-ray: HN barcode scan added, empty Diagnosis shows only the label

- `Diagnosis: รอเชื่อม EMR` is now just `Diagnosis:` when the patient has none. The old
  placeholder implied EMR was not connected when it is; the patient simply has no
  diagnosis recorded. Matches LAB.
- Added HN barcode scanning with LAB's pattern, studied from
  `update_lab_cpoe_worklist_ui.js` and `lab-cpoe-worklist-waiting-v1.json`: root-level
  `scan-code-ui` (document target, Enter suffix, min 6, preset both), but with X-ray's
  own id `scan-code-ui-xray-hn` and an `onScan` that hands the digits to
  `xray_cpoe_worklist.scanPatientHn`. An open popup blocks patient switching.
- Scan mode sends only `hn` (plus any modality filter) and drops the keyword and date
  range, so the API's `hn` branch lifts the default date scope and the whole history for
  that patient loads. Dates are dropped for chip counts too — otherwise chips and rows
  would disagree again. The Date Range picker is disabled while scanning.
- The scanned HN survives status-tab changes and clears via `ล้าง HN ที่สแกน` or Search.
  Scanning never changes status, issues an accession, or dispatches.
- The generator now builds the scanner deliberately after stripping LAB's root fields;
  the root guard was tightened rather than relaxed: exactly the container plus
  `scan-code-ui-xray-hn`, and no LAB ids may appear.
- Caught a real escaping bug while testing: `\D` inside the generator's template literal
  collapsed to `D`, so the HN digit filter did nothing. Fixed and covered by a test that
  scans `HN-690-0002` and expects `6900002`.
- All 8 X-ray suites pass; validator ✅ (3 widgets, with the same two root-placement
  warnings LAB accepts). No API change.

## [2026-09-02] note | X-ray scan: Thai keyboard layout handled before it ships

- The LAB Hot Cache records a runtime finding: a barcode scanner types like a keyboard,
  so when the machine is left in Thai mode HN `6900001` arrives as `ุตจจจจๅ`. X-ray had
  copied the plain `\D` strip, which would have reduced that to an empty string and
  reported an invalid HN on every scan with no way to guess why.
- `normalizeScanDigits()` maps the Kedmanee number row back
  (`ๅ / - ภ ถ ุ ึ ค ต จ` → `1234567890`) and only fires when a Thai character is actually
  present, so a `-` or `/` inside an ordinary ASCII barcode is never rewritten.
- `onScan` now hands the raw value over and the widget owns normalisation plus the
  length check, so the two places cannot diverge on what counts as valid. The rejection
  message quotes what was actually read.
- Dropped the redundant `คง HN ไว้เมื่อเปลี่ยนแท็บสถานะ` line from the scan banner, the
  same simplification LAB reached.
- Tests cover the Thai scan, the ASCII passthrough, and the short-code rejection.
  All 8 X-ray suites pass; validator ✅.

## [2026-09-02] note | X-ray: test NoQL for listing a patient's X-ray items by HN

- User asked for a SQL to test with, scoped to HN plus the X-ray items.
- SQL Factory here stores NoQL aggregate pipelines with `{{param}}` placeholders; copied
  the shape from the LAB export `backup-data-module_sql-Earn_admin-2026_09_02_09_30_00`.
- Wrote `Form-Builder/SDForm/X-ray/sql/xray-hn-items.nosql.json` (14 stages, one
  parameter `{{hn}}`) plus a README with the SQL Factory field values, the variable list
  and the column meanings.
- The pipeline mirrors the worklist API's own resolution so results match the screen:
  both `service_type` shapes, both order links (`order_id.value` / `xparentx`), the
  modality fallback chain, and the newest `zdata_xray_result` row by `ResultDateTime`.
- Dry-ran the logic on sample data: a LAB item, another HN and a soft-deleted row are all
  excluded, leaving the two expected X-ray rows.
- Flagged the exact-match caveat: if the DB stores `0006900002` while the scanner yields
  `6900002` nothing matches — running the SQL with both values is the quickest way to
  settle whether the scan needs zero padding.
- No form or API change; nothing to re-import.

## [2026-09-02] implementation | X-ray Order Request PDF — SQL Factory + Report Factory

- ผู้ใช้ขอชุด SQL ที่ import ได้เลย + ใบสั่งตรวจ PDF + Report ของ X-ray ตาม pattern
  เดียวกับ LAB แต่ไม่มี specimen
- สร้าง `Form-Builder/API/report_factory/builders/build_xray_order_request_report.js`
  ลอกโครงจาก `build_lab_order_request_report.js` ทั้งดุ้น ไม่ได้แตะไฟล์ LAB
- SQL `X-ray Order Request PDF v1` — nosql/aggregate 17 stage บน `zdata_cpoe_order_item`,
  31 variables, 4 parameters (`order_id`, `visit_id`, `printed_by`, `printed_at`)
- **ตัด `section_code` ออกจาก scope** เพราะงานรังสีไม่ได้แบ่งย่อยด้วย `zdata_section`
  แบบ LAB (ยืนยันจาก `xray_cpoe_worklist_api.js`) — section ยังคำนวณและพิมพ์อยู่แต่
  เป็นข้อมูลแสดงผล ไม่ใช่ตัวกรอง master ที่ไม่ผูก section จึงไม่ทำให้รายการหายจากใบ
- `lab_no` → `accession_no`, ตัด `zdata_lab_work_item` และตัวแปร specimen ทั้ง 6 ตัวออก,
  เพิ่ม `gender_display`, `priority_display`, `order_note`, `modality_code`,
  `modality_display`, `body_part`, `item_status`
- modality ไล่ fallback ชุดเดียวกับ worklist API เป๊ะ (`master.xray_item.modality` →
  `.modality_type` → `section.modality_type`) มี test ล็อก enum 11 ค่าไม่ให้ drift
- Report `X-ray Order Request v1` — A4 portrait โครงเดียวกับใบ LAB (โลโก้ 250×63,
  หัว 58/42, บาร์โค้ด order, บล็อกผู้ป่วย 52/48, HTML 14 / ตาราง 11) เปลี่ยนบล็อก
  specimen เป็น exam_info และตารางเป็น 5 คอลัมน์ `#`/`Accession No.`/`รายการตรวจ`/
  `เครื่อง`/`ตำแหน่ง`
- แพ็กเกจพร้อม import: `02-his/sql-factory/exports/backup-data_sql-factory_2026_09_02_16_00_00.zip`
  และ `02-his/report_factory/exports/backup-data_report-factory_2026_09_02_16_10_00.zip`
  ตั้ง ID ล่วงหน้า `6a98a1c0…a1c0` (SQL) / `6a98a1c1…a1c1` (Report) ให้ Report ผูก
  Data Source ไว้แล้ว ถ้า Clone Data ออก ID ใหม่ก็แค่เลือก dropdown เองหรือ regenerate
- test ใหม่ `test_xray_order_request_report.js` ผ่าน · test LAB เดิมยังผ่าน ·
  `test_result_report_viewer_manual_lis.js` แดงมาก่อนแล้วเพราะ fixture path หาย ไม่เกี่ยวกัน
- **ยังไม่แตะ `xray-cpoe-worklist-v1.json`** — ปุ่มบนฟอร์มยังเป็น `notifyPending` เหมือนเดิม
  รอ Report ID จริงแล้วค่อยสั่งต่อ (เทียบเท่า Stage 3 ของ LAB)

## [2026-09-02] note | X-ray: SQL หา order_id/visit_id จริงไว้เทส Report

- ผู้ใช้ขอ ID จริงไว้เทส แต่ในรีโปไม่มีข้อมูลจริงและเข้า DB ไม่ได้ จึงส่งเป็น "SQL ตัวหา" แทน
- `Form-Builder/SDForm/X-ray/sql/xray-order-visit-ids.nosql.json` — 11 stage ไม่มีพารามิเตอร์
  คืน X-ray order ล่าสุด 20 ใบ พร้อม `order_id`, `visit_id`, `order_number`, `hn`,
  `patient_name`, `item_count`, `accession_count`, `item_codes`
- คำนวณ `_order_key`/`_visit_key` ด้วยนิพจน์เดียวกับ `X-ray Order Request PDF v1` เป๊ะ ๆ
  เพิ่ม assertion ใน `test_xray_order_request_report.js` เทียบ JSON ของนิพจน์สองที่ให้ตรงกัน
  เลขที่ก็อปจากตารางนี้จึงแมตช์ Report แน่นอน ไม่ใช่แค่ "น่าจะตรง"
- เขียน `Form-Builder/SDForm/X-ray/sql/README.md` ใหม่ (ยังไม่เคยมี) คุมทั้งไฟล์นี้และ
  `xray-hn-test.nosql.json` — ค่าที่ต้องกรอกใน SQL Factory, ความหมายรายคอลัมน์,
  ขั้นตอนเทส Report และกับดัก VN vs Visit record ID
- test X-ray และ LAB ผ่านทั้งคู่ ไม่ได้แตะฟอร์มหรือแพ็กเกจ import ที่ส่งไปแล้ว

## [2026-09-02] note | X-ray: SQL หา ID คืน 0 แถวทั้งที่หน้าจอมี 6 ใบ

- ผู้ใช้ส่งภาพหน้า X-ray Workbench ที่แสดง 6 order (R2609020004 … R2608310003)
  แล้วถามว่าทำไม SQL ไม่เจอ
- ตรวจ `xray_cpoe_worklist_api.js` ที่ทำงานได้จริง: ด่านแรกคือ `xrstatx $nin [0,3]` +
  `service_type.value = 'xray'` + `current_status $in statusVocabulary` — pipeline ที่ส่งไป
  ใช้สองเงื่อนไขแรกและไม่กรอง `current_status` จึงเป็น superset ตรรกะไม่ผิด
  แปลว่าสาเหตุอยู่ที่สภาพแวดล้อมของ SQL Factory ไม่ใช่ตัว pipeline
- เพิ่มสองไฟล์ใน `Form-Builder/SDForm/X-ray/sql/`:
  - `xray-order-ids-by-number.nosql.json` — อ่าน `zdata_cpoe_order` ตรง ๆ พารามิเตอร์
    `order_number` (เลขที่อ่านได้จากหน้าจอ) คืน `order_id` + `visit_id` ทันที
    ไม่ต้อง `$lookup` และไม่พึ่ง `service_type` เลย
  - `xray-diagnose-service-type.nosql.json` — group ตามค่า `service_type` ที่มีจริง
    พร้อม `items` / `alive_items` / `with_accession` แยกสี่กรณี: มองไม่เห็นคอลเลกชัน ·
    สะกดต่าง · โดน `xrstatx` · หรือลืมประกาศ Variables (กรณีที่น่าจะเป็นที่สุด)
- test ล็อกเพิ่ม: `visit_id` ของไฟล์ by-number ต้องเท่ากับ `_visit_key` ของ Report
  ที่ถอด `$_order.` ออก และ `order_id` ต้องเป็น `_id` ตัวที่ Report `$lookup` ด้วย
  `order_id.value` → `_id` · X-ray และ LAB test ผ่านทั้งคู่
- README ของโฟลเดอร์ sql อัปเดตครบสี่ไฟล์ พร้อมตารางอ่านผลวินิจฉัย

## [2026-09-02] note | ทำไม LAB SQL เรียกได้แต่ pipeline X-ray ที่วางมือแล้วว่าง

- ผู้ใช้ถามว่า LAB กับ X-ray ต่างกันตรงไหน ในเมื่อดึงจาก `CPOE Order Item` เหมือนกัน
- เทียบเรกคอร์ดจริงสองตัว (`...09_30_00.json` กับ `...16_00_00.json`): `sql_type`,
  `nosql_type`, `sql_from`, `nosql_collections`, `sql_form_id`, `sql_share`, `sql_select`
  **เท่ากันทุกช่อง** — LAB-vs-X-ray จึงไม่ใช่ตัวแปร
- ตัวแปรจริงคือ **import จาก ZIP vs สร้างเรกคอร์ดแล้ววาง pipeline เอง** ของที่ import มา
  พร้อม `sql_options.variable` (LAB 29 / X-ray 31) และ `param` ครบ ส่วนของที่วางเองว่างหมด
- `sql_options.variable` เป็นตัวกำหนดคอลัมน์ที่ตารางผลจะโชว์ ไม่ประกาศ = ตารางว่าง
  ทั้งที่ aggregate คืนแถวมาจริง อาการเลยเหมือน "ไม่มีข้อมูล"
- เตือนไว้ด้วยว่า `xray-diagnose-service-type` ก็ต้องประกาศ 4 variable ของมันเอง
  ไม่งั้นตัววินิจฉัยจะให้ผลลวงแบบเดียวกัน
- เขียนหัวข้อใหม่ใน `Form-Builder/SDForm/X-ray/sql/README.md` ไม่ได้แก้ pipeline หรือแพ็กเกจใด

## [2026-09-02] implementation | X-ray Order ID Finder v1 — ตัวหา ID แบบ import ได้

- ผู้ใช้ import แพ็กเกจ SQL/Report ของใบสั่งตรวจ X-ray เข้าไปแล้ว เหลือแค่ยังไม่มี
  `order_id` + `visit_id` ไว้เทส
- แทนที่จะให้วาง pipeline เองอีก (ซึ่งพาไปเจอกับดัก Variables ว่างรอบก่อน) แพ็กมาเป็น
  ZIP ตัวที่สาม `02-his/sql-factory/exports/backup-data_sql-factory_2026_09_02_16_40_00.zip`
  variables 10 ชื่อและ parameter `order_number` มาพร้อมในไฟล์
- `X-ray Order ID Finder v1` (`6a98a1c2422c1ca95982a1c2`) อ่าน **`zdata_cpoe_order`** ตรง ๆ
  **ไม่พึ่ง `service_type`** จึงใช้ได้แม้ตอนที่ใบสั่งตรวจคืน 0 แถว
- `$lookup` กลับไป `zdata_cpoe_order_item` เพื่อนับ `item_count` / `xray_item_count` และ
  รวมค่า `service_type` ที่ item ใช้จริงเป็นคอลัมน์ `service_types` — ตัวหา ID จึงเป็น
  ตัววินิจฉัยการสะกด `service_type` ไปในตัว
- test เพิ่ม: `visit_id` ต้องเท่ากับ `_visit_key` ของ Report ที่ถอด `$_order.` ออก,
  `order_id` เป็น `_id`, from/collections ต้องเป็น `zdata_cpoe_order`, ห้ามมี
  `service_type.value:"xray"` ใน pipeline, และ artifact ต้องตรงกับ builder
- **ยืนยันว่าแพ็กเกจสองตัวที่ผู้ใช้ import ไปแล้วไม่เปลี่ยน** — เทียบ checksum ของ ZIP กับ
  JSON ที่ regenerate ใหม่แล้วเท่าเดิมทั้งคู่ · X-ray และ LAB test ผ่านทั้งคู่

## [2026-09-02] note | พักงาน LAB หลังแจ้งรูปแบบ callback ให้ Agent

- ผู้ใช้แจ้งฝั่ง Agent แล้วว่า callback ส่ง raw JSON แบบ
  `{ "params": { ...result fields..., "items": [...] } }` ไม่ใช่ form-data, JSON string
  หรือแยก request ตาม field และให้พักงาน LAB ไว้ที่จุดนี้
- Agent ทดสอบถึง `hl7_result_upsert` แล้ว แต่ผลเป็น inner `FORBIDDEN` เพราะ service account
  ยังไม่มี Process permission; auth มาก่อน schema validation จึงยังถือว่า payload ไม่ผ่าน E2E
- บันทึก flow ปัจจุบัน CPOE → LAB receive/Work Item/LAB NO./outbound → Agent/LIS →
  Receipt/Result Report/Result Item/Work Item และยืนยันว่า CPOE status sync ยังไม่มี
- งานค้าง: แก้ contract correction identity ตาม active reset, เพิ่ม CPOE Order Item
  `current_status` (`accepted`/`rejected`/`completed`) และ wire Receive/Reject/Cancel/Result,
  เปิดสิทธิ์ Agent แล้วทดสอบ final/corrected/cancelled/idempotency รวมทุก store
- จุดพักนี้แก้เฉพาะเอกสารสถานะ ไม่แก้ API/Form/schema/test และไม่ commit/push

## [2026-09-02] implementation | X-ray Report reimport bound to the live SQL clone

- Report Preview ว่างเพราะ Report clone อ้าง preset SQL ID
  `6a98a1c0422c1ca95982a1c0` ซึ่งไม่มีใน live DB; query จึงตอบ `Data not found`.
- ผู้ใช้ลบ Report clone เดิมแล้ว แต่คง SQL Factory clone จริง ID
  `6a97f46b422c1ca95982a03e` ไว้.
- สร้าง Report-only ZIP ใหม่
  `02-his/report_factory/exports/backup-data_report-factory_2026_09_02_17_15_00.zip`
  สำหรับ Clone Data (Insert new id), โดย `pdf_sql` ผูกกับ live SQL ID ข้างบนแล้ว.
- Report content/columns/parameters/layout เท่าเดิม; เปลี่ยนเฉพาะ Data Source,
  timestamps และคำอธิบายแพ็กเกจ. Static Report contract ผ่านและ ZIP มี JSON เดียว.

## [2026-09-02] note | X-ray corrected Report imported; stale clone identified

- Read-only live check found new Report `6a97f826422c1ca95982a048` active and correctly
  bound to live SQL `6a97f46b422c1ca95982a03e`.
- Old active Report `6a97f497422c1ca95982a03f` still binds the nonexistent preset SQL and is safe
  for the user to delete; older Report `6a97eadd422c1ca95982a029` and SQL
  `6a97eaba422c1ca95982a028` are already soft-deleted (`xrstatx:3`).
- Verified UAT pair remains Order `R2609020005`: order ID `6a97f15d422c1ca95982a032`,
  Visit record ID `6a97a644422c1ca959829fb1`; exact report SQL returns one row.

## [2026-09-02] implementation | Connected X-ray Order PDF to each Workbench Order

- Updated the generated `xray-cpoe-worklist-v1.json` to render an order-level `<sd-report>`
  bound to live Report `6a97f826422c1ca95982a048`, immediately before the Order's EMR action.
- The clicked row supplies `order_id`, EMR `visit_id`, `printed_by`, and Bangkok `printed_at`;
  missing Order/Visit scope fails closed as a disabled PDF with an explicit reason.
- Preserved the separate item-level result PDF and its result-complete guard. Cancelled Orders
  still hide PDF/EMR and show only `ตรวจใหม่`; the toolbar Report placeholder was not changed.
- Added static and runtime assertions for Report identity, params, readiness, fallback, and the
  item/result distinction. All 8 X-ray suites, the X-ray Report contract, and SDForm validator
  pass (validator retains expected root scanner/template warnings).
- Import target is the existing X-ray Workbench Form `6a953fb6422c1ca959829e14` via Restore
  Data (Upsert), never Clone. Builder/Preview and deployed runtime verification remain required.

## [2026-09-02] implementation | X-ray HN + Accession sticker PDF per item

- Added SQL package `X-ray HN Accession Sticker v1` ID `6a9803361d37716e015ff866`
  and Report package `X-ray HN Accession Sticker 23x2 cm v1` ID
  `6a9803367d0ca6f32465a4e6`; Report binds the preset SQL ID for Restore Data (Upsert).
- SQL scopes fail closed by `order_id + visit_id + item_id`, requires an active X-ray item
  with Accession No., joins Visit for patient identity/birth date, and returns at most one row.
- Report is custom landscape 651.9685 × 56.6929 pt (23 × 2 cm), uses `วันเกิด` instead of
  `DOB`, and lays out hospital/Accession, patient, birth date/age, print date/HN in four lines.
- Updated X-ray Workbench item table with a `สติ๊กเกอร์ HN` `<sd-report>` action. It is enabled
  only when Accession and Order/Visit/item scope are complete; cancelled/missing-accession items
  retain a disabled button with a reason. Existing order PDF and result PDF remain separate.
- Created two one-JSON import ZIPs at 18:10/18:20 and import handoff
  `02-his/handoff/xray-hn-accession-sticker-v1-import.md`; all require Restore Data, not Clone.
- Exact pipeline returned one row in a read-only live check. Ten X-ray/Report tests passed,
  SDForm validator passed with its two known warnings, ZIP integrity/checksums matched, and the
  rendered preview was one correctly sized unclipped page. Deployed Builder/Preview UAT remains.

## [2026-09-02] fix | Rebound X-ray sticker Report to live cloned SQL

- Runtime Preview returned `SQL not found`. Read-only inspection proved SQL import had cloned to
  `6a980809422c1ca95982a053` and Report to `6a980831422c1ca95982a054`, while the Report still
  referenced absent preset SQL ID `6a9803361d37716e015ff866`.
- Created Report-only Upsert package
  `02-his/report_factory/exports/backup-data_report-factory_2026_09_02_18_40_00.zip` using the
  existing live Report ID and binding it to the existing live SQL ID; no SQL reimport is needed.
- Updated X-ray Workbench generator/Form to call live Report ID `6a980831422c1ca95982a054` and
  refreshed the import handoff/spec. All 10 X-ray/Report tests, SDForm validator, ZIP integrity,
  checksum comparison, JSON parse, and `git diff --check` passed. Live Report Preview and Form
  Restore remain for the user.

## [2026-09-02] fix | Resized X-ray sticker and allowed printing before Accession

- User runtime evidence showed the 23 × 2 cm sticker split into two PDF pages and item buttons
  were disabled before Accession. Changed the live Report to 8.5 × 2 cm (240.9449 × 56.6929 pt),
  reduced margins/type to keep all four lines on one page, and retained `วันเกิด`.
- Removed the SQL requirement that `accession_no` be nonblank. Scope remains fail closed on
  `order_id + visit_id + item_id`, so blank Accession prints an empty value and a later number
  always comes from the exact clicked item.
- Updated Workbench item logic so every non-cancelled item with complete scope can open the
  sticker Report, regardless of Accession. Existing Order PDF and result-complete PDF guards
  were not changed.
- The screenshot also exposed `-27 วัน`; age calculation now adjusts incomplete calendar years
  and months before calculating days. Exact live read-only SQL verification returned a positive
  `22 ปี 3 เดือน 4 วัน` for that case.
- New live-ID Upsert ZIPs: SQL `...19_00_00.zip`, Report `...19_10_00.zip`; then Restore the
  existing Form. Ten X-ray/Report suites, SDForm validator, JSON/ZIP checks, and diff check pass.
  Local PDF preview is one page at the exact requested size and passed visual inspection.

## [2026-09-02] implementation | LAB syncs workflow status back to CPOE Items

- Verified the prior state before editing: `accepted` already existed in CPOE Order Item,
  while `rejected/completed` and every server-side CPOE Item transition were still missing.
- Added `rejected` (ปฏิเสธ) and `completed` (ออกผลแล้ว) to `current_status` only; the separate
  `status_stage.stage_status` option list was intentionally left unchanged.
- Receive compare-and-sets the source Item to `accepted`; item rejection and Worklist whole-Order
  cancellation set affected Items to `rejected`; Agent final/corrected sets `completed`, Agent
  cancelled sets `rejected`, and in-progress leaves the Item unchanged.
- Every write filters out terminal `completed/rejected`, re-reads after a lost race, and never
  writes the CPOE Order header. LAB Work Item remains the operational source of truth.
- Five focused LAB API suites pass, cancelled-result and terminal-preservation cases are covered,
  the CPOE SDForm validator exits 0, and `git diff --check` passes. Changes are local only;
  Process replacement, Form import, and cross-store runtime E2E remain pending.

## [2026-09-02] UAT fix | Temporarily opened LAB result callback to no-role callers

- Removed the active role guard from `hl7_result_upsert_api.js` on explicit user request so normal
  roles, `guest`, `roles: []`, and missing `userInfo` reach payload validation during UAT.
- Preserved both the original `app.isAuth()` guard and the intermediate guest-only exception in a
  source comment for restoration when the Agent has a proper service role.
- Updated callback regression coverage; invalid no-role calls return `INVALID_PAYLOAD`, not
  `FORBIDDEN`, without writing, and a valid no-role call persists the full mocked result chain.
- User reports CPOE Item options and all four earlier Process bodies are already live. The newly
  opened callback body must be pasted again, followed by Terminal auth smoke and controlled E2E
  before the Agent is told to retry. No live request was sent because no credential was supplied.

## [2026-09-02] UAT evidence | LAB callback blocked by invalid public token

- User Terminal tests did not reach `hl7_result_upsert`: `?token=` returned `Missing token header`,
  while placing the same token in `Authorization: Bearer` returned `Token not valid`.
- Both are gateway failures before Process execution, so they neither verify the open role guard
  nor write LAB data. The request syntax is now correct; the current public token is unusable.
- Generate a fresh public token after the latest Process Publish, send it as Bearer, and rerun the
  deliberately invalid payload. Only `INVALID_PAYLOAD` proves the callback was reached.

## [2026-09-02] UAT evidence | LAB public-link smoke did not prove Agent POST

- User generated a fresh public URL and reported opening it with `?token=` returned
  `API run success`; `hl7_result_upsert` returned inner `INVALID_PAYLOAD` with
  the expected required-field errors and no `FORBIDDEN`.
- Sending that same fresh public token via `Authorization: Bearer` returned `Token not valid`.
  For this current UAT link, retain the generated `?token=` URL rather than moving its token into
  the Bearer header. This supersedes the transport assumption from the earlier revoked token probe.
- This proves only that the browser/public-link path reached validation; it does not prove the
  headless Agent POST transport. Validation preceded Receipt creation, so the smoke wrote nothing.
- Next gate is a controlled valid UAT payload followed by Receipt, Report, Result Item, Work Item,
  and CPOE Item verification. Do not notify Agent to retry production-like results before that.

## [2026-09-02] read-only verification | Selected clean LAB result UAT case

- Read-only MongoDB inspection selected active received Work Item/CPOE Item
  `6a956902422c1ca959829e3c`: LAB NO. `106909010002`, HN `6900001`, Visit `6900206`,
  `C64 Ammonia`; CPOE Item is currently `sent`.
- No active Receipt, Result Report, or Result Item exists for LAB NO. `106909010002`, making it
  suitable for the first valid partial callback test.
- `selected_items_json` contains `item_code=C64` and `test_code=10C64EB`. Current callback chooses
  the first available ordered code (`item_code` before `test_code`), so the UAT `obs_code` must be
  `C64`. This does not resolve the production mapping contract.
- Inspection was read-only. No API request or database write was performed by Codex.

## [2026-09-02] read-only verification | Public token matches live Process metadata

- Process `6a8da8a6f851000f28e50299` is `api_share=public`; `api_token` is an object with
  `token_enable`, `token_code`, `token_uid`, and `token_user`.
- The user-supplied fresh token exactly matches stored `api_token.token_code`, is enabled, and is
  assigned to `guest`; no secret value was written to repository notes.
- Curl with query token returned `Missing token header`; Bearer and raw Authorization both returned
  `Token not valid`. The public share token is therefore not accepted for the required POST path,
  despite matching DB metadata. Stop token-shape probing: use the documented normal Process endpoint
  with a valid login/service JWT, or have the platform team repair public POST authentication.

## [2026-09-02] UAT evidence | Hospital VPN does not resolve public POST auth

- User connected the Mac to the hospital VPN and repeated the same deliberately invalid/no-write
  POST using the generated public query-token URL; gateway still returned `Missing token header`.
- DNS, TLS, routing, and server reachability are already working because the API gateway returns a
  structured 401 response. No additional Mac network setting is indicated by this evidence.
- The blocker remains gateway authentication: obtain a same-environment login/service JWT for the
  normal Process endpoint, or fix `/v1/process/public` POST token handling in the platform.

## [2026-09-03] note | LAB result callback auth parked with initCraft maintainer

- User explicitly parked the callback authentication issue while the initCraft maintainer fixes it.
- Added a visible P4 blocker to `design/lab-cpoe-integration-checklist.md` and refreshed the active
  handoff/Hot Cache with owner, evidence, stop condition, and restart test sequence.
- Do not keep changing the Process role guard, VPN, or token header/query forms while waiting.
- Resume only after the maintainer provides working public POST authentication or an official
  service-account JWT flow; then run invalid/no-write smoke before valid partial/final E2E.

## [2026-09-03] implementation | Revised X-ray Order Request PDF layout

- Updated the existing X-ray Order SQL/Report package without changing live identities:
  SQL `6a97f46b422c1ca95982a03e`, Report `6a97f826422c1ca95982a048`.
- New header uses the user-provided QSNICH logo at left, the three-line institute name centered,
  and Order/date/time plus barcode at right. Patient labels are now `ชื่อ`, `คลินิกที่ส่ง`,
  `วันที่`; Section is now `ประเภทการตรวจวินิจฉัย`.
- SQL now blanks legacy AN `0`/`0.0`, maps CPOE priority codes 1–5 to their Thai labels, and
  removes the parenthesized account/email portion from submitter/requester names.
- Table layout is `lightHorizontalLines`: row separators only, no vertical column borders.
- Built two Restore Data (Upsert) ZIPs dated `2026_09_03_00_45_00` (SQL) and
  `2026_09_03_00_50_00` (Report). Static contract, ZIP integrity, and a PHI-free one-page A4
  rendered preview pass. initCraft Report Preview after import remains the runtime gate.

## [2026-09-03] UAT adjustment | Matched X-ray header to the approved mock preview

- User runtime Preview showed the first revision still differed from the mock: the 190 pt barcode
  exceeded the Order-info column, the logo overlapped the X-ray unit label, institute text was too
  small, and the table header remained gray.
- Report-only revision keeps the 17/54/29 header grid, sets the logo to 54 × 76 pt, enlarges the
  institute heading to 20 with 15 pt supporting lines, sizes the barcode to the 154 pt right column
  at 32 pt high, and adds 12 pt before the X-ray unit label.
- Added an explicit five-cell `pdf_tb_header` with white fill while retaining
  `lightHorizontalLines`, so the header is white and vertical rules remain absent.
- Built Restore Data (Upsert) package `backup-data_report-factory_2026_09_03_09_10_00.zip` for
  existing Report `6a97f826422c1ca95982a048`; SQL is unchanged and must not be re-imported.
  Static contract, ZIP integrity, and the refreshed PHI-free one-page A4 preview pass. Live
  initCraft Preview remains the final gate.

## [2026-09-03] runtime hotfix | Removed custom X-ray PDF table header after Loading stall

- Runtime evidence at 09:07 showed the Workbench passed the clicked Order/Visit and print metadata
  to the correct SQL provider, then remained on `Loading...`; the failure is therefore in the
  client-side PDF build path rather than parameter dispatch.
- The only structural renderer change since the earlier loading Report was the nonempty custom
  `pdf_tb_header`. Removed it and restored renderer-generated column headers while preserving the
  latest logo, institute typography, barcode size/alignment, header grid, spacing, and
  `lightHorizontalLines` layout.
- Built Report-only Restore Data (Upsert) package
  `backup-data_report-factory_2026_09_03_09_20_00.zip` for existing Report
  `6a97f826422c1ca95982a048`, still bound to SQL `6a97f46b422c1ca95982a03e`.
  Static contract and ZIP integrity pass. Runtime confirmation after import and hard refresh remains;
  the standard renderer header background may return and will be addressed only after loading works.

## [2026-09-03] implementation | Matched X-ray Order PDF to user-adjusted Figma frame

- Used Figma frame `2974:72` on page `earn` as the source of truth and converted its 1123 × 794 px
  landscape layout to PDF points at 0.75 pt/px.
- Updated the existing Report to A4 landscape with 24 pt margins, a 23/54/23 header grid,
  81 × 112.5 pt logo, 28/18/18 px institute typography, 154 × 30 pt barcode, 51/49 patient and
  exam columns, and table widths 33/143/*/105/167 with horizontal rules only.
- Inspected the deployed `SdReport.vue` bundle and confirmed `pdf_tb_header` must be an array of
  rows. Replaced the prior flat five-cell array with one nested five-cell row, retaining a white
  custom header without the structure that caused the runtime Loading stall.
- Built Report-only Restore Data (Upsert) package
  `backup-data_report-factory_2026_09_03_10_35_00.zip` for Report
  `6a97f826422c1ca95982a048`, bound to unchanged SQL `6a97f46b422c1ca95982a03e`.
  Static contract, ZIP integrity, `pdfinfo`, and PHI-free one-page A4 landscape visual QA pass.
  Live initCraft PDF after Upsert and hard refresh remains the final runtime check.

## [2026-09-03] implementation | Matched LAB Order PDF to the X-ray Figma layout

- Ported Figma frame `2974:72` to the existing LAB Order Request Report while preserving all LAB
  bindings and the live SQL/Report identities. No LAB API, Worklist behavior, status, or Agent
  callback contract changed.
- The Report is now A4 landscape with 24 pt margins, the new 81 × 112.5 pt crest, three-line
  institute header, 154 × 30 pt barcode, 51/49 patient/specimen blocks, and 16 px detail text.
- Retained the LAB-specific four-column table (`#`, `Lab Number`, `รายการตรวจ`, `Specimen`) at
  widths 33/143/*/167. Its white custom header is one nested row, matching `SdReport.vue`, with
  `lightHorizontalLines` and no vertical borders.
- Built Report-only Restore Data (Upsert) package
  `backup-data_report-factory_2026_09_03_10_50_00.zip` for Report
  `6a977ac8422c1ca959829f97`, still bound to SQL `6a97754d422c1ca959829f96`.
  Static contract, ZIP integrity, `pdfinfo`, and PHI-free one-page visual QA pass; live initCraft
  Preview remains the final gate.

## [2026-09-03] runtime calibration | Corrected LAB Report scale against live initCraft PDF

- User runtime screenshot at 11:09 showed the 10:50 LAB Report materially smaller and tighter than
  Figma despite the local preview. Normalized the live PDF page and Figma frame `2974:72` to the
  same 1123 × 794 coordinate space before revising values.
- Deployed `SdReport.vue` confirms HTML conversion ignores `line-height` and `font-family`; the
  runtime uses THSarabun rather than Figma Sarabun. Replaced ineffective line-height assumptions
  with renderer-calibrated font sizes, cell padding, margins, and block offsets.
- Enlarged/repositioned the institute header, order info, unit, patient/specimen text, table, and
  footer; constrained Diagnosis to the left column; adjusted the logo and barcode; retained the
  nested white horizontal-only four-column LAB table.
- Updated only SQL display projection to add gender, blank legacy AN `0`/`0.0`, and strip
  parenthesized account/email suffixes. No Worklist, Process, status, or Agent callback changed.
- Built SQL/Report Restore Data (Upsert) packages `...2026_09_03_11_25_00.zip` and
  `...2026_09_03_11_30_00.zip` for the existing IDs. Static contract, archive integrity, IDs,
  Data Source, and refreshed PHI-free one-page PDF preview pass; live runtime remains the final gate.

## [2026-09-03] scope correction | LAB runtime calibration is Report-only

- User clarified that the Figma change was layout-only. The SQL display normalization bundled in
  the 11:25/11:30 revision exceeded scope and must not be imported.
- Restored the report builder contract to the existing SQL aliases and removed the new gender
  binding plus AN/person-name projection changes. The visual calibration itself is unchanged.
- Built Report-only Restore Data (Upsert) package
  `backup-data_report-factory_2026_09_03_11_35_00.zip` for existing Report
  `6a977ac8422c1ca959829f97`, still bound to unchanged SQL `6a97754d422c1ca959829f96`.
  Static binding/identity checks, ZIP integrity, and the PHI-free one-page preview pass.

## [2026-09-03] runtime hotfix | Cleared LAB logo/title and barcode/date overlap

- Runtime screenshot at 11:38 showed barcode bars crossing the date/time and the LAB section title
  beginning before the enlarged logo ended.
- Changed only the Report barcode top margin from `-53` to `+2 pt`. Because subsequent Report
  content follows that widget, the same 55 pt correction places the barcode below the time and
  moves the LAB title/patient body below the logo without another independent offset.
- Built Report-only Upsert `backup-data_report-factory_2026_09_03_11_40_00.zip` for Report
  `6a977ac8422c1ca959829f97`; SQL `6a97754d422c1ca959829f96` remains unchanged.

## [2026-09-03] correction | Converted LAB Order Report to A4 portrait

- User confirmed the LAB report must be A4 portrait; earlier landscape packages are superseded.
- Reflowed the same three-part header into portrait width using 22/56/22 columns, a 62 × 86 pt
  logo, 26/17/17 px institute typography, 16 px order information, and a 104 × 22 pt barcode.
- Scaled the two-column detail blocks to 17 px and the four-column horizontal-rule table to 13 pt
  with portrait widths 26/104/*/120; SQL and every data binding remain unchanged.
- Built Report-only Upsert `backup-data_report-factory_2026_09_03_11_55_00.zip` for existing Report
  `6a977ac8422c1ca959829f97`. The PHI-free preview is one A4 portrait page with no overlaps.

## [2026-09-03] cleanup | Removed superseded Report/SQL exports from the workspace

- Inventoried export JSON identity and matching ZIP contents before cleanup. Kept the active pairs:
  LAB SQL 09:30 + Report 11:55, X-ray Order SQL 00:45 + Report 11:50, and HN Sticker SQL 19:00 +
  Report 19:10. Preserved Drug Label/original backups and the X-ray Order ID Finder.
- Moved 54 obsolete iteration files, including unused Clone IDs and superseded live-ID Upserts,
  to recoverable macOS Trash at
  `/Users/nichada/.Trash/initcraft-unused-report-sql-20260903-et8yD2`; no permanent deletion ran.
- Updated the X-ray Report test to validate only active Restore artifacts instead of requiring the
  removed Clone snapshots. LAB, X-ray Order, and HN Sticker Report tests plus all six active ZIP
  integrity checks pass after cleanup.

## [2026-09-03] implementation | Calibrated X-ray Order PDF to the Figma frame in the real renderer

- Decompiled the deployed `SdReport.vue` bundle and found why Figma-derived values did not
  reproduce: the PDF font is THSarabun (~1.5x narrower than the Figma face at equal pt),
  `html-to-pdfmake` is called with `ignoreStyles: ["line-height","font-family"]` so every CSS
  `line-height` was discarded, `<td>` padding is dropped entirely, and table body cells read
  `pdf_fontsize` rather than the table widget's `content_fontsize`.
- Rebuilt the same pipeline locally (pdfmake + html-to-pdfmake + THSarabun extracted from the
  live bundle) so the preview is the renderer, not a ReportLab approximation, then measured every
  row against Figma `2974:72` at one page scale and tuned until aligned.
- Report now uses 44/27/27 px institute text, 24 px detail blocks with real margins instead of
  line-height, 27 px section title, 18 pt table and footer, `pdf_fontsize` 18, logo 81 x 112.5 at
  mt 3.5, barcode 144 x 28 at mt -35.75, 53/47 detail columns, and left-column Diagnosis.
- Every row lands within +/-7 px of the frame; section title, Diagnosis, table header, table row
  and barcode are exact. Residual drift is pdfmake table row padding, not settable per record.
- Report ID, SQL binding, params, column widths, `lightHorizontalLines`, nested one-row
  `pdf_tb_header`, page size, orientation and margins are unchanged.
- Built Report-only Restore Data (Upsert) package
  `backup-data_report-factory_2026_09_03_11_50_00.zip` for Report `6a97f826422c1ca95982a048`,
  still bound to SQL `6a97f46b422c1ca95982a03e`. Static contract, ZIP integrity, one-page A4
  landscape `pdfinfo` and the updated regression test pass; live runtime remains the final gate.
- Updated `test_xray_order_request_report.js` typography assertions with dated reasons, kept every
  structural assertion, and added a guard that no block may rely on the ignored `line-height`.
- Open, not changed: LAB Order Report `6a977ac8422c1ca959829f97` still has `pdf_fontsize` 12 with
  an 18 pt white header, so its table rows render smaller than their own header.

## [2026-09-03] implementation | Switched X-ray Order PDF to A4 portrait, following LAB 11:55

- User confirmed A4 portrait as the required paper and pointed at the finished LAB package
  `backup-data_report-factory_2026_09_03_11_55_00.zip` (Report `6a977ac8422c1ca959829f97`) as the
  reference, so the X-ray Order Request now follows LAB rather than the landscape Figma frame.
- Ported LAB's portrait metrics verbatim: A4 portrait with 24 pt margins, logo 62 x 86 at ml 12 /
  mt 10, 22/56/22 header with 26/17/17 px institute text at content_mt -96, barcode 104 x 22 at
  mr 2, 19 px section title at mt 28, 17 px detail blocks with left-column Diagnosis, 13 pt table
  and 12 pt footer.
- Kept the X-ray-only parts: no specimen block, the exam_info block, five columns
  26/104/*/62/120 (#, Accession No. and ตำแหน่ง reuse LAB's widths; เครื่อง is X-ray-only),
  the เพศ field, and the four-parameter contract without section_code.
- Set pdf_fontsize 13 so table rows match their own white header; LAB still renders rows at 12
  under a 13 pt header.
- Rendered both packages through the same real pipeline and measured every shared row: header
  block, name, clinic, prior medication, both Diagnosis lines and the table data row land exactly
  on LAB's positions; the rest sit within 6 px, explained by different glyph heights.
- Report ID, SQL binding, params, form id, lightHorizontalLines and the nested one-row
  pdf_tb_header are unchanged.
- Built Report-only Restore Data (Upsert) package
  `backup-data_report-factory_2026_09_03_12_05_00.zip` for Report `6a97f826422c1ca95982a048`,
  still bound to SQL `6a97f46b422c1ca95982a03e`. Static contract, ZIP integrity, one-page A4
  portrait pdfinfo, and all report/X-ray regression suites pass; live runtime remains the gate.
- Updated the test's orientation, column-width, page-width and typography assertions with dated
  reasons; the landscape package `...11_50_00.zip` is retained for rollback.

## [2026-09-03] implementation | X-ray worklist — คอลัมน์สถานะระดับ order เป็นเช็คลิสต์

- ผู้ใช้ขอ: หน้าทั่วไป (ตารางรวมทุก order) เปลี่ยนคอลัมน์ `สถานะ` จากป้ายเดียวเป็นเช็คลิสต์
  4 ช่องคงที่ — รอรับ · ส่งเครื่องแล้ว · ออกผลแล้ว · ยกเลิก/ปฏิเสธ — แต่ละช่องเป็นจุดสี +
  จำนวน item · ช่องที่ไม่มีรายการเว้นว่าง · hover เห็นชื่อสถานะและสรุปทั้งใบ
- ระดับ item (แท็บ order / แท็บผลอ่าน) ไม่ถูกแตะ · `row.status_label` / `status_class`
  ยังคำนวณเหมือนเดิม ย้ายไปเป็น `title` / `aria-label`
- คอลัมน์สถานะ `84px → 108px` · worklist `min-width 1149 → 1173` · คอลัมน์อื่นคงเดิม
- แก้ `Form-Builder/seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js` แล้ว generate
  `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json` ใหม่ · เพิ่มเทสใน
  `Form-Builder/API/tests-tools/tests/test_xray_cpoe_worklist_form.js` · บันทึกไว้ที่
  `Form-Builder/SDForm/X-ray/spec.md` §5.4
- เทส X-ray ทั้ง 10 ไฟล์ · เทสฟอร์ม LAB · validator `check_sdform_json.py` ผ่านทั้งหมด
  Builder/Preview และ runtime UAT ยังค้าง · ไม่มี commit/push
- ผู้ใช้อนุมัติความกว้าง `84px → 108px` แล้ว (2026-09-03) · เพิ่มหัวข้อ T0.1 และข้อตรวจตอน
  ส่งเข้าเครื่องใน `Form-Builder/SDForm/X-ray/uat-checklist.md` สำหรับตรวจของจริง
- **รอบสอง (2026-09-03)** ผู้ใช้ import ขึ้นระบบจริงแล้วพบว่าใบที่ส่งเครื่องแล้วโชว์ช่อง `รอรับ`
  ว่าง เหมือนไม่เคยรับ ⇒ เปลี่ยนเช็คลิสต์เป็น **ความคืบหน้า**: ขั้นที่ยังมีของค้าง = จุด + จำนวน ·
  ขั้นที่ผ่านไปแล้ว = จุด + เครื่องหมายถูก · ยังไม่ถึง = เว้นว่าง
- `ยกเลิก / ปฏิเสธ` ไม่อยู่ใน `s.STEP_ORDER` — ยกเลิกแล้วไม่ได้เดินต่อ จึงไม่ทำให้ขั้นก่อนหน้า
  กลายเป็นผ่าน และไม่มีวันขึ้นเครื่องหมายถูกเอง · เทสคุมทั้งสองข้อนี้ไว้แล้ว
- generate JSON ใหม่ · เทส X-ray ทั้ง 10 ไฟล์ · เทสฟอร์ม LAB · validator ผ่านทั้งหมด ·
  ต้อง import ฟอร์มทับอีกรอบเพื่อให้ของจริงตรงกับกติกาใหม่

## [2026-09-03] implementation | X-ray worklist — ปรับ 5 ข้อรอบ UAT + เปลี่ยนกติกาส่งตรวจซ้ำ

- ตัดช่อง `ผู้รับรองผล` ออกจาก popup ผลอ่าน · state/setter ยังอยู่ครบ
- เพิ่มคอลัมน์ `รังสีแพทย์` ระดับ item ใน **แท็บ order** เป็น mockup (`radiologist1` / `radiologist2`)
  ค่าที่เลือกอยู่ในหน้าจอเท่านั้น ไม่ส่ง API ไม่บันทึก · grid 11 คอลัมน์ · min-width 1226 → 1386
- ตัดปุ่ม `PDF` ระดับ item ในแท็บผลอ่าน · `can_pdf`/`pdf_hint` ยังคำนวณ · min-width 1020 → 956
- **เปลี่ยนสัญญาที่เคยยืนยัน 2026-09-02**: ส่งตรวจซ้ำ/ตรวจใหม่ ใช้ Order เดิมและเลข Order เดิม
  แต่ล้าง `accession_no` แล้วออกเลขใหม่ตอนกดส่งเข้าเครื่อง · เลขเดิมเก็บที่ `accession_history[]`
  · `retry_only` และรายการที่ transport ล้มเหลวยังใช้เลขเดิม (RIS ยังไม่เคยได้ใบ)
- กล่องแดงเตือนแพ้ยา/COVID ในคอลัมน์เดียวกับห้องต้นทาง/การเงิน · API สรุปให้ที่ `patient.alerts`
  จาก `zdata_person.allergy_main` + `zdata_patient_assessment` + Diagnosis `U07*` (ผู้ใช้เลือกแหล่ง
  COVID เอง) · คำปฏิเสธการแพ้ ("ไม่มี/ปฏิเสธ/NKDA") ถูกคัดออกกันเตือนกลับด้าน
- แก้ `xray_cpoe_worklist_api.js`, `xray_cpoe_dispatch_api.js`, builder + form JSON, เทสสามไฟล์,
  `spec.md` §5.5, `design/Xray_design.md` A.2/A.3, `uat-checklist.md` T0.2
- เทส X-ray ทั้ง 10 ไฟล์ · เทสฟอร์ม LAB · validator ผ่านหมด · ต้อง import ฟอร์มและ replace body
  ของ Process worklist + dispatch ถึงจะเห็นผลจริง · ไม่มี commit/push

## [2026-09-03] implementation | X-ray worklist — Radiographer พร้อม log + ปรับหน้าตารอบสอง

- ป้ายเตือนแพ้ยา/COVID เปลี่ยนจากกล่องเต็มความกว้างเป็น **ป้ายทรงเดียวกับ `ชำระเงินแล้ว`**
  (สูง/ระยะ/มุมโค้งลอกจาก `.xr-meta-pill` ต่างแค่สีแดง)
- เอาเส้นประใต้ข้อความ `N รายการ` ออก · tooltip รายชื่อ test ยังทำงานเหมือนเดิม
- รายชื่อรังสีแพทย์เปลี่ยนจาก mockup เป็นชื่อจริง 5 คนตามเอกสาร (ชื่อ-นามสกุล ไม่เอาตำแหน่ง)
  · ยังไม่บันทึกลงฐานข้อมูลเหมือนเดิม
- คอลัมน์ `ผู้ส่ง` → **`Radiographer`** เป็น dropdown 8 ชื่อจริง · **บันทึกจริงพร้อม log**
  ผ่าน action `set_staff` ที่เพิ่มใน Process worklist (ไม่มี Process ID ใหม่)
  · เขียน `radiographer` / `radiographer_at` / `radiographer_by` และ `$push radiographer_log[]`
    เก็บค่าเก่า ค่าใหม่ เวลา คนแก้ · ล้างค่าได้ log `action: clear` · กดค่าเดิมซ้ำไม่สร้าง log ขยะ
  · ไม่แตะ `dispatched_by` (คนกดส่งเข้าเครื่อง) — ย้ายไปแสดงเป็น tooltip ของช่อง
  · ฟอร์มเป็น optimistic update และ **ย้อนค่าเดิมเมื่อ server ปฏิเสธ**
- ข้อยกเว้นที่บันทึกไว้: รายชื่อเจ้าหน้าที่ยัง hard-code ในฟอร์ม ขัดกับข้อห้ามเดิม เพราะยังไม่มี
  master เจ้าหน้าที่ · ฝั่ง API ไม่ผูกรายชื่อ ⇒ ย้ายไป master ได้โดยแก้ที่ฟอร์มที่เดียว
- เพิ่มเทสใหม่ `Form-Builder/API/tests-tools/tests/test_xray_set_staff_api.js`
- เทส X-ray ทั้ง 11 ไฟล์ · เทสฟอร์ม LAB · validator ผ่านหมด · ต้อง import ฟอร์มและ replace body
  Process worklist ถึงจะใช้ได้ · ไม่มี commit/push

## [2026-09-03] implementation | X-ray worklist — ปุ่มตรวจใหม่ใช้ได้จริง + เปลี่ยนชื่อ Radiologist

- ปุ่ม `ตรวจใหม่` เดิมกดแล้วไม่เกิดอะไร (ยังไม่มี handler ฝั่ง Process) — เพิ่ม action
  `retest_order` ใน Process worklist `6a957009422c1ca959829e45` (ไม่มี Process ID ใหม่)
  · เงื่อนไขตามที่ผู้ใช้สั่ง: **ใช้เลข Order เดิม** ย้าย item ที่ยกเลิก/ปฏิเสธกลับเป็น `sent`
    (กลับไปโผล่หน้ารอรับ) · ล้าง `accession_no` + เวลา/คนส่ง + สถานะ transport + เหตุผลยกเลิก
    · เลขใหม่ออกตอนกด `ส่งเข้าเครื่อง` เท่านั้น (ไม่ออกให้ตอนกดตรวจใหม่)
  · `$push retest_log[]` (สถานะเดิม→ใหม่, เลข accession ที่ถูกล้าง, เวลา, คนกด) และเมื่อเคยมีเลข
    ก็ `$push accession_history[]` reason `retest` — เลขเก่ายังสืบย้อนได้เพราะผลเดิมผูกกับเลขนั้น
  · compare-and-set กันกดพร้อมกัน (`retest_race_lost`) · ใบบันทึกการยกเลิกไม่ถูกลบ แต่ประทับ
    `cancel_status: reopened` + `$push reopen_log[]`
  · `cancel_order` ขยาย filter ตอนประทับใบเป็น `$in: ['pending','applied','reopened']`
    เพื่อให้ order ที่ตรวจใหม่แล้วยังยกเลิกซ้ำได้ — พฤติกรรมเดิมของ pending/applied ไม่เปลี่ยน
- ฟอร์ม: ปุ่มผูกกับ `retestOrder(row)` มีสถานะ loading รายแถว แล้วรีเฟรช worklist + ตัวนับ
- ตัด toast ตอนบันทึก Radiographer **สำเร็จ** ออกตามที่ผู้ใช้สั่ง (ให้เงียบเหมือน Radiologist)
  · **คง toast ตอนล้มเหลวไว้** เพราะค่าที่เลือกจะถูกย้อนกลับ ถ้าไม่เตือนผู้ใช้จะไม่รู้ว่าไม่ได้บันทึก
- เปลี่ยนหัวคอลัมน์ `รังสีแพทย์` → `Radiologist` (header, data-label, placeholder, aria)
- หัวข้อ toast ที่แสดงเป็นตัวเลข (2600/3600) คือพฤติกรรมของแพลตฟอร์ม — arg ที่ 3 ของ
  `$message` คือ duration · ฟอร์ม LAB ก็เป็นเหมือนกันทั้ง 35 จุด · บันทึกไว้ใน spec §5.7 ยังไม่แก้
- เพิ่มเทสใหม่ `Form-Builder/API/tests-tools/tests/test_xray_retest_order_api.js`
- ไฟล์ที่แก้: `build_xray_cpoe_worklist_ui.js`, `xray-cpoe-worklist-v1.json`,
  `xray_cpoe_worklist_api.js`, `spec.md` §5.7, `uat-checklist.md` T0.3
- เทส X-ray ทั้ง 12 ไฟล์ · เทสฟอร์ม LAB · validator ผ่านหมด (เหลือ warning เดิม 2 ข้อ)
  · ต้อง import ฟอร์มและ replace body Process worklist ถึงจะใช้ได้ · dispatch รอบนี้ไม่แก้
  · ไม่มี commit/push

## [2026-09-03] note | X-ray — ปุ่มตรวจใหม่ "ใช้ไม่ได้" เพราะ Process ที่ deploy ยังเก่า

- ตรวจแล้ว: โค้ดในรีโปครบ — action `retest_order` มีจริง เทส `test_xray_retest_order_api.js` ผ่าน
  และปุ่มในฟอร์มเรียก action นี้ถูกต้อง ⇒ อาการ "กดแล้วไม่เกิดอะไร" มาจากฝั่งที่ deploy
- เพิ่มการป้องกันในฟอร์ม: `s.actionAnswered(p,key)` ตรวจ **ทรงของคำตอบ** ไม่ใช่ดูแค่ `success`
  เจอทรง `list` (`data.orders`) หรือไม่มีคีย์ที่ action ต้องคืน = Process ยังไม่รู้จัก action นั้น
  แล้วขึ้นข้อความบอกให้ไป replace body ของ `xray_cpoe_worklist_api.js` แทนที่จะบอกว่าสำเร็จ
- ใช้กับทั้ง `retest_order` และ `set_staff` · ฝั่ง Radiographer ย้อนค่าบนจอด้วย
  ไม่ปล่อยให้ชื่อค้างทั้งที่ไม่ได้บันทึก
- อีกสองข้อของรอบนี้ (ตัด toast ตอนบันทึกสำเร็จ · เปลี่ยนหัวคอลัมน์เป็น `Radiologist`)
  พบว่ามีอีก session แก้ไว้ในไฟล์เดียวกันแล้ว — ตรวจสอบว่าตรงตามที่ผู้ใช้สั่งและคงไว้ทั้งคู่
- เทส X-ray ทั้ง 12 ไฟล์ · เทสฟอร์ม LAB · validator ผ่านหมด · ไม่มี commit/push

## [2026-09-03] implementation | CPOE Order App — เพิ่มช่องเลือก VN เป็นทางเลือกที่สอง (ฟอร์มโคลน)

- ผู้ใช้ขอ dropdown เลือก VN ที่เปิดวันนั้น โดย **VN จาก EMR ยังเป็นค่าเริ่มต้นเหมือนเดิม**
- ของเดิม: จอนี้มี picker อยู่แล้ว แต่ซ่อนด้วย `v-if="manualMode()"` เห็นเฉพาะตอนเปิดจาก
  worklist ⇒ แก้แค่ปลดเงื่อนไขให้ใช้ได้ทุกโหมด ไม่ได้สร้างกลไกใหม่
- สร้างฟอร์มโคลน `Form-Builder/SDForm/form-factory/forms/cpoe-order-app-vn-picker-v1.json`
  ด้วย `Form-Builder/seed/tests-tools/scripts/build_cpoe_app_vn_picker.js`
  · ต้นฉบับ `CPOE_app.json` ไม่ถูกแก้
- เทสใหม่ `test_cpoe_app_vn_picker_form.js` เทียบทั้งฟอร์มกับต้นฉบับ: ต่างได้เฉพาะ
  `pt_header.content/onCreated/onMounted` กับ `formConfig.cssCode` · `item_screen` ต้องเหมือนเป๊ะ
  · CSS เดิมทุกบรรทัดต้องยังอยู่
- ล้างช่อง = คืน context เดิม และสั่ง `item_screen.setPatientContext(null)` ด้วย
  ไม่งั้นหัวจอกับจอสั่งรายการจะเป็นคนละคนไข้ · มีแถบเตือนเมื่อ VN ที่ใช้ไม่ใช่ตัวที่ EMR ส่งมา
- **แก้ `lab_cpoe_worklist_api.js`:** ย้าย action dispatch + บล็อก `list_open_visits` ขึ้นเหนือ
  ด่าน "Organization ไม่มี Section LAB" เพราะ query ไม่ได้ใช้ Section เลย — เดิมผู้ใช้ที่ไม่ได้อยู่
  ห้อง LAB (หมอคลินิก/ห้องรังสี) ถูกตัดจบก่อนถึง action แล้ว picker ขึ้นว่ารูปแบบข้อมูลไม่ถูกต้อง
  (กระทบปุ่ม "สร้างรายการใหม่" ของ X-ray ที่มีอยู่เดิมด้วย) · เพิ่มเทสคุมทั้งสองด้าน
- เทส LAB หลัก 8 ไฟล์ + เทสฟอร์มใหม่ + validator ผ่าน (เทส legacy fixture-path 4 ไฟล์
  ยังแดงเหมือนเดิม ไม่เกี่ยวกับการแก้นี้) · วิธี import อยู่ใน
  `02-his/handoff/cpoe-order-app-vn-picker-v1-import.md` · ไม่มี commit/push

## [2026-09-03] implementation | X-ray — ปุ่มสร้างรายการใหม่สลับไปฟอร์ม CPOE โคลนได้

- ปุ่ม "สร้างรายการใหม่" เดิม hard-code `CPOE_ORDER_APP_ID='6a927860422c1ca959829d26'` ในวิดเจ็ต
  ⇒ ทำให้ตั้งค่าได้ตอน generate ด้วย env `XRAY_CPOE_ORDER_APP_ID`
  (ค่าเริ่มต้นยังเป็นฟอร์มจริง ⇒ ไม่ตั้งอะไร พฤติกรรมเหมือนเดิมทุกประการ)
- ค่าที่ไม่ใช่ Form ID 24 ตัวอักษรจะ throw ตั้งแต่ตอน generate ไม่หลุดไปเงียบ ๆ ในฟอร์ม
  (ทดสอบแล้วทั้งค่าถูก ค่าผิด และการคืนค่าเริ่มต้น)
- เทส `test_xray_cpoe_worklist_form.js` เลิกผูกเลข Form ID ตายตัว — อ่านจากฟอร์มที่ generate
  แล้วเทียบกับสิ่งที่ปุ่มเปิด · เพิ่มเทสว่า **ค่าเริ่มต้นในสคริปต์** ต้องเป็นฟอร์มจริง
  และต้องมีการ validate รูปแบบ ID
- ยังต้องรอ Form ID ของโคลนหลัง import ถึงจะชี้ปุ่มไปได้จริง · วิธีสั่งอยู่ใน
  `02-his/handoff/cpoe-order-app-vn-picker-v1-import.md`
- เทส X-ray 10 ไฟล์ + เทสฟอร์มโคลน + เทสฟอร์ม LAB + validator ผ่าน · ไม่มี commit/push

## [2026-09-03] note | External API gateway — key ใหม่ผ่าน live auth smoke

- ยิง `POST /api/v1/external/lis.test` ด้วย `params.ping = "hello"` และ key ใหม่จากทีม
  ได้ HTTP 200, `data.status: "ok"`, trace `20260903185255-ino4fc` ภายใน 0.12 วินาที
- ไม่บันทึก key ลง repository; ผลนี้ยืนยันเฉพาะ gateway authentication/action execution
  ส่วน valid Order E2E/write verification ยังรอทดสอบ
- no-write smoke ของ `lis.receive` ได้ HTTP 200 + inner `INVALID_PAYLOAD`, trace
  `20260903185530-9nufw1` จึงยืนยันว่า auth/scope/action mapping ผ่านและไม่ถึง write path
- พบ gateway เติม `xpartnerx` เข้า params เอง แต่ validator ปัจจุบันเป็น strict allowlist
  และปฏิเสธ field นี้ ⇒ หยุดก่อน valid clinical payload จนกว่าจะแยก/ยอมรับ metadata นี้ได้
- smoke แบบ `{params:{payload:{}}}` (trace `20260903185630-1zcr27`) ไม่มี error `xpartnerx`
  ยืนยันว่า metadata ถูกเติมเป็น sibling ที่ root และ fallback `params.payload` กันออกได้
  แต่ body รูปนี้ต่างจาก contract ที่ทีมส่งมา จึงต้องตกลงรูปแบบก่อน E2E จริง

## [2026-09-03] implementation | `lis.submit` — แยก gateway สำเร็จออกจาก outbound timeout

- ผู้ใช้ยืนยันว่าทีมหยุด inject metadata และยืนยัน external contract แล้ว; ให้กลับมาทำ Submit ก่อน
- `lis.submit` invalid smoke ได้ HTTP 200 + inner `invalid_payload` (trace
  `20260903191034-3a5faw`) ⇒ key/scope/Service Account/action mapping ผ่าน โดยไม่เรียก Agent
- snapshot เดิมของ UAT Order ผ่าน gateway แต่ Submit timeout 5.22 วินาทีและคืน
  `agent_unreachable`, HTTP null (trace `20260903191205-laq0pq`)
- payload เดียวกันยิงตรงจาก Mac ด้วย live Agent URL/key ได้ HTTP 200 ใน 0.021 วินาที,
  `duplicate:true`, order_ref 13, dispatch_id 12, route `rax-file` ⇒ blocker อยู่ที่ outbound
  network ของ initCraft runtime ไม่ใช่ Agent/config/payload
- เพิ่ม diagnostic แบบ redact ใน `lab_agent_order_submit_api.js`: `network_code`,
  `network_message`, `detail.timeout_ms`; ไม่เปลี่ยน success/retry/idempotency contract
- เทส Submit และ Receive orchestration ผ่าน; ต้อง replace live Process
  `6a9468c7422c1ca959829d6a` แล้ว retest เพื่อได้ network code จริง; ไม่มี commit/push

## [2026-09-03] note | `lis.submit` หลัง replace — ยืนยัน `ECONNABORTED`

- live Process updated 19:19 และมี diagnostic รุ่นใหม่ครบ; ผู้ใช้อนุญาตให้ Codex test ให้
- UAT Order เดิมผ่าน `lis.submit` ได้ gateway HTTP 200 แต่ inner result เป็น
  `agent_unreachable`, `network_code: ECONNABORTED`, `timeout of 5000ms exceeded`,
  HTTP null; trace `20260903192030-0s65a6`
- `log_api_external` มี action `lis.submit` status 200 ตาม trace; นี่คือ gateway สำเร็จ
  ไม่ใช่ Agent รับ Order
- Outbound ยัง `new`, attempt 0 เพราะ direct Submit Process ไม่เขียน audit; การเขียน audit
  อยู่ใน Receive orchestrator ส่วน direct Mac call ของ payload/config เดียวกันได้
  `duplicate:true` ใน 0.021 วินาที
- ขั้นต่อไป: ทีม infra เปิด route จาก initCraft runtime ไป Agent แล้วให้ Codex retest Submit;
  ไม่มี code/Form/DB write เพิ่ม และไม่มี commit/push

## [2026-09-03] note | `lis.submit` หลังผู้ใช้ต่อ VPN — แยก Mac route กับ server route

- ทดสอบ UAT Order เดิมอีกครั้งหลังผู้ใช้ยืนยัน VPN Connected: External `lis.submit` ได้
  gateway HTTP 200 แต่ inner result ยังเป็น `agent_unreachable`, `ECONNABORTED`, timeout
  5 วินาที, HTTP null; trace `20260903192649-5rmq8w`
- payload/config เดียวกันยิงตรง Mac→Agent ได้ HTTP 200 ใน 0.027 วินาที พร้อม
  `duplicate:true`, `order_ref:13`, `dispatch_id:12`, route `rax-file`
- read-only DB check ยืนยัน External log มี trace/status 200 แต่ UAT Outbound เดิมยัง
  `hl7_status:new`, `attempt_count:0`; direct Submit ไม่เขียน Outbound audit—Receive
  orchestrator เป็นผู้สร้าง/อัปเดต record รอบการ Submit
- ข้อสรุป: VPN ของผู้ใช้เปิดทางให้ Mac เท่านั้น; infra ยังต้องเปิด route จาก initCraft
  runtime ไป Agent. ไม่บันทึก key/ข้อมูลผู้ป่วย และไม่มี code/Form/DB write หรือ commit/push

## [2026-09-03] implementation | Gateway `lis.submit` — persist Outbound ก่อน transport

- ผู้ใช้ยืนยัน contract ใหม่: เรียก `lis.submit` ผ่าน External Gateway แล้ว Order ต้องเข้า
  `zdata_lab_outband_order`; Submit ห้ามเป็น transport-only
- แก้ `lab_agent_order_submit_api.js` ให้ validate → insert/find idempotent Outbound → claim
  `sending`/เพิ่ม attempt → ยิง Agent → finalize เป็น `queued` หรือคืน `new` พร้อม error;
  response เพิ่ม `outbound_order_id` และ `attempt_count`
- ถ้า persist ไม่สำเร็จ Process จะไม่ยิง Agent เพื่อป้องกัน Order ที่ไม่มี audit; Order ที่
  queued แล้วไม่ส่งซ้ำ และ concurrent `sending` คืน `dispatch_in_progress`
- Receive เดิมยังสร้าง/claim/finalize Outbound เองและส่ง internal
  `audit_managed_by_receive:true` ให้ Submit จึงไม่เขียนซ้ำหรือเพิ่ม attempt สองครั้ง
- Submit/Receive และ LAB regression ที่เกี่ยวข้อง 7 ชุดผ่าน; result UI legacy suite หยุดที่
  fixture JSON เดิมหาย ไม่เกี่ยวกับ diff นี้. รอ replace live Process และ runtime retest;
  ไม่มี secret, DB write, commit หรือ push

## [2026-09-03] note | Gateway Submit persistence — live runtime verified

- ผู้ใช้ replace live Submit/Receive แล้ว; ยิง UAT Order เดิมแบบ idempotent ผ่าน
  `lis.submit` เวลา 19:45 ได้ gateway HTTP 200 แต่ inner ยัง `agent_unreachable`,
  `ECONNABORTED`, timeout 5 วินาที; trace `20260903194549-idgceh`
- response รุ่นใหม่คืน `outbound_order_id` และ `attempt_count:1`
- read-only DB before/after ยืนยัน Outbound record เดิมเปลี่ยน attempt `0` → `1`, เวลาและ
  `updated_by:lis_agent` ถูกอัปเดต พร้อม `last_error_code`, detail และ attempt history;
  persistence/audit contract จึงผ่าน runtime แล้ว
- record นี้มีอยู่ก่อน retest เพราะ Receive เคยสร้างไว้ ไม่ใช่ record ใหม่จากรอบ 19:45;
  blocker ที่เหลือคือ outbound route จาก initCraft runtime ไป Agent
- การทดสอบอัปเดตเฉพาะ UAT record เดิมผ่าน API; ไม่เขียน key/ข้อมูลผู้ป่วยลง repository
  และไม่มี commit/push

## [2026-09-03] note | Agent VPN reconnect — Submit ยัง timeout

- ผู้ใช้ยืนยันว่า reconnect VPN ฝั่ง Agent แล้ว จึงยิง UAT Order เดิมแบบ idempotent ซ้ำ
- External Gateway ได้ HTTP 200 แต่ inner Submit ยัง `agent_unreachable`, `ECONNABORTED`,
  timeout 5 วินาที; trace `20260903195745-1tve7t`
- read-only DB ยืนยัน Outbound เดิมอัปเดต attempt `1` → `2`, เวลา 19:57:45 และ append
  failure history รายการที่สอง; persistence/audit ยังทำงานถูกต้อง
- ข้อสรุป: reconnect VPN รอบนี้ไม่ทำให้ initCraft runtime เชื่อม Agent ได้; ต้องตรวจ route,
  tunnel/allowlist และการเข้าถึง Agent จาก host/container ของ initCraft โดยตรง
- ไม่มี code change, secret ใน repository, commit หรือ push

## [2026-09-03] note | Submit complete; Receive persistence UAT allowed before Agent route

- User ยืนยันให้ถือว่า outbound Order Submit API เสร็จแล้ว: direct Mac/VPN→Agent ผ่าน และ
  live Gateway→Submit→Outbound persistence/audit ผ่าน; เหลือ server/VPN route ของ initCraft
- ยืนยันจาก implementation ว่า fresh-item `รับ specimen` ทดสอบ LAB NO./Work Item/Outbound/
  CPOE persistence ได้ก่อน Agent ถึง เพราะ transport ทำหลัง commit และ failure ไม่ rollback
- Expected เมื่อ Agent ยังไม่ถึง: UI warning, CPOE Item `accepted`, Work Item `received`,
  Outbound `new` + retryable/error; Item ที่รับแล้วต้อง idempotent ไม่สร้างเลขหรือ record ใหม่
- LAB regression ที่เกี่ยวข้อง 8 ชุดผ่าน
- ลบ Agent URL/key จริงที่พบใน source กลับเป็น placeholders; live secret ต้องอยู่เฉพาะ
  protected API Factory process และควร rotate key ที่เคยเข้ working tree/session

## [2026-09-03] implementation | Fix nested Receive `e is not a function`

- Runtime UAT 21:20 ของ C34 รายงานรับสำเร็จ 0 พร้อม `e is not a function`; live Receive body
  ตรงกับ local แบบ byte-for-byte จึงไม่ใช่การลืม replace
- Read-only DB พบ CPOE Item เป็น `accepted` แต่ไม่มี Lab Work Item/Outbound ที่ตรงกัน;
  บันทึกเป็น inconsistent UAT Item และห้ามใช้ซ้ำเป็น fresh test
- Root cause ที่สอดคล้องกับ runtime คือ nested LAB NO. Process ไม่มี `this.mongoTxn` binding;
  แก้ Lab No. Generator และ Receive ให้ใช้ existing idempotent standalone fallback เมื่อ helper ไม่มี
- เพิ่ม regression สำหรับ missing helper ทั้งสอง Process; LAB suite ที่เกี่ยวข้อง 8 ชุดและ diff check ผ่าน
- Live ยังต้อง replace Process ทั้งสองก่อน retest; ไม่มี DB write, commit หรือ push จาก Codex

## [2026-09-03] note | Replacement verified; selected Order is rejected

- Lab No. และ Receive ถูก replace เวลา 21:30/21:31; read-only body hash/length ตรง local
- Response รอบใหม่ไม่มี nested runtime exception แล้ว แต่คืน `lab_no_failed` ตาม contract
  เพราะ Item ไม่ได้อยู่สถานะรอรับ
- DB ยืนยัน C34 และ C64 ใน Order ที่เปิดอยู่เป็น `rejected` ทั้งคู่ ขณะที่หน้าเดิมยังแสดง
  `รอรับ`; ต้อง hard-refresh และใช้ Order/Item ใหม่ที่เป็น `sent`
- ไม่มี DB write, commit หรือ push จาก Codex

## [2026-09-03] note | Fresh Receive UAT passed; UI delay isolated to Agent timeout

- ผู้ใช้รับ specimen ของ valid `sent` Items 2 รายการสำเร็จและเห็น LAB NO.
  `106909030005` / `106909030006`
- read-only DB ยืนยัน Work Item ทั้งสองเป็น `received`; Outbound ที่ตรงกันเป็น `new`,
  `retryable:true`, attempt 1 และ `agent_unreachable` / timeout 5000 ms โดย receipt ไม่ rollback
- เวลาสร้าง 21:39:43 และ 21:39:49 สอดคล้องกับ Form ที่วน Item แบบ sequential และรอ Agent
  timeout ต่อรายการ ก่อน refresh จึงใช้เวลาประมาณ 10 วินาทีสำหรับ 2 รายการ
- toast `e is not a function` ยังขึ้นก่อนผลสำเร็จ แต่ backend ทำงานและ persist ต่อ จึงแยกเป็น
  client/Form-platform callback error; ต้องเก็บ Console stack หรือ Network Initiator ก่อนแก้ connector
- ไม่มี code/Form/DB write, secret, commit หรือ push จาก Codex

## [2026-09-04] implementation | X-ray "สร้างรายการใหม่" → โคลน CPOE + VN dropdown ว่าง

- ผู้ใช้แจ้ง Form ID ของโคลน CPOE Order App หลัง import: `6a995d064744260ea8c9498c`
  และรายงานว่า dropdown เลือก VN ในโคลนไม่แสดงสักรายการ ทั้งที่ Visit List วันนั้นมี 6 คิว
- **ต่อปุ่ม:** generate `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json` ใหม่ด้วย
  `XRAY_CPOE_ORDER_APP_ID=6a995d064744260ea8c9498c` ⇒ `CPOE_ORDER_APP_ID` ในฟอร์มชี้ไปที่โคลนแล้ว
  ปุ่มยังส่ง `manual_visit:true` + `source:'xray-worklist'` เหมือนเดิม ต้อง import ทับ
  Form `6a953fb6422c1ca959829e14`
- **หาสาเหตุ dropdown ว่าง:** `list_open_visits` **ไม่ได้** ดึงตามนิยามของ Visit List
  จอ Visit List (`sdform_module/patient.json` → `visit_list`) อ่าน `zdata_visit_tran`
  (form `6a461235e521219e514d1c4b`) ด้วย
  `` `visit_date` = DATE_TO_STRING(DATE_ADD(CURRENT_DATE(),'hour',7),'%Y-%m-%d')
  AND vtran_status IN ('waiting','called','in_progress') ``
  ส่วน process อ่าน `zdata_visit` ด้วย `visit_date` เท่ากันเป๊ะ + `visit_status: true`
  จุดเสี่ยงหลัก: `visit_date` เป็น `date-input` `dateType: "datetime"` (`sdform_module/visit.json`)
  ⇒ ค่าที่เก็บอาจมีเวลาต่อท้าย แล้ว `=` กับ `'YYYY-MM-DD'` ไม่ตรงเลยสักแถว
- **แก้ `Form-Builder/API/api-factory/processes/lab_cpoe_worklist_api.js` เป็น 2 ชั้น**
  (ของเดิมไม่ได้ถูกลบ เป็น fallback): ชั้นแรกอ่านคิววันนี้จาก `zdata_visit_tran` ด้วยสถานะชุด
  เดียวกับ ListView แล้วดึง Visit ตาม `vid.value`; ชั้นสองยัง query `zdata_visit` เหมือนเดิม
  แต่เทียบ `visit_date` เป็นช่วงวันและใช้ `visit_status: {$ne:false}`
  response เพิ่ม `source` + `visit_tran_total`
- ฟอร์มโคลนเอา `source`/`visit_tran_total` ไปต่อท้ายข้อความ "วันนี้ยังไม่มีผู้ป่วยที่เปิด Visit อยู่"
  (แก้ผ่าน `build_cpoe_app_vn_picker.js` แล้ว regenerate)
- assertion เดิมที่ล็อก query เป็น `visit_date` เท่ากันเป๊ะ + `visit_status: true` ถูกเปลี่ยนตามคำสั่ง
  ผู้ใช้ พร้อมคอมเมนต์ลงวันที่ · เพิ่มเทสชั้น fallback แยกไว้ด้วย
- เทสผ่าน: LAB/CPOE 10 ชุด + X-ray 10 ชุด + SDForm validator (2 ฟอร์ม)
  `test_multilab_reject_api` / `test_multilab_reject_ui` ยังแดงจาก path สัมพัทธ์ของเดิม ไม่เกี่ยวกับงานนี้
- ยังไม่ได้ยืนยัน runtime — ต้อง replace Process `6a9434c3422c1ca959829d5e`,
  import โคลนทับ `6a995d064744260ea8c9498c` และ import X-ray worklist ทับ `6a953fb6422c1ca959829e14`

## [2026-09-04] implementation | LAB Worklist result popup context + canonical lookup

- ผู้ใช้จำกัดงานไว้ที่ flow “ดูผล” หน้า LAB Worklist และขอให้ popup ตรงกับ
  `02-his/ui/lab-worklist-mockup.html`; ไม่แตะ Receive, Agent dispatch หรือ callback identity
- พบสาเหตุ toast `ค้นหารายการผลตรวจเดิมไม่สำเร็จ`: canonical Result Item ว่างแล้ว API ไปอ่าน
  legacy Form `6a7aa641935ed08882467374` ซึ่งถูกปิด ทำให้ optional fallback ล้มทั้ง action
- แก้ Worklist API ให้ legacy lookup ที่ใช้เพื่อ compatibility เท่านั้นคืนรายการว่างเมื่อ Form
  ใช้งานไม่ได้ โดย canonical lookup ยัง fail closed ตามเดิม
- แก้ popup ให้สร้าง context จากแถวที่กดก่อนเรียก API จึงแสดงชื่อผู้ป่วย, HN/VN, LAB NO.,
  specimen, ward/clinic และเวลารับทันที แล้ว merge ผลปัจจุบัน/ผลก่อนหน้าจาก API
- ปรับ layout เป็น patient card + result grid + critical banner ตาม HTML reference และคงปุ่มดินสอ/
  manual audit เดิม
- Worklist API/Form tests, SDForm validator และ diff check ผ่าน; LAB regression รวม 9 ชุดผ่าน
  ส่วน inbound/output/workbench test เก่า 4 ชุดรันไม่ได้เพราะ fixture/schema ที่อ้างถึงไม่มีในโฟลเดอร์ tests
- ต้อง replace Process `6a9434c3422c1ca959829d5e`, import Form เดิมทับด้วย
  `Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json` แล้ว runtime-check “ดูผล”
- ไม่มี DB write, commit หรือ push

## [2026-09-04] implementation | Fix Confirm callback + recover missing LAB NO Work Item

- พิสูจน์จาก frontend bundle ของ initCraft v1.6 ว่า `field.confirm` ใช้ signature
  `confirm(message, callback, type, title)` แต่ Form เดิมส่งชื่อ popup เป็น argument 2;
  เมื่อกด OK ระบบจึงพยายามเรียก string และขึ้น `e is not a function`
- แยก `performReceive` ออกจาก `receiveSelected` และให้ Confirm callback เป็นผู้เริ่ม flow;
  ไม่แก้ Receive Process หรือ Agent Submit Process
- read-only DB ของ C43 ที่ผู้ใช้รายงานพบ CPOE Item เป็น `accepted` แต่ไม่มี Work Item,
  LAB NO., `received_at` หรือ Outbound; Work Item ของ UAT ที่เคยสำเร็จยังอยู่ครบ
- เพิ่ม recovery ใน Lab No. Generator เฉพาะสถานะ legacy waiting-compatible ที่ไม่มี Work Item
  และไม่มีหลักฐานรับเดิม; เส้นทาง `sent`, existing Work Item และเคสมีหลักฐานรับยังคง contract เดิม
- LAB regression ที่เกี่ยวข้อง 9 ชุด, SDForm validator และ diff check ผ่าน
- Runtime pending: replace เฉพาะ Lab No. Generator `6a94f1ed422c1ca959829d6e`, import
  Worklist Form เดิมทับ แล้ว hard-refresh; ไม่ต้อง replace Receive/Agent/Worklist Process
- ไม่มี DB write, commit หรือ push

## [2026-09-04] implementation | ป้ายติดแฟ้ม (HN) — SQL + Report ใหม่

- ผู้ใช้ส่ง `backup-data_report-factory_2026_09_04_09_02_51.zip` (Report `ป้ายติดแฟ้ม (VN)`
  `06b8f72c39fdde6064981a4e`) เป็นต้นแบบ แล้วขอสติ๊กเกอร์ HN ที่ใช้ได้ทั้ง LAB และ X-ray
  ตอนถามกลับยืนยันเนื้อหา: "เอาแค่ hn ข้อมูลผู้ป่วย วาร์ดต้นทาง บาร์โคเด hn" ไม่เอาข้อมูล LAB/X-ray เลย
- สร้างใหม่: SQL `HN Patient Sticker v1` (`6a9a355c422c1ca95982a1a1`) +
  Report `ป้ายติดแฟ้ม (HN)` (`6a9a355c422c1ca95982a1a2`) · parameter เดียวคือ `hn`
  · ขนาด 247 × 67 pt เท่าต้นแบบ · barcode CODE128 ของ HN
- ฐานเป็น `zdata_visit` (ไม่ใช่ `zdata_person`) เพราะวาร์ดต้นทางอยู่ที่ Visit และ `pid` เป็น
  snapshot ผู้ป่วยครบแล้ว · HN ที่มีหลาย Visit เรียง Visit ที่เปิดอยู่ก่อนแล้วเอาล่าสุด + `$limit 1`
- `ward_display` = `ward.label` → `visit_clinic.label` → `visit_clinic.value` → `''`
  (fallback สุดท้ายเป็น `.value` กัน `[object Object]` เพราะ visit_clinic เป็น select-form-input)
- อายุ/วันเกิด ใช้สูตรเดียวกับ X-ray HN sticker ที่ผ่าน UAT (พ.ศ. + ปี/เดือน/วัน ไม่มีวันติดลบ)
- `_id` ใหม่ทั้งคู่ ⇒ Restore (Upsert) ไม่ทับ Report `5256d813009293b480d0a15c` ที่ปุ่ม HN
  ปัจจุบันเรียกอยู่ และไม่ทับคู่ X-ray HN Accession Sticker · เทสบังคับข้อนี้ไว้
- ไฟล์: builder `Form-Builder/API/report_factory/builders/build_hn_patient_sticker.js`,
  เทส `.../tests/test_hn_patient_sticker.js`, JSON export ทั้งสองตัว และ ZIP สำหรับ import
  ที่ `02-his/{sql-factory,report_factory}/exports/…2026_09_04_10_0{0,5}_00.zip`
- เทสผ่าน: HN sticker contract + report suite เดิมทั้งหมด · ZIP integrity + checksum ตรงกับ JSON
- **ยังไม่ได้เชื่อมปุ่ม** ตามที่ผู้ใช้สั่ง · ยังไม่มี runtime evidence (ไม่มี MongoDB ในเครื่องนี้)
  ต้อง import แล้ว Preview ก่อน · รายละเอียดอยู่ที่ `02-his/handoff/hn-patient-sticker-v1-import.md`

## [2026-09-04] fix | ป้ายติดแฟ้ม (HN) — Preview ว่างเปล่า เพราะ $match บน dotted path

- ผู้ใช้ Preview แล้วได้หน้าเดียวขนาดถูกต้องแต่ขาวสนิท ⇒ SQL คืน 0 แถว ไม่ใช่ปัญหาเลย์เอาต์
  (ถ้ามีแถวแต่ค่าว่าง จะยังเห็นตัวอักษรคงที่ `HN` / `วันเกิด :` / `อายุ` ในเทมเพลต)
- ความต่างจาก pipeline ที่ผ่าน runtime แล้วทุกตัว: ของเดิม `$match` กับ dotted path ตรง ๆ
  (`'pid.hn': '{{hn}}'`) ขณะที่ X-ray HN sticker สร้าง alias ระดับบนสุดด้วย `$addFields` ก่อน
  แล้วจึง `$match` กับ alias เสมอ (`_order_key`/`_item_key`/`_visit_key`)
- แก้เป็น `_hn_key` (`$trim` + `$toString` ของ `pid.hn`) และ `_hn_key_prefixed` (`'HN' + _hn_key`)
  แล้ว `$match` ด้วย `$or` ของสอง alias ⇒ พิมพ์ได้ทั้ง `6900001` และ `HN6900001`
  ทั้งสองทางชี้ผู้ป่วยคนเดียวกัน ไม่ได้กรองหลวมข้ามคน
- assertion เดิมที่ล็อก `"pid.hn":"{{hn}}"` เปลี่ยนตามพร้อมคอมเมนต์ลงวันที่ และเพิ่ม assertion
  ว่า `$addFields` ต้องมาก่อน `$match`
- regenerate JSON + zip ใหม่ทั้งคู่ (ID เดิม) · report suite 5 ชุดผ่าน · zip integrity ผ่าน
- ยังไม่มี runtime evidence ของรอบสอง · ถ้ายังว่าง ให้แยกชั้นด้วยการรัน SQL ตรง ๆ ใน SQL Factory

## [2026-09-04] implementation | LAB สร้างรายการใหม่ → Cpoe_test_order

- ผู้ใช้สั่งเปลี่ยนเฉพาะปุ่ม `สร้างรายการใหม่` ของ LAB ให้เชื่อมเหมือน X-ray และห้ามแตะส่วนอื่น
- read-only live lookup ยืนยัน Form `Cpoe_test_order` ID `6a995d064744260ea8c9498c`, enable อยู่
  และเป็น target เดียวกับ X-ray
- เปลี่ยนเฉพาะ `CPOE_ORDER_APP_ID` ใน LAB generator/generated Form และ assertion ของ target
- คง launch params เดิมครบ: `manual_visit:true`, `source:'lab-worklist'`, `lab_scope:true`,
  `organization_code` และ `section_codes`; ไม่แก้ API, Receive, Agent, result หรือปุ่มอื่น
- Form test, SDForm validator และ diff check ผ่าน; runtime import/click ยังต้องยืนยัน
- ไม่มี DB write, commit หรือ push

## [2026-09-04] implementation | Cpoe_test_order รวม HM/HH เป็น Hematology แท็บเดียว

- ผู้ใช้สั่งแก้เฉพาะ Hemato: รวม HM/Hematology และ HH/Hematology-Homeostasis
  เป็นแท็บเดียว โดยรหัสของ item ยังแยก HM/HH เดิม
- แก้เฉพาะ generator/generated clone ของ `Cpoe_test_order`; ไม่แก้
  `CPOE_app.json`, API save/send, หมวดอื่น หรือกติกาชุดตรวจเดิม
- แถบซ้ายแสดง `HM / HH · Hematology`; ภายในมีหัวแบ่ง
  `HM · Hematology` และ `HH · Hematology-Homeostasis`
- เทสจำลองยืนยันว่าตะกร้ายังเก็บ `HM`/`HH` จริง; single-section LAB scope ไม่ถูกรวม
- generator, targeted form test, LAB scope regression, exact diff-path guard และ SDForm validator ผ่าน
- runtime ยังต้อง import JSON ทับ Form `6a995d064744260ea8c9498c` แล้ว hard-refresh; ไม่มี DB write/commit/push

## [2026-09-04] implementation | ปุ่ม HN ของ X-ray → ป้ายติดแฟ้ม (HN)

- ผู้ใช้ยืนยัน Preview ป้ายใหม่ผ่านแล้ว และสั่งให้ปุ่ม `PDF HN` ของ **X-ray** ใช้ Report
  `6a9a355c422c1ca95982a1a2` แทนของเดิม
- เปลี่ยนใน `build_xray_cpoe_worklist_ui.js` สามจุดพร้อมกัน ไม่ใช่แค่เลข Report:
  `defaultHnOrderReportId` `5256d813009293b480d0a15c` → `6a9a355c422c1ca95982a1a2` ·
  `hnOrderReportReady` กันที่ `row.hn` แทน `emr.visit_id` · `hnOrderReportParams`
  ส่ง `{hn}` แทน `{xparentx}` · tooltip disabled เปลี่ยนตาม
  (ป้ายใหม่รับ `hn` อย่างเดียว ถ้าเปลี่ยนแต่ ID แล้วยังส่ง xparentx ป้ายจะว่างทุกใบ)
- ผลพลอยได้: Order ที่ไม่มี Visit ID แต่มี HN พิมพ์ป้ายได้แล้ว (เดิม disabled)
- generate `xray-cpoe-worklist-v1.json` ใหม่โดยคง `CPOE_ORDER_APP_ID=6a995d064744260ea8c9498c`
  จากงานเมื่อวานไว้ · ต้อง import ทับ Form `6a953fb6422c1ca959829e14`
- **หน้า LAB ไม่ถูกแตะ** ยังชี้ `5256d813009293b480d0a15c` + `xparentx` ⇒ ห้ามลบ Report ตัวเดิม
- assertion เดิมใน `test_xray_cpoe_worklist_form.js` เปลี่ยนพร้อมคอมเมนต์ลงวันที่ และเพิ่มเคส
  "ไม่มี Visit ID แต่มี HN → พิมพ์ได้" / "ไม่มี HN → disabled"
- อัปเดต `Form-Builder/SDForm/X-ray/spec.md` และ `design/Xray_design.md`
  (`design/Lab_design.md` ไม่แก้ เพราะ LAB ยังเป็นของเดิมจริง)
- เทสผ่าน: X-ray 8 ชุด + LAB Worklist Form/API + VN picker + HN sticker contract + SDForm validator
- ผู้ใช้ลบ clone ที่ทำเองทิ้งแล้ว (`6a9a37dc4744260ea8c949e4` / `6a9a37fb4744260ea8c949e5`)
  ตรวจแล้วไม่มีไฟล์ไหนอ้างถึงสอง ID นั้น

## [2026-09-04] implementation | ปุ่ม HN ของ LAB → ป้ายติดแฟ้ม (HN)

- ผู้ใช้สั่ง "เอาเข้า lab ให้ด้วย ห้ามแตะส่วนอื่นนะ" ต่อจากฝั่ง X-ray ในวันเดียวกัน
- ก่อนแก้: ยืนยันว่า `update_lab_cpoe_worklist_ui.js` generate แล้วได้
  `lab-cpoe-worklist-waiting-v1.json` ตรงกับไฟล์ปัจจุบันทุกไบต์ ⇒ ไม่มี hand-edit ของ session อื่น
  ที่จะถูกทับ จึง regenerate ได้อย่างปลอดภัย
- เปลี่ยนสามจุดคู่กัน: `defaultHnOrderReportId` → `6a9a355c422c1ca95982a1a2` ·
  `hnOrderReportReady` กันที่ `o.patient.hn` แทน `s.orderVisitId(o)` ·
  `hnOrderReportParams` ส่ง `{hn}` แทน `{xparentx}` · tooltip disabled เปลี่ยนตาม
  (LAB เก็บ HN ที่ `order.patient.hn` ต่างจาก X-ray ที่ flatten เป็น `row.hn`)
- `s.orderVisitId` ไม่ถูกลบ เพราะ EMR History และ PDF ใบสั่งตรวจยังใช้อยู่ (เทสล็อกไว้)
- **พิสูจน์ว่าไม่แตะส่วนอื่น:** diff JSON แบบ field-by-field ก่อน/หลัง มี 2 ฟิลด์เท่านั้นที่เปลี่ยน
  (`options/content` tooltip · `options/onCreated` Report ID + สองฟังก์ชัน)
- regenerate `xray-cpoe-worklist-v1.json` ซ้ำหลัง LAB เปลี่ยน (LAB JSON เป็น template ของมัน)
  แล้ว diff ไม่ต่างเลยสักไบต์ ⇒ ไม่รั่วข้ามหน้า
- assertion เดิมใน `test_lab_cpoe_worklist_form.js` เปลี่ยนพร้อมคอมเมนต์ลงวันที่ · เพิ่มเคส
  "ไม่มี Visit ID แต่มี HN → พิมพ์ได้" / "ไม่มี HN → disabled" · เพิ่ม `patient.hn` ใน fixture
- ตอนนี้ไม่มีโค้ด/ฟอร์มไหนเรียก `5256d813009293b480d0a15c` แล้ว (เหลือแค่คอมเมนต์/เอกสาร)
  แนะนำให้เก็บ record ไว้จนกว่า UAT สองหน้าจะผ่าน
- อัปเดต `design/Lab_design.md` และ handoff · เทสผ่าน 14 ชุด + SDForm validator ทั้งสองฟอร์ม
- ต้อง import ฟอร์ม LAB และ X-ray ทับของเดิมก่อน UAT

## [2026-09-04] implementation | LAB Worklist เพิ่มป้ายตัวย่อสิทธิ์การรักษา

- ผู้ใช้อนุญาตให้เพิ่มเฉพาะป้ายสิทธิ์สีเหลืองในคอลัมน์เดียวกับคลินิกและสถานะชำระเงิน โดยห้ามแตะส่วนอื่น
- ตรวจฐานข้อมูลแบบ read-only พบว่า `zdata_cpoe_order.inscl_hos` เป็น array และตัวย่ออยู่ที่ `inscl_item_main.value` เช่น OFC, UCS, CASH; helper เดิมอ่านข้อความจาก array ไม่ได้จึงไม่แสดง
- เพิ่ม `coverageAbbrev(order)` สำหรับ presentation เท่านั้น ย้ายป้ายเข้าแถว context เดียวกัน และกำหนด class สี blue/green/yellow แยกชัดเจนเพื่อรักษาสีเดิม; `coverage()` เดิม, API projection, Receive, Result, Reject และ Agent flow ไม่เปลี่ยน
- อัปเดต generator, generated LAB Worklist JSON และ regression assertions; Form test, Worklist API test, SDForm validator และ `git diff --check` ผ่าน
- Runtime pending: import `Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json` ทับ Form เดิมแล้ว hard-refresh

## [2026-09-04] implementation | LAB Worklist แยกสิทธิ์รักษากับชำระเงินสด

- เพิ่มเงื่อนไขเฉพาะป้าย context ตามคำสั่งผู้ใช้: Order ที่มีสิทธิ์โรงพยาบาล non-cash แสดงเฉพาะตัวย่อสีเหลืองและไม่แสดง `ชำระเงินแล้ว`
- `CASH` ไม่แสดงเป็นป้ายสิทธิ์สีเหลือง; แสดง `ชำระเงินแล้ว` เฉพาะเมื่อยอดชำระครบ เช่นเดียวกับ Order ที่ไม่มีสิทธิ์และชำระเอง
- เปลี่ยนเฉพาะ helper/presentation ใน LAB Worklist generator, generated Form และ assertions; API, Receive, Result, Reject และ Agent flow ไม่เปลี่ยน
- Form regression, Worklist API regression, SDForm validator และ `git diff --check` ผ่าน; Runtime ยังต้อง import Form และ hard-refresh

## [2026-09-04] implementation | X-ray Worklist ใช้เงื่อนไขสิทธิ์/เงินสดเดียวกับ LAB

- ผู้ใช้สั่งเพิ่มเฉพาะเงื่อนไขป้ายสิทธิ์/เงินสดจาก LAB ไปยัง X-ray และห้ามแตะส่วนอื่น
- เพิ่ม presentation helper อ่านตัวย่อจาก `finance.coverage[].inscl_item_main.value`: สิทธิ์ non-cash แสดงป้ายเหลืองและซ่อน `ชำระเงินแล้ว`; `CASH`/ไม่มีสิทธิ์แสดงป้ายชำระเงินได้เมื่อยอดครบ
- เปลี่ยนเฉพาะ X-ray generator, generated Form และ targeted assertions; ไม่แก้ API, Process, ปุ่ม, Result, RIS หรือ CPOE flow
- Regenerate โดยคง `CPOE_ORDER_APP_ID=6a995d064744260ea8c9498c`; targeted Form test, SDForm validator และ `git diff --check` ผ่าน
- Runtime pending: import `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json` ทับ Form เดิมแล้ว hard-refresh; ไม่มี DB write/commit/push

## [2026-09-04] implementation | เชื่อมปุ่ม LAB “ตรวจใหม่” กลับไปรอรับ

- เพิ่ม action `retest_order` เฉพาะใน LAB Worklist Process และเชื่อมปุ่มเดิมพร้อม confirm/loading; ทำงานเฉพาะ Item ที่ยกเลิก/ปฏิเสธใน Section ของแถวนั้น
- CPOE Item กลับ `sent`, Work Item เดิมกลับ `waiting_receive`; ไม่แก้ CPOE Order header และไม่ลบผล/ประวัติเดิม
- ย้าย LAB NO. เดิมเข้า `lab_no_history[]`, ล้างเลขปัจจุบัน และตั้ง `retest_pending_lab_no`; เมื่อกด `รับ specimen` จึงเรียก Lab No Generator เดิมออกเลข canonical ใหม่
- Outbound เดิมกลับ `new` และตั้ง `retest_pending_outbound`; Receive rebuild payload ด้วย LAB NO. ใหม่ก่อนส่งซ้ำ โดยคง `attempt_count`, `attempt_history_json` และ snapshot รอบก่อนใน `retest_log`
- Cancellation record เดิมยังอยู่และประทับ `reopened`; มี compare-and-set guard ป้องกันสถานะเปลี่ยนชนกัน
- เปลี่ยนเฉพาะ Worklist/Generator/Receive แขนง retest, Worklist Form generator/generated JSON และ focused tests; flow ปกติยังผ่าน regression
- ผ่าน retest, Lab No, Receive, Worklist Form/API, Cancel, Reject, Agent Submit tests, SDForm validator และ `git diff --check`
- Runtime pending: replace Process `6a9434c3422c1ca959829d5e`, `6a94f1ed422c1ca959829d6e`, `6a94f634422c1ca959829d70`; import LAB Worklist JSON แล้ว hard-refresh; ไม่มี DB write/commit/push

## [2026-09-04] query | ตรวจชุดรับผล Agent และ lis.receive

- ตรวจแบบ read-only พบ canonical receiver `hl7_result_upsert_api.js` Process `6a8da8a6f851000f28e50299`; action ใช้ body `{params:<Agent result>}`
- API เขียน Receipt `6a8b1c03f851000f28e501ef` → Report `6a8d4334f851000f28e5025b` → Result Item `6a8bc91df851000f28e501fb` แล้ว sync Work Item/CPOE; ไม่ควรสร้าง API persistence ซ้ำ
- Local API/schema/tests ผ่าน แต่ยังมี contract ที่ยืนยันแล้วว่าไม่ถูกต้อง: บังคับ `corrected_by/corrected_at` จาก Agent และ auth guard ยังปิดชั่วคราว จึงห้าม deploy body นี้ตรง ๆ
- Mongo read-only connection ไม่เห็น collection ของ live environment จึงเทียบ revision ไม่ได้; ขอ current exports ของสาม Data Forms, Process body/ID, masked External action mapping/scope และ sanitized Agent sample ก่อนแก้
- ไม่มี external request, DB write, code edit, commit หรือ push

## [2026-09-04] query | ศึกษา live exports และบทบาท Result Report Viewer

- ผู้ใช้อัปโหลด live exports ของ Receipt, Report และ Result Item เข้า `Form-Builder/SDForm/Lab/` และอัปโหลด Process `hl7_result_upsert`; screenshots ยืนยัน `lis.receive` เปิดใช้งานและ map ไป Process ดังกล่าว
- Screenshot ยืนยัน `lis-vender` active และ scope มี `lis.receive`, `lis.test`, `lis.submit`; External API ที่ควรใช้คือ action endpoint + `x-api-key` ไม่ใช่ legacy public-token URL ที่ถูกเปิดเผยในข้อความ
- สาม Form exports ตรงกับ `*_Agent_Result_v1.json` เดิมทุกไบต์ยกเว้น newline ท้ายไฟล์ และผ่าน SDForm validator; Receipt filename ใหม่มี leading space จึงยังไม่ rename ตาม misplaced-file gate
- `Result_Report_Manual_Entry` มี ListView `lab_result_items_list` อ่าน Form `6a8bc91df851000f28e501fb` พร้อมปุ่มแก้ไข Item อยู่แล้ว จึงใช้เป็นหน้าหัวผล+รายการได้; Viewer แยกไม่จำเป็นต่อ persistence และ active Worklist ไม่อ้าง ID Viewer
- ยังต้องคงข้อมูล 3 ชั้น: Receipt audit → Report header → Result Item; ห้ามลดเหลือเพียง head/item เพราะจะเสีย `result_uid` idempotency และ raw/unmatched audit
- Uploaded API tests ผ่าน แต่ยังคง incorrect Agent `corrected_by/corrected_at` requirement และ UAT no-role guard; ห้าม deploy ก่อนแก้ contract
- ไม่มี external call, DB write, clinical data change, commit หรือ push
## [2026-09-07] note | เปลี่ยน Codex Mongo MCP ให้ชี้ HIS

- ยืนยันแบบ read-only ว่า connection ใหม่มีฐาน `his`/`his-tmp` และฐาน `his` มี 318 collections; จึงแก้ความเข้าใจว่า MCP alias `HIS` คือ HIS ไม่ใช่ ERP
- ปรับ `~/.codex/config.toml` ให้คง read-only และรับ connection string จาก environment แทนการฝัง URI; ไม่บันทึกรหัสใน repository, wiki, skill, script หรือ Git
- ตั้งค่า environment สำหรับ macOS login session ปัจจุบัน; ต้อง relaunch Codex เพื่อให้ connection `preconfigured` โหลดค่าใหม่ และต้องตั้งใหม่หลัง logout/reboot
- อัปเดต skill/read-only schema notes ให้ default ฐาน `his` สำหรับ `mcp__HIS__*` พร้อมแยก ERP เดิมเป็น historical notes; skill validator ผ่าน

## [2026-09-07] query | ตรวจ dependency ฟอร์มรับผลและ Result Report Viewer

- ตรวจ live HIS แบบ read-only ยืนยันว่า Receipt `6a8b1c03f851000f28e501ef`, Report `6a8d4334f851000f28e5025b` และ Result Item `6a8bc91df851000f28e501fb` เป็น `form_db` ที่เปิดใช้งาน; receiver อ้างทั้งสาม และ Worklist อ้าง Report/Result Item จึงห้ามลบ
- Live receiver ยังบังคับ `corrected_by/corrected_at`, นำค่าไปสร้าง manual-editor audit และคอมเมนต์ role guard อยู่ จึงต้องแก้ contract/security branch ก่อน valid E2E
- Live data count: Receipt 1, Report 0, Result Item 0; ยังไม่มีหลักฐาน clinical result materialization ครบสามชั้น
- `Result Report Viewer` `6a8d5620f851000f28e50270` เป็น `form_ui` ไม่มี collection และไม่ถูกอ้างโดย receiver, Worklist Process หรือ Lab app package ปัจจุบัน; แนะนำ disable + UAT ก่อน hard-delete เพื่อกัน hidden Form reference
- ไม่มี DB write, form/API edit, delete, commit หรือ push
- หมายเหตุ: MCP connection `preconfigured` ยัง authentication failed ใน session นี้; การตรวจใช้ connection read-only ที่ยืนยันแยกไว้ก่อนหน้า

## [2026-09-07] note | ผู้ใช้อนุมัติ surgical fix สำหรับ inbound correction identity

- ผู้ใช้สั่งให้แก้ Agent correction contract/security และขอชื่อของต้นฉบับที่ต้อง Replace
- Active conversation-reset handoff ยังบังคับให้เริ่ม implementation ใน clean task; รอบนี้จึงไม่แก้ Process/Form
- Replacement target ที่ยืนยัน: API Factory Process `hl7_result_upsert_api` id `6a8da8a6f851000f28e50299`; สาม data Forms และ Worklist/Receive/Outbound/Lab No. ไม่ต้อง Replace

## [2026-09-07] implementation | แก้ HL7 inbound contract และจัดชุดทดสอบ

- Receiver แยกเฉพาะ Gateway `xpartnerx` ออกจาก clinical payload ก่อน validate/hash/เก็บ raw Receipt; unknown top-level field อื่นยัง fail closed
- เอา `corrected_by/corrected_at` ออกจาก Agent v2 schema/validator; Agent corrected resend อัปเดต current observation row เดิมและรักษา manual `last_edited_*` ที่มีอยู่
- เพิ่ม regression ยืนยันดินสอ HIS ใช้ username ของผู้ใช้ที่ login, แก้ path ของ legacy result tests 3 ไฟล์ และเพิ่ม runner `run_hl7_result_suite.js`
- Runner ผ่าน: Node 7 ชุด + SDForm validator ของ Receipt/Report/Result Item 3 ไฟล์; dry-run corrected/legacy-corrector ผ่าน และ `git diff --check` ผ่าน
- Deployment เปลี่ยนเฉพาะ Process `6a8da8a6f851000f28e50299`; valid clinical E2E ยังรอหลัง Replace และยังไม่ยิง external/เขียน DB/commit/push

## [2026-09-07] note | ผู้ใช้ยืนยัน Replace HL7 receiver แล้ว

- ผู้ใช้รายงานว่า Replace Process `6a8da8a6f851000f28e50299` เรียบร้อย
- ขั้นถัดไปคือ no-write `invalid --send`; หากผ่านจึงใช้ UAT Work Item เฉพาะสำหรับ partial → duplicate → final → corrected และตรวจ Receipt/Report/Result Item/Work Item/CPOE แยกชั้น

## [2026-09-07] query | ตรวจของ live ที่ผู้ใช้วางทับ — X-ray ฝั่งเราตรง ฝั่งทีมยังเหมือนเดิม

- ผู้ใช้วางไฟล์ live ทับใน `Form-Builder/SDForm/X-ray/` และ `Form-Builder/API/api-factory/`
  (timestamp 14:15–14:19) แล้วให้ตรวจ · ไม่มี Mongo MCP ใน session นี้ จึงตรวจจากไฟล์ล้วน
- **X-ray Workbench Form ตรงกับ local เป๊ะ:** เทียบ field-by-field ได้ **0 ฟิลด์ต่าง**
  ต่างแค่ลำดับ key/การจัดรูปแบบซึ่งเป็นของ exporter ⇒ ไม่มีใครแก้ในหน้าจอทับ generator
  ยืนยัน: ปุ่ม HN ใช้ `6a9a355c422c1ca95982a1a2` และส่ง `hn` · ไม่มี `5256d813009293b480d0a15c` แล้ว ·
  `CPOE_ORDER_APP_ID` = `6a995d064744260ea8c9498c` · `REJECT_PROCESS_ID` ยังว่างตามคาด
- X-ray suites 8 ชุดผ่านกับซอร์สที่วางมาใหม่
- **ปัญหาสัญญาฝั่งทีม 4 ใน 5 ข้อยังอยู่เหมือนที่บันทึกไว้ 2026-09-02:**
  1. `xray-api-ris-result` insert ทุกครั้ง (คอมเมนต์บรรทัด 64 ระบุเอง)
  2. ไม่ตรวจว่า `AccessionNo` มีจริง — validate แค่ว่ามีค่า
  3. `xray_resultreset` เลือกแถวด้วย `AccessionNo` อย่างเดียว ไม่กรอง `xrstatx` ไม่เรียงลำดับ
     ⇒ เมื่อรวมกับข้อ 1 ที่ทำให้มีหลายแถว จะ reset แถวไหนก็ไม่แน่นอน
  4. `xray-api-ris-schedule` ยังบังคับ `PatientSsn` 13 หลัก + `AdmissionNo` ⇒ นัด OPD ไม่ได้
  5. 🔒 public token **หายจากซอร์สแล้ว** เหลือแค่คอมเมนต์อธิบาย — ข้อเดียวที่ดีขึ้น
- `xray_api_order` ยังหา `AccessionNo` โดยไม่กรอง `xrstatx` (บรรทัด 107) ตามที่เคยบันทึก
- ไม่ได้แก้ไฟล์ใด ๆ ในรอบนี้ · UAT checklist 78 ข้อยังไม่ติ๊ก

## [2026-09-07] note | อ่าน RIS data dictionary ฉบับเต็ม — ปิดคำถามได้ 3 ข้อ เจอ message ที่ยังไม่ได้ทำอีก 12

- ผู้ใช้ส่ง `Interface data dictionary_RestFUL_ร.พ.เด็ก` rev.3 (2024-04-10 · Chainarong)
  พร้อมสั่งว่า **ให้ศึกษาก่อนแก้ API ฝั่ง RIS** ⇒ รอบนี้ไม่แก้โค้ดเลย บันทึกเป็น reference อย่างเดียว
- **ปิดคำถามได้:** Q3 `Status` บนแถวผล = `P` Prelim / `F` Finalized · Q4 `ResultText`
  มีฟิลด์เดียว แยก Findings/Impression ไม่ได้จริง · Q5 ครึ่งหนึ่ง `RadiologistUid` map ผ่าน
  Doctor service `GetEmployee` → `DoctorUid`
- **ยืนยัน D-X9 ทิศทาง:** catalogue มี `Order Cancel` เป็น message แยก และ Order มีฟิลด์
  `IsDeleted` (bit · default false) ⇒ สมมติฐาน `IsDeleted: true` ถูก
- **ต้องกลับด้านข้อ 4 ของหัวข้อ 2:** dictionary กำหนด `PatientSsn`/`VisitNo`/`AdmissionNo`
  required **ทั้ง Order และ Schedule** ⇒ schedule ที่เข้มคือตรงสัญญา ส่วน order ที่ทีมผ่อนคือส่วนเบี่ยง
  ประเด็นจริงคือ OPD ไม่มี `AdmissionNo` ต้องคุยระดับสัญญา
- **เจอ message ที่ยังไม่ได้ทำ 12 ตัว** จากทั้งหมด 17: Patient Register/Edit/Merge ·
  Patient Request Data (Visit/Allergy/Lab) · Order Edit/Cancel · Schedule Edit/Cancel ·
  Result Edit/Addendum · master pull 4 ตัว (InsuranceType/Unit/Doctor/Exam)
- **สมมติฐานใหม่ต่อ Step 5:** เอกสารบอกว่า HIS ต้องส่ง Patient Register ทุกครั้งที่ลงทะเบียน
  แต่เราส่งข้อมูลผู้ป่วยฝังไปกับ Order เท่านั้น ⇒ ถ้า RIS ต้องมีผู้ป่วยก่อนจึงรับ Order
  นี่อาจเป็นสาเหตุที่ใบแรกยังลง RIS ไม่ได้ · **ต้องถามทีมก่อน ห้ามแก้จากการเดา**
- ค่าคงที่ที่ยืนยัน: `AA/AR/AE` · `M/F/U` · `O/I/E` · Order `Status` `N/A` (ต่างจาก status change `A/C`) ·
  Result Reset `Status` `C` · `Priority` `R/S/U` (`S = State` ยังกำกวมเหมือนเดิม) · วันที่เป็น ค.ศ. ทุกช่อง
- endpoint ทุกตัวอยู่ฝั่ง RIS `.../EnvisionRIE3rdParty/ThirdParty/Get*` และเป็น **POST ที่เราส่งเข้าไป**
  แม้ชื่อจะขึ้นต้นด้วย `Get`
- ยังไม่มีคำตอบ: `SeverityUid` ไม่มี master · ความหมาย `*`/`**`/`***` ไม่ได้นิยาม ·
  URL ของ Schedule/Status Change/Result/Result Reset ว่างในเอกสาร · D-X17 ยังไม่มี URL ภาพ
  (แต่แคบลงเหลือ "ขอรูปแบบ viewer URL ที่ผูกกับ AccessionNo")
- บันทึกทั้งหมดไว้ที่ `Form-Builder/SDForm/X-ray/ris-integration-plan.md` §5 (ตารางสถานะ) และ §7 (ใหม่)
  ตัวไฟล์ dictionary ยังไม่ได้เก็บเข้ารีโป

## [2026-09-07] implementation | แก้ Process ฝั่งทีม RIS ให้เส้นทางยกเลิก/ถอนผลทำงานได้

- ผู้ใช้สั่ง "แก้จริงตามเราให้ทำงานได้" หลังให้ศึกษา `xray-api-ris-schedule.js` เป็นอ้างอิง
- **`xray_resultreset.js`** — เดิมหาแถวผลอ่านด้วย `AccessionNo` อย่างเดียว ไม่เรียงลำดับ
  ไม่กรอง `xrstatx` ⇒ เพราะ result endpoint insert ใหม่ทุกครั้ง หนึ่ง accession จึงมีหลายฉบับ
  แล้วถอนผลผิดฉบับได้ · แก้เป็นค้นเองด้วย `dbFindAll` เลือกฉบับล่าสุดด้วยลำดับเดียวกับที่
  `xray_cpoe_worklist_api.js` ใช้ (`ResultDateTime` → `xupdatx` → `_id`) + กรอง `xrstatx`
  · คงเส้นทางสำรอง `sdformGetOne` ไว้เผื่อ runtime ไม่มี `dbFindAll` และกันไม่ให้หยิบแถว `xrstatx:3`
- **`xray_api_order.js`** — `data.IsDeleted` เดิมถูกเขียนทุกครั้งแม้ไม่ได้ส่งมา ⇒ ได้ `false` เสมอ
  ⇒ ใบที่ยกเลิกด้วย `IsDeleted:true` ฟื้นคืนเงียบ ๆ ทุกครั้งที่มี update ตามมา ซึ่งพัง D-X9
  · แก้เป็น "ไม่ส่งมา = ไม่แตะค่าเดิม" แถวใหม่ยังตั้งต้น `false` เหมือนเดิม
  · `xrstatx = 1` ตั้งเฉพาะตอน insert ไม่ปลุกแถวที่ถูกลบแล้ว
- **`xray-api-ris-schedule.js`** — ตัด `PatientSsn`/`AdmissionNo` ออกจาก required ให้ตรงกับ
  `xray_api_order` (ยังตรวจรูปแบบ 13 หลักเมื่อส่งมา) ⇒ นัดผู้ป่วยนอกได้แล้ว
  · `IsDeleted`/`xrstatx` ใช้กติกาเดียวกับ order
- **ตั้งใจไม่แก้ `xray-api-ris-result.js`** — คง insert ทุกครั้งเพื่อไม่ให้ประวัติผลอ่านหาย
  และไม่เพิ่มการปฏิเสธเมื่อ `AccessionNo` ไม่มีใบสั่ง เพราะจะทำให้ผลที่มาก่อนใบหายไปเลย
- **เขียนเทสใหม่ `test_xray_ris_team_apis.js`** — ไฟล์ทีมสามตัวนี้ไม่เคยมีเทสคุมเลย
  ล็อกทั้งของที่แก้และของเดิม: ack shape · required · enum · การแกะ wrapper/`params[Field]` ·
  IsDeleted ทุกรูปแบบ · audit ลงก่อน update · fallback ตอนไม่มี `dbFindAll` · result ยังไม่ upsert
- เทส X-ray ผ่าน 11 ชุด · อัปเดต `ris-integration-plan.md` §3 (ข้อสรุปเดิม "ไม่ต้องแก้" ถูกแทนที่
  พร้อมเก็บของเดิมไว้เป็นบันทึก)
- ยังไม่ได้ deploy · ต้องแจ้งทีม RIS ก่อนเพราะพฤติกรรม `IsDeleted` เปลี่ยนจริง

## [2026-09-07] implementation | Blocked unsafe partial UAT and fixed result-code precedence

- Read-only HIS verification reconfirmed Work Item `6a956902422c1ca959829e3c`, LAB NO.
  `106909010002`, as a clean Ammonia UAT candidate: Work Item `received`, CPOE Item `sent`,
  and zero active Receipt, Report, or Result Item.
- DB evidence shows the CPOE `item_code=C64` differs from the exact outbound Agent
  `test_code=10C64EB`. The live receiver still prioritized `item_code`, which would either reject
  a real Agent code after creating an unmatched Receipt or require an artificial UAT-only code.
- Changed local `hl7_result_upsert_api.js` to prioritize outbound `test_code` before fallback
  identifiers, and strengthened the regression fixture so `item_code` and `test_code` differ.
- Added `post_lis_receive_uat_from_db.py`: it reads identities in memory, hides HN/VN/secrets,
  verifies the clean DB state and live Process mapping, and refuses to send until the corrected
  Process has been deployed.
- Full HL7 suite passes. Live Process is still the old mapping, so no partial request or HIS write
  was made. Next: replace Process `6a8da8a6f851000f28e50299`, verify live mapping, then run the
  controlled partial UAT from the user's Terminal where `LIS_RECEIVE_APIKEY` is already exported.

## [2026-09-07] note | Corrected live mapping and partial UAT preflight verified

- User reported replacing Process `6a8da8a6f851000f28e50299`; the DB-backed runner verified the
  live body now prioritizes outbound `test_code` before CPOE `item_code`.
- UAT preflight for LAB NO. `106909010002` passed: Work Item `received`, CPOE Item `sent`, no
  existing Receipt/Report/Result Item, and outbound-matched `obs_code=10C64EB`.
- The generated value is the explicit non-clinical marker `UAT-PARTIAL`; HN/VN remain in memory
  and are never printed or persisted in repository files.
- Codex's process has no `LIS_RECEIVE_APIKEY`; the key exists only in the user's Terminal session.
  Therefore the preflight remained dry-run and made no network request/HIS write. The user must run
  `python3 Form-Builder/seed/tests-tools/scripts/post_lis_receive_uat_from_db.py --send` in that
  Terminal; the runner will then POST and perform read-only persistence verification.

## [2026-09-07] fix | Partial UAT 403 isolated to gateway transport

- The first DB-backed partial POST returned HTTP 403 with no Process code. A read-only DB check
  found no Receipt/Report/Result for `UAT-HL7-106909010002-PARTIAL-001`; the latest
  `log_api_external` record is still the earlier `legacy-corrector` smoke at 14:38, proving the
  rejected request never reached `lis.receive`.
- Replaced Python `urllib` in `post_lis_receive_uat_from_db.py` with Node `fetch`, matching the
  transport that previously reached the gateway with the same Terminal key. The key remains only
  in the inherited environment and is never passed in argv, stdin, or printed output.
- Added sanitized outer/gateway response fields and a read-only DB count after failed POST.
  `py_compile`, DB-backed dry-run, `git diff --check`, and a local mock POST that verifies the
  API-key header plus JSON body all pass.
- UAT candidate remains clean and safe to retry with the same command. If Node transport still
  receives 403, treat the API key or gateway policy as the remaining cause before any valid POST.

## [2026-09-07] note | Live partial-result UAT passed; duplicate replay prepared

- User reran the DB-backed partial through Node transport. Gateway returned HTTP 200 and Process
  `PROCESSED` with trace `20260907152405-upgxmz`; one `10C64EB` item matched, with no unmatched
  codes or warnings.
- Independent read-only DB verification found the same processed Receipt, partial Report, one
  Result Item containing the non-clinical marker `UAT-PARTIAL`, Work status `resulted`, and CPOE
  status still `sent`. The blank response `cpoe_status` is intentional for in-progress results;
  CPOE sync occurs only on final/corrected/cancelled.
- Extended `post_lis_receive_uat_from_db.py` additively with `--case duplicate`. It retrieves the
  exact original clinical payload from the processed Receipt in memory, validates its target, and
  expects `DUPLICATE_RESULT_UID`, `created:false`, `duplicate:true`, unchanged IDs, and 1/1/1 DB
  counts. HN/VN and the stored raw payload remain hidden.
- Duplicate dry-run, Python compile, diff check, and the complete offline HL7 suite pass. Next:
  execute the duplicate case from the user's Terminal where the API key is exported.

## [2026-09-07] note | Live result idempotency passed; final UAT prepared

- User executed the duplicate partial replay. Gateway returned HTTP 200 and Process
  `DUPLICATE_RESULT_UID` with trace `20260907152944-4t603n`, `created:false`, and
  `duplicate:true`.
- Runner and an independent read-only DB check both confirmed the original Receipt/Report IDs and
  counts remained Receipt=1, Report=1, Result Item=1. Work remains `resulted`; CPOE remains `sent`.
- Extended the same runner additively with guarded `--case final`: requires the exact processed
  partial state, refuses an existing final UID, sends report/receipt/result version 2 with the
  non-clinical marker `UAT-FINAL`, and verifies Receipt/Report, the same normalized Result Item,
  Work completion timestamp/status, and CPOE `completed` after POST.
- Final dry-run, Python compile, diff check, and the complete offline HL7 suite pass. Next: execute
  `--case final --send` from the user's Terminal.

## [2026-09-07] note | Live final result passed; corrected UAT prepared

- User executed final result UAT. Gateway returned HTTP 200 and Process `PROCESSED` with trace
  `20260907153438-afo57s`; one item matched, the existing normalized Item was updated rather than
  duplicated, and there were no warnings.
- Independent read-only DB verification confirmed Receipt=2, Report=2, Result Item=1; final Report
  seq 2/completed; Item `UAT-FINAL`, version 2/final; Work and CPOE completed; completion time set.
- Extended the runner additively with guarded `--case corrected`. It requires that exact final
  state, refuses an existing corrected UID, sends report/receipt/result version 3 without the
  HIS-only `corrected_by`/`corrected_at`, and checks that the same Item becomes corrected while
  Work/CPOE and the original completion time remain preserved.
- Corrected dry-run, Python compile, diff check, and complete offline HL7 suite pass. Next: execute
  `--case corrected --send` from the user's Terminal.

## [2026-09-07] note | Live corrected result passed; controlled inbound UAT complete

- User executed corrected result UAT. Gateway returned HTTP 200 and Process `PROCESSED` with
  trace `20260907154623-ejer1z`; one item matched, zero items were created, one normalized Item was
  updated, and there were no unmatched codes, sync-pending state, or warnings.
- Independent read-only DB verification confirmed 3 processed Receipts, 3 Reports, and 1 Result
  Item. The corrected Report is seq 3/corrected; the same Item ID now contains the non-clinical
  marker `UAT-CORRECTED`, version 3/corrected. Work/CPOE remain completed and completion time is
  preserved.
- Controlled one-item inbound UAT now covers schema/auth, partial persistence, duplicate
  idempotency, final completion/status sync, and corrected overwrite/history linkage. It does not
  establish production readiness; real Agent/LIS round trip, multi-item, critical, UI/viewer,
  permission, and concurrency coverage remain.
- No commit was made: context had compacted and the shared dirty worktree contains substantial
  pre-existing changes in the same log/Process/test paths, so the task-owned diff cannot be staged
  safely without including unrelated work.

## [2026-09-07] implementation | Matched Worklist result UI and added Report attachments

- Updated the embedded Worklist result dialog toward the approved HTML mockup: mockup-style
  header, visible SVG pencil action, current/prior result columns, multi-row inline correction,
  and a scrollable body that keeps `ไฟล์แนบผลตรวจ` below arbitrarily long result tables.
- Existing canonical Agent/LIS Result Items can now be corrected after specimen receipt through
  completed status. Only value/unit/interpretation/reference range plus latest HIS editor/time
  change; result source/status and explicit critical decision remain unchanged. Mycology can still
  create its first Manual result through the existing path.
- Reused the proven `test_widget_uploadfile.json` export for Result Report fields and the built-in
  `/v1/files/form-upload` lifecycle. The current PDF/JPG/JPEG/PNG metadata array is limited to
  10 MB/file, 3 files and 30 MB total, stored in a stable Work Item attachment Report, and does not
  change LAB/CPOE status.
- Preserved historical widget-ID ranges for Result Item and Receipt when regenerating forms.
  Targeted result-form, Worklist Form/API tests, full offline HL7 suite and SDForm validation pass.
  The unrelated wildcard suite still stops at its pre-existing missing
  `Lab_Workbench_Tab_List_OPD_Draft.json` fixture.
- Deployment remains manual and ordered: re-import/replace the existing Result Report Form, deploy
  Worklist API, then replace/publish Worklist Form. Builder/Preview and deployed upload/edit/reopen,
  gateway MIME/size enforcement and permissions UAT remain pending. No commit was made in the
  shared dirty worktree.

## [2026-09-07] fix | Aligned deployed result popup with the approved HTML

- User screenshot confirmed the prior Worklist version was deployed with the pencil action and a
  successfully listed PDF attachment, but its result popup still differed from the approved
  `lab-workbench-stock-pattern-mockup.html`.
- Changed presentation only: removed the patient-summary card and the extra result-count heading,
  moved the square pencil and mode badge beside the title, restored the 1040 px dialog/table
  proportions, added the profile row, and removed repeated labels/code/audit-time text inside each
  data row. Column wording/order and neutral result styling now follow the mockup.
- Kept the attachment section below the table and reused every existing edit/upload handler.
  No API, persistence, Receive, Agent, critical decision, status or permission logic changed.
- Regenerated only the Worklist Form candidate. Form regression, SDForm validation and diff check
  pass; deployed visual UAT still requires replacing/publishing the Worklist Form.

## [2026-09-07] implementation | Added one-order multi-item X-ray dispatch

- Changed the X-ray dispatch Process additively to accept `item_ids[]` (up to 50) while preserving
  the existing single `item_id` path. The server preflights the selected set, then issues an
  accession and sends one flat RIS order per item in sequence; the RIS contract itself is unchanged.
- Added aggregate response counts and per-item outcomes. A transport failure does not roll back
  received items or stop later items, and invalid/cross-order IDs block the batch before mutation.
- Fixed mapping needed by the verified live three-item UAT order: DOB now falls back to
  `vid.birth_date`; Select objects use display labels for patient title/reference unit.
- Added a no-PHI multi-item runner that defaults to dry-run and requires `--send --confirm-write`
  plus environment credentials for a live mutation/send. Read-only HIS inspection confirmed one
  active three-item DX order is still `sent`; no live dispatch was performed.
- All 11 X-ray test suites, runner syntax/guard, and the real-ID dry-run pass. Deployment and live
  RIS UAT remain pending.

## [2026-09-07] verification | Audited first fresh Agent LAB callback in HIS

- Read-only DB inspection confirmed the Agent callback persisted exactly one processed Inbound
  Receipt, one final Result Report and one normalized Result Item, with no duplicate receipt/report,
  unmatched observation, missing expected observation or warning.
- The returned test code and LAB NO. matched the intended LAB Work Item and CPOE Item; both item
  statuses are `completed` and the callback is complete for that single Work Item.
- The parent CPOE Order contains two LAB Items and still reads `sent`. The matching Outbound audit
  row also retains its earlier timeout/`hl7_status=new`; the later inbound callback did not reconcile
  delivery audit state or aggregate the parent Order status.
- No database writes, external sends, code changes or commits were made for this audit.

## [2026-09-08] implementation | Reconciled LAB result status after verified Agent callback

- Extended the result receiver post-processing without changing its payload, auth, matching,
  specimen or clinical persistence flow. A verified partial/final callback now advances the exact
  Outbound to `in_progress`/`resulted`, closes active retry/error fields and preserves its immutable
  failed-attempt history.
- Final/corrected results still complete only their CPOE Item. The Parent CPOE Order advances to
  `completed` only after every active child Item is completed; pending siblings leave it unchanged.
- A processed duplicate may rerun operational reconciliation from the stored Receipt identity and
  status, never from a potentially mutated retry body, and creates no new clinical records.
- Status repair is best-effort after clinical persistence. Failures return sync warnings instead of
  rolling back or hiding a successfully stored result.
- Receiver suite, Receive/Agent Submit/LAB NO. regressions and diff checks pass. Deployment and a
  duplicate replay against the existing Agent callback remain pending. No DB write or live send
  was performed.

## [2026-09-10] fix | Restored the contrast-media checkbox groups (options must match a system template)

- Symptom the user reported with Builder screenshots: **every checkbox group vanished** in
  `xray-contrast-media-record-v1.json` — the unhidden ones (`exam_items`, `contrast_types`,
  `route_types`) as well as the Acute/Delay lists that should appear after Extravasation = Yes.
  Only the section headings, the time picker and the notes field showed, so it was never a
  `setShown` bug: the widget was never rendered.
- Root cause: `checkbox-input` is the only component in the form with **no system template** in
  `Form-Builder/SDForm/sdform_module/`. Its 22-key `options` shape had been copied from
  `lab_order_mock_import.json`, a mock we wrote ourselves and never proved renders. The sibling
  widget `radio-input` has 13 genuine system templates, all with the **same 29 keys** (matching the
  validator's own SNAPSHOT), and the radio in this very form renders. The checkbox was missing 7 of
  them: `labelAlign`, `validation`, `validationHint`, `labelIconClass`, `labelIconPosition`,
  `labelTooltip`, `labelColor` ⇒ SDFORM_JSON_RULES condition ก (incomplete options ⇒ no render).
- The earlier conclusion recorded in the generator ("checkbox must not use `common()` because extra
  keys hide the group") was wrong and is corrected in place, with the evidence, not deleted.
- Fix: all 5 checkbox groups are now built from `common()` exactly like the radio, giving the same
  29 keys, with presentation values left at template defaults (`border:false`, `showCol:0`,
  `displayStyle:''`, `customClass:''`). The "one choice per line" CSS hook moved off the widget to
  `formConfig.customClass: ['cmr-form']` — system forms always store `customClass` as an **array**
  (`["mb15"]`), and every non-empty *string* `customClass` in the repo sits in a form that does not
  render (card, file-upload). If the class never lands, choices simply flow normally instead of
  disappearing.
- Guards added (both proven by tampering): the form test now pins every checkbox's key set to the
  system `radio-input` template and rejects any non-empty string `customClass` on any widget; the
  shared validator gained a `SIBLING` fallback so `checkbox-input` is checked against `radio-input`
  instead of being waved through with a warning. `lab_order_mock_import.json` is no longer treated
  as evidence in the test's precedent scan.
- Verified: contrast-media form test ✅, validator ✅ (was 5 "no template" warnings, now checked),
  validator output identical on the other 110 SDForm files, 12/15 X-ray tests pass. The 3 failures
  (`dispatch_api`, `order_ris_params`, `ris_team_apis`) are pre-existing and untouched — they compare
  team-owned RIS artifacts and reference none of the files changed here.
- Still unproven: whether the form renders in the real Builder. Needs a re-import of
  `xray-contrast-media-record-v1.json` (Form ID `6aa2424809c1bad08952da71`).

## [2026-09-11] fix | X-ray worklist urgency tag now names the level the order carries

- Reported: on the X-ray CPOE Worklist the red tag beside the HN always read "เร่งด่วน", whichever
  urgency the doctor picked in the CPOE Order App (ปกติ · ด่วน · ด่วนที่สุด · ด่วน OR · ด่วน อุบัติเหตุ).
- Confirmed the screen from live data (read-only): HN `6900040` ณรงฤทธิ อดิศักดิ์ไพศาล →
  order `R2609100002`, item `RD020 Skull AP`, `xunitx = m0900 กลุ่มงานรังสีวิทยา`,
  `zdata_cpoe_order.priority = '2'` (= ด่วน) but rendered as "เร่งด่วน".
- `zdata_cpoe_order.priority` holds the CPOE code as a string — distinct values in HIS today:
  `'1'` ×126, `null` ×70, `'2'` ×6, `'4'` ×1. Both worklist Processes already project it verbatim
  (`priority: '$order.priority'`), so no API change was needed — the bug was display-only.
- Fix (display layer, additive): added `PRIORITY_LABEL` (2–5 → ด่วน · ด่วนที่สุด · ด่วน OR · ด่วน อุบัติเหตุ),
  `s.priorityCode()` and `s.urgentLabel()`; the row now carries `urgent_label` alongside the existing
  `urgent`, and the tag renders `{{ row.urgent_label }}`.
- Nothing removed: `s.isUrgent()` keeps its exact old truth table, `row.urgent` still decides whether
  the tag appears, and an unknown value (`urgent`, `STAT`, anything not 1–5) still falls back to the
  old word "เร่งด่วน". A Thai level name sent straight from the server is shown as sent.
- Edited the generator `build_xray_cpoe_worklist_ui.js` (proven idempotent first, so a re-run cannot
  silently revert the fix), then regenerated `xray-cpoe-worklist-v1.json`.
- Verified: X-ray worklist form test ✅ (8 new behaviour assertions + 3 static guards, guards proven
  by tampering the JSON back to the old tag → test fails), SDForm validator ✅ (same two pre-existing
  warnings), 12/15 X-ray tests pass — the 3 failures (`dispatch_api`, `order_ris_params`,
  `ris_team_apis`) are the pre-existing team-RIS ones and reference none of these files.
- Not touched, same bug present: `Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json` has the
  identical `isUrgent` + hardcoded "เร่งด่วน" tag. Left alone pending the user's go-ahead because it
  sits in the pending LAB deploy bundle.
- Not yet proven: the re-imported Form in the real Builder/runtime.

## [2026-09-11] fix | Restored the "พิมพ์ HN" print-agent button on the X-ray worklist

- ผู้ใช้ทักว่าแถว Order เคยมี 4 ปุ่ม เหลือ 3 แล้วส่งฟอร์มที่ deploy อยู่จริง (`x-ray-module.json`)
  มาเทียบ สั่งว่า "เอามาแค่ปุ่มนั้นปุ่มเดียว"
- ตรวจแล้ว **รอบแก้ป้ายความเร่งด่วนไม่ได้ลบอะไร** — diff ก่อน/หลังรอบนั้นคือ 14 บรรทัด เรื่อง
  urgency ล้วน ปุ่มหายไปตั้งแต่ก่อนหน้านั้น: ฟอร์มในระบบมีปุ่มที่เพิ่มด้วยมือเมื่อ 2026-09-10
  แต่ไม่เคยย้อนกลับเข้ามาที่ generator ในรีโป
- เพิ่มกลับแบบ additive ล้วน (diff JSON = +96 บรรทัด, −0):
  · เทมเพลต: `el-button.xr-hn-print` "พิมพ์ HN" วางระหว่างปุ่ม HN กับ EMR
  · onCreated: `HN_LABEL_PRINTER='HN/VN Sticker'` · `hnPrinting`/`setHnPrinting` ·
    `printAgent()` · `hnPrintHint()` · `printHnLabel()` — โค้ดยกมาตรงจากฟอร์มจริง
  · CSS: `.xray-cpoe .xr-hn-print{white-space:nowrap}`
  · root field ใหม่: `local-agent-ui` ชื่อ `local_agent` (`agentKind:'printer'`, 127.0.0.1:8766)
    — ปุ่มเรียก agent ผ่าน `getFieldRef('local_agent')` เท่านั้น ถ้าไม่มีตัวนี้ใน JSON
    การ import ทับจะลบ agent ออกจากฟอร์มและปุ่มจะใช้ไม่ได้
- **token ของ agent:** รอบแรกผมตั้งเป็นค่าว่างตาม Guardrails "ห้ามเก็บ credential" แล้วทักท้วง
  ผู้ใช้ยืนยันให้ใส่ค่าจริง ("เอา token เอาอะไรของ agent ใส่มาให้เลย") ⇒ ใส่ค่าจากฟอร์มจริงลงไป
  วิดเจ็ตตอนนี้ตรงกับของที่ deploy อยู่ **ครบทั้ง 27 option key** (เทียบทีละคีย์แล้ว)
  เทสตรึงค่า token ไว้ ไม่ให้ generate แล้วกลายเป็นค่าว่างเงียบ ๆ จน agent ไม่เชื่อมต่อ
  override ด้วย `XRAY_LOCAL_AGENT_TOKEN` ได้ถ้าเครื่องอื่นใช้ token คนละตัว
  🔴 ไฟล์ generator + JSON มี token อยู่ ⇒ ห้าม push ขึ้นที่สาธารณะ (ตอนนี้ยัง untracked ทั้งคู่)
- 🔶 **ความต่างที่ยังไม่แตะและต้องให้ผู้ใช้ตัดสิน:** ฟอร์มจริงเปลี่ยน `HN_ORDER_REPORT_ID`
  กลับเป็น `5256d813009293b480d0a15c` เมื่อ 2026-09-10 (คอมเมนต์ในฟอร์มบอกว่าตัวนี้รับ `hn`
  แล้ว และเป็นสติ๊กเกอร์ 80×20 มม. custom 247×67 pt) ส่วนรีโปยังเป็น `6a9a355c422c1ca95982a1a2`
  ตามงาน 2026-09-04 · รอบนี้ **ไม่เปลี่ยน ID** ตามคำสั่ง "แค่ปุ่มเดียว" ⇒ ปุ่มพิมพ์ใช้ Report
  ตัวเดียวกับปุ่ม HN ของรีโป ถ้าต้องการให้ตรงกับของจริงต้องสั่งเปลี่ยน ID แยกอีกรอบ
- ไม่มีอะไรหาย: ปุ่ม PDF · HN (sd-report) · EMR · ตรวจใหม่ · สติ๊กเกอร์ HN ระดับ item อยู่ครบ
  เทสเดิมทุกข้อยังผ่านโดยไม่ถูกลดความเข้ม · assertion เดียวที่แก้คือ `form.fields.length` 2→3
  พร้อมคอมเมนต์ลงวันที่และผู้สั่ง (กติกา §14b)
- Verified: form test ✅ (+2 guard พิสูจน์ด้วยการ tamper — ใส่ token ปลอม และลบ widget agent
  แล้วเทสแดงทั้งคู่) · validator ✅ (warning เพิ่ม 1 ข้อ: `local-agent-ui` ไม่มีฟอร์มแม่แบบให้
  เทียบ ชนิดเดียวกับ `scan-code-ui` เดิม) · generator idempotent · X-ray 12/15 ผ่าน
  (3 ตัวที่แดงคือ dispatch/ris_params/ris_team_apis ของเดิม ไม่ได้แตะ)
- ยังไม่พิสูจน์: การพิมพ์จริงผ่าน agent หลัง re-import

## [2026-09-11] fix | Removed the order-level HN PDF button from the X-ray worklist

- ผู้ใช้สั่ง "เอาปุ่มนี้ระดับ Order เราออกไปเลย" (ปุ่ม `HN` ที่เป็น `<sd-report>` เปิด PDF)
  หลังได้ปุ่ม "พิมพ์ HN" ที่กดแล้วพิมพ์ทันทีผ่าน print agent — ปุ่มสองตัวทำเรื่องเดียวกัน
- เอาออกเฉพาะ `${hnOrderPdfAction}` ในแถบปุ่ม · **คงนิยามของมันไว้ในตัว generator**
  พร้อมคอมเมนต์ลงวันที่ เอากลับมาได้ด้วยการใส่กลับบรรทัดเดียว
- 🔴 `HN_ORDER_REPORT_ID` / `hnOrderReportReady` / `hnOrderReportParams` / `hnOrderReportList`
  **ไม่ได้ลบ** เพราะปุ่มพิมพ์ HN ใช้ทั้งสามตัวแรกอยู่ (Report ที่พิมพ์ · ตัว disable ·
  ข้อความ tooltip) ถ้าลบตามไปปุ่มพิมพ์จะพังทันที เทสล็อกสองตัวไว้แล้ว
- แถว Order ตอนนี้: **PDF · พิมพ์ HN · EMR** (ใบที่ยกเลิก = ตรวจใหม่)
  สติ๊กเกอร์ HN ระดับ item ไม่ถูกแตะ ยังอยู่ในตารางที่กางออกมา
- assertion เดิม 3 ข้อของปุ่ม HN ถูกกลับด้าน/ตัด พร้อมคอมเมนต์ว่าใครสั่งและเมื่อไหร่ (§14b)
  สิ่งที่มันเคยปกป้องย้ายไปคุมที่ปุ่มพิมพ์แทน (Report ID ถูกตัว · ไม่มี HN ⇒ disabled)
  และเพิ่มตัวนับปุ่มในแถบ `xr-row-actions` = 5 element ตรึงรูปร่างแถวไว้เป๊ะ
- Verified: form test ✅ (guard พิสูจน์ด้วย tamper — แอบใส่ปุ่ม HN กลับ เทสแดงทันที) ·
  validator ✅ warning เท่าเดิม · generator idempotent · X-ray 12/15 ผ่าน
  (3 ตัวที่แดงคือ dispatch/ris_params/ris_team_apis ของเดิม ไม่ได้แตะ)

## [2026-09-11] fix | Machine filter wraps instead of squeezing the X-ray toolbar

- ผู้ใช้ส่งภาพหน้าจอจริง: เลือกเครื่อง 6 ตัว (DX MG US VCUG MR CR RF) แล้วช่องเลือกยืดออกข้าง
  จนทับปุ่ม Search/Report · สั่ง "เอาเป็นยาวลงมาด้านล่างแทนด้านข้าง" + "เปลี่ยนสี textbox
  และสี text ให้มองเห็นชัด"
- สาเหตุ: `modalitySelectWidth()` โตไม่จำกัดตามจำนวน tag และ CSS ตั้ง `flex-wrap:nowrap`
  ช่องของ grid เป็น `max-content` จึงบวมตามแล้วไปเบียดช่องข้าง ๆ
- แก้ 3 จุด:
  · `MODALITY_MAX_W=360` เป็นเพดานใน `modalitySelectWidth()` (เดิมไม่มีเพดาน)
  · `flex-wrap:nowrap` → `wrap` + `row-gap:3px` · `el-select__wrapper` เป็น `height:auto`
    `align-items:flex-start` เพื่อให้กล่องสูงขึ้นแทนการยืดออกข้าง
  · สีตามที่ขอ: tag เลือกแล้วเป็นฟ้า (`#ecf5ff`/`#a0cfff`/`#337ecc` bold) ชุดเดียวกับป้าย
    คลินิกต้นทางในตาราง · ทั้งกล่อง + label ย้อมฟ้าเมื่อมีตัวกรอง ผ่านคลาส `is-picked`
    ที่ผูกกับ `modality.length` (el-select วาดขอบด้วย box-shadow จึงต้องทับด้วย box-shadow)
- **เจตนาเดิมของกติกา 2026-09-03 ไม่หาย** — ยังเห็น code ครบทุกตัว ไม่ยุบเป็น `+N`
  (`collapse-tags` ยังห้าม, `el-tag{max-width:none}` ยังอยู่) เปลี่ยนแค่ทิศทางการขยาย
  assertion `flex-wrap:nowrap` ถูกกลับด้านพร้อมคอมเมนต์ว่าใครสั่งและเมื่อไหร่ (§14b)
- เทสเพิ่ม: เพดาน 360px เมื่อเลือก 10 เครื่อง · 2 เครื่องยังต่ำกว่าเพดาน · คลาส `is-picked`
  ในเทมเพลต · CSS ของ tag/กล่อง/label ครบ · พิสูจน์ guard ด้วย tamper (แก้กลับเป็น
  nowrap แล้วเทสแดงทันที)
- Verified: form test ✅ · validator ✅ · generator idempotent · X-ray 12/15 ผ่าน
  (3 ตัวที่แดงคือ dispatch/ris_params/ris_team_apis ของเดิม ไม่ได้แตะ)
- ยังไม่พิสูจน์: หน้าตาจริงหลัง import (ต้องเลือกหลายเครื่องแล้วดูว่าปุ่มไม่ถูกเบียดแล้ว)

## [2026-09-15] fix | HL7 result receiver accepts mapped multi-component panel results

- ผู้ใช้ยืนยันให้แก้ receiver หลัง Agent ส่ง Creatinine `100802CD` พร้อมผลย่อย eGFR
  `101120CD` แล้ว callback ไม่สำเร็จ.
- ฝัง allowlist group → local result จาก `catalog-configured-tests-Group.numbers`
  (SHA-256 `d147d6b9785cc7cc7b5695a7132b1798d8bd976b45087e69c6791b796dbf382b`):
  30 group codes, 215 local codes; ไม่พบ local code ซ้ำข้าม group.
- Matching ยอมรับทั้ง ordered code เดิมและ mapped child; code นอก mapping ยัง fail closed
  ด้วย `OBS_CODE_NOT_MATCHED`/`OBS_CODE_PARTIAL_MISMATCH` โดยไม่ materialize ผลบางส่วน.
- Mapping ไม่มี required/optional จึงใช้เป็น allowlist. Final ของ mapping ที่มี ordered code
  อยู่ในชุด (เช่น Creatinine) ยังต้องมี ordered code; panel ที่มีแต่ child codes อาศัย
  Agent `overall_status=resulted` เป็น final authority.
- เพิ่ม regression ครอบคลุม Creatinine+eGFR, unknown sibling rejection, eGFR-only final
  rejection, panel 9 child results และยืนยัน mapping 30/215.
- Verified: `run_hl7_result_suite.js` ผ่านครบโดยไม่ออก network หรือเขียน HIS;
  `git diff --check` ผ่าน. ยังไม่ได้ publish Process บน initCraft และยังไม่ได้ paired UAT.
- ไฟล์ `.numbers` ต้นทางยังอยู่นอก repo ระหว่างรอ path approval ตาม misplaced-file gate;
  แนะนำ `03-source-materials/catalog-configured-tests-group.numbers`.

## [2026-09-15] note | Confirmed rpt-7 collision on live LIS callback

- Agent retried the 9-test Biochemistry callback but still sent `result_uid=rpt-7`.
- Live read-only HIS check confirmed exactly one active Receipt owns `rpt-7`: Receipt
  `6a8fc89b4c725771c62b1bbe`, created 2026-08-27, status `unmatched`, belonging to a
  different synthetic order/LAB NO.; the receiver therefore correctly returned
  `DUPLICATE_UNPROCESSED_RESULT_UID` before order/component matching.
- The target order still has 9 active Work Items in `received` and no Report. Its ordered
  codes all appear in the new payload; eGFR `101120CD` is the mapped child of Creatinine
  `100802CD`.
- Live `module_api` Process `6a8da8a6f851000f28e50299` was updated 2026-09-15 11:06:10
  and contains `RESULT_COMPONENT_CODES_BY_GROUP` plus the Creatinine/eGFR mapping.
- Next: Agent must generate a globally unique `result_uid` for this logical final message.
  Retries after that must reuse that new UID only with an identical body.

## [2026-09-15] note | Clarified LISconnect result UID retry semantics

- ผู้ใช้ยืนยันว่า LISconnect สร้าง UID หนึ่งครั้งต่อผลหนึ่งก้อน และ resend ผลก้อนเดิมด้วย
  UID เดิมเมื่อ API ล้ม; พฤติกรรมนี้ถูกต้องสำหรับ idempotent retry.
- แก้ความเข้าใจก่อนหน้า: ปัญหาจริงของ `rpt-7` ไม่ใช่เพียงการ resend ซ้ำ แต่เป็น UID
  เดียวกันชนกับ Receipt เก่าของ **คนละ Order** ขณะที่ HIS deduplicate ด้วย UID แบบ global.
- HIS เก็บเพียง technical Receipt เก่า `unmatched`; Order ปัจจุบันยังไม่มี Report/Result Item.
- Contract gap ที่ต้องตัดสินใจก่อนแก้ code: ให้ LISconnect สร้าง UID globally unique
  (แนะนำ namespace ด้วย order/message identity) หรือเปลี่ยน HIS เป็น compound key และรองรับ
  replay ของ unprocessed Receipt เมื่อ identity + payload hash ตรงกัน.

## [2026-09-15] implementation | Scoped, replay-safe LAB result idempotency

- ผู้ใช้เลือกให้ HIS รองรับทั้ง resend ด้วย `result_uid` เดิม และ result message ใหม่ที่เปลี่ยน
  UID แต่ยังอ้าง Order เดิม.
- แก้ `hl7_result_upsert_api.js` ให้ Receipt identity เป็น
  `order_no + filler_order_no + hn + visit_id + result_uid` แทน UID แบบ global.
- Same identity + canonical payload เดิม: processed ตอบ duplicate แบบไม่เขียนซ้ำ;
  unmatched/error reuse Receipt เดิมและประมวลผลใหม่ รวมถึง resume Report เดิมถ้ารอบก่อน
  ล้มหลังสร้าง Report. Same identity แต่ payload เปลี่ยนตอบ `RESULT_UID_PAYLOAD_CONFLICT`.
- UID เดิมคนละ Order สร้าง Receipt แยกได้; UID ใหม่ Order เดิมยังต้องผ่าน report sequence,
  stage และ result version guards เดิม.
- เอา `Unique Value` แบบ global ออกจาก canonical Receipt form และอัปเดต schema/docs/design.
  Read-only index audit พบ live `zdata_lab_result_inbound` มีเพียง `_id_`; compound unique
  index ยังเป็น Production follow-up.
- Verification: receiver regression, full HL7 suite, canonical SDForm validator และ
  `git diff --check` ผ่าน. Live Process ยังเป็น guard เดิม; ยังไม่ได้ publish รอบนี้.

## [2026-09-15] verification | Agent LAB result passed with changed UID

- Live read-only check found Receipt `6aa906571c5232627d0c6d8e` received 15:48:23
  and processed, with Report `6aa906571c5232627d0c6d8f` completed.
- It belongs to source CPOE Order `R2609100005` dated 2026-09-10, Agent order
  `6aa2830609c1bad08952dae5`, LAB NO. `106909100001`.
- Agent changed UID from blocked `rpt-7` to `rpt-7-r1`; therefore this proves the
  existing new-UID path, not the local same-UID replay fix that remains unpublished.
- Report materialized 10 final Result Items including Creatinine/eGFR; all nine
  Biochemistry Work Items and the source CPOE Order are completed.

## [2026-09-15] note | X-ray ปุ่ม `ดูภาพ` → deep link เข้า RIS viewer (D-X17)

- ทีม RIS ส่ง contract ของโปรแกรมดูภาพมาครบ 2 level จาก base เดียวกัน:
  `?QueryMode=AN&Value=<Accession Number>` ราย study · `?QueryMode=PID&Value=<Patient ID>` รายคนไข้
  base คือ `http://localhost:9090` = **เครื่องของผู้ใช้เอง** ⇒ เปิดจาก browser เท่านั้น
  **ไม่ต้องเพิ่ม API/Process ใหม่** เพราะ HN (`row.hn`) และ Accession (`item.accession_no`)
  อยู่ใน payload ของ `xray_cpoe_worklist_api.js` เดิมอยู่แล้ว (ปุ่มพิมพ์ HN ใช้ค่าเดียวกัน)
- แก้ที่ generator `Form-Builder/seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js`
  แล้ว regenerate `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json` (ไม่แก้ JSON ด้วยมือ)
  - เพิ่ม `RIS_VIEWER_BASE` / `RIS_VIEWER_ENABLED` ตั้งค่าตอน generate ผ่าน
    `XRAY_RIS_VIEWER_BASE` / `XRAY_RIS_VIEWER_ENABLED` · ปุ่มเรียก `openImage(row,item)`
    เลือก AN ก่อน ตกไป PID เมื่อยังไม่มีเลข Accession · `imageHint(row,item)` บอกล่วงหน้าว่าจะเปิดแบบไหน
  - `RIS_VIEWER_ENABLED=false` ในไฟล์ที่ commit เพราะ RIS ยังไม่เปิดลิงก์ ⇒ ปุ่มยังแจ้ง
    "รอ RIS เปิดลิงก์" ทั้งตอนกดและตอน hover เหมือนเดิม (ไม่ขัด D-X17 ที่ห้ามปุ่มตาย)
  - ไม่ใส่ `noopener` ใน window features (browser คืน null จนแยก popup blocker ไม่ออก)
    แต่ตัด `win.opener` ทิ้งหลังเปิดแทน
- เอกสาร: `design.md` D-X17 ยังค้าง → เคาะแล้ว (คงข้อค้นพบเดิมว่าไม่มี `StudyInstanceUid`),
  `spec.md` §5 + checklist, `team-api-issues.md` บันทึกว่าทีมตอบแล้วเหลือรอเปิดลิงก์
- เทส: `test_xray_cpoe_worklist_form.js` เปลี่ยน assertion เดิม (`'รอเชื่อมกับโปรแกรม RIS'`)
  เป็นชุดใหม่ที่ยังคุมเจตนา D-X17 ครบ + ตรึงว่า viewer ยังปิดอยู่ · **ผ่าน**
  รันเทส X-ray ทั้งหมด: ผ่านทุกตัว ยกเว้น `test_xray_cpoe_dispatch_api`,
  `test_xray_order_ris_params`, `test_xray_ris_team_apis` ซึ่ง **แดงมาก่อนแล้ว** และไม่ได้แตะ
- ยังค้าง: RIS เปิดลิงก์ · ยืนยันว่า `PID` = HN ของเรา · viewer ต้องลงทุกเครื่องหรือเป็น server กลาง

## [2026-09-15] note | X-ray `ดูภาพ` เปิดใช้งานจริง (RIS_VIEWER_ENABLED=true)

- ผู้ใช้สั่งเปิดเลยหลังได้ contract ครบ ("ก็ใส่ลิ้งแล้วเปิดให้กดเป็น newtab ได้เลย")
  รับทราบแล้วว่าระหว่าง RIS ยังไม่เปิดเส้นทาง แท็บใหม่จะขึ้น `ERR_CONNECTION_REFUSED`
  ของ browser — แลกกับการที่ใช้ได้ทันทีโดยไม่ต้อง import ฟอร์มใหม่รอบสอง
- `XRAY_RIS_VIEWER_ENABLED=1 node build_xray_cpoe_worklist_ui.js` ⇒ ฟอร์มถือ
  `RIS_VIEWER_ENABLED=true` · ตรรกะจับค่าไม่เปลี่ยนจากรอบก่อน (AN ก่อน ตกไป PID)
- ยืนยันด้วยการรัน widget ที่ generate ออกมาจริง:
  `?QueryMode=AN&Value=XR2609150001` เมื่อมีเลข Accession ·
  `?QueryMode=PID&Value=6900001` เมื่อยังไม่มี · ไม่มีทั้งคู่ = เตือน ไม่เปิดแท็บ
- เทส: assertion ที่ตรึง `RIS_VIEWER_ENABLED=false` เปลี่ยนเป็น `true` พร้อมเหตุผล/วันที่
  และ **เพิ่ม** assertion ใหม่ว่าเส้นทางตอนปิดสวิตช์ยังอยู่ครบ (กัน D-X17 หายเงียบ)
  `test_xray_cpoe_worklist_form.js` ผ่าน
- API ไม่ได้แก้: `item.accession_no` (projection บรรทัด ~1807) และ `patient.hn`
  (~1966) อยู่ใน payload ของ `xray_cpoe_worklist_api.js` เดิมแล้ว

## [2026-09-15] note | X-ray popup ผลอ่าน — ประวัติการแก้ทุกฉบับ

- ผู้ใช้อนุมัติดีไซน์ (artifact `927efd85`) แล้วสั่ง "ตาม html นี้เลย แก้มา"
  รอบนี้ **แก้ทั้ง API และฟอร์ม** ต่างจากปุ่มดูภาพที่แก้ฟอร์มอย่างเดียว
- `xray_cpoe_worklist_api.js` action `get_report`: เพิ่ม `versions[]` + `versions_capped`
  จาก `resultRows` ที่ query มาอยู่แล้ว (ไม่แตะ query/limit/sort เดิม) ⇒ ฟิลด์ระดับบนสุด
  ทุกตัวยังเป็นฉบับล่าสุดเหมือนเดิม ฟอร์มรุ่นเก่าจึงไม่พัง
- generator ฟอร์ม: ปุ่มประวัติ · ไทม์ไลน์ซ้าย · แถบเตือนตอนดูฉบับเก่า · ไฮไลต์บรรทัดที่ต่าง
  · หัว/ท้าย dialog ตามฉบับที่เลือก · ช่องเครื่องเหลือตัวย่อ + tooltip
  · ไม่มี versions = ตกกลับไป dialog เดิมเป๊ะ + แจ้งให้อัปเดต Process
- ไม่ join `zdata_xray_resultreset` ตามที่ผู้ใช้ตัดหมุดถอนผลออกจากดีไซน์
- เทสเพิ่มทั้งสองฝั่ง (`test_xray_cpoe_worklist_api.js` · `test_xray_cpoe_worklist_form.js`)
  **ไม่ได้ลด assertion เดิมสักข้อ** · รัน X-ray ครบชุด: ผ่านหมด ยกเว้น dispatch /
  order_ris_params / ris_team_apis ที่แดงมาก่อนแล้ว · LAB worklist + result output tab ผ่าน
- regenerate ฟอร์มด้วย `XRAY_RIS_VIEWER_ENABLED=1` ⇒ ปุ่มดูภาพยังเปิดใช้งานอยู่เหมือนเดิม
- ต้อง deploy 2 ชิ้น: paste Process `6a957009422c1ca959829e45` ก่อน แล้วค่อย import ฟอร์ม

## [2026-09-15] note | Located a clean alternate LAB result UAT order

- Live HIS read-only search for a recent Agent-accepted Biochemistry order containing
  Creatinine found `R2609090021` (source id `6aa12d6909c1bad08952da29`).
- Agent order `6aa12d6909c1bad08952da2a`, LAB NO. `106909090032`, dispatch `27`, sent
  2026-09-09 16:57; nine Work Items remain `received` and no Receipt/Report exists.
- Two older clean alternatives from the same date: `R2609090019` / Agent order
  `6aa12bf909c1bad08952da1c` / LAB `106909090031`, and `R2609090018` / Agent order
  `6aa12a7a09c1bad08952da12` / LAB `106909090030`; both have nine received Work Items
  and no Receipt/Report.
- Changing Order is only a UAT workaround if LISconnect generates a different, unused UID;
  it does not resolve the global-UID versus compound-idempotency contract gap.

## [2026-09-15] note | X-ray dark mode · popup กว้างขึ้น · อธิบายผลที่ยังไม่นับเป็นรอบนี้

- ผู้ใช้แจ้ง 3 เรื่องจากหน้าจอจริง (ธีมมืด · HN/Order No. ถูกตัด · เวลาออกผลว่างทั้งที่มีผล)
- **ตรวจ DB ยืนยันสาเหตุข้อ 3 แล้ว ไม่ใช่บั๊ก:** `SM20260910DX003` มี
  `dispatched_at=2026-09-10 15:36:10` (กดส่งซ้ำหลัง forward ล้ม) แต่
  `ResultDateTime=2026-09-10 10:05:00` ⇒ กติกา `resultIsCurrent` (2026-09-02)
  ตัดสินว่า "ไม่ใช่ผลของรอบนี้" · ฝั่ง server (`effective_status`) คิดเหมือนกันเป๊ะ
  ช่องว่างจริงคือ **dialog ไม่รู้กติกานี้** จึงโชว์ผลสวนทางกับตาราง
- แก้แบบเพิ่มล้วน ไม่แตะคำตัดสินเดิม:
  - API `get_report` คืน `dispatched_at` + `result_is_current`
  - dialog ขึ้นแถบอำพันอธิบายว่าทำไมตารางยังไม่ขึ้นเวลาออกผล
  - แถวผลอ่านโชว์เวลาแบบจาง "· ไม่ใช่ผลรอบนี้" พร้อมเหตุผลตอน hover
  - Process เก่าไม่ส่งสองค่านี้ ⇒ ข้อความว่าง = พฤติกรรมเดิมทุกประการ
- Dark mode: เพิ่ม CSS ต่อท้าย ทุกกฎขึ้นต้นด้วย `.dark` — ป้ายสถานะ item/order,
  ชิป RIS A/C, ป้ายแพ้ยา, ป้ายด่วน, pill คลินิก/ชำระเงิน/สิทธิ, notice, แถบสแกน,
  report-pending, cancel-summary, rev-alert/tag/diff, ป้ายสถานะคิว 3 แท็บ
  โหมดสว่างไม่ขยับ (มีเทสตรึงค่าสีเดิมไว้ด้วย)
- popup ผลอ่าน `min(860px,94vw)` → `min(1060px,96vw)` และช่อง HN/Order No.
  ตัดบรรทัดได้ (`.xr-report-wrap`) ช่องอื่นยัง nowrap เหมือนเดิม
- เทสเพิ่มทั้งหมด ไม่ลด assertion เดิม · X-ray ผ่านทุกตัว ยกเว้น dispatch /
  order_ris_params / ris_team_apis ที่แดงมาก่อน · LAB worklist/form/result tab ผ่าน
- **ค้างไว้รอผู้ใช้ตัดสิน:** `xray_resultreset.js` มี `RadiologistUid` ใน allowedFields
  และใช้ `sdformGetOne` ไม่มี ORDER BY ⇒ อาจเขียนทับชื่อแพทย์ของฉบับเก่า/ผิดฉบับ
  ขัดกับที่ `ris-integration-plan.md` §3 บอกว่าแก้แล้ว — ยังไม่แตะ เป็นไฟล์ของทีม

## [2026-09-15] implementation | LAB visibility dialog รองรับ dark mode

- แก้กล่องสรุปใน dialog `ยืนยันปกปิดผล` ที่เดิมใช้พื้น/ขอบอำพันแบบ hard-code
  แต่ข้อความรับสีจาก dark theme จึงเกิดข้อความสว่างบนพื้นสว่างและอ่านไม่ออก.
- แก้ generator `update_lab_cpoe_worklist_ui.js` แล้ว regenerate
  `lab-cpoe-worklist-waiting-v1.json`; พื้นหลัง/ขอบใช้ Element Plus warning tokens และ
  หัวเรื่อง/ข้อความใช้ global text tokens โดยตรง จึงทำงานได้แม้ dialog ถูก teleport ออกนอก
  `.lab-cpoe` และยังคง fallback สำหรับ light mode.
- เพิ่ม regression assertions กันการย้อนกลับไปใช้ surface แบบ light-only.
- Verification: LAB worklist form test, full offline HL7 result suite, SDForm validator และ
  `git diff --check` ผ่าน. ยังต้อง import แล้วเช็ก light/dark ใน Builder/runtime จริง.

## [2026-09-15] diagnosis | eGFR ถูกเก็บครบ แต่ Worklist ตัดผลย่อยออก

- ตรวจ HIS แบบ read-only หลัง Agent แจ้งว่า Creatinine มีผลย่อย eGFR: Receipt UAT เดิม
  อยู่สถานะ `processed`, ระบุ 10 items และมี Result Item จริงครบ 10 แถว รวม
  Creatinine `100802CD` กับ eGFR `101120CD`; Work Item ของ Order ทั้ง 9 แถวเป็น
  `completed` จึงไม่ใช่ Agent ส่งไม่ครบและไม่ใช่ receiver ทำข้อมูลตก.
- พบช่องว่างที่ `lab_cpoe_worklist_api.js`: เมื่อ shared LAB NO มีหลาย Item ตัวแปร
  `currentClinicalRows` กรองด้วย `batchItemCodes` ซึ่งมีแค่ CPOE `item_code` และ
  master `his_lab_code`. สำหรับ Creatinine จึงคง `100802CD` แต่ตัด mapped child
  `101120CD` ก่อนสร้าง response ของ `get_manual_result`.
- ผลกระทบเป็น presentation/query layer: ข้อมูล clinical อยู่ครบ แต่ popup Worklist
  อาจแสดงไม่ครบ. การแก้ต้องให้ Worklist ใช้ component mapping เดียวกับ receiver และต้อง
  รองรับ Result Item ที่บันทึกไปแล้วด้วย; รอบนี้วินิจฉัยเท่านั้น ยังไม่ได้แก้ code.

## [2026-09-15] implementation | Worklist รองรับหนึ่ง Test ต่อหลาย Result Items

- แก้ `lab_cpoe_worklist_api.js` ให้ `get_manual_result` ขยายรหัสของ CPOE Item ผ่าน
  `RESULT_COMPONENT_CODES_BY_GROUP` ชุดเดียวกับ `hl7_result_upsert_api.js` ก่อนกรองผลใน
  shared LAB NO.; ใช้ `selected_items_json` snapshot เป็นหลักและคง CPOE/master code
  เป็น fallback. ผลของ sibling Order Item ยังถูกแยกออกเหมือนเดิม.
- การแก้เป็น read-path จึงครอบคลุม Result Item ที่เก็บอยู่แล้ว เช่น Creatinine + eGFR
  โดยไม่ต้อง Agent resend และไม่เปลี่ยน receiver persistence/status/idempotency.
- เพิ่ม regression ตรวจ mapping parity ทั้ง 30 groups/215 components และเคสที่
  `panel_code` ของ Creatinine/eGFR ต่างกัน แต่ viewer ยังคืนทั้งสองผลจาก `obs_code` mapping.
- ระบุ contract ของ `panel_code`/`panel_name`: เป็น optional LIS source context สำหรับ
  display/audit; ไม่ใช่ `group_code`/`his_code_id` โดยอัตโนมัติและไม่ใช้เป็น matching key.
  อัปเดต schema description, API docs และ canonical design.
- Verification: Worklist API test, full offline HL7 result suite และ `git diff --check` ผ่าน.
  ยังไม่ได้ deploy Process `6a9434c3422c1ca959829d5e` หรือทำ runtime UAT.

## [2026-09-16] note | X-ray ประวัติผลอ่านย้ายไปอ่าน zdata_zdata_xray_result_log

- ไล่หาเหตุ "ทีมส่ง result ซ้ำแล้วไม่ขึ้นหน้าจอ" จนพบว่า **ทีมแยกตารางผลอ่านเป็นสองชั้น
  ตั้งแต่ 2026-09-09 22:45–23:11 โดยไม่ได้แจ้ง** (ยืนยันจาก `sdform_manage` + ผู้ใช้เปิด Builder ให้ดู):
  - ฟอร์มเดิม `6a860980f851000f28e44ab0` ถูกเปลี่ยนชื่อเป็น `xray_result_log`
    ตาราง `zdata_zdata_xray_result_log` — เก็บทุกข้อความที่ RIS ส่งเข้ามา · **มี `ResultId`**
  - ฟอร์มใหม่ `6aa180f009c1bad08952da58` ชื่อ `xray_result` ตาราง `zdata_xray_result`
    — ฉบับปัจจุบัน 1 แถวต่อ Accession (ถูก upsert ทับ) · **ไม่มี `ResultId`**
  - เทียบ JSON สองไฟล์ในรีโป: ต่างกันแค่ก้อน `ResultId` ก้อนเดียว ที่เหลือเหมือนทุกตัวอักษร
- ข้อมูลจริงยืนยัน: ผลซ้ำของ `SM20260910DX003` เข้ามา **15/09 20:17:49** จริง (ลงท้าย
  "testครั้งที่2") แต่ไป **ทับแถวเดิม** ใน `zdata_xray_result` · `SM20260910DX001` ยิง 6 ครั้ง
  → log 6 แถว (`ResultId` 7–12) แต่ตารางผลอ่านมีแถวเดียว
- **แก้ `get_report` ให้ `versions[]` อ่านจาก log** เรียงด้วย `ResultId` → `ResultDateTime` → `_id`
  (จำเป็น เพราะ 6 ฉบับของ DX001 มี `ResultDateTime` เท่ากันหมด เรียงด้วยเวลาอย่างเดียวจะมั่ว)
  - **ฉบับปัจจุบันทุกฟิลด์ยังอ่านจาก `zdata_xray_result` เหมือนเดิม** · action `list` ไม่ถูกแตะ
  - log อ่านไม่ได้/ว่าง ⇒ ตกกลับไปใช้ตารางผลอ่านเดิม = พฤติกรรมก่อนหน้านี้ทุกประการ
  - เพิ่ม `result_id` ในแต่ละฉบับ · `result_versions`/`versions_capped` นับจากชุดที่ใช้จริง
- **ฟอร์มไม่ต้อง import ใหม่** — contract `versions[]` เหมือนเดิม
- เทส: mock แยกตามชื่อ collection (ไม่ตั้ง `logRows` = เคสเดิมได้ผลเท่าเดิม) + เพิ่มเคสจริง
  (result 1 แถว · log 2 ฉบับ) และเคส fallback · **ไม่ลด assertion เดิม**
  รัน X-ray + LAB ครบ: ผ่านหมด ยกเว้น dispatch / order_ris_params / ris_team_apis ที่แดงมาก่อน
- เอกสาร: `spec.md §0` แก้ตาราง ID + กล่องเตือนโครงสร้างสองชั้น · `team-api-issues.md` เพิ่ม A5
  (6 ประเด็นให้ทีมยืนยัน รวมถึง `xray_resultreset.js` ชี้ Form ID ผิดตั้งแต่ 09/09)
- **ยังค้าง:** ทีมยืนยันว่า log เป็นตารางถาวร · และ 3 ข้อเรื่องกติกาเทียบเวลายังไม่ได้ไฟเขียว

## [2026-09-16] note | X-ray ตัดกติกาเทียบเวลา · retry ไม่เลื่อนเวลาส่ง · มีผล = ออกผลแล้ว

- ผู้ใช้อนุมัติทั้ง 3 ข้อ ("แก้มาเลย แบบห้ามกระทบ flow ที่เราทำสำเร็จไปแล้ว")
- **1. ตัดการเทียบเวลา** — `effective_status` (server) และ `s.resultIsCurrent` (ฟอร์ม)
  เลิกบังคับ `resulted_at >= dispatched_at` · เหตุผล: ตั้งแต่ 2026-09-03 รอบใหม่ออกเลข
  Accession ใหม่เสมอ และผล join ด้วย AccessionNo ⇒ เวลาไม่ใช่เส้นแบ่งรอบอีกต่อไป
  ยืนยันด้วยข้อมูลจริง: ผลทั้ง 6 แถวในระบบถูกกติกานี้ตัดทิ้งหมด
  · ถอน `result_is_current` ออกจาก `get_report` และถอนแถบ/ป้าย "ไม่ใช่ผลรอบนี้" ที่ใส่ไว้ 09-15
- **2. `xray_cpoe_dispatch_api.js`** — เพิ่ม `isNewRound = isResend && !retryOnly && !transportFailed`
  ใช้ทั้งตอนล้างเลข Accession (เงื่อนไขเดิม) และตอนเลื่อน `dispatched_at` (ของใหม่)
  ⇒ กดส่งใหม่เพราะ forward ล้ม ไม่เลื่อนเวลาส่งอีก · `resent_at`/`dispatch_count` ยังบันทึกทุกครั้ง
- **3. มีผลอ่าน = ป้าย "ออกผลแล้ว"** ทั้งแท็บ order และแท็บผลอ่าน · `transport_failed`/
  `transport_note` ไม่ถูกแตะ ยังเตือนในคอลัมน์เวลาส่งเข้าเครื่องเหมือนเดิม
- ตรวจกับเคสจริงผ่าน widget ที่ generate ออกมา: Skull AP (ผล 09:40 · stage 13:43 · transport ล้ม)
  และ Neck AP (ผล 10:05 · ส่งซ้ำ 15:36) → ทั้งคู่ขึ้น **ออกผลแล้ว** พร้อมเวลาออกผล
  ส่วน Skull Towne's ที่ยังไม่มีผล → ยัง "ส่งเครื่องไม่สำเร็จ" เหมือนเดิม
- เทส: อัปเดต 3 assertion ที่ผูกกับกติกาเดิมพร้อมเหตุผล+วันที่ · **fixture ของ "ส่งตรวจซ้ำ
  ต้องรอผลรอบใหม่" เปลี่ยนมาจำลองของจริง (เลข Accession ใหม่) แทนการพึ่งเวลา —
  เจตนาที่เทสปกป้องไม่เปลี่ยน** · เพิ่มเคสใหม่: มีผล+transport ล้ม → ออกผลแล้ว,
  transport ล้ม+ไม่มีผล → ป้ายเดิม, ไม่มีผล → ยังไม่ออกผล
- รัน X-ray + LAB ครบ: ผ่านหมด ยกเว้น dispatch / order_ris_params / ris_team_apis ที่แดงมาก่อน
  ⚠️ `test_xray_cpoe_dispatch_api.js` ล้มที่ preflight บรรทัด 36 (required fields ของ API ทีม)
  **ก่อนถึงโค้ดที่แก้** ⇒ ข้อ 2 ยังไม่มีเทสอัตโนมัติคุม ตรวจแบบ static แทน

## [2026-09-17] note | X-ray เจอบั๊กตัวจริง: $lookup ของผลอ่านผูกตัวแปรผิด ไม่เคย match เลย

- ผู้ใช้ import ฟอร์มใหม่แล้ว (เซิร์ฟเวอร์อัปเดต 17/09 10:28) แต่หน้าจอยังเหมือนเดิม
  ⇒ ไล่ต่อจนพบว่าปัญหาไม่ได้อยู่ที่ฟอร์มหรือกติกาสถานะ แต่อยู่ที่ **ข้อมูลไม่เคยมาถึงฟอร์ม**
- `$lookup` ที่ join `zdata_xray_result` ใน action `list` เขียน `'$accession'` และ `'$ROOT'`
  **ดอลลาร์เดียว** ทั้งที่เป็นตัวแปรที่ประกาศใน `let` ⇒ ต้องเป็น `$$accession` / `$$ROOT`
  ดอลลาร์เดียว = ฟิลด์ในเอกสารของตารางปลายทาง ซึ่งไม่มีอยู่จริง ⇒ `$ne` ของค่าว่างเป็นเท็จเสมอ
  ⇒ **ไม่เคย match สักแถว โดยไม่มี error ใด ๆ** ⇒ `result_text`/`resulted_at` ว่างตลอด
- ยืนยันกับฐานข้อมูลจริง (อ่านอย่างเดียว): เวอร์ชันเดิม match **0 แถว** ทุกใบ ·
  หลังแก้ได้ ResultText **258** ตัวอักษร (SM20260910DX001) และ **346** (SM20260910DX003)
  พร้อม `resulted_at` ครบ · ส่วน SM20260910DX002 ที่ไม่มีผลจริง ยังได้ 0 เหมือนเดิม (ถูกต้อง)
- อธิบายอาการที่ค้างมาตั้งแต่ 15/09 ได้ครบทุกข้อในคราวเดียว:
  · ป๊อปอัป "ดูผล" เห็นผล แต่ตารางไม่ขึ้น → `get_report` ยิง `.find()` ตรง ไม่ผ่าน lookup นี้
  · ชิป "RIS: มีภาพแล้ว" ขึ้นปกติ → lookup ของ `zdata_xray_order` เขียน `$$` ถูกต้อง
  · เวลาออกผลว่าง · สถานะไม่เคยเป็น "ออกผลแล้ว" · ดอตสถานะค้างที่สีส้ม
- **บันทึกความผิดพลาดของผม:** วินิจฉัยผิดไปสองรอบก่อนหน้า (โทษกติกาเทียบเวลา แล้วโทษ
  `transport_failed` บังป้าย) ทั้งที่ยังไม่เคยตรวจว่า `result_text` เดินทางมาถึงฟอร์มจริงไหม
  การแก้สองรอบนั้นยังถูกต้องและจำเป็น แต่ไม่ใช่สาเหตุ — ตัวนี้ต่างหาก
- เพิ่มเทสกันซ้ำ: เดินไปป์ไลน์จริงที่ `list` สร้าง แล้วบังคับว่า **ทุกตัวแปรใน `let` ต้องถูกใช้
  เป็น `$$ชื่อ` จริง** และห้ามมี `"$ROOT"` ดอลลาร์เดียว · พิสูจน์แล้วว่าใส่บั๊กกลับ = เทสแดง
- ไล่ตรวจทุก `$lookup` ที่มี `let` ในไฟล์: มีตัวนี้ตัวเดียวที่ผิด (บรรทัด 2088 เป็น false positive
  เพราะ `$visit_id` เป็นฟิลด์จริงของตารางปลายทาง)
- รัน X-ray + LAB ครบ: ผ่านหมด ยกเว้น dispatch / order_ris_params / ris_team_apis ที่แดงมาก่อน

## [2026-09-17] note | X-ray ปุ่มดูภาพเปลี่ยนเป็นลิงก์จริง (popup blocker)

- ผู้ใช้กดดูภาพแล้วขึ้น "เบราว์เซอร์บล็อกการเปิดแท็บใหม่" · ตั้ง Chrome
  `Pop-ups and redirects = Allow` ให้ his.softmax-one.com แล้ว **ยังโดนบล็อกเหมือนเดิม**
  ⇒ ไม่ใช่ popup blocker ระดับไซต์ แต่เป็น iframe ที่ฝังฟอร์มไว้โดยไม่อนุญาต popup
  ⇒ ตั้งค่าเบราว์เซอร์แก้ไม่ได้เลย ไม่ว่าเครื่องไหน
- แก้: `<el-button @click=openImage>` → **`<a target="_blank" rel="noopener noreferrer">`**
  ที่สวมคลาส el-button (หน้าตาเหมือนเดิมเป๊ะ) · คลิกลิงก์เป็น navigation ปกติ ไม่ใช่ popup
  ⇒ เบราว์เซอร์ไม่บล็อก และ **ไม่ต้องตั้งค่าทีละเครื่อง**
- เพิ่ม `s.viewerHref()` — คืน URL เฉพาะเมื่อ viewer เปิดใช้และมี AN หรือ HN
  ไม่มี URL ⇒ ตกกลับไปใช้ปุ่มเดิมที่แจ้งเหตุผลผ่าน notify (D-X17 ยังถูกคุมครบ)
  `openImage`/`window.open` ยังอยู่ครบ ไม่ได้ถอด
- ตรวจ URL ที่ generate จริง: AN → `?QueryMode=AN&Value=SM20260910DX001` ·
  ไม่มี AN → `?QueryMode=PID&Value=6900031` · ไม่มีทั้งคู่ → ว่าง (ใช้ปุ่มเดิม)
- CSS: `a.xr-viewer-link` บังคับ inline-flex + ไม่มีขีดใต้ ให้สูงเท่าปุ่มข้างกัน
- เทส: assertion เดิมทุกข้อยังผ่านโดยไม่ต้องแก้ (ปุ่ม fallback ยังมี `openImage` อยู่)
  เพิ่มใหม่: ต้องมี `<a v-if="viewerHref...">`, `target="_blank"`,
  `rel="noopener noreferrer"`, ปุ่ม fallback และ CSS ของลิงก์
- **ไม่แตะ `notify()`**: เอกสาร initCraft ระบุสัญญาเป็น `notify(message, type, duration)`
  ซึ่งเราเรียกถูกแล้ว · toast ที่ขึ้นหัวข้อเป็นเลข "5200" จึงเป็นเรื่องฝั่งแพลตฟอร์ม
  (LAB ก็เรียกแบบเดียวกัน) ⇒ บันทึกไว้ถามทีม initCraft ไม่เดาแก้เอง
- ยังไม่ทำ: ตัดคำ "· รอแพทย์อ่าน" ออกจากชิป RIS เมื่อมีผลอ่านแล้ว (รอผู้ใช้ตัดสิน)

## [2026-09-17] implement | X-ray ค้นเลขบัตรประชาชนและ AN ผู้ป่วยใน

- เพิ่ม `visit.an` ใน free-text search และเทียบเลขบัตร 13 หลักกับ `zdata_person.p_cid`
  ผ่าน person ID แบบ exact; join เฉพาะคำค้น 13 หลัก ก่อน `$facet` เพื่อให้ rows/counts ตรงกัน
  และตัดข้อมูล person ออกจาก response
- ช่องค้นหาเดิมส่ง `hn` ซ้อนเมื่อคำค้นมีตัวเลข: แยกกรณี `q+hn` เพื่อไม่ให้ HN prefilter
  ตัด AN/เลขบัตรทิ้ง; HN ในคำค้นยัง exact ส่วนโหมดสแกน `hn` อย่างเดียวยังคง exact prefilter
- UI เพิ่ม AN ผู้ป่วยในใน client guard และระบุความหมายของ AN/Accession ใน title/aria-label;
  เลขบัตรไม่ถูกส่งกลับมาที่จอ โดย guard รับเฉพาะผลจากคำค้นที่ server โหลดสำเร็จ
- API/Form regression tests ผ่าน, SDForm validator exit 0; generator รันด้วย
  `XRAY_RIS_VIEWER_ENABLED=1` เพื่อคงลิงก์ดูภาพเดิม
- บันทึก TOR §3.4.3.1/§3.4.3.5 ใน X-ray spec ว่า local implemented, live UAT pending;
  Claude artifact ต้นฉบับเปิดแบบ signed-out/read-only จึงยังแก้ในลิงก์ไม่ได้

## [2026-09-17] fix | ช่อง Search เลขบัตรถูกจับเป็น HN และ person join ไม่ติด

- ผู้ใช้ลองพิมพ์เลขบัตรในช่อง Search ของ HIS แล้วหน้าเข้าโหมดสแกน HN แทน;
  ตรวจหน้า live พบฟอร์มยังเป็นรุ่นก่อนแก้ (aria-label ของ Search ยังไม่มี AN/เลขบัตร)
- แก้ generator ให้ `scan-code-ui` ระดับ document ส่งค่ากลับเข้า Search เมื่อช่องนี้มีโฟกัส
  โดยใช้ค่าที่มองเห็นใน input ก่อน scanner buffer; `q` 13 หลักไม่พ่วง `hn`
- ทางสแกนเลขบัตรที่มีอยู่ใน local ก่อนรอบนี้ยังส่ง `hn` ผิดช่อง: แก้เป็น `citizen_id`
  และเปลี่ยนข้อความแจ้งให้ระบุเลขบัตรแบบปิดเลขต้น; สแกน HN เดิมยังส่ง `hn`
- ตรวจ HIS แบบ read-only พบ snapshot ใบ CPOE ของผู้ป่วยตัวอย่างไม่มี `vid.pid.value`
  จึงเพิ่ม join person ด้วย HN exact เมื่อไม่มี ID; ตรวจ aggregate แบบนับจำนวนแล้ว
  จับคู่ใบสั่งได้ 3 ใบ โดยไม่เก็บเลขบัตรหรือข้อมูลผู้ป่วยลงรีโป
- API/Form tests และ SDForm validator ผ่าน; ยังไม่ import API/Form รุ่นใหม่นี้เข้า HIS

## [2026-09-17] note | ปิดสองรายการค้นหาใน TOR X-ray

- ผู้ใช้แจ้งว่าใช้งานได้หลังนำเข้าไฟล์ API/Form และสั่งตัดรายการค้นเลขบัตรประชาชนกับ AN ผู้ป่วยในออกจาก TOR backlog
- เปลี่ยนสถานะ §3.4.3.1 และ §3.4.3.5 ใน `Form-Builder/SDForm/X-ray/spec.md` เป็นครบ; ผลรวมฝั่งรีโป 12 ครบ / 12 บางส่วน / 49 ยังไม่มี จาก 73 ข้อ
- ไม่ได้บันทึกเคสทดสอบ AN แยก และ Claude artifact ต้นฉบับยังแก้ไม่ได้ในโหมด signed-out/read-only จึงยังแสดงสถานะเดิม

## [2026-09-17] note | คลังหนังสือยินยอม X-ray และปุ่มเปิดฟอร์ม

- สร้าง Form UI ใน HIS ชื่อ `X-ray · คลังหนังสือยินยอม` ID `6aab93911c5232627d0c6ee1`, Sharing Public, Popup Size 90; Builder ยังว่าง
- เพิ่ม generator/JSON ฟอร์มคลังเอกสาร 5 การ์ด 10 Report Factory ID ตามผู้ใช้ให้มา ชื่อการ์ดตามชนิดเอกสารจริง ค้นชื่อไฟล์/ไทย/อังกฤษได้ และใช้ `sd-report` เปิด PDF เพื่อพรีวิว/พิมพ์
- เพิ่มปุ่ม `หนังสือยินยอม` ใต้ `นัดล่วงหน้า` ใน generator/JSON Worklist โดยยังไม่ replace บน HIS; ปุ่มเดิมและ viewer คงอยู่
- `test_xray_consent_document_library.js` และ Worklist Form tests ผ่าน; JSON validator ทั้งสองไฟล์ exit 0; ยังไม่ผ่าน Builder/Preview/runtime
- Browser URL policy ปฏิเสธการเปิดไฟล์ JSON ในเครื่อง จึงไม่ได้ import โมเดลหรือทดสอบสด; บันทึกลำดับ import ใน `02-his/handoff/xray-consent-document-library-v1-import.md`

## [2026-09-17] note | แก้ X-ray toolbar ให้ห่อแถวตามหน้าจอ

- ภาพผู้ใช้ 14:25 ยืนยันว่าปุ่มหนังสือยินยอมขึ้นใน Worklist แล้ว แต่ grid คอลัมน์คงที่ทำให้ Report ชนปุ่มสร้างรายการเมื่อแถบเมนูขยาย และปุ่มนัดถูกดันขึ้น
- เปลี่ยนเฉพาะ content/CSS ของ Worklist: toolbar ใช้ flex-wrap; สร้างรายการใหม่กับนัดล่วงหน้าอยู่แถวแรก หนังสือยินยอมอยู่แถวถัดใต้ปุ่มนัด; handler เดิมไม่เปลี่ยน
- อัปเดต generator, JSON replace, regression assertions, spec และ handoff; SDForm validator ผ่าน ส่วนการยืนยันหน้าจอหลัง replace บน HIS ยังรอ

## [2026-09-17] note | อัปเดต TOR ข้อหนังสือยินยอม X-ray

- ระบุ §3.4.3.1 “บันทึกหนังสือยินยอมการเข้ารับบริการ” เป็น **บางส่วน** ใน `Form-Builder/SDForm/X-ray/spec.md`: มีปุ่มและคลัง PDF 5 หมวด/10 รายงาน แต่ยังไม่ยืนยัน preview/print ใน HIS และยังไม่บันทึกใบลงนามผูกผู้ป่วย
- ผลรวม TOR ฝั่งรีโปเป็น 12 ครบ / 13 บางส่วน / 48 ยังไม่มี จาก 73; Claude artifact ต้นฉบับเป็นลิงก์อ่านอย่างเดียวและยังแสดงตัวเลขเดิม

## [2026-09-17] note | จำกัดตัวกรองเครื่อง X-ray ไม่เกินสามแท็กต่อแถว

- ภาพผู้ใช้ 14:52 แสดง 5 แท็กในแถวแรก แม้โค้ดเดิมคำนวณความกว้างจาก 4 แท็ก; ตรวจ DOM จริงพบ `.el-select__selection` เป็น flex-wrap ซึ่งไม่ได้จำกัดจำนวนต่อแถว
- เปลี่ยน CSS ของแท็กที่เลือกเป็น grid 3 คอลัมน์ (หน้าจอแคบมาก 2) และคำนวณความกว้างจากแท็กกว้างสุดของแต่ละคอลัมน์รวมช่องค้นหา; ไม่แตะการเลือก/ส่งตัวกรองหรือ action อื่น
- สร้าง JSON Worklist ใหม่โดยคง RIS viewer เปิด, อัปเดต regression assertions/สเปก/ดีไซน์/handoff; tests และ SDForm validator ผ่าน แต่ยังรอ replace และดูผลบน HIS

## [2026-09-17] note | ตรวจ CSS ตัวกรองเครื่องบนหน้า live หลังผู้ใช้แจ้งซ้ำ

- ภาพ 15:02 ยังมี 5 แท็กต่อแถว; อ่าน DOM จริงพบ `is-picked` ถูกต้อง แต่ stylesheet ที่โหลดมีเพียง `flex-wrap` เดิม ไม่มี rule `grid` จากไฟล์ล่าสุด จึงยังไม่ได้ยืนยันว่าโมเดลรุ่นนั้นถูกนำเข้าและเผยแพร่แล้ว
- เพิ่ม rule grid 3 คอลัมน์แบบเจาะจงพร้อม `!important` สำหรับตัวเลือกที่มีค่า (หน้าจอแคบ 2); สร้าง Worklist JSON replace ใหม่โดยคง RIS viewer; เปลี่ยนเฉพาะ CSS และความกว้างของ select เมื่อเทียบกับ snapshot ก่อนแก้สามแท็ก
- Worklist/consent tests ผ่าน, JSON validator exit 0; บันทึกใน handoff ให้ import โมเดลบน Form เดิม, publish, reload แล้วตรวจแถวของแท็ก 4 ตัวจริงอีกครั้ง

## [2026-09-17] note | แก้ช่องว่างผิดปกติของแท็กกรองเครื่อง X-ray

- ภาพผู้ใช้ 15:07 หลังนำเข้า grid แสดงแท็กห่างกันและช่องสูงผิดปกติ; ตรวจ DOM จริงกับ 4 เครื่องพบว่า input ค้นหาภายใน Element Plus กว้าง 126px และกินคอลัมน์ 2 ทำให้แท็ก US กว้างเพียง 44px แต่คอลัมน์นั้นกว้าง 126px
- แก้ generator/JSON ให้ grid เริ่มเมื่อเลือกเกิน 3 เครื่อง; input ใช้ช่องว่างท้ายแถวตามลำดับแท็กและจำกัดความกว้างไม่ให้ดันคอลัมน์; คงการค้นหาเครื่องและ handler เดิม
- Worklist/consent tests ผ่าน, SDForm validator exit 0, ยังต้องนำเข้าไฟล์ล่าสุดและตรวจภาพจริงอีกครั้ง; คืนตัวกรองในหน้า HIS เป็น “ทุกเครื่อง” หลังตรวจ

## [2026-09-17] note | ลดช่องว่างด้านขวาของตัวกรองเครื่อง X-ray

- ภาพผู้ใช้หลังนำเข้าแสดงแท็ก 3 ตัวต่อแถวถูกต้องแล้ว แต่เหลือพื้นที่ว่างท้ายกรอบ; DOM จริงที่เลือก 6 เครื่องวัดแท็กสามคอลัมน์รวมประมาณ 146px, กล่อง 250px และ input ค้นหาที่ซ่อนอยู่กว้าง 0px
- พบ `modalitySelectWidth()` ยังเผื่อ 88px ให้ input ที่ซ่อนอยู่; เปลี่ยนสูตรเมื่อมีอย่างน้อย 3 แท็กให้ใช้ความกว้างคอลัมน์แท็ก + gap + wrapper/ลูกศรจริง โดยคงสูตร 1–2 แท็กไว้เพื่อการพิมพ์ค้นหา
- สร้าง JSON replace ใหม่พร้อม RIS viewer; Worklist/consent tests และ SDForm validator ผ่าน; ยังรอ import/publish และตรวจความกว้างจริงบน HIS

## [2026-09-17] note | ทำความกว้างตัวกรองเครื่องให้คงที่เมื่อเลือก 2–3 รายการ

- ภาพผู้ใช้ 15:21 และการวัด DOM จริงยืนยันว่าเลือก 2 code สั้นกล่องกว้าง 250px แต่เลือก 3 เหลือ 184px เพราะ `modalitySelectWidth()` แยกสูตรที่จำนวน 3
- เปลี่ยนเป็นสูตรเดียว: ฐาน 186px สำหรับ 0–3 และ code สั้นที่มากกว่านั้น ขยายเฉพาะเมื่อความกว้างแท็กจริงของ 3 คอลัมน์ต้องการ; input ค้นหาห่อบรรทัดได้ตามพื้นที่ ไม่เปลี่ยน handler/filter API
- อัปเดต generator/JSON replace, regression tests, design/spec, handoff; Worklist/consent tests และ SDForm validator ผ่าน; ยังรอ import/publish และตรวจภาพจริง

## [2026-09-17] note | ผู้ใช้ยืนยัน UI ตัวกรองเครื่อง X-ray ผ่าน และอัปเดต TOR

- ผู้ใช้ยืนยันหลังนำเข้า Worklist ฉบับล่าสุดว่า layout ตัวกรองเครื่องผ่าน; ติ๊กเกณฑ์ UI ใน `Form-Builder/SDForm/X-ray/spec.md` และ `uat-checklist.md` และบันทึกใน handoff คลังเอกสาร
- แยก UAT กรองรายการ/ตัวเลข chip กับข้อมูล Order จริงไว้ค้าง เพราะภาพหลักฐานก่อนหน้านี้มี 0 รายการ; ไม่ยกข้อหนังสือยินยอมเป็นครบ
- UI นี้เป็นเกณฑ์ย่อย ไม่ใช่ข้อ TOR ใหม่: ผลรวมยัง **ครบ 12 / บางส่วน 13 / ยังไม่มี 48** จาก 73 ข้อ; Claude artifact ต้นฉบับยังเป็นลิงก์อ่านอย่างเดียว

## [2026-09-17] note | ผู้ใช้ยืนยันคลังหนังสือยินยอมและตัวกรองเครื่อง

- ผู้ใช้ยืนยันในแชตว่าคลังเอกสารใช้งานได้ รวมพรีวิว/พิมพ์ และตัวกรองเครื่องผ่านบน HIS; บันทึกการยืนยันไว้ใน X-ray spec, UAT checklist และ handoff โดยไม่มี Order ID/ภาพพิมพ์เคสตัวอย่างแนบแยก
- ข้อ TOR หนังสือยินยอมยังเป็น **บางส่วน** เพราะคลัง PDF ไม่ได้บันทึกใบที่ลงนามผูกผู้ป่วย/การเข้ารับบริการ; ตัวกรองเป็น UAT ย่อย จึงคงยอด **ครบ 12 / บางส่วน 13 / ยังไม่มี 48**
- อธิบายผู้ใช้ว่าข้อค้าง dispatch คือ HIS → Agent → RIS และงานผล/สถานะคือ RIS → HIS พร้อมกรณีล้มเหลว ลองใหม่ และยกเลิก; ยังไม่อ้างว่า end-to-end ผ่านจริง

## [2026-09-17] note | สร้าง handoff สั้นของงาน X-ray ที่เสร็จแล้ว

- เพิ่ม `design/xray-completed-items-handoff.md` ตามคำขอ โดยแสดงเฉพาะ 6 รายการที่ผู้ใช้ยืนยันหรือมีหลักฐาน UI: ค้นเลขบัตร, ค้น AN, ตำแหน่งปุ่มหนังสือยินยอม, คลัง PDF, รูปแบบแท็กเครื่อง และการกรองเครื่อง/status chip
- แยกชื่อรายการคลัง PDF ออกจากข้อ TOR การบันทึกใบยินยอมที่ลงนาม จึงไม่เปลี่ยนยอด TOR

## [2026-09-17] note | ตรวจ TOR ฉบับอัปเดต และแก้ Claude artifact ให้ตรงงานที่เสร็จแล้ว

- เทียบ TOR ฉบับผู้ใช้อัปเดต `~/Downloads/สำเนาของ X-RAY - (30-3-69) ระบบ HIS edit.docx.pdf` (11:30) กับฉบับ 2026-08-31 แบบตัวต่อตัว: ข้อความเท่ากันทุกตัวอักษร (10,928) ไม่มีข้อกำหนดเพิ่ม/ลด/แก้ถ้อยคำ · ไม่มี PDF annotation หรือ highlight · สีแดง/น้ำเงินเป็นการทำเครื่องหมายข้อใหม่ของคอลัมน์ “HIS ใหม่” ที่มีมาแต่เดิม จำนวนยังเป็น 73 ข้อ
- อัปเดต artifact ที่ผู้ใช้เป็นเจ้าของในลิงก์เดิม `842038a1-fb08-4aae-8f15-347ff32f9d2e` จาก 10/14/49 เป็น **12/13/48** (16%/18%/66% · ถ่วงน้ำหนัก ≈ 25%) ตาม `design/xray-completed-items-handoff.md`
- รายละเอียดที่เปลี่ยนในหน้า: §3.4.3.1 ข้อค้นหา → ครบ · §3.4.3.1 หนังสือยินยอม → บางส่วน · §3.4.3.5 ข้อค้นหา → ครบ · tally §3.4.3.1 = 2/4/4 และ §3.4.3.5 = 4/3/5 · เพิ่มบล็อก “ปิดเพิ่มรอบนี้” · แก้ “31 จาก 49” เป็น “31 จาก 48” และย้ายข้อค้นหาออกจากรายการงานแต้มเร็ว
- ที่เหมือนเดิมทั้งหมด: อีก 70 ข้อคงสถานะและคำอธิบายเดิม · บล็อกตัวขวาง A0/A0b · ทุกหมวดที่เหลือ · ระบบสี ฟอนต์ และเลย์เอาต์ของหน้า
- ตรวจหลังแก้: tally ทุกหมวดตรงกับจำนวน chip จริง รวม 73 ข้อ และแท็ก HTML สมดุล; บันทึกผลลงใน `Form-Builder/SDForm/X-ray/spec.md`

## [2026-09-17] implement | เปิดสร้างรายการ X-ray พร้อม HN/VN จาก Search หรือ scanner

- เพิ่ม read-only action `resolve_open_visit` ใน `xray_cpoe_worklist_api.js`: รับ HN หรือเลขบัตรแบบ exact, resolve HN ฝั่ง server, อ่าน Visit เปิดวันนี้โดยใช้ Visit Tran และ fallback Visit วันนี้เหมือน LAB; คุม Organization และไม่คืนเลขบัตร
- ปุ่ม `สร้างรายการใหม่` ใน generator/JSON Worklist รับ HN ที่พิมพ์หรือสแกน HN/เลขบัตร, ส่งบริบท Visit ผ่าน `options.params` เข้า CPOE; ไม่พบ VN แจ้ง warning สั้น ๆ และไม่เปิดฟอร์ม; คำค้นอื่นยังเปิด manual picker เดิม
- เพิ่ม regression กรณี HN, เลขบัตร, ไม่มี VN, manual เดิม, scope และ fallback; API/Form tests และ SDForm validator exit 0; queue/cancel/retest/staff/consent tests ผ่านด้วย
- ไฟล์เตรียม replace โดยต้องลง Process Worklist ก่อน Form Worklist; ยังไม่ import/ทดสอบ Builder หรือ HIS runtime; spec/UAT checklist อัปเดต ส่วน completed-items handoff ยังไม่เพิ่มจนผู้ใช้ยืนยัน

## [2026-09-17] fix | คำเตือน HN ยังไม่เปิด VN ไม่แสดงเลข 3000

- ภาพ HIS runtime ยืนยันว่า `field.notify(message,'warning',3000)` แสดง `3000` เป็นหัวข้อกล่องเตือน; ข้อความไม่เปิด VN ขึ้นจริง แต่หน้าตาไม่เหมาะกับผู้ใช้
- แก้เฉพาะ no-VN branch ของปุ่ม **สร้างรายการใหม่** ใน generator และ Form JSON: แถบแดงโปร่งใสขนาดเล็กกลางขอบบนจอ ปิดเองหลัง 3.5 วินาทีหรือกด × ได้ ล้าง timer เมื่อ unmount; ไม่มี notification เดิมซ้อน
- Regression ตรวจไม่เปิด CPOE, ข้อความ, CSS, timer, การปิด และไม่แจ้งซ้ำ; Form tests ผ่าน, SDForm validator ผ่าน (3 widget; คำเตือนของ widget พิเศษคงเดิม) · ยังรอ replace Form และตรวจสี/ตำแหน่งบน HIS จริง; Process ไม่เปลี่ยน

## [2026-09-17] polish | ลดความทึบแถบเตือน no-VN บน X-ray Worklist

- ภาพผู้ใช้จาก HIS ยืนยันว่าแถบเตือนในฟอร์มขึ้นได้จริงและไม่มีหัวข้อ `3000`; ภาพ Import error ก่อนหน้านั้นระบุสาเหตุไม่ได้จากภาพเดียว แต่ภาพล่าสุดแสดงว่ามีการนำเข้าและเปิดใช้งานฟอร์มแล้ว
- ตามคำขอ ตัด border และ box-shadow รอบแถบ ลดพื้นแดง `rgba(150,31,38,.88)` เป็น `.6` โดยคงข้อความ ตำแหน่ง และระยะเวลาเดิม; regenerate Form JSON ด้วย viewer flag เดิม
- Form/queue/deep-link/consent tests และ SDForm validator ผ่าน; หน้าตาเวอร์ชันลดความทึบยังรอผู้ใช้ replace และดูบน HIS

## [2026-09-17] polish | ใช้โทนปุ่มยกเลิกกับแถบเตือน no-VN

- ผู้ใช้ระบุว่าสีแดงเดิมยังทึบเกินไป ให้ใช้โทนเดียวกับปุ่ม `ยกเลิก order`; ปุ่ม Element Plus `type="danger"` ใช้ `#f56c6c`
- เปลี่ยนเฉพาะ CSS แถบเตือนใน generator/JSON เป็น `rgba(245,108,108,.2)`, ไม่มีขอบ; ปรับสีข้อความให้ contrast เหมาะกับ light/dark โดยไม่แตะเวลาแสดงผล การปิด หรือ flow สร้างรายการ
- Regenerate Form JSON โดยเปิด RIS viewer flag เดิม; Form/queue/deep-link/consent tests และ SDForm validator ผ่าน; รอดูสีบน HIS หลัง replace

## [2026-09-18] implement | ยกเลิก X-ray หลังส่ง RIS ด้วย IsDeleted

- ผู้ใช้ยืนยันให้ส่ง Order JSON เดิมผ่าน `xray_api_order`/Envision GetOrder โดยใช้ Accession เดิมและ `IsDeleted:true`; ไม่ใช้ `Status:C` (Completed)
- เพิ่มใน Worklist Process: ตรวจ Order JSON/Exam/ผลอ่าน, เก็บ `ris_pending`, ส่งทีละ Accession, รอ application ACK `AA` ครบก่อนเปลี่ยน CPOE เป็น cancelled; ล้มเหลวคงสถานะและกดซ้ำได้
- Dispatch Process กันการส่ง Order ปกติทับระหว่าง cancellation pending; Form เปิดปุ่มยกเลิกสำหรับรายการมี Accession ที่ยังไม่ออกผล โดยคง RIS viewer flag เดิม
- Cancel/dispatch/worklist/Form/queue/accession/retest/reject tests ผ่าน; SDForm validator exit 0. `test_xray_ris_team_apis.js` และ `test_xray_order_ris_params.js` ยังแดงจากสัญญา/fixture เดิมที่ไม่ตรงกัน; RIS runtime และ Builder/Preview ยังไม่ทดสอบ

## [2026-09-18] fix | ยกเลิก X-ray เฉพาะรายการที่เลือก

- ผู้ใช้ยืนยันขอบเขตหลัง reset: ปุ่มเดิมต้องยกเลิกเฉพาะ checkbox ที่ติ๊ก; sibling ที่ออกผลแล้วหรือไม่ได้เลือกไม่ถูกแตะ
- Form ส่ง `item_ids` ที่ snapshot เมื่อเปิด dialog; ไม่มี selection แล้วปิดปุ่ม/API ปฏิเสธ. Worklist API preflight เฉพาะรายการที่เลือก, ส่ง `IsDeleted:true` เฉพาะ Accession เหล่านั้น, รอ RIS `AA`, และเปลี่ยนสถานะเฉพาะ item เหล่านั้น
- Audit Order เดิมเก็บชุดปัจจุบันและ `history[]` ของชุดก่อน; Dispatch block เฉพาะ item ที่ pending. Form เก่าที่ไม่ส่ง `item_ids` ถูก API ปฏิเสธ; การเลือกครบทุก item ยังทำงาน. ขณะ deploy ให้แทน Worklist API → Dispatch API → Form ตามลำดับ
- อัปเดต X-ray spec/design, generator, Form JSON, API และ regression. 14/16 X-ray suites ผ่าน; สอง suite RIS fixture/message ที่ไม่เกี่ยวข้องยังแดง. SDForm validator ผ่าน; Builder/HIS/RIS UAT และการ replace คู่ Process+Form ยังรอ. ไม่มี live cancellation, commit หรือ push

## [2026-09-18] query | เหตุผลที่ X-ray default แสดงใบสั่งวันที่ 10

- ภาพ HIS เวลา 12:10 แสดงช่วงวันที่ “วันนี้ (ค่าเริ่มต้น)” พร้อมใบสั่ง 10 ก.ย. สามใบ; คอลัมน์นั้นคือ `เวลาสั่ง` ไม่ใช่แกนของ Date Range
- ตรวจ Worklist Process live แบบอ่านอย่างเดียว (อัปเดต 12:09): ค่าเริ่มต้นกรอง `status_date` ของวันนี้. ตรวจ item สามใบแบบอ่านอย่างเดียวพบ `dispatched_at` 18 ก.ย. 11:57–11:58 จึงตรงกับตัวกรองวันนี้; ไม่พบหลักฐานว่ากรองวันที่พลาด
- ปรับ `Form-Builder/SDForm/X-ray/spec.md` §4.2.3 ให้ตรงกับกติกา 09-08 ซึ่งยกเลิกการแถม backlog ข้ามวัน และอธิบายความต่างระหว่างวันสั่งกับวันสถานะ. ไม่เปลี่ยน API/Form หรือข้อมูลจริง

## [2026-09-18] fix | X-ray cancellation ยึดการรับของ API Order ทีม

- ผู้ใช้แก้ขอบเขตการทดสอบ: HIS สนใจว่า API Order ทีมรับคำขอ `IsDeleted:true` ของ Accession ที่เลือกแล้ว; การส่งต่อไป RIS เป็นหน้าที่ของทีม API Order ไม่ต้องรอ Envision ACK ก่อนเปลี่ยน CPOE
- ภาพ runtime ของ `R2609100008`/`SM20260918CT001` แสดง HTTP 401; ตรวจ HIS แบบอ่านอย่างเดียวพบ `zdata_xray_order.IsDeleted:true` เวลา 12:11:37 แต่ CPOE ยัง `dispatched` และ cancellation ค้าง `ris_pending` ด้วยเกณฑ์เก่าที่รอ RIS
- ปรับ Worklist Process ให้ยอมรับ `LocalSaved:true` กับ Accession ที่ตรงกัน, ยกเลิกเฉพาะ item ที่เลือก, เก็บ `accepted_local`/HTTP status ใน audit และเตือนว่า upstream ยังไม่สำเร็จ; หาก Process ไม่ยืนยัน local save ให้คง HIS และ retry. Form แสดง warning แทน success toast เมื่อ upstream มีปัญหา; ปรับข้อความยืนยันและ X-ray spec/design
- Cancel, Worklist, Dispatch, Form, retest, reject suites ผ่าน; SDForm validator exit 0; `git diff --check` ผ่าน. Form regenerate ด้วย RIS viewer flag เดิม. ยังไม่ replace live Process/Form และยังไม่ทดสอบ RIS ลบคิวจริง; การแก้/ทดสอบเวชระเบียนผ่าน UI ต้องยืนยัน ณ เวลาลงมือ ตาม Computer Use policy. ไม่ commit/push

## [2026-09-18] audit | ของที่ต้อง replace ก่อนทดสอบ flow RIS 7 ขั้น

- ทีม RIS เสนอส่ง Order 2–3 รายการ, ส่งเข้าเครื่อง/ยกเลิกหนึ่งรายการ, แจ้งสถานะภาพ, ส่งผล Prelim/Final/Addendum, แล้ว Reset. สัญญา HIS ปัจจุบันสร้าง CPOE Order ก่อน; `GetOrder` ยิงเมื่อกดส่งเข้าเครื่องเท่านั้น ไม่ได้ยิงทั้งตอนสร้างและตอนส่ง
- อ่าน `module_api` HIS แบบไม่แก้ข้อมูล: live Dispatch Process `6a967029422c1ca959829edc` มีความยาวและ hash ตรงไฟล์ local; **ไม่ต้อง replace ซ้ำ**. Worklist `6a957009422c1ca959829e45` ยังไม่มี `acceptedLocal` จึงต้อง replace เพื่อรับ `LocalSaved:true` เมื่อ API Order รับคำขอแล้ว แม้ forward RIS HTTP 401; import Form ที่ regenerate เพื่อข้อความและ warning ที่ถูกต้อง
- Live Result Reset Process `6a95b6d8422c1ca959829e88` ชี้ current Result Form ถูกแล้ว แต่ใช้ `findOne({AccessionNo})` ไม่เรียงฉบับ; เมื่อมี Prelim/Final/Addendum หลายแถวอาจถอนผิดฉบับ. ต้องให้เจ้าของ Process แก้ก่อนทดสอบขั้น 7; **ห้ามแทน live ด้วย local `xray_resultreset.js`** ซึ่งยังชี้ Form log เก่า. การเชื่อม/ยืนยันตัวตนของ API Order→RIS (HTTP 401) ยังเป็นงานทีม API Order

## [2026-09-18] audit | MR001 ยกเลิกสำเร็จใน HIS และขอบเขตตรวจใหม่

- ตรวจ HIS แบบอ่านอย่างเดียว: `SM20260918MR001` ใน Order `R2609100009` มีแถว `zdata_xray_order` หนึ่งแถว `IsDeleted:true`, `Status:A`, updated 12:40:16; CPOE X-ray item เดียวของ Order เป็น `cancelled` พร้อมเหตุผล/เวลาและ cancellation record. `zdata_xray_order_cancellation` เป็น `applied`, `cancel_scope:items`, `ris_cancel:accepted_local`, `LocalSaved:true`, forward HTTP 401. ไม่มีแถว `xray_order_status_change` หรือ Result ของ Accession นี้ จึงพิสูจน์การรับของ API Order/HIS แต่ยังไม่พิสูจน์ RIS ยกเลิกจริง
- `xray_order` เป็น SDForm เปิดใช้งานและอ่านจาก `zdata_xray_order`; cancellation audit เป็นคอลเลกชันแยก ไม่มี SDForm ตาม `sdform_manage`. Live Worklist Process อัปเดต 12:39:26 และ hash ตรงไฟล์ local; Form อัปเดต 12:39:51 แต่ตัว canvas encrypted จึงยังเทียบ byte ไม่ได้
- พบช่องว่างของ `retest_order`: ปุ่มอยู่ระดับ Order, API รับ `order_id` อย่างเดียวและเปิดกลับทุก X-ray item ที่ `cancelled/rejected/returned/reversed` พร้อมล้างทุก Accession; เมื่อยกเลิกบางรายการในใบหลายรายการ ปุ่มไม่แสดงเพราะ Order ยังไม่ `cancelled`. MR001 มี item เดียวจึงยังไม่เกิดผลข้างเคียง. คำตอบเชิงออกแบบ: Retest ควร scope ตาม item ที่เลือก เช่นเดียวกับ cancel; ยังไม่ได้แก้โค้ด

## [2026-09-18] fix | ตรวจใหม่เฉพาะ X-ray item ที่เลือก

- ผู้ใช้สั่งแก้ช่องว่าง Retest ในใบหลายรายการ: Worklist API รับ `retest_items` (และ `retest_order` เดิมแบบบังคับ IDs) โดย preflight ทุกสถานะ/สมาชิกก่อนเขียน, ปฏิเสธ Form เก่าที่ไม่ส่ง IDs และ audit ที่ยังค้าง. Action ใหม่กัน Form ใหม่ยิง Process เก่าที่เปิดทั้งใบ. เปิดกลับ/ล้าง Accession เฉพาะรายการที่เลือก; sibling คงเดิม, เลขเดิมอยู่ `accession_history[]` และ `retest_log[]`. `reopen_log[]` ระบุ IDs; audit คง `applied` ถ้ายังมีรายการยกเลิก.
- Form generator/JSON เปิดให้ติ๊กรายการยกเลิก; ปุ่มแถวสรุปเปิด detail เพื่อเลือกก่อน, ปุ่มใน detail ใช้กับที่ติ๊กแม้ Order ยกเลิกบางส่วน. การติ๊กปนกับรายการส่งเครื่องปิดทั้ง Retest และ Dispatch; guard ใน handler ป้องกันการยิงผิดชุด. ปรับ `spec.md` กับ `design/Xray_design.md`.
- API Retest/Form/Cancel/Worklist/Dispatch/Reject regressions ผ่าน 6 suites; SDForm validator ผ่าน (คำเตือนโครง template เดิม). ยังไม่ replace Process หรือ import Form live และไม่ได้ทำ HIS/RIS write/Builder UAT. ไม่มี commit ใน worktree ที่มีไฟล์งานอื่น.

## [2026-09-18] uat | ตรวจ X-ray Retest live แบบไม่เปลี่ยนข้อมูล

- เปิด app `6a956aad422c1ca959829e3f` ใน Chrome ของผู้ใช้. ก่อน reload ยังเป็นปุ่ม Retest รุ่นเก่า; หลัง reload เห็นฟอร์มใหม่: ปุ่มสรุปเปิด detail, `ตรวจใหม่เฉพาะที่เลือก` disabled เมื่อไม่ติ๊ก, enabled เมื่อติ๊ก item ที่ยกเลิกใน `R2609100009`/`SM20260918MR001`, กลับ disabled เมื่อเอาติ๊กออก. ไม่มีการกดคำสั่งตรวจใหม่จริง; คืน selection ว่าง.
- Mongo HIS read-only: Worklist Process `6a957009422c1ca959829e45` อัปเดต 13:06:54 มี marker `retest_items`, `requestedIds = params.item_ids`, `accepted_local`. พบสอง Order ที่มี X-ray ยกเลิก 2/2 รายการ (`R2608310007`, `R2609010003`) แต่ยังไม่ได้ทำ UAT แบบเปิดกลับหนึ่งรายการเพื่อพิสูจน์ sibling.
- Live end-to-end ยังไม่ผ่านการยืนยัน: การกดตรวจใหม่บน MR001 จะเปลี่ยน CPOE `cancelled→sent` และล้าง Accession ใน HIS; เป็น medical care action ผ่าน UI ที่ต้องยืนยัน ณ เวลากด ตาม Computer Use policy [17]. RIS forwarding เดิมตอบ HTTP 401; ไม่ได้พิสูจน์ RIS.

## [2026-09-18] fix | Retest ของ Order เก่ากลับเข้า Worklist วันปัจจุบัน

- ผู้ใช้ทดสอบ Retest จริงแล้วพบว่า Order หายจากหน้า “วันนี้” แต่ค้น HN เจอ. HIS read-only พบ item `R2609100009` เป็น `sent`, `retest_at:2026-09-18 13:29:22`, `dispatched_at:''`, ส่วน `order.status_stage.sent` ยัง 10 ก.ย.; Worklist live Process เวลา 13:06:54 ยังไม่อ่าน `items.retest_at` และยัง sort ด้วย `requested_at`.
- แก้ local `xray_cpoe_worklist_api.js`: คืน `retest_at` ต่อ item; สำหรับ Order ที่เคยตรวจใหม่ คำนวณ `status_at` จากเวลาที่ใหม่กว่าระหว่าง `retest_at` และ `dispatched_at` รอบใหม่; sort หน้ารายการด้วย `status_at` ล่าสุดก่อน. ไม่เปลี่ยนวันสั่งจริงของ Order. Mongo read-only ประเมินสูตรกับ item จริงได้ `2026-09-18 13:29:22`.
- อัปเดต X-ray spec และ Worklist API regression; Worklist/Retest/Form suites ผ่าน. ยังไม่ได้ replace Process live จึงยังไม่ยืนยันจอหลังแก้; Form ไม่ต้อง import ใหม่สำหรับการแก้วัน. ไม่เขียนข้อมูลผู้ป่วยหรือ commit.

## [2026-09-18] verify | Worklist วันที่ตรวจใหม่หลัง replace live

- ผู้ใช้แจ้งว่า replace แล้ว. HIS Mongo read-only พบ Worklist Process `6a957009422c1ca959829e45` updated 13:37:26 มี marker `items.retest_at`, sort `status_at:-1`, และ `retest_items`.
- เปิดแท็บ Chrome แยกจากแท็บที่ผู้ใช้กำลังทำงานและตรวจ Worklist โดยไม่แก้ข้อมูล: `R2609100008` วันสั่ง 10 ก.ย. แต่ item มี `retest_at:2026-09-18 13:31:25`, `current_status:sent`, `dispatched_at:''`; หลัง replace ใบปรากฏในตัวกรอง `รอรับ` + `วันนี้ (ค่าเริ่มต้น)` โดยไม่ค้น HN. ปิดแท็บตรวจสอบชั่วคราว; ไม่แตะ dialog ในแท็บผู้ใช้.
- ยืนยันเฉพาะ regression วันที่หลัง Retest; ผลการออกเลขใหม่/การส่งต่อ RIS และการแยก sibling ในใบหลายรายการยังไม่ใช่ผลของการตรวจครั้งนี้.

## [2026-09-18] audit | Log ของ Order X-ray ที่ทดสอบวันนี้

- อ่าน HIS เท่านั้น: item X-ray ที่อัปเดตวันนี้มี `R2609100009` (MR), `R2609100008` (CT), `R2609100002` (DX). MR มี cancellation/retest 3 รอบ (`MR001→MR002→MR003`), CT มี 2 รอบ (`CT001→CT002`); DX มีเพียงการส่งหนึ่งครั้ง ไม่ควรมี retest log.
- MR/CT: `retest_log[]`, `accession_history[]`, audit `reopen_log[]` และจำนวนรอบ cancellation (`history[]` + ปัจจุบัน) ตรงกัน 3/3/3/3 และ 2/2/2/2; ทุกคู่เลข Accession/เวลา/item_id ตรงกัน, actor metadata ครบ. แถว `zdata_xray_order` ของเลขเดิมทั้งห้าแถวคงอยู่และ `IsDeleted:true`; DX001 ยังคง `IsDeleted:false`. ปัจจุบัน MR/CT item `sent`, Accession ว่างหลัง Retest รอบล่าสุด, audit `reopened`.
- ขอบเขตของ log: SDForm `xray_order` (`zdata_xray_order`) ไม่มีฟิลด์ประวัติแก้ไขรายครั้ง; แถวมีเพียงสถานะล่าสุด `IsDeleted` และ `updated_at/by`. `zdata_cpoe_order.status_stage` ของสองใบยังมีเฉพาะ draft/sent วันสร้าง (item-level cancel/retest ไม่ append ที่ Order). รายละเอียดรอบอยู่ที่ CPOE item + cancellation audit. Retry การส่งคำยกเลิกเก็บ `attempts` และผลล่าสุดของรอบ; CT001 มี attempts=2 แต่ไม่มี per-attempt log ของครั้งแรก. ทุก cancellation ล่าสุดเป็น `accepted_local` พร้อม forward HTTP 401; ไม่มี RIS status callback ของเลขห้าตัว จึงยืนยันเฉพาะ HIS/API Order ไม่ใช่ RIS.

## [2026-09-18] query | สถานะเชื่อม X-ray ทั้งเส้นทางหลังทีมปรับ Order API

- HIS Mongo read-only: `xray_api_order` live updated 14:05:26; CPOE item `SM20260918DX001` ส่งซ้ำ 14:15:08 แล้ว `transport.status:ok`, forward HTTP 200, ACK `AA`, `ViThirdParty->GetOrder->Accept`. พิสูจน์ขาส่งจาก Worklist/Dispatch ผ่าน API ทีมถึง GetOrder สำหรับ DX001.
- MR001/2/3 และ CT001/2 เป็น `zdata_xray_order.IsDeleted:true` ในฟอร์มทีม แต่ทุกแถว updated ก่อน 14:05; cancellation audit ล่าสุดของ MR003/CT002 ยังคง `LocalSaved:true` และ forward HTTP 401. ยังไม่มีหลักฐานว่าส่งคำยกเลิกซ้ำหลังแก้หรือ RIS เอาใบออกจริง.
- ไม่มีผล Status/Image, Result, Result Reset ขาเข้าใน Accession ที่ทดสอบ 18 ก.ย. ขณะที่ Result/Status ของเคสเก่ามีจริง. Live Reset Process `6a95b6d8422c1ca959829e88` ชี้ Form ปัจจุบันแล้ว แต่ใช้ `findOne({ AccessionNo })` ไม่เรียงลำดับ; Result ปัจจุบัน 6 แถวไม่พบ Accession ซ้ำ. RIS UAT ขั้น prelim/final/addendum/reset และใบหลายรายการที่ยกเลิก/ตรวจใหม่เฉพาะ item ยังไม่ผ่านทดสอบครบ.

## [2026-09-21] note | ออกแบบแท็บสืบค้นผลแลปข้าม HN และตรวจ index รองรับช่วงวันที่ “ทั้งหมด”

- ออกแบบตามที่ผู้ใช้กำหนด: ใช้ pattern เดิมของ LAB worklist ทั้งหมด เพิ่มเฉพาะแท็บระดับบน (รายการวันนี้ / สืบค้นผลแลป) กับคอลัมน์ `ห้องแลป` หนึ่งคอลัมน์ระดับ order แทรกหลัง Specimen; chip สถานะ 6 ปุ่ม legend แผง order/ออกผล และปุ่ม PDF/HN/EMR คงเดิมครบ
- ผู้ใช้ตัดสิน 4 ข้อ: ใบห้องอื่นในโหมดสืบค้น **กดรับ/ปฏิเสธ/ยกเลิกไม่ได้** · คอลัมน์ห้องแลปใช้ **รหัส** (MB/BC/HM) · “รายการที่สั่ง” นับ **เฉพาะใบที่ส่งเข้าห้องแลปแล้ว** · date range เริ่มต้น **ทั้งหมด**
- ตรวจ index จริงบน `his` (read-only, `$indexStats`): `zdata_cpoe_order.ipd_order_hn_created {vid.pid.hn:1,created_at:-1}` และ `zdata_visit.ipd_visit_hn_date {pid.hn:1,visit_date:-1}` และ `zdata_cpoe_order_item.ix_item_parent {xparentx:1,xrstatx:1}` + `ipd_orderitem_order {order_id.value:1}` **มีครบแล้ว** จึงเปิด “ทั้งหมด” ได้โดยไม่ต้องสร้าง index ใหม่ และเรียง/แบ่งหน้าใช้ index ได้ ไม่ต้อง sort ในหน่วยความจำ
- เงื่อนไขที่ต้องคุม: ไม่มี HN + ทั้งหมด = กวาดทั้ง collection จึงต้องบังคับให้มี HN หรือช่วงวันที่อย่างน้อยหนึ่งอย่าง; โหมดสืบค้นต้องใช้ธงใหม่ระดับ Process (เช่น `cross_section:true`) ห้ามแก้การคำนวณ `organization_code` แบบ fail-closed เดิม และฝั่ง server ต้องปฏิเสธคำสั่งเขียนที่มาพร้อมธงนี้
- ข้อจำกัด: ฐานที่ตรวจเล็กมาก (order 234 · visit 271 · item 522) วัดเวลาแบบ production ไม่ได้ ยืนยันได้แค่รูป index; ควร `explain` บนฐานจริงก่อนเปิดใช้
- ยังไม่แตะโค้ด ทำเฉพาะ mockup: artifact `855ed156-a468-4aca-b129-4e26274a0afe`

## [2026-09-21] fix | MLab จุลชีววิทยาแสดงตาม code mapping และข้อความต้นฉบับ

- ปรับ popup เฉพาะ Section `MB` ให้ยึดชื่อ/รหัสของ ordered HIS Item และคงหนึ่ง card ต่อ Item แม้หลายรายการจะมี panel เดียวกัน; Section อื่นยังใช้การรวม panel และ popup มาตรฐานเดิม
- เลิกอ่านหัวข้อ free text เพื่อเปลี่ยนชื่อรายการหรือแตก Gram stain, organism, MIC และ S/I/R; แสดง `test_code`, `test_name`, status, เวลา และ `result_value` ที่บันทึกจาก MLab โดยตรง จึงไม่กลบบัคกรณี code/title/method ขัดกัน
- เคส `406909180002`: ฝั่ง HIS จึงคง `400199 = Gram stain` แม้ข้อความที่รับจะเขียน `Aerobic Culture`; `400999 = Anaerobic culture` จะรอผลปัจจุบันตามจริง ส่วน receipt stale ไม่ถูกยกมาปะผลเอง
- Regenerate `lab-cpoe-worklist-waiting-v1.json`; SDForm validator, LAB Form regression, full offline HL7 result suite และ `git diff --check` ผ่าน. ยังต้อง import/replace Form และตรวจ Builder/runtime จริง; ไม่แก้ข้อมูล HIS หรือบัค MLab/LISconnect

## [2026-09-21] fix | MB fallback เมื่อ Order ตรงแต่รหัสรายการผลไม่ตรง

- เพิ่ม fallback แบบอ่านอย่างเดียวเฉพาะ Section `MB`: Receipt ต้องมี LAB NO/HN/VN ตรง, `order_no` ตรงกับ identity ของรายการที่เปิด, สถานะ `unmatched`, ไม่มี item ที่ map สำเร็จ และมี unmatched `obs_code` อย่างน้อยหนึ่งรายการ
- Popup แสดงเพียงหัวผล/ข้อมูลผู้ป่วยและ Order กับกล่อง `ข้อความต้นฉบับจาก MLab`; ซ่อน timeline, notice และ card รายการตรวจทั้งหมดใน fallback นี้ ข้อความใช้ `item.value` จาก raw Receipt โดยตรง ไม่ตีความ/แยก Gram stain, organism, MIC หรือ S/I/R
- Receipt นี้เป็น audit-only: API ไม่สร้าง Result Item, ไม่ผูกกับรายการตรวจใด และไม่เปลี่ยนสถานะ CPOE; ถ้ามีผลที่ map ถูกจริงแม้หนึ่งรายการ จะกลับไปใช้ viewer ปกติแทน fallback
- Regenerate `lab-cpoe-worklist-waiting-v1.json`; API/Form regressions, SDForm validator, full offline HL7 result suite และ `git diff --check` ผ่าน. ยังไม่ import/replace Process+Form และยังไม่ทำ Builder/runtime UAT; ไม่แตะข้อมูล HIS จริงหรือบัคฝั่ง MLab/LISconnect

## [2026-09-21] query | ทบทวน Artifact ฟีเจอร์สืบค้นผล LAB ข้ามห้อง

- อ่าน Claude Artifact `HUDCVauGjgUXq6ZfgFoCC5` แบบ read-only และเทียบกับ Worklist API/Form ปัจจุบัน; ยังไม่แก้ implementation
- ขอบเขตที่ชัด: เพิ่มโหมดรายการวันนี้/สืบค้น, ปุ่มย่อยผลห้องแลป/รายการที่สั่ง, คอลัมน์รหัสห้อง LAB, `cross_section:true` เฉพาะ read-only, ปฏิเสธคำสั่งเขียนฝั่ง server, รายการที่สั่งนับเฉพาะใบที่เคยส่งเข้าห้อง LAB, date เริ่มต้นทั้งหมด และใช้ viewer/PDF/HN/EMR เดิม
- จุดต้องยืนยันก่อนทำ: โหมดทั้งหมดบังคับ exact HN เสมอหรือยอมให้ช่วงวันที่ค้นข้ามผู้ป่วย; “ผลห้องแลป” รวม partial ที่มีอย่างน้อยหนึ่ง Result Itemหรือเฉพาะ completed; สิทธิ cross-room ของผู้ใช้ทั้ง 7 ห้องและปุ่มสร้างรายการใหม่ในโหมด read-only

## [2026-09-21] fix | เพิ่มโหมดสืบค้นผล LAB ข้ามห้องแบบอ่านอย่างเดียว

- ผู้ใช้ยืนยันกติกา: หน้า `สืบค้นผลแลป` เริ่มว่างพร้อม `โปรดระบุ HN / เลือกวันที่`; exact HN ค้นได้ทุกวัน แต่การค้นทั้งหมดโดยไม่มี HN ต้องมี Date Range ครบ; ผู้ใช้ที่สังกัด LAB ห้องใดก็อ่านทุก Section LAB ที่ enable ได้; `สร้างรายการใหม่` ปิดในโหมดนี้
- Worklist API เพิ่ม `cross_section:true` + `lookup_mode:results|orders`. ตรวจว่าผู้ใช้ map เข้าห้อง LAB อย่างน้อยหนึ่งห้องก่อนขยาย scope ไปทุก Section ที่ enable และปฏิเสธ non-list action ที่ส่งธงนี้ก่อนเข้า write branch. Receive/Reject Processes เพิ่ม fail-closed guard เดียวกัน
- Lookup เริ่มจาก `zdata_cpoe_order` เพื่อใช้ exact HN + `created_at` index แล้วค่อยขยาย CPOE Items. `results` บังคับ status `resulted/completed` และกรองหลัง group ให้ Order+Section ผ่านเมื่อมีผลที่ map ถูกอย่างน้อยหนึ่ง Item จึงรองรับ Partial โดยคง sibling ที่รอผลไว้. `orders` ครอบคลุม sent→completed และ cancelled/rejected
- Form เพิ่ม main tabs, lookup subtabs, Section-code column และ empty state. Daily mode เดิมยังเป็นค่าเริ่มต้น. Lookup ปิด Create, checkbox/bulk receive, specimen edit, reject, cancel, Retest, manual edit, hide/unhide และ upload; PDF, HN direct print agent, EMR และ result viewer เดิมยังอยู่. ผล lookup เปิดแท็บ result เป็นค่าเริ่มต้น; order lookup เปิดแท็บ order
- อัปเดต `design/Lab_design.md`, generator, generated Form และ regression tests. ผ่าน Worklist API/Form, Receive, Reject, SDForm validator, full offline HL7 result suite และ `git diff --check`; ไม่มี network/HIS write. ยังต้อง replace Worklist/Receive/Reject Process, import Form และทำ Builder/runtime/cross-room UAT
- ไม่ commit: worktree มีการแก้ไขจำนวนมากและไฟล์ LAB ที่แตะทับกับงาน MLab/HL7 ก่อนหน้า หลัง context compaction ไม่สามารถแยก staging อย่างปลอดภัยได้

## [2026-09-21] fix | แสดง HN ที่ paste หรือ scan ในช่องค้นหา LAB

- สาเหตุ: `scan-code-ui` รับค่า paste/scan และเรียก `scanPatientHn()` สำเร็จ แต่ handler ตั้ง `scannedHn` แล้วล้าง `filters.hn`; ช่อง Element Plus ผูก `:model-value="filters.hn"` จึงแสดงว่างทั้งที่ query ใช้ `scannedHn` และค้นพบข้อมูลแล้ว
- แก้ generator ให้เก็บ HN ที่ normalize แล้วใน `filters.hn` เพื่อให้ controlled input แสดงค่าจริง และแก้ `clearScan()` ให้ล้างทั้ง `scannedHn`, `scanMode` และข้อความในช่อง ไม่ให้หลังล้างยังกรองด้วย HN เดิม
- เพิ่ม regression ครอบคลุม paste/scan ในโหมดสืบค้นและการล้างค่า; regenerate `lab-cpoe-worklist-waiting-v1.json`. LAB Form test, SDForm validator, full offline HL7 suite และ `git diff --check` ผ่าน. ยังต้อง re-import Form และยืนยัน runtime จริง

## [2026-09-21] fix | จำกัด PDF ใบสั่งตรวจไว้เฉพาะแท็บ order

- ผู้ใช้ยืนยันว่า PDF ที่ผูก Report Factory เป็นเอกสารรายการสั่ง จึงต้องแสดงเฉพาะเมื่อแถวที่ขยายเลือก detail tab `order`; เมื่อเลือก `ออกผล` ให้ซ่อนปุ่ม PDF แบบเดียวกับการสลับ action `ดูผล`/`HN`
- ปรับ generator ให้ช่อง PDF เป็น `template` ที่แยก active Order, result tab placeholder และ cancelled-row Retest ชัดเจน ป้องกันเงื่อนไข `v-else-if` ไหลไปแสดง Retest บน active Order เมื่อ PDF ถูกซ่อน. ไม่เปลี่ยน report ID/params, HN direct print agent, ดูผล หรือ EMR
- Regenerate `lab-cpoe-worklist-waiting-v1.json`; LAB Form regression, SDForm validator, full offline HL7 suite และ `git diff --check` ผ่าน. ยังต้อง re-import Form และยืนยัน Builder/runtime จริง

## [2026-09-21] fix | เพิ่ม PDF รายงานผลใน popup ระดับ Order ของ LAB ทั่วไป

- ตรวจ HIS แบบ read-only ยืนยัน Report Factory `Lab result` `6aa8f5a8b92813319a86ea11` ผูก SQL Factory `lab_result_slip` `6ab0a1c4d0c3ef2e97911e55`, เปิด public และรับพารามิเตอร์บังคับ `xparentx` ซึ่งต้องเป็น `_id` ของ `zdata_lab_report_manual_entry`; ตัวอย่าง default parent มี Result Items 10 แถวและชื่อ field ที่ Report ใช้ตรงกับ SQL output
- พบข้อจำกัดของ SQL ทีม: `specimen` และ `collected` ถูก project จาก literal `null` จึงแสดง `-`; ไม่แก้ live SQL ในงานนี้. เพิ่มปุ่ม `รายงานผล` สีแดงใน header เฉพาะ popup มาตรฐานระดับ Order; Item-level และ Section `MB` ไม่แสดง. Partial/final ใช้ได้เมื่อ resolve canonical parent ได้หนึ่งชุด; หลาย parent จะปิดปุ่มเพื่อไม่พิมพ์ข้อมูลไม่ครบ
- Worklist API ส่ง `result_report_id` ของ parent ต่อ Result row เพื่อไม่สับสนกับหัวไฟล์แนบ. Regenerate Form และปรับ design/tests. Worklist API/Form tests, SDForm validator, full offline HL7 suite และ `git diff --check` ผ่าน; ยังต้อง replace Worklist Process, re-import Form และทำ Builder/runtime/real-PDF UAT. ไม่มี HIS write/commit/push

## [2026-09-21] fix | ลด action ซ้ำในรายการผลระดับ Item

- ผู้ใช้ย้ายการดูและแก้ไขผลไปใช้ popup ระดับ Order เพียงจุดเดียว; เปลี่ยนปุ่มระดับ Item จาก `แก้ไขผล`/`ดูผล` เป็น `ปกปิดผล` หรือ `ยกเลิกปกปิด` ตามสถานะ และเปลี่ยนหัวคอลัมน์เป็น `การแสดงผล`
- ปุ่มใหม่โหลด persisted Result Item ก่อนเปิด dialog เหตุผล และใช้ `set_result_visibility` เดิม จึงคง audit ผู้ดำเนินการ/เวลา/เหตุผล รวมถึงไม่แก้ค่าผลหรือ Critical workflow. โหมดสืบค้นข้ามห้องยังเป็น read-only และไม่แสดง action นี้
- Order popup, ดินสอแก้ไขผลรวม, Result PDF, HN direct print agent, EMR และ MLab viewer ไม่เปลี่ยน. LAB Form/API regressions, SDForm validator และ `git diff --check` ผ่าน; ยังต้อง re-import Form และยืนยัน Builder/runtime จริง

## [2026-09-21] fix | แก้สถานะ Item ที่สื่อว่ามีขั้นยืนยันผล

- พบว่า label `รอยืนยัน` เป็น fallback ฝั่ง UI เมื่อ Item มี `resulted_at` แล้วแต่ไม่มีค่า `is_critical=true/false`; ไม่ใช่สถานะหรือ workflow จาก API
- เปลี่ยนเป็น `ออกผลแล้ว` และคงสีเทากลางเพื่อไม่สรุปเองว่าเป็นผลปกติ. `ค่าวิกฤติ`, `ไม่พบค่าวิกฤติ` และ `รอผล` ยังคงตามข้อมูลเดิม

## [2026-09-21] correction | แยกสถานะผลออกจาก Critical อย่างสมบูรณ์

- แก้ข้อสรุปรอบก่อน: Critical ไม่ใช่สถานะผลและหลายรายการไม่มีเกณฑ์ Critical จึงห้ามใช้ `is_critical=false/null` แปลว่า `ไม่พบค่าวิกฤติ` หรือกำหนดสถานะ Item
- คอลัมน์สถานะแสดง `ออกผลแล้ว` เมื่อมี `resulted_at` และ `รอผล` เมื่อยังไม่มีผลเท่านั้น; เพิ่ม badge `ค่าวิกฤติ` แยกต่างหากเฉพาะ `is_critical=true`

## [2026-09-21] fix | ซ่อนคอลัมน์การแสดงผลในโหมดสืบค้น LAB

- โหมด `สืบค้นผลแลป` เป็น read-only และไม่มีปุ่มปกปิดอยู่แล้ว จึงตัดทั้งหัวคอลัมน์ `การแสดงผล` และ cell ว่างระดับ Item ออก พร้อมปรับ result grid จาก 5 เป็น 4 คอลัมน์
- โหมด `รายการวันนี้` ยังคงคอลัมน์และปุ่ม `ปกปิดผล`/`ยกเลิกปกปิด` ตามเดิม; ไม่เปลี่ยนสถานะผล, Critical badge หรือ Order-level result popup

## [2026-09-21] audit | ทบทวนสถานะ TOR X-ray จากฐานข้อมูลและอัปเดต artifact

- **เปิดหน้า HIS ไม่ได้**: ลิงก์ `app-viewer?appId=6a7d5a4374a0be190cc3275b` ต้องล็อกอิน เครื่องมือดึงหน้าเว็บได้แค่ shell; และ appId นั้นคือแอป **LAB** ไม่ใช่ X-ray จึงตรวจจากฐานข้อมูล read-only กับบันทึกงานแทน และไม่แตะข้อ TOR ที่ต้องยืนยันด้วยตาบนหน้าจอ
- **หลักฐานใหม่จาก `his` (read-only):** `zdata_cpoe_order_item` มี Accession 17 ใบ — `transport.status:ok` 5 ใบ (ทั้งหมดวันที่ 18 ก.ย. หลังทีมแก้ `xray_api_order` 14:05 คือ DX001/US001/DX002/DX003/DX004) และ `failed` 12 ใบจากช่วง 1–10 ก.ย.
- **เดินครบวงแล้วหนึ่งเคส:** `SM20260918DX004` ส่ง 15:20:58 → `zdata_xray_order_status_change` 2 ครั้ง ล่าสุด 15:43:13 → `zdata_xray_result` แถวที่ 7 เวลา 16:12:00 · ต่างจากเคสเก่าที่ทีมยิงผลตรงเข้ามา
- **ปรับสถานะ TOR 4 ข้อ:** §3.4.3.2 ส่ง work list และ §3.4.3.5 ส่ง work list → **ครบ**; §3.4.3.1 ข้อมูลตรงกัน RIS/HIS และ §3.4.3.5 รหัสบริการตรงกัน → **บางส่วน** · ผลรวมจาก 12/13/48 เป็น **ครบ 14 / บางส่วน 13 / ยังไม่มี 46** จาก 73 ข้อ (19%/18%/63% · ถ่วงน้ำหนัก ≈ 28%)
- **ที่ยังค้าง:** คำสั่งยกเลิกยังได้ forward HTTP 401 (`MR003`/`CT002` audit ยังเป็น `LocalSaved:true`) · UAT 7 ขั้นของ RIS (prelim/final/addendum/reset) ยังไม่ครบ · ใบค้างสถานะล้มเหลว 12 ใบยังไม่ได้ส่งซ้ำ · `zdata_xray_contrast_media` ยังว่าง 0 แถว แปลว่าฟอร์มสารทึบยังไม่ถูกใช้งานจริง
- อัปเดต artifact `842038a1-fb08-4aae-8f15-347ff32f9d2e` ในลิงก์เดิม: เปลี่ยนบล็อกตัวขวางแดงเป็นบล็อกเขียว “A0 แตกแล้ว” + บล็อกเหลือง “ที่ยังค้าง” · เพิ่มบล็อก “ปิดเพิ่ม 18 ก.ย.” · แก้ tally §3.4.3.1=2/5/3 §3.4.3.2=4/2/3 §3.4.3.5=5/3/4 · อีก 69 ข้อคงสถานะเดิม
- ตรวจหลังแก้: tally ทุกหมวดตรงกับจำนวน chip รวม 73 ข้อ เปอร์เซ็นต์รวม 100 และแท็ก HTML สมดุล · ไม่แตะโค้ดหรือข้อมูล HIS

## [2026-09-21] fix | ผูก Organization กลุ่มพยาธิวิทยาคลินิกเข้าห้อง MY

- ตรวจ HIS แบบ read-only พบ `zdata_organization.unit_code=m1000` ชื่อ `กลุ่มงานพยาธิวิทยาคลินิกและเทคนิคการแพทย์` (อัปเดต 14:30:36) และ `m1005` ชื่อ `งานจุลชีววิทยา`; Section master ยืนยัน `MY=หน่วยเชื้อรา` และ `MB=งานจุลชีววิทยา`
- เปลี่ยน daily scope จาก `M1000=ทุกห้อง` เป็น `M1000=[MY]` และแยก `M1005=[MB]` ใน Worklist, LAB NO. Generator และ Reject Process. ผู้ใช้ M1000 จึงเห็น/สร้าง/รับเลข/ปฏิเสธเฉพาะ MY ที่มี Order; cross-room lookup ยังอ่านทุก Section ที่ enable ตามเดิม
- MY ยังใช้ Order-level Manual result ที่มีอยู่หลังรับ specimen; ไม่เปลี่ยน MLab `MB`, Receive/Agent transport หรือ Form. เพิ่ม regression ยืนยัน M1000 ทำ MY ได้และ M1005 ทำ MY ไม่ได้; Worklist/LAB NO./Reject/Receive tests และ `git diff --check` ผ่าน. ต้อง replace Process body ทั้ง 3 ตัวและทำ runtime UAT

## [2026-09-21] fix | ย้ายตัวกรองทั้งหมดไปท้ายแถบสถานะ LAB

- เปลี่ยนลำดับปุ่มเป็น `รอรับ → รับแล้ว → ออกผลบางส่วน → ออกผลครบ → ยกเลิก / ปฏิเสธ → ทั้งหมด`; คง `statusKey='all'`, status mapping และจำนวนของแต่ละสถานะเดิม
- ซิงก์ generator ให้รักษาปุ่มปกปิดผลระดับ Item และ layout 4 คอลัมน์ของโหมดสืบค้นที่มีอยู่แล้ว ก่อน regenerate Form เพื่อไม่ให้ความสามารถเดิมถอยหลัง
- LAB Form regression, SDForm validator, generator idempotence และ `git diff --check` ผ่าน; ยังต้อง re-import Form และตรวจลำดับปุ่มใน Builder/runtime จริง

## [2026-09-22] note | Mockup การ์ดผล Lab/X-ray ในหน้า EMR (สรุปการรักษา)
- ศึกษา `Form-Builder/SDForm/sdform_module/EMR_form/EMR_appointment_v2.json`: การ์ด "สรุปการรักษา" = `card62530` → vue-ui `treat_summary` อยู่คอลัมน์ `grid_col18329` span 5/24 (กว้างจริง ~300px); การ์ด "ใบสั่งตรวจ LAB · X-RAY" = `item_card` เห็นเฉพาะใบสั่ง ไม่มีผล
- สร้าง `02-his/ui/emr-lab-result-card-mockup.html` — mockup อย่างเดียว ไม่แตะฟอร์มจริง
- แนวทางที่เสนอ: จับกลุ่มผลเป็น "ก้อนผลต่อ 1 ใบสั่ง (order + section)" · ใบที่ยังไม่ออกผลอยู่ลิสต์เดียวกันพร้อม stepper · ค่าวิกฤติเด้งโดยไม่ต้องกาง · พับค่าปกติ · ค่าก่อนหน้าติดทุกบรรทัด · สลับมุมมอง "ตามใบสั่ง / ตามค่าตรวจ (แนวโน้ม)" · คั่น "วิสิทนี้ / ย้อนหลัง" เพราะผลผูกกับ HN ไม่ใช่ visit
- ข้อมูลอ้างอิงจากของจริง: CPOE Order/Item · Work Item `6a95c750422c1ca959829e8a` · Result Item `6a8bc91df851000f28e501fb` · `zdata_xray_result`
- ค้าง: `emr-summary-get` `6a9574cc1812c7078a067299` ยังคืน `lab[]` แบน ๆ ต้องเพิ่ม shape `lab_orders[]` แบบ additive ก่อนทำจริง (ยังไม่ได้แก้)

## [2026-09-22] note | เคาะขอบเขตการ์ดผล Lab/X-ray ใน EMR = VN นี้ + ผลออกวันนี้
- ผู้ใช้เคาะ: การ์ดแสดงแค่ 2 กลุ่ม — ① ใบสั่งของ VN ที่เปิดอยู่ (ทุกสถานะ รวมรอผล/ยกเลิก) ② ใบที่สั่งจากวิสิทก่อนแต่ "ผลออกวันนี้"
- ตัดส่วน "ย้อนหลัง" และปุ่ม "ดูผลย้อนหลังทั้งหมด" ออก — ผลเก่ายังเห็นผ่านบรรทัด "ก่อนหน้า <ค่า> (<วันที่>)" และมุมมอง "ตามค่าตรวจ"
- ยืนยัน: stepper ขึ้นเฉพาะใบที่ยังไม่มีผล (`sent/accepted/collected/in_process`) เท่านั้น · ใช้ popup "ดูผลทั้งใบ" ตามที่ออกแบบ · ไม่ทำ workflow "หมอรับทราบค่าวิกฤติ"
- ปรับ `02-his/ui/emr-lab-result-card-mockup.html` ตามนั้น (mockup อย่างเดียว ไม่แตะฟอร์มจริง)
- ค้างให้เคาะ: เวลาที่ใช้นิยาม "ผลออกวันนี้" (เสนอ `resulted_at` ที่ HIS รับผล) · เปิด EMR ย้อนหลังให้ยึดวันของวิสิทที่เปิด ไม่ใช่วันปัจจุบัน · ผล `corrected` ที่ส่งแก้วันนี้นับเข้ากลุ่ม ② พร้อมป้าย "แก้ไขผล" · `emr-summary-get` ต้องเพิ่ม `lab_orders[]` แบบ additive

## [2026-09-22] note | การ์ดผล EMR: โชว์ผลล่าสุดอย่างเดียว ค่าก่อนหน้าอยู่ใน popup
- ผู้ใช้เคาะ: "ผลออกวันนี้" นับจาก **เวลาที่ผลเข้าระบบ HIS** (ไม่ใช่เวลาที่ LIS ออกผล)
- ผู้ใช้เคาะ: หมอควรเห็น **ผลล่าสุดค่าเดียว** ⇒ ตัดค่าก่อนหน้าออกจากบรรทัดในการ์ด เหลืออยู่ในคอลัมน์ "ค่าก่อนหน้า" ของ popup "ดูผลทั้งใบ" และมุมมอง "ตามค่าตรวจ" เท่านั้น
- ไม่แสดงค่าที่ถูกแก้/ป้าย corrected — ตรงกับ canonical contract ที่ `Result Item` เก็บค่าล่าสุดค่าเดียวอยู่แล้ว (LIS corrected ทับค่าเดิม ไม่ append)
- ผลพลอยได้: ไม่ต้อง lookup ค่าเก่าราย observation ตอนโหลดการ์ด เรียกเฉพาะตอนเปิด popup
- ค้างข้อเดียว: นิยาม "วันนี้" — เสนอใช้ **วันของวิสิทที่เปิดอยู่** เป็นกติกาเดียว (เปิดวิสิทวันนี้ = วันนี้ · เปิดวิสิทเก่าผ่าน deep link จาก LAB Worklist = วันของวิสิทนั้น) รอผู้ใช้ยืนยัน

## [2026-09-22] note | โค้ดวางจริงของแท็บ Lab/X-Ray ในการ์ดสรุปการรักษา
- `Form-Builder/API/form-factory/events/treat-summary-lab-xray-oncreated-v1.js` — บล็อกต่อท้าย onCreated: state/helper/ตัวประกอบก้อนผล, stepper, แนวโน้ม, X-ray, ห่อ `tsLoad` เพื่อล้าง state ใหม่
- `02-his/form-factory/treat-summary-lab-xray-template-v1.html` — แทนที่เฉพาะ `<el-tab-pane label="Lab">` และ `label="X-Ray"` เท่านั้น
- แตะของเดิมบรรทัดเดียว: เติม `s.tsAbsorb(d);` ต่อจาก `s.tsXray = ...` ใน callback ของ `tsLoad`
- ถ้า process ยังไม่ส่ง `lab_orders`/`xray_results` → `tsLgOn`/`tsXgOn` เป็น false แล้ว Template ตกไปใช้ลิสต์แบบเดิม (คัดลอกมาเทียบแล้วตรงกับ live ทุกตัวอักษร) ⇒ แปะแล้วของเดิมไม่พัง
- ไม่แตะแท็บยา/หัตถการ, หัวการ์ด, ปุ่ม "ดูทั้งใบ", บล็อก CC/HPI/PE/Dx
- ทดสอบ: รันบล็อก JS กับ mock ตามสัญญาข้อมูล — หัวก้อน/สถานะ/stepper/ค่าวิกฤติ/แนวโน้ม/ปุ่มเปิดใบ ถูกต้อง, payload ว่างคืน fallback ถูก; ตรวจการซ้อนแท็กของ Template ผ่าน
- ค้าง: `emr-summary-get` `6a9574cc1812c7078a067299` ต้องเพิ่มคีย์ `lab_orders[] / xray_results[] / lab_trends[] / current_vn` แบบ additive และยืนยันนิยาม "วันนี้" = วันของวิสิทที่เปิดอยู่

## [2026-09-22] note | ตรวจการรวมโค้ด treat_summary (Lab/X-Ray) ที่ผู้ใช้วางเอง
- สร้างไฟล์ฉบับรวมอ้างอิงจากต้นฉบับ + บล็อกใหม่ แล้วตรวจ: `s.tsAbsorb(d)` เรียกจริง 1 ครั้งถูกตำแหน่ง (หลัง `s.tsXray = Array.isArray(d.xray)…`), แท็บครบ 4 (med/lab/xray/proc), pane ยา+หัตถการ/หัวการ์ด/ท้ายไฟล์ ไม่ถูกแตะแม้แต่ตัวอักษรเดียว, fallback ของ Lab/X-Ray ตรงกับของเดิม, การซ้อนแท็กผ่าน, key ที่ template อ้าง 35 ตัวมีครบใน onCreated
- รัน end-to-end จำลอง process ตอบกลับ: ของเดิม (cc/dx/meds/tsLab/tsXray/tsUi.tab/หัวการ์ด/ดูทั้งใบ) ทำงานครบ และของใหม่ (sections, หัวก้อน, stepper, ผลออกวันนี้, กางก้อนวิกฤติอัตโนมัติ, trend, ปุ่มเปิดฟอร์ม, tsReload) ถูกต้อง
- ต่างจากฉบับอ้างอิงเฉพาะเรื่องรูปแบบ: ผู้ใช้ย่อหน้า `s.tsAbsorb(d);` ด้วย space แทน tab และเติมคอมเมนต์คั่นหัวข้อ Lab / X-Ray — ไม่กระทบการทำงาน
- ข้อควรระวังที่บันทึกไว้: `emr-summary-get` ต้องคืน `lab[]`/`xray[]` เดิมต่อไป เพราะตรรกะเลือกแท็บเริ่มต้นยังอ่านจาก `tsLab.length`/`tsXray.length`

## [2026-09-22] note | ส่วนต่อขยาย emr-summary-get: lab_orders / xray_results / lab_trends
- เขียน `Form-Builder/API/api-factory/processes/emr-summary-get-board-ext.js` — บล็อกเพิ่มใน Process `6a9574cc1812c7078a067299` (แตะของเดิม 0 บรรทัด เพิ่ม 3 จุด: วางบล็อกเหนือหัวข้อ 1, เติม 4 คีย์ในทั้ง early-return และ return สุดท้าย)
- **สคีมาจริงที่ตรวจจาก Mongo (สำคัญ):** `zdata_lab_result_item.visit_id` และ `zdata_lab_work_item.visit_id` เก็บเป็น **VN** ("6900305") ไม่ใช่ visit `_id` · `zdata_xray_order.VisitNo` ก็เป็น VN · `zdata_xray_result` ไม่มี visit ต้องต่อผ่าน `AccessionNo` · Work Item `_id` = CPOE Item `_id` · `source_order_id` = CPOE Order `_id` · Result Item `order_no` = Work Item `_id`
- ตั้งต้นจาก `zdata_cpoe_order_item` (ผ่าน `order_id.xtbxlv2_xfx_id`) ไม่ใช่ Work Item เพราะใบที่ห้องแลปยังไม่รับจะไม่มี Work Item แล้วใบ "รอผล" จะหายทั้งใบ
- "ผลออกวันนี้" ใช้ `created_at` ของ Result Item (เวลาที่ผลเข้า HIS) ช่วง `[visit_date, วันถัดไป)` และ "วันนี้" = `visit_date` ของวิสิทที่เปิด
- ความคืบหน้าต่อรายการ = ฝั่งที่ไปไกลกว่าระหว่าง CPOE `current_status` กับ Work Item `work_status` (+ ถ้ามี `received_at` ยกขั้นเป็น accepted) เพราะ projection ฝั่ง CPOE ตามหลังได้ · สถานะของใบ = ขั้นที่ช้าที่สุดของรายการที่ยังไม่ตาย · มีผลแล้วแต่สถานะยังค้าง จะยกเป็น resulted เพื่อไม่ซ่อนค่าผลไว้หลัง stepper
- ทดสอบด้วย fixture ตามสคีมาจริง: 4 ก้อน (accepted รอผล / completed มีผล+วิกฤติ / today Microbiology / cancelled ท้ายสุด), trend 2 จุด, X-ray 2 ใบ (visit + today) และเคสขอบ (ไม่มี visit_id, visit_id ผิด, ไม่มี hn) ผ่านทั้งหมด — ยังไม่ deploy และยังไม่ได้ทดสอบกับข้อมูลจริง

## [2026-09-22] fix | ผล Microbiology เป็นรายงานความเรียง — แยกถังที่ 3 ในการ์ด EMR
- ตรวจ process กับ **ข้อมูลจริง** (read-only) VN `6900284` / visit `6aacbf601c5232627d0c6f0f`: join `order_id.xtbxlv2_xfx_id` คืน CPOE Item 13 แถว, Work Item `_id` = CPOE Item `_id` ตรงจริง, `source_order_id` เป็น string ส่วน CPOE `order_id.value` เป็น ObjectId (โค้ดแปลงเป็น hex ทั้งคู่จึง match), ช่วงวันแบบ string `$gte/$lt` ใช้ได้
- **ของจริงที่ fixture จับไม่ได้:** ผล MB/MLab เก็บ `result_value` เป็นรายงานทั้งใบ (1,500+ ตัวอักษร มี \r\n) `obs_name`/`test_name` เป็นรหัสล้วน ("4001") และ `is_critical=false` แม้ขึ้นเชื้อ E. coli ดื้อยา ⇒ การ์ดเดิมจะพ่นข้อความยาวท้ายบรรทัดและพับไว้ใต้ "ค่าปกติ"
- แก้ 3 ไฟล์: process ติดธง `text:true` เมื่อค่ามีขึ้นบรรทัดใหม่หรือยาวเกิน 60 ตัวอักษร + ใช้ `item_name` ของ CPOE Item แทนชื่อที่เป็นรหัสล้วน + ตัดรายงานออกจากการคำนวณแนวโน้ม; widget แยกถัง `texts` (แสดงเสมอ ไม่พับรวมกับค่าปกติ) และ chip เป็น "มีรายงานผล" (info) แทน "ปกติทั้งหมด" เพราะ LIS ไม่ได้บอกว่าปกติ; template เพิ่มบล็อกรายงานพับ 4 บรรทัด + ปุ่มอ่านเต็ม และแถบวิกฤติไม่พ่นรายงานทั้งใบ
- ตรวจซ้ำ: fallback ของ Lab/X-Ray ยังตรงกับ live ทุกตัวอักษร · key ที่ template อ้าง 22 ตัวมีครบ · process + widget รันผ่านทั้งเคสปกติและเคสรายงานความเรียง
- ยังไม่ deploy process · ยังไม่ได้ทดสอบบนจอจริง

## [2026-09-22] note | ผูกปุ่มรายงานผล PDF ในการ์ด EMR (ห้องแลปทั่วไปก่อน MB)
- ผู้ใช้สั่ง: ใช้ Report `6aa8f5a8b92813319a86ea11` สำหรับผลห้องแลปทั่วไปก่อน · Microbiology ยังไม่เอาเพราะ SQL ยังไม่เชื่อม
- ตรวจวิธีที่ระบบใช้จริงจาก `lab-cpoe-worklist-waiting-v1.json`: คอมโพเนนต์ `<sd-report :report-list="[{reportId,label,type:'pdf'}]" :params="{xparentx:<result_report_id>}" size="small" />` — Report ผูกกับ Result Report ไม่ใช่ใบสั่ง และ Worklist ซ่อนปุ่มเมื่อใบมีผลหลายชุด (`labResultPdfParentIds().length>1`)
- Worklist มี `MICROBIOLOGY_RESULT_PDF_REPORT_ID='6ab1c2d3e4f5061728394a5b'` ซึ่งเป็น placeholder พร้อมข้อความ "ยังไม่ได้ตั้งค่า Report Factory สำหรับ Microbiology" — ยืนยันสิ่งที่ผู้ใช้บอก
- process: เพิ่ม `section_code` และ `result_report_ids` ต่อก้อน (เพิ่ม `result_report_id` ใน projection)
- widget: `LAB_RESULT_PDF_REPORT_ID` + `NO_PDF_SECTIONS=['MB']` คำนวณ `report_ready/report_list/report_params/report_hint` · MB ยังอ่านรายงานในการ์ดได้ แต่ไม่มีปุ่ม PDF พร้อมข้อความบอกเหตุ
- template: ใช้ `<sd-report>` เมื่อพร้อม ไม่พร้อมก็ขึ้นเหตุผลแทน และคงปุ่ม "ดูผลทั้งใบ" ไว้เป็นทางเปิด record
- จับบั๊กจากการรันจริง: ครั้งแรกใส่ค่าคงที่ผิดไฟล์ (ไปอยู่ฝั่ง process) ทำให้ `NO_PDF_SECTIONS is not defined` — แก้แล้ว
- ตรวจซ้ำ: fallback Lab/X-Ray ยังตรงกับ live · การซ้อนแท็กผ่าน · key 22 ตัวครบ · รัน process + widget ผ่าน (BC ได้ปุ่ม PDF, MB ไม่ได้พร้อมเหตุผล)

## [2026-09-22] note | Mockup แท็บใหม่ "สลับรายการ CBC" ของ LAB Worklist
- คำสั่งใหม่: เพิ่มแท็บที่ 3 ในหน้า LAB Worklist ชื่อ `สลับรายการ CBC` เห็นเฉพาะห้อง `HM` (โลหิตวิทยา) และ `ML` (จุลทรรศนศาสตร์คลินิก); กรองทุก Order ที่มีรายการ `HM1` หรือ `MS1` แล้วยกมาทั้ง Order; คอลัมน์มีตัวย่อห้องเหมือนแท็บสืบค้น; ปุ่ม action เดียวคือ `สลับรายการ` + popup ยืนยัน `MS1 → HM1` / `HM1 → MS1`; ยืนยันแล้ว Order ไหลเข้าห้องปลายทางตามปกติ
- สร้าง mockup อย่างเดียว ยังไม่แตะ Form/Process: `02-his/ui/lab-cbc-swap-tab-mockup.html` · artifact `9c535ea5-56aa-4ac2-a498-9e23f458bab1`
- คำสั่งนี้กลับมติเดิม `[2026-09-01] decision | Keep CBC routing inside the existing Worklist` ที่เคยปฏิเสธการเพิ่มแท็บ CBC — ยึดคำสั่งล่าสุด รอผู้ใช้ยืนยันเพื่อบันทึกเป็นมติแทน
- ข้อเสนอเชิงความปลอดภัยใน mockup: ปิดปุ่มสลับเมื่อ Item รับ specimen แล้ว (ออก LAB NO./Outbound แล้ว รหัสจะไม่ตรงกับ LIS)
- คำถามที่ยังไม่เคาะ: สลับแล้วให้ค้างในแท็บนี้หรือหายทันที · เหตุผลบังคับหรือไม่ (มติ 09-01 เคยบังคับ) · ขอบเขตรหัสรวม `HM1-R`/`MS1-R`/`NAP-MS-1` ด้วยหรือไม่

## [2026-09-22] correction | Report micro มีอยู่จริง ไม่ใช่ placeholder — เชื่อมปุ่มทั้งสองแล้ว
- **แก้ข้อมูลที่บันทึกผิดในรายการก่อนหน้าวันเดียวกัน:** `6ab1c2d3e4f5061728394a5b` ไม่ใช่ placeholder ตรวจ `module_report` แล้วมีอยู่จริง `pdf_name = "Lab result - microbiology (static)"` · `pdf_from = zdata_visit` · `pdf_form_id = 6a40fdec4b6dfdf45acbfbce` · แก้ล่าสุด 2026-09-18 14:53
- `6aa8f5a8b92813319a86ea11` = `pdf_name "Lab result"` · `pdf_from = zdata_lab_report_manual_entry` · `pdf_form_id = 6a8d4334f851000f28e5025b` ⇒ ยืนยันว่าผูกด้วย `xparentx = result_report_id` ถูกต้อง
- ผู้ใช้สั่ง: คงปุ่ม PDF ของ micro ไว้ และเพิ่มปุ่มของผลแลปทั่วไปด้วย (Report ทั่วไปเชื่อมสมบูรณ์แล้ว ส่วน micro เชื่อม Report ไว้รอ SQL)
- widget: `LAB_RESULT_PDF_REPORT_ID` + `MICRO_RESULT_PDF_REPORT_ID` + `MICRO_SECTIONS=['MB']` · micro ใช้ params ว่างเหมือน Worklist (Report เป็น static) และมี hint เตือนว่ายังเป็น static · ทั่วไปยังต้องมี Result Report ชุดเดียวจึงพิมพ์ได้
- รันผ่าน: BC → `ready=true` + `xparentx` · MB → `ready=true` + params ว่าง + hint

## [2026-09-22] decision | เคาะกติกาแท็บสลับรายการ CBC (ยังไม่ลงมือ implement)
- ผู้ใช้ยืนยัน **เปลี่ยนมติ** `[2026-09-01] decision | Keep CBC routing inside the existing Worklist` — เพิ่มแท็บ `สลับรายการ CBC` ได้ เป็นข้อยกเว้นเฉพาะงาน CBC ของห้อง `HM`/`ML`
- สลับแล้ว **ไม่ค้างในแท็บ** — แถวออกจากแท็บทันทีและไปโผล่ที่ `รายการวันนี้` ของห้องปลายทาง (ตัวเลขบนแท็บ/ชิป/สรุป ลดทันที) ประวัติการสลับเก็บที่ Work Item
- **เหตุผลไม่บังคับ** — แทนที่มติ 09-01 ที่เคยกำหนดว่าบังคับ; คงช่องเหตุผลเป็นตัวเลือกใน popup
- **ขอบเขตรหัส = `HM1` / `MS1` เท่านั้น** — `HM1-R`, `MS1-R`, `NAP-MS-1` ไม่อยู่ในรอบนี้
- อัปเดต mockup ตามมติแล้ว: `02-his/ui/lab-cbc-swap-tab-mockup.html` (artifact `9c535ea5-56aa-4ac2-a498-9e23f458bab1`) — ลบแถวตัวอย่าง "สลับแล้ว", เพิ่ม empty state, เพิ่มสถานะ "ห้องนี้ไม่มีแท็บ" เมื่อจำลองเป็นห้อง BC และปุ่มรีเซ็ต mockup
- ผู้ใช้สั่ง **ยังไม่ต้อง implement** — ไม่แตะ Form/Process ใด ๆ
- ยังค้าง: ข้อเสนอปิดปุ่มสลับเมื่อรับ specimen แล้ว (LAB NO./Outbound ออกไปแล้ว) รอผู้ใช้ยืนยัน

## [2026-09-22] decision | ล็อกปุ่มสลับ CBC หลังรับ specimen (mockup only)
- ผู้ใช้ยืนยัน: สลับรายการ CBC ได้เฉพาะ **ก่อนรับ specimen** เพราะเมื่อออก LAB NO. และส่ง Outbound แล้ว การเปลี่ยนรหัสจะทำให้ LAB NO./ผลจาก LIS ไม่ตรงกับรายการ
- เกณฑ์ปิดปุ่มยึด **สถานะของรายการ CBC เอง** ไม่ใช่สถานะรวมของ Order — Order ที่รายการอื่นรับไปแล้วแต่ CBC ยัง `sent` ต้องยังสลับได้
- อัปเดต `02-his/ui/lab-cbc-swap-tab-mockup.html` (artifact `9c535ea5-56aa-4ac2-a498-9e23f458bab1`): เปลี่ยนโน้ต ⚠ เป็น ✅ · แก้ tooltip/label แถวที่ปิดปุ่มให้อ้างรายการ CBC · เพิ่มแถวตัวอย่างที่ 5 (CBC ยังรอรับ แต่รายการอื่นรับแล้ว → ปุ่มยังเปิด) · ตัวอย่างรวมเป็น 5 Order (HM1 2 · MS1 3)
- ยังไม่ implement ตามคำสั่งผู้ใช้ — ไม่แตะ Form/Process; ขณะนี้ทุกข้อของแท็บ CBC เคาะครบแล้ว

## [2026-09-23] note | X-ray worklist — เพิ่มคอลัมน์ "สารทึบ" ระดับ item (ตัวเลือก A)
- ผู้ใช้เลือกตัวเลือก A จาก artifact `50ca6184-938a-4c6f-b694-ebcff8aa3eeb` ("เพิ่มคอลัมผูกปุ่มของ xray ตามนี้หน่อย ห้ามกระทบ flow อื่นนะแค่เพิ่มมา") และยืนยันว่า log การใช้สารทึบเก็บไว้ในฟอร์มการใช้สารทึบเอง
- แก้ `Form-Builder/seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js` → regenerate `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json`
  - คอลัมน์ที่ 12 `สารทึบ` 130px ต่อจาก `สติ๊กเกอร์ HN` · `min-width` 1481px → 1621px · คอลัมน์ 1–11 เดิมคงสัดส่วนเท่าเดิม
  - `openContrastRecord(row,item)` เปิดฟอร์ม `6aa2424809c1bad08952da71` (จาก spec.md) พร้อม initData `hn/patient_name/patient_age` และ params `order_id · item_id · accession_no · item_code · item_name · modality · visit_id`
  - `CONTRAST_FORM_ID` ตั้งผ่าน `XRAY_CONTRAST_FORM_ID` ได้ · ค่าว่าง = ปุ่มยังขึ้นและบอกเหตุผล (decision X17 ห้ามปุ่มตาย)
  - `item.contrast_label` ขึ้นชิปเมื่อ API คืน `contrast{brand,volume_ml,...}` หรือคีย์แบน — ตอนนี้ API ยังไม่คืน ⇒ ทุกแถวขึ้น `+ บันทึก` ("ไม่มีข้อมูล" = ยังไม่ได้บันทึก ไม่ใช่ไม่ได้ฉีด)
- เทส `Form-Builder/API/tests-tools/tests/test_xray_cpoe_worklist_form.js` ผ่าน; assertion `min-width:1481px` 2 จุดถูกแก้เป็น 1621 พร้อมคอมเมนต์ลงวันที่ว่าผู้ใช้สั่งเปลี่ยน
- 🔴 ยังไม่ปิด "แสดงสารทึบอัตโนมัติ": ฟอร์มสารทึบยังไม่มีช่องรับ `order_id/item_id/accession_no` และ `xray_cpoe_worklist_api.js` ยังไม่คืนค่าสรุป ⇒ ชิปยังไม่ขึ้นจริง (ไม่ได้แตะทั้งสองอย่างในรอบนี้)
- 🔴 regenerate ฟอร์มนี้ต้องใส่ `XRAY_RIS_VIEWER_ENABLED=1` เสมอ ไม่งั้นปุ่ม "ดูภาพ" ถูกปิดกลับเงียบ ๆ

## [2026-09-23] note | LAB/X-ray integration auto-diagnostic toolkit
- เพิ่ม `Form-Builder/API/tests-tools/scripts/integration_autodiag.js` แบบ additive ไม่แก้ Process เดิม: รองรับ `lab-order`, direct `lab-agent`, `lab-result`, `xray-dispatch`, direct `xray-order`, `xray-result`.
- ค่าเริ่มต้นเป็น dry-run; no-write smoke ใช้ payload ผิดโดยตั้งใจ; valid request ต้องมี `--send --confirm-write`; credential อ่านจาก environment เท่านั้น.
- ตรวจ config/schema/network/auth/HTTP/Process-ACK/correlation และรับ optional evidence เพื่อตรวจ persistence/downstream/worklist; รายงาน Markdown/JSON redact secret/PHI และ hash identifier.
- เพิ่มคู่มือ `02-his/api-factory/docs/INTEGRATION_AUTODIAG_TOOL.md` และ regression `test_integration_autodiag.js`.
- Verification ผ่าน: tool test, LAB submit test, LAB result receiver test, X-ray dispatch test. Existing `test_xray_ris_team_apis.js` ยัง fail ก่อนงานนี้ที่ assertion required-fields: source `xray-api-ris-result.js` ปัจจุบันตอบ `no accession_no`/ตรวจหลักเพียง AccessionNo แต่ test/spec คาด required fields ครบ; ไม่แก้ไฟล์เดิมในรอบนี้.

## [2026-09-23] note | X-ray สารทึบ — เพิ่มช่องผูกรายการตรวจในฟอร์ม + ส่งค่าทาง initData
- ผู้ใช้ยืนยัน: ฟอร์ม `xray-contrast-media-record-v1` ต้องมีช่องเก็บ `order_id / item_id / accession_no` เพื่อผูกกลับมาที่รายการตรวจ
- `Form-Builder/seed/tests-tools/scripts/build_xray_contrast_media_form.js`
  - เพิ่มการ์ด `cmr_link` **ต่อท้ายฟอร์ม** (พับไว้ `folded:true`) 8 ช่อง readonly: `item_id · accession_no · order_id · order_no · visit_id · modality · item_code · item_name`
  - `card()` รับ `folded` ได้ (ไม่ส่ง = `false` เหมือนเดิมทุกการ์ด)
  - 🔴 แก้บั๊กที่เพิ่งจะเกิด: `summaryCard = fields[fields.length-1]` เปลี่ยนเป็นค้นด้วยชื่อ `cmr_history` ไม่งั้น `onUnmount` ที่เคลียร์ `setInterval` ของหน้าสรุปจะไปลงการ์ดใหม่แล้ว timer รั่ว
  - แก้ข้อความหัวฟอร์มที่บอกว่า "ยังไม่มีปุ่มเปิดจากหน้า X-ray worklist" ซึ่งไม่จริงแล้ว
  - ฟิลด์เดิม 44 ตัวอยู่ครบ (44 → 53) · `card90009 … card90036` ไม่เลื่อน
- `build_xray_cpoe_worklist_ui.js` → `openContrastRecord` ส่งตัวระบุรายการทาง **initData** (เดิมส่งแต่ `params` ซึ่งลงที่ `form.formParams` ไม่ได้เขียนค่าลงฟิลด์ ⇒ บันทึกไม่ติดจริง) · `params` ชุดเดิมยังส่งไว้ ไม่ถอด
- HN: ผูกอยู่แล้วผ่านช่อง `hn` เดิมของหมวด 1–2 — ไม่สร้างช่องซ้ำ · ช่องนี้ยังแก้ด้วยมือได้ (required, ไม่ readonly) จึงเพิ่ม `visit_id` ไว้เป็นตัวยึด encounter ที่คนพิมพ์ทับไม่ได้
- เทส: `test_xray_contrast_media_form.js` (คุมการ์ด/readonly/ลำดับ/ตำแหน่งท้ายสุด/timer) และ `test_xray_cpoe_worklist_form.js` (เทียบคีย์ initData กับชื่อฟิลด์จริงในฟอร์มสารทึบ) ผ่านทั้งคู่ · ชุดเต็ม 46 ไฟล์ ผ่าน 36 ตก 10 เท่าเดิม (ของเดิมที่ตกอยู่ก่อนแล้ว)
- 🔴 `output/xray-contrast-media-record-v1-import-ready.json` เป็นสำเนาเก่า 2026-09-11 ตอนนี้ **ล้าสมัยแล้ว** — ให้ import จาก `Form-Builder/SDForm/X-ray/` เท่านั้น

## [2026-09-23] query | LAB NO. 206909230001 — รหัสรายการสั่งตรวจที่ส่งออก และ mapping CBC ที่ผิด
- คำถาม: LAB NO. `206909230001` ส่ง "รหัสรายการสั่งตรวจ" อะไรไปให้ Agent
- ตอบ: `test_code = 2201EB` (specimen `EB`, lab `HM`) · `order_no` ที่ส่งคือ work-item id `6ab34e21cec3020e8562a216` ไม่ใช่ `R2609230001` · Agent ตอบ `202 queued` (dispatch 45, order_ref 50, routed `rax-file`) แต่ HIS ยัง `hl7_status: queued`
- หลักฐาน: `his.zdata_lab_outband_order.request_payload_json` · work item `zdata_lab_work_item` · master `zdata_master_item_order.HM1.lab_item.his_lab_code` · `lab_cpoe_receive_api.js:765`
- 🔴 พบของผิด: `zdata_lab_catalog` บอกว่า `2201EB` = **Hb Typing** (section HH) ส่วน CBC จริงคือ `2001EB` (HM) และ `2101EB` (ML) — แต่ `HM1`, `MS1`, `HM1-R`, `MS1-R`, `NAP-MS-1` ผูกกับ `2201EB` ทั้งหมด และไม่มี item ตัวใดผูกกับ `2001EB`/`2101EB` เลย
- ส่งออกไปแล้ว 7 ใบที่ payload มี `2201EB` (HM 6 ใบ, ML 1 ใบ)
- กว้างกว่านั้น: active item ที่มี `lab_item` 767 ตัว มี 55 ตัวที่ section ของ item ไม่ตรงกับ section ของ lab_item — ยังไม่ได้ไล่
- ไม่ได้แก้ master ใด ๆ (§14d — เป็น contract ที่ระบบอื่นอ่านอยู่ ต้องขออนุมัติก่อน) · Mongo อ่านอย่างเดียว
- ยื่นเป็นหน้า `01-knowledge-base/syntheses/lab-cbc-his-lab-code-mapping.md` + index + Hot Cache

## [2026-09-23] query | X-ray worklist ล่ม: "Identifier 'fs' has already been declared"
- ผู้ใช้ส่งภาพหน้า X-ray (`appId=6a956aad422c1ca959829e3f`): toast `API Error: Identifier 'fs' has already been declared` 6 อัน + ข้อความเดียวกันในตาราง, chip ทุกตัวเป็น 0, `ไม่พบรายการ`
- วินิจฉัย: เป็น **SyntaxError ฝั่ง server ของ Process `6a957009422c1ca959829e45`** ไม่ใช่ปัญหาของฟอร์ม
  - ฟอร์มโชว์ `error.message` ที่ `runProcess` คืนมาตรง ๆ (`s.errorMessage` ใน `loadOrders`) · 6 toast = 1 `list` + 5 `refreshCounts` พอดี
  - `Identifier 'fs' has already been declared` = ประกาศ `const fs` ซ้ำใน scope เดียวกัน
- ตรวจไฟล์ในรีโป: `Form-Builder/API/api-factory/processes/xray_cpoe_worklist_api.js` **สะอาด** — ไม่มี `fs` ไม่มี `require(` เลยสักตัว, parse เป็น async body ผ่าน, `test_xray_cpoe_worklist_api.js` ผ่าน
- ไม่มี Process ตัวไหนใน `api-factory/processes/` ใช้ `require(` เลย ⇒ body ที่ deploy อยู่ไม่ใช่ไฟล์นี้
- ผู้ต้องสงสัยที่ขึ้นต้นด้วย `const fs = require('fs')` และสับสนง่าย: `Form-Builder/API/tests-tools/tests/test_xray_cpoe_worklist_api.js` (เทสของ Process ตัวนี้เอง) และ `Form-Builder/seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js` (ตัว generate ฟอร์ม) · หรือ paste body ซ้ำสองรอบ
- วิธีแก้: ล้าง body ของ Process แล้ว paste `xray_cpoe_worklist_api.js` ทั้งไฟล์ครั้งเดียว
- ยืนยันว่า **ไม่เกี่ยวกับงานคอลัมน์สารทึบ**: ทั้ง `xray-cpoe-worklist-v1.json` และ `xray-contrast-media-record-v1.json` ไม่มี `require(` / `fs` เลย
- อ่านอย่างเดียว ไม่ได้แก้ไฟล์ใด ๆ ในรีโป

## [2026-09-23] implementation | LAB specimen receipt requires Finance-ready CPOE Item
- ผู้ใช้ยืนยัน flow ใหม่: ก่อนรับ specimen ต้องตรวจ `CPOE Order Item.current_status=ready`;
  `ready` หมายถึงผ่านการเงินแล้ว ส่วน `sent` ยังไม่ผ่านการเงินและห้ามรับ
- Worklist คง Item `sent`/`ready` ให้เลือกเพื่อแก้ specimen หรือปฏิเสธได้ แต่ปุ่ม
  `รับ specimen` เปิดเฉพาะเมื่อทุก Item ที่เลือกเป็น `ready`; กรณียังไม่พร้อมปุ่ม disabled และ
  hover tooltip ขึ้น `ยังไม่ผ่านการเงิน`. `ready` อยู่ bucket รอรับและไม่ถูก normalize เป็น
  `sent` หรือ `received` อีก
- Receive Process และ LAB NO. generator ตรวจ gate ซ้ำก่อนสร้าง LAB NO./Work Item/Outbound;
  mixed batch ที่มี Item ไม่พร้อมถูกปฏิเสธทั้งชุดโดยไม่กิน counter. Retry ของ Work Item ที่
  `received` แล้วคง idempotent แม้ CPOE projection เป็น `accepted`/terminal
- แก้ working Form + generator, Worklist/Receive/LAB NO. Processes, regression tests,
  `design/Lab_design.md`, checklist และ README; ไม่แตะ CPOE Order header
- Verification ผ่าน: AsyncFunction parse ของ 3 Process, generator syntax, Receive/LAB NO./
  Worklist/Form/Cancel/Reject suites, SDForm validator exit 0, JSON parse และ `git diff --check`
- สถานะ: local only; ต้อง replace Process `6a9434c3422c1ca959829d5e`,
  `6a94f1ed422c1ca959829d6e`, `6a94f634422c1ca959829d70`, import Form แล้วทำ Builder/
  runtime UAT ทั้ง `sent` tooltip, `ready` receive และ idempotent retry

## [2026-09-23] note | เชื่อมปุ่ม "นัดล่วงหน้า" X-ray เข้ากับจอ XR Staff Booking
- ผู้ใช้สั่ง: "XR Staff Booking #6ab207459a834d51703fc158 … อันนี้คือระบบนัดล่วงหน้าของ xray เชื่อมฟอร์มนี้เข้ากับปุ่มนัดล่วงหน้า"
- ตรวจ HIS จริง (Mongo read-only 2026-09-23):
  - `sdform_manage/6ab207459a834d51703fc158` = `XR Staff Booking` · `form_type: form_ui` · `form_table: ""` · `form_enable: true` · tags `[appt, xray]` ⇒ เป็น **จอ** ไม่ใช่ฟอร์มเก็บข้อมูล ⇒ ไม่ต้องส่ง initData
  - `form_model` ถูกเข้ารหัส (`key/iv/data`) ⇒ **อ่านโค้ดของจอจากฐานไม่ได้** ชื่อ params ที่จอรับจริงจึงยังยืนยันไม่ได้
  - Process ของระบบนัด X-ray: `xr-staff-data 6ab2061c9a834d51703fc156` (อ่าน · action `patients|rooms|items|avail|bookings|next_free`) · `xr-staff-book 6ab2066f9a834d51703fc157` · `xr-staff-queue 6ab239f59a834d51703fc177` · `xr-staff-action 6ab23a1a9a834d51703fc178` · ฝั่งผู้ปกครอง `xr-availability/book/cancel/hold/items/mine/rooms/setup`
  - ข้อมูลอยู่ที่ `zdata_xr_booking / xr_slot / xr_item / xr_round_rule / xr_round_close / xr_hold`
- 🔴 **จอกั้นสิทธิ์**: `ALLOWED_ROLES = ['RIS','XRAY','ADMIN']` ใน `xr-staff-data` · ตรวจ `core_roles`/`core_user` แล้ว — มี role `RIS` ในระบบแต่ **0 บัญชีถือ** · **ไม่มี role ชื่อ `XRAY`** เลย · `ADMIN` มี 24 บัญชี ⇒ คนที่ไม่ใช่ ADMIN กดแล้วจะเจอ "ต้องมีสิทธิ์ RIS หรือ XRAY หรือ ADMIN จึงจะใช้จอนี้ได้" (เรื่องสิทธิ์ ไม่ใช่ปุ่มพัง)
- แก้ `build_xray_cpoe_worklist_ui.js` → regenerate `xray-cpoe-worklist-v1.json`
  - `defaultAppointmentFormId = '6ab207459a834d51703fc158'` ใช้ทรง `=== undefined` ⇒ `XRAY_APPOINTMENT_FORM_ID=` (ค่าว่าง) ยังปิดปุ่มได้เหมือนเดิม
  - tooltip เชื่อมแล้วบอกด้วยว่าจอนี้ต้องมีสิทธิ์ RIS/XRAY/ADMIN
  - `openAppointment` ยังส่ง `null` เป็น initData (จอไม่มีฟิลด์) และเพิ่ม `hn`/`citizen_id` จาก `s.createOrderTarget()` ตัวเดิม เฉพาะตอนมีคนไข้ในบริบท — ไม่มี = ไม่ส่งคีย์นั้นเลย
  - diff ระดับ env: เปลี่ยน wired↔unwired ขยับแค่บรรทัดเดียว (`const APPOINTMENT_FORM_ID=`)
- เทส: `test_xray_cpoe_worklist_form.js` (static + runtime params + สแกน HN/เลขบัตร) และ `test_xray_queue_deeplink.js` ผ่าน · ชุดเต็ม 46 ไฟล์ ผ่าน 36 ตก 10 เท่าเดิม
- ⚠️ แก้ assertion เดิม 2 ไฟล์ที่ล็อกว่า "ships unwired" — ผู้ใช้สั่งเปลี่ยนเอง ใส่คอมเมนต์ลงวันที่กำกับ และย้ายการตรวจ "ปิดปุ่มแล้วต้องบอกเหตุผล" ไปทดสอบด้วยการล้างค่าคงที่แทน

## [2026-09-23] note | ฟิลด์ที่ต้องแก้ของ CBC mapping
- ต้องแก้ที่ `his.zdata_master_item_order` ฟิลด์ **`lab_item`** (ทั้ง subdocument) ของ `HM1`, `HM1-R` → snapshot ของ `2001EB` และ `MS1`, `MS1-R`, `NAP-MS-1` → `2101EB` · `H1` ถูกอยู่แล้ว ห้ามแตะ
- ไม่มีที่อื่นให้แก้: `zdata_cpoe_order_item` ไม่เก็บสำเนา `lab_item` (count = 0) · work item/outbound ที่ออกไปแล้วเป็นหลักฐานย้อนหลัง
- 🟢 `section` ระดับบนสุดของ item ห้ามแตะ — LAB NO./routing อ่าน `section_snapshot → lab_context_snapshot.section → master.section` ไม่ใช่ `lab_item.section` ⇒ prefix 20/21 ไม่เปลี่ยน
- หลักฐานเจตนา migration: `zdata_lab_catalog.legacy.item_codes` (`2001EB→HM1,HM1-R` · `2101EB→MS1,MS1-R,NAP-MS-1` · `2201EB→H1`), `name_th` ตรงกับ `item_name`, TMT `300034` ใน `HM1.std_code_data`, และ `Qsnich_tests.pdf` (Group 6013 CBC FL5 / 6019 CBC FL2 / 6023 Hb Typing)
- บันทึกค่าที่ถูกต้องแบบเต็มไว้ใน `01-knowledge-base/syntheses/lab-cbc-his-lab-code-mapping.md` · ยังไม่ได้เขียนฐานข้อมูล (§14d)

## [2026-09-23] implementation | เปิดอ่านผล LAB ข้ามห้องเฉพาะโหมดสืบค้น
- แก้ช่องว่างเดิมที่ cross-room list เห็น Order ได้ แต่ `get_manual_result` ถูกด่าน Organization
  จน Popup fallback เป็นข้อมูล Order และแจ้งว่าอ่านผลไม่สำเร็จทุก Item
- Worklist Process อนุญาต `cross_section=true` เฉพาะ `list` และ `get_manual_result`;
  การอ่านผลราย Item ต้องใช้ `lookup_mode=results`
- Form เติม capability นี้เฉพาะ `get_manual_result` ขณะ `viewMode=lookup`; daily result view
  ยังใช้ scope ห้องเดิม
- `save_manual_result`, `save_result_edits`, `save_result_attachments`,
  `set_result_visibility` และ write action อื่นยังถูกปฏิเสธก่อน DB access เมื่อข้ามห้อง
- เพิ่ม regression tests ฝั่ง API/Form; local only ต้อง replace Process
  `6a9434c3422c1ca959829d5e`, import Form และ runtime UAT ด้วย Organization เจ้าของ/ไม่ใช่เจ้าของ

## [2026-09-23] note | ตรวจหลังผู้ใช้แก้ CBC mapping รอบแรก — ยังไม่ครบ
- ผู้ใช้แก้ใน Compass แล้ว แต่แก้เฉพาะ `lab_item.value` ของ `HM1`, `HM1-R` (→2001EB) และ `MS1`, `MS1-R` (→2101EB)
- 🔴 `lab_item.his_lab_code` ซึ่งเป็นฟิลด์ที่ถูกส่งเป็น `test_code` จริง **ยังเป็น `2201EB` ทั้งหมด** ⇒ พฤติกรรมยังไม่เปลี่ยน และตอนนี้ `value` ≠ `his_lab_code`
- `NAP-MS-1` ยังไม่ได้แก้เลย · `label`/`name`/`section`/`seq`/`tmt_code` ยังเป็นของ Hb Typing · `updated_at` ยัง `2026-08-27`
- ✅ `H1` ไม่โดนแตะ (เคยเตือนไว้เพราะเอกสารที่เปิดในภาพคือ H1)
- ทางแก้: รันสคริปต์ snapshot ทับ `lab_item` ทั้งก้อนตามที่บันทึกไว้ใน `01-knowledge-base/syntheses/lab-cbc-his-lab-code-mapping.md`

## [2026-09-23] note | ขอบเขต CBC mapping — ไม่แก้ NAP-MS-1
- ผู้ใช้ตัดสิน: ไม่แก้ `NAP-MS-1` เพราะ `use_status: false` (ไม่ได้เปิดใช้งาน) ⇒ ขอบเขตเหลือ `HM1`, `HM1-R` → `2001EB` และ `MS1`, `MS1-R` → `2101EB`
- 🔴 ข้อควรระวังที่บันทึกไว้: ถ้าเปิด `NAP-MS-1` กลับมาใช้เมื่อไหร่ ต้องแก้ `lab_item` ของมันก่อน ไม่งั้นส่ง `2201EB` ออกทันที

## [2026-09-23] note | HTML mockup popup ผล LAB แบบ Profile กางได้
- สร้าง `02-his/ui/lab-result-order-profile-popup-mockup.html` สำหรับให้ผู้ใช้ยืนยันก่อนแตะฟอร์มจริง
- Pattern: หัวผู้ป่วยและใบสั่ง, รายการเดี่ยวแสดงตรง, Profile กดกาง/พับผลย่อย, ปุ่มกาง/พับทั้งหมด และคอลัมน์ผู้ออกผลต่อผลย่อย
- ใช้ข้อมูลจำลองทั้งหมด; production Worklist Form/API ยังไม่เปลี่ยน
- ตรวจพบว่า Agent persist `reported_by_source_name`/`verified_by_source_name` แล้ว แต่ `get_manual_result` ยังไม่ expose จึงต้องเพิ่ม response mapping แบบ additive หลังผู้ใช้อนุมัติ
- ตรวจ inline JavaScript และ token โครงสร้างผ่าน; local browser ปฏิเสธ `file://` ตามนโยบาย จึงยังไม่มี runtime screenshot

## [2026-09-23] note | ปรับ mockup ให้ผู้ออกผลเป็น byline ด้านบน
- ผู้ใช้ตัด Patient/Order head และไม่ต้องการคอลัมน์ผู้ออกผลรายแถว
- ปรับ mockup เป็นข้อความใต้ชื่อ Popup: `ผู้ออกผล: ชื่อ · ออกผลเมื่อ: วันเวลา` เพื่อเห็นทันทีโดยไม่ต้องเลื่อนท้ายตาราง; Profile interaction เดิมคงอยู่
- Agent contract ส่ง `reported_by.source_id`, `reported_by.source_name`, `reported_at`; ผล final ส่ง `verified_by.source_id`, `verified_by.source_name`, `verified_at` เพิ่ม แต่ mockup รอบนี้ยังไม่แสดงผู้รับรองตามขอบเขตผู้ใช้
- Production Form/API ยังไม่เปลี่ยนและยังรอผู้ใช้ยืนยัน mockup

## [2026-09-23] query | นัดล่วงหน้า X-ray: สั่งวันนี้ นัดพรุ่งนี้ — ยังไม่มีการรองรับ
- คำถาม: ใบที่สั่งวันนี้แต่วันนัดพรุ่งนี้ จะโผล่หน้า order/คิววันนี้ไหม · flow ที่ต้องการ: เปิด VN → คลินิกสั่งนัด → วันนัดคนไข้เปิด VN ใหม่ → ใช้คิวที่จองไว้ → ขึ้นคิวให้รับเข้าห้อง
- **สรุป: ไม่มีการรองรับเลย และสองระบบยังไม่ต่อกัน** (ตรวจจากโค้ดที่ deploy อยู่ 2026-09-23)
- ระบบจอง ↮ ใบสั่ง CPOE: `xr-staff-book` / `xr-staff-action` / `xr-staff-queue` แตะเฉพาะ `zdata_xr_booking/xr_slot/xr_item/xr_round_rule/xr_round_close/xr_hold` (+ `zdata_master_item_order` ไว้ดูราคา, `core_files_manage`, `core_user`) — **ไม่มีคำว่า `cpoe_order` / `cpoe_order_item` / `visit_id` / `order_id` / `service_type` เลยสักครั้งในทั้งสามตัว** · `xr-staff-book` รับ `pid,hn,room,slot_date,time_slot,items,note,phone,prepare_note,source_ref,files,has_request` (ไม่มี VN/ใบสั่ง)
  ⇒ จองแล้วได้แค่แถวใน `zdata_xr_booking` ผูก `pid`/`hn` · ไม่มีตัวไหนแปลงใบจองเป็นใบสั่งในวันนัด
- ถ้าคลินิกสั่ง CPOE วันนี้โดยไม่ผ่านระบบจอง (`xray_cpoe_worklist_api.js`):
  - **วันนี้** แท็บ X-ray ขึ้นทันที (`current_status: sent` → bucket `waiting`, date scope เริ่มต้น = วันนี้) และ Unit Queue ก็ขึ้นทันที เพราะ `queueVisitDayStages` กรองด้วย `visit_day === today` ของ **VN** ซึ่งเพิ่งเปิดวันนี้ ⇒ คนไข้ที่ยังไม่ต้องมาไปปนคิวจริง
  - **วันนัด** Unit Queue **หาย** เพราะ VN เดิมเป็นของเมื่อวาน · คนไข้เปิด VN ใหม่ก็ไม่ขึ้น เพราะใบสั่งผูก VN เก่า · แท็บ X-ray ยังขึ้นเพราะกติกา backlog (waiting/pending โชว์ทุกวัน) แต่ผูก VN เก่า
  ⇒ กลับหัวกับ flow ที่ต้องการ: วันที่ไม่ควรเห็นกลับเห็น วันที่ควรเห็นในคิวกลับไม่เห็น
- `STATUS_VOCABULARY` ไม่มี `planned`/`booked` ⇒ ไม่มีที่พักใบสั่งที่ยังไม่ถึงวันนัด · grep ทั้งรีโปไม่เจอ `booking_no` ฝั่ง X-ray
- ทางเลือกที่เสนอ (ยังไม่ลงมือ รอผู้ใช้เคาะ):
  - **A** ระบบจองเป็นเจ้าของ แล้วสร้างใบสั่ง CPOE ตอนคนไข้เปิด VN ในวันนัด — ตรงกับมติ 2026-09-08 ("ห้องรังสีรอรับอย่างเดียว") ไม่ต้องแตะ contract ใบสั่ง
  - **B** คลินิกสั่ง CPOE พร้อมวันนัด แล้วเพิ่มสถานะ `planned` + ฟิลด์วันนัด + ตัวเลื่อน `planned → sent` ในวันนัด · ส่วนยากคือใบสั่งผูก VN เดิม ต้องย้ายไป VN ใหม่
- อ่านอย่างเดียว ไม่ได้แก้ไฟล์ใดในรีโป

## [2026-09-23] decision | X-ray นัดล่วงหน้า: เลือกทาง A · promote ตอนเปิด VN (ยังไม่ลงมือ)
- ผู้ใช้เคาะ **ทาง A** และถามว่า "ให้ระบบนั้นจัดการเองเรื่องการส่งไป CPOE มั้ย" · สั่งชัดว่า **ยังไม่ต้องแก้ ให้ standby**
- 🟢 พบว่า HIS **มี pattern นี้อยู่แล้วและรันจริง**: Process `appt-items-promote` `6a96956c422c1ca959829f1b` (api_input: `visit_id` ตัวเดียว)
  - trigger: Control Center rule ของฟอร์ม **Visit v1** `6a40fdec4b6dfdf45acbfbce` event `save` mode `bg` (engine ส่ง `_xevent_.dataId` = visit._id) · เรียกตรงด้วย `visit_id` ก็ได้
  - จับคู่ใบนัดด้วย **`pid.value` + `slot_date` + `clinic.value` + `active_flag:1`** (ตรงกับ index `ux_booking_active`) — ไม่เก็บ VN ล่วงหน้า
  - อ่านรายการจาก `zdata_appt_items` ที่ `xparentx = booking._id` และ `status:'planned'` · ปั๊มกลับเป็น `promoted` + `cpoe_order_id/no` = กันทำซ้ำ
  - แตกใบ **แยกตาม `service_type`** และ **รองรับ `xray` อยู่แล้ว** (lab/xray ห้ามปนใบเดียวกัน — ยืนยันจากใบจริง 86 ใบ)
  - 🔴 กติกาสำคัญที่เขาเขียนไว้เอง: **ห้ามเขียน `zdata_cpoe_order` เอง** ต้องเรียก `cpoe-order-save` `6a71edd247075049ef0245af` ไม่งั้นใบไม่มีเลขที่ (เลขออกใน `form_event` → `cpoe-order-no`) · อ่านเลขซ้ำด้วย `cpoe-order-get` / สำรองด้วย `cpoe-order-list`
  - ออกมาเป็น **ใบร่าง** ให้หมอตรวจแล้วกดส่งเอง · ปั๊ม `checked_in` + backfill `vn`/`visit_id` กลับใบนัด · มาสายยังได้ใบ (เกณฑ์เวลาใช้ตัดสินแค่ "มาตามนัดไหม")
- ⇒ คำตอบเชิงออกแบบ: **ไม่ให้ตัวจอง (`xr-staff-book`) เขียน CPOE เอง** — ตอนจองยังไม่มี VN จึงสร้างใบไม่ได้อยู่ดี · ให้ "ตัว promote" ที่ trigger ตอนเปิด VN เป็นคนส่ง และต้องส่งผ่าน `cpoe-order-save` เท่านั้น
- ทางเลือกย่อยที่ยังต้องเคาะ:
  - **A1** ทำ `xr-items-promote` ตัวใหม่ ลอก `appt-items-promote` ทุกกระเบียด แต่อ่าน `zdata_xr_booking`
  - **A2** ให้ `xr-staff-book` เขียน `zdata_appt_booking` + `zdata_appt_items` ด้วย ⇒ `appt-items-promote` ที่มีอยู่ promote ให้เองโดยไม่ต้องเขียน Process ใหม่เลย
- 🔴 ข้อติดที่ต้องถามก่อนเลือก: `appt-items-promote` จับคู่ด้วย **clinic** และถ้าเปิด VN คนละคลินิกจะไม่ promote (`clinic_mismatch`) — ต้องรู้ว่าคนไข้ X-ray เปิด VN ที่ห้องรังสีเอง หรือเปิดที่คลินิกแล้วส่งต่อ
- สถานะ: **ยังไม่แตะโค้ดใด ๆ** ตามที่ผู้ใช้สั่ง · standby รอไฟเขียว

## [2026-09-23] query | ผลออกแล้ว CPOE อัปเดตหรือยัง
- ถาม: ตอนผลออก ระบบอัปเดต `current_status` ฝั่ง CPOE ให้หรือยัง
- ตอบ: **อัปเดตเฉพาะผลที่เข้ามาทาง HL7 `lis.receive`** — `hl7_result_upsert_api.js:663-667,675` แปลง `overall_status resulted|corrected` → `syncCpoeItemStatus(item,'completed')` แล้วปิด order ที่ `:575-620`
- 🔴 ผลที่บันทึกมือในหน้า worklist (`lab_cpoe_worklist_api.js:2709`) เซ็ตแค่ `work_status: 'resulted'` ของ Work Item **ไม่แตะ CPOE เลย** ⇒ โมดูลอื่นที่อ่าน `current_status` ยังเห็น `accepted`
- หลักฐานสด: work item `completed` 11 ใบ → CPOE `completed` ครบ 11/11 · work item `resulted` 3 ใบ → CPOE ยัง `accepted` ทั้งหมด (`206909230002` HM/HM1 วันนี้, `406909180002` MB/M1+M9)
- ยังไม่ได้แก้อะไร — ถ้าจะให้ manual sync ด้วยต้องเป็นการเปลี่ยนพฤติกรรมเดิม ต้องขออนุมัติก่อน (§14d)

## [2026-09-23] note | ทำไฟล์ full-replace ของ treat_summary ให้วางทับทั้งช่อง
- `Form-Builder/API/form-factory/events/treat-summary-onCreated-FULL-v1.js` (568 บรรทัด) — onCreated ทั้งช่อง: ของเดิมครบทุกตัวอักษร + `s.tsAbsorb(d);` (ย่อหน้าด้วย tab) + บล็อกใหม่ที่เขียนหัวคอมเมนต์ใหม่ให้ตรงกับบริบท "ไฟล์รวม" แทนคำสั่งติดตั้งทีละขั้น
- `02-his/form-factory/treat-summary-template-FULL-v1.html` (395 บรรทัด) — Template ทั้งช่อง: แท็บ ยา/หัตถการ, หัวการ์ด+CC/HPI/PE/Dx และท้ายไฟล์หลัง `</el-tabs>` เทียบแล้วเหมือนเดิมทุกตัวอักษร เปลี่ยนเฉพาะ 2 แท็บ Lab/X-Ray
- ไฟล์ "เฉพาะส่วน" เดิม (`treat-summary-lab-xray-oncreated-v1.js`, `treat-summary-lab-xray-template-v1.html`) ยังอยู่ ไม่ถูกลบ
- ตรวจ: syntax ผ่าน · `s.tsAbsorb(d)` 1 ครั้ง · const ตัวละ 1 ครั้ง · การซ้อนแท็กทั้งไฟล์ผ่าน · key ที่ Template อ้าง 36 ตัวมีครบใน onCreated · รัน e2e ผ่านทุกเคส
- บทเรียน: heredoc แบบไม่ quote ทำให้ backtick ในคอมเมนต์โดน shell กินจนคอมเมนต์เพี้ยน — สร้างไฟล์ใหม่ด้วย `<<'PY'` แล้วอ่าน path จาก env แทน

## [2026-09-23] note | ไฟล์ full-replace ของ Process emr-summary-get
- การ์ดในจอยังแสดงลิสต์แบบเดิม เพราะ Process ยังไม่ถูกวาง — ยืนยันจาก Mongo: `api_process` 12,031 ตัวอักษร `updated_at 2026-08-31 19:34` marker ใหม่ = 0
- ดึง body สดจาก live ด้วย MCP `export` (ไม่ผ่านการพิมพ์ซ้ำ) → `Form-Builder/API/api-factory/processes/emr-summary-get-FULL-v1.js` (715 บรรทัด · 31,168 ตัวอักษร จากเดิม 12,031)
- ประกอบ 3 จุดอัตโนมัติพร้อม assert: แทรกบล็อกเหนือหัวข้อ "1) หา visit ก่อนหน้า" (มีแบนเนอร์ ⬇️/⬆️ คั่นให้เห็นขอบเขตของใหม่) · เติม 4 คีย์ใน early return · เติม 4 คีย์ใน return ก้อนสุดท้าย
- ตรวจ: syntax ผ่าน · `current_vn: currentVn` และ `lab_orders: labOrders` อย่างละ 2 ครั้งในโค้ดจริง (ครบทั้งสอง return) · รันทั้งเส้นทาง "ไม่มีวิสิทก่อนหน้า" และ "มีวิสิทก่อนหน้า" คีย์เดิม 17 ตัวและคีย์ใหม่ 4 ตัวครบทั้งคู่ · ผลจัดกลุ่มถูกต้อง 4 ก้อน

## [2026-09-23] fix | กันบล็อกใหม่ใน emr-summary-get ลากตรรกะเดิมพัง
- ตรวจชนกันของชื่อ: ตัวแปร/ฟังก์ชันระดับบนสุด เดิม 45 ตัว ใหม่ 29 ตัว — **ไม่ชนกันสักตัว** ไม่มี shadow และของใหม่ไม่เขียนค่าใส่ตัวแปรของเดิมเลย (ของใหม่อ่านของเดิมอย่างเดียว: `findAll`, `idPair`, `codeOf`, `labelOf`, `hn`, `curVisitId`, ชื่อ table)
- **ความเสี่ยงที่เจอและแก้:** บล็อกใหม่รัน *ก่อน* ตรรกะเดิม ถ้ามันโยน error ทั้ง process ตาย แล้ว cc/hpi/PE/dx/ยา ที่เคยทำงานได้จะหายด้วย จุดที่โยนได้คือ `app.dbObjectId()` กับค่าที่ไม่ใช่ 24-hex (ของเดิมไม่เคยส่ง `visit_id` หรือ `order_no` เข้าไป) และ `nextDayOf()` เมื่อ `visit_date` เพี้ยน
- แก้ 3 ชั้น: `idOne`/`idsIn` กรอง `HEX24` ก่อนเรียก `dbObjectId` (ของเดิมยังใช้ `idPair` เดิมไม่ถูกแตะ) · `nextDayOf` คืนค่าว่างเมื่อรูปวันที่ผิดและ query ช่วงวันเฉพาะตอนมีปลายทางจริง · ครอบทั้งบล็อกด้วย `try/catch` ล้างเป็น array ว่างแล้ว `app.log.warn`
- ทดสอบเคสโจมตี 3 แบบ (visit_id ไม่ใช่ ObjectId · `order_no` เป็นค่าขยะ · DB โยน error กลางบล็อก) → `success=true` ทุกเคส ของเดิมยังคืน `has_history/lab/xray` ครบ ของใหม่คืน array ว่าง การ์ดตกไปใช้ลิสต์เดิม
- หมายเหตุ: `zdata_cpoe_order_item` ถูก query ทั้งของใหม่และของเดิม (ส่วน 2.5) ถ้า collection นั้นล่ม process ตายอยู่แล้วตั้งแต่ก่อนมีบล็อกนี้ — ไม่ใช่ของใหม่ทำ
- ไฟล์รวมอัปเดตเป็น 744 บรรทัด · diff กับ live: insert 50–473, replace บรรทัด 487, insert 738–743

## [2026-09-23] schema | แยก Process: emr-lab-board-get ออกจาก emr-summary-get
- ผู้ใช้เคาะให้แยก process แทนการแทรก 424 บรรทัดเข้า `emr-summary-get` — เหตุผล: ของใหม่พังแยกกัน แก้แยกกัน และการวางทับตัวที่ใช้งานอยู่เสี่ยงกว่ามาก
- `Form-Builder/API/api-factory/processes/emr-lab-board-get.js` (424 บรรทัด · process ใหม่) — `params {visit_id, hn?, person_id?}` → `{success, current_vn, lab_orders[], xray_results[], lab_trends[]}` · พก `findAll/codeOf/labelOf` ของตัวเองเพราะคนละ scope
- `Form-Builder/API/api-factory/processes/emr-summary-get-CALLS-BOARD-v1.js` (326 บรรทัด จากเดิม 314) — **แก้ต้นฉบับแค่ 12 บรรทัด 4 จุด**: `const BOARD_PROC` (บรรทัด 19) · บล็อกเรียก+try/catch (51–60) · `...board` ใน early return (74) · `...board,` ใน return สุดท้าย (325)
- ใช้ spread `...board` ทำให้แต่ละ return เพิ่มแค่บรรทัดเดียว (โค้ดเดิมใช้ spread อยู่แล้วใน `pushItem`)
- ทดสอบ: เดินสองตัวต่อกันผ่านครบเหมือนเวอร์ชันรวม · เคส board โยน error / ตอบ `success:false` / ตอบไม่ครบคีย์ → `emr-summary-get` คืน `success:true` พร้อม `has_history/cc/dx/...` ครบทุกครั้ง board คืน array ว่าง
- ไฟล์เวอร์ชันรวม (`emr-summary-get-FULL-v1.js`) ยังเก็บไว้ ไม่ลบ เผื่อเทียบ
- ขั้นถัดไป: สร้าง Process ใหม่ใน API Factory → เอา ID ที่ได้ไปใส่แทน `<<ใส่ ID ของ emr-lab-board-get ที่นี่>>`

## [2026-09-23] note | Deploy emr-lab-board-get สำเร็จ + ใส่ ID ลงตัวเรียก
- ผู้ใช้สร้าง Process ใหม่แล้ว: `emr-lab-board-get` ID **`6ab3be31cec3020e8562a2c9`** (`updated_at 2026-09-23 18:55:57` · share public · active)
- ตรวจกับ Mongo: `api_process` บน live ยาว **19,360 ตัวอักษร ตรงกับไฟล์ในรีโปเป๊ะ** และ marker ครบ (`WORK_ITEM_TABLE` 3 · `HEX24` 3 · `NARRATIVE_MIN` 2 · return `lab_orders: labOrders` 1) ⇒ วางครบไม่ขาด
- ใส่ ID จริงลง `emr-summary-get-CALLS-BOARD-v1.js` แทน placeholder แล้ว · รันเทสซ้ำผ่านทั้งชุดปกติและชุดเคสพัง 3 แบบ
- ค้าง: `api_input` ของ process ใหม่เป็น `null` — เป็น metadata ไม่บล็อกการเรียก (เคสเดียวกับ CPOE price audit 09-22) แต่ควรเติม `visit_id, hn, person_id` เพื่อความชัดเจน
- เหลือขั้นเดียว: แก้ `emr-summary-get` 12 บรรทัด 4 จุด แล้วการ์ดจะเปลี่ยนเป็นแบบจัดกลุ่ม

## [2026-09-23] fix | emr-summary-get บน live วางไม่ครบ — ขาด ...board ทั้งสอง return
- ตรวจ live `6a9574cc1812c7078a067299` (`updated_at 19:02:01` · 12,804 ตัวอักษร): `BOARD_PROC` ×2, `let board = {` ×1, `runProcess(BOARD_PROC` ×1, `boardErr` ×4 → **จุด ① และ ② วางแล้ว** แต่ `...board` = **0** → จุด ③ ④ ยังไม่ได้วาง ⇒ ดึงข้อมูล board มาแล้วแต่ไม่ได้คืนออกไป การ์ดจึงยังเห็นแต่ fallback
- สร้าง `Form-Builder/API/api-factory/processes/emr-summary-get-READY-v2.js` จาก **body สดบน live** (ไม่ใช่ของเก่า) แล้วเติม 2 จุดที่ขาด + ติดคอมเมนต์ 🌸 ให้ทุกส่วนที่เราเพิ่ม (5 จุด: ① บรรทัด 19 · ② บรรทัด 52–62 · ③ บรรทัด 77 · ④ บรรทัด 329)
- ตรวจ: syntax ผ่าน · `...board` ในโค้ดจริง 2 ครั้ง (ไม่นับคอมเมนต์) · รันชุดปกติและชุด board ล้ม 3 แบบผ่านทั้งหมด
- พบว่า `emr-history-get` เป็น process คนละตัว (`6a9662a75723cd050ea497e0` · 22,575 ตัวอักษร · แก้ล่าสุด 2026-09-01) ยังไม่ถูกแตะ — ถ้าต้องการก้อนผลในจอ EMR History ต้องทำแยกอีกงาน

## [2026-09-23] fix | รองรับสถานะ CPOE `ready` ที่มีจริงในระบบ
- VN6900309 (visit `6ab34b01c9cac32ff606d746` · 23/09) มี CPOE lab 3 รายการ: CBC `accepted` 10:57 · Fibrinogen **`ready`** 12:31 · CBC `accepted` 13:27
- นับทั้งระบบ: lab item สถานะ `accepted` 147 · `sent` 75 · `draft` 36 · **`ready` 13** · `completed` 11 · `rejected` 9 · `cancelled` 5 ⇒ `ready` เป็นสถานะจริง ไม่ใช่ข้อมูลเพี้ยน
- Work Item ของ VN นี้ 2 ตัว: `206909230001` work_status `received` (รับ 10:59) · `206909230002` `resulted` (รับ 15:14) — `received` ก็ไม่อยู่ใน STAGE_RANK แต่ตัว guard `received_at` ยกเป็น `accepted` ให้อยู่แล้ว
- ผล 17 แถวอยู่ใต้ `order_no 6ab37141cec3020e8562a238` (R2609230003) section HM `created_at 2026-09-23 16:07`
- แก้: board process เพิ่ม `ready:1.5, prepared:1.6` ใน `STAGE_RANK` · widget เพิ่ม `ready` ใน `TS_LAB_STATUS` เป็นสีส้มโดย**คงคำดิบ** (ยังไม่ยืนยันความหมายทางงาน จึงไม่แปลเป็นไทย) และเพิ่มใน `TS_PENDING` ให้ขึ้น stepper
- ยังไม่ได้ deploy: live `emr-summary-get` ยังเป็น 12,804 ตัวอักษร `...board` = 0 · 🌸 = 0 ⇒ **ยังไม่ได้วาง READY-v2** นั่นคือเหตุที่การ์ดยังเป็นลิสต์เดิม
- ค้างถาม: `ready` ในบริบท LAB แปลว่าอะไร (ใบที่เป็น `ready` ในวิสิทนี้ยังไม่มี Work Item)

## [2026-09-23] incident | โค้ด emr-summary-get ถูกวางทับ emr-history-get
- เวลา 19:20:04 Process `emr-history-get` `6a9662a75723cd050ea497e0` ถูกบันทึกทับด้วยโค้ดของ `emr-summary-get` (READY-v2): ขนาดเปลี่ยน **22,575 → 13,099 ตัวอักษร** · พบ marker `emr-summary-get` และ 🌸 ×5 ในตัวมัน
- ผลกระทบ: จอ EMR History (form `6a96557e422c1ca959829eae` · เปิดจากปุ่ม "ดูทั้งใบ") ส่ง `visit_id, history_id` เข้าไป แต่โค้ดที่ทับอยู่ต้องการ `person_id`/`hn` ⇒ ตีกลับ `success:false` ⇒ **จอ EMR History ใช้งานไม่ได้**
- `emr-summary-get` `6a9574cc1812c7078a067299` ยังเป็นของเดิม 12,804 ตัวอักษร (`...board` = 0) ⇒ เป้าหมายจริงยังไม่ถูกแก้
- หา backup แล้วไม่เจอ: ไม่มีในรีโป · ไม่มีในโฟลเดอร์ export ของ MCP (ถูกลบอัตโนมัติ) · `his-tmp` ไม่มี `module_api` · `zdata_log_manage` ไม่ใช่ change log
- ทางกู้ที่เหลือ: (1) สำเนาที่ผู้ใช้เก็บไว้เอง (2) ฟีเจอร์เวอร์ชัน/ดาวน์โหลดใน API Factory (3) เขียนใหม่จากสัญญาที่จอต้องการ — `EMR_history.json` ในรีโปอ้าง ID นี้และเปิดเผยคีย์ที่จออ่าน: `visit, meta, nav, subjective, vitals, primary, dx_type, orders, item_groups, others, consults, plan, money, text, success, message`
- บทเรียน: ผู้ใช้พิมพ์ชื่อ `emr-history-get` มาตั้งแต่ตอนขอไฟล์ แต่ผมตีความว่าพิมพ์พลาดแล้วส่งไฟล์ของ `emr-summary-get` ให้ — ครั้งหน้าถ้าชื่อที่ผู้ใช้ระบุไม่ตรงกับงานที่กำลังทำ ต้องหยุดถามก่อนส่งไฟล์

## [2026-09-24] recovery | กู้ emr-history-get จากโค้ดที่ผู้ใช้ส่งกลับมา
- ผู้ใช้ส่ง body ของ `emr-history-get` กลับมา — เป็นต้นฉบับครบ แต่มีชิ้นส่วนของ `emr-summary-get` หลุดไปแทรก 2 จุดจนพัง syntax:
  ① บล็อกเรียก `BOARD_PROC` + `try/catch` ถูกวางไว้ **กลางอาร์กิวเมนต์ของ `app.dbFindAll(...)`** ใน `findAll`
  ② บล็อก `if (!prev) { return {... ...board}; }` ถูกวางต่อท้าย `findAll` ทั้งที่ไฟล์นี้ไม่มีตัวแปร `prev`/`board`/`hn`
  (และมี `const BOARD_PROC` เกินมาบนหัวไฟล์)
- สร้าง `Form-Builder/API/api-factory/processes/emr-history-get-RESTORE-v1.js` — ถอด 3 ชิ้นนั้นออก คืน `findAll` เป็นรูปเดิม
- ตรวจ: syntax ผ่าน · ไม่มี `BOARD_PROC`/`...board`/`if (!prev)`/`has_history`/🌸 หลงเหลือ · โครงหลักครบ (`VITAL_RANGE`, `itemGroups`, `nav`, `item_groups`, `history_form_id`)
- แก้ transcription ของตัวเอง 1 จุดก่อนส่ง: `block_count: numOrNull(snap.block_count) || blocks.length` (เกือบพิมพ์เป็น `|| 0`)
- ยังไม่ได้ deploy — รอผู้ใช้วางทับ `6a9662a75723cd050ea497e0`
- หมายเหตุ: ผู้ใช้ตั้งใจจะให้ `emr-history-get` เรียก board ด้วยจริง ๆ (ไม่ใช่พิมพ์ชื่อผิด) แต่ฟอร์ม EMR History ยังไม่ได้อ่านคีย์ `lab_orders` ⇒ ต้องกู้จอให้ใช้ได้ก่อน แล้วค่อยคุยกันว่าจะเพิ่มก้อนผลในจอนั้นยังไง

## [2026-09-24] recovery-confirmed | emr-history-get กลับมาเท่าต้นฉบับแล้ว
- ตรวจ live `6a9662a75723cd050ea497e0` เวลา `updated_at 2026-09-24 10:30:48`: **22,575 ตัวอักษร = ขนาดต้นฉบับเดิมเป๊ะ** และเท่ากับไฟล์ `emr-history-get-RESTORE-v1.js` ในรีโปพอดี (ต่างกัน 0 ตัวอักษร)
- marker สะอาด: `BOARD_PROC` 0 · `...board` 0 · `if (!prev)` 0 · 🌸 0 · โครงหลักครบ (`VITAL_RANGE` ×4 · `item_groups: itemGroups` ×1 · `nav.prev` ×1 · `block_count … || blocks.length` ×1)
- สถานะอีกสองตัว ณ เวลานี้: `emr-lab-board-get` 19,635 ตัวอักษร (มี `ready: 1.5`) deploy แล้ว · `emr-summary-get` ยัง 12,804 ตัวอักษร `...board` = 0 ⇒ ยังค้าง 2 บรรทัด

## [2026-09-24] fix | fallback ของการ์ดต้องดู "คีย์" ไม่ใช่ "จำนวนข้อมูล"
- Process ครบทั้ง 3 ตัวแล้ว: `emr-summary-get` 13,099 ตัวอักษร `...board` ×3 (updated 10:35:22) · `emr-lab-board-get` 19,635 · `emr-history-get` 22,575 (กู้แล้ว)
- แต่การ์ดยังเป็นลิสต์เดิม เพราะ **VN6900315 (24/09) ยังไม่ได้สั่งตรวจเลย** — ตรวจ DB: CPOE item ของวิสิทนี้ = 0 รายการ และผลที่เข้าระบบวันที่ 24/09 ทั้งระบบ = 0 แถว ⇒ board คืน `lab_orders: []` ถูกต้องแล้ว
- ข้อผิดพลาดการออกแบบของผม: `tsLgOn = groups.length > 0` ⇒ "ไม่มีใบ" กับ "process ยังไม่รองรับ" ให้ผลเหมือนกัน และการ์ดตกไปแสดงลิสต์เก่าซึ่งเป็น **ผลของวิสิทอื่น** (ในภาพคือผล 23/09 ของ VN6900309 โผล่ในวิสิท 24/09) — หมออ่านแล้วนึกว่าเป็นผลวันนี้ได้
- แก้เป็น `tsLgOn = Array.isArray(src.lab_orders)` และ `tsXgOn = Array.isArray(src.xray_results)` ⇒ process ใหม่ส่งคีย์มา = ใช้หน้าตาใหม่เสมอ ไม่มีใบก็ขึ้น "— ยังไม่มีใบสั่งตรวจในวิสิทนี้ —" ตรงกับการ์ด "ใบสั่งตรวจ" ข้าง ๆ · process เก่าไม่ส่งคีย์ = ตกไปลิสต์เดิมเหมือนเดิม
- ทดสอบทั้งสองเคสผ่าน · rebuild `treat-summary-onCreated-FULL-v1.js` (575 บรรทัด)
- ข้อจำกัดที่รู้ตัว: ถ้า `emr-summary-get` เรียก board ไม่สำเร็จ มันคืน array ว่างตาม default เหมือนกัน ⇒ การ์ดจะขึ้น "ยังไม่มีใบสั่งตรวจ" แทนที่จะบอกว่าอ่านไม่ได้ (การ์ด "ใบสั่งตรวจ" ข้าง ๆ ยังเป็นตัวจริงอยู่ จึงไม่ทำให้เข้าใจผิดเรื่องมีใบ/ไม่มีใบ)

## [2026-09-24] fix | ใบที่ห้องแลปยังไม่รับ: ชื่อหัวก้อนผิดเป็นชื่อห้องยา + เพิ่มปุ่มโหลดใหม่
- การ์ดขึ้นหน้าตาใหม่แล้ว (`tsLgOn` ทำงาน) — ที่ยังขึ้น "ยังไม่มีใบสั่งตรวจในวิสิทนี้" เพราะใบ R2609240001 ถูกสั่งเวลา 10:50 **หลังจาก**การ์ดโหลดไปแล้ว ไม่ใช่เพราะต้องรอห้องแลปกดรับ
- ยืนยันจาก DB: item `6ab49e1a469a0989e63a5890` Reticulocyte count · `service_type.value = lab` · `current_status = sent` · join `order_id.xtbxlv2_xfx_id` ตรงกับ visit `6ab49aad469a0989e63a5828` ⇒ board จะคืนใบนี้แน่นอนเมื่อโหลดใหม่
- **บั๊กที่เจอจากข้อมูลจริงนี้:** ใบที่ยังไม่มี Work Item จะไม่มี `section_name` แล้วโค้ดเดิม fallback ไปใช้ `order_to_location` ซึ่งของจริงคือ **"m01.p ห้องยาพรีเมี่ยม"** (ห้องยา ไม่ใช่ห้องแลป) ⇒ หัวก้อนจะขึ้นชื่อห้องยาในใบ LAB
- แก้: ตัด fallback `order_to_location` ทิ้ง · ใบที่ยังไม่รู้ section ใช้ **ชื่อรายการที่สั่ง** เป็นหัวก้อนถ้ามีรายการเดียว (เช่น "Reticulocyte count") ไม่งั้นใช้คำกลาง "ใบสั่งตรวจ" · เก็บ `g.names` จาก CPOE Item
- เพิ่มปุ่ม **"โหลดใหม่"** ท้ายมุมมอง "ตามใบสั่ง" (การ์ดนี้โหลดตอนเปลี่ยนคนไข้เท่านั้น ไม่รู้เองเมื่อมีการสั่งตรวจเพิ่ม — การ์ดใบสั่งยา/ใบสั่งตรวจก็มีปุ่มนี้ด้วยเหตุผลเดียวกัน)
- ตรวจ: board รันแล้วใบ `sent` ที่ยังไม่มี Work Item ขึ้นหัวก้อนเป็น "Reticulocyte count" · Template FULL 401 บรรทัด การซ้อนแท็กผ่าน แท็บยา/หัตถการ/หัวการ์ดเหมือนเดิม key 37 ตัวครบ

## [2026-09-24] fix | หน้าสรุป Contrast History ขึ้น "-" ทุกบรรทัด เพราะอ่าน form model ผิดชื่อ
- ผู้ใช้ส่งภาพฟอร์ม `6aa2424809c1bad08952da71`: การ์ด **Contrast History (หน้าสรุป)** แสดงหัวข้อครบ 6 บรรทัดแต่ค่าเป็น `-` ทั้งหมด ทั้งที่ข้อ 8 เติมเลข ว.10001 ให้แล้ว และ `used_at` ตั้ง `initCurrent: true` (ต้องมีวันเวลาตั้งแต่เปิดฟอร์ม) ⇒ วิดเจ็ตไม่เคยอ่านค่าจากฟอร์มได้เลย ไม่ใช่เพราะยังกรอกไม่ครบ
- สาเหตุ: `s.data()` ใน `cmr_summary` อ่าน `getFormRef().formData` **ทางเดียว** · ฟอร์มจริงในรีโปเก็บค่าไว้ที่ `formDataModel` (visit.json · person_form.json · CPOE_app.json) หรือ `$props.formData` (APPT_Doctor_Book_UI.json) และคู่มือ `fields-reference.md` ใช้ `getFormData(false)` ⇒ `f.formData` เป็น undefined ⇒ คืน `{}` ทุกครั้ง ⇒ ทุกบรรทัดตกไปที่ `'-'` ของ template
- แก้แบบเพิ่มเข้าไป ไม่ถอดของเดิม: `s.models()` ไล่ `formDataModel` → `$props.formData` → `formData` (เส้นทางเดิม) → `getFormData(false)` → `field.formModel` แล้วเลือกตัวแรกที่มีคีย์จริง · `onCreated/onMounted/onUnmount` timer เหมือนเดิม
- เทสใหม่ใน `test_xray_contrast_media_form.js` รันสคริปต์ `onCreated` จริงกับ form ref ทั้ง 4 ทรง แล้วบังคับให้สรุปออกมาครบเท่ากันทุกทรง + ฟอร์มว่างต้องสรุปว่าง (assertion เดิมทั้งหมดคงไว้)
- ตรวจ: X-ray suite 14/16 ผ่าน · ที่แดง 2 ตัว (`test_xray_order_ris_params.js`, `test_xray_ris_team_apis.js`) เป็นของเดิมเรื่อง `AdmissionNo`/`PatientSsn` ไม่เกี่ยวกับฟอร์มนี้ (ไม่มีคำว่า contrast ในไฟล์) · validator `check_sdform_json.py` ผ่าน 52 widget
- ยังเป็นงาน local: ต้อง import `Form-Builder/SDForm/X-ray/xray-contrast-media-record-v1.json` ทับฟอร์มเดิมถึงจะเห็นผล · ส่วน "ประวัติย้อนหลัง" ยังไม่ได้เชื่อม API ตามที่ตั้งใจไว้แต่แรก สรุปได้เฉพาะใบที่กำลังกรอก

## [2026-09-24] fix | หน้าสรุปสารทึบ: เลิกเรียก getFormData() ทุก 1.2 วินาที
- ผู้ใช้ยืนยันว่าหน้าสรุปทำงานแล้วหลัง import (ฟอร์ม `6aa2424809c1bad08952da71` updated 13:18:48) แต่ "กด submit/save แล้วเงียบ ไม่มีอะไรเกิดขึ้น"
- ตรวจ DB (read-only): `his.zdata_xray_contrast_media` มีใบ `6ab4c0fb469a0989e63a58af` created 13:19:39 · updated 13:20:02 · ข้อมูลครบ (`hn 6900049` · `item_id 6aacf429…` · `accession_no SM20260918DX004` · `contrast_types [barium_sulphate]` · `route_types [enema]` · `order_doctor mock-01`) ⇒ **การบันทึกทำงานได้จริงแล้ว 2 ครั้ง** (create แล้วตามด้วย update)
- สิทธิ์ฟอร์มปกติ: `insert_policy true` / `update_policy false` — ชุดเดียวกับอีก 158 ฟอร์มรวม PERSON และ Visit · `xrstatx` ทั้งระบบมีแค่ 1/3 ไม่มี 2 (`zdata_xray_result` ก็เหมือนกัน) ⇒ ไม่มีสถานะ "submitted" แยกในดีพลอยนี้
- ข้อผิดพลาดของผมเองรอบก่อน: `s.data()` เรียก `f.getFormData(false)` **ทุกครั้ง** ที่ทำงาน และ timer ยิงทุก 1.2 วินาทีตลอดเวลาที่ฟอร์มเปิด = เรียกฟังก์ชันของฟอร์มรัว ๆ ระหว่างคนกำลังกรอก
- แก้: แยก reader เป็น property ล้วน 4 ตัว (`formDataModel` · `$props.formData` · `formData` · `formModel`) + `getFormData(false)` เป็นตัวสุดท้ายตัวเดียวที่เรียกฟังก์ชัน · ล็อก index ที่ใช้ได้แล้วใช้ซ้ำ · ถ้าตัวสุดท้ายไม่เคยคืนค่าจะหยุดยิงหลัง 3 ครั้ง แต่ถ้ามันคือช่องเดียวที่ได้ข้อมูลจะถูกล็อกและใช้ต่อทุกรอบ (ไม่ค้างหลังรอบที่ 3)
- เทสเพิ่ม 3 ข้อ: property ใช้ได้ ⇒ `getFormData` ถูกเรียก 0 ครั้งใน 20 รอบ · มีแต่ `getFormData` ⇒ ยังสรุปถูกครบ 20 รอบ · `getFormData` ที่คืนค่าว่างตลอด ⇒ หยุดยิงภายใน 3 ครั้ง (assertion เดิมทั้งหมดคงไว้)
- ตรวจ: X-ray suite 14/16 ผ่าน · แดง 2 ตัวเดิมเรื่อง RIS `AdmissionNo`/`PatientSsn` · validator ผ่าน 52 widget
- ค้าง: ต้อง import ฟอร์มทับอีกรอบ แล้วยืนยันว่าปุ่มบันทึกหายเงียบอีกไหม ถ้ายังเงียบให้ดู console (F12) เพราะ `hn` เป็น required ตัวเดียวของฟอร์ม — validate ไม่ผ่านโดยที่ช่องอยู่นอกจอจะดูเหมือน "กดแล้วไม่มีอะไรเกิดขึ้น"

## [2026-09-24] fix | EMR ปุ่ม “ดูผลทั้งใบ” เปิด popup ผล LAB แทน Result Item CRUD
- ต้นเหตุ: `tsOpenOrder()` fallback ไปเปิด `data_id` ของ Result Item ตัวแรก จึงได้ฟอร์ม `LAB_result_item v1` แบบกรอก/แก้ไข แทนผลทั้งใบที่แพทย์ต้องอ่าน
- แก้ event/template ทั้ง FULL และ fragment ให้เปิด `tsLabDialog` อ่านอย่างเดียว; ตารางใช้คอลัมน์เดียวกับ LAB Worklist พร้อม comment, ผู้รายงาน, ผู้อนุมัติ, เวลา, PDF และไฟล์แนบ และย้ายเวลาสั่ง→ผลลงบรรทัดใหม่บนการ์ด
- ขยาย `emr-lab-board-get.js` ให้ join `zdata_lab_report_manual_entry`, ดึง Result Report metadata/attachments และค่าก่อนหน้าที่ Final/Corrected โดยไม่เรียก Process ห้อง LAB ที่ผูกสิทธิ์ Organization
- สร้าง import candidate `Form-Builder/SDForm/form-factory/forms/EMR_appointment_v2-lab-full-result-popup-v1.json` จาก EMR เดิม โดยเปลี่ยนเฉพาะ vue-ui `treat_summary`; generator คือ `build_emr_lab_full_result_popup.js`
- ตรวจผ่าน: `test_emr_lab_full_result_dialog.js`, `test_emr_summary_get_board.js`, JS syntax และ SDForm validator (มีเฉพาะคำเตือนเดิมเรื่อง root widget/Scan Code)
- ยังไม่ deploy: ต้อง replace Process `6ab3be31cec3020e8562a2c9`, import Form แล้ว UAT ด้วย HN `6900023` / visit `6900317`

## [2026-09-24] correction | ส่งเฉพาะสคริปต์ Components widget ไม่ replace EMR ทั้งฟอร์ม
- ผู้ใช้ไม่ต้องการ import/replace `EMR_appointment_v2` ทั้งใบ จึงถอน import candidate และ generator ออกจากชุดส่งมอบ
- ให้แก้เฉพาะ vue-ui `treat_summary` ในการ์ด `card62530`: วาง `treat-summary-template-FULL-v1.html` ใน Template/Content และ `treat-summary-onCreated-FULL-v1.js` ใน Event Setting → `onCreated`
- Process `emr-lab-board-get.js` ยังเป็น dependency แยกสำหรับ Reported by, Approve name, ผลก่อนหน้า และไฟล์แนบ; ไม่ต้องเปลี่ยนฟิลด์/การ์ดอื่นใน EMR

## [2026-09-24] correction | popup EMR ใช้หน้าตาเดียวกับ LAB Worklist
- ผู้ใช้ยืนยันว่า popup ที่ทำใหม่ยังเป็นคนละ design; requirement คือให้เหมือน flow `สืบค้นผลแลป → เปิดดูผล` โดยตรง
- เปลี่ยนเฉพาะ Template/Content และ `onCreated` ของ vue-ui `treat_summary`: ใช้ header/mode/status/byline, Profile row, child numbering, status signal, result table, comment, PDF, attachments และ footer ตามโครง LAB Worklist; ไม่ใช้ `append-to-body` ตาม runtime เดิม
- `emr-lab-board-get.js` ส่ง `patient_hn`, `group_id`, `group_name`; frontend รวมผลด้วย CPOE Item ทำให้ Hemoglobin typing เป็น 1 Profile และผลย่อย 5 แถว (`1.1`–`1.5`)
- ทดสอบผ่าน `test_emr_lab_full_result_dialog.js`, `test_emr_summary_get_board.js`, `git diff --check`; viewer block ใน FULL/fragment เหมือนกันและ tag-balanced
- ยังไม่ deploy; ส่งมอบเฉพาะไฟล์ component สองช่อง และ Process body dependency แยกต่างหาก

## [2026-09-24] ui | แยกชื่อ รหัส และค่าปกติในการ์ด LAB
- ปรับเฉพาะ Template ของ `treat_summary` ทั้ง FULL และ fragment ตามภาพผู้ใช้: แถวผลในการ์ดเป็น 3 บรรทัด `ชื่อรายการ` → `รหัสตรวจ` → `ปกติ ...`; ค่า/หน่วย/ลูกศรยังอยู่ฝั่งขวาบรรทัดบน
- ใช้รูปแบบเดียวกันกับผลผิดปกติและผลปกติที่กางดู; รายงานความเรียงย้ายรหัสลงบรรทัดสอง
- ตรวจ tag balance, ความเหมือนของ result block ใน FULL/fragment, tests และ `git diff --check` ผ่าน

## [2026-09-24] ingest | export EMR History ก่อนออกแบบก้อนผล LAB
- Export live Form `EMR History` `_id 6a96557e422c1ca959829eae` (v1) จาก initCraft Form Manage แล้วเก็บ snapshot ใหม่ที่ `Form-Builder/SDForm/backup/emr-history-6a96557e422c1ca959829eae-export-2026-09-24_18-03-01.json`; ต้นฉบับดาวน์โหลดอยู่ใน Downloads และ repo copy ลบ `feature_token` ตามกฎความปลอดภัย
- ตรวจ JSON ผ่าน; snapshot SHA-256 `e4642149bcb15f545e193e36fb84b0a7b0240d4bf31a837eef9b8c593293ba9c`. `form_model` ใน export เป็น encrypted package ตามพฤติกรรม Form Manage
- ยังไม่แก้ฟอร์ม รอผู้ใช้ยืนยันแบบ: ซ้อนการ์ดผล LAB pattern เดียวกับ EMR `treat_summary` ต่อใต้ order row ใน card Lab เดิมของ `emr_view`; อ่านผลจาก `emr-lab-board-get` แยก และจับคู่ด้วย CPOE Order id (`it.order_id` ↔ `source_order_id`) โดยไม่แตะ `emr-history-get` ที่เพิ่งกู้คืน

## [2026-09-24] correction | EMR History แยกการ์ดสั่งกับการ์ดผล LAB
- ผู้ใช้ชี้แจงว่า “ซ้อนท้าย” หมายถึงการ์ดผลเป็น sibling card อีกใบ วางถัดจากการ์ดคำสั่ง Lab ในคอลัมน์ขวา ไม่ใช่เอาผลเข้าไปซ้อนภายในกรอบการ์ดคำสั่ง เพราะเป็นข้อมูลคนละความหมาย
- ให้ยกการ์ดผล LAB จาก EMR `treat_summary` มาทั้งก้อนและคง pattern เดิม; การ์ดคำสั่งเดิมไม่เปลี่ยน ยังไม่เริ่ม implementation จนกว่าจะได้รับคำสั่งให้ลงมือ

## [2026-09-24] ui | EMR History เพิ่มการ์ดผล LAB แยกต่อท้ายการ์ดสั่งตรวจ
- สร้าง Template/Content และ `onCreated` สำหรับ vue-ui `emr_view` โดยคงการ์ดคำสั่งเดิม แล้ววางการ์ดผล LAB เป็น sibling ถัดลงมา; ไม่แก้ full Form และไม่ deploy live.
- ยก result card และ popup อ่านผลทั้งใบจาก Treat Summary/LAB Worklist มาใช้ครบทั้ง status, pending/critical, Profile, byline, comment, PDF และไฟล์แนบ.
- โหลดผ่าน `emr-lab-board-get` แยกจาก history และ join เฉพาะ `order_id === source_order_id`; ไม่แก้ `emr-history-get`.
- เพิ่ม deterministic builder กับ regression test; syntax, exact-match control, Profile 1.1–1.5, sibling placement, tag balance, LAB full-result tests, board unwrap tests และ `git diff --check` ผ่าน. Builder/Preview UAT ยังรอทำหลังนำสอง component scripts ไปวาง.

## [2026-09-24] ui | LAB result attachments เพิ่มเป็น 10 ไฟล์และนำไฟล์ออกได้
- ปรับเฉพาะ popup ผล LAB ใน Worklist และ action `save_result_attachments`: รองรับสูงสุด 10 ไฟล์, 10 MB/ไฟล์, รวม 50 MB; ชนิดไฟล์เดิม PDF/JPG/JPEG/PNG ไม่เปลี่ยน.
- เพิ่ม `นำออก` พร้อม confirm เฉพาะโหมด `today`; lookup/EMR/History ยังอ่านอย่างเดียว. การนำออกเป็น metadata unlink จาก Result Report ไม่เรียก physical delete และ rollback UI เมื่อบันทึกล้มเหลว.
- API ตรวจ removal แบบ additive ด้วย `attachment_operation`/`removed_attachment_key`: ต้องหายไปหนึ่งไฟล์เดิมพอดีและห้ามแทรกไฟล์ใหม่; client เดิมที่ไม่ส่ง operation ยังใช้ `replace` เหมือนเดิม.
- ตรวจผ่าน Worklist Form/API regression tests และ SDForm validator; ยังไม่ deploy ต้อง replace Form กับ Process body คู่กัน.

## [2026-09-25] ui | เปลี่ยนปุ่มนำไฟล์ออกเป็นกากบาท
- เปลี่ยนเฉพาะหน้าตาปุ่มไฟล์แนบใน popup ผล LAB จากข้อความ `นำออก` เป็นปุ่มวงกลม `×` ขนาด 28px พร้อม title/aria-label; confirm และ persistence เดิมไม่เปลี่ยน.
- Regenerate Worklist Form JSON แล้ว; Form/API tests, SDForm validator และ `git diff --check` ผ่าน. รอบนี้ re-import เฉพาะ Worklist Form JSON ไม่ต้อง replace API ซ้ำ.

## [2026-09-25] fix | เลือกแนบผล LAB หลายไฟล์ในครั้งเดียว
- แก้ Worklist result uploader ให้จองจำนวน/ขนาดของไฟล์ทุกไฟล์ในชุดที่เลือก และไม่ disable ตัว uploader ระหว่างที่ Element Plus กำลังส่ง batch เดียวกัน.
- serialize การบันทึก `result_attachments` และ merge ไฟล์ใหม่กว่ากลับเข้า UI เพื่อไม่ให้ response ของไฟล์แรกทับไฟล์ถัดไป; ข้อจำกัด 10 ไฟล์/10 MB ต่อไฟล์/50 MB รวมและ flow ลบไฟล์เดิมไม่เปลี่ยน.
- เพิ่ม regression test เลือก PDF+PNG พร้อมกัน ยืนยันว่า metadata save ไม่ชนกันและสุดท้ายคงครบ 2 ไฟล์; Form/API tests, SDForm validator และ `git diff --check` ผ่าน. Re-import เฉพาะ Worklist Form JSON.

## [2026-09-25] fix | แยก Element Plus pending list ออกจากไฟล์แนบผล LAB ที่บันทึกแล้ว
- Runtime ยืนยันว่า native file input มี `multiple` อยู่แล้ว แต่รอบก่อนยังได้เพียงไฟล์เดียว; ต้นเหตุคือ `:file-list="manual.attachments"` ถูกแทนหลัง success แรกและตัด pending sibling ออกจาก batch.
- เปลี่ยนเป็น `v-model:file-list="resultUploadFiles"` แยกจาก persisted attachments และล้างเมื่อ reservation/persistence ของทั้ง batch จบเท่านั้น; คิว metadata, validation 10/10/50 และ flow ลบเดิมคงไว้.
- เพิ่ม regression assertion ว่า success แรกต้องไม่ลบอีกไฟล์ใน Element Plus batch; Form/API tests, validator และ `git diff --check` ผ่าน. ต้อง re-import Worklist Form JSON และยืนยัน runtime ด้วย 2 ไฟล์.

## [2026-09-25] fix | ป้องกัน LAB Worklist vue-ui ล้มหลังอัปโหลดหลายไฟล์
- Runtime ยืนยันว่าไฟล์ทั้ง 2 ถูกบันทึกจริง แต่ direct `v-model:file-list` ทำให้ Components widget ขึ้น `Unable to display this content` หลัง callback จบ; refresh แล้วข้อมูลกลับมาเพราะ persistence สำเร็จ.
- ถอดทั้ง `:file-list`/`v-model:file-list` และ Element `limit` ออกจาก uploader เพื่อให้ pending list เป็น internal state; กฎ 10 ไฟล์/10 MB ต่อไฟล์/50 MB รวมยังบังคับใน `beforeResultUpload` และคิวบันทึกเดิมไม่เปลี่ยน.
- ถอด argument ตัวเลขจาก batch notification เพราะ runtime แสดง `3000` เป็น title. Form/API tests, SDForm validator, generated-artifact checks และ `git diff --check` ผ่าน; ต้อง re-import Form JSON และยืนยัน runtime.

## [2026-09-25] note | commit + push checkpoint X-ray/LAB/EMR
- Commit `03f9b5d`: 202 ไฟล์ (X-ray CPOE/RIS, LAB cancellation + attachments, EMR LAB result card, Report Factory builders, design/handoff docs).
- ตรวจ tree ที่ staged ด้วย `git checkout-index` ก่อน commit: 33 เทสผ่าน / 10 แดง ซึ่งเป็น 10 ตัวเดิมที่แดงอยู่ก่อนแล้วใน worktree; SDForm validator ผ่านทุกฟอร์มที่เราเขียนเอง (ไม่ใช้กับ module/SQL export ที่ดึงจากระบบจริง).
- กันไว้ไม่ commit เพราะ `origin` เป็น repo public และไฟล์เตือนเองว่า "ห้าม push ขึ้นที่สาธารณะ": 4 ไฟล์ที่มี print-agent token + 6 เทสที่อ่านไฟล์เหล่านั้น (ไม่งั้น tree ที่ push จะมีเทสพัง) + ส่วน finance gate ใน `update_lab_cpoe_worklist_ui.js` ที่ design ยังรออนุมัติ. ทุกไฟล์ยังอยู่ในเครื่องครบ.
- `tmp/` (3 MB scratch) ถอดออกจาก commit และใส่ `.gitignore` แทน.
