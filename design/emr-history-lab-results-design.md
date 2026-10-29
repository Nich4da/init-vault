---
type: design
title: EMR History LAB Results UI Specification
created: 2026-10-26
updated: 2026-10-26
status: approved-for-local-implementation
scope: doctor-facing historical LAB result table
source_mockup: 02-his/ui/emr-history-mlab-mycology-comparison-mockup.html
---

# EMR History LAB Results UI Specification

> Production clarification (2026-10-26): `V2/V4` และ `Light/Dark` เป็น controls สำหรับเปรียบเทียบ mockup/QA เท่านั้น ไม่แสดงใน production. Production ใช้ responsive component เดียวตาม container และ inherit theme จาก EMR host. Sensitive re-auth สำเร็จแล้วแสดงค่าผล inline ใน cell เดิม ไม่เปิด central result popup.

เอกสารนี้เป็นข้อกำหนดพร้อมเขียนโค้ดสำหรับตารางประวัติผล LAB ใน EMR โดยสรุปสิ่งที่ผู้ใช้ยืนยันจากการปรับ mockup หลายรอบ เมื่อมีความขัดแย้งด้านหน้าตา ให้ยึดเอกสารนี้และ mockup อ้างอิงร่วมกัน ส่วนกฎทางคลินิก สิทธิ์ และข้อมูลจาก backend ต้องยึด contract ที่ผ่านการยืนยันแยกต่างหาก

## 1. Visual Theme & Atmosphere

- แนวทางหลัก: clinical enterprise UI ที่กระชับ สงบ อ่านและเปรียบเทียบผลได้เร็ว
- ใช้ภาษาภาพเดียวกับ EMR v2 และ Element Plus: พื้นเรียบ เส้นคั่นบาง รัศมีมุมเล็ก สีสถานะเท่าที่จำเป็น
- รองรับ Light และ Dark mode โดยคงลำดับชั้น ขนาด และความหมายเหมือนกัน
- หน้าจอเป้าหมายเป็นส่วนประกอบที่ฝังในพื้นที่ประมาณครึ่งหน้าจอ desktop ไม่ใช่ full-screen dashboard
- ข้อมูลใน mockup และ test fixture ต้องเป็นข้อมูลสังเคราะห์ที่เห็นชัดว่าไม่ใช่ข้อมูลผู้ป่วยจริง

## 2. Color

### Light tokens

```css
--page: #f5f7fa;
--surface: #ffffff;
--surface-2: #fafafa;
--line: #dcdfe6;
--line-strong: #c0c4cc;
--dash: #e4e7ed;
--text: #303133;
--regular: #606266;
--muted: #909399;
--green: #4e8e2f;
--green-bg: #f0f9eb;
--green-border: #4e8e2f;
--amber: #946618;
--amber-bg: #fdf6ec;
--amber-border: #946618;
--accent: #626aef;
--danger: #d94f54;
--control-border: #a8abb2;
--selected: #ebeef5;
--hover: #f4f4ff;
```

### Dark tokens

```css
--page: #0d0f11;
--surface: #121416;
--surface-2: #181b1e;
--line: #34373b;
--line-strong: #555a61;
--dash: #2b2e32;
--text: #eef0f2;
--regular: #c8cbd0;
--muted: #92969c;
--green: #86d65e;
--green-bg: #162216;
--green-border: #5d9f43;
--amber: #e6a23c;
--amber-bg: #251e12;
--amber-border: #a8782c;
--accent: #8f83f6;
--danger: #ff686d;
--control-border: #666b72;
--selected: #292c30;
--hover: #202126;
```

### Semantic rules

- `Final`: success text + pale success surface
- `Partial result` และ pending: warning text + pale warning surface
- Abnormal: ใช้ danger กับชื่อ Test และผลครั้งนี้เท่านั้น ไม่เพิ่มน้ำหนักตัวอักษร
- `H`, `L`, `Critical`: danger ในคอลัมน์ `แปลผล` แบบ sticky ขวา
- สีต้องไม่เป็นตัวสื่อความหมายเพียงอย่างเดียว ต้องมีข้อความสถานะหรือ flag กำกับ
- Border ของ control ห้ามใช้สีดำ: success ใช้ `--green-border`, warning ใช้ `--amber-border`
  และปุ่มทั่วไปใช้ `--control-border` โดยคงความสัมพันธ์เดียวกันทั้ง Light/Dark

## 3. Typography

```css
font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB",
  "Microsoft YaHei", Arial, "Noto Sans Thai", sans-serif;
```

| Element | Size | Weight | สี/บทบาท |
|---|---:|---:|---|
| หัวคอลัมน์ | 12.5px | 600 | muted |
| ชื่อ Profile | 13px | 600 | text |
| ชื่อ Test | 13px | 600 | text หรือ danger |
| ผลครั้งนี้/ค่าปกติ/ผลก่อนหน้า | 13px | 400 | text หรือ muted |
| ชื่อรวม Profile/Test ที่หัว Order | 13px | 500 | regular |
| Unit | 12px | 400 | muted |
| เวลา วันที่ comment ระดับ Order/Test | 11px | 400 | muted |
| ปุ่มและ status chip | 12px | 600 | semantic/regular |

กฎบังคับ:

