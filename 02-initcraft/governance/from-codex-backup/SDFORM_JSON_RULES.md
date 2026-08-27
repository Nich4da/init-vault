# 🔴 SDForm JSON — กฎเหล็กก่อนส่งไฟล์ให้ผู้ใช้ import

อัปเดตล่าสุด: 25 สิงหาคม 2569 (Asia/Bangkok) · สถานะ: **บังคับใช้ · ห้ามข้าม**

> **กฎข้อเดียวที่ต้องจำ**
> **ห้ามประกอบฟอร์มขึ้นเองจากศูนย์** — ทั้งโครง container และ `options` ต้องก๊อปจากฟอร์มแม่แบบ
>
> **ห้ามเขียน `options` ของ widget ขึ้นเองจากศูนย์** — ต้องก๊อป widget ทั้งก้อนจากฟอร์มแม่แบบ
> แล้วแก้เฉพาะค่าที่ต้องการจริง ๆ (`name` · `label` · `defaultValue` · `columnSpan` · `readonly` ·
> `required` · `hidden` · `placeholder`) **ห้ามลบช่องอื่นทิ้ง แม้จะดูเหมือนไม่ได้ใช้**

---

## 1. อาการเมื่อละเมิดกฎนี้

ผู้ใช้ import ไฟล์เข้า form-builder แล้ว:

- **canvas / preview ว่างเปล่า** ไม่มี widget โผล่เลย
- แต่ **Tree View ขึ้นครบทุกตัว**
- คลิกลงไปในพื้นที่ว่างของ canvas → widget โผล่ขึ้นมาทีละตัว
- ไม่มี error ใด ๆ ขึ้นให้เห็น

เพราะ Tree View แค่ไล่ array `fields` ออกมาแสดง แต่ตัว renderer บน canvas อ่าน `options`
ที่ไม่ครบแล้วคำนวณ layout ไม่ได้

**ถ้าผู้ใช้ส่งภาพหน้าจอแบบนี้มา = ไฟล์ที่เราส่งไปไม่ผ่านการตรวจ ให้ถือเป็น failed test ทันที**

---

## 2. สาเหตุ — มี **4 ข้อ** ต้องผ่านให้ครบ (ปิดเคสแล้ว 2026-08-25)

> 🔴 **ยังไม่ปิดเคส — `list-ui` ยังไม่เคยยืนยันได้ว่า render ตอน import**
> `v6b` ย้าย upload ออกไป root แล้ว list ก็ยังไม่ขึ้น · ทบทวนหลักฐานเก่าแล้วพบว่าทุกครั้งที่เคย
> สรุปว่า "list ขึ้น" ภาพนั้นมี widget ถูกเลือกอยู่เสมอ → **หลักฐานใช้ไม่ได้ทั้งหมด**
> งานที่ต้องทำต่อและลำดับการทดลองอยู่ใน [`HANDOFF_SDFORM_LIST_UI.md`](HANDOFF_SDFORM_LIST_UI.md)
> สิ่งที่ยืนยันแล้วว่า render ได้: `text-input` ในกริด · `file-upload-input` ที่ root

> ### 🔴 กติกาการอ่านผล — ห้ามนับว่า "ขึ้นแล้ว" ถ้ามี widget ถูกเลือกอยู่
> รอบ `v5b` เกือบสรุปผิดเพราะภาพหน้าจอที่ใช้ตัดสินมี col ของ list ถูกเลือกอยู่ (Property ขึ้น Grid Col)
> ซึ่งเป็นอาการเดิมของบั๊กนี้พอดี — **การยืนยันที่ถูกต้องคือ import แล้วดูทันทีโดยไม่คลิกอะไรเลย**
> ถ้าจะแนบภาพเป็นหลักฐาน ต้องเป็นภาพที่ Property panel แสดง Form Setting (ไม่มีอะไรถูกเลือก)

| # | เงื่อนไข | อาการถ้าผิด |
|---|---|---|
| ก | `options` ครบชุดตามแม่แบบ | ทั้งฟอร์มไม่ render |
| ข | มี container ห่อ **และลูกอยู่ใน `.fields`** ไม่ใช่ `.widgetList` | ทั้งฟอร์มไม่ render / container ว่าง |
| ค | ห้ามใส่ `key` ให้ component ที่แม่แบบไม่เคยใส่ (`list-ui`) | widget นั้นเป็นช่องว่าง |
| ง | **ค่า presentation ต้องปล่อยตามแม่แบบ** — แก้ได้เฉพาะค่าข้อมูล | widget นั้นไม่ render เลย |

