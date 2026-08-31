---
type: synthesis
title: Wiki Index
created: 2026-07-16
updated: 2026-08-30
tags: [meta, index]
---

# Wiki Index

The content catalog for this wiki. Every page is listed once, under its category,
with a one-line summary. This is the first thing to read when answering a question —
find the relevant pages here, then drill in. See [[CLAUDE|the schema]] for the rules.

**Domain:** the [[initcraft|initCraft / SDForm]] low-code platform (+ its first real app, [[his|HIS]]).
**Second domain (2026-08-04):** [[open-design|Open Design]] — agent-native OSS design tooling. Unconnected to the above; see [[open-design-repo]] for why it's here.
**⚠ 2026-08-16:** a **parallel, unconnected AI coding workspace** (`codex-backup`, outside this
vault) was discovered and ingested — 8 days of *real* LAB Workbench + Clinic Master implementation
that [[his-lab-module-plan]] never reached. Start at [[his-lab-workbench-handoff]].
**Counts:** 28 sources · 10 entities · 32 concepts · 4 syntheses

---

## Sources
_One summary page per ingested source. Backed by files in `03-source-materials/`._

- [[llm-wiki-idea]] — the founding idea: LLMs incrementally build & maintain a persistent, interlinked wiki instead of re-deriving knowledge per query. `2026-07-16`
- [[llm-api-docs]] — **server-side** `app.*` API reference for API Factory processes (DB CRUD, sdform, txn, SQL, LINE, roles, crypto). `2026-07-16`
- [[llm-field-docs]] — **client-side** reference: ~83 field/UI/container components + `this.*` field/form/connector functions. `2026-07-16`
- [[his-patient-form]] — exported [[his|HIS]] **Patient** form (`patient.json`): registration/lookup, smart-card, visit-flow diagram. `2026-07-17`
- [[his-emr-form]] — exported [[his|HIS]] **EMR** form (`EMR.json`): OPD SOAP note, vitals/BMI, consult, disease registry. `2026-07-17`
- [[his-visit-form]] — exported [[his|HIS]] **Visit** form (`visit.json`): `vn` autonumber, visit_date, clinic/doctor, insurance snapshot; links person via `pid.value`. `2026-07-20`
- [[his-system-flow]] — the [[his|HIS]] **"architecture" flow diagram** (draw.io): register → เช็คสิทธิ์ → visit → EMR → clinical modules → billing → claims → data feeds. `2026-07-19`
- [[report-factory-skill]] — the **Report Factory skill** doc-set (SKILL + binding/fields/latex refs), reverse-engineered from `SdReport.vue` — authoritative runtime/binding reference. `2026-07-19`
- [[his-lab-biochem-requirements]] — หน่วยงานชีวเคมี's **LAB requirement memo**: modules unused/missing + 11 add/fix requests. The scope document for the LAB project. `2026-07-31`
- [[his-lab-che-request-form]] — the paper **ใบส่งตรวจงานชีวเคมี (C-20/L3.1)**: specimen block + 25 groups / 90 test codes; the layout the order screen must copy. `2026-07-31`
- [[his-lab-che-order-component]] — exported **Lab CHE Order** form (`Lab_CHE_Order_Component.json`): patient banner + tick-sheet `vue-ui`, state in `selected_items_json`. `2026-07-31`
- [[open-design-repo]] — the **`nexu-io/open-design` repository** (v0.16.1): OSS Claude Design alternative — architecture, the four composable planes, repo conventions worth stealing. `2026-08-04`
- [[his-lab-bg-request-forms]] — **ชีวโมเลกุลและพันธุศาสตร์** paper forms (`C-20/L8.1`, `L8.2` ×2, `BG49`): `BG` codes, **composite codes**, per-test fields, clinical narrative, `Out lab`. `2026-08-04`
- [[his-lab-immuno-request-forms]] — **งานภูมิคุ้มกันวิทยา** paper forms (`C-20/L5.1-1` + `L5.1-2` **Out Lab**): urgency (ด่วน), สิทธิ on the form, allergen codes, panels, ~200 out-lab tests. `2026-08-04`
- [[his-module-packages-backup]] — `module_packages` exports for **Patient · EMR · Drug & Stock**; reveals [[pis|PIS]] has started as `pis_drug` "Pharmacy Back Office". `2026-08-04`
- [[his-lab-workbench-handoff]] — **the real LAB build's core architecture**: one shared Lab Workbench app filtered by `lab_section`, not per-unit; shared Order/Result Item model; existing production form IDs. `2026-08-16`
- [[his-lab-center-cpoe-master]] — Lab Center (doctor CPOE, LAB+Xray in one screen) bound to a 1,605-record master; `room_code` mapping; LAB/Xray grouping bug fix. `2026-08-16`
- [[his-lab-center-specimen-hub]] — 3 build attempts at a central specimen-check screen; 2 abandoned (`vue-ui` proxy error), 1 safe (native ListView); zero-row bug unresolved. `2026-08-16`
- [[his-lab-work-item-bridge]] — the finalized architecture: `zdata_specimen_collection_status` (canonical queue) → idempotent bridge → shared `zdata_lab_cen_crud` Work Item queue. `2026-08-16`
- [[his-lab-specimen-status-session-aug16]] — dense same-week session: VN patient-snapshot hydration, EMR-style receive navigation, order-edit audit history (`order_change_history_json`), dev-mode switches. `2026-08-16`
- [[his-lab-bio-workspace]] — Biochemistry's working order→receive/reject lifecycle (`zdata_testlab_bio`); the reference flow every other lab section generalizes from; supersedes [[his-lab-che-order-component]]. `2026-08-16`
- [[his-clinic-master-handoff]] — the separate **Clinic Master** initiative: generic clinic registry → target form + shared status queue; P0–P2 task list; `order_note` gap found. `2026-08-16`
- [[his-lab-misc-artifacts]] — predecessor scripts + an unlogged drug-label printing side-project (2026-08-06), never previously ingested. `2026-08-16`
- [[his-medical-record-report]] — ใบปกเวชระเบียนผู้ป่วยนอก + บัตรฉีก: `FROM`/JOIN fix + `queue_display`/`age_display` fields all confirmed live and shipped; found the SQL Factory dual-JOIN gotcha and the Report Factory → App Factory publish chain. **Open bug:** `{{prename_text}}` unresolved outside Report Factory's own preview. `2026-08-17`, updated `2026-08-18`
- [[initcraft-library-migration]] — provenance and categorized map for 8 active skills plus JSON, JavaScript, and Python libraries grouped under `Form-Builder/`, including read-only Form/API template backup folders. `2026-08-27`
- [[element-plus-component-overview]] — official Vue 3 Element Plus overview snapshot: 82 components across 7 categories; catalog map, not proof of initCraft compatibility. `2026-08-27`
- [[draw-io-mcp-server]] — official map of four draw.io AI integrations: MCP App, MCP Tool, Skill+CLI, and embedded diagram URL. `2026-08-27`
- [[draw-io-custom-llm-backends]] — draw.io editor configuration for custom models/endpoints, create-vs-update attachments, prompts, response parsing, and data-boundary cautions. `2026-08-27`

