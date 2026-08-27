# Wire the Logic — initCraft API Factory

A click-by-click lesson: build a Check Leave Balance API process that queries the SQL Factory query from Lesson 3 and wires back into the Leave Request form from Lesson 2.

Source: `C:\Users\marni\Downloads\3 - Build a Process.html`

Field Manual · Lesson 4 · API Factory

# Wire the Logic

The piece that ties it together — an API process that checks a real leave balance, using the query from Lesson 3, called live from the form in Lesson 2.

**Builds on:**
Query Your Data (L3)
**Example:**
Check Leave Balance
**Time:**
~30 min
Steps

- 1Plan the process
- 2Create the process shell
- 3Validate the params
- 4Call SQL Factory
- 5Decide & return
- 6Test it in isolation
- 7Wire it into the form
- 8Publish it
- 9Teaching checklist

## What we're building

The Leave Request form calculates days requested right in the browser — helpful, but it's not a real check, it's just arithmetic on two dates. Check Leave Balance is the API process that does the check that actually matters: how many days of this leave type has this employee already used this year, and does this new request fit inside the policy limit? It reuses the My Leave History query from Lesson 3 to find out, and hands the answer straight back to the form.

### Plan the process — before you open the builder

Same discipline as the last two lessons: decide the shape of the thing before you start typing code into it.

- Decision
- Value
- Name
- Check Leave Balance
- Called from
- The Leave Request form's `end_date.onChange` event — a direct call, not a form-save event
- Params in
- `employee_name`, `leave_type`, `days_requested`
- Calls out to
- My Leave History (SQL Factory, Lesson 3)
- Returns
- `{ success: true, data: { remaining } }` or `{ success: false, message }`
- `xformDatax` is for processes wired to a form's save/insert/update event — it merges values back into a document that was just written. This process is called mid-edit, before anything is saved, so it just returns a plain result and the field event itself decides what to do with it.
### Create the process shell

Every API Factory process starts from the same scaffold — you're filling in one function body.

- Open API Factory from the main menu.
- Click New Process.
- Name it Check Leave Balance — specific and readable, since like SQL Factory queries, this will be called elsewhere by its ID, not its name.
- The editor scaffolds `Process(params, userInfo)` for you — everything you write goes inside that function.

### Validate and cast the incoming params

Whatever calls this — the form, in our case — sends params as strings. Trusting a type without casting is the single most common silent bug in a first API process.

```text
const employeeName = String(params.employee_name || '')
const leaveType = String(params.leave_type || '')
const requested = Number(params.days_requested)

if (!employeeName || !leaveType || !requested) {
  return { success: false, message: 'employee_name, leave_type, and days_requested are all required' }
}
```

### Call SQL Factory to find out what's already been used

This is the one line that connects this lesson to the last one.

```text
const POLICY_LIMIT = { Annual: 10, Sick: 30, Personal: 5 }
const limit = POLICY_LIMIT[leaveType]
if (!limit) {
  return { success: false, message: `Unknown leave type: ${leaveType}` }
}

const history = await app.runSql(
  'all',
  '<paste My Leave History's ObjectId from Lesson 3 here>',
  { employee_name: employeeName },
  userInfo
)

const usedDays = (history.data || [])
  .filter(row => row.leave_type === leaveType)
  .reduce((sum, row) => sum + (row.days_requested || 0), 0)
```

- Notice this doesn't re-implement the filter — it calls the same query a Data Grid or another process would call, and just does a little math on what comes back. One query, many callers, is the point of building it as its own SQL Factory record in Lesson 3.
### Decide, and return one of the two shapes

Every path through the function ends in exactly one of these two returns — never a bare value, never nothing.

```text
const remaining = limit - usedDays

if (requested > remaining) {
  return { success: false, message: `Only ${remaining} day(s) of ${leaveType} leave remaining this year.` }
}

return { success: true, data: { remaining: remaining - requested } }
```

