# HIS–Agent Lab Interface Schema

อัปเดต: 23 สิงหาคม 2569 (Asia/Bangkok)

เอกสารนี้กำหนดขอบเขตเฉพาะการแลกเปลี่ยนข้อมูลระหว่าง **HIS** กับ
**Agent/LISconnect API** เท่านั้น ระบบหลัง Agent ไม่อยู่ในขอบเขตของ HIS
และไม่ถูกนำมาออกแบบในเอกสารนี้

## ไฟล์ประกอบ

- JSON Schema ขาส่ง Order:
  [`schemas/his-to-agent-order.schema.json`](schemas/his-to-agent-order.schema.json)
- JSON Schema ผลตอบกลับของ Order API:
  [`schemas/agent-to-his-order-response.schema.json`](schemas/agent-to-his-order-response.schema.json)
- JSON Schema ขารับ Result:
  [`schemas/agent-to-his-result.schema.json`](schemas/agent-to-his-result.schema.json)
- ERD ความสัมพันธ์:
  [`HIS_AGENT_Interface_ERD.mmd`](HIS_AGENT_Interface_ERD.mmd)
- Sequence ของ API:
  [`HIS_AGENT_Interface_Sequence.mmd`](HIS_AGENT_Interface_Sequence.mmd)
- draw.io ฉบับอ่านง่ายแบบ swimlane และ field mapping:
  [`HIS_AGENT_Interface_Easy.drawio`](HIS_AGENT_Interface_Easy.drawio)

### วิธีอ่าน Sequence diagram เดิม

- เวลาไหลจากบนลงล่าง
- เส้นตั้งใต้ชื่อ `LabUser`, `HISUI`, `HISAPI`, `HISDatabase`, `Agent`
  เป็น lifeline ของผู้เกี่ยวข้อง ไม่ใช่เส้นส่งข้อมูล
- ลูกศรแนวนอนเส้นทึบคือ request/action จากต้นทางไปปลายทาง
- ลูกศรแนวนอนเส้นประคือ response/callback กลับ
- ตำแหน่งที่อยู่ต่ำกว่าเกิดภายหลังตำแหน่งด้านบน

หากใช้เพื่ออธิบายกับผู้ใช้งานหรือประชุม requirement ให้ใช้ไฟล์ draw.io ฉบับอ่านง่าย
ซึ่งแบ่งเป็น lane และใช้เส้นสั้นระหว่างขั้นตอน ส่วน Sequence diagram เดิมเก็บไว้เป็น
technical trace สำหรับทีม API

## Contract decisions ที่ยืนยันแล้ว

1. HIS เรียก `POST {AGENT_URL}/api/orders` หลังเจ้าหน้าที่ห้อง Lab กด
   **รับ specimen** และ HIS บันทึกการรับสำเร็จแล้ว
2. HIS เป็นผู้ออก `order_no` และ `labno` ก่อนส่ง
3. `items[].test_code` ส่งค่า `his_code_id`
4. Result `items[].obs_code` ใช้ค่าเดียวกับ `test_code`/`his_code_id`
5. ความสัมพันธ์ระหว่าง Order Item กับ Result Component เป็น 1:1
6. `report_seq`, `receipt_seq` และ `result_version` เป็น string บน wire
7. `overall_status` ที่ใช้งานจริงคือ `in_progress` และ `resulted`
8. เมื่อ Order มี 3 Tests แต่ผลกลับมาเพียง 2 Tests Agent ส่ง
   `overall_status = in_progress`; เมื่อผลครบจึงส่ง `resulted`
9. `critical_low_rule` หรือ `critical_high_rule` จะมีค่าเมื่อ Result นั้นเป็น
   Critical; HIS เก็บและแจ้งเตือน แต่ไม่คำนวณ threshold ซ้ำ
10. ขาส่ง Order กันซ้ำด้วย `order_no`; ขารับ Result กันซ้ำด้วย `result_uid`

## Boundary

```text
HIS UI / HIS API  <---------->  Agent API
```

HIS รับผิดชอบ:

- สร้างและเก็บ `order_no`, `labno`
- บันทึก `collected_at`, `received_at`, `receiver`
- ประกอบ JSON Order และเรียก Agent
- เก็บ response, `dispatch_id`, สถานะ และ error
- รับ Result callback และกันซ้ำด้วย `result_uid`
- จับคู่ `test_code` กับ `obs_code`
- เก็บผลบางส่วน ผลครบ และประวัติการแก้ผลแบบ append-only

