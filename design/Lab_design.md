# LAB Workbench Design and Functional Specification

สถานะเอกสาร: implementation baseline จาก mockup ที่ผู้ใช้ตรวจทานแล้ว

อัปเดต: 2026-08-30

หน้าต้นแบบ: `../02-his/ui/lab-workbench-stock-pattern-mockup.html`

ขอบเขต: Desktop-first one-page LAB workbench สำหรับรับ specimen, ปฏิเสธ/ยกเลิก, ดูและลงผล Manual, ติดตามผลบางส่วน/ผลครบ และค้นคืนผล

> เอกสารนี้เป็นสเปก UI/interaction และ business-state สำหรับเริ่มสร้าง SDForm ไม่ใช่หลักฐานว่า integration พร้อม production ค่าผล หน่วย Ref. Range ชื่อบุคคล และจำนวนรายการใน HTML เป็น mock เท่านั้น ห้าม hard-code ลงระบบจริง

## 1. Visual Theme & Atmosphere

- ทิศทางหลัก: dense clinical worklist ที่สงบ อ่านเร็ว และรองรับข้อมูลจำนวนมาก โดยใช้ pattern แบบ Element Plus/Drug & Stock ที่ผู้ใช้ยืนยัน
- หน้าเดียว ไม่มี sidebar และไม่มี top-level tab แยกหน้ารอรับ/รับแล้ว/ออกผล
- ใช้พื้นขาว เส้นแบ่งเทาอ่อน สีสถานะเป็น pastel tint และใช้สีน้ำเงินเฉพาะ action/focus/selection
- รายการ Order เป็นแถวหลักที่ขยายรายละเอียดด้านล่างได้ ข้อมูลเดิมต้องไม่ถูกลดหรือย้ายออกโดยไม่มี requirement ใหม่
- hierarchy ต้องชัดด้วยน้ำหนักตัวอักษร เส้นแบ่ง และพื้นที่—not card shadow จำนวนมาก
- พื้นผิวต้องดูเป็นระบบโรงพยาบาล: แม่นยำ ไม่ตกแต่งเกินจำเป็น ไม่มี gradient ไม่มี glass effect และไม่มี animation รบกวน
- Worklist ถูกกำหนดจาก organization/lab section ของผู้ใช้ที่ login; UI ไม่แสดงตัวเลือกห้อง LAB ให้ผู้ใช้เลือกเอง

## 2. Color

### 2.1 Binding color tokens

| Token | Value | Use |
|---|---:|---|
| `primary` | `#409eff` | primary action, active tab, focus, selection |
| `primary-50` | `#ecf5ff` | selected/hover tint, room tag, order number tag |
| `success` | `#67c23a` | success action |
| `success-50` | `#f0f9eb` | received/result-complete/payment tint |
| `success-200` | `#b3e19d` | success border |
| `warning` | `#e6a23c` | waiting/remark accent |
| `warning-50` | `#fdf6ec` | waiting/pending/coverage tint |
| `warning-200` | `#f3d19e` | warning border |
| `danger` | `#f56c6c` | destructive action/rejection |
| `danger-50` | `#fef0f0` | cancelled/rejected/urgent tint |
| `danger-200` | `#fab6b6` | danger border |
| `info` | `#909399` | neutral metadata |
| `ink` | `#303133` | headings, names, primary values |
| `text` | `#606266` | body text and controls |
| `muted` | `#909399` | labels and secondary information |
| `placeholder` | `#a8abb2` | empty/placeholder values |
| `border` | `#dcdfe6` | primary divider/control border |
| `border-light` | `#e4e7ed` | secondary divider |
| `border-lighter` | `#ebeef5` | table row/modal divider |
| `fill` | `#f5f7fa` | table group/status/filter surface |
| `fill-soft` | `#fafafa` | expanded detail/modal footer |
| `white` | `#ffffff` | page and control surface |
| `shadow` | `0 12px 32px rgba(31,35,41,.14)` | elevated dropdown/date surface |

### 2.2 Semantic mapping