- ตัวเลขผลตรวจต้องไม่ใหญ่หรือหนากว่าชื่อ Test
- ชื่อ Profile, ชื่อ Test standalone และชื่อ Test ลูกของ Profile ใช้ขนาด/น้ำหนักเท่ากันที่ 13px/600
- ชื่อรวมในหัว Order ต้องเบากว่าชื่อ Test จึงใช้ 13px/500
- เวลา `hh:mm AM/PM` และ comment ใช้ 11px/400 เหมือนกัน
- Unit เล็กกว่าค่าผล 1px และเว้นซ้าย 5px

## 4. Spacing & Grid

### ความสูงและ padding

| ส่วน | ค่าเป้าหมาย |
|---|---:|
| หัวคอลัมน์ | min-height 28px |
| หัว Order | min-height 30px |
| Profile row | min-height 24px |
| Standard result row | min-height 28px |
| Narrative MLab row | min-height 64px |
| Cell padding | 1px 12px |
| Header/Profile padding | 1px 12px |
| Order header padding | 1px 12px |
| ระยะระหว่าง Order blocks | 6px |
| ย่อหน้าลูก Profile | เพิ่ม 16px จาก first-column inset ปกติ |
| comment ใต้เจ้าของข้อมูล | margin-top 2px |

### Grid columns

Standard (N คือจำนวนผลก่อนหน้าที่ผู้ใช้เลือก):

```css
grid-template-columns:
  190px
  repeat(N, 118px)
  135px
  105px
  64px;
```

Narrative MLab:

```css
grid-template-columns:
  190px
  repeat(N, 118px)
  230px
  64px;
```

- `รายการ` sticky ซ้าย; `ครั้งนี้`, `ค่าปกติ` เมื่อมี และ `แปลผล` sticky ขวา
- เฉพาะ previous-result columns อยู่ตรงกลางและเลื่อนแนวนอน
- V2 เฉพาะ standard numeric grid: `ครั้งนี้` ชิดขวาและ `ค่าปกติ` ชิดซ้ายเข้าหาแนวร่วมเดียวกัน โดยใช้ inner inset เท่ากันด้านละ 6px; คอลัมน์อื่นและ narrative MLab ไม่เปลี่ยน
- V4 ใช้ alignment ของ V2 และขยาย shell เต็ม viewport; V1 และ V3 ถูกตัดออกจาก mockup ที่ยืนยันแล้ว
- ซ่อน native scrollbar ที่กินเต็มตาราง; เมื่อ previous columns ล้น ให้แสดง slim scrollbar เฉพาะ corridor ระหว่าง sticky `รายการ` กับ sticky columns ด้านขวา และซ่อนเมื่อไม่มี overflow
- นอกจาก select `จำนวนผลก่อนหน้า` 1/5/10 ให้มีปุ่ม `เลือก VN` เปิด multi-select dropdown ที่แสดงเฉพาะ VN ซึ่งมีการสั่ง LAB และเลือกได้ไม่จำกัดจำนวน; trigger มีเฉพาะข้อความกับ chevron ไม่มี badge/icon VN ซ้ำ และหัว dropdown ใช้ `Visit ที่มีการสั่ง LAB`; inset chevron ของทั้ง count select และ VN trigger ให้พ้นขอบขวา; แต่ละตัวเลือกแสดงค่า VN จากระบบตรงๆ เช่น `VN6900470` โดยห้ามเติม `VN` หรือขีดเอง, วันที่ VN แบบวัน/เดือน/ปี, tag `Dx:` ของ diagnosis หลัก 1 รายการตรงกลางระหว่าง VN กับวันที่, รายการ Test/Profile แบบย่อ และแสดง `ผิดปกติ N รายการ` เฉพาะเมื่อ N มากกว่า 0; tag diagnosis ต้องเป็น box จริงที่มีพื้น amber อ่อน เส้นขอบ amber 1px มุมโค้งและข้อความ amber ทั้ง Light/Dark ไม่ใช่ข้อความลอย, ข้อความยาวต้อง ellipsis และดูข้อความเต็มได้ด้วย hover/focus, หากระบบไม่มี diagnosis ให้เว้น tag และห้ามอนุมานจากรายการ LAB; ใต้รายการสรุปทุก draft selection เป็นกล่อง VN + วันที่ย่อ พร้อม `×` รายตัวสำหรับลบโดย dropdown ไม่ปิดและ checkbox/count อัปเดตทันที; selected-summary ต้อง wrap และยืดลงตามจำนวนทั้งหมดโดยไม่มี max-height/scrollbar ของตัวเอง ส่วน option list ยังมี scroll ได้; ปุ่มหลักใช้ข้อความ `เลือก`; Apply แล้วใช้ VN ชุดเดียวกันกับทุก Order เรียงล่าสุดก่อน และผลที่ไม่มีใน VN นั้นแสดง `—`
- Verified 2026-10-26: V2/Light และ V4/Dark ที่ viewport 472px แสดง tag 11 รายการและเว้น 1 รายการที่ไม่มี diagnosis โดย VN/tag/date ไม่ทับกัน, page overflow เป็นศูนย์; เลือก 12 VN ได้ครบโดยไม่มี disabled option และ selected-summary ยังสูงเท่า scroll height 166px
- คำนวณความกว้าง previous column ให้ corridor อ่านง่าย แต่ให้ slider/trackpad/keyboard เลื่อนได้ต่อเนื่องแบบ native pixel precision โดยไม่ snap, auto-align หรือดึงกลับ เศษคอลัมน์ที่เกิดระหว่างเลื่อนต้องถูก clip ที่ขอบ sticky อย่างสมบูรณ์
- เมื่อ host แคบหรือ browser zoom สูง ให้ลดความกว้าง sticky columns แบบ responsive ก่อนชนกัน โดยสงวน corridor สำหรับ previous result อย่างน้อยหนึ่งคอลัมน์เต็ม; ห้ามลด font ที่ยืนยันแล้ว
- `แปลผล` และค่า flag จัดกึ่งกลางในช่องแคบสุด
- sticky ซ้าย/ขวาต้องเป็นพื้นที่ทึบต่อเนื่องครบทุกชนิดแถว รวม blank fill ของ Profile row, มี boundary separator และ z-index สูงกว่า history cells เสมอ ห้ามเห็นข้อความ/เส้นของส่วนที่ scroll ซ้อนทะลุขึ้นมา แต่ห้ามใช้ pseudo-element shield แยกจาก sticky cells; ให้ grid row กว้างเต็ม column track เพื่อไม่ให้ shield เกิดพื้นว่างทับปลาย history corridor
- Profile row เป็นแถบพื้น `surface-2` ผืนเดียว ไม่วาดเส้นแบ่งคอลัมน์หรือเส้นล่างแบบขาดช่วง; ห้ามเหลือเส้นแนวตั้ง/แนวนอนเฉพาะ history corridor เพราะจะดูเหมือนตารางเลื่อนลอดใต้ sticky columns
- sticky cells ในหัวคอลัมน์ต้อง `align-self: stretch` และวาดพื้นหลังทึบเต็มความสูงจริงของแถว ห้ามให้พื้นหลังสูงแค่ line box ของ label เพราะจะเหลือแถบให้ date/time ลอดด้านบนหรือล่าง
- เส้นคั่น row เป็นเส้น dashed บาง; ขอบ Order เป็นเส้น solid 1px
- Major Order block ใช้ radius 5px; controls ใช้ radius 4px

