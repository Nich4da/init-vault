---
type: synthesis
title: Wiki Index
created: 2026-07-16
updated: 2026-08-04
tags: [meta, index]
---

# Wiki Index

The content catalog for this wiki. Every page is listed once, under its category,
with a one-line summary. This is the first thing to read when answering a question —
find the relevant pages here, then drill in. See [[CLAUDE|the schema]] for the rules.

**Domain:** the [[initcraft|initCraft / SDForm]] low-code platform (+ its first real app, [[his|HIS]]).
**Second domain (2026-08-04):** [[open-design|Open Design]] — agent-native OSS design tooling. Unconnected to the above; see [[open-design-repo]] for why it's here.
**Counts:** 15 sources · 8 entities · 30 concepts · 4 syntheses

---

## Sources
_One summary page per ingested source. Backed by files in `raw/`._

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

## Concepts
_Ideas, topics, methods, themes._

**Wiki method**
- [[persistent-wiki-pattern]] — compile knowledge once into a maintained wiki; don't re-derive per query.
- [[ingest-query-lint]] — the three operations that drive the wiki's lifecycle.

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
- [[his-lab-module-plan]] — **LAB module scope, gap analysis & build plan**: 9 screens, proposed `zdata_lab_*` model, build order, 18 blocking decisions. `2026-07-31` (revised `2026-08-04`)
- [[his-lab-worklist-ui]] — **the 3-tab LAB worklist UI design** (S2/S3/S4) for งานชีวเคมี; clickable mockup at `HIS/ui/lab-worklist-mockup.html`. `2026-08-04`

---

## Planned pages (greyed links, no page yet)
_Referenced but not written — candidates for the next ingest/lint._
- [[form-factory]] — the Form Factory builder module.
- [[line-integration]] — LINE messaging (`linePush`, `liff`, `lineVerifyIdToken`).
- Component pages hinted by HIS: `record-ui`, `list-ui`, `datagrid-form-ui`, `smart-card-ui`.
- [[his-diagnosis]] — the Diag / `coder` (ICD coding) module from the [[his-system-flow|flow]].
- Clinical Doc / `IOT` step — not yet its own page (label unconfirmed).