| State/component | Border | Background | Text |
|---|---|---|---|
| รอรับ / รอผล / ออกผลบางส่วน | `warning-200` | `warning-50` | `#b88230` |
| รับแล้ว / ออกผลแล้ว / ออกผลครบ | `success-200` | `success-50` | `#529b2e` |
| ปฏิเสธ / ยกเลิก / เร่งด่วน | `danger-200` | `danger-50` | `#c45656` |
| Neutral/mixed | `#c8c9cc` | `#f4f4f5` | `#73767a` |
| Primary/selected | `#a0cfff` | `primary-50` | `#337ecc` |

Patient context pills:

- `ห้องที่ส่ง`: primary blue tint
- `ชำระเงินแล้ว`: success green tint
- `UC`: warning amber tint
- `เพศ`: neutral pill
- ทุก pill ใช้ปลายมน `999px`; `เร่งด่วน` คง tag ขนาดเล็กแบบมุม 4px

Filter chips keep a neutral `fill` surface. The count carries the semantic color; the selected chip adds the matching semantic border while its label remains muted. Do not turn all filter surfaces into saturated status blocks.

Critical value:

- รายการสรุประดับหน้า worklist แสดงเป็น text box สีเท่านั้น ไม่เพิ่มวงกลมตกแต่ง
- Popup ผลอาจแสดง marker เฉพาะเมื่อ contract ส่ง explicit critical decision เช่น `is_critical`, `LL`, `HH`, `AA`; HIS ห้ามคำนวณ critical จาก rule text เอง
- สีไม่ใช่สัญญาณเดียว: ต้องมีข้อความ/label สำหรับ accessibility

## 3. Typography

### 3.1 Font families

```css
--font: "Leelawadee UI", "Noto Sans Thai", "Tahoma", "Segoe UI", sans-serif;
--mono: "SFMono-Regular", "Roboto Mono", Consolas, monospace;
```

- Base body: `14px`, line-height `1.45`, color `#606266`
- H1: `25px`, line-height `1.25`, weight `700`; mobile `22px`
- Page subtitle: `12px`, muted
- Modal H2: `17px`
- Profile/group heading: `13px`
- Patient HN: weight `700`, mono for identifier
- Patient name: weight `650`
- Field label: `10px`, weight `650`, letter-spacing `.015em`
- Field value: `12px`, weight `650`
- Diagnosis summary: `10px`, weight `500`, one-line ellipsis with full text available through EMR/title
- Table heading: `11px`, weight `650`
- Status/tag: `11px`, weight `650`
- Small status/filter count: count `18px`; label `12px`
- Order No./urgent/gender compact text: `9px`
- Date, time, HN, VN, LN, Order No. and numeric result values use mono/tabular numerals
- Thai labels use sentence case; do not uppercase Thai or introduce all-caps headings except external identifiers

## 4. Spacing & Grid

### 4.1 Page and toolbar

- Page padding: `24px clamp(16px, 2.5vw, 40px) 48px`
- Header bottom margin: `20px`
- Toolbar columns: `minmax(230px,310px) minmax(250px,310px) auto auto minmax(24px,1fr) auto`
- Toolbar gap: `10px`; bottom margin `18px`
- Status filters: flex row, gap `8px`, bottom margin `18px`, horizontal scrolling when required

### 4.2 Worklist

- Outer shell: full width, horizontal scrolling, top/bottom 1px border
- Desktop worklist minimum width: `1390px`
- Order row minimum height: `84px`
- Order row padding: `10px 12px`; column gap `10px`
- Exact column pattern:

```css
34px
minmax(205px,1.55fr)
minmax(170px,1.18fr)
92px
100px
144px
112px
minmax(140px,1fr)
92px
62px
62px
62px
```

Column order: expand, patient, context pills, item count, specimen count, order time/order no., status time, doctor/diagnosis, order status, PDF/detail action, result/cancel action, EMR.

### 4.3 Expanded detail

- Panel padding: `0 16px 18px 46px`; soft fill background
- Detail header minimum height `48px`; tab gap `20px`
- Detail tab height `48px`; active underline `2px`
- Bulk action gap `8px`; align right
- Summary minimum height `46px`; gap `20px`
- Specimen table minimum width `1340px`
- Standard detail table minimum width `990px`
- Table heading height `36px`; padding `6px 10px`
- Table row cell height `52px`; padding `7px 10px`

### 4.4 Dialog and responsive behavior

