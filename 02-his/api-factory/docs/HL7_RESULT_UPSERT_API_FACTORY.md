# API Factory: `hl7_result_upsert`

อัปเดต: 26 สิงหาคม 2569 (Asia/Bangkok)

ไฟล์ Process ที่ต้องใช้:

- `hl7_result_upsert_api.js`
- API Factory Process ID ที่สร้างใน initCraft: `6a8da8a6f851000f28e50299`
- Contract: `schemas/agent-to-his-result-v2.schema.json`
- Test payload: `fixtures/agent_result_partial.json` และ `fixtures/agent_result_final.json`

## หน้าที่

Process นี้รับ Result JSON จาก Agent และทำงานตามลำดับ:

```text
Agent JSON
  -> Lab_Result_Inbound_Receive (Receipt ต่อ result_uid)
  -> จับคู่ Lab Order ด้วย LAB NO. + order_no + HN + VN
  -> Result_Report_Manual_Entry (หนึ่ง Report ต่อ report_seq/stage)
  -> LAB_result_item (snapshot ของ items ใน stage นั้น)
  -> sync zdata_specimen_collection_status.work_status
```

Process ไม่แก้ logic เก็บ specimen, รับ specimen, reject, priority, search หรือ ListView
และไม่คำนวณ critical threshold ซ้ำ

## Form IDs ที่ Process ใช้

| บทบาท | Form ID | Collection |
|---|---|---|
| Technical Receipt | `6a8b1c03f851000f28e501ef` | `zdata_lab_result_inbound` |
| Result Report | `6a8d4334f851000f28e5025b` | `zdata_lab_report_manual_entry` |
| Result Item | `6a8bc91df851000f28e501fb` | `zdata_lab_result_item` |
| Lab Order/Work Status | `6a7daa3e8d398c11cf2fe869` | `zdata_specimen_collection_status` |

## วิธีสร้างใน API Factory

1. เปิด `API Factory` แล้วสร้าง Process ชื่อ `hl7_result_upsert`.
2. วางเนื้อหาทั้งไฟล์ `hl7_result_upsert_api.js` ใน `Process(params, userInfo)`.
3. ให้สิทธิ์ Process เฉพาะ service account/role ของ Agent.
4. Service account ต้องมีสิทธิ์ดังนี้:
   - Read/Insert/Update: Receipt, Report, Result Item
   - Read/Update: Lab Order/Work Status
5. Publish แล้วเก็บ Process ID เพื่อประกอบ endpoint:

```text
POST {baseUrl}/v1/process/6a8da8a6f851000f28e50299
Authorization: Bearer <service JWT>
Content-Type: application/json
```

Body ภายนอก:

```json
{
  "params": {
    "order_no": "...",
    "filler_order_no": "...",
    "hn": "...",
    "visit_id": "...",
    "result_uid": "...",
    "report_seq": "1",
    "stage": "partial",
    "overall_status": "in_progress",
    "reported_at": "2026-08-25T10:00:00+07:00",
    "reported_by": {
      "source_id": "...",
      "source_name": "..."
    },
    "items": [
      {
        "obs_code": "...",
        "obs_name": "...",
        "value": "...",
        "obx_status": "P",
        "change_kind": "first",
        "receipt_seq": "1",
        "result_version": "1",
        "interpretation_code": "N",
        "is_critical": false
      }
    ]
  }
}
```

เวลาทดสอบให้ใช้ JSON เต็มจาก fixture เพราะ `items` ต้องมีอย่างน้อยหนึ่งรายการ

## Matching ที่บังคับ

Process จะอ่าน `zdata_specimen_collection_status` และยอมรับผลเมื่อครบทุกข้อ:

| Agent | Lab status |
|---|---|
| `filler_order_no` หรือ `labno`/`lab_no` | `order_number` (LAB NO.) |
| `order_no` | `center_order_id` |
| `hn` | `patient_hn` |
| `visit_id` | `visit_vn` หรือ `visit_id` |
| `items[].obs_code` | `selected_items[].his_code_id/item_code/test_code` |

ถ้า key ไม่ตรง หรือมี `obs_code` ที่ไม่ได้สั่ง Process จะเก็บ Receipt เป็น `unmatched`
แต่ไม่สร้าง Report และ Result Item
เพื่อป้องกันผลไปผูกผิดคนหรือผิดงาน

เมื่อ `overall_status=resulted` รายการ `items` ต้องครบทุก `selected_items` ใน Lab Order
มิฉะนั้นตอบ `FINAL_ITEMS_INCOMPLETE` และยังไม่ materialize ผล final

