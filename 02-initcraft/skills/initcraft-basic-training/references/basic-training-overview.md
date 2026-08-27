# initCraft Basic Training — Form, SQL & API Factory

A blueprint-style primer on initCraft's three core factories: build a Form, query it with SQL Factory, and orchestrate it with API Factory.

Source: `C:\Users\marni\Downloads\0 - Basic Training Overview.html`

Field Manual · Low-Code Platform

# initCraft Basic Training

How the three factories fit together: a form that collects data, an API that decides what to do with it, and SQL that finds it again.

**Platform:**
softmax-one.com
**Scope:**
Form · SQL · API
**Level:**
Basic / Onboarding
Contents

- 00How the pieces fit
- 01Form Factory
- 02SQL Factory
- 03API Factory
- 04Worked example
- 05Cheat sheet

## 00 How the pieces fit

Three builders, one document. Everything you build lives in a MongoDB collection prefixed `zdata_*`, one per form.

A Form is what a person fills in. An API Process is server-side JavaScript that runs when something needs deciding — validate this, calculate that, write over there. A SQL query is how anything (a form, a grid, an API) reads data back out. Most real features touch all three: the form collects input, an API process does the thinking, and a SQL query supplies the lookups along the way.

Station 01

#### Form Factory

Person fills in fields. Form data lives in `data.*`.

Station 03

#### API Factory

`Process(params, userInfo)` runs the business logic.

Station 02

#### SQL Factory

Looks up or aggregates data from any `zdata_*` collection.

The stations are numbered by build order below (Form, then SQL, then API) because that's the order a beginner usually learns them — not the order data flows at runtime, which is the arrow above.

## 01 Form Factory SDForm

The drag-and-drop builder. Every form is a tree of widgets bound to a reactive data model.

### Widgets

84 widgets across five groups: Basic Input (Text, Number, Select, Date…), Advanced Input (SelectBySQL, SelectByForm, FileUpload, CodeEditor…), Display (StaticText, Content, DataGridForm, ListView, Charts…), Container (Layout, Tab, Table, SubForm…), and one special widget for custom Vue templates. Start with Basic Input — everything else layers on top once the plain fields work.

### The data model

Every field lives on a single reactive object. Inside any field event, `data.fieldName` reads or writes it directly — this is almost always simpler than the getter/setter methods below.

```text
// inside a field's onChange
data.total = data.quantity * data.unit_price
```

### Field events, in the order they fire

- Event
- Fires when
- `onCreated`
- Field instance created, before mount
- `onMounted`
- Field is in the DOM
- `onChange(value, oldValue)`
- User changes the value
- `onValidate(rule, value, cb)`
- Form validation runs
### Field functions — `this.*`

```text
this.setValue(v)          this.getValue()
this.hide()  this.show()  this.disabled()  this.enable()
this.setRequired(true, 'This field is required')
this.notify('Saved', 'success')
await this.confirm('Delete this row?')   // → boolean
```

### Form functions — `this.getFormRef().*`

Grab the whole form from inside any field event with `const f = this.getFormRef()`:

```text
const f = this.getFormRef()
f.getFormData()                 // whole form as an object
f.setFieldValue('status', 'approved')
f.hideField('discount')  f.showField('discount')
f.submitForm()                  // validates, then saves
```

### Opening another form — `openForm()`

Use this for "view detail," "pick a related record," or any popup that isn't part of the current form's own layout.

```text
await f.openForm(orderFormId)                     // new record
await f.openForm(orderFormId, existingId)         // edit existing
await f.openForm(orderFormId, null, null, { status: 'draft' })  // pre-filled
```

## 02 SQL Factory Query Layer

A visual query builder, not a text editor — "From" is always a Form, which maps to that form's `zdata_*` collection underneath.

### Building a query

Pick a source form, choose columns, add a `WHERE`, join to another form if needed. Parameters in the WHERE clause use `:param_name` — never string-concatenate a value into the query.

```text
-- WHERE clause in the builder
status = :status AND xrstatx NOT IN (0, 3)
```

### Running it from code