Agent รับผิดชอบ:

- ตรวจ API key และ JSON
- ตอบรับ Order ว่า queued, duplicate หรือ rejected
- ส่งสถานะ Order กลับ HIS ผ่าน process แยก
- ส่ง Result JSON กลับ HIS แบบ realtime

## Outbound: HIS ส่ง Order ไป Agent

### Trigger

ลำดับที่ต้องรักษา:

1. ผู้ใช้กดรับ specimen
2. HIS บันทึก first receive stamp แบบ idempotent
3. HIS อ่าน `collected_at`, `received_at`, `received_by`
4. HIS สร้าง payload ตาม `his-to-agent-order.schema.json`
5. HIS ส่ง `POST /api/orders`
6. HIS เก็บ response และสถานะ integration โดยไม่ย้อนสถานะรับ specimen จริง

ถ้า Agent ใช้งานไม่ได้ การรับ specimen ทางกายภาพยังคงสำเร็จใน HIS และ Order
อยู่ในสถานะรอ retry/reconcile ห้ามให้ความล้มเหลวของเครือข่ายลบ receive stamp

### Header และความปลอดภัย

```text
X-Agent-Key: secret managed by the HIS server
Content-Type: application/json
```

ห้ามใส่ key ใน Vue, SDForm client code, query string หรือ record ที่ผู้ใช้ทั่วไปอ่านได้

### Key fields

| JSON field | ความหมาย | HIS source ที่คาดไว้ |
|---|---|---|
| `order_no` | HIS order id และ idempotency key | Center order/source order; ต้องยืนยันชื่อ live field ก่อน implement |
| `labno` | LAB NO. ที่ HIS ออก | `lab_no`/`order_number` ตาม record จริง |
| `items[].test_code` | `his_code_id` | CPOE ordered item |
| `items[].collected_at` | เวลาเก็บ specimen จริง | Specimen collection record |
| `items[].received_at` | เวลา Lab กดรับ specimen | `received_at` |
| `items[].receiver` | ผู้กดรับ specimen | `received_by` หรือรหัสบุคลากรที่ map แล้ว |

`order_no` และ `labno` เป็นคนละ identifier ห้ามนำ field เดียวกันไปใส่ทั้งสองช่อง
จนกว่าจะตรวจ live record และ source order จริง

### Order response

| HTTP | การทำงานของ HIS |
|---|---|
| `202` | เก็บ `queued`, `dispatch_id`; ยังไม่แปลว่าปลายทางทำงานเสร็จ |
| `200 duplicate:true` | ถือว่าสำเร็จและไม่สร้าง outbound record ใหม่ |
| `400/413/415/422` | เก็บ error และแสดงเหตุผลให้ผู้ใช้/ผู้ดูแลแก้ข้อมูล |
| `401/403` | หยุดส่งและแจ้งผู้ดูแลเรื่อง credential/permission |
| `500/503` | คงรายการไว้ retry/reconcile ภายหลัง |

## Inbound: Agent ส่ง Result เข้า HIS

### Endpoint

```text
POST {baseUrl}/v1/process/{hl7_result_upsert_pid}
Authorization: Bearer <service JWT>
```

ต้องใช้ endpoint ที่ verify JWT จริงและสิทธิ์ service account แบบจำกัด ห้ามใช้ public process

### Matching order

HIS จับคู่ตามลำดับ:

1. `filler_order_no` ต้องตรงกับ `labno`
2. `order_no` ต้องตรงกับ HIS order
3. ตรวจ `visit_id` และ HN เป็น cross-check
4. `items[].obs_code` ต้องตรงกับ Order Item `test_code`

ห้าม match Result ด้วย HN หรือ LAB NO. เพียงค่าเดียว

### Idempotency และประวัติ

- `result_uid` เป็น unique key ของ Result message
- `result_uid` เดิมส่งซ้ำต้องตอบ `created:false` และห้ามสร้างข้อมูลซ้ำ
- `report_seq` แยกรอบรายงาน
- `receipt_seq` คือจำนวนครั้งที่ Agent รับ/ส่ง message ไม่ใช่ version ของผล
- `result_version` แยก version ของ Result Item
- Correction ต้อง append history; ห้าม overwrite ค่าเดิมโดยไม่มี audit