Lab Order ต้องอยู่ใน `received`, `processing`, `resulted` หรือ `completed` ก่อนรับ Result

## Idempotency และ version

- `result_uid` เดิม: ตอบ `created:false`, `duplicate:true` และไม่เขียนซ้ำ
- Report ใช้ `report_key = order_no|filler_order_no|visit_id|order_status_id|report_seq|stage`
- partial/final/corrected เป็น Report คนละ record เพื่อแสดงผลเป็นขั้นและเก็บประวัติ
- Report ต้องมี `xparentx = Lab Order Item Status ID`
- Result Item ต้องมี `xparentx`, `parent_id.value`, `result_report_id` = Report ID
- `result_version` ต่ำกว่าเวอร์ชันล่าสุด: ตอบ `STALE_ITEM_VERSION`
- `result_version` เท่าเดิมและ value เท่าเดิม: สร้าง snapshot ใน stage ใหม่ได้โดยไม่เพิ่ม edit history
- `result_version` เท่าเดิมแต่ value ต่าง: ตอบ `RESULT_VERSION_CONFLICT`
- version ใหม่: สร้าง Item snapshot และ append `edit_history_json` จากประวัติก่อนหน้า
- `report_seq` ต้องเพิ่มขึ้น และห้ามย้อนสถานะจาก completed/corrected กลับเป็น partial

## Status mapping

| Agent | Report | Lab work status |
|---|---|---|
| `in_progress` | `partial` | `resulted` |
| `resulted` | `completed` | `completed` |
| `corrected` | `corrected` | คง `completed` |
| `cancelled` | `cancelled` | `cancelled` |

Critical ใช้คำตัดสินที่ Agent ส่งมาอย่างชัดเจน:

```text
is_critical = items[].is_critical
หรือ derive จาก interpretation_code: LL / HH / AA = critical
```

`critical_low_rule` และ `critical_high_rule` เป็น snapshot ของกติกาเท่านั้น การมี rule
ไม่ได้แปลว่าค่าผลครั้งนั้น critical หาก Agent ไม่ส่งคำตัดสิน API จะเก็บผลเป็น non-critical
พร้อม `PROCESSED_WITH_WARNING`

## Test sequence หลัง Publish

1. เตรียม Lab Status test ที่มี `order_number`, `center_order_id`, `patient_hn`,
   `visit_vn` และ `selected_items[].his_code_id` ตรงกับ fixture.
2. ส่ง `agent_result_partial.json` — ต้องได้ `code=PROCESSED`, Report 1 record,
   Item Sodium 1 record และ work status `resulted`.
3. ส่ง partial ตัวเดิมซ้ำ — ต้องได้ `DUPLICATE_RESULT_UID` และจำนวน record ไม่เพิ่ม.
4. ส่ง final ที่ขาด Potassium — ต้องได้ `FINAL_ITEMS_INCOMPLETE` และยังไม่สร้าง Report/Item.
5. ส่ง `agent_result_final.json` — ต้องสร้าง Report stage ใหม่, สร้าง Sodium/Potassium snapshots
   และเปลี่ยน work status เป็น `completed` โดยไม่แก้ partial เดิม.
6. เปิด Result Report Viewer ด้วย Report ID ที่ API ตอบกลับ — ตรวจว่า Report `xparentx`
   เป็น Work Status ID และ Item `xparentx`, `parent_id.value`, `result_report_id` เป็น Report ID เดียวกัน.
7. ส่ง corrected ด้วย `report_seq` ใหม่ — ต้องสร้าง corrected Report และคง partial/final เดิม.
8. ทดสอบ `order_no` ผิดหนึ่งตัว — ต้องได้ `ORDER_NOT_MATCHED` และมีเพียง Receipt `unmatched`.

## ข้อจำกัดก่อน Production

การทดสอบใน repository เป็น mock behavioral test ยังไม่ใช่การยิง Process บน initCraft จริง
และ API นี้ใช้ SDForm pipeline หลาย write จึงไม่ใช่ transaction เดียวทั้ง Receipt/Report/Items.

ก่อน production ควรสร้าง/ยืนยัน unique index:

- Receipt: `result_uid`
- Report: `report_key`
- Result Item: `result_report_id + obs_code`

จากนั้นต้องทำ paired test กับ Agent และ concurrency/retry test จริงก่อนประกาศพร้อมใช้งาน