## Entities
_People, orgs, tools, products, places._

- [[initcraft]] — the low-code platform (softmax-one.com); domain anchor. Four factories: Form / SQL / API / Report.
- [[sdform]] — the form engine at initCraft's core; spans client runtime + permissioned server layer.
- [[mongodb]] — the datastore; `zdata_*` collections, direct `app.db*` vs raw driver access.
- [[erp-mongodb]] — the live `erp` database: ~70 collections, system vs `zdata_*`, `_id` typing (read-only snapshot 2026-07-17).
- [[his]] — Hospital Information System built on initCraft; the wiki's first real *application* example.
- [[obsidian]] — local markdown app used as the "IDE" for browsing this wiki.
- [[memex]] — Vannevar Bush's 1945 antecedent of the persistent-wiki pattern.
- [[open-design]] — Apache-2.0 local-first design workspace; ships no agent, drives the CLIs on your `PATH`.
- [[element-plus]] — Vue 3 component library; official catalog vocabulary related to, but not equivalent to, initCraft's SDForm component set.
- [[draw-io]] — diagrams.net editor used by existing HIS artifacts; official MCP, CLI, URL, and configurable LLM generation surfaces.

## Concepts
_Ideas, topics, methods, themes._

**Wiki method**
- [[persistent-wiki-pattern]] — compile knowledge once into a maintained wiki; don't re-derive per query.
- [[ingest-query-lint]] — the three operations that drive the wiki's lifecycle.

