---
type: implementation-handoff
title: EMR History LAB Results — Production Implementation Handoff
created: 2026-10-26
updated: 2026-10-26
status: ready-for-local-implementation; live-write-not-authorized
canonical_mockup: 02-his/ui/emr-history-mlab-mycology-comparison-mockup.html
---

# EMR History LAB Results — Production Implementation Handoff

เอกสารนี้เป็น handoff สำหรับทีมพัฒนาให้สร้าง LAB History ใน EMR ตาม HTML ที่ผู้ใช้ยืนยันแล้ว โดยคงรายละเอียดด้าน layout, sticky, filter, field mapping, Report PDF, Sensitive result และสถานะผลตรวจไว้ครบถ้วน ห้ามใช้ข้อมูลตัวอย่างใน mockup เป็น clinical master หรือ production identifier.

## 1. คำสั่งสั้นสำหรับทีม

สร้าง **component เดียวที่ responsive ตาม container** และ inherit theme จาก EMR host:

- แสดง filter จริงเพียง 3 กลุ่ม: `ประเภทห้อง`, `จำนวนผลก่อนหน้า`, `เลือกครั้งตาม VN`.
- ไม่แสดงปุ่ม `V2/V4` และ `สว่าง/มืด`; ปุ่มเหล่านี้มีไว้เปรียบเทียบ mockup เท่านั้น.
- หนึ่ง Order เป็นหนึ่ง block: Order heading → column heading → Profile/Test rows → attachment rows.
- Sticky ซ้าย `รายการ`; sticky ขวา `ครั้งนี้`, `ค่าปกติ`, `แปลผล`; เฉพาะคอลัมน์ผลก่อนหน้าเลื่อนแนวนอน.
- Scroll ต้อง freestyle ระดับ pixel, ไม่มี snap/auto-align/pull-back และไม่มีเศษ header/value/border โผล่ใต้ sticky columns.
- Sensitive result แสดง `ยืนยันดูผล`; re-auth สำเร็จแล้วแทนปุ่มด้วยค่าผล **inline ใน cell เดิม**. ห้ามเปิด popup กลางแบบเดิม.
- `รายงานผล` เปิด Order PDF โดยใช้ Report Factory ID และ Result Report ID ที่ API ส่งมา; ห้ามสร้าง ID จาก room code หรือชื่อไฟล์ mockup.

## 2. Source of truth และขอบเขต

อ่านตามลำดับนี้เมื่อข้อมูลขัดกัน:

1. เอกสารนี้สำหรับ behavior production ที่ยืนยันแล้ว.
2. `02-his/ui/emr-history-mlab-mycology-comparison-mockup.html` สำหรับ geometry และ visual detail.
3. `02-initcraft/skills/emr-v2-ui/references/emr-history-lab-result-table.md` สำหรับ reusable interaction rules.
4. `02-his/handoff/emr-history-lab-xray-result-data-ui-handoff.md` สำหรับ live collections, joins, APIs, Report IDs และ security boundary.
5. `design/emr-history-lab-results-design-contract.md` และ `design/emr-history-lab-results-design.md` สำหรับ rationale.

สิ่งที่เอกสารนี้อนุญาตคือ local implementation/replacement package เท่านั้น ไม่ใช่การ Save/Publish live Form, API, Report หรือ SQL. ก่อน live mutation ต้องตรวจ `Owner/Created By` และถาม delivery mode ของ artifact นั้นอีกครั้ง.

## 3. Production UI เทียบกับ mockup

| Element | Production | Mockup only |
|---|---:|---:|
| Room/category tabs | ใช่ | ใช่ |
| จำนวนผลก่อนหน้า 1/5/10 | ใช่ | ใช่ |
| เลือก VN แบบหลายรายการ | ใช่ | ใช่ |
| V2/V4 segmented control | ไม่แสดง | ใช้ QA ความกว้าง |
| Light/Dark control | ไม่แสดง | ใช้ QA theme |
| ข้อความ `Mockup · ข้อมูลสังเคราะห์...` | ไม่แสดง | ใช่ |
| central full-result popup เดิม | ไม่ใช้ | อาจมี code fixture ค้างอยู่ |

V2 หมายถึง fixture container ประมาณ 650–820px; V4 หมายถึง fixture เต็มพื้นที่. Production คือ component เดียวที่ตอบสนองต่อ container width โดยไม่เปลี่ยน data semantics.

## 4. Component tree และ state ownership

```text
LabHistoryPanel
├─ LabHistoryToolbar
│  ├─ LabHistoryCountSelect
│  └─ LabVisitMultiSelect
├─ LabSectionTabs
└─ LabOrderBlock[]
   ├─ LabOrderHeader
   │  ├─ StatusBadge
   │  ├─ LabReportLink
   │  └─ LabOrderCollapseToggle
   ├─ LabComparisonViewport
   │  ├─ LabColumnHeader
   │  ├─ LabProfileRow[]
   │  └─ LabResultRow[]
   │     ├─ NarrativeResultCell
   │     └─ SensitiveResultControl
   └─ LabAttachmentRow[]
```

