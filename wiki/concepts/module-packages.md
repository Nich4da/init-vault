---
type: concept
title: module_packages — publishing a form as a module
created: 2026-08-04
updated: 2026-08-04
tags: [initcraft, sdform, module, app-factory, mongodb]
sources: ["[[his-module-packages-backup]]", "[[llm-api-docs]]"]
---

# `module_packages` — publishing a form as a module

The **App Factory** registry in [[initcraft]]: one document per **module** (the tiles/menu
entries a user navigates), each binding one or more [[form-model-json|forms]] as tabs
([[his-module-packages-backup]]). A form that exists in Form Factory but has no
`module_packages` record is built but **not reachable** by a normal user.

This is the fifth builder surface alongside [[form-factory]], [[sql-factory]], [[api-factory]],
and [[report-factory]] — the one that decides what shows up in the app shell.

## Document shape

| Field | Meaning |
|---|---|
| `app_code` | stable slug — `patient`, `emr`, `pis_drug` |
| `app_name` / `app_desc` | display name + subtitle |
| `app_mode` | `"module"` |
| `app_share` | `"public"` |
| `app_publisher` | `"2"` — meaning unconfirmed |
| `app_logo[]` | an **uploaded file object** (not an icon name) with a public assets URL |
| `app_category` | grouping in the module list — `null` in all observed records |
| `app_assign_roles` | module-level permission — `null` in all observed records |
| `tool_license` | the licence the module runs under; identical across HIS modules |
| **`app_packages[]`** | **the tabs** — see below |
| `xsitex` / `xunitx` | org scope stamped at creation (`{code,name}`) |
| `xrstatx` · `xversionx` · `xparentx` · `dataid` | standard [[zdata-collections]] audit/status fields |

### `app_packages[]` — one entry per tab

```jsonc
{
  "tab_form":  { "value": "<formId>", "label": "Drug & Stock v1" },  // ← join key to the form
  "tab_icon":  "addon-capsule-pill",     // icon name; `el-*` = Element Plus, `addon-*` = custom
  "tab_label": "Drug Items",             // may be null → tab renders without a label
  "tab_roles": null,                     // per-tab permission
  "tab_widget_name": "",
  "tab_options": ""
}
```

**`tab_form.value` → the form's `_id`** is the module↔form binding. The array means a module can
host several forms as sibling tabs; every HIS module observed so far ships exactly one.

## Observed in HIS

| `app_code` | Module | Unit (`xunitx`) | Registered |
|---|---|---|---|
| `patient` | Patient | `00000 Center` | 2026-07-07 |
| `emr` | EMR | `A103 คลินิกทันตกรรม` ⚠ | 2026-07-09 |
| `pis_drug` | Drug & Stock (*Pharmacy Back Office*) | `B001 เภสัชกรรม` | 2026-07-29 |

⚠ EMR's unit is almost certainly an artifact of who created the record, not a claim about
ownership — but if `xunitx` ever filters visibility, it matters.

**No LAB module is registered yet**, even though [[lis]] is the active build. Registering one is
an implicit step in the [[his-lab-module-plan|LAB build plan]] that the plan doesn't name.

## Why it matters

- **The last mile of shipping a form.** [[initcraft-build-form|Building a form]] ends at a saved
  definition; users only see it once a `module_packages` record points at it. Anything the LAB
  module builds needs this step.
- **Permissions live here, and are unused.** `app_assign_roles` + `tab_roles` are the natural
  place to say "only lab staff open the LAB worklist" — both `null` across every HIS module
  today. Worth flagging before the LAB module ships to real users.
- **It's the app's site map**, so it's also the answer to "what modules exist in this HIS?" —
  query `module_packages` rather than guessing from form names.

## Open questions

- Meaning of `app_publisher: "2"` — publish state or publisher id?
- Do `xsitex` / `xunitx` on a module actually **filter** who sees it, or are they just audit
  stamps? (The `00000` vs `0000` inconsistency across records suggests audit-only.)
- Is there a matching `module_*` record for [[api-factory]] processes and
  [[sql-factory]] queries, or is `module_packages` only for forms?

## Related

- [[his-module-packages-backup]] — the source exports.
- [[form-model-json]] — what `tab_form.value` resolves to.
- [[erp-mongodb]] — lists `module_packages` under "App Factory".
- [[pis]] — the module this source revealed.