## 5. Layout & Composition

### หน่วยหลัก

- หนึ่งกรอบตาราง = หนึ่ง LAB Order
- อย่าแบ่งกล่องตามชื่อห้องเพื่อสื่อกับแพทย์ แม้ข้อมูลสามารถกรองด้วยห้อง/section ได้
- ชื่อห้องและ code ใช้เป็น metadata ของ filter ไม่ใช่หัวเรื่องหลักของ Order

### Filter bar

ลำดับ filter ที่ mockup ต้องรองรับ:

1. `ทั้งหมด ALL`
2. `ชีวเคมี BC`
3. `โลหิตวิทยา HM HH`
4. `จุลทรรศน์ ML`
5. `ภูมิคุ้มกัน IM MI-OUT`
6. `จุลชีววิทยา MB`
7. `ห้องเชื้อรา MY`
8. `ธนาคารเลือด BB`
9. `ชีวโมเลกุล BG`

- filter ที่รวมหลาย code แสดงเป็นหมวดเดียวตามรายการข้างต้น
- default เป็น `ทั้งหมด`
- filter bar เลื่อนแนวนอนได้เมื่อพื้นที่ไม่พอ
- ตัวเลือก V2/V4 เป็น segmented control แยกจาก room filter และอยู่ข้าง Light/Dark; default เป็น V2 โดย V2 คือครึ่งจอ และ V4 คือเต็มจอ
- `จำนวนผลก่อนหน้า` เป็น select ที่มี `1 ครั้ง`, `5 ครั้ง`, `10 ครั้ง`; ค่าเริ่มต้น mockup คือ `5 ครั้ง`
- เปลี่ยนจำนวนย้อนหลังแล้วต้องคง active room filter, version, theme และ collapse state ของแต่ละ Order

### Order block anatomy

```text
Summary  hh:mm AM/PM                         Status  รายงานผล  [collapse toggle]
Order comment (optional)
รายการ | Previous × N | ครั้งนี้ | ค่าปกติ | แปลผล
Profile
  Test    Previous values × N    Current    Reference    Flag
Standalone Test    Previous values × N    Current    Reference    Flag
```

หัว Order:

- หัว Order อยู่เป็นบรรทัดแรกของแต่ละ bordered block; หัวคอลัมน์อยู่ถัดลงมา แล้วจึงเป็นผลตรวจ ทั้ง V2/V4 ใช้ลำดับเดียวกัน
- เวลาอยู่ต่อท้าย Summary ในบรรทัดเดียวกัน ไม่มี prefix `ผล` และแสดงแบบ 12 ชั่วโมง `hh:mm AM/PM`
- Summary ต้องเป็นชื่อ Profile/Test ที่แพทย์จำเป็นต้องรู้ ไม่ใช่ชื่อห้อง
- Summary และเวลาอยู่บรรทัดเดียวกัน; Order comment อยู่บรรทัดถัดไปและเริ่มตรงย่อหน้าของ Summary
- Status และ `รายงานผล` อยู่ด้านขวา; ทั้ง V2/V4 ใช้ลิงก์ `รายงานผล` ไปยัง PDF report ของ Order โดยตรง
- ไฟล์แนบไม่อยู่ในหัว Order และไม่มีปุ่มสรุป `ไฟล์แนบ (N)`; แต่ละไฟล์เป็น full-width row ต่อท้ายผลตรวจและเริ่มด้วยชื่อไฟล์โดยไม่เติม `ไฟล์แนบ N`
- ถ้าพื้นที่แนวนอนไม่พอ ให้ summary ellipsis และเปิดดูทั้งหมดด้วย tooltip; อย่าลดตัวอักษรจนอ่านยาก
- ปุ่ม chevron ยุบ–กางอยู่ต่อจาก `รายงานผล` ใน action group ของหัว Order