State ที่ต้องรักษาแยกกัน:

- `roomFilter`: tab ปัจจุบัน.
- `historyMode`: `count | visits`.
- `historyCount`: `1 | 5 | 10`; default `5`.
- `draftVisitIds` และ `appliedVisitIds`; cancel ไม่แก้ applied state.
- `collapsedOrderIds`; ทุก Order เริ่ม expanded และ collapse แยกกัน.
- `historyScrollLeftByOrder`; การ resize/theme/filter ที่ไม่เปลี่ยน Order identity ห้ามดึง scroll กลับไป snap เอง.
- `sensitiveDisclosureByCell`; scope ต้องผูกกับ identity ของ cell ไม่ใช่ Boolean ระดับทั้งหน้า.

## 5. Visual tokens

Font stack:

```css
font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB",
  "Microsoft YaHei", Arial, "Noto Sans Thai", sans-serif;
font-size: 14px;
line-height: 1.42;
```

### Light

| Token | Value |
|---|---|
| page | `#f5f7fa` |
| surface | `#ffffff` |
| surface-2 | `#fafafa` |
| line | `#dcdfe6` |
| line-strong | `#c0c4cc` |
| dash | `#e4e7ed` |
| text | `#303133` |
| regular | `#606266` |
| muted | `#909399` |
| success / bg / border | `#4e8e2f` / `#f0f9eb` / `#4e8e2f` |
| amber / bg / border | `#946618` / `#fdf6ec` / `#946618` |
| Dx text / bg / border | `#a86105` / `#fff7e8` / `#efc98f` |
| accent | `#626aef` |
| danger | `#d94f54` |
| control-border | `#a8abb2` |
| selected | `#ebeef5` |
| hover | `#f4f4ff` |

### Dark

| Token | Value |
|---|---|
| page | `#0d0f11` |
| surface | `#121416` |
| surface-2 | `#181b1e` |
| line | `#34373b` |
| line-strong | `#555a61` |
| dash | `#2b2e32` |
| text | `#eef0f2` |
| regular | `#c8cbd0` |
| muted | `#92969c` |
| success / bg / border | `#86d65e` / `#162216` / `#5d9f43` |
| amber / bg / border | `#e6a23c` / `#251e12` / `#a8782c` |
| Dx text / bg / border | `#f1b45d` / `#2a2114` / `#765321` |
| accent | `#8f83f6` |
| danger | `#ff686d` |
| control-border | `#666b72` |
| selected | `#292c30` |
| hover | `#202126` |

Production ให้ map tokens เหล่านี้กับ host theme variables; ห้ามมี component-level theme toggle.

## 6. Exact geometry

### Responsive shell

The comparison HTML uses these QA shells: half-width `width:calc(50vw - 12px); min-width:680px; margin:10px auto 36px`, full-width `width:calc(100% - 20px)`, at viewport `<=1360px` use `width:min(820px, calc(100% - 20px)); min-width:0`, and at `<=820px` use `width:calc(100% - 14px); margin-top:8px`. Production must not expose a shell switch; mount at `width:100%` of the host slot and use the same internal breakpoints/container-query behavior. The surrounding EMR page owns outer page margin and theme.

### Toolbar และ filter

- toolbar `margin-bottom: 10px`; metadata row `gap: 12px; margin-bottom: 8px`; controls `gap: 6px; flex-wrap: wrap`.
- history select: `min-height:32px; padding:3px 34px 3px 9px; border:1px; border-radius:5px; font:600 12px`; chevron inset ขวา 13px.
- VN trigger: `min-width:102px; min-height:32px; padding:3px 14px 3px 8px; gap:7px; border:1px; border-radius:5px; font:600 12px`.
- room tabs wrapper เลื่อนแนวนอนได้; tab strip `display:flex; width:max-content; min-width:100%; padding:3px; border:1px; border-radius:6px`.
- tab `min-height:30px; padding:4px 11px; border-radius:4px; font-weight:600`; code `11px/700`; room label `margin-right:5px`.

### Order และ table density