### เงื่อนไข ง · แก้ได้เฉพาะ "ค่าข้อมูล" ห้ามแต่งค่า presentation เอง

`file-upload-input` ที่เขียนเองมี `options` **ครบ 32 ช่องถูกต้องทุกช่อง** และชื่อ component ก็ถูก
แต่ไม่ render ทั้งใน `grid-col` และที่ root ทั้งมีและไม่มี `key` — ต่างจากตัวจริงแค่ **ค่า**:

| ช่อง | ระบบสร้างมา | ที่เราแต่งเอง |
|---|---|---|
| `labelIconClass` | `null` | `"el-paperclip"` ← ไม่มีในแม่แบบไฟล์ไหนเลย |
| `labelIconPosition` | `"rear"` | `"front"` |
| `labelTooltip` | `null` | ข้อความไทย |
| `customClass` | `""` | `"lab-result-attachments"` |

พอเอาตัวจริงมาแล้วแก้เฉพาะ `name` `label` `columnSpan` `multipleSelect` `limit` `fileMaxSize`
`fileTypes` `uploadTip` → **ขึ้นทันที**

> ⚠️ **ยังไม่รู้ว่า 4 ค่านั้นข้อไหนคือตัวการ** เพราะเปลี่ยนกลับพร้อมกันหมด
> ไอคอนที่แม่แบบใช้จริงมีแค่ `el-key` · `el-menu` · `addon-users` · `objectid-input` ·
> `el-info-filled` และส่วนใหญ่เป็น `null` — **`el-paperclip` เป็นชื่อที่คิดขึ้นเอง จึงน่าสงสัยที่สุด**
> กติกาที่ปลอดภัยคือ **อย่าแตะค่า presentation เลย** ไม่ต้องเสียเวลาหาว่าข้อไหน

### รายละเอียดเดิม — 2 เงื่อนไขแรก

> ⚠️ **แก้ไขข้อสรุปเดิม (2026-08-25 รอบสอง)** — ตอนแรกสรุปว่า `options` ไม่ครบเป็นสาเหตุเดียว
> แล้วส่ง `Result_Report_Manual_UI_FIXED.json` ที่ `options` ครบและผ่าน validator ให้ผู้ใช้
> **ผลคือยัง preview ว่างเหมือนเดิม** จึงยืนยันได้ว่า options ครบเป็นเงื่อนไข **จำเป็นแต่ไม่พอ**

### เงื่อนไข ก · `options` ต้องครบชุด

`options` ของ widget **ไม่ครบชุด** — เขียนเองแล้วใส่เฉพาะช่องที่คิดว่าจำเป็น

ตัวอย่างจริงจาก `Result_Report_Manual_UI_Validated.json` (25 ส.ค. 2569) — `text-input` 6 ตัว
มี `options` แค่ 25 ช่อง ทั้งที่ต้องมี 43 ขาดไป 18 ช่อง:

```
appendButton · appendButtonDisabled · buttonIcon · labelAlign · labelColor
labelIconClass · labelIconPosition · labelTooltip · labelWidth · minLength
onAppendButtonClick · prefixIcon · prefixText · showPassword · showWordLimit
size · suffixIcon · suffixText
```

### เงื่อนไข ค · ห้ามใส่ `key` ให้ component ที่แม่แบบไม่เคยใส่

🔴 **ยืนยันด้วยการทดลองแล้ว 2026-08-25** — `list-ui` ที่มี `key` จะ render เป็น **col ว่าง**
เอา `key` ออกตัวเดียวโดยไม่แตะอะไรอีกเลย → ขึ้นทันที
ฟอร์มแม่แบบทั้ง 5 ตัวที่มี `list-ui` **ไม่มี `key` สักตัว**