- Dialog width `min(1040px, calc(100vw - 32px))`
- Dialog max height `calc(100vh - 40px)`; radius `10px`
- Modal head `15px 18px`; body `18px`; footer `12px 18px`
- Result table minimum width `940px`; horizontal scroll inside dialog
- Breakpoint `980px`: toolbar becomes 4-column responsive grid; create button moves to its own row
- Breakpoint `680px`: page padding `18px 12px 36px`; search/date full row; create button full width; calendar shows one month; detail actions wrap; modal body padding `10px`
- Dense worklist remains horizontally scrollable on narrow view; do not squeeze clinical columns into unreadable cards

## 5. Layout & Composition

### 5.1 Page hierarchy

1. Page title and short description
2. Search, Date Range, Search, Report and Create controls
3. Four filter chips
4. Expandable Order worklist
5. Implementation remark panel in prototype/documentation context only
6. Dialog layers for results, save confirmation, rejection, cancellation detail and retest confirmation

### 5.2 Order summary content

Every Order retains:

- HN, patient name, gender and age
- Urgent indicator when applicable
- ห้องที่ส่ง, payment status and coverage
- Test/item count and specimen count
- เวลาสั่ง with colored Order No. pill
- Contextual status time: เวลารับ, เวลาออกผล or เวลายกเลิก
- Doctor name and truncated Diagnosis summary
- Order status
- PDF/context action, result/cancel action and EMR

EMR is available in every status. It exposes full patient/diagnosis detail but does not replace the concise Diagnosis line.

### 5.3 Order detail tabs

- `order`: specimen/test operations and history
- `ออกผล`: result list and result actions
- `ออกผล` is available as soon as the Order is listed, even when every Item is still waiting and has no result
- The `order` tab has no result-action column. The `ออกผล` tab lists every active LAB Item with a waiting `ดูผล` button
- `ดูผล` may open a no-result popup before receipt; the pencil becomes available after receipt and switches the result, Unit, interpretation and reference-range fields into edit mode
- `ค่าก่อนหน้า` remains readonly because it is the Item-level saved-result audit history
- Cancelling an Order replaces the detail with the cancelled-item view; it does not erase the original items

### 5.4 Specimen table columns

1. Checkbox
2. ลำดับ
3. Lab No.
4. รายการสั่งตรวจ
5. specimen searchable combobox
6. เวลาเก็บ specimen (date and time)
7. เวลารับ specimen (per test)
8. สถานะ
9. ปฏิเสธ (reason)
10. คนปฏิเสธ

### 5.5 Result list and result popup

Order detail result list contains: ลำดับ, test name, result time, result action, status and entry channel when needed.

Popup columns:

1. Sequence
2. Critical/normal semantic state
3. Result component name
4. Previous finalized value from the patient's prior Order
5. Current measured/manual value
6. Unit
7. Interpretation
8. Reference range

One test can produce multiple result component rows. Long text wraps and increases row height; it must never be truncated into a single-line result cell.

## 6. Components

### 6.1 Dimension contract

| Component | Binding size/style |
|---|---|
| Standard control/button | height `36px`, border `1px #dcdfe6`, radius `5px` |
| Standard button padding | horizontal `14px`, gap `7px`, weight `600` |
| Small button | height `30px`, horizontal padding `11px`, font `12px` |
| Plain row action | width `100%`, height `30px`, padding `0 7px`, font `11px` |
| Search input | height `36px`, padding `0 34px 0 35px`, search icon `16px` |
| Date Range trigger | height `36px`, padding `0 10px`, gap `9px` |
| Filter chip | padding `6px 12px`, radius `6px`, gap `6px` |
| Status/state tag | min-height `22px`, padding `1px 7px`, radius `4px` |
| Meta/context pill | min-height `23px`, padding `1px 9px`, radius `999px` |
| Gender pill | min-height `18px`, padding `0 7px`, radius `999px`, font `9px` |
| Urgent tag | min-height `18px`, padding `0 5px`, radius `4px`, font `9px` |
| Order No. pill | min-height `18px`, padding `0 6px`, radius `999px`, font `9px` |
| Checkbox | `15px × 15px`, primary accent |
| Specimen combobox | max-width `170px`, control height `36px` |
| Specimen toggle | `30px × 34px`, right segment of combobox |
| Specimen option | min-height `30px`, padding `4px 8px`, radius `4px` |
| Date popover | width `min(620px, calc(100vw - 32px))`, padding `14px`, radius `7px` |
| Calendar day | min-width/height `30px`, radius `4px` |
| Expand button | `28px × 30px`; icon `15px` |
| Result edit icon | `28px × 28px`; icon `15px`; radius `5px` |
| Modal close | `32px × 32px`; radius `5px` |
| Result editor | width `100%`, min-height `32px`, padding `6px 8px`, radius `4px` |
| Reject select | height `38px`, padding `0 10px`, radius `5px` |
| Reject/long-text textarea | min-height `86px`, padding `9px 10px`, radius `5px`, vertical resize |
| Cancel detail box | padding `13px 14px`, radius `6px` |
| Toast | padding `10px 14px`, radius `6px`, max-width `560px` |