- Order header: `min-height:30px; padding:1px 12px; gap:8px`; dashed bottom divider.
- Order title `13px/500`; result time/comment `11px/400`.
- Status, `รายงานผล`, `ยืนยันดูผล`: `min-height:24px; padding:1px 4px; border-radius:4px; font:600 12px`.
- header actions `gap:6px`; collapse toggle `24×24px` และอยู่หลัง `รายงานผล`.
- column header: `min-height:28px; padding:1px 10px; font:600 12.5px`.
- result row `min-height:28px`; narrative row `min-height:64px`; Profile row `min-height:24px`.
- Profile label `padding:1px 12px`; child Test `padding-left:28px`.
- cell `padding:1px 12px`; Test `13px/600`; result `13px/400`; unit `12px/400; margin-left:5px`.
- attachment row `min-height:26px; padding:1px 12px; gap:8px; font:400 11px`; surface muted gray.
- shared tooltip `max-width:min(360px, calc(100vw - 24px)); padding:7px 10px; border-radius:4px; font:400 12px; line-height:1.5`.

### Grid widths

Base desktop variables:

```text
name = 190px
history = 118px per occurrence
current = 135px
reference = 105px
flag = 64px
narrativeCurrent = 230px
```

At container `<=820px`:

```text
name = 160px
history = 105px
current = 110px
reference = 92px
flag = 56px
```

Dynamic narrow floors:

- corridor `<420px`: history floor `72px`.
- corridor `<620px`: history floor `92px`.
- otherwise `118px`.
- standard sticky ideal `[190,135,105,64]`, minimum `[124,96,76,42]`.
- narrative sticky ideal `[190,230,64]`, minimum `[124,172,42]`.
- Interpolate/shrink proportionally; preserve at least one visible history corridor and the 13px result type size.

Standard template:

```css
grid-template-columns:
  var(--name-width)
  repeat(var(--history-count), var(--history-width))
  var(--current-width)
  var(--reference-width)
  var(--flag-width);
```

Narrative template omits reference:

```css
grid-template-columns:
  var(--name-width)
  repeat(var(--history-count), var(--history-width))
  var(--narrative-current-width)
  var(--flag-width);
```

Current value ชิดขวาและ reference ชิดซ้ายเข้าหา boundary ร่วมกัน ด้วย inner inset ข้างละ 6px.

## 7. Sticky และ horizontal scroll — ต้องทำตามนี้

- `รายการ`: `position:sticky; left:0; z-index:30`.
- `แปลผล`: `position:sticky; right:0; z-index:30`.
- `ค่าปกติ`: `right: var(--flag-width)`.
- `ครั้งนี้`: `right: calc(var(--flag-width) + var(--reference-width))`.
- sticky header cells `z-index:40` และต้องทาสี opaque เต็มความสูง header row.
- ทุก row containing block ต้องมีความกว้างเต็ม column track; ห้ามบังคับ `width:100%` บน row ที่ทำให้ end-of-track ถูกตัด.
- สร้าง blank sticky fills จริงใน structural/Profile rows. ห้ามใช้ row-level sticky pseudo-element shield เพราะมันเคยบัง history column สุดท้าย.
- Profile row ต้องเป็น `surface-2` band เดียว ไม่มีเงา sticky, ไม่มี left/right border fragment และไม่มี partial bottom divider.
- history viewport ใช้ native pixel scroll (`scrollLeft` step 1). ห้าม `scroll-snap-*`, ห้าม JS auto-align, debounce-pull-back หรือจับ wheel ให้ตรงคอลัมน์.
- ซ่อน native scrollbar ขนาดใหญ่ แต่มี slim accessible scrollbar เฉพาะ history corridor เมื่อ overflow; ไม่แสดงถ้าไม่ overflow.
- ตรวจที่ scroll ซ้ายสุด, offset 37px และขวาสุด. Boundary ระหว่าง history กับ sticky ต้อง gap = 0 และไม่มีเส้น/ตัวอักษรลอด.
- document ทั้งหน้าต้องไม่เกิด horizontal overflow; overflow อยู่ภายใน comparison viewport เท่านั้น.

## 8. Filters

### 8.1 ประเภทห้อง

| Tab | Sections |
|---|---|
| ทั้งหมด `ALL` | ทุก section ที่มีผลใน response |
| ชีวเคมี `BC` | `BC` |
| โลหิตวิทยา `HM HH` | `HM`, `HH` |
| จุลทรรศน์ `ML` | `ML` |
| ภูมิคุ้มกัน `IM MI-OUT` | `IM`, `MI-OUT` |
| จุลชีววิทยา `MB` | `MB` |
| ห้องเชื้อรา `MY` | `MY` |
| ธนาคารเลือด `BB` | `BB` |
| ชีวโมเลกุล `BG` | `BG` |

Filter เป็น metadata ของ Order; ห้ามแทรก room code ลง Order heading. `ทั้งหมด` แสดงหลาย Order แยก block.

### 8.2 จำนวนผลก่อนหน้า

