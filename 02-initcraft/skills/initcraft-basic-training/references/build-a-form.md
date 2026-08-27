# Build Your First Form — initCraft Form Factory

A click-by-click lesson: build a working Leave Request form in initCraft's Form Factory, end to end, ready to teach to someone else.

Source: `C:\Users\marni\Downloads\1 - Build a Form.html`

Field Manual · Lesson 2 of 2 · Form Factory

# Build Your First Form

One real form, start to finish — a Leave Request form with a live calculation — built in an order you can hand straight to someone else.

**Builds on:**
Basic Training
**Example:**
Leave Request
**Time:**
~30 min
Steps

- 1Plan the fields
- 2Create the form
- 3Lay out the canvas
- 4Add the fields
- 5Wire the calculation
- 6Set form options
- 7Preview & test
- 8Enable & place it
- 9Teaching checklist

## What we're building

A Leave Request form: an employee enters a leave type and date range, the number of days is calculated automatically, and a reason field is optional. Small enough to build in one sitting, real enough to show every core idea in Form Factory — fields, variable names, an event, and publishing.

### Plan the fields — on paper, before you touch the builder

Five minutes here saves you from renaming things mid-build. A field's variable name is what everything else — SQL queries, API params, events — refers to later.

- Label
- Variable name
- Widget
- Notes
- Employee Name
- `employee_name`
- Text
- Required
- Leave Type
- `leave_type`
- Select
- Options: Annual, Sick, Personal — required
- Start Date
- `start_date`
- Date
- Required
- End Date
- `end_date`
- Date
- Required
- Days Requested
- `days_requested`
- Number
- Read-only, auto-calculated
- Reason
- `reason`
- Textarea
- Optional
- Variable names are what you'll type from memory in every event and query you write later. Pick plain, predictable names now (`start_date`, not `sd1`) — it is far cheaper to think for five minutes here than to hunt down every reference after a rename.
### Create the form shell

This is the one step that actually creates the database collection behind your form.

- Open Form Manage (also called Form Factory) from the main menu.
- Click New Form.
- Give it a real name — Leave Request, not `test` or `form1`. Whatever name it has when you first save is the name everyone will see it under later, and renaming a live form is far more disruptive than renaming a blank one.
- Save. This provisions a matching `zdata_leave_request` collection behind the scenes — you never touch it directly, but every field you add becomes a key in its documents.

### Lay out the canvas

Structure first, fields second — it's much easier to drop fields into a grid than to rearrange them after.

- From the Container panel, drag a Layout widget onto the blank canvas.
- Inside it, add two GridCol widgets side by side — this gives you a clean two-column form instead of one long single-file list of fields.
- You can always add a Card around a section later if the form grows (e.g. an "Approval" section) — no need to plan for that now.

### Add the fields, one at a time

Same rhythm for every field: drag it in, name it, label it, move on.

- From Basic Input, drag a Text widget into the left column.
- Click the field to select it — the Property panel opens on the right. Set Variable Name to `employee_name`, Label to "Employee Name", and toggle Required on.
- Repeat for Select (`leave_type`) — while it's selected, find the Options section in the Property panel and add three static options: Annual, Sick, Personal.
- Drag two Date widgets for `start_date` and `end_date`, both required.
- Drag a Textarea for `reason` — leave Required off.

- Clicking a field's label sometimes selects its parent grid column instead of the field itself. If the Property panel shows the wrong thing, click directly on the input box (not the label text) and try again.
### Wire the one piece of real logic: auto-calculate the days

This is the step that turns a static form into something that actually helps the person filling it in — and it's the part worth slowing down for when you're teaching this to someone else.

- Drag a Number widget for `days_requested`. In its Property panel, set it disabled by default — it should only ever be written by code, never typed into.
- Select the `end_date` field. In the Property panel, find its Field Event Handler and open the onChange event's code editor.
- Type the calculation below. It reads both dates straight off the reactive form model and writes the result back the same way.

```text
if (data.start_date && data.end_date) {
  const start = this.dayjs(data.start_date)
  const end = this.dayjs(data.end_date)
  const days = end.diff(start, 'day') + 1   // inclusive of both end dates

  if (days < 1) {
    this.notify('End date must be on or after the start date', 'warning')
    data.days_requested = null
  } else {
    data.days_requested = days
  }
}
```

- end_date.onChange Typing multi-line code with braces into the event editor can occasionally eat a keystroke mid-paste on some browsers — after typing, click elsewhere and reopen the event to confirm the full snippet actually landed before moving on.
### Set the form's own options

A few settings that live on the form as a whole, not on any one field.

- Open Form Options (usually a toolbar button above the canvas, separate from any one field's Property panel).
- Confirm the Title shown to users matches what you want them to see — this can differ from the internal form name.
- If this form will ever be opened as a popup from somewhere else, set popup_size here now — it's the one place that controls it, and it's easy to forget later.
- Leave Sharing private to yourself for now — widen it in Step 8, once you've actually tested the form.

### Preview and test it like a real user would

Catch problems while the form is still private, not after you've announced it to the team.

- Click Preview in the builder toolbar. If nothing opens on the first click, click it again — it's a known flaky toggle on some builds.
- Fill in a start date and an end date and confirm Days Requested updates on its own.
- Try an end date before the start date — you should see the warning message, not a negative number.
- Submit once as a real test record, then go check it actually appears wherever this form's records are listed.

- You can fill the form in end-to-end, the calculation updates live, the bad-input case shows a warning instead of breaking, and one real record made it into storage.
### Enable it and put it somewhere people can find it

A working form nobody can reach is just a draft.

- Flip the form's Enable toggle on.
- Widen Sharing to whoever should be able to submit a leave request.
- Add it to a menu (via App Factory / the sidebar menu config) so people can navigate to it directly, or embed an "Apply for Leave" button elsewhere that opens it with `openForm('leave_request_form_id')`.
- Double check the form's name one more time before you walk away — if you cloned this from anything, this is the last easy moment to rename it before people start bookmarking it.

## Teaching this to someone else

A suggested run of order, if you're the one demoing this next.

**0–2 min:**
Show the finished form working — fill it in live, let them see the date calculation happen before any explanation. The hook is the "it does the math for me" moment, not the widget palette.
**2–8 min:**
Plan a different small form together on paper (Step 1) — label, variable name, widget, required — before opening the builder at all.
**8–18 min:**
You build the first field live, narrating each Property panel setting. Then hand them the mouse for the second and third fields.
**18–25 min:**
Wire one event together — even a simple one, like disabling a field until another is filled in. This is where "form builder" clicks into "I can make this do things."
**25–30 min:**
Preview, break it on purpose (bad input), fix it, enable it.
### Mistakes to flag before they happen

- Naming fields as they go instead of planning variable names first — leads to a rename hunt later.
- Forgetting to mark the calculated field read-only, so a user can type over it and "break" the math.
- Widening Sharing before the form has actually been tested end-to-end.
- Leaving the form named `test`/`form1`/"... clone" after enabling it for real use.