> บทเรียน: **"ก๊อปจากแม่แบบ" แปลว่าก๊อปให้เหมือน ไม่ใช่ก๊อปแล้วเติมให้ครบกว่า**
> รอบนี้พังเพราะคำสั่งที่ส่งให้ agent บอกว่า "ใส่ key ให้ครบทุก widget" ซึ่งเกินกว่าที่แม่แบบทำ
> validator ตรวจข้อนี้ให้แล้ว (คำนวณจากแม่แบบเอง ไม่ hardcode)

### เงื่อนไข ข · ต้องมี container ห่อ widget **และลูกต้องอยู่ใน `.fields`**

> 🔴 **`widgetList` ไม่มีอยู่จริงในสคีมานี้** — สแกนฟอร์มที่แสดงผลได้ทุกไฟล์แล้ว `widgetList`
> ถูกใช้ **0 ครั้ง** · `card` · `grid-col` · `sub-form` เก็บ widget ลูกไว้ใน **`.fields`** เสมอ
> ถ้าเอาลูกไปใส่ `widgetList` ตัว Builder จะ render **container ว่าง** — อาการเหมือนเดิมทุกประการ
> (เกิดขึ้นจริง 2026-08-25 เพราะคำสั่งที่ส่งให้ agent เขียนผิดเป็น `cols[].widgetList`)

ฟอร์มที่ยืนยันแล้วว่าแสดงผลได้ **ทุกไฟล์มี `grid` / `card` / `tab` เป็น `fields[0]`**
และ widget เกือบทั้งหมดอยู่ใน `cols[].widgetList` ของ grid

`Result_Report_Manual_UI_FIXED.json` มี **container 0 ตัว** — widget ทั้ง 8 ลอยอยู่ที่ root
นี่คือเหตุผลที่ `columnSpan: 6` ไม่มีผล (ทุกช่องกินเต็มความกว้าง เรียงลงมาทีละช่อง)
และเป็นความต่างเชิงโครงสร้างข้อเดียวที่เหลือเมื่อเทียบกับฟอร์มที่แสดงผลได้

### ตารางเทียบ — ทำไมถึงสรุปว่าต้องผ่านทั้งสองข้อ

| ไฟล์ | options ครบ | มี container | แสดงผล |
|---|---|---|---|
| `Lab_Result_Inbound_Receive.json` และแม่แบบอื่น | ✅ | ✅ | ✅ |
| `..._Failed_Preview_2026-08-23.json` | ❌ | ✅ (grid root, 11 container) | ❌ |
| `Result_Report_Manual_UI_FIXED.json` | ✅ | ❌ (0 container) | ❌ |

ขาดข้อใดข้อหนึ่งก็ไม่แสดงผล

### หลักฐาน — สแกน 57 ไฟล์ในโฟลเดอร์นี้

| กลุ่ม | ผลลัพธ์ |
|---|---|
| `options` ครบทุก widget | ใช้งานได้ทุกไฟล์ |
| `options` ไม่ครบ | preview ว่างทุกไฟล์ |

> 🔴 **ข้อควรระวังเรื่องหลักฐานชุดนี้** — สถานะ "ใช้งานได้" ของ `Lab_Bio_Order_CRUD.json` และ
> `Center_Lab_Order_Master_Bound.json` **อนุมานจากชื่อไฟล์ ไม่เคยยืนยันในระบบจริง**
> โดยเฉพาะ `Lab_Bio_Order_CRUD.json` ที่มี container 0 ตัวเหมือนไฟล์ที่พัง — มีโอกาสสูงที่มันก็ไม่แสดงผล
> ดังนั้นข้อสรุปที่ว่า "รูปแบบ `id` ไม่ใช่สาเหตุ" **ยังไม่มีหลักฐานยืนยันจริง**

---

## 3. สถานะของสมมติฐานอื่น — อ่านให้ครบก่อนสรุป

