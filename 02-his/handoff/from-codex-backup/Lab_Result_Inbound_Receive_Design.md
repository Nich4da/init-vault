# Lab Result Inbound Receive — Form Design

## เป้าหมาย

ฟอร์ม `Lab_Result_Inbound_Receive.json` เป็น technical receipt สำหรับรับ result
message จาก Agent เข้าฝั่ง HIS โดยเก็บหนึ่ง record ต่อหนึ่ง `result_uid` และเก็บ
payload ต้นฉบับไว้ตรวจสอบย้อนหลัง ฟอร์มนี้ไม่ใช่หน้าที่เจ้าหน้าที่ใช้กรอกหรือแก้ผล
Manual และยังไม่ใช่ tab แสดงผล Lab สำหรับผู้ใช้งานปลายทาง

## เหตุผลที่แยก Receipt ออกจาก Result Report / Result Item

Agent อาจส่งผลทยอยออก ส่งข้อความเดิมซ้ำ หรือส่ง correction ในอนาคต หากเขียนทับ
Result Report เพียง record เดียวทันที HIS จะสูญเสียหลักฐานของแต่ละ message ดังนั้น
ให้รับข้อความลง Receipt ก่อน แล้ว adapter จึง materialize ข้อมูลเข้าโครงเดิม:

```text
Agent result message
  -> Lab Result Inbound Receive (append-only receipt; 1 ต่อ result_uid)
  -> Result Report (header ปัจจุบัน; 1 ต่อ Lab Work Item)
  -> Lab Result Item (ผลราย test; upsert ตามคู่ที่ระบบยืนยัน)
```

## Mapping จาก Agent schema มายังฟอร์ม

| Agent JSON | Field ในฟอร์ม | หมายเหตุ |
|---|---|---|
| `order_no` | `order_no` | correlation กับ Order ฝั่ง HIS |
| `filler_order_no` | `filler_order_no` | LAB NO. ที่ HIS เคยส่งออก |
| `hn` | `hn` | ใช้ตรวจสอบผู้ป่วยร่วมกับ Order |
| `visit_id` | `visit_id` | ใช้ตรวจสอบ visit ร่วมกับ Order |
| `result_uid` | `result_uid` | idempotency key; ห้ามสร้าง receipt ที่สองจาก UID เดิม |
| `report_seq` | `report_seq` | เก็บเป็น String ตาม wire contract |
| `stage` | `stage` | เก็บค่าจาก Agent โดยตรง |
| `overall_status` | `agent_overall_status` | แยกจากสถานะภายใน HIS |
| `reported_at` | `reported_at` | เก็บ raw ISO 8601 string |
| `reported_by.source_id` | `reported_by_source_id` | flatten เพื่อให้ค้น/แสดงใน initCraft ง่าย |
| `reported_by.source_name` | `reported_by_source_name` | flatten เพื่อให้ค้น/แสดงใน initCraft ง่าย |
| `verified_at` | `verified_at` | optional เมื่อ `in_progress`; required เมื่อ `resulted` ตาม JSON Schema |
| `verified_by.source_id` | `verified_by_source_id` | optional ตาม message state |
| `verified_by.source_name` | `verified_by_source_name` | optional ตาม message state |
| `items[]` | `items_json` | serialize array ทั้งชุด; sequence ภายในยังคงเป็น String |
| payload ทั้งก้อน | `raw_payload_json` | เก็บต้นฉบับแบบ immutable สำหรับ audit/replay |

## Field ภายใน HIS

- `receipt_status`: `received`, `processed`, `unmatched`, `error`
- `internal_overall_status`: mapping สำหรับระบบเดิม โดยไม่แก้ค่าจาก Agent
- `received_at`: เวลาที่ HIS endpoint รับ HTTP message
- `processed_at`: เวลาที่ materialize เข้า Result Report/Result Item สำเร็จ
- `result_report_id`: record ปลายทางที่ receipt นี้อัปเดต
- `payload_hash`: ใช้ตรวจ payload เดิม/เปลี่ยนภายใต้ UID เดียวกัน
- `item_count`, `critical_count`, `matched_item_count`, `unmatched_item_count`:
  summary จาก adapter
- `error_message`: เก็บเหตุผลเมื่อ validate หรือ match ไม่สำเร็จ

## Status mapping ที่ต้องทำใน adapter ภายหลัง

