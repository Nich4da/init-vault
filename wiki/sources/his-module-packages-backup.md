---
type: source
title: HIS — module_packages backups (Patient, EMR, Drug & Stock)
created: 2026-08-04
updated: 2026-08-04
tags: [his, initcraft, sdform, module, app-factory, pis]
source_file: "HIS/sdform_module/{Patient_form,EMR_form,Drug&Stock}/backup-data-module_packages-Earn_admin-*.json"
source_type: note
source_date: 2026-08-04
author: user (developer) — exported from softmax-one.com
---

# HIS — `module_packages` backups (Patient · EMR · Drug & Stock)

> Three tiny (~1.8 KB) exports of the **`module_packages`** collection — the registry that
> publishes a [[form-model-json|form]] as a navigable **module** in the app shell.
> Exported by `Earn_admin` on 2026-08-04. Not form definitions — **module manifests**.
> The concept page is [[module-packages]].

## The three records

| App | `app_code` | `app_name` | `app_desc` | Module `_id` | Bound form (`tab_form.value`) | Created |
|---|---|---|---|---|---|---|
| Patient | `patient` | Patient | — | `6a4cf9ce49285083acfeb08d` | `6a4c943549285083acfeb080` "Patient v1" | 2026-07-07 |
| EMR | `emr` | EMR | — | `6a4f664ff8cdfc54cec16489` | `6a4f64e7f8cdfc54cec16488` "EMR v1" | 2026-07-09 |
| **Drug & Stock** | `pis_drug` | Drug & Stock | **Pharmacy Back Office** | `6a68faa3c91cb8030e26d75e` | `6a68f6cec91cb8030e26d75d` "Drug & Stock v1" | **2026-07-29** |

All three: `app_mode: "module"` · `app_share: "public"` · `app_publisher: "2"` ·
`tool_license: "6a3113a619ee74c8f82854a0"` (same licence across all) ·
`xrstatx: 1` · `xversionx: "v1"` · `xparentx` = own `_id`.

## 🆕 The headline: **PIS has started**

`pis_drug` / "Drug & Stock" / **"Pharmacy Back Office"** was created **2026-07-29** and last
updated **2026-08-02**, with tab label **"Drug Items"** and icon `addon-capsule-pill`. Its
`xunitx` is **`B001 เภสัชกรรม`**.

This is the first hard evidence that [[pis]] is moving from diagram box to real module — the
domain behind the still-unfinished [[his-med-dispense-voucher-report|ใบฎีกาจ่ายยา report]].
The form body (`6a68f6cec91cb8030e26d75d`) has **not** been exported yet, so its fields are
unknown.

## Record shape

```jsonc
{
  "_id": {"$oid": "…"}, "xparentx": {"$oid": "…"},   // = own _id for a root record
  "xsitex": {"code": "0000",  "name": "0000"},
  "xunitx": {"code": "B001",  "name": "เภสัชกรรม"},
  "xrstatx": 1, "xversionx": "v1", "xerrorx": null,
  "created_by": {"id": {"$oid": "…"}, "name": "SuperAdmin InitAPI (iencoded@gmail.com)"},
  "created_at": "2026-07-29 01:53:23",   // string, "YYYY-MM-DD HH:mm:ss" — not a BSON date
  "updated_by": {...}, "updated_at": "2026-08-02 17:31:56",
  "dataid": "…",                          // duplicate of _id as a plain string

  "app_logo": [ { "name": "pills.png", "url": "https://apihis…/assets/sdform/<formId>/picture/…",
                  "response": { "fileId": "…", "formId": "68f5ff7e2bdb232a29533e57", … } } ],
  "tool_license": "6a3113a619ee74c8f82854a0",
  "app_code": "pis_drug", "app_name": "Drug & Stock", "app_desc": "Pharmacy Back Office",
  "app_mode": "module", "app_share": "public", "app_publisher": "2",
  "app_assign_roles": null, "app_category": null, "app_info": null, "app_note": null,

  "app_packages": [ {                     // ← the tabs of the module
      "tab_form":  {"value": "6a68f6cec91cb8030e26d75d", "label": "Drug & Stock v1"},
      "tab_icon":  "addon-capsule-pill",
      "tab_label": "Drug Items",
      "tab_roles": null, "tab_widget_name": "", "tab_options": ""
  } ]
}
```

## Key takeaways

- **`app_packages[]` is an array of tabs** — a module can host several forms side by side, each
  with its own icon, label, and `tab_roles`. All three modules currently ship exactly **one** tab.
- **`tab_form.value` is the join key** into the form definition — the module↔form binding this
  vault previously only inferred.
- **Permissions have two levels and both are unused:** `app_assign_roles` (module) and
  `tab_roles` (per tab), `null` everywhere. Also `app_category: null` on all three, so the
  module list is currently uncategorised.
- **`app_logo` is an uploaded file object**, not an icon name — a full upload response with a
  public `apihis.softmax-one.com/assets/…` URL. The `formId` inside that path
  (`68f5ff7e2bdb232a29533e57`) is the **`module_packages` form's own id**, i.e. the SDForm that
  defines this registry — not the form being registered.
- **`tab_icon` is an icon-name string** (`el-user`, `addon-capsule-pill`) — two different icon
  namespaces (`el-` = Element Plus, `addon-` = a custom set). EMR's is `null`, so the field is
  optional and EMR's tab renders unlabelled/unиconed.
- Audit timestamps are **strings**, matching the `zdata_*` convention in [[zdata-collections]].

## Entities & concepts touched

- [[module-packages]] — the concept page written from this source.
- [[pis]] — updated: Drug & Stock is now a real module.
- [[sdform]] · [[form-model-json]] — what a module points at.
- [[zdata-collections]] — the audit/status fields (`xrstatx`, `xversionx`, `xparentx`).
- [[erp-mongodb]] — where `module_packages` was already listed as "App Factory".
- [[his-patient-form]] · [[his-emr-form]] — the forms two of these modules bind to.

## Contradictions / open questions

- **`xsitex` is inconsistent:** Patient has `{code:"00000", name:"Center"}` (5 digits) while EMR
  and Drug & Stock have `{code:"0000", name:"0000"}` (4 digits, name = the code). Is `0000` a
  placeholder, or a genuinely different site? Same question for the whole `zdata_*` corpus.
- **EMR's `xunitx` is `A103 คลินิกทันตกรรม` (dental clinic)** — almost certainly just the unit
  the admin was scoped to when creating it, not a claim that EMR belongs to dentistry.
  If `xunitx` filters visibility anywhere, this is a live bug.
- **The Drug & Stock form itself has not been exported** — only its manifest. Fields, tabs,
  and any stock/dispense logic are unknown. Ask for `6a68f6cec91cb8030e26d75d`.
- No **LAB module** appears in these exports, despite [[lis]] being the active build. Either it
  hasn't been registered yet or its backup wasn't included.
- What does `app_publisher: "2"` mean? A publish state (draft/published), or a publisher id?