- options เท่านั้น: `1 ครั้ง`, `5 ครั้ง`, `10 ครั้ง`; default `5 ครั้ง`.
- count mode ใช้ occurrence ล่าสุดตาม authoritative timestamp ของแต่ละ Order/Test.
- สร้าง column ตามจำนวนที่เลือกแม้ Test นั้นไม่มีค่า; cell ใช้ `—`.
- header ใช้ `D MMM` บรรทัดแรก และ `hh:mm AM/PM` บรรทัดสอง; ไม่มีขีดคั่นรอบเดือน.
- previous cell แสดง value อย่างเดียว ไม่ซ้ำ unit.

### 8.3 เลือกครั้งตาม VN

- แสดงเฉพาะ Visit ที่มี LAB Order.
- VN ใช้ string ที่ backend ส่งมา verbatim เช่น `VN6900470`; ห้ามเติม `VN`, ห้ามใส่ hyphen.
- ไม่จำกัดจำนวนเลือกฝั่ง client; option list scroll ได้ แต่ selected-summary ต้อง wrap และสูงลงตามรายการทั้งหมดโดยไม่มี inner scrollbar/max-height.
- Option layout: checkbox 14×14 → VN → amber diagnosis tag → วันที่; บรรทัดรองเป็น concise order summary; badge `ผิดปกติ N รายการ` เฉพาะ `N>0`.
- `Dx:` tag ใช้ authoritative primary diagnosis เท่านั้น; padding `2px 6px`, border 1px, radius 4px, `9px/600`, ellipsis + tooltip/focus; omit เมื่อไม่มีข้อมูล.
- option grid `17px minmax(0,1fr); gap:7px; padding:7px 3px`; dashed bottom divider.
- popover `top:+5px; right:0; width:min(390px, calc(100vw - 16px)); padding:10px; border:1px; border-radius:7px; box-shadow:0 12px 30px rgba(0,0,0,.18)`. Narrow host ใช้ `position:fixed; top:70px; right:7px`.
- option list `max-height:326px; overflow:auto`.
- selected chip `min-height:24px; padding:3px 22px 3px 7px; gap:4px; border-radius:4px; font:600 9.5px`; มี `×` ที่มี accessible label ระบุ VN.
- footer `gap:5px; margin-top:8px; padding-top:8px`; actions `min-height:28px; padding:3px 7px; border-radius:4px; font:600 11px`.
- ปุ่ม: `ล้าง`, `ยกเลิก`, `เลือก`. Remove chip ไม่ปิด dropdown; update checkbox/count ทันทีและย้าย focus อย่างมีเหตุผล.
- Apply แล้วทุก Order ใช้ shared newest-first Visit columns; Test ที่ไม่มี result ใน Visit นั้นใช้ `—`.
- VN header ใช้ `D MMM YY` + `hh:mm AM/PM`.

Required Visit option contract:

```ts
type LabVisitOption = {
  id: string;                  // authoritative VN display string
  visitId: string;             // authoritative visit record id where applicable
  occurredAt: string;          // ISO timestamp with timezone/known hospital timezone
  primaryDiagnosis?: string;   // authoritative label only
  orderSummary: string;        // server-derived concise Profile/Test names
  abnormalCount?: number;      // authoritative explicit abnormal count
  sourceIndex?: number;        // stable sort tie-break only
};
```

## 9. Order/result display rules

- Order heading = ordered Profile/Test summary, then result time `hh:mm AM/PM`; ห้ามมีคำว่า `ผล` นำหน้าเวลา.
- ถ้ามี Order comment ให้อยู่บรรทัดรองและระบุ owner ของข้อความตาม contract.
- Status: `Final` green, `Partial` amber, unknown/raw neutral. สีเป็น reinforcement; ต้องมี text.
- `รายงานผล` เป็น link/button ไป PDF ของ Order; accessible name รวม summary.
- collapse ซ่อน column header + Profile/Test rows ทั้งหมด แต่คง Order heading/actions และ attachment rows.
- Profile name แสดงครั้งเดียว; Test ลูก indent 16px จาก baseline Profile (CSS padding-left รวม 28px ตาม cell).
- historical timestamps ต้องมาจาก occurrence จริง; ห้ามสร้างจาก index.
- missing/null/unavailable ใช้ `—`; pending ใช้ข้อความ contract เช่น `รอผลจาก MLab` เฉพาะที่ backend ยืนยัน.
- abnormal เปลี่ยนสีเท่านั้น; final flag column แสดง explicit code/label.
- `H/L` เพิ่ม `↑/↓` หลัง current value/unit และยังคง `H/L` ใน flag column. ห้าม derive จาก ref range.
- `Critical` ต้องใช้ `is_critical === true`; `null` คือ unknown, ไม่ใช่ normal.
- Narrative result รักษา line breaks, clamp 2 lines, full text ผ่าน hover/focus; narrative layout ไม่มี `ค่าปกติ`.
- comments ต้องแยกระดับ Order, Report note, ordered Test และ Result Item; ห้ามรวมเป็นข้อความเดียว.
- attachment แสดงหนึ่ง full-width row ต่อไฟล์หลัง result rows, primary text เป็น filename ไม่มี prefix `ไฟล์แนบ N`; ไม่มี attachment button/dialog ระดับ header.

