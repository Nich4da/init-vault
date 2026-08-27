# Query Your Data — initCraft SQL Factory

A click-by-click lesson: build a working 'My Leave History' query in initCraft's SQL Factory against the Leave Request form from Lesson 2.

Source: `C:\Users\marni\Downloads\2 - Build a Query.html`

Field Manual · Lesson 3 · SQL Factory

# Query Your Data

Reusing the Leave Request form from Lesson 2 — build a real "My Leave History" query, end to end, ready to hand to someone else.

**Builds on:**
Build a Form (L2)
**Example:**
My Leave History
**Time:**
~25 min
Steps

- 1Plan the query
- 2Create the query shell
- 3Choose your columns
- 4Filter with WHERE
- 5Sort the results
- 6Test in the builder
- 7Copy the ID & call it from code
- 8Put it to work
- 9Teaching checklist

## What we're building

Back in Lesson 2 you built a Leave Request form, which quietly created a `zdata_leave_request` collection behind the scenes. Now we'll build My Leave History — a SQL Factory query that lists one employee's leave requests, most recent first, excluding drafts and deleted records. It's small on purpose: every idea in it — parameters, the status filter, the ID lookup — is the same idea you'll reach for in a query with twenty columns and four joins.

### Plan the query — before you open the builder

A query has the same "decide it on paper first" step a form does. Here it's not fields, it's columns, filters, and sort order.

- Decision
- Value
- From (source form)
- Leave Request
- Columns to return
- `employee_name`, `leave_type`, `start_date`, `end_date`, `days_requested`
- Filter parameter
- `:employee_name` — required
- Always-on filter
- `xrstatx NOT IN (0,3)` — hide drafts & deleted rows
- Sort
- `start_date` descending — newest first
- Every field you listed while planning the form in Lesson 2 is exactly what you'll pick from here — the query builder reads the same field list, because "From" a query is really "from" a form.
### Create the query shell

One setting here — the "From" form — decides everything the query can possibly see.

- Open SQL Factory from the main menu.
- Click New Query.
- Name it clearly — My Leave History, not `query1` or "leave clone". The display name is only for humans; the platform will refer to this query by its ID everywhere else, but a clear name is what keeps the query list navigable a year from now.
- Set From to the Leave Request form you built in Lesson 2. This is what maps the query onto `zdata_leave_request` without you ever typing a collection name.

### Choose your columns

SQL Factory is a visual builder, not a text editor — you pick fields from a list, you don't type `SELECT`.

- In the Select / columns panel, a chip-picker lists every real field on the Leave Request form.
- Add `employee_name`, `leave_type`, `start_date`, `end_date`, and `days_requested`.
- You don't need to add `xrstatx` here to filter on it in the next step — it exists on every record whether or not it's a selected output column.

### Filter with WHERE — and always think in parameters

One rule matters more than any other in this step: a value the caller supplies is always a named parameter, never text you paste into the condition.

```text
employee_name = :employee_name
AND xrstatx NOT IN (0, 3)
```

- Type the condition above into the Where field of the builder.
- `:employee_name` is a placeholder — the builder turns it into a required input parameter automatically. Whatever calls this query later must supply it by that exact name.

- Skip `xrstatx NOT IN (0, 3)` and drafts (`0`) and soft-deleted records (`3`) quietly reappear in the results — no error, just wrong-looking data that's hard to explain. Add this filter to every query you build, as a habit, not a special case. Filtering on an ID field (like an employee's `_id` rather than their name) needs an explicit conversion, because parameters arrive as plain strings: `CONVERT(:employee_id, 'objectId')`.
### Sort the results

Small step, easy to forget — an unsorted list reorders itself unpredictably as records are edited.

- In the Order By section, add `start_date` and set it to descending, so the most recent leave request shows first.

### Test it right there in the builder

Catch a broken filter here, where fixing it is a one-line edit — not after it's wired into a form.

- Use the builder's Run / preview action and supply a real `employee_name` value that you know has leave requests.
- Confirm the rows come back sorted newest-first, and that a draft or deleted record you know about does not appear.
- Now test the case nobody tests: supply a name with no leave requests at all. You should get an empty list back, not an error.

### Copy the query's real ID, then call it from code

This is the step almost everyone trips on the first time: a query is called by its database ID, never by the name you gave it in Step 2.

- Save the query, then find its ID wherever your build surfaces it — an ID column in the SQL Factory list, or visible in the address bar while the query is open for editing.
- Copy that ID somewhere safe (a comment near where you'll use it is fine) — you'll paste it as `sqlId`, not the query's display name.

```text
const result = await app.runSql(
  'all',                                  // 'one' for a single row, 'all' for a list
  '<paste the query's ObjectId here>',
  { employee_name: params.employee_name },
  userInfo
)
// result.data — the array of rows. No .reply wrapper on runSql.
```

- Calling it — e.g. from an API Factory process Passing the query's name (`"My Leave History"`) instead of its ID compiles fine and fails silently at runtime — `{ success: false, data: null }`, no error thrown to tell you why. If a query mysteriously returns nothing, check this first.
### Put it to work

A tested query sitting in SQL Factory isn't useful until something actually calls it. Two ordinary destinations:

- A read-only list on a form or dashboard — add a Data Grid SQL widget, set its `sqlId` to this query, and it renders the rows directly. No code required for the simple case.
- Business logic in an API Factory process — call `app.runSql(...)` exactly as in Step 7, e.g. inside a "get my leave balance" process that also does some math on the returned rows before responding.

- You can hand someone an employee's name and get back their leave history, sorted, with drafts and deleted records already excluded — from a Data Grid, from an API call, or both.

## Teaching this to someone else

A suggested run of order, if you're the one demoing this next.

**0–3 min:**
Run the finished query live with a real employee name — let them see a real list come back before any explanation of how the builder works.
**3–8 min:**
Point out that "From" is just the form they already know from Lesson 2 — the query builder isn't a new data source, it's a new way of looking at one they've already built.
**8–15 min:**
Build the Select and Where together, narrating the parameter placeholder as you type it — this is the one syntax idea (`:name`) that carries into every query they'll ever write here.
**15–20 min:**
Test the empty-result case together on purpose, so "no rows back" reads as normal, not broken.
**20–25 min:**
Copy the real ID, and actually call it from a small API process or drop it into a Data Grid SQL widget so the query does something visible.
### Mistakes to flag before they happen

- Passing the query's display name instead of its ObjectId into `runSql` — fails silently.
- Forgetting `xrstatx NOT IN (0,3)`, so drafts and deleted rows resurface in results.
- Pasting a value straight into the Where clause instead of using a `:param` placeholder.
- Only testing with a name known to have results — never checking the empty case.
- Reading `result.reply.data` out of habit — that shape belongs to `dbFindAll`, not `runSql`, which returns `result.data` directly.