### 6.2 Button behavior

- Primary: filled blue
- Receive: green tinted outline/fill
- Reject/cancel: red tinted outline/fill
- Neutral actions: white with gray border
- Disabled buttons remain visible where the user needs to understand that the action exists, e.g. partial-result PDF
- `รับ specimen` is hidden when no pending test can be received
- `ปฏิเสธรายการที่เลือก` accepts exactly one pending item
- `ยกเลิก order` acts on every test under the Order
- `ตรวจใหม่` exists only on cancelled Orders and creates a linked new Order using current order time; Lab No. is generated only on receipt

### 6.3 Specimen combobox

- Editable search input plus dropdown toggle
- Search filters specimen names case-insensitively
- User must select a valid master option before receipt
- Dropdown renders above Order rows: menu z-index `120`; active Order z-index `60`
- After item receipt/rejection/cancellation, checkbox and specimen input are disabled and the selected/recorded value is preserved

### 6.4 Result editor

- Default popup is readonly and labels itself `โหมดดูอย่างเดียว`
- Pencil is available after specimen receipt and toggles edit mode on/off even when no result has arrived yet
- Edit mode changes result, Unit, interpretation and reference range to inputs according to schema/value length and reveals `บันทึกผล`; the Item-level previous value/audit remains readonly
- First Manual entry requires non-empty content
- Save uses an in-page confirmation dialog; do not depend on native browser confirmation
- Later corrections must require reason and create a new immutable revision; never overwrite prior values
- Values, units, reference ranges and interpretation come from API/master/result contract—not mock HTML

### 6.5 Accessibility

- Every input has visible label or `aria-label`
- Filter/tab selected state uses `aria-pressed`/`aria-selected`
- Result tabs remain keyboard/click accessible before results exist; the popup communicates waiting and pencil eligibility
- Focus-visible uses 2px primary outline with 2px offset
- Status cannot rely on color alone
- Provide a skip link to the worklist
- Respect `prefers-reduced-motion`

## 7. Motion & Interaction

- Standard transition duration: color/border/shadow `.15s`; press transform `.12s`; expand rotation `.16s`; toast `.18s`
- Button active state moves down `1px`; no bounce, scale or decorative motion
- Expanded Order rotates the chevron 90 degrees and reveals the detail panel
- Hover may tint action surfaces and table rows; status badges themselves are static information and do not behave as buttons
- Date Range is a two-month popup on desktop and one-month view on mobile; completed range filters immediately
- Search reacts on input and Enter; clear button resets query
- Exact HN search can retrieve all historical resulted Orders; explicit Date Range narrows the history
- Default date scope is the current day:
  - waiting → request time
  - received → receive time
  - partial/complete → result time
  - cancelled → cancellation time
- Result popup supports Order-level all-test view and test-level view
- Partial result view must include both completed components and `รอผล` rows
- Order PDF is an order-document action before final results; result PDF remains visible but disabled until every accepted test is complete
- EMR is available for every Order status

## 8. Voice & Brand

### 8.1 Binding Thai labels