### การสร้าง Summary

สร้างจาก top-level display items หลังจัด Profile แล้ว:

1. Test เดี่ยว: ใช้ชื่อ Test ตรง ๆ
2. Profile เดี่ยว: ใช้ชื่อ Profile
3. สองถึงสามรายการ: ต่อด้วย ` · `
4. มากกว่าสามรายการ: ใช้สองรายการแรก แล้วต่อ `และอีก N รายการ`
5. Test เดียวหลายตำแหน่ง: `ชื่อ Test (N ตำแหน่ง)`

ตัวอย่าง:

- `Electrolyte · Liver Function Test · Glucose`
- `Wood light (3 ตำแหน่ง) · KOH preparation`
- `Aerobic culture · Anaerobic culture`

Summary ต้องมี tooltip แสดงรายการเต็มแบบมี hierarchy:

```text
รายการตรวจทั้งหมด
• Electrolyte
  - Sodium
  - Chloride
• Liver Function Test
  - Total bilirubin
  - ALT
  - AST
• Glucose
```

### Column headers

Standard:

```text
รายการ | D MMM / hh:mm AM/PM × N | ครั้งนี้ | ค่าปกติ | แปลผล
```

MLab/narrative:

```text
รายการ | D MMM / hh:mm AM/PM × N | ครั้งนี้ | แปลผล
```

- หัว previous แต่ละคอลัมน์แสดง `วัน – เดือนย่อ` บรรทัดแรก และเวลา `hh:mm AM/PM` บรรทัดสอง โดยไม่แสดงปี
- สร้างจำนวน previous columns ให้ครบตาม select แม้ Test นั้นไม่มีค่า; ช่องไม่มีค่าแสดง `—`
- เซลล์ผลก่อนหน้าแสดงเฉพาะค่า ไม่ซ้ำ unit ทุกคอลัมน์
- timestamp ของแต่ละ occurrence ต้องมาจาก contract; timestamp ใน mockup ต้องระบุว่าเป็นข้อมูลสังเคราะห์
- ทุก Order เริ่มต้นเป็นกาง; chevron ชี้ลงเมื่อกางและชี้ขวาเมื่อยุบ

### Responsive container

```css
.shell {
  width: calc(50vw - 12px);
  min-width: 680px;
}
.comparison-grid { width: max(100%, var(--comparison-width)); }
```

- ที่ viewport ≤1360px shell ใช้ `min(820px, calc(100% - 20px))`
- ที่ viewport ≤820px shell ใช้ `calc(100% - 14px)`
- แต่ละ Order มี comparison viewport ของตัวเอง; เฉพาะ previous columns เลื่อนผ่านระหว่าง sticky left/right columns
- ห้ามบีบคอลัมน์จนชื่อ Test และผลเทียบกันไม่ได้

## 6. Components

### Suggested component tree

```text
EmrLabHistoryResults
├─ LabResultToolbar
│  ├─ LabSectionTabs
│  ├─ DisplayVersionToggle (mockup comparison only)
│  └─ ThemeToggle (mockup/demo only if host owns theme)
├─ LabOrderList
│  └─ LabOrderBlock × N
│     ├─ LabResultColumnHeader
│     ├─ LabOrderCollapseToggle
│     ├─ LabOrderHeader
│     ├─ LabProfileRow × N
│     ├─ LabResultRow × N
│     ├─ LabAttachmentRow × N (persistent outside collapsible result body)
│     └─ InterpretationFlagCell
├─ ResultTooltip
├─ LabReportLink
└─ SensitiveResultDialog / production re-auth entry
```

### Coding data contract

```ts
type LabResultLayout = 'standard' | 'narrative'
type LabOrderStatus = 'final' | 'partial' | 'pending'
type LabInterpretation = 'H' | 'L' | 'Critical' | null
type ResultScope = 'current' | 'previous'

interface LabValueView {
  text: string | null
  unit?: string | null
  locked?: boolean
  narrative?: boolean
  pending?: boolean
}

interface LabTestView {
  kind: 'test'
  id: string
  name: string
  siteOrDetail?: string | null
  comment?: string | null
  current: LabValueView
  referenceText?: string | null
  historyValues: Array<LabValueView | null>
  interpretation?: LabInterpretation
}

interface LabProfileView {
  kind: 'profile'
  id: string
  name: string
  tests: LabTestView[]
}

interface LabAttachmentView {
  id: string
  displayName: string
  mediaType: string
  sizeText?: string | null
  canOpen: boolean
  openUrl?: string | null
}

type LabOrderEntry = LabProfileView | LabTestView

interface LabOrderView {
  id: string
  roomCode: string                 // filtering metadata, not primary heading
  roomLabel: string                // filtering metadata, not primary heading
  resultTimeText: string           // authoritative source time; display as hh:mm AM/PM
  historyOccurrences: LabHistoryOccurrenceView[]
  status: LabOrderStatus
  statusLabel: string
  layout: LabResultLayout
  orderComment?: string | null
  entries: LabOrderEntry[]
  reportUrl?: string | null
  attachments: LabAttachmentView[]
}

interface LabHistoryOccurrenceView {
  id: string
  occurredAt: string               // authoritative timestamp
  dateLabel: string                // D MMM; VN-selection mode uses D MMM YY
  timeLabel: string                // hh:mm AM/PM
}
```