| Agent `overall_status` | เงื่อนไข | HIS internal status |
|---|---|---|
| `in_progress` | ยังไม่มีรายการที่ออกผล | `processing` |
| `in_progress` | มีผลแล้วบางรายการ | `resulted` (ออกผลไม่ครบ) |
| `resulted` | ผลครบตามที่ LIS คำนวณ | `completed` |
| `corrected` | future flow | `corrected` |
| `cancelled` | future flow | `cancelled` |

## Critical result

Adapter ถือว่า item เป็น Critical เมื่อมี `critical_low_rule` หรือ
`critical_high_rule` ตามข้อตกลงล่าสุด เก็บ rule ต้นฉบับไว้กับ Result Item และไม่ให้
HIS คำนวณ threshold ซ้ำ

## Parent Form

ฟอร์ม Receipt นี้ไม่ควร Join Parent Form กับ Work Item หรือ Result Report เพราะ
message ต้องถูกเก็บได้แม้การจับคู่ล้มเหลว โดยค่อยบันทึก `result_report_id` หลัง
materialize สำเร็จ Parent Form สองชั้นเดิมยังคงเป็น:

```text
Lab Work Item -> Result Report -> Lab Result Item
```

## ข้อจำกัดของ artifact รอบนี้

- รุ่นแรกถูก Import แล้วและ Preview พบปัญหา Card body ว่าง; รุ่นแก้โครง container
  ปัจจุบันยังต้อง Import และ Preview ซ้ำใน live Form Manage
- ยังไม่มี endpoint/adapter ที่ validate JSON Schema, flatten identity, serialize
  `items[]`, ป้องกัน duplicate และ materialize ผล
- `Unique Value` ที่ `result_uid` ช่วยฝั่ง Form UI แต่ API ต้องบังคับ idempotency ใน
  transaction อีกชั้นหนึ่ง
- หาก Agent ส่ง `result_uid` เดิมซ้ำ endpoint ต้องตอบรับจาก receipt เดิมและไม่สร้าง
  record/result ซ้ำ; หาก UID เดิมแต่ payload hash เปลี่ยนให้ถือเป็น error และส่งตรวจสอบ
- tab ผล Lab ในอนาคตควรอ่าน Result Report/Result Item ที่ normalize แล้ว ไม่ควรอ่าน
  raw receipt เป็นแหล่งแสดงผลหลัก

## Preview failures and template rebuild — 2026-08-23

รุ่นแรกวาง input ไว้ใต้ `Card.fields` โดยตรง ซึ่ง Builder มองเห็น field แต่
initCraft Preview แสดงเพียงหัว Card และไม่ render widget ภายใน จากหลักฐาน Preview
ที่ผู้ใช้ส่งมา จึงแก้โครงสร้างเป็นลำดับที่ runtime ใช้งานได้:

```text
Layout (grid)
  -> Grid Col
     -> Card
        -> Layout (grid)
           -> Grid Col
              -> Widget
```

การแก้ container รอบแรกยังไม่ผ่าน ผู้ใช้ส่งหลักฐาน Builder รอบสองว่ามีช่อง Grid
แต่ widget ส่วนใหญ่ไม่ render สาเหตุที่พบเพิ่มคือรุ่นนั้นสร้าง `key` 970xx/980xx
ขึ้นเองและสร้าง `options` แบบย่อ ทั้งที่ export ที่ทำงานจริงใช้ `key` ของ component
template ซ้ำได้ และมี option schema ครบตามชนิด widget

ไฟล์ปัจจุบันจึง rebuild ใหม่ด้วย `build_lab_result_inbound_receive.js` โดย clone
Card/Layout/Grid Col/Text/Select/Number จาก `person.json` และ clone Textarea จาก
working export `disease.json` แล้วแก้เฉพาะ semantic options ของ receipt form
ไฟล์ที่ล้มเหลวรอบสองเก็บไว้ที่
`Lab_Result_Inbound_Receive_Failed_Preview_2026-08-23.json`

`test_lab_result_inbound_receive.js` ตรวจ JSON parse, component key, full option
schema, container hierarchy, widget visibility, unique id/name, wire type/default,
required fields และ mapping กับ `schemas/agent-to-his-result.schema.json` แล้วผ่าน
แต่ยังห้ามถือว่า Preview ผ่านจนกว่าจะตรวจใน live initCraft Builder/Preview