## 10. Production data contract

Frontend ห้ามอ่าน raw DB, raw LIS payload หรือคำนวณ clinical semantics เอง. Adapter/API ต้องคืนอย่างน้อย:

```ts
type LabHistoryResponse = {
  currentVisitId: string;
  currentVn: string;
  visitOptions: LabVisitOption[];
  orders: LabOrderView[];
};

type LabOrderView = {
  id: string;
  sourceOrderId: string;
  orderNo: string;
  labNo?: string;
  visitId: string;
  vn: string;
  sectionCode: string;
  sectionName?: string;
  title: string;
  orderedAt?: string;
  resultedAt?: string;
  receivedAt?: string;
  status: { raw?: string; stage?: string; label: string; tone: 'success'|'warning'|'neutral' };
  resultReportIds: string[];
  report: LabReportAction;
  comments: { cpoeOrder?: string; resultOrderNote?: string };
  occurrences: LabOccurrence[];
  rows: LabResultView[];
  attachments: LabAttachment[];
};

type LabOccurrence = {
  id: string;
  visitId: string;
  vn: string;
  occurredAt: string;
  reportId?: string;
  reportSeq?: string | number;
  stage?: string;
};

type LabResultView = {
  id: string;
  orderedItemId: string;
  profileId?: string;
  profileName?: string;
  code?: string;
  name: string;
  resultSequence?: number;
  current: LabCellValue;
  history: Record<string, LabCellValue>;
  unit?: string;
  reference?: string;
  interpretation?: string;
  isCritical?: true | false | null;
  resultStatus?: string;
  obxStatus?: string;
  resultVersion?: string | number;
  changeKind?: string;
  comment?: string;
  layout?: 'standard'|'narrative';
};

type LabCellValue = {
  state: 'visible'|'missing'|'pending'|'locked'|'withheld';
  value?: string;
  text?: string;
  unit?: string;
  reference?: string;
  interpretation?: string;
  resultItemId?: string;
  resultReportId?: string;
  occurrenceId?: string;
  visibility?: SensitiveVisibility;
};
```

## 11. Field mapping: DB/LIS → API → UI

| UI | Authoritative source / field | Rule |
|---|---|---|
| Visit authority | `zdata_visit._id` | EMR ส่งเป็น input `visit_id` ให้ Process |
| VN display | `zdata_visit.vn` | Render verbatim; LAB `visit_id` ปัจจุบันเก็บ VN string |
| Order identity | `zdata_cpoe_order._id`, `order_number` | stable parent/order label |
| Ordered Test/Profile | `zdata_cpoe_order_item._id`, `item_data_id`, `item_code`, `item_name` | resolve master by ID first |
| Profile parent | master `lab_parent` | อย่าใช้ `panel_name` เป็น clinical parent เอง |
| LAB No. | Work Item `lab_no` = Result `filler_order_no` | cross-check order/result |
| Result parent | `result_report_id`/`xparentx` → `zdata_lab_report_manual_entry._id` | PDF parent and report header |
| Test code/name | `obs_code`, `obs_name`; fallback verified `test_code`, `test_name` | display stable observation |
| Current value | `result_value` | string; preserve source formatting |
| Unit | `unit_symbol_snapshot` or `units` | adapter chooses verified priority |
| Reference | `reference_range_snapshot` or `ref_range` | display only; no flag inference |
| Interpretation | `interpretation_code` | H/L/etc; explicit only |
| Critical | `is_critical` | tri-state; rules are audit snapshots only |
| Row order | `result_sequence` | stable numeric/source order |
| Result stage | Report `stage`, `report_seq`, `result_uid` | Report-level; do not replace with OBX status |
| Item status/version | `result_status`, `obx_status`, `change_kind`, `receipt_seq`, `result_version` | Result Item-level |
| Result comment | `result_comment` | under its result row; preserve line breaks |
| Report note | Report header `order_note` | separate from CPOE comment |
| Result actors/time | `reported_at/by_source_name`, `verified_at/by_source_name` | display only when required |
| Attachment | Report `result_attachments[]` | server-authorized metadata/URL only |
| Dx tag | authoritative Visit/diagnosis contract | never infer from LAB |
| Abnormal VN count | server count over explicit interpretation | narrative ≠ normal; unknown stays unknown |

Inbound identity/version fields that must remain available through adapter logic: `order_no`, `filler_order_no`, `visit_id`, `result_uid`, `report_seq`, `stage`, `receipt_seq`, `result_version`, `change_kind`, `obx_status`. Dedupe by `result_uid`; append/update by report sequence/stage; preserve correction history outside previous-encounter comparison.