| สมมติฐาน | สถานะ |
|---|---|
| **ต้องมี container ห่อ** | 🔴 **น่าจะใช่ ยังไม่ยืนยัน 100%** — ฟอร์มที่แสดงผลได้ทุกไฟล์มี container · ไฟล์ที่ยัง preview ว่างมี 0 ตัว |
| รูปแบบ `id` ต้องเป็น `<component><ตัวเลข>` | ⚠️ **ยังตัดออกไม่ได้** — หลักฐานเดิมอิงจาก 2 ไฟล์ที่ไม่เคยยืนยันว่าแสดงผลจริง |
| ทุก widget ต้องมี `key` | ⚠️ **ยังตัดออกไม่ได้** ด้วยเหตุผลเดียวกัน |
| `key` ต้องไม่ซ้ำ | ✅ ตัดออกแล้ว — `Lab_Result_Inbound_Receive.json` ที่แสดงผลได้ มี `key` ซ้ำ 40 จาก 47 ตัว |
| `formConfig.cssCode` ไปซ่อน widget | ✅ ตัดออกแล้ว — ไฟล์ที่พังไม่มี `display:none` / `visibility:hidden` / `height:0` / `opacity:0` |

**วิธีที่ปลอดภัยที่สุดคือไม่ต้องเดาว่าข้อไหนใช่** — ทำให้โครงไฟล์เหมือนฟอร์มที่ระบบ export มา
ให้ครบทุกแกน (container · options · รูปแบบ `id` · `key`) แล้วทดสอบรอบเดียวจบ

---

## 4. ขั้นตอนที่ถูกต้อง

1. **เลือกฟอร์มแม่แบบ** จากตารางข้อ 6 ที่มี component ชนิดเดียวกับที่ต้องการ
2. **ก๊อป widget ทั้ง object** ออกมา (ทั้ง `component` · `category` · `icon` · `fieldType` ·
   `fieldLength` · `children` · `enable` · `formItemFlag` · `options` ครบทุกช่อง)
3. **แก้เฉพาะ** `options.name` · `options.label` · `options.defaultValue` · `options.columnSpan` ·
   `options.readonly` · `options.required` · `options.hidden` · `options.placeholder` และ `id`
4. **ตั้ง `id` ให้ไม่ซ้ำกันในไฟล์** (รูปแบบไหนก็ได้ ตั้งชื่อสื่อความหมายได้)
5. **ตั้ง `options.name` ให้ไม่ซ้ำกันในไฟล์** — เป็น key ของ `formData` ซ้ำแล้วข้อมูลทับกัน
6. **รัน validator ให้ผ่านก่อนส่ง** (ข้อ 5)
7. **ให้ผู้ใช้ยืนยันใน Builder จริง** แล้วค่อยบอกว่าเสร็จ — validator ผ่านยังไม่เท่ากับใช้งานได้

---

## 5. Validator — ต้องรันทุกครั้งก่อนส่งไฟล์

```bash
cd ~/Documents/codex-backup
python3 check_sdform_json.py <ไฟล์.json>
```

- exit code `0` = ผ่าน · `1` = ไม่ผ่าน
- **ห้ามส่งไฟล์ที่ exit code เป็น 1 ให้ผู้ใช้ ไม่ว่ากรณีใด**
- ตัว validator อ่านชุด `options` มาตรฐานจากฟอร์มแม่แบบในโฟลเดอร์นี้เอง
  จึงอัปเดตตามระบบอัตโนมัติ ไม่ต้องแก้สคริปต์เมื่อระบบเพิ่มช่องใหม่

**เกณฑ์ที่ใช้**: ช่องที่ "บังคับ" = ช่องที่ widget ตัวอย่างของ component นั้น **ทุกตัว** มีเหมือนกันหมด
(intersection ไม่ใช่ union — union จะเข้มเกินจนฟอร์มที่ระบบ export มาเองยังไม่ผ่าน เพราะ widget
รุ่นใหม่มีช่องเพิ่มที่รุ่นเก่าไม่มี)

**ผลการทดสอบ validator เอง (25 ส.ค. 2569)**: ฟอร์มแม่แบบ 10 ไฟล์ผ่านหมด ·
ไฟล์ที่รู้ว่า preview ว่าง 3 ไฟล์ (`Result_Report_Manual_UI_Validated` ·
`..._Failed_Preview_2026-08-23` · `..._Broken_CardOnly`) ไม่ผ่านหมด

---

## 6. จำนวนช่อง `options` ที่บังคับ ต่อ component

ยืนยันจากฟอร์มแม่แบบ 25 ส.ค. 2569 — ถ้าน้อยกว่านี้ = ไฟล์พังแน่นอน

