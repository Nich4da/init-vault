---
type: synthesis
title: Wiki Log
created: 2026-07-16
updated: 2026-08-27
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