Contract boundaries:

- UI ห้ามคำนวณ `H/L/Critical` เองจากค่าปกติ
- ลูกศรหลังผลครั้งนี้มาจาก explicit flag เท่านั้น: `H` → `↑`, `L` → `↓`; ห้ามอนุมานจากค่าปกติ และห้ามกำหนดทิศให้ `Critical` โดยไม่มี direction metadata
- UI ห้ามอนุมานสิทธิ์ sensitive จากชื่อ Test
- API/adapter ต้องส่ง status, flags, locks, comments, hierarchy, source timestamps และ sanitized attachment metadata ที่เชื่อถือได้
- `historyOccurrences` กำหนดลำดับคอลัมน์ และ `historyValues[index]` ต้องอ้าง occurrence เดียวกัน; UI เติม `—` เมื่อ Test ไม่มีค่าแต่ต้องไม่ลบคอลัมน์นั้น
- URL/permission ของ report และ attachment เป็น production contract แยกจาก display metadata; ห้ามสร้าง URL จากชื่อไฟล์ใน UI
- `null`, empty string และ “ไม่มีผล” ต้อง normalize เป็น display state ก่อน render; ค่าไม่มีให้แสดง `—`
- อย่าผูก row ด้วย index อย่างเดียว ให้ใช้ stable Order/Profile/Test identifiers

### Profile and row rendering

- Profile row แสดงชื่อครั้งเดียว แล้ว render component Tests เป็น child rows
- child row เพิ่ม padding-left 16px
- standalone Test render โดยไม่มี Profile band
- Test เดิมหลายตำแหน่ง: adapter สร้าง Profile ตาม Test และ child rows ตามตำแหน่ง
- MY example: `Wood light` เป็น Profile, ตำแหน่งเป็น children; `KOH preparation` เป็น standalone และเก็บตำแหน่งสำคัญเป็น subtext

### Standard result row

- Current, reference และ previous ใช้ 13px/400
- Unit ใช้ 12px/400/muted ต่อท้ายเฉพาะ current; historical cells แสดง value อย่างเดียว
- ค่าไม่มีแสดง `—` อย่างเดียว
- Test comment อยู่ใต้ชื่อ Test 11px/400/muted
- ผลผิดปกติเปลี่ยนสีชื่อ Test + current result เป็น danger

### Narrative MLab row

- ไม่มีคอลัมน์ค่าปกติ
- รักษาการขึ้นบรรทัดจาก source (`white-space: pre-line`)
- table view จำกัด 2 บรรทัดด้วย line clamp
- hover/focus แสดงข้อความเต็มใน tooltip
- pending ใช้ `รอผลจาก MLab` แบบตัวหนังสือ muted หนึ่งบรรทัด ไม่ทำ badge
- ไม่แสดง specimen ซ้ำใต้ Test ทุกแถวใน doctor-facing compact view

### Sensitive result

- ค่า locked แสดงปุ่ม neutral outline ด้วย visible label `ยืนยันดูผล`; เก็บคำอธิบายการเปิดเผยผลที่ยาวกว่าไว้ใน `aria-label`/`title`
- ปุ่มสูงอย่างน้อย 28px, radius 4px, font 13px/600
- ไม่แสดง helper text `ผลปกปิดตามสิทธิ์` ในตาราง
- Production ต้องใช้ re-auth, permission และ audit contract ที่ยืนยันแล้ว; re-auth สำเร็จให้แทนปุ่มด้วยค่าที่ได้รับอนุญาต inline ใน cell เดิม. Cancel/failure/expiry คงสถานะ locked และห้ามเปิด central result popup

### Status and action controls

- `Final`: success outline/tint
- `Partial result`, pending: warning outline/tint
- `Final`, `รายงานผล` และ sensitive-result control: สูง 24px, padding 1px 4px, font 12px/600 เพื่อให้กระชับและให้ `ยืนยันดูผล` แสดงครบใน history cell แคบ ทั้ง V2/V4; `รายงานผล` เป็นลิงก์ไปยัง PDF report ของ Order และเปิดด้วย PDF viewer/new-tab flow ของผลิตภัณฑ์
- ใส่ชื่อ Order/Test summary ใน accessible name/title ไม่ใส่ใน visible button label
- ไฟล์แนบแต่ละไฟล์เป็น full-width row ต่อท้ายตาราง: ชื่อไฟล์เป็น primary text ทางซ้าย และ type/size เป็น metadata ทางขวาเมื่อ contract ส่งมา; ไม่เติม `ไฟล์แนบ N`
- ไม่ใช้ attachment-list dialog และไม่แสดงปุ่ม `ไฟล์แนบ (N)` ในหัว Order; เมื่อไม่มีไฟล์ไม่ต้องสร้าง row ว่าง
- Production ต้องยืนยันสิทธิ์, URL lifetime, malware scan, audit และ open/download contract แยกต่างหาก
- ไม่ใช้ `alert()`/`confirm()` ของ browser
- dialog title ใช้ Order/Test summary เป็นข้อมูลหลัก; room code เป็น metadata รองได้เฉพาะเมื่อ workflow ต้องใช้จริง
- เส้นกรอบทุกปุ่มใช้ semantic border token ของตัวเอง ไม่ fallback เป็นสีดำ

