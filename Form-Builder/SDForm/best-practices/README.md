# SDForm Best Practices

This directory is the curated library of SDForm patterns that have demonstrably
met a specific user goal. It is distinct from `../backup/`: backup preserves an
archival reference, while best practice captures a proven reusable approach.

## Promotion gate

A working Form may be promoted only when:

1. Its goal and reusable pattern are explicit.
2. The source remains in its working path, normally `../form-factory/forms/`.
3. The candidate passes the required SDForm static checks.
4. Evidence proves the claimed goal:
   - visual/layout goal: verified in Builder and Preview;
   - interaction goal: verified in Preview with the relevant states;
   - data/API/workflow goal: verified in the deployed runtime with safe test data.
5. The promoted copy contains no credentials, database URIs, patient/production
   data, environment-specific identifiers, or unnecessary real sample data.
6. Dependencies and known limitations are documented.

If the necessary environment is unavailable, keep the artifact as a candidate in
its working folder. Static validation by itself never earns best-practice status.

## Required files

Each promoted pattern is an immutable versioned pair:

- `<pattern>-vN.json` — sanitized reusable SDForm artifact.
- `<pattern>-vN.md` — evidence and reuse sidecar using the template below.

```markdown
# Pattern name vN

- Goal:
- Reusable pattern:
- Source path:
- Promoted from commit:
- Static validation:
- Builder verification:
- Preview verification:
- Runtime verification:
- Dependencies:
- Safe placeholders:
- Known limitations:
- Reuse steps:
```

## Reuse and versioning

- Never edit, rename, move, reformat, or overwrite a promoted pair.
- Copy the JSON to `../form-factory/forms/` before adapting it.
- Create `v2`, `v3`, and so on for improvements. Mark superseded versions in the
  catalog but preserve them for provenance.
- Revalidate the copied working Form for its new context. Previous evidence does
  not prove a modified copy or a different environment.

## Catalog

| Pattern | Goal | Evidence level | Dependencies | Status |
|---|---|---|---|---|
| _No promoted patterns yet_ | | | | |