## 12. Joins and hierarchy

```text
zdata_cpoe_order_item._id
  = zdata_lab_work_item._id (canonical single-item)
  = zdata_lab_result_item.order_no (result owner)

zdata_lab_result_item.result_report_id or xparentx
  -> zdata_lab_report_manual_entry._id

zdata_lab_work_item.lab_no
  = zdata_lab_result_item.filler_order_no
```

Legacy batch caveat: บาง batch เก็บ results ไว้ใต้ Work Item แรก ต้อง resolve ผ่าน `selected_items[]/selected_items_json` และ verified group→component allowlist; ห้าม join ด้วย `result_item.order_no` อย่างเดียว.

Profile grouping:

1. เริ่มจาก CPOE Item.
2. Resolve master by `item_data_id`; fallback code เฉพาะเมื่อไม่มี ID.
3. ถ้ามี `lab_parent`, group identity เป็น parent master และใช้ชื่อ parent เป็น Profile.
4. ถ้าไม่มี parent, Test เป็นหัวของตัวเอง.
5. Map result components ด้วย verified allowlist ใน `emr-lab-board-get`; `panel_code/name` เป็น display/audit metadata ไม่ใช่ sole matching key.

## 13. LAB rooms และ state coverage ที่ implementation ต้องรองรับ

ตารางนี้อธิบาย shape/condition จาก mockup; ค่าตัวเลขเป็น synthetic QA data ไม่ใช่ master range.

| Section | ห้อง/ตัวอย่าง | Layout/state ที่ต้องรองรับ | PDF |
|---|---|---|---|
| `BC` | Electrolyte, Liver Function Test, Glucose | Profile + child rows, standalone row, H/L arrows, comments, attachments | LAB general |
| `HM` | Complete Blood Count | numeric standard, low flags, thousands formatting | LAB general |
| `HH` | Coagulation profile | numeric/decimal standard | LAB general |
| `ML` | Urinalysis | text + numeric values, reference `—` ได้ | LAB general |
| `IM` | Sensitive test | locked current/history cells, inline re-auth reveal | LAB general + sensitive gate |
| `MI-OUT` | Outsource sensitive sample | locked/pending/missing combinations | LAB general + sensitive gate |
| `MB` | Aerobic/Anaerobic culture | narrative layout, Partial, pending text, line breaks | Microbiology report |
| `MY` | Wood light/KOH, repeated sites | Profile + repeated-site Test rows/pathology fields | LAB general (current mapping) |
| `BB` | Blood Bank | text/narrative result, explicit status only | LAB general |
| `BG` | Chromosome analysis | narrative/long result, explicit status only | LAB general |

BC fixture rows for visual regression: Sodium 138 mmol/L ref 132–141; Chloride 109 mmol/L H; Total bilirubin 1.4 mg/dL H; ALT 44 U/L H; AST 36 U/L; Glucose 92 mg/dL. Use only in synthetic tests.

## 14. Report/PDF mapping

### Per-Order reports used by current EMR path

| Sections | Report Factory | SQL | Parameters | Enable condition |
|---|---|---|---|---|
| `BC, HM, HH, ML, IM, MI-OUT, MY, BB, BG` | `6aa8f5a8b92813319a86ea11` · `Lab result` | `6ab0a1c4d0c3ef2e97911e55` · `lab_result_slip` | `{ xparentx: resultReportId }`; sensitive PDF uses separate `grant_token` gate | exactly 1 valid Result Report ID |
| `MB` | `6ab1c2d3e4f5061728394a5b` · `Lab result - microbiology` | `6ac2f1a0d0c3ef2e97912a01` · `lab_micro_slip` | `{ xparentx: resultReportId }` | exactly 1 valid Result Report ID |

Current mapping defines `MICRO_SECTIONS = ['MB']`; MY is not routed to the microbiology report by room code.

The canonical HTML links `../../output/pdf/emr-history-lab-report-<room>.pdf`; these are local fixture files only and must not ship as runtime routing.

Rules:

- Validate Result Report IDs as 24-hex values at adapter boundary.
- When zero IDs: hide/disable `รายงานผล` with an accessible reason.
- When more than one ID: do not guess. Disable and state `ใบนี้มีผลหลายชุด จึงไม่เลือกบางชุดให้อัตโนมัติ`; MB uses equivalent MLab wording.
- Sensitive screen grant and PDF grant are separate. Never pass a screen grant to PDF automatically.
- Report output must use the established viewer/new-tab flow and permission checks; do not construct storage URLs client-side.
- Optional whole-Visit report exists but is not part of this confirmed Order-level button: Report `6adb696c41ac687aac3f3cc2`, SQL `6adb696c41ac687aac3f3cc0`, param `vn`.