| component | ช่องที่บังคับ |
|---|---|
| `list-ui` | 62 |
| `select-form-input` | 54 |
| `select-path-input` | 46 |
| `autonumber-input` | 43 |
| `text-input` | 43 |
| `tags-input` | 40 |
| `select-data-input` | 38 |
| `select-input` | 37 |
| `number-input` | 36 |
| `date-input` | 36 |
| `textarea-input` | 34 |
| `masked-input` | 33 |
| `picture-upload-input` | 32 |
| `html-input` | 31 |
| `radio-input` | 29 |
| `switch-input` | 28 |
| `smart-card-ui` | 23 |
| `card` | 19 |
| `button-ui` | 15 |
| `sub-form` | 14 |
| `vue-ui` | 9 |
| `tab` | 6 |
| `grid` | 5 |

### ฟอร์มแม่แบบที่ใช้ก๊อป widget ได้ (ผ่าน validator ทุกไฟล์)

| ไฟล์ | ใช้เป็นแม่แบบของ |
|---|---|
| `person.json` | ครอบคลุมมากที่สุด 42 widget — `text-input` `select-input` `number-input` `date-input` `radio-input` `switch-input` `tags-input` `masked-input` `autonumber-input` `select-form-input` `picture-upload-input` `smart-card-ui` `sub-form` `card` `grid` |
| `disease.json` | `textarea-input` `select-data-input` `select-path-input` |
| `ฟอร์มปลายทาง.json` | `html-input` |
| `Lab_Result_Inbound_Receive.json` | ฟอร์ม grid + card ซ้อนหลายชั้น 47 widget |
| `Lab_Result_Inbound_Receive_User_View_EMR_Person_v2.json` | `list-ui` |
| `Lab_Bio_Order_CRUD.json` | `vue-ui` · ตัวอย่างฟอร์มที่ตั้ง `id` เองแล้วใช้งานได้ |
| `EMR.json` | `tab` |

---

## 7. ข้อจำกัดที่ยังรู้ไม่หมด — อย่าอ้างว่ายืนยันแล้ว

- **ยังไม่รู้ว่าช่องไหนใน 18 ช่องเป็นตัวที่ทำให้ render พัง** (เดาว่ากลุ่ม `labelWidth` /
  `labelAlign` / `size` ที่ใช้คำนวณ layout) — ยืนยันไม่ได้เพราะไม่มีซอร์สโค้ด SDForm
  **ดังนั้นต้องเติมให้ครบทุกช่อง ห้ามเลือกเติมเฉพาะที่คิดว่าเกี่ยว**
- 🔴 **`file-upload-input` ใช้ไม่ได้ — ยืนยันแล้ว 2026-08-25** ทดสอบใน Builder จริง 2 ตำแหน่ง
  (ใน `grid-col` และที่ root) ทั้งมีและไม่มี `key` — **ไม่ render เลยสักกรณี ไม่มีแม้แต่กล่องว่าง**
  ขณะที่ `list-ui` ใน 2 ตำแหน่งเดียวกันขึ้นปกติ → ไม่ใช่ปัญหาตำแหน่ง แต่เป็นตัวนิยาม widget เอง
  - สแกนทั้ง workspace แล้ว `file-upload-input` **โผล่เฉพาะในไฟล์ที่เราสร้างเอง** ไม่มีในฟอร์มที่ระบบ
    export มาสักไฟล์ → มีโอกาสสูงว่า**ชื่อ component ผิด** และ `options` 32 ช่องนั้นแต่งขึ้นเอง
  - component อัปโหลดที่ยืนยันว่ามีจริงคือ **`picture-upload-input`** (ใน `person.json`) แต่รับแต่รูป
  - **ทางแก้เดียว**: ลาก File Upload จาก palette หมวด Advanced Input ใน Builder ลงฟอร์มทดสอบ
    แล้ว export ออกมา จากนั้นก๊อปนิยามตัวจริงมาใช้ และเพิ่มไฟล์นั้นเข้าลิสต์ `GOLD` ใน validator
- validator ใช้ intersection จึงเป็นเกณฑ์ **ขั้นต่ำ** — ผ่าน validator ยังไม่รับประกันว่าใช้งานได้
  **การยืนยันจริงคือผู้ใช้เปิดใน Builder แล้วเห็น widget**

