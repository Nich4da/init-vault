# -*- coding: utf-8 -*-
"""lab_result_forms_relation.drawio — 3 CRUD forms + 1 UI form: relations, roles,
and coverage against the Agent spec / wire JSON.
Sources: 02-his/handoff/LAB_RESULT_3_FORM_SCHEMA_AND_UI.md (25 ส.ค. 2569),
         codex-backup/schemas/*.json, LIS/his-order-sample.json, LIS/his-result-sample.json"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drawio_kit import *

pages = []

# ══════════════════════════════════════════════════ P1 · ความสัมพันธ์
p = Page("labform-rel", "1 · ความสัมพันธ์ 4 ฟอร์ม", h=1420)
p.title("3 CRUD Forms + 1 UI Form — เชื่อมกันด้วยอะไร และเชื่อมกันตรงไหน",
        "จาก LAB_RESULT_3_FORM_SCHEMA_AND_UI.md (25 ส.ค. 2569) · ตัวเลขคือ live configuration ที่ตรวจแล้ว")

p.band(100, "แผนผังความสัมพันธ์ — สังเกตว่ามีการเชื่อม 3 แบบ ไม่เหมือนกัน")

ext = p.card(40, 160, 300, 130, "Lab Work Item / Order Status",
             "งานสั่งตรวจฝั่ง HIS — <b>อยู่นอก 3 ฟอร์มนี้</b><br><br>"
             "เป็นต้นทางของทั้งขาส่ง order และ Manual Result", "gray")
rcp = p.card(430, 160, 330, 210, "① Lab_Result_Inbound_Receive",
             "CRUD · <b>form_db</b><br>id <b>6a8b1c03f851000f28e501ef</b><br>"
             "→ <b>zdata_lab_result_inbound</b><br><br>"
             "1 record = <b>1 ข้อความ</b>ที่รับจาก Agent<br>"
             "<b>ไม่มี Join Parent</b> (ถูกต้องแล้ว)<br>"
             "<b>record_kind = receipt</b>", "purple")
rep = p.card(880, 160, 330, 230, "② Result_Report_Manual_Entry",
             "CRUD · <b>form_db</b><br>id <b>6a8d4334f851000f28e5025b</b><br>"
             "→ <b>zdata_lab_report_manual_entry</b><br><br>"
             "1 record = <b>หัวชุดผลของ 1 LAB NO.</b><br>"
             "<b>record_kind = report</b><br>"
             "⚠️ live: <b>ยังไม่มี Join Parent</b> — อ้างงาน Lab ด้วย <b>order_status_id</b>", "purple")
itm = p.card(1330, 160, 330, 230, "③ LAB_result_item",
             "CRUD · <b>form_db</b><br>id <b>6a8bc91df851000f28e501fb</b><br>"
             "→ <b>zdata_lab_result_item</b><br><br>"
             "1 record = <b>1 ผลตรวจ (Test/OBS component)</b><br>"
             "✅ live: <b>เปิด Join Parent ไป ② แล้ว</b><br>"
             "Parent field <b>_id</b> → child <b>parent_id</b>", "purple")
vwr = p.card(880, 560, 780, 150, "UI · Result Report Viewer",
             "<b>form_ui</b> · id <b>6a8d5620f851000f28e50270</b> · <b>ไม่มี collection / ไม่มี table ของตัวเอง</b><br>"
             "แสดงหัวรายงาน (LAB NO. · HN · VN · ชื่อผู้ป่วย · reported/verified) + ListView "
             "<b>result_report_viewer_items_list</b><br>"
             "🔴 ไม่ใช่ตารางข้อมูลเพิ่ม — ทุกค่าที่เห็นมาจาก ② และ ③ หรือ params/API ตอนเปิด", "blue")
tab = p.card(40, 560, 780, 150, "หน้า Lab รวม → Tab ออกผล <i>(ยังต้องออกแบบ)</i>",
             "ListView source = <b>Result_Report_Manual_Entry</b> (1 แถวต่อ LAB NO./งาน)<br>"
             "Buttons Row: ปุ่ม <b>ดูผล</b> → เปิด Viewer พร้อม <b>params.result_report_id</b>", "yellow")

p.edge(ext, rcp, "", ("1", "0.5"), ("0", "0.5"), dashed=True)
p.edge(rcp, rep, "N : 1", ("1", "0.5"), ("0", "0.5"))
p.edge(rep, itm, "1 : N", ("1", "0.5"), ("0", "0.5"))
p.edge(tab, vwr, "ปุ่ม “ดูผล” → params.result_report_id", ("1", "0.5"), ("0", "0.5"))
p.edge(rep, vwr, "อ่าน header", ("0.25", "1"), ("0.25", "0"), dashed=True)
p.edge(itm, vwr, "ListView อ่าน items", ("0.5", "1"), ("0.85", "0"), dashed=True)
p.edge(ext, rep, "order_status_id", ("0.5", "1"), ("0", "0.85"), dashed=True)

p.text(430, 380, 330, 40,
       "<b>① → ② เป็น logical reference</b><br><i>ไม่ใช่</i> Join Parent ของ initCraft", 10,
       "align=center;verticalAlign=top;")
p.text(1330, 400, 330, 40,
       "<b>② → ③ เป็น Join Parent จริง</b><br>บันทึกใน live configuration แล้ว", 10,
       "align=center;verticalAlign=top;")

p.band(740, "การเชื่อม 3 แบบ — อย่าสลับกัน")
p.box(40, 790, 620, 195,
      "<b>แบบ A · logical reference ผ่าน API (① → ②)</b><br><br>"
      "<code>Receipt.result_report_id → Report._id</code><br>"
      "หรือค้นด้วย <code>Receipt.report_key</code><br><br>"
      "🔴 <b>ห้ามทำเป็น Join Parent</b> เพราะ<br>"
      "&nbsp;• 1 Report มีได้หลาย Receipt (partial → final → corrected)<br>"
      "&nbsp;• Receipt ที่ unmatched/error ต้องอยู่ได้<b>โดยยังไม่มี Report</b>", "purple", size=11)
p.box(700, 790, 620, 195,
      "<b>แบบ B · Join Parent ของ initCraft (② → ③)</b><br><br>"
      "<code>Parent Form&nbsp;&nbsp;&nbsp;&nbsp;= Result_Report_Manual_Entry</code><br>"
      "<code>Parent Form ID = 6a8d4334f851000f28e5025b</code><br>"
      "<code>Join Parent Field = _id</code><br>"
      "<code>Child Field Name&nbsp; = parent_id</code><br><br>"
      "สร้าง child ผ่าน parent context → initCraft เก็บ <b>xparentx</b> + snapshot ใน <b>parent_id.*</b>", "green", size=11)
p.box(1360, 790, 600, 195,
      "<b>แบบ C · params + ListView filter (② ③ → Viewer)</b><br><br>"
      "เปิด Viewer ด้วย <code>params.result_report_id</code><br><br>"
      "ListView <b>result_report_viewer_items_list</b><br>"
      "source form = <b>LAB_result_item</b> (6a8bc91d…)<br>"
      "<code>xparentx = CONVERT('&lt;result_report_id&gt;','objectId')</code>", "blue", size=11)

p.box(40, 1005, 1920, 78,
      "🔴 <b>กฎ 3 ตัวชี้ต้องตรงกันเสมอ — ไม่ตรงเมื่อไหร่ถือว่าข้อมูลเสียความสัมพันธ์</b><br>"
      "<code>LAB_result_item.xparentx</code> &nbsp;=&nbsp; <code>LAB_result_item.parent_id.value</code> "
      "&nbsp;=&nbsp; <code>LAB_result_item.result_report_id</code> &nbsp;=&nbsp; "
      "<code>Result_Report_Manual_Entry._id</code><br>"
      "<i>Join Parent เขียน 2 ตัวแรกให้อัตโนมัติ · ตัวที่สาม Adapter ต้องเขียนเองเพื่อใช้ query/idempotency</i>",
      "red", size=11)

p.box(40, 1100, 940, 100,
      "<b>Cardinality ที่ต้องจำ</b><br>"
      "Agent messages / Receipts &nbsp;<b>หลายข้อความ</b><br>"
      "&nbsp;&nbsp;→ Report Header &nbsp;<b>1 ชุดต่อ logical Lab result work</b><br>"
      "&nbsp;&nbsp;&nbsp;&nbsp;→ Result Items &nbsp;<b>หลายรายการต่อ Report</b>", "gray", size=11)
p.box(1020, 1100, 940, 100,
      "🔴 <b>ไม่ใช่ 1 record → 1 record → 1 record</b><br>"
      "• partial / final / corrected → หลาย Receipt ของ Report เดียวกัน<br>"
      "• 1 Report มีหลาย Result Item<br>"
      "• 1 Test/Panel ที่สั่ง อาจแตกเป็นหลาย OBS component", "red", size=11)

p.legend(1225, LEGEND_STD, w=1500)
pages.append(p)

# ══════════════════════════════════════════════════ P2 · แต่ละฟอร์มมีไว้ทำอะไร
p = Page("labform-role", "2 · แต่ละฟอร์มมีไว้ทำอะไร", h=1430)
p.title("แต่ละฟอร์มมีไว้ทำอะไร เพื่ออะไร — และห้ามทำอะไร",
        "อ่านเป็นคอลัมน์: 1 record คืออะไร → มีไว้เพื่ออะไร → ทำไมต้องแยก → ห้าม")

COLS = [(40, 465), (525, 465), (1010, 465), (1495, 465)]
HEADS = [("① Lab_Result_Inbound_Receive", "CRUD · zdata_lab_result_inbound"),
         ("② Result_Report_Manual_Entry", "CRUD · zdata_lab_report_manual_entry"),
         ("③ LAB_result_item", "CRUD · zdata_lab_result_item"),
         ("UI Result Report Viewer", "form_ui · ไม่มี table")]
COLORS = ["purple", "purple", "purple", "blue"]
for (x, w), (t, s), c in zip(COLS, HEADS, COLORS):
    p.card(x, 100, w, 62, t, s, c)

ROWS = [
    ("1 record คืออะไร", 210, 105, [
        "<b>1 ข้อความผลที่ HIS รับจาก Agent</b> 1 เหตุการณ์<br><code>record_kind = receipt</code>",
        "<b>หัวชุดผลของ 1 logical Lab result work / 1 LAB NO.</b><br><code>record_kind = report</code>",
        "<b>1 ผลตรวจที่รายงานได้</b> เช่น Sodium, Creatinine หรือ organism 1 component",
        "<b>ไม่มี record</b> — เป็นหน้าจอล้วน ๆ ไม่มี collection ของตัวเอง"]),
    ("มีไว้เพื่ออะไร", 365, 175, [
        "• เก็บหลักฐานข้อความต้นทาง + audit ทางเทคนิค<br>"
        "• กัน retry/duplicate ด้วย <b>result_uid</b><br>"
        "• เก็บ <b>raw_payload_json</b> / <b>items_json</b> / <b>payload_hash</b><br>"
        "• เก็บ counts: item/critical/matched/unmatched<br>"
        "• เก็บ <b>error_message</b> เมื่อ validate/match/materialize ไม่ผ่าน",
        "• ค้นได้ <b>1 แถวต่อ LAB NO./งาน</b> ในหน้า Tab ออกผล<br>"
        "• คำนวณสถานะรวม กำลังตรวจ / ออกผลบางส่วน / ออกผลครบ<br>"
        "• เก็บข้อมูลระดับ LAB NO. (HN, VN, ผู้ลงผล, ผู้รับรอง, เวลารายงาน) <b>ไม่ให้ซ้ำในทุกผล</b><br>"
        "• เป็นจุดที่ Agent/LIS และ Manual มาบรรจบกัน",
        "• ให้ update ผลบางรายการโดย<b>ไม่เขียนทับรายการอื่น</b><br>"
        "• รองรับ Panel ที่แตกเป็นหลาย result component (เรียงด้วย <b>result_sequence</b>)<br>"
        "• เก็บ version / correction / audit ราย item<br>"
        "• เป็นที่เดียวที่ผู้ใช้แก้ <b>result_value</b>",
        "• เปิดจากปุ่ม <b>ดูผล</b> ใน Tab ออกผล<br>"
        "• แสดง header จาก ② + ListView items จาก ③<br>"
        "• คลิกในรายการ → เปิด <b>LAB_result_item</b> ราย record โดยส่ง <b>_id</b> เป็น <b>dataId</b>"]),
    ("ทำไมต้องแยกออกมา", 590, 165, [
        "ข้อความอาจ <b>ซ้ำ / จับคู่ไม่สำเร็จ / schema ผิด / partial / correction</b><br><br>"
        "ถ้าเขียนทับ Report ตรง ๆ จะ<b>เสียหลักฐานข้อความต้นทาง</b>และหาสาเหตุย้อนหลังไม่ได้<br><br>"
        "Receipt จึงต้องอยู่ได้<b>แม้ยังสร้าง Report/Item ไม่สำเร็จ</b>",
        "ข้อมูลระดับ LAB NO. ไม่ควรถูกทำซ้ำเป็น record หลักของ<b>ทุก</b>ผลตรวจ<br><br>"
        "และต้องมีหัวเดียวให้ทั้ง <b>Agent/LIS</b> และ <b>Manual</b> เกาะ "
        "เพื่อให้หน้าปลายทางแสดงรวมกันได้",
        "แต่ละ Test/OBS มี<b>ชนิดผล, ค่า, หน่วย, Ref.Range, interpretation, critical และ version ต่างกัน</b><br><br>"
        "ถ้ายัดรวมในหัวรายงาน จะ update รายเดียวไม่ได้ และรองรับ Panel หลาย component ไม่ได้",
        "Viewer <b>ไม่ใช่ data form</b> — ถ้าทำเป็น CRUD จะกลายเป็นข้อมูลชุดที่ 4 ที่ต้อง sync<br><br>"
        "หน้าที่ของมันคือ<b>ประกอบภาพ</b>จาก ② + ③ เท่านั้น"]),
    ("🔴 ห้าม", 805, 150, [
        "• ห้ามให้ผู้ใช้ Lab ทั่วไปแก้ค่าที่ Agent ส่งมา<br>"
        "• ห้ามทำ Join Parent ไป ②<br>"
        "• ห้ามทิ้งข้อความที่จับคู่ไม่ได้",
        "• 🔴 <b>ห้ามสร้าง Report ใหม่ทุกครั้งที่ result_uid เปลี่ยน</b> — ต้องค้นด้วย <b>report_key</b> "
        "หรือ stable Work Item key<br>"
        "• ห้ามใช้ <b>result_uid</b> เป็น identity เดียวของ Report<br>"
        "• ไม่ใช่เอกสาร PDF และไม่ใช่ receipt ใหม่",
        "• สำหรับ Lab ปกติ ห้ามเปิดแก้ Unit / interpretation / Ref.Range / Critical<br>"
        "• ห้ามแก้ผลแบบไม่ append <b>edit_history_json</b><br>"
        "• 🔴 ห้ามถือว่า <b>test_code = obs_code = his_code_id</b> จนกว่า contract จะยืนยัน",
        "• 🔴 ห้ามพึ่ง <b>File Upload ใน form_ui</b> อย่างเดียว — <b>result_attachments</b> "
        "ยังไม่มี persistence ต้องเก็บ metadata ใน Report CRUD หรือ collection เอกสารที่ผูก "
        "<b>result_report_id</b>"]),
]
for label, y, h, cells in ROWS:
    p.band(y - 35, label)
    fill = "red" if label.startswith("🔴") else "gray"
    for (x, w), txt in zip(COLS, cells):
        p.box(x, y, w, h, txt, fill, size=10)

p.band(985, "สรุปสั้นที่สุด — ถ้าจำได้ 4 บรรทัดนี้ก็พอ")
SUM = [("① Lab_Result_Inbound_Receive", "= เก็บว่า <b>Agent ส่งอะไรมา</b> และประมวลผลสำเร็จหรือไม่", "purple"),
       ("② Result_Report_Manual_Entry", "= <b>หัวชุดผลของ LAB NO. หนึ่งงาน</b> ใช้ค้นและเปิดดูผล", "purple"),
       ("③ LAB_result_item", "= <b>ผลแต่ละ Test/OBS</b> ที่แสดงและแก้ result_value ได้", "purple"),
       ("UI Result Report Viewer", "= <b>หน้าจอปลายทาง</b> อ่าน Report + Items · ไม่มี table ของตัวเอง", "blue")]
for i, (a, b, c) in enumerate(SUM):
    y = 1035 + i * 52
    p.box(40, y, 520, 44, "<b>%s</b>" % a, c, size=11, valign="middle")
    p.box(570, y, 1390, 44, b, "gray", size=11, valign="middle")

p.band(1265, "หมายเหตุเรื่องคำว่า “Report”")
p.box(40, 1315, 1920, 60,
      "“Report” ในเอกสารนี้ = <b>ชุดข้อมูลผลตรวจของ LAB NO. หนึ่งงาน</b> — "
      "<b>ไม่ได้</b>หมายถึงเอกสาร PDF หรือ Report Factory<br>"
      "ถ้าต้องพิมพ์เอกสารผล Lab ต้องมีปุ่ม / Report Factory <b>แยกต่างหาก</b>ในภายหลัง", "yellow", size=11)
pages.append(p)

# ══════════════════════════════════════════════════ P3 · JSON ขารับ → 3 ฟอร์ม
p = Page("labform-in", "3 · JSON ขารับ → ฟอร์มไหน", h=1640)
p.title("JSON ขารับผล (Agent → HIS) ลงฟอร์มไหนบ้าง",
        "schema: agent-to-his-result.schema.json · ตัวอย่างจริง: LIS/his-result-sample.json (result_uid \"rpt-7\") · "
        "★ = required ตาม schema")

p.band(100, "ระดับใบสั่ง (11 required + 2 optional) — ลงทั้ง ① และ ② เป็น snapshot")
for x, w, t in ((40, 380, "field ใน payload"), (430, 470, "① Receipt"),
                (920, 470, "② Report"), (1410, 550, "หมายเหตุจาก schema")):
    p.box(x, HDY := 150, w, 32, "<b>%s</b>" % t, "gray", size=11, bold=True, valign="middle")

HEAD = [
    ("★ order_no", "order_no", "order_no", ""),
    ("★ filler_order_no", "filler_order_no", "filler_order_no", "= <b>labno</b> ที่ HIS ออกและส่งไปตอนสั่ง (confirmed)"),
    ("★ hn", "hn", "hn", "ใช้ cross-check เท่านั้น ห้ามใช้จับคู่เดี่ยว"),
    ("★ visit_id", "visit_id", "visit_id", ""),
    ("★ result_uid", "result_uid <b>(idempotency key)</b>", "result_uid <i>(ล่าสุดเท่านั้น)</i>",
     "🔴 result_uid เดิม <b>ห้าม</b>สร้าง receipt ที่สอง · และ<b>ห้าม</b>ใช้เป็น identity ของ Report"),
    ("★ report_seq", "report_seq", "report_seq", "wire type = <b>string ของตัวเลข</b> (^[0-9]+$)"),
    ("★ stage", "stage", "stage", "เช่น partial / final / corrected"),
    ("★ overall_status", "agent_overall_status<br>internal_overall_status", "agent_overall_status<br>internal_overall_status",
     "enum 4 ค่า — ใช้จริงตอนนี้แค่ <b>in_progress</b> · <b>resulted</b><br>corrected / cancelled สงวนไว้"),
    ("★ reported_at", "reported_at", "reported_at", "🔴 บังคับลงท้าย <b>+07:00</b> ตาม pattern"),
    ("★ reported_by.source_id / .source_name", "reported_by_source_id / _name", "reported_by_source_id / _name",
     "มีแค่ source_* — <b>ไม่มี his_id</b> · HIS เป็นเจ้าของ mapping"),
    ("verified_at", "verified_at", "verified_at",
     "🔴 <b>บังคับเมื่อ overall_status = resulted</b> (เงื่อนไข allOf ใน schema)"),
    ("verified_by.source_id / .source_name", "verified_by_source_id / _name", "verified_by_source_id / _name",
     "🔴 บังคับเมื่อ resulted เช่นกัน"),
    ("★ items[]", "<b>items_json</b> (snapshot) + counts", "<b>items_json</b> (snapshot) + counts",
     "แตกเป็น record จริงที่ ③ · minItems = 1"),
]
y = HDY + 32
for a, b, c, d in HEAD:
    hot = "🔴" in d
    p.box(40, y, 380, 46, "<b>%s</b>" % a, "green", size=11, valign="middle")
    p.box(430, y, 470, 46, b, "purple", size=10, valign="middle")
    p.box(920, y, 470, 46, c, "purple", size=10, valign="middle")
    p.box(1410, y, 550, 46, d, "red" if hot else "gray", size=10, valign="middle")
    y += 46

p.band(y + 25, "ระดับรายการผล — items[] (7 required + 9 optional) ลง ③ LAB_result_item ทุกตัว")
y2 = y + 75
for x, w, t in ((40, 380, "field ใน items[]"), (430, 470, "③ LAB_result_item"), (920, 1040, "หมายเหตุ")):
    p.box(x, y2, w, 32, "<b>%s</b>" % t, "gray", size=11, bold=True, valign="middle")
ITEMS = [
    ("★ obs_code", "obs_code", "🔑 คีย์ map กับ Result Definition · schema ระบุว่า <b>= test_code ขาส่ง = his_code_id</b> "
     "แต่ handoff ยังสั่งว่า<b>ห้ามถือว่าเป็นรหัสเดียวกันจนกว่า contract จะยืนยัน</b> → ยังขัดกันอยู่"),
    ("★ obs_name", "obs_name → <b>test_name</b> (snapshot)", "แยก raw กับ snapshot เพื่อให้ผลเก่าไม่เปลี่ยนตาม Master"),
    ("★ value", "<b>result_value</b>", "wire เป็น <b>string เสมอ</b> เพราะผลอาจเป็นตัวเลขหรือข้อความ"),
    ("units", "<b>unit_symbol_snapshot</b>", "Lab ปกติ = read-only"),
    ("ref_range", "<b>reference_range_snapshot</b>", "Lab ปกติ = read-only"),
    ("★ obx_status", "obx_status", "เก็บค่าดิบ <b>รวมค่าที่ HIS ยังไม่รู้จัก</b> — ห้าม error"),
    ("★ change_kind", "change_kind", "ตัวอย่างจริงส่ง <code>\"first\"</code>"),
    ("previous_value", "previous_value", "ค่าก่อนแก้ ใช้แสดง audit"),
    ("★ receipt_seq", "receipt_seq", "string ของตัวเลข · 🔴 <b>≠ result_version</b>"),
    ("★ result_version", "result_version", "string ของตัวเลข · correction → +1 ห้ามทับ"),
    ("critical_low_rule<br>critical_high_rule", "critical_low_rule / critical_high_rule<br>→ <b>is_critical</b> (Switch, disabled)",
     "🔴 <b>project decision: “มี rule = ผลนี้ critical”</b> · HIS เก็บ rule ดิบและ<b>ไม่ประเมิน threshold เอง</b> "
     "— แต่ handoff <b>ยังไม่ได้ระบุกติกาแปลง rule → is_critical</b>"),
    ("panel_code / panel_name", "panel_code / panel_name", "จัดผลหลายตัวให้อยู่ใต้ Panel เดียวกัน"),
    ("group_role", "group_role", ""),
    ("organism", "organism", "สำหรับผล Microbiology"),
]
y = y2 + 32
for a, b, c in ITEMS:
    p.box(40, y, 380, 44, "<b>%s</b>" % a, "green", size=10, valign="middle")
    p.box(430, y, 470, 44, b, "purple", size=10, valign="middle")
    p.box(920, y, 1040, 44, c, "red" if "🔴" in c else "gray", size=10, valign="middle")
    y += 44

p.box(40, y + 20, 1920, 62,
      "✅ <b>ตรวจแล้ว: ตัวอย่าง his-result-sample.json ผ่าน schema ครบ</b> — required ครบ 11 + items ครบ 7, "
      "ไม่มี field เกิน (schema เป็น additionalProperties:false)<br>"
      "✅ <b>ทุก field ในขารับผล มีที่ลงในฟอร์มใดฟอร์มหนึ่งครบ</b> — ไม่มี field ที่ตกหล่น", "green", size=11)
pages.append(p)

# ══════════════════════════════════════════════════ P4 · ขาส่ง + response
p = Page("labform-out", "4 · ขาส่ง order + response", h=1330)
p.title("ขาส่ง (HIS → Agent) และ response — ส่วนที่ handoff 3 ฟอร์ม “ยังไม่ครอบคลุม”",
        "schema: his-to-agent-order.schema.json · agent-to-his-order-response.schema.json · ตัวอย่าง: LIS/his-order-sample.json")

p.band(100, "วงจรเต็ม — 3 ฟอร์มนี้อยู่แค่ครึ่งขวา")
o1 = p.card(40, 155, 300, 120, "Lab Work Item (รับ specimen)",
            "ผู้ใช้ห้องแล็บรับสิ่งส่งตรวจ → HIS <b>ออก labno</b>", "gray")
o2 = p.card(390, 155, 320, 120, "POST {AGENT_URL}/api/orders",
            "<b>his-to-agent-order</b> · header <b>X-Agent-Key</b><br>24 field ระดับใบสั่ง + items[]", "green")
o3 = p.card(760, 155, 300, 120, "Response",
            "<b>202 queued</b> / <b>200 duplicate = สำเร็จ</b><br>หรือ error enum 10 ค่า", "green")
o4 = p.card(1110, 155, 300, 120, "ห้องแล็บตรวจ",
            "ผลอาจทยอยมาหลายครั้ง", "gray")
o5 = p.card(1460, 155, 500, 120, "callback ผล → ① ② ③ (หน้า 1–3)",
            "<b>agent-to-his-result</b> → hl7_result_upsert", "purple")
for a, b in ((o1, o2), (o2, o3), (o3, o4), (o4, o5)):
    p.edge(a, b, "", ("1", "0.5"), ("0", "0.5"))

p.box(40, 300, 1020, 46,
      "🔴 <b>ครึ่งซ้ายนี้ไม่มีที่เก็บใน 3 ฟอร์ม</b> — handoff ครอบคลุมเฉพาะ “ขารับผล”",
      "red", size=11, valign="middle")

p.band(370, "สองสัญญาที่ผูกขาส่งกับขารับ — ถ้าพังตรงนี้ ผลจะกลับมาไม่เจอใบสั่ง")
p.box(40, 420, 940, 130,
      "<b>สัญญาที่ 1 · เลขใบสั่ง</b><br><br>"
      "ขาส่ง <code>labno</code> &nbsp;&nbsp;──►&nbsp;&nbsp; ขารับ <code>filler_order_no</code><br>"
      "<i>“the labno originally issued and sent by HIS”</i> (คำในสเปค)<br>"
      "HIS เป็นผู้ออก · รูปแบบ <b>{ปีพ.ศ.2}{MM}{DD}{ลำดับ4}</b> · ตัวอย่าง <code>6908090001</code>", "blue", size=11)
p.box(1020, 420, 940, 130,
      "<b>สัญญาที่ 2 · รหัสรายการตรวจ</b><br><br>"
      "ขาส่ง <code>items[].test_code</code> &nbsp;──►&nbsp; ขารับ <code>items[].obs_code</code><br>"
      "<i>“equals the outbound test_code and therefore his_code_id”</i> (คำในสเปค)<br>"
      "🔴 แต่ handoff §7.4 เขียนว่า <b>“ห้ามถือว่า test_code, obs_code และ his_code_id เป็นรหัสเดียวกัน "
      "จนกว่า contract จะยืนยัน”</b> → <b>ขัดกันเอง ต้องเคาะ</b>", "yellow", size=11)

p.band(570, "his-to-agent-order — โครงสร้าง payload ขาส่ง")
p.box(40, 620, 620, 250,
      "<b>ระดับใบสั่ง · required 6</b><br>"
      "★ <b>order_no</b> — idempotency key ขาส่ง<br>★ <b>labno</b><br>★ hn<br>★ ordered_at<br>"
      "★ <b>priority</b> — enum <b>S / A / R</b><br>★ items[] (minItems 1)<br><br>"
      "<b>optional 17</b><br>visit_id · requested_at · note · patient_prefix / first / last · birth_date · sex · "
      "visit_type · doctor_code / title / name · clinic_code / name · station · station_seq · "
      "mongo_form_id · mongo_data_id", "green", size=10)
p.box(700, 620, 620, 250,
      "<b>items[] · required 7</b><br>"
      "★ <b>seq</b> — <b>integer</b> (ต่างจากขารับที่เป็น string)<br>★ <b>test_code</b> = his_code_id<br>"
      "★ test_name<br>★ specimen_code<br>★ collected_at<br>★ received_at<br>★ receiver<br><br>"
      "<b>optional 3</b><br>specimen_name · collector_code · collector_name", "green", size=10)
p.box(1360, 620, 600, 250,
      "<b>🔴 เวลาและรูปแบบ</b><br><br>"
      "ขาส่งรับ 2 รูปแบบ: <code>YYYYMMDDHHmmss</code> หรือ ISO ลงท้าย <code>+07:00</code><br>"
      "ขารับ<b>บังคับ ISO +07:00 อย่างเดียว</b><br><br>"
      "<code>birth_date</code> = <code>YYYYMMDD</code> หรือ <code>YYYYMMDDHHmmss</code><br><br>"
      "🔴 ต้องเป็น<b>เวลาไทย</b> — ปลายทางอ่านตัวเลขตามที่เห็น ไม่แปลงโซน", "red", size=10)

p.band(890, "🔴 ตรวจพบ: ตัวอย่าง his-order-sample.json ไม่ผ่าน schema ขาส่ง")
p.box(40, 940, 1180, 150,
      "<b>schema เป็น additionalProperties: false ทั้งระดับบนและใน items[]</b><br>"
      "ตัวอย่างมี <b>6 field ที่ schema ไม่รับ</b>:<br><br>"
      "ระดับใบสั่ง → <code>special_request</code> · <code>diagnosis</code> · "
      "<code>antimicrobial_used</code> · <code>underlying_disease</code><br>"
      "ใน items[] → <code>lab_code</code> (ทั้ง 2 รายการ)<br><br>"
      "<i>(required ครบทุกตัว — ปัญหาคือ field เกิน ไม่ใช่ field ขาด)</i>", "red", size=11)
p.box(1260, 940, 700, 150,
      "<b>ยังไม่ตัดสินว่าฝั่งไหนถูก</b><br><br>"
      "เป็นได้ 2 ทาง — ต้องเคาะกับทีม LISconnect:<br>"
      "(ก) ไฟล์ schema ในเครื่องเก่ากว่า spec — sample ถูก<br>"
      "(ข) sample ใส่ field เกิน — schema ถูก<br><br>"
      "เทียบกับบันทึกเดิม: สเปค 2026-08-23 ระบุว่าต้องเพิ่ม <b>14 field ระดับใบสั่ง + 3 ใน items[]</b> "
      "→ น้ำหนักเอียงไปทาง (ก)", "yellow", size=11)

p.band(1110, "agent-to-his-order-response — และคำถามว่าเก็บไว้ที่ไหน")
p.box(40, 1160, 940, 130,
      "<b>สำเร็จ</b> — required <code>ok:true</code> · <code>order_no</code> · <code>duplicate</code><br>"
      "optional <code>order_ref</code> · <code>routed_to[]</code> · <code>dispatch_id</code><br>"
      "🔴 <b>duplicate: true ถือว่าสำเร็จ</b> (unique constraint กันใบซ้ำให้เอง)", "green", size=11)
p.box(1020, 1160, 940, 130,
      "<b>ผิดพลาด</b> — <code>error</code> enum 10 ค่า: invalid_json · unauthorized · forbidden · "
      "payload_too_large · unsupported_media_type · mapping_failed · order_rejected · not_configured · "
      "draining · internal<br>"
      "🔴 <b>ไม่มีฟอร์มใดใน 3 ฟอร์มนี้เก็บ ack/dispatch_id/error ขาส่ง</b> — ต้องไปอยู่ฝั่ง Lab Work Item", "red", size=11)
pages.append(p)

# ══════════════════════════════════════════════════ P5 · Coverage & Gap
p = Page("labform-gap", "5 · ครอบคลุมหรือยัง", h=1460)
p.title("ครอบคลุม spec Agent และ JSON รับ/ส่ง หรือยัง — คำตอบตรง ๆ",
        "เทียบ handoff 3 ฟอร์ม กับ schema จริง 3 ไฟล์ + ตัวอย่าง wire 2 ไฟล์")

p.band(100, "สรุปคำตอบ")
p.box(40, 150, 620, 150,
      "<b>✅ JSON ขารับผล — ครอบคลุมครบ</b><br><br>"
      "ทุก field ของ <b>agent-to-his-result</b> (11 required ระดับใบสั่ง + 16 field ใน items[]) "
      "มีที่ลงในฟอร์ม ① ② ③ ครบ ไม่มีตัวไหนตกหล่น<br>"
      "และตัวอย่าง <b>his-result-sample.json</b> ผ่าน schema", "green", size=11)
p.box(700, 150, 620, 150,
      "<b>⚠️ spec Agent — ครอบคลุมบางส่วน</b><br><br>"
      "ครอบคลุม<b>โครงสร้างข้อมูล</b>ครบ แต่<b>ยังไม่ครอบคลุมกติกาเชิงเงื่อนไข</b>ของ schema "
      "(conditional required, รูปแบบเวลา, wire type, กติกาแปลง critical)", "yellow", size=11)
p.box(1360, 150, 600, 150,
      "<b>🔴 JSON ขาส่ง — ไม่ครอบคลุม</b><br><br>"
      "handoff ไม่พูดถึง <b>his-to-agent-order</b> และ "
      "<b>agent-to-his-order-response</b> เลย<br>"
      "เป็นเรื่องของฝั่ง Lab Work Item ไม่ใช่ 3 ฟอร์มนี้ — แต่ต้องมีเอกสารคู่กัน", "red", size=11)

p.band(325, "7 จุดที่ยังไม่ครอบคลุม — เรียงตามความเสี่ยง")
GAPS = [
    ("1", "conditional required ที่ schema บังคับ",
     "schema มี <code>allOf</code>: เมื่อ <b>overall_status = resulted</b> → <b>verified_at และ verified_by กลายเป็น required</b><br>"
     "handoff §5.2C / §6.2B เขียนว่า verified_* “ถ้ามี” เท่านั้น → validator อาจปล่อยผ่านผลที่ควร reject", "red"),
    ("2", "กติกาแปลง critical rule → is_critical",
     "schema ระบุ project decision ว่า <b>“การมี critical_low_rule หรือ critical_high_rule = ผลนี้ critical”</b><br>"
     "handoff บอกแค่ว่า <code>is_critical</code> เป็น Switch disabled ที่ “Agent/LIS/ระบบเป็นผู้กำหนด” "
     "— <b>ไม่ได้เขียนกติกาว่าใครแปลงและแปลงยังไง</b>", "red"),
    ("3", "test_code = obs_code = his_code_id ขัดกันเอง",
     "schema ทั้งสองไฟล์ระบุว่าเป็นค่าเดียวกัน (<i>confirmed contract</i>) แต่ handoff §7.4 สั่งว่า "
     "<b>ห้ามถือว่าเป็นรหัสเดียวกันจนกว่า contract จะยืนยัน</b> → ต้องเคาะให้จบก่อนเขียน mapping", "red"),
    ("4", "รูปแบบเวลาและ wire type",
     "ขารับบังคับ ISO ลงท้าย <b>+07:00</b> เท่านั้น · <code>report_seq</code> / <code>receipt_seq</code> / "
     "<code>result_version</code> เป็น <b>string ของตัวเลข</b> · ขาส่ง <code>seq</code> เป็น <b>integer</b><br>"
     "handoff ระบุ string ไว้เฉพาะ <code>report_seq</code> ของ Receipt", "yellow"),
    ("5", "ตัวอย่างขาส่งไม่ตรง schema",
     "<code>his-order-sample.json</code> มี 6 field ที่ schema ไม่รับ "
     "(special_request · diagnosis · antimicrobial_used · underlying_disease · items[].lab_code) "
     "ขณะที่ schema เป็น <code>additionalProperties:false</code> → ต้องเคาะว่าไฟล์ไหนล้าหลัง", "yellow"),
    ("6", "ไม่มีที่เก็บ response ขาส่ง",
     "<code>ok</code> / <code>duplicate</code> / <code>order_ref</code> / <code>dispatch_id</code> / "
     "<code>routed_to[]</code> / error enum 10 ค่า — <b>ไม่มีฟอร์มใดใน 3 ฟอร์มนี้เก็บ</b> "
     "ต้องกำหนดว่าไปอยู่ที่ Lab Work Item field ใด", "yellow"),
    ("7", "hl7_order_status_sync ไม่ได้พูดถึง",
     "ตามผัง LIS ขารับมี <b>2 process คนละ pid</b> — <code>hl7_result_upsert</code> (ผล) และ "
     "<code>hl7_order_status_sync</code> (สถานะ 12 ค่า)<br>"
     "handoff นี้ครอบคลุมเฉพาะ process แรก · สถานะ 12 ค่ายังไม่มีที่เก็บที่ระบุ", "yellow"),
]
y = 375
for n, t, d, c in GAPS:
    p.box(40, y, 46, 92, "<b>%s</b>" % n, "gray", size=13, valign="middle")
    p.box(96, y, 420, 92, "<b>%s</b>" % t, c, size=11, valign="middle")
    p.box(526, y, 1434, 92, d, "gray", size=10, valign="middle")
    y += 100

p.band(y + 20, "สิ่งที่ handoff ครอบคลุมดีอยู่แล้ว — ไม่ต้องทำซ้ำ")
p.box(40, y + 70, 940, 120,
      "• โครงสร้าง 3 ชั้น + เหตุผลที่แยก ครบและตรงกับ schema<br>"
      "• Join Parent ② → ③ ระบุค่าจริงจาก live configuration<br>"
      "• กฎ 3 ตัวชี้ต้องตรงกัน (xparentx / parent_id.value / result_report_id)<br>"
      "• field ที่ควรแสดง vs ควรซ่อน (§12)", "green", size=11)
p.box(1020, y + 70, 940, 120,
      "• stable key ทั้ง 3 ระดับ + คำเตือนห้ามเดา compound key (§10)<br>"
      "• flow Agent เทียบ Manual (§11) และการไม่สร้าง Receipt ปลอมสำหรับ Manual<br>"
      "• ข้อจำกัด File Upload ใน form_ui (§8.4)<br>"
      "• checklist 11 ข้อก่อน production (§13)", "green", size=11)

p.legend(y + 215, LEGEND_STD, w=1500)
pages.append(p)

# ══════════════════════════════════════════════════ P6 · Agent vs Manual
p = Page("labform-run", "6 · Agent เทียบ Manual", h=1180)
p.title("Runtime — เส้นทาง Agent/LIS เทียบ Manual และสิ่งที่ต้องทำก่อนใช้จริง",
        "ทั้งสองเส้นจบที่ ② + ③ ชุดเดียวกัน จึงแสดงในหน้าเดียวกันได้")

p.band(100, "Agent / LIS")
A = [("Agent callback", "green"), ("① Receipt", "purple"), ("match / get-or-create ②", "purple"),
     ("upsert ③ Result Items", "purple"), ("คำนวณสถานะรวมของ ②", "purple"), ("Viewer แสดงผล", "blue")]
prev = None
for i, (t, c) in enumerate(A):
    n = p.card(40 + i * 320, 150, 280, 70, t, None, c)
    if prev: p.edge(prev, n, "", ("1", "0.5"), ("0", "0.5"))
    prev = n

p.band(250, "Manual (Microbiology / แลปที่ไม่มีเครื่อง LIS)")
M = [("Lab Work Item", "gray"), ("🔴 ไม่สร้าง Receipt ปลอม", "red"), ("get-or-create ②", "purple"),
     ("materialize ③ จาก ordered tests / Result Definition", "purple"),
     ("เจ้าหน้าที่กรอก result_value + audit", "yellow"), ("Viewer แสดงผลโครงเดียวกัน", "blue")]
prev = None
for i, (t, c) in enumerate(M):
    n = p.card(40 + i * 320, 300, 280, 85, t, None, c)
    if prev: p.edge(prev, n, "", ("1", "0.5"), ("0", "0.5"))
    prev = n

p.box(40, 405, 1920, 60,
      "🔴 <b>ข้อควรระวัง Microbiology:</b> <code>is_critical</code> ถูกตั้ง <b>disabled</b> จึงยังกรอก Critical แบบ Manual ไม่ได้ · "
      "ถ้าต้องกรอกเอง ต้องกำหนด <b>critical flag + เหตุผล + ผู้บันทึก</b> ก่อน "
      "<b>ห้ามเปิด switch เดิมให้แก้โดยไม่มี audit</b> · Unit อาจไม่มีค่า ให้แสดง <code>-</code> ห้ามสร้างหน่วยสมมติ",
      "red", size=11, valign="middle")

p.band(490, "11 ข้อที่ต้องทำ/ทดสอบก่อนใช้งานจริง (§13)")
TODO = [
    ("1", "ทำและทดสอบ API รับ callback, validate schema และ idempotency", "purple"),
    ("2", "ยืนยัน <b>stable Report key</b> สำหรับ partial / final / corrected", "red"),
    ("3", "ทดสอบ Receipt <b>หลายข้อความ</b> materialize เข้า Report เดิม", "red"),
    ("4", "ทดสอบ Result Item upsert โดยไม่เกิด duplicate", "purple"),
    ("5", "ยืนยัน <b>xparentx = parent_id.value = result_report_id</b> ตรงกัน", "red"),
    ("6", "ทำหน้า Lab รวมและ Tab ออกผล พร้อมปุ่ม <b>ดูผล</b>", "yellow"),
    ("7", "ทดสอบ Viewer รับ result_report_id แล้วโหลด header/items ถูกชุด", "yellow"),
    ("8", "ทำ persistence ของไฟล์แนบ — <b>ไม่พึ่ง File Upload ใน form_ui อย่างเดียว</b>", "red"),
    ("9", "ทำ audit การแก้ <code>result_value</code>", "purple"),
    ("10", "ยืนยัน workflow Manual Critical ของ Microbiology ก่อนเปิดแก้ field", "yellow"),
    ("11", "ทดสอบ end-to-end: partial · complete · corrected · duplicate · unmatched · critical", "purple"),
]
for i, (n, t, c) in enumerate(TODO):
    col, row = i % 2, i // 2
    x, y = 40 + col * 970, 540 + row * 56
    p.box(x, y, 46, 46, "<b>%s</b>" % n, "gray", size=12, valign="middle")
    p.box(x + 52, y, 878, 46, t, c, size=11, valign="middle")

p.box(40, 890, 1920, 50,
      "🔴 <b>ระบบยังไม่ถือว่า production-ready จนกว่า API materialization, parent linkage, Viewer runtime, "
      "Manual audit และไฟล์แนบ จะผ่านการทดสอบจริง</b>", "red", size=12, valign="middle")

p.legend(965, LEGEND_STD, w=1500)
pages.append(p)

# ══════════════════════════════════════════════════ write
out = ('<mxfile host="app.diagrams.net" agent="claude-code" version="24.7.7" type="device">\n'
       + "\n".join(pg.xml() for pg in pages) + "\n</mxfile>\n")
import io
io.open(sys.argv[1], "w", encoding="utf-8").write(out)
print("wrote %s (%d pages, %d bytes)" % (sys.argv[1], len(pages), len(out)))