## 15. Sensitive results — exact production flow

### Locked rendering

- Backend must redact before sending. Locked payload must not contain value, text, unit, reference, interpretation, critical flag, comments, previous values, Result Item ID or Result Report ID unless the verified contract explicitly permits a non-sensitive routing identifier.
- Visible control label exactly `ยืนยันดูผล`; accessible label includes Test name and occurrence date/scope.
- Current and historical cells are separate authorization targets.

### Interaction

```text
click ยืนยันดูผล
  -> invoke host re-auth UI
  -> submit exact visit/order/item/section/occurrence/scope + credentials + purpose + request_id
  -> server re-resolves Visit, Order, Item, section and sensitivity policy
  -> server writes access audit successfully
  -> server returns only authorized disclosure payload + expiry
  -> replace control with result inline in same cell
```

Failure/cancel/expiry:

- Keep cell locked; never reveal stale cached value.
- Return focus to trigger on cancel/failure; success moves focus/announcement to revealed cell.
- Do not store sensitive values or grant tokens in localStorage/sessionStorage/global shared store.
- Clear disclosed value at expiry, patient/visit change, Order identity change, logout, permission change or response scope mismatch.
- Audit must include request/event ID, viewer, authorizing identity, roles snapshot, patient/visit, source Order, item, section, revision/occurrence, purpose, screen, time, outcome and reason.

### Current API and required gap closure

Existing local replacement API:

- Process `emr-lab-board-get` ID `6ab3be31cec3020e8562a2c9`.
- Local candidate `Form-Builder/API/api-factory/processes/emr-lab-board-get-v2-REPLACE.js`.
- Current action: `{ action:'open_sensitive', visit_id, source_order_id, item_id, section_code, username, password, purpose, request_id, screen }`.
- It authorizes current Order+Section and deliberately returns `previous = null`, `previous_values = []`; historical Sensitive values are not covered.

Therefore implementation may wire inline reveal for current cells after verified integration, but **historical `ยืนยันดูผล` requires a backend extension** accepting an authoritative occurrence/result identity and auditing that exact scope. Frontend must not reuse the current grant, copy a current value, or widen Order+Section scope to unlock history.

## 16. Status/version semantics

- Report-level: `stage`, `report_seq`, `result_uid` → preliminary/partial/final/corrected.
- Result-level: `result_status`, `obx_status`, `change_kind`, `result_version`, `receipt_seq`.
- Partial shows available results plus pending only for ordered components with verified mapping.
- Corrected shows latest current value plus corrected state; correction history is a separate revision timeline, not a previous-encounter column.
- Unknown enum renders raw neutral text; do not silently map to Final.
- `is_critical:true` is Critical. `false` is non-critical. missing/null is unknown.
- Interpretation H/L/HH/LL/AA/NEG is not interchangeable with Critical.

## 17. Empty/loading/error/security states

| State | Required behavior |
|---|---|
| Loading | skeleton; clear stale Visit data before replacing |
| No results | `ยังไม่มีผล LAB` |
| Partial | show available values + explicit pending rows/count |
| Missing history | `—` |
| Sensitive locked | `ยืนยันดูผล`; no hidden sensitive payload in DOM/state |
| Withheld | `ปกปิดผลโดยห้องปฏิบัติการ` at same position |
| Critical unknown | neutral/unknown; never green-normal |
| Multiple report IDs | disable PDF; explain why; never auto-pick |
| API error | per-panel error + retry; do not break SOAP/medicine/navigation |
| Unknown section/status | render escaped raw label or neutral fallback |

## 18. Accessibility and keyboard

- Tabs use proper tab semantics or accessible buttons with selected state.
- Every collapse control syncs `aria-expanded`, `aria-controls`, chevron and accessible name.
- Tooltips open by hover and focus; long diagnosis/narrative/order summary remains available to keyboard users.
- VN dropdown: trigger owns `aria-expanded`; Escape cancels draft and returns focus; checkbox labels include VN/date.
- Remove chip control label `ลบ <VN> <date>`.
- Slim scrollbar is keyboard operable and has an accessible name; wheel/trackpad/touch retain native continuous movement.
- Status/abnormal/critical information is text, not color-only.
- Report and attachment destinations use links when they navigate to documents.

## 19. Implementation sequence

1. Add/extend read-only adapter types and normalization; do not touch live artifacts.
2. Resolve Visit/VN and order/result joins server-side; return stable IDs and section metadata.
3. Implement room/count/VN filters as pure state transformations.
4. Implement standard/narrative grid with exact widths and continuous history scroll.
5. Implement opaque sticky cells and structural/Profile bands; test fractional and max scroll before continuing.
6. Add status, comments, flags, attachments and collapse behavior.
7. Wire per-Order report action with verified Report IDs and single-parent guard.
8. Wire current sensitive inline disclosure against a verified backend contract.
9. Extend backend for historical sensitive scope before enabling historical disclosure control.
10. Integrate into the user-owned replacement/local package; run UAT before any Save/Publish decision.