### Test it in isolation, before anything calls it

A process is much easier to debug on its own than through a form field that's also doing three other things.

- Use API Factory's own Run / test panel and supply sample params by hand — an employee name you know has history, a valid `leave_type`, and a small `days_requested`.
- Confirm you get `{ success: true, data: { remaining } }` back with a sensible number.
- Now test the rejection path on purpose — set `days_requested` higher than the policy limit and confirm you get the `success: false` message, not a crash.
- Test an employee with no leave history at all — `usedDays` should just come out `0`, not an error.

### Wire it into the form

Extend the calculation you wrote in Lesson 2 — the date math stays, one API call is added after it.

```text
if (data.start_date && data.end_date) {
  const start = this.dayjs(data.start_date)
  const end = this.dayjs(data.end_date)
  const days = end.diff(start, 'day') + 1

  if (days < 1) {
    this.notify('End date must be on or after the start date', 'warning')
    data.days_requested = null
    return
  }
  data.days_requested = days

  const api = this.getFormRef().userState
  const check = await api.runProcess(checkLeaveBalanceProcessId, {
    employee_name: data.employee_name,
    leave_type: data.leave_type,
    days_requested: days
  })

  if (check?.data?.success) {
    this.notify(`Approved — ${check.data.data.remaining} day(s) will remain after this request`, 'success')
  } else {
    this.notify(check?.data?.message || 'Could not verify leave balance', 'warning')
  }
}
```

```text
const token = api.user.token
const res = await globalThis.fetch(apiHost + '/v1/process/' + checkLeaveBalanceProcessId, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ params: { employee_name: data.employee_name, leave_type: data.leave_type, days_requested: days } })
})
const outcome = (await res.json()).data   // same { success, data/message } shape
```

- end_date.onChange — extended from Lesson 2 Calling `api.runProcess(...)` from inside a field's `onChange` has been observed, on at least one build, to resolve to `undefined` even though the process ran successfully on the server. If your `check` variable is consistently empty despite the process clearly working when tested in isolation (Step 6), fall back to an authenticated raw call:
### Publish it

The last few settings, easy to skip because nothing visibly breaks if you do.

- Enable the process.
- Note its ID somewhere next to the form event that calls it — you now have two IDs to keep track of (this process, and the SQL query it calls), and both are silent failures if mistyped.
- If your tenant restricts APIs per role, decide deliberately whether Check Leave Balance needs that — per-record API permissions exist but are easy to leave blank without noticing, which quietly means "anyone who can reach it, can call it."

## Teaching this to someone else

By this lesson, your audience has seen a form and a query — this is where it clicks that the three factories were never separate tools.

**0–3 min:**
Trigger the real flow live: pick dates in the form, watch the notify pop up with a real remaining-balance number. Then ask "where did that number come from?" — the answer is the whole lesson.
**3–10 min:**
Open the process and read `Process(params, userInfo)` together — same signature, every single time, no matter what the process does.
**10–18 min:**
Trace the one line that calls `app.runSql` back to the exact query built in Lesson 3. This is the moment to say out loud: the query didn't get rebuilt, it got reused.
**18–24 min:**
Test the rejection path together, on purpose, before wiring it anywhere — cheaper to fix a bad policy number here than after a form is calling it.
**24–30 min:**
Wire it into the field event and watch a real end-to-end request get checked, live.
### Mistakes to flag before they happen

- Trusting `params.days_requested` as a number without `Number(...)` — it arrives as a string.
- Expecting `xformDatax` to work here — it only applies to processes wired to a form's save event, not a field's `onChange`.
- Passing the SQL query's display name instead of its ObjectId into `app.runSql` — the same mistake from Lesson 3, now one layer deeper.
- Never testing the "no leave history yet" case — a new employee should get `usedDays = 0`, not a broken query.
- Treating the browser-side day count from Lesson 2 as the real answer — it's UX help; this process is the actual check, and it's the one that has to be right.