### Result status mapping

Agent กับฟอร์ม Manual เดิมใช้คำสถานะคนละชุด จึงต้อง map ที่ adapter:

| Agent `overall_status` | เงื่อนไข | HIS display/internal status ปัจจุบัน |
|---|---|---|
| `in_progress` | ยังไม่มี Result Item | `processing` / กำลังตรวจ |
| `in_progress` | มี Result Item อย่างน้อยหนึ่งรายการ | `resulted` / ออกผลไม่ครบ |
| `resulted` | Agent ยืนยันว่าผลครบ | `completed` / ออกผลครบ |
| `corrected` | reserved | correction flow; append history |
| `cancelled` | reserved | preserve prior results and mark cancelled |

HIS อาจนับ expected/resulted เพื่อแสดงและ reconcile แต่ `overall_status` จาก Agent
เป็นตัวตัดสินความครบ หาก Agent ส่ง `resulted` แต่รหัสผลไม่ครบตาม Order ให้เก็บ Result
และสร้าง reconciliation warning แทนการทิ้งข้อมูล

### Critical

ตาม project decision นี้:

```text
is_critical = critical_low_rule มีค่า OR critical_high_rule มีค่า
```

HIS เก็บ raw rule เป็น snapshot และแสดง alert แบบ read-only ไม่คำนวณ threshold ซ้ำ
และไม่ให้ผู้ใช้เปิด/ปิด Critical เอง

## Relationship keys

| จาก | ไป | Key |
|---|---|---|
| Lab Work Item | Outbound Order | Work Item id + `order_no` |
| Outbound Order | Inbound Result Message | `order_no` + `labno/filler_order_no` |
| Outbound Order Item | Inbound Result Item | `test_code == obs_code == his_code_id` |
| Inbound Result Message | Result Report | `result_uid`, `report_seq`, `stage` |
| Inbound Result Item | Current Result Item | Result Report + `obs_code` |
| Inbound Result Item | Result history | `result_uid` + `obs_code` + `result_version` |

## Relationship with existing HIS forms

ใช้สถาปัตยกรรมเดิม ไม่สร้างหน้าผลตรวจอีกชุด:

```text
Lab Work Item
  -> Result Report Manual Entry
      -> Lab Result Item
```

- Result callback header map เข้า Result Report
- `items[]` map เข้า Lab Result Item
- `obs_code` ใช้ค้น Result Definition และ Result Item เดิม
- Unit/reference range ต้อง snapshot ที่ Result Item
- Manual และ Agent ใช้ Result Report/Item ชุดเดียวกันผ่าน `source_mode`

ความต่างที่ adapter ต้อง normalize ก่อนบันทึก:

1. Agent sequence fields เป็น string แต่ฟอร์มเดิมบาง field เป็น Number Input
2. Agent `in_progress/resulted` ต้อง map เป็น `processing/resulted/completed`
3. `result_uid` เป็น message key; ถ้ามีหลาย receipt ห้ามเก็บไว้เฉพาะ header ช่องเดียวแล้วทับค่าเดิม

จึงแนะนำให้มี Result Receipt/Audit record แยก หรือ append-only history ที่เก็บ raw receipt
และ processing outcome ของทุก `result_uid`

## Status sync ที่ยังต้องขอ contract เพิ่ม

สเปกยืนยัน process ชื่อ `hl7_order_status_sync`, enum สถานะ และ `event_uid`
สำหรับกันซ้ำ แต่ยังไม่มี JSON sample ที่ระบุชื่อ field และชนิดข้อมูลครบ จึงยังไม่สร้าง
official JSON Schema ของ status callback เพื่อหลีกเลี่ยงการเดา

ต้องขอ Agent อย่างน้อย:

- status callback sample
- required fields
- ชนิดและ scope ของ `event_uid`
- field เวลาเกิดเหตุการณ์
- field เหตุผลเมื่อ `stalled`, `failed` หรือ `cancel_rejected`

## Non-regression

- การต่อ Agent ต้องผูกหลัง receive transaction เดิม ไม่แทนที่ receive logic
- ห้ามลบ receive, reject, specimen, work status, priority, search หรือ ListView เดิม
- ห้าม claim ว่าใช้งานจริงจนผ่าน paired/UAT tests
- ห้ามเก็บตัวอย่างข้อมูลผู้ป่วยจริงใน schema, diagram หรือ test fixture