**AI tooling and diagramming**
- [[model-context-protocol]] — MCP integration patterns observed in draw.io and Open Design; shared protocol label does not imply identical capabilities or setup.
- [[ai-diagram-generation]] — draw.io create/update loop, XML identity and diff application, model configuration, and attachment data boundary.

**initCraft / SDForm platform**
- [[server-api-app]] — the `app.*` server surface: two data-access tiers, process/event, txn, SQL, integrations.
- [[client-api-this]] — the `this.*` field / `getFormRef().*` form / `userState.*` connector functions.
- [[field-components]] — catalog of ~83 components (Basic 20 · Advanced 19 · Display 30 · Container 14).
- [[form-model-json]] — the exported VForm structure (`fields` widget tree + `formConfig`); where event scripts live.
- [[xformdatax]] — the only channel to write process results back into a saved form (field-name-keyed merge).
- [[dataprovider]] — the shared `SdDataProvider` query object (where/params/orderBy or raw `nosql`).
- [[zdata-collections]] — `zdata_*` collections, `xrstatx` status codes, audit fields (xrstatx type resolved).
- [[mongo-transactions]] — `mongoTxn` (atomicity) & `withVersion` (optimistic lock).

**The four factories (builders)**
- [[form-factory]] — design forms from the component catalog (page still to write).
- [[sql-factory]] — `module_sql` named queries; backtick fields, shared `where` language, compile to Mongo.
- [[api-factory]] — `module_api` server processes; `params`/`userInfo`/`app.*`, return `{success, xformDatax}`.
- [[module-packages]] — the App Factory registry that publishes a form as a navigable **module** (`app_code`, `app_packages[].tab_form`); permissions live here and are unused.
- [[report-factory]] — PDF/Excel/Word/LaTeX reports; render pipeline + `{{}}`/`strtr` binding, two-layer model, pdfmake/html gotchas (colgroup widths, THSarabun).
  - [[report-latex]] — the separate LaTeX output model (Nunjucks `\VAR{}`/`\BLOCK{}`, Tectonic, server-side).

**Client application patterns** (from the [[his|HIS]] forms)
- [[crudgetall]] — client-side data read via the `userState` connector (`sdProvider` + `where`).
- [[runprocess]] — client → [[api-factory]] process call; result in `res.data`.
- [[openform]] — sub-form popups with `afterSaveCallback` / `readonly`; `null` dataId = new record.
- [[vue-ui-pattern]] — `vue-ui` custom components driven by `this.vueState`; orchestrate siblings via `getFieldRef`.