### Order collapse/expand

- วาง real button ขนาด 24px ต่อจาก `รายงานผล` ใน action group ของหัว Order
- หน้าโหลดครั้งแรกทุก Order ต้อง `aria-expanded="true"`
- กดแล้วยุบ/กาง comparison region ทั้งหัวคอลัมน์และ Profile/Test result rows ของ Order นั้น โดยคง Order summary,
  status, `รายงานผล`, chevron และแถวไฟล์แนบทั้งหมดไว้เสมอ
- Expanded ใช้ chevron ลง; collapsed ใช้ chevron ขวา
- ปุ่มต้องมี `aria-controls` ชี้ไปยัง comparison region และ accessible name สลับระหว่าง
  `ยุบผลตรวจ <summary>` / `กางผลตรวจ <summary>`
- State ของแต่ละ Order เป็นอิสระ; fresh page load reset เป็นกางทั้งหมด

## 7. Motion & Interaction

- Production inherit theme จาก host และตอบสนองตาม container โดยไม่มี Theme/Version toggle; mockup controls ใช้ QA เท่านั้น
- การเปลี่ยน host theme หรือ container width ห้าม reset filter, จำนวนผลก่อนหน้า, selected VN, horizontal position หรือ collapse state
- Previous-count select สร้าง 1/5/10 history columns โดยไม่ reset filter, selected VN หรือ collapse state
- Tabs รองรับ click, `ArrowLeft`, `ArrowRight`; active tab มี `aria-selected=true` และอยู่ใน tab order
- Summary tooltip เปิดด้วย mouse hover และ keyboard focus
- MLab tooltip เปิดด้วย hover/focus และซ่อนเมื่อ mouseleave, blur, scroll หรือ resize
- Chevron ยุบ–กางเปลี่ยนทิศทางพร้อม `aria-expanded` และไม่กระทบ Order อื่น
- Tooltip ไม่ใช้แทนข้อมูลสถานะที่จำเป็น
- `รายงานผล` เปิด PDF โดยตรง; ไฟล์แนบแสดงอยู่ท้ายตารางและลิงก์ไป file viewer เมื่อมี URL ที่เชื่อถือได้
- Sensitive control เรียก host re-auth; success แสดงผล inline ใน cell เดิม, cancel/failure คืน focus ไป trigger และไม่เผยข้อมูล
- Motion ใช้เพียง state transition สั้น ๆ ถ้าจำเป็น; ไม่ใช้ animation ที่รบกวนการอ่านผล

### Required UI events

```ts
selectSection(filterCode: string): void
setTheme(theme: 'light' | 'dark'): void
setDisplayVersion(version: 'v1' | 'v2' | 'v3' | 'v4'): void
openReportPdf(orderId: string, reportUrl: string): void
openAttachment(orderId: string, attachmentId: string, openUrl: string): void
requestSensitiveReveal(orderId: string, testId: string, scope: ResultScope): void
toggleOrder(orderId: string): void
showTooltip(anchorId: string, text: string): void
closeOverlay(): void
```

ชื่อ event ปรับตาม framework ได้ แต่ payload ต้องมี stable identifiers และ scope ครบ

## 8. Voice & Brand

- ภาษา UI สั้น ตรง ใช้คำที่แพทย์สแกนได้เร็ว
- แสดงชื่อ Test/Profile ตาม source master โดยไม่แปลความหมายทางคลินิกเพิ่มเอง
- ใช้เวลาแบบ `hh:mm AM/PM` ต่อท้าย Summary โดยไม่มีคำว่า `ผล`; ใช้ `ครั้งนี้`, `ค่าปกติ`, `ก่อนหน้า`, `รายงานผล`, ชื่อไฟล์แนบจริง และ visible label `ยืนยันดูผล`
- ห้อง/filter labels ใช้ชื่อที่ยืนยันแล้ว: ชีวเคมี, โลหิตวิทยา, จุลทรรศน์, ภูมิคุ้มกัน, จุลชีววิทยา, ห้องเชื้อรา, ธนาคารเลือด, ชีวโมเลกุล
- หัว comparison โหมดจำนวนครั้งใช้ `D MMM` และ `hh:mm AM/PM` สองบรรทัดโดยไม่แสดงปี; โหมดเลือก VN ใช้ `D MMM YY`; ทั้งสองโหมดไม่มีขีดคั่น
- Comment ใช้ข้อความจาก contract โดยไม่เติม prefix ซ้ำ ถ้า source ส่ง prefix มาแล้ว

## 9. Anti-patterns

ห้ามทำสิ่งต่อไปนี้:

- ใช้ชื่อห้อง LAB เป็นหัว Order หลักแทนรายการตรวจ
- แสดง group header ซ้ำที่ไม่ช่วยแพทย์อ่านผล
- ย้ายเวลาออกผลไปซ้ำในทุก Test row
- ทำผลตัวเลขใหญ่หรือหนากว่าชื่อ Test
- ทำชื่อรวม Order หนาเท่าหรือเด่นกว่าชื่อ Test
- วาง Order comment ไม่ตรงกับย่อหน้าของ Summary
- วาง previous date ข้างผลแต่ละแถว; วันที่ต้องอยู่ในหัวคอลัมน์ก่อนหน้า
- แสดงปี พ.ศ. 4 หลักในหัวคอลัมน์ comparison
- แสดงข้อความ “ไม่พบผลก่อนหน้า/ไม่พบตำแหน่งเดียวกัน” แทน `—`
- ซ่อนหัว `แปลผล` หรือย้ายกลับไปเป็นคอลัมน์ที่เลื่อนจนหลุดสายตา
- แสดง unit ซ้ำในทุก historical cell
- ใช้ border สีดำกับ status chip หรือปุ่มทั่วไปแทน semantic border token
- เริ่มต้น Order เป็น collapsed หรือใช้ปุ่มยุบ–กางเดียวควบคุมทุก Order
- ซ่อนหัว Order/status/`รายงานผล`/แถวไฟล์แนบไปพร้อม result rows จนไม่มีจุดให้กางกลับ
- บังคับ MLab ให้มีคอลัมน์ค่าปกติ
- ตัด MLab โดยไม่มีช่องทางดูข้อความเต็ม
- แสดง specimen helper ซ้ำทุก row โดยไม่มีเหตุผลทางคลินิก
- ทำ pending MLab เป็น badge ที่เด่นกว่าผล
- แสดง helper `ผลปกปิดตามสิทธิ์` ใน compact table
- ใช้ browser-native alert/confirm เป็น popup ของผลิตภัณฑ์
- ใช้ V2 กับ narrative MLab แล้วเพิ่มคอลัมน์ค่าปกติหรือบังคับการจัดชิดแบบ numeric
- แสดง native scrollbar เต็มความกว้างใต้ sticky columns หรือคง slim scrollbar ไว้เมื่อไม่มี overflow
- แสดงปุ่ม `ไฟล์แนบ (N)` ในหัว Order หรือซ่อน attachment rows เมื่อหุบ Order
- เติม label ลำดับ `ไฟล์แนบ N` หน้าชื่อไฟล์ใน attachment row
- แสดงแถวไฟล์แนบแบบ disabled เมื่อไม่มีไฟล์; ต้อง omit rows ไปเลย
- ใช้ไฟล์แนบสังเคราะห์เป็นหลักฐานว่า production storage/download contract พร้อมแล้ว
- ใช้ข้อมูลผู้ป่วยจริงหรือค่าผลจริงใน mockup/test fixture
- อนุมาน critical/permission/status ใน presentation layer

### Acceptance checklist

### Visual

- [ ] Light และ Dark mode อ่าน hierarchy ได้เท่ากัน
- [ ] V2 แสดงเหมาะกับพื้นที่ประมาณครึ่งจอ desktop; V4 ใช้พื้นที่เต็มจอ
- [ ] V2/V4 standard grid จัดครั้งนี้ชิดขวาและค่าปกติชิดซ้ายเข้าหากัน
- [ ] slim scrollbar อยู่เฉพาะ history corridor เมื่อ overflow และหายเมื่อไม่มี overflow
- [ ] ขนาด/น้ำหนักตาม typography table
- [ ] row กระชับตาม dimension table
- [ ] มีหัว `แปลผล` และ sticky อยู่ขวาสุด
- [ ] Border ของ Final/Partial/ปุ่มทั่วไปใช้ green/amber/neutral token ไม่ใช่สีดำ

### Content structure

- [ ] หนึ่ง block ต่อหนึ่ง Order
- [ ] หัว Order อยู่ก่อนหัวคอลัมน์ในทั้ง V2/V4 โดยรายละเอียดเดิมไม่เปลี่ยน
- [ ] หัว Order เป็น Test/Profile summary ไม่ใช่ห้อง
- [ ] เวลาอยู่หลัง summary ในรูป `hh:mm AM/PM` ไม่มี prefix `ผล` และไม่ซ้ำใน rows
- [ ] Order comment ตรงย่อหน้า summary
- [ ] Profile/child/standalone render ถูกต้อง
- [ ] Test เดิมหลายตำแหน่งแสดงเป็น Profile
- [ ] previous header โหมดจำนวนครั้งแสดง `D MMM` และ `hh:mm AM/PM`; โหมดเลือก VN แสดง `D MMM YY`; ไม่มีขีดคั่น
- [ ] เลือก 1/5/10 แล้วจำนวน previous columns ตรง แม้บาง Test ไม่มีค่า
- [ ] ค่าไม่มีเป็น `—` เท่านั้น

### States and interactions