---

## 8. ประวัติ

| วันที่ | เหตุการณ์ |
|---|---|
| 2026-08-23 | `Lab_Result_Inbound_Receive_Failed_Preview` · `..._Broken_CardOnly` — preview ว่าง หาสาเหตุไม่เจอ เพิ่มกฎกว้าง ๆ ใน `AGENTS.md` |
| 2026-08-24 | `Result_Report_Manual_UI_Validated.json` — เกิดซ้ำอีก กฎเดิมกว้างเกินจนไม่ได้ผล |
| 2026-08-25 | หาสาเหตุเจอ (options ไม่ครบ) · แก้เป็น `Result_Report_Manual_UI_FIXED.json` · เพิ่ม `check_sdform_json.py` และเอกสารฉบับนี้ |

---

## 9. การตรวจว่า agent อ่านกฎนี้จริงหรือยัง

ถ้าเปิดอ่านไฟล์นี้แล้ว **ต้องตอบคำถามพวกนี้ได้โดยไม่ต้องเดา** และต้องอ้าง token ยืนยันด้านล่างได้

**Token ยืนยันการอ่าน:** `SDFORM-RULES-OK-2026-08-25`

| # | คำถาม | คำตอบที่ถูก |
|---|---|---|
| 1 | `text-input` ต้องมี `options` อย่างน้อยกี่ช่อง | **43** |
| 2 | ฟอร์มไหนใช้เป็นแม่แบบของ `list-ui` | `Lab_Result_Inbound_Receive_User_View_EMR_Person_v2.json` (62 ช่อง) |
| 3 | อะไรบ้างที่ **ไม่ใช่** สาเหตุ และห้ามไล่ซ้ำ | รูปแบบ `id` · `key` · `formConfig.cssCode` · widget เดี่ยวที่ root |
| 4 | ต้องรันอะไรก่อนส่งไฟล์ และต้องได้ exit code เท่าไร | `python3 check_sdform_json.py <file.json>` ต้องได้ **exit 0** |
| 5 | ฟอร์มไหนพิสูจน์ว่ารูปแบบ `id` ไม่ใช่สาเหตุ | `Lab_Bio_Order_CRUD.json` และ `Center_Lab_Order_Master_Bound.json` |

### แบบทดสอบเชิงพฤติกรรม (เชื่อถือได้กว่าการถามตอบ)

ใช้ **`fixtures/TEST_FIXTURE_broken_form.json`** (7 widget · จงใจลบ `options` ออก 21 ช่อง)
ดูเกณฑ์ให้คะแนนเต็มที่ [`fixtures/README.md`](fixtures/README.md) — **ห้ามลบหรือแก้ไฟล์ fixture ในที่เดิม**

> 🔴 **ข้อควรระวังตอนออกแบบแบบทดสอบ** — อย่าวางไฟล์คำตอบที่แก้เสร็จแล้วไว้ในโฟลเดอร์เดียวกัน
> ครั้งแรก (2026-08-25) ใช้ `Result_Report_Manual_UI_Validated.json` เป็นโจทย์ทั้งที่
> `Result_Report_Manual_UI_FIXED.json` ซึ่งเป็นคำตอบสำเร็จรูปวางอยู่ข้าง ๆ — agent เลยหยิบไปใช้ตรง ๆ
> แก้ไปแค่บรรทัดเดียว แบบทดสอบจึงพิสูจน์ไม่ได้ว่าแก้เองเป็น

agent ที่อ่านกฎแล้วต้องทำครบ 4 ข้อ:

1. รัน `check_sdform_json.py` **ก่อน** ตอบว่าเสร็จ
2. เติม `options` ที่ขาดจากฟอร์มแม่แบบ ไม่ใช่แต่งค่าขึ้นเอง
3. **ไม่แก้** `id` / `label` / `name` / `formConfig` เดิม
4. บอกชัดว่ายังต้องให้ผู้ใช้ยืนยันใน Builder จริง ไม่เคลมว่าใช้งานได้แล้ว

ถ้าส่งไฟล์กลับมาโดยไม่มีผลรัน validator = **ยังไม่ได้อ่านกฎ** ให้สั่งอ่านใหม่แล้วเริ่มงานใหม่
