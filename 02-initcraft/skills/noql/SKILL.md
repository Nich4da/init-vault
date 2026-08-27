---
name: noql
description: NoQL SQL-to-MongoDB query writing with @synatic/noql. Use when Codex needs to write, review, debug, or explain NoQL SQL statements that compile to MongoDB find queries or aggregation pipelines, especially for SELECT/FROM/WHERE, joins, array sub-selects, object shaping, conversion/date/string/math functions, GROUP BY, window functions, UNION, PIVOT/UNPIVOT, and NoQL-specific caveats.
---

# NoQL

Use this skill to write SQL statements for `@synatic/noql`, a parser that converts SQL-like syntax into MongoDB queries and aggregation pipelines.

## Workflow

1. Identify whether the task needs a simple `find` query or an aggregation pipeline.
2. Read `references/noql-reference.md` before producing syntax beyond a trivial `SELECT ... FROM ... WHERE ...`.
3. Search `references/noql-docs-search-index.json` when the task involves a less common function, API detail, or syntax not covered by the concise reference.
4. Preserve MongoDB field case exactly. Quote fields or collections that contain spaces, hyphens, special characters, or nested paths.
5. Alias every function and subquery.
6. Prefer NoQL constructs over raw MongoDB unless the user explicitly asks for the compiled MongoDB shape.
7. Call out important caveats when relevant, especially unsupported `IN` sub-select joins, aggregate functions inside array sub-selects, ORDER BY projection requirements, and function aliases in `WHERE`.

## Common Patterns

Use backticks or single quotes for unusual field and collection names:

```sql
SELECT id, `First Name`, `Address.City` FROM customers
SELECT * FROM `customer-notes`
```

Use `UNSET(_id)` when the desired output should omit MongoDB `_id`:

```sql
SELECT id, name, UNSET(_id) FROM customers
```

Use join hints to control joined result shape:

```sql
SELECT c.id, cn.notes AS note, UNSET(_id)
FROM customers c
LEFT OUTER JOIN 'customer-notes' 'cn|first' ON cn.id = TO_INT(c.id)
```

Use array sub-selects for filtering or projecting embedded arrays:

```sql
SELECT id, (SELECT filmId AS `$$ROOT` FROM Rentals WHERE staffId = 2) AS films
FROM customers
```

## Reference

Read `references/noql-reference.md` for the full syntax guide, including:

- API usage with `SQLParser.parseSQL`
- quoting and aliasing rules
- SELECT, WHERE, GROUP BY, ORDER BY, LIMIT, OFFSET
- joins and join hints
- array, object, conversion, string, date, math, and window functions
- UNION, PIVOT, UNPIVOT, subqueries, and caveats

Use `references/noql-docs-search-index.json` as an exhaustive official-docs lookup cache downloaded from `https://noql.synatic.dev/search/search_index.json`.