- Page: `ห้องปฏิบัติการแลป`
- Search placeholder: `ค้นหา HN / VN / LN / ชื่อผู้ป่วย…`
- Date control: `Date Range`
- Filters: `ทั้งหมด`, `รอรับ / ออกผลบางส่วน`, `ออกผลครบ`, `ยกเลิก`
- Order actions: `รับ specimen`, `ปฏิเสธรายการที่เลือก`, `ยกเลิก order`
- Context action: `EMR`
- Result action: `ดูผล` for every active Item; Manual entry for every LAB section starts from the pencil inside the popup after receipt
- Result modes: `โหมดดูอย่างเดียว`, `โหมดแก้ไข`
- Result status: `รอผล`, `ออกผลแล้ว`, `ออกผลบางส่วน`, `ออกผลครบ`
- Cancellation actions: `ดู`, `ตรวจใหม่`
- Confirmation language must name the exact affected Order/test and consequence

### 8.2 Writing rules

- Use short operational language; one button = one action
- Distinguish `ปฏิเสธ item` from `ยกเลิก order`
- Distinguish `Order No.` from `Lab No.`
- Use `specimen` consistently until the product owner approves a Thai replacement
- Do not expose transport-only status as a new primary filter; surface Agent failures as actionable secondary alerts
- Error copy must say what failed and what the user can do next; do not show raw stack traces or secret identifiers

## 9. Anti-patterns

- Do not reintroduce multiple top-level tabs or a manual lab-room selector
- Do not remove existing patient, order, specimen, doctor, diagnosis, time, payment or coverage data to make the layout cleaner
- Do not hard-code user name, organization, lab section, result value, unit, reference range, critical threshold or Test Master mapping
- Do not treat test code, result component code, specimen code, TMLT and HIS master ID as interchangeable
- Do not create Lab No. before the agreed receipt event
- Do not mark an Order complete from “some result exists”; use the required-component contract and exclude rejected items
- Do not let item rejection delete the item history
- Do not silently overwrite Manual results with later LIS results or overwrite corrected results
- Do not silently retry authentication/configuration/data errors
- Do not infer criticality from low/high rule text alone
- Do not enable final-result PDF before all accepted tests are complete
- Do not use native browser confirmation for essential save/reject/cancel flows
- Do not allow dropdowns to render underneath adjacent Order rows
- Do not truncate long result text or squeeze the worklist into unreadable mobile cards
- Do not use patient/production data in mockups or tests

---

# Appendix A — Functional State Contract

## A.1 Primary filter mapping

| Main filter | Included Order states |
|---|---|
| ทั้งหมด | Current date scope across every state, plus search exceptions |
| รอรับ / ออกผลบางส่วน | waiting, partially received, received-awaiting-result and result-partial |
| ออกผลครบ | result-complete |
| ยกเลิก | whole-Order cancelled only |

The filter label remains as approved even though its internal `active` bucket includes received-awaiting-result Orders.

## A.2 Receipt and rejection

1. Physician Order creates `order_no` and starts in `waiting`.
2. User selects one or more waiting tests.
3. `รับ specimen` generates Lab No. on first receipt, records per-test receipt time and actor, and preserves the same Lab No. for later receipts under that Order. Physical receipt must not be blocked by fields used only for Agent submission. If collection time is missing, keep it empty and mark transport as `awaiting_collection`; if fields such as priority, test code, or specimen code are missing, mark transport as `awaiting_outbound_data`. Wait for the ordering source to provide the real values before transmission; never substitute receive time for collection time.
4. Item rejection is one test at a time, uses the LAB-section reason master, and records reason/detail/actor/time.
5. Rejected items remain under the Order but do not count as pending result or complete-result requirements.
6. Whole-Order cancellation cancels all tests, records reason/actor/time and moves the Order to `ยกเลิก`.
7. Retest preserves the cancelled Order, creates a linked Order with a new Order No. and current request time, and waits to create Lab No. until receipt.

## A.3 Result channel

| `result_entry_mode` | Behavior |
|---|---|
| `machine` | Show `ดูผล` before receipt; after receipt, authorized UAT/downtime Manual entry is reached through the pencil while Agent/LIS remains the normal source |
| `manual` | Show `ดูผล`; after specimen receipt the pencil can enter the Manual result and the Item stays `รับแล้ว/รอผล` until saved |
| `fallback` | Show `ดูผล`; after receipt Manual entry is reached through the pencil and remains distinguishable from later LIS data |

Snapshot on Order Item: `result_entry_mode`, `result_schema_id`, `unit_id`, `requires_verification`, master/version identity and routing context.

## A.4 Result aggregation