**HIS application domain** (from the [[his-system-flow|flow diagram]])
- [[cpoe]] — CPOE order entry; writes `order_tran`.
- [[pis]] — pharmacy information system; drug orders/dispense (backs the ใบฎีกาจ่ายยา report). **Now a real module: `pis_drug` "Drug & Stock".**
- [[lis]] — laboratory information system; the **รอรับเข้า → รับเข้าดำเนินการ → ออกผลแล้ว** pipeline, LAB NO., specimens, critical values, results ↔ `ผลแล็บ`. **Active build — now known to span 3+ lab units.**
- [[his-billing]] — FA / `fa_trans` / ปิดสิทธิ์ (charge capture + revenue recognition).
- [[his-claims]] — ระบบเคลม: CSOP (จ่ายตรง/โครงการ) + e-claim (บัตรทอง).
- [[his-data-integrations]] — outbound feeds: 43 แฟ้ม, FDH, refer.
- [[his-insurance]] — สิทธิการรักษา (`inscl_*`): rights on PERSON, verified via checkRight, snapshotted onto each visit.
- [[his-data-model]] — live `his` MongoDB schema: `zdata_person`/`zdata_visit`/`zdata_patient_assessment`/`relate[]`, join keys, coded `{label,value}` fields.

**[[open-design|Open Design]] (second domain)**
- [[design-md]] — the brand-as-a-markdown-file contract; 9 sections, 151 shipped packages, tokens/components/provenance.
- [[skill-md]] — the Agent Skills `SKILL.md` convention (as used by `.claude/skills/` here) + Open Design's `od:` registry block.
- [[od-plugin]] — `open-design.json` manifests, capability declarations, the `od plugin` CLI, and the UI/CLI parity rule.

## Syntheses
_Overviews, comparisons, evolving theses, and filed query outputs._

- [[his-med-dispense-voucher-report]] — the ใบฎีกาจ่ายยา Report Factory build (header/table/footer, placeholders, pending SQL). `2026-07-17`
- [[his-opd-flow]] — end-to-end HIS OPD patient journey (register → EMR → billing → claims → data feeds) + module/transaction-table map. `2026-07-19`
- [[his-lab-module-plan]] — ⚠ **SUPERSEDED 2026-08-16** by [[his-lab-workbench-handoff]] and siblings — LAB module scope/plan: 9 screens, proposed `zdata_lab_*` model, 18 blocking decisions. Kept for history. `2026-07-31` (revised `2026-08-04`)
- [[his-lab-worklist-ui]] — **the 3-tab LAB worklist UI design** (S2/S3/S4) for งานชีวเคมี; clickable mockup at `02-his/ui/lab-worklist-mockup.html`. `2026-08-04`

## Design and implementation contracts
_User-approved artifact specifications outside the maintained knowledge-base layer._

- [LAB design and functional specification](../design/Lab_design.md) — binding visual tokens, dimensions, layout, workflow/state rules, integration boundaries and SDForm acceptance checklist. `2026-08-30`
- [LAB design decision record](../design/Lab_design-contract.md) — evidence, keep/change/do-not-copy boundaries, risks and quality gate. `2026-08-30`
- [LAB implementation handoff](../design/Lab_implementation-handoff.md) — concise instructions for the first SDForm build. `2026-08-30`
- [LAB CPOE integration checklist](../design/lab-cpoe-integration-checklist.md) — confirmed Order/Item decisions, panel evidence, worklist API contract, CPOE fixes, and staged path to the first real-data LAB SDForm. `2026-08-30`
- [LAB SDForm working area](../Form-Builder/SDForm/Lab/README.md) — user-approved destination and JSON safety guardrails. `2026-08-30`

---

## Planned pages (greyed links, no page yet)
_Referenced but not written — candidates for the next ingest/lint._
- [[form-factory]] — the Form Factory builder module.
- [[line-integration]] — LINE messaging (`linePush`, `liff`, `lineVerifyIdToken`).
- Component pages hinted by HIS: `record-ui`, `list-ui`, `datagrid-form-ui`, `smart-card-ui`.
- [[his-diagnosis]] — the Diag / `coder` (ICD coding) module from the [[his-system-flow|flow]].
- Clinical Doc / `IOT` step — not yet its own page (label unconfirmed).