## 20. Acceptance tests

### Visual/layout

- [ ] No production V2/V4 or Light/Dark controls.
- [ ] Host light/dark themes match token intent.
- [ ] Test at 472, 680, 768, 820 and 1440px container widths.
- [ ] Sticky left/right never overlap history at start, 37px offset, or maximum scroll.
- [ ] No header date/time/value/border fragment appears behind sticky cells.
- [ ] Profile band is continuous and has no isolated grid fragment.
- [ ] Native movement stays at non-column-aligned offsets; no snap or pull-back.
- [ ] Slim scrollbar appears only with overflow and is confined to history corridor.
- [ ] Order/header/result/profile/attachment heights and typography match section 6.

### Filters/state

- [ ] ALL and every section filter return correct Orders.
- [ ] Count mode renders exactly 1/5/10 columns including missing cells.
- [ ] VN dropdown includes only Visits with LAB Orders, newest first.
- [ ] VN rendered verbatim; Dx tag is boxed, truncates safely, and disappears when absent.
- [ ] Unlimited selection grows selected-summary vertically without internal scroll.
- [ ] Clear/cancel/apply/remove/Escape behaviors preserve draft/applied state correctly.
- [ ] Room/history mode/selected Visits/collapse state survive container/theme changes.

### Clinical/data correctness

- [ ] Profiles and child Tests map from ordered/master/result contracts, not name guessing.
- [ ] Current, previous encounter and correction history are distinct concepts.
- [ ] Units appear only with current values; history values are value-only.
- [ ] H/L arrows and flags come from explicit interpretation.
- [ ] Critical uses explicit tri-state Boolean only.
- [ ] Partial/final/corrected/unknown/pending/withheld states are covered.
- [ ] Narrative preserves line breaks and full accessible text.
- [ ] Comments remain separated by owner/level.

### Reports/security

- [ ] General vs MB Report Factory IDs match section 14.
- [ ] PDF opens only for exactly one valid Result Report ID.
- [ ] Sensitive PDF requires its own verified grant.
- [ ] Locked responses and DOM contain no sensitive fields.
- [ ] Re-auth success reveals inline; no central result popup.
- [ ] Cancel/failure/expiry stays locked and focus is restored.
- [ ] Historical disclosure remains disabled/fail-closed until exact-occurrence backend authorization exists.
- [ ] Access audit failure blocks disclosure.

### Regression

- [ ] Synthetic mock data only in screenshots/tests; no PHI in repository.
- [ ] Console error/warning empty for supported scenarios.
- [ ] No document-level horizontal overflow.
- [ ] Existing SOAP/medication/X-Ray/navigation flows unchanged.
- [ ] If output is SDForm JSON, validate with `python3 Form-Builder/seed/tests-tools/validators/check_sdform_json.py <candidate.json>` and still perform Builder/Preview/runtime UAT.

## 21. Known blockers / decisions the implementation owner must close

1. Historical Sensitive disclosure endpoint/parameters/audit scope are not implemented by the current replacement API; keep fail-closed until added and verified.
2. Confirm where authoritative primary diagnosis and per-Visit abnormal count are exposed to this EMR response. Do not calculate them from incomplete client rows.
3. Confirm production attachment authorization, URL lifetime, malware-scan and audit contract.
4. Confirm behavior when one Order has multiple Result Report IDs; current safe behavior disables PDF rather than selecting one.
5. Confirm owner and delivery mode for every live Form/API/Report/SQL artifact before mutation.

## 22. Verified implementation references

- Canonical visual artifact: `02-his/ui/emr-history-mlab-mycology-comparison-mockup.html`
- UI rule snapshot: `02-initcraft/skills/emr-v2-ui/references/emr-history-lab-result-table.md`
- LAB/X-Ray data and report matrix: `02-his/handoff/emr-history-lab-xray-result-data-ui-handoff.md`
- Candidate read Process: `Form-Builder/API/api-factory/processes/emr-lab-board-get-v2-REPLACE.js`
- Current EMR event snapshot containing report routing: `Form-Builder/API/form-factory/events/emr-history-onCreated-FULL-v1.js`
- General LAB Report Factory export: `02-his/handoff/lab-result-pdf-profile-group-v4/02_report-factory__Lab-result__6aa8f5a8b92813319a86ea11.json`

## 23. Delivery boundary

This handoff is ready for local implementation and code review. It does not claim that the local mockup, replacement API, Report exports or inferred field mapping are already live/UAT-approved. Any live write requires the repository ownership gate and explicit user choice for that exact artifact and action.