```text
const result = await app.runSql('all', sqlFactoryRecordId, { status: 'approved' }, userInfo)
// result.data — the rows. No .reply wrapper here.
```

### Turning an ObjectId param into a real ObjectId

```text
CONVERT(:customer_id, 'objectId')
```

### result.data vs. result.reply.data

The two main read paths return shapes differently — this trips people up constantly:

- Call
- Rows are at
- `app.runSql(...)`
- `result.data`
- `app.dbFindAll(...)`
- `result.reply.data`
## 03 API Factory Process

Server-side JavaScript with one job: decide what happens. Every API Process shares the same signature.

```text
async function Process(params, userInfo) {
  // params   — input from the caller (form, another API, or raw HTTP)
  // userInfo — { username, account, roles, site, unit }
  return { success: true, data: result }
}
```

### The three return shapes

- Shape
- Use when
- `{ success: true, data }`
- Normal response to a direct call
- `{ success: false, message }`
- Something failed — the caller should show `message`
- `{ xformDatax: { field: value } }`
- Only inside a form event (on save/insert/update) — merges values straight back into the saved document
### Calling a query from inside a Process

```text
async function Process(params, userInfo) {
  const price = await app.runSql('one', priceSqlId, { sku: String(params.sku) }, userInfo)
  if (!price.success || !price.data) {
    return { success: false, message: 'SKU not found' }
  }
  return { xformDatax: { unit_price: price.data.price } }
}
```

### Calling an API Process from a form

```text
const api = this.getFormRef().userState   // handles auth for you
const result = await api.runProcess(processId, { sku: data.sku })
```

### Calling one API Process from another

```text
const sub = await app.subProcess(otherProcessId, { orderId: params._id }, userInfo)
if (!sub.success) throw new Error(sub.message)
```

## 04 Worked example

A "New Order" form where picking a SKU auto-fills the unit price — all three stations, one flow.

- Form The sku field's `onChange` calls an API Process, passing the SKU the user picked.
- API The Process receives `params.sku`, casts it to a string, and calls SQL Factory to look up the price.
- SQL A query on the Products form returns the matching row filtered by `xrstatx NOT IN (0,3)`.
- API The Process returns `{ success: true, data: { price } }` — this is a direct call from a field event, not a form-save event, so `xformDatax` does not apply here.
- Form The field event writes the price straight into the form: `data.unit_price = result.data.data.price`.

```text
const api = this.getFormRef().userState
const result = await api.runProcess(lookupPriceProcessId, { sku: value })
if (result?.data?.success) {
  data.unit_price = result.data.data.price
  data.total = data.unit_price * (data.quantity || 1)
} else {
  this.notify('Price not found for this SKU', 'warning')
}
```

```text
async function Process(params, userInfo) {
  const sku = String(params.sku || '')
  if (!sku) return { success: false, message: 'sku is required' }

  const found = await app.runSql('one', productPriceSqlId, { sku }, userInfo)
  if (!found.success || !found.data) {
    return { success: false, message: 'SKU not found' }
  }
  return { success: true, data: { price: found.data.price } }
}
```

## 05 Cheat sheet

The mistakes that cost the most time when you're new to this.

- Station
- Instead of
- Do this
- Form
- `setFieldValue` on a display-only widget (Components, Content, StaticText)
- `getFieldRef(name).vueData.key = value`
- Form
- Expecting `openForm` options to control popup width
- Set `popup_size` on the target form itself
- SQL
- `sqlId: 'my_query_name'`
- `sqlId: '<ObjectId from module_sql>'`
- SQL
- Querying without a status filter
- Always add `xrstatx NOT IN (0,3)`
- SQL
- Reading `result.reply.data` from `runSql`
- `runSql` → `result.data`; `dbFindAll` → `result.reply.data`
- API
- `return { bmi: 25.5 }` from a form-event API
- `return { xformDatax: { bmi: 25.5 } }`
- API
- Trusting `params.quantity` is a number
- `Number(params.quantity)` — form params always arrive as strings
- API
- String-building SQL from a variable
- `:param_name` placeholders, always