- [ ] Final/Partial/Pending มีทั้งข้อความและ semantic color
- [ ] abnormal color ไม่ทำให้น้ำหนักตัวอักษรเปลี่ยน
- [ ] explicit `H/L` แสดง `↑/↓` หลังผลครั้งนี้โดยยังคง final flag column และไม่คำนวณจากค่าปกติ
- [ ] MLab line clamp + full tooltip ทำงานด้วย mouse และ keyboard
- [ ] summary tooltip แสดงรายการทั้งหมดแบบ hierarchy
- [ ] sensitive result แสดง neutral re-auth control
- [ ] `รายงานผล` เปิด PDF report ของ Order โดยตรงและไม่เปิด Popup “ดูผลทั้งใบ” เดิม
- [ ] แถวไฟล์แนบต่อท้ายตารางเริ่มด้วยชื่อไฟล์โดยไม่มี `ไฟล์แนบ N`, แสดง metadata ครบ และยังมองเห็นเมื่อ comparison region ถูกหุบ
- [ ] `รายงานผล` และ attachment rows มีรูปแบบ/พฤติกรรมเดียวกันใน V2/V4
- [ ] V2/V4 สลับได้โดยไม่ reset active filter หรือ independent collapse state
- [ ] `รายการ` sticky ซ้าย; `ครั้งนี้/ค่าปกติ/แปลผล` sticky ขวาขณะเลื่อน previous columns
- [ ] Escape ปิด dialog และ focus กลับ trigger
- [ ] tabs ใช้ keyboard ได้
- [ ] ทุก Order เริ่มต้นกางและยุบ–กางแยกกันได้ด้วย mouse/keyboard
- [ ] เมื่อหุบ ต้องไม่เห็นหัวคอลัมน์หรือ result rows; เหลือหัว Order/actions และ attachment rows เท่านั้น
- [ ] Chevron, `aria-expanded`, `aria-controls` และ accessible name ตรงกับ state
- [ ] horizontal overflow ไม่ทำให้ข้อมูลหาย

### Data and safety

- [ ] ใช้ stable identifiers
- [ ] UI ไม่คำนวณ flag/critical/permission เอง
- [ ] comments แยกระดับ Order/Test
- [ ] ไม่มี patient/production data ใน fixture หรือ screenshot
- [ ] ระบุ API/permission contract ที่ยังไม่ยืนยันไว้เป็น blocker ไม่ทำเป็น production behavior

### Required test matrix

| Case | Expected |
|---|---|
| Profile เดียว | Profile band หนึ่งครั้ง + child rows |
| หลาย Profile + standalone | Summary รวมด้วย ` · `; tooltip แสดง hierarchy ครบ |
| Test เดี่ยว | ไม่มี Profile band; ชื่อ Test เป็น summary |
| Test เดียวหลายตำแหน่ง | Test เป็น Profile; ตำแหน่งเป็น children |
| Abnormal H/L/Critical | ชื่อ+current เป็น danger; `H/L` มี `↑/↓` หลัง current; final flag และทิศทางมาจาก contract |
| History count 1/5/10 | สร้างจำนวนคอลัมน์ตรงกับ select และ state อื่นไม่ reset |
| ไม่มี previous result | คอลัมน์ยังอยู่และเซลล์แสดง `—`; ไม่แสดงประโยคอธิบาย |
| Previous timestamp | โหมดจำนวนครั้งแสดง `D MMM` เหนือ `hh:mm AM/PM`; โหมดเลือก VN แสดง `D MMM YY`; ไม่มีขีดคั่น |
| Horizontal history scroll | previous columns เลื่อน; left/right sticky columns ยังคงอยู่ |
| Order/Test comments | 11px/400/muted อยู่ใต้ owner ที่ถูกต้อง |
| Long MLab | 2-line clamp; tooltip แสดงเต็มและคง line breaks |
| Pending MLab | muted line `รอผลจาก MLab` |
| Sensitive current/previous | neutral re-auth button; ส่ง scope ถูกต้อง |
| All filter | render ทุก Order ต่อกัน ไม่รวมเป็นกล่องเดียว |
| Small host width | horizontal scroll อยู่ใน table viewport |
| Dialog close | close/backdrop/Escape และ focus return ทำงาน |
| Default Order state | ทุก Order expanded; chevron ลง; accessible name เริ่มด้วย `ยุบผลตรวจ` |
| Collapse one Order | ซ่อนหัวคอลัมน์และ result body ของ Order นั้น; คงหัว Order/actions/attachments และ Order อื่นยัง expanded |
| Re-expand | comparison region กลับมา; chevron/ARIA/accessibility name กลับตรง state |

### Open implementation decisions

รายการต่อไปนี้ยังไม่ให้ UI เดาเอง:

1. API endpoint และ response mapping สำหรับ Order/Profile/Test hierarchy
2. authoritative timestamp ที่ใช้แสดง `hh:mm AM/PM` ต่อท้าย Summary
3. logic เลือก 1/5/10 historical occurrences, alignment ระหว่าง occurrence กับ Test value และ authoritative timestamp
4. แหล่งที่มาของ `H/L/Critical`, Partial/Final และ corrected-result state
5. production re-auth method, permission, timeout และ audit log ของ sensitive result
6. full-report document/modal content และสิทธิ์ดาวน์โหลด/พิมพ์
7. touch behavior ของ tooltip บนอุปกรณ์ไม่มี hover
8. Builder/Preview/runtime integration ภายใน EMR v2 จริง