- zero resulted accepted tests → waiting/received-awaiting-result
- at least one resulted accepted test and at least one accepted test incomplete → result-partial
- every accepted test has every required component complete → result-complete
- rejected tests are excluded from the denominator but remain in audit history
- every inbound receipt is deduplicated by `result_uid`
- final/corrected reports append stages and versions; prior reports/items remain immutable
- Machine/LIS `reference_range` and explicit critical decision are displayed from the inbound result contract. HIS does not calculate criticality from the range/rule text. Manual-only ranges require an approved Lab master/rule and are not invented in the UI.

# Appendix B — Search and Date Rules

- Default lists show current-day events.
- Exact HN search retrieves every historical resulted Order for that HN.
- Date Range, when explicitly selected, narrows all searches including exact HN history.
- Searchable identifiers: HN, VN, Lab No., Order No. and patient name.
- Cancelled Orders use cancellation time; waiting uses request time; received uses receipt time; resulted uses result time.
- Timezone must be Thailand local or ISO 8601 with `+07:00`; never reinterpret UTC `Z` as local.

# Appendix C — Integration and Persistence Contract

- Keep Order, specimen/container, technical receipt, report and result item as distinct records.
- HIS → Agent order submission requires authentication, idempotent `order_no`, Lab No., non-empty items and explicit routing.
- Agent/LIS → HIS matches Lab No. and cross-checks Order/visit; unmatched data is retained as technical receipt but not clinically published.
- Persistence layers: append-only Technical Receipt → versioned Report → versioned Result Items.
- Server enforces organization/lab-section scope and action permission on every request.
- Audit actor comes from runtime identity, never display mock text.
- Production requires concurrency control so two users cannot receive/edit the same item using stale state.

# Appendix D — Open Decisions Before Backend Wiring

| ID | Decision required | Recommended baseline |
|---|---|---|
| D1 | Product requires immediate per-Item submission: each LAB section receives and sends only its selected Item(s), and a later Item under the same CPOE Order must be submitted when received | Agent contract must support idempotent Item append/transition under an existing `order_no` (for example an explicit Item/submission key). Current whole-Order deduplication by `order_no` would discard the later submission, so do not wire the button until Agent confirms the revised contract |
| D2 | Order label while some tests are received and others waiting | Keep in active filter and display progress such as `รอรับ · รับแล้ว 1/3` |
| D3 | Rejecting every item individually | Prevent rejection of the last unresolved item when no accepted test exists; require `ยกเลิก order` |
| D4 | Recollection of one rejected test | Confirm item-level `ตรวจใหม่` versus a new CPOE Order |
| D5 | `requires_verification=true` | Save without publishing until an authorized verifier confirms; do not add a new primary filter |
| D6 | LIS result after Manual fallback | Store a new receipt/version and require reconciliation; never auto-overwrite |
| D7 | Partial Order with result events on multiple dates | Include when any relevant result event falls in range; display the latest result time |
| D8 | Cancellation after Agent submission | Unsent: cancel locally; sent/no result: request LIS cancel; existing result: preserve cancel rejection |
| D9 | Code mappings and completeness | Agent/API must confirm order code, observation code, specimen code and required result components |

# Appendix E — Acceptance Checklist for the First SDForm

- [ ] One-page layout and all current Order summary fields are preserved
- [ ] Four filter chips match the contract and counts come from data, not mock constants
- [ ] Search and Date Range follow Appendix B
- [ ] Order rows expand/collapse and dropdowns render above adjacent rows
- [ ] Receipt uses checkboxes and records per-test receipt time
- [ ] Lab No. is absent before receipt and generated by the approved server flow
- [ ] Single-item rejection and whole-Order cancellation are distinct and audited
- [ ] Manual/machine/fallback behavior is driven by Order Item snapshot
- [ ] Result viewer renders multiple components, previous result and long text
- [ ] Result popup is readonly until pencil edit; save uses an in-page confirmation
- [ ] Partial/complete aggregation uses accepted tests and required components
- [ ] Partial PDF is visible-disabled; complete result PDF is enabled
- [ ] EMR is available in every Order state
- [ ] No production identifiers/results, credentials or environment secrets are embedded
- [ ] SDForm JSON passes the repository validator and is verified in Builder/Preview/runtime at the level required by the feature
