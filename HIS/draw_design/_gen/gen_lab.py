# -*- coding: utf-8 -*-
"""Generator for lab_result_receive_flow.drawio — style cloned from
request_reciece_agents_flow.drawio (FA V2 deck look)."""

def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))

LD = lambda a, b: "light-dark(%s,%s)" % (a, b)
FC = LD("#333333", "#e0e0e0")

PAL = {
    "green":  (LD("#d5e8d4", "#1e3a1c"), LD("#82b366", "#82b366")),
    "blue":   (LD("#dae8fc", "#16334d"), LD("#6c8ebf", "#6c8ebf")),
    "purple": (LD("#e1d5e7", "#33254a"), LD("#9673a6", "#9673a6")),
    "red":    (LD("#f8cecc", "#4a1f1e"), LD("#b85450", "#b85450")),
    "yellow": (LD("#fff2cc", "#4a3d13"), LD("#d6b656", "#d6b656")),
    "gray":   (LD("#f5f5f5", "#252525"), LD("#999999", "#777777")),
    "none":   ("none",                    LD("#999999", "#777777")),
}
BAND_FILL, BAND_STROKE = LD("#647687", "#2f3b47"), LD("#314354", "#46586a")
BAND_FONT = LD("#ffffff", "#dfe6ee")

CARD = ("rounded=1;whiteSpace=wrap;html=1;fontSize=11;fontColor=%s;fillColor=%s;"
        "strokeColor=%s;align=left;spacingLeft=8;spacingRight=8;verticalAlign=top;spacingTop=6;")
DIAMOND = ("rhombus;whiteSpace=wrap;html=1;fontSize=11;fontColor=%s;fillColor=%s;"
           "strokeColor=%s;align=center;verticalAlign=middle;")
NOTE = ("rounded=0;whiteSpace=wrap;html=1;fontSize=10;align=left;verticalAlign=top;dashed=1;"
        "spacingLeft=8;spacingRight=8;spacingTop=6;fontColor=%s;fillColor=none;strokeColor=%s;")
EDGE = ("edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=classic;fontSize=10;fontColor=%s;"
        "strokeColor=%s;labelBackgroundColor=%s;" % (FC, LD("#555555", "#b9c2cd"), LD("#ffffff", "#121212")))
LANE = ("swimlane;html=1;horizontal=%s;startSize=40;fillColor=none;strokeColor=%s;fontSize=12;"
        "fontStyle=1;fontColor=%s;")


class Page:
    def __init__(self, pid, name, w=2000, h=1400):
        self.pid, self.name, self.w, self.h = pid, name, w, h
        self.cells, self.n = [], 0

    def _id(self):
        self.n += 1
        return "%s-n%d" % (self.pid, self.n)

    def raw(self, style, x, y, w, h, value="", parent="1", cid=None):
        cid = cid or self._id()
        self.cells.append(
            '        <mxCell id="%s" value="%s" style="%s" vertex="1" parent="%s">\n'
            '          <mxGeometry x="%s" y="%s" width="%s" height="%s" as="geometry" />\n'
            '        </mxCell>' % (cid, esc(value), style, parent, x, y, w, h))
        return cid

    # ---- text ----
    def title(self, text, sub=None):
        self.raw("text;html=1;fontSize=24;fontStyle=1;align=left;verticalAlign=middle;fontColor=%s;"
                 % LD("#1a1a1a", "#f0f0f0"), 40, 20, self.w - 80, 30, text)
        if sub:
            self.raw("text;html=1;fontSize=12;fontStyle=2;align=left;verticalAlign=middle;fontColor=%s;"
                     % LD("#777777", "#999999"), 40, 54, self.w - 80, 20, sub)

    def text(self, x, y, w, h, s, size=11, style_extra="align=left;verticalAlign=middle;", parent="1"):
        return self.raw("text;html=1;fontSize=%d;%sfontColor=%s;" % (size, style_extra, FC),
                        x, y, w, h, s, parent)

    def band(self, y, text, x=40, w=None):
        w = w or (self.w - 80)
        return self.raw("rounded=0;html=1;fillColor=%s;strokeColor=%s;fontColor=%s;fontStyle=1;fontSize=13;"
                        % (BAND_FILL, BAND_STROKE, BAND_FONT), x, y, w, 30, text)

    # ---- shapes ----
    def card(self, x, y, w, h, title, detail=None, color="blue", parent="1", cid=None):
        f, s = PAL[color]
        v = "<b>%s</b>" % title
        if detail:
            v += '<br><font style="font-size:10px">%s</font>' % detail
        return self.raw(CARD % (FC, f, s), x, y, w, h, v, parent, cid)

    def diamond(self, x, y, w, h, text, color="yellow", parent="1"):
        f, s = PAL[color]
        return self.raw(DIAMOND % (FC, f, s), x, y, w, h, "<b>%s</b>" % text, parent)

    def note(self, x, y, w, h, title, body, stroke="red", parent="1"):
        _, s = PAL[stroke]
        return self.raw(NOTE % (FC, s), x, y, w, h, "<b>%s</b><br><br>%s" % (title, body), parent)

    def box(self, x, y, w, h, value, color="gray", parent="1", size=10, bold=False, valign="top"):
        f, s = PAL[color]
        st = ("rounded=0;whiteSpace=wrap;html=1;fontSize=%d;align=left;verticalAlign=%s;spacingLeft=8;"
              "spacingRight=8;spacingTop=4;fontColor=%s;fillColor=%s;strokeColor=%s;%s"
              % (size, valign, FC, f, s, "fontStyle=1;" if bold else ""))
        return self.raw(st, x, y, w, h, value, parent)

    def lane(self, x, y, w, h, name, vertical_title=True):
        return self.raw(LANE % ("0" if vertical_title else "1",
                                LD("#000000", "#ffffff"), LD("#333333", "#e0e0e0")),
                        x, y, w, h, name)

    # ---- edges ----
    def edge(self, src, tgt, label="", exit=None, entry=None, dashed=False, extra=""):
        st = EDGE
        if exit:
            st += "exitX=%s;exitY=%s;exitDx=0;exitDy=0;" % exit
        if entry:
            st += "entryX=%s;entryY=%s;entryDx=0;entryDy=0;" % entry
        if dashed:
            st += "dashed=1;dashPattern=6 4;"
        st += extra
        cid = self._id()
        self.cells.append(
            '        <mxCell id="%s" value="%s" style="%s" edge="1" parent="1" source="%s" target="%s">\n'
            '          <mxGeometry relative="1" as="geometry" />\n        </mxCell>'
            % (cid, esc(label), st, src, tgt))
        return cid

    def legend(self, y, items, x=40, w=1600):
        h = 26 * ((len(items) + 1) // 2) + 34
        box = self.raw("rounded=0;html=1;fillColor=%s;strokeColor=%s;verticalAlign=top;align=left;"
                       "spacingLeft=10;spacingTop=6;fontSize=11;fontStyle=1;fontColor=%s;"
                       % (LD("#fafafa", "#1c1c1c"), LD("#8a8a8a", "#9aa3ad"), FC), x, y, w, h, "LEGEND")
        for i, (color, label) in enumerate(items):
            col, row = i % 2, i // 2
            cx, cy = 10 + col * 800, 30 + row * 26
            f, s = PAL[color]
            self.raw("rounded=0;html=1;fillColor=%s;strokeColor=%s;" % (f, s), cx, cy, 16, 16, "", box)
            self.text(cx + 20, cy, 760, 16, label, 11, parent=box)
        return box

    def xml(self):
        return ('  <diagram id="%s" name="%s">\n'
                '    <mxGraphModel dx="1030" dy="570" grid="1" gridSize="10" guides="1" tooltips="1" '
                'connect="1" arrows="1" fold="1" pageScale="1" pageWidth="%d" pageHeight="%d" math="0" '
                'shadow="0" adaptiveColors="auto">\n      <root>\n        <mxCell id="0" />\n'
                '        <mxCell id="1" parent="0" />\n%s\n      </root>\n    </mxGraphModel>\n  </diagram>'
                % (self.pid, esc(self.name), self.w, self.h, "\n".join(self.cells)))


LEGEND_STD = [
    ("green",  "ของเดิม / มาจากฝั่ง Agent–LIS"),
    ("blue",   "มีแล้วในระบบ (ฟอร์ม / JSON UI / schema)"),
    ("purple", "ทีม HIS ต้องเขียน Process หรือยืนยันด้วยข้อมูลจริง"),
    ("red",    "กฎห้ามพัง · ทางที่ต้องหยุด"),
    ("yellow", "รอเคาะ / ยังไม่ยืนยัน end-to-end"),
    ("gray",   "ข้อมูลอ้างอิง / บริบท"),
]

pages = []

# ============================================================== P1 · ทำไม 3 ฟอร์ม
p = Page("labres-why", "ทำไมต้อง 3 ฟอร์ม", h=1300)
p.title("ทำไมต้อง 3 ฟอร์ม — ไม่ใช่ 3 หน้าจอ แต่เป็น 3 ชั้นข้อมูลที่มีอายุและเจ้าของต่างกัน",
        "เอกสาร result_lab.md · 25 ส.ค. 2569 · Draw.io ของ LIS ไม่ได้บังคับจำนวนฟอร์ม — "
        "การแยก 3 ชั้นเป็นการออกแบบ persistence ฝั่ง HIS เอง")

p.band(100, "หนึ่งข้อความจาก Agent เดินผ่าน 3 ชั้น — แต่ละชั้นตอบคำถามคนละข้อ")
Y = 150
a_ = p.card(40, Y, 280, 210, "ข้อความจาก Agent",
            "1 callback = 1 <b>result_uid</b><br><br>ผลของใบสั่งเดียวกันมาได้ <b>หลายครั้ง</b> — "
            "preliminary → final → corrected · และอาจถูก retry ส่งซ้ำใบเดิม", "green")
f1 = p.card(400, Y, 320, 210, "① Lab_Result_Inbound_Receive",
            "<b>ชั้นข้อความ</b> — “ใบเสร็จรับของ” ทางเทคนิค<br>1 record ต่อ <b>result_uid</b><br><br>"
            "🔴 <b>ไม่ Join Parent</b> — จึงเก็บข้อความที่ unmatched / duplicate / error ได้<br><br>"
            "raw payload · schema version · channel · receipt status · error message<br>"
            "= internal / read-only ห้ามเปิดให้ผู้ใช้แก้", "purple")
f2 = p.card(800, Y, 320, 210, "② Result_Report_Manual_Entry",
            "<b>ชั้นรายงาน</b> — หัวรายงานของผล “หนึ่งชุด”<br>ผูกกับ Lab Work Item / LAB NO.<br><br>"
            "ถือสถานะรวม <b>overall_status</b><br>in_progress = ออกผลบางส่วน · resulted = ครบ<br><br>"
            "<b>source_mode = manual | lis | mixed</b><br>→ ทำให้ Manual กับ LIS ใช้หัวเดียวกันได้", "purple")
f3 = p.card(1200, Y, 320, 210, "③ Lab_Result_Item",
            "<b>ชั้นผลรายรายการ</b> — 1 record ต่อ result component (ราย test / OBS)<br><br>"
            "ลูกของ Result Report<br>จับรายการด้วย <b>obs_code = his_code_id</b><br><br>"
            "value · unit · ref range · critical · obx_status · result_version — "
            "ทุกค่าเป็นของ “ราย item” ไม่ใช่ของรายงาน", "purple")
vw = p.card(1600, Y, 320, 210, "หน้าดูผล (ListView)",
            "อ่านข้อมูลจาก <b>Lab_Result_Item</b><br><br>ผล LIS และ Manual มาโผล่ที่เดียวกัน "
            "เพราะใช้ ② + ③ ชุดเดียวกัน<br><br>⚠️ ต้องทดสอบใน App/View runtime จริง "
            "— Form Manage CRUD ไม่แสดง list-ui", "blue")

p.edge(a_, f1, "callback")
p.edge(f1, f2, "N ข้อความ : 1 รายงาน")
p.edge(f2, f3, "1 รายงาน : N ผล")
p.edge(f3, vw, "แสดงผล")

for x, t in ((400, "“กล่องจดหมายขาเข้า” — ได้อะไรมาบ้าง"),
             (800, "“ใบรายงานผล” — ใบนี้ของใคร เสร็จหรือยัง"),
             (1200, "“บรรทัดผลในใบ” — ค่าแต่ละตัวเป็นเท่าไร")):
    p.text(x, Y + 216, 320, 18, "<i>เทียบของจริง: %s</i>" % t, 10)

p.band(410, "ทำไมยุบให้เหลือฟอร์มเดียวไม่ได้ — 3 เหตุผลที่แยกกันจริง ๆ")
p.note(40, 460, 600, 175, "ยุบ ① เข้า ② ไม่ได้ — ข้อความที่ยังจับคู่ไม่ได้จะไม่มีที่อยู่",
       "② ต้องผูกกับ Lab Work Item เสมอ ถ้ามีแต่ ② ข้อความที่ <b>จับคู่ใบสั่งไม่สำเร็จ</b> จะต้องถูกทิ้ง<br>"
       "→ สืบย้อนไม่ได้ว่าเคยได้รับผลนั้นมาแล้ว<br><br>"
       "🔴 idempotency key <b>result_uid</b> ต้องอยู่ชั้นนี้ ก่อน materialize ผล — "
       "ส่งซ้ำต้องได้ duplicate ไม่ใช่ข้อมูลซ้ำ")
p.note(700, 460, 600, 175, "ยุบ ② ทิ้งไม่ได้ — ต้องมีหัวให้ผลหลายตัวเกาะ",
       "1 Lab Work Item / LAB NO. = 1 รายงานที่มีหลาย test<br>"
       "สถานะรวม <b>in_progress / resulted</b> เป็นของรายงาน ไม่ใช่ของ item เดี่ยว ๆ<br><br>"
       "<b>source_mode</b> อยู่ชั้นนี้ — เป็นจุดเดียวที่ทำให้ Manual Result กับผล LIS "
       "ไหลลงโครงเดียวกันและรวมกันในหน้าดูผลได้", stroke="yellow")
p.note(1360, 460, 600, 175, "ยุบ ③ เข้า ② ไม่ได้ — ผลเป็น “รายการ” ไม่ใช่ “คอลัมน์”",
       "จำนวน test ต่อรายงาน<b>ไม่คงที่</b> ยัดเป็นคอลัมน์ในหัวรายงานไม่ได้<br><br>"
       "ต้อง upsert ราย item ด้วย stable key (report + result definition หรือ source result key) "
       "เพื่อให้ผลรอบที่สองอัปเดตแถวเดิม<br>🔴 ไม่ใช่สร้างแถวใหม่ทุกครั้งที่ callback มา")

p.band(665, "ไม่ใช่ 5 ฟอร์ม — ไฟล์ JSON บางไฟล์เป็นแค่ “หน้าตา” ของฟอร์มเดิม")
p.box(40, 715, 600, 100,
      "<b>Lab_Result_Inbound_Receive_User_View_EMR_Person_v2.json</b><br>"
      "→ import ให้ฟอร์ม <b>Lab_Result_Inbound_Receive</b><br>"
      "เป็นหน้า <b>ดู</b> receipt + รายการผล — <b>ไม่ใช่ endpoint รับข้อมูล</b><br>"
      "ListView ข้างในอ่านจาก Lab_Result_Item", "blue")
p.box(700, 715, 600, 100,
      "<b>Lab_Result_Item_Minimal_Widget_Critical.json</b><br>"
      "→ import ให้ฟอร์ม <b>Lab_Result_Item</b><br><br>"
      "JSON UI = หน้าตา/schema ของฟอร์มเดิม ไม่ได้นับเป็นฟอร์มเพิ่ม", "blue")
p.box(1360, 715, 600, 100,
      "<b>🔴 ห้าม import ไฟล์ …_User_View_EMR_Person_v2.json ทับ Lab_Result_Item</b><br>"
      "ListView ในไฟล์นี้ชี้ไปที่ <b>Form ID ของ Lab_Result_Item</b> อยู่แล้ว<br>"
      "import ทับ = ฟอร์มอ้างรายการ<b>กลับมาหาตัวเอง</b> (loop)", "red")

p.band(845, "Draw.io ของ LIS ยืนยันอะไร และไม่ได้บอกอะไร")
p.box(40, 895, 940, 195,
      "<b>✅ Draw.io ยืนยันแล้ว</b><br>"
      "• Agent callback เข้า HIS ผ่าน <b>hl7_result_upsert</b><br>"
      "• กันข้อความซ้ำด้วย <b>result_uid</b><br>"
      "• จับคู่ด้วย <b>order_no + filler_order_no + visit_id</b><br>"
      "• <b>filler_order_no</b> คือ LAB NO. ที่ HIS ส่งออกไปในชื่อ <b>labno</b><br>"
      "• Result Item จับด้วย <b>items[].obs_code = his_code_id</b> (ตาม checkpoint ปัจจุบัน)<br>"
      "• เก็บ receipt / version แบบ <b>append-only</b><br>"
      "• in_progress = ผลบางส่วน · resulted = ผลครบ<br>"
      "• critical: HIS <b>เก็บและแสดง</b> โดยไม่คำนวณ threshold ซ้ำ", "green", size=11)
p.box(1020, 895, 940, 195,
      "<b>❓ Draw.io ไม่ได้บอก</b><br>"
      "• <b>ไม่ระบุชื่อฟอร์ม</b> และ <b>ไม่บังคับว่าต้องมี 3 ฟอร์ม</b><br><br>"
      "<b>สรุปคำตอบของคำถาม “ทำไม 3 ฟอร์ม”</b><br>"
      "โครง 3 ฟอร์ม <b>สอดคล้อง</b>กับ flow ใน Draw.io — แต่ <b>ไม่ได้คัดจำนวนฟอร์มมาจาก Draw.io โดยตรง</b><br>"
      "เป็นการออกแบบ persistence ฝั่ง HIS เพื่อรองรับ 4 อย่าง:<br>"
      "&nbsp;&nbsp;① idempotency &nbsp;② audit ย้อนหลัง<br>"
      "&nbsp;&nbsp;③ รายงาน 1 ชุดที่มีหลายผล &nbsp;④ ใช้โครงเดียวกันร่วมกับ Manual Result", "yellow", size=11)

p.legend(1120, LEGEND_STD)
pages.append(p)

# ============================================================== P2 · Receive Flow
p = Page("labres-flow", "Receive Flow", h=2000)
p.title("Flow รับผลจาก Agent — ขั้นตอนไหนเขียนลงฟอร์มไหน",
        "คอลัมน์กลาง = Process ที่ต้องเขียน (เดินบนลงล่าง) · คอลัมน์ขวา = 3 ฟอร์มที่ถูกเขียน · "
        "เส้นประ = “เขียนลง” ไม่ใช่ลำดับเวลา")

LY, LH = 100, 1610
l1 = p.lane(40, LY, 340, LH, "Agent / LISconnect")
l2 = p.lane(380, LY, 620, LH, "HIS · Process (ต้องเขียน)")
l3 = p.lane(1000, LY, 600, LH, "HIS · ข้อมูลที่ถูกเขียน (3 ฟอร์ม)")
l4 = p.lane(1600, LY, 340, LH, "จอผู้ใช้")

def at(lane_x, x, y):          # absolute -> lane-relative
    return x - lane_x, y - LY

def C(lane, lx, x, y, w, h, t, d, c):
    rx, ry = at(lx, x, y)
    return p.card(rx, ry, w, h, t, d, c, parent=lane)

def D(lane, lx, x, y, w, h, t, c="yellow"):
    rx, ry = at(lx, x, y)
    return p.diamond(rx, ry, w, h, t, c, parent=lane)

A = C(l1, 40, 70, 170, 280, 90, "1 · Agent ส่ง Result callback",
      "ผลของใบสั่งเดียวกันอาจมาหลายครั้ง และอาจ retry ส่งซ้ำ", "green")
B = C(l2, 380, 430, 170, 280, 90, "2 · Process hl7_result_upsert",
      "ตรวจ schema และชนิดข้อมูล · Agent เรียก <b>Process</b> ไม่ได้เขียน ListView ตรง", "purple")
Q1 = D(l2, 380, 415, 300, 310, 120, "เคยรับ result_uid นี้แล้ว?")
DUP = C(l2, 380, 730, 305, 250, 100, "คืน duplicate แบบ idempotent",
        "ไม่สร้าง receipt / report / item ซ้ำ · ส่งซ้ำต้องได้ผลเดิม", "red")

F1 = C(l2, 380, 430, 460, 280, 95, "3 · สร้าง Technical Receipt",
       "สร้างก่อน materialize ผล เพื่อให้ข้อความที่พังยังมีที่เก็บ", "purple")
MATCH = C(l2, 380, 430, 600, 280, 110, "4 · จับคู่ Order",
          "ใช้ร่วมกัน <b>order_no + filler_order_no + visit_id</b><br>"
          "🔴 ห้ามจับคู่ด้วย HN หรือ LAB NO. เพียงค่าเดียว — HN/VN ใช้แสดงบริบท ไม่ใช่ parent key", "purple")
Q2 = D(l2, 380, 415, 755, 310, 120, "จับคู่ Lab Work Item ได้?")
BAD = C(l2, 380, 730, 765, 250, 100, "receipt = unmatched / error",
        "เก็บ raw message + error reason ไว้ตรวจย้อนหลัง · <b>ห้ามทิ้งข้อความ</b>", "red")

REP = C(l2, 380, 430, 920, 280, 85, "5 · ค้นหรือสร้าง Result Report",
        "ต้อง idempotent — ใบเดิมต้องไม่ได้รายงานใหม่ซ้ำ", "purple")
ITEM = C(l2, 380, 430, 1040, 280, 100, "6 · แตก items[] ของ Agent",
         "จับ Result Definition / Result Item ด้วย <b>obs_code = his_code_id</b>", "purple")
UPS = C(l2, 380, 430, 1175, 280, 110, "7 · Upsert Lab_Result_Item เดิม",
        "ไม่สร้างซ้ำ · เก็บ result, unit, ref range, critical และ source snapshot", "purple")
CALC = C(l2, 380, 430, 1320, 280, 75, "8 · คำนวณสถานะรายงานใหม่", "append-only ห้ามทับของเดิม", "purple")
Q3 = D(l2, 380, 415, 1425, 310, 120, "overall_status ?")

R1 = C(l3, 1000, 1030, 440, 300, 130, "① Lab_Result_Inbound_Receive",
       "1 record ต่อ <b>result_uid</b> · <b>ไม่ Join Parent</b><br>"
       "raw payload · schema version · channel · receipt status · error<br>"
       "= internal / read-only", "purple")
R2 = C(l3, 1000, 1030, 900, 300, 125, "② Result_Report_Manual_Entry",
       "หัวรายงานของผลหนึ่งชุด · ผูก Lab Work Item / Order Status<br>"
       "<b>source_mode = manual | lis | mixed</b><br>"
       "⚠️ report_seq / stage ต้อง append-only — ห้ามเดา compound key ก่อนตรวจ API/DB จริง", "purple")
R3 = C(l3, 1000, 1030, 1160, 300, 130, "③ Lab_Result_Item",
       "1 record ต่อ result component<br>ลูกของ Result Report<br>"
       "upsert ด้วย stable key (report + result definition หรือ source result key)", "purple")

V1 = C(l4, 1600, 1630, 1420, 280, 80, "in_progress → ออกผลบางส่วน",
       "รายการที่ยังไม่ออกต้องแสดง <b>pending</b>", "blue")
V2 = C(l4, 1600, 1630, 1525, 280, 65, "resulted → ออกผลครบ", "stamp เวลาตามกติกา", "blue")
V3 = C(l4, 1600, 1630, 1615, 280, 85, "หน้าดูผล (ListView)",
       "ListView อ่านจาก <b>Lab_Result_Item</b>", "blue")

B_, T_, L_, R_ = ("0.5", "1"), ("0.5", "0"), ("0", "0.5"), ("1", "0.5")
p.edge(A, B, "", R_, L_)
p.edge(B, Q1, "", B_, T_)
p.edge(Q1, DUP, "เคยแล้ว", R_, L_)
p.edge(Q1, F1, "ยังไม่เคย", B_, T_)
p.edge(F1, MATCH, "", B_, T_)
p.edge(MATCH, Q2, "", B_, T_)
p.edge(Q2, BAD, "ไม่ได้", R_, L_)
p.edge(Q2, REP, "ได้", B_, T_)
p.edge(REP, ITEM, "", B_, T_)
p.edge(ITEM, UPS, "", B_, T_)
p.edge(UPS, CALC, "", B_, T_)
p.edge(CALC, Q3, "", B_, T_)
p.edge(Q3, V1, "in_progress", R_, L_)
p.edge(Q3, V2, "resulted", R_, L_)
p.edge(V1, V3, "", B_, T_)
p.edge(V2, V3, "", B_, T_)
p.edge(F1, R1, "เขียน 1 แถว / result_uid", R_, L_, dashed=True)
p.edge(BAD, R1, "เก็บเป็น receipt ที่จับคู่ไม่ได้", R_, L_, dashed=True)
p.edge(REP, R2, "ค้น/สร้าง 1 หัวรายงาน", R_, L_, dashed=True)
p.edge(UPS, R3, "upsert N แถว", R_, L_, dashed=True)
p.edge(R3, V3, "อ่าน", R_, ("0", "0.25"), dashed=True)

p.band(1745, "กฎที่พลาดไม่ได้ในขารับผล")
p.note(40, 1795, 620, 150, "result_uid = กุญแจกันซ้ำ ระดับข้อความ",
       "• ส่ง payload ใหม่ → สร้าง receipt <b>หนึ่ง</b> record<br>"
       "• ส่ง result_uid เดิมซ้ำ → <b>ไม่</b>สร้าง receipt / report / item ซ้ำ<br>"
       "• 🔴 <b>receipt_seq</b> = ลำดับ/จำนวนครั้งที่รับ message <b>≠ result_version</b> — ห้ามรวมสองค่า")
p.note(700, 1795, 620, 150, "Correction ต้อง append ห้ามทับ",
       "• ผลแก้ → เพิ่ม <b>version / audit</b> และ<b>เก็บค่าเดิมไว้</b><br>"
       "• ห้ามเขียนทับประวัติเดิมแบบสูญหาย<br>"
       "• Result Report ต้องรองรับ <b>report_seq / stage</b> แบบ append-only")
p.note(1360, 1795, 600, 150, "Critical — HIS ไม่คำนวณซ้ำ",
       "• Agent ส่ง <b>critical_low_rule / critical_high_rule</b> มาให้<br>"
       "• HIS <b>เก็บและแสดง</b> Critical ตามที่ได้รับ<br>"
       "• 🔴 ห้ามคำนวณ threshold ซ้ำเอง", stroke="yellow")
pages.append(p)

# ============================================================== P3 · Field Mapping
p = Page("labres-map", "Field Mapping", h=1080)
p.title("Field Mapping — Agent result → HIS",
        "checkpoint ปัจจุบัน (result_lab.md §6) · ยังไม่ยืนยันด้วยข้อมูลจริง end-to-end")

p.band(100, "ระดับใบสั่ง — คีย์ที่ใช้จับคู่ (ต้องใช้ครบทั้งสามค่า)")
for i, (k, d) in enumerate((
        ("order_no", "เลขใบสั่งฝั่ง HIS"),
        ("filler_order_no", "= LAB NO. ที่ HIS ออกและส่งไปในชื่อ <b>labno</b> — กุญแจดอกเดียวที่ผูกผลกลับใบสั่ง"),
        ("visit_id", "การมารับบริการครั้งนั้น"))):
    p.box(40 + i * 640, 150, 600, 70, "<b>%s</b><br>%s" % (k, d), "blue", size=11)
p.box(40, 235, 1920, 40,
      "🔴 <b>ห้ามจับคู่ด้วย HN หรือ LAB NO. เพียงค่าเดียว</b> — HN / VN ใช้แสดงบริบทผู้ป่วยและ cross-check เท่านั้น "
      "ไม่ใช่ parent key ของ Result Item", "red", size=11, valign="middle")

p.band(300, "ระดับรายการผล — items[] ของ Agent → Lab_Result_Item ของ HIS")
HD = 350
for x, w, t in ((40, 560, "Agent result"), (620, 560, "HIS Result Item"), (1200, 760, "หมายเหตุ")):
    p.box(x, HD, w, 32, "<b>%s</b>" % t, "gray", size=11, bold=True, valign="middle")

ROWS = [
    ("items[].obs_code", "obs_code / ใช้หา Result Definition",
     "🔑 คีย์จับคู่รายการ — ตรงกับ <b>his_code_id</b>", "purple"),
    ("items[].obs_name", "test_name (snapshot)",
     "เก็บชื่อ ณ เวลานั้น ไม่อิง master ที่อาจเปลี่ยนภายหลัง", "gray"),
    ("items[].value", "result_value", "", "gray"),
    ("items[].units", "unit_symbol_snapshot",
     "อ้าง Unit Master เพิ่มเมื่อ map ได้ · Manual ฝั่ง Lab ปกติ <b>ห้ามแก้</b>", "gray"),
    ("items[].ref_range", "reference_range_snapshot",
     "read-only จาก LIS / Definition", "gray"),
    ("items[].obx_status", "obx_status",
     "ค่าดิบจากแล็บ — ต้องรองรับค่าที่ไม่รู้จักโดยไม่ error", "gray"),
    ("items[].change_kind", "change_kind", "", "gray"),
    ("items[].receipt_seq", "receipt_seq (raw string)",
     "🔴 <b>≠ result_version</b> — คือลำดับ/จำนวนครั้งที่รับ message ห้ามรวมสองค่า", "red"),
    ("items[].result_version", "result_version",
     "correction → +1 และเก็บค่าเดิมไว้ ห้ามทับประวัติ", "red"),
    ("critical_low_rule / critical_high_rule", "critical snapshot / alert ตาม contract",
     "HIS เก็บและแสดงตามที่ได้รับ — <b>ไม่คำนวณ threshold ซ้ำ</b>", "purple"),
]
y = HD + 32
for a, b, c, col in ROWS:
    p.box(40, y, 560, 42, "<b>%s</b>" % a, "green", size=11, valign="middle")
    p.box(620, y, 560, 42, "<b>%s</b>" % b, "blue", size=11, valign="middle")
    p.box(1200, y, 760, 42, c, col, size=10, valign="middle")
    y += 42

p.band(y + 30, "ระดับรายงาน — สถานะรวม")
p.box(40, y + 80, 940, 110,
      "<b>overall_status = in_progress</b> → ออกผลบางส่วน<br>"
      "<b>overall_status = resulted</b> → ออกผลครบ + stamp เวลาตามกติกา<br>"
      "รายการที่ยังไม่ออกผลต้องแสดงเป็น <b>pending</b>", "blue", size=11)
p.box(1020, y + 80, 940, 110,
      "<b>⏳ ยังต้องเคาะ:</b> Completion rule ราย test — รายการใดถือเป็น "
      "<b>required_for_completion</b> ต้องยืนยันกับผู้ใช้ห้องแล็บก่อน<br><br>"
      "<b>⏳ ยังต้องเคาะ:</b> implementation key สุดท้ายของ Result Report "
      "(report_seq / stage) — <b>ห้ามเดา compound key ก่อนตรวจ API/ฐานข้อมูลจริง</b>", "yellow", size=11)
pages.append(p)

# ============================================================== P4 · Manual Result
p = Page("labres-manual", "Manual Result", h=1010)
p.title("Manual Result — ใช้ ② + ③ ร่วมกับผล LIS แต่ไม่แตะ ①",
        "เป้าหมาย: ผล Manual กับผล LIS ต้องมาโผล่ในหน้าดูผลเดียวกัน จึงต้องลงโครงเดียวกัน")

p.band(100, "เส้นทางของ Manual เทียบกับเส้นทางของ LIS")
lis = p.card(40, 155, 300, 100, "ผลจาก LIS (Agent callback)", "เข้าทาง Process hl7_result_upsert", "green")
rcv = p.card(430, 155, 300, 100, "① Lab_Result_Inbound_Receive",
             "technical receipt ของ<b>ข้อความ</b>เท่านั้น", "purple")
man = p.card(40, 320, 300, 100, "ผลกรอกมือ (Manual)", "ผู้ใช้กรอกจากหน้าจอ HIS", "green")
rep = p.card(820, 235, 300, 120, "② Result_Report_Manual_Entry",
             "<b>source_mode = manual | lis | mixed</b><br>หัวรายงานร่วมของทั้งสองทาง", "purple")
itm = p.card(1210, 235, 300, 120, "③ Lab_Result_Item",
             "ผลราย test — โครงเดียวกันทั้ง Manual และ LIS", "purple")
vue = p.card(1600, 235, 320, 120, "หน้าดูผลเดียวกัน",
             "รวมผล Manual + LIS ได้เพราะใช้ ② และ ③ ชุดเดียวกัน", "blue")
p.edge(lis, rcv, "", ("1", "0.5"), ("0", "0.5"))
p.edge(rcv, rep, "", ("1", "0.5"), ("0", "0.5"))
p.edge(man, rep, "Manual ข้าม ① ไปเลย", ("0.5", "1"), ("0.5", "1"))
p.edge(rep, itm, "1 : N", ("1", "0.5"), ("0", "0.5"))
p.edge(itm, vue, "", ("1", "0.5"), ("0", "0.5"))
p.box(430, 320, 300, 100,
      "🔴 <b>Manual ไม่เขียนเข้า ①</b><br>① มีไว้เก็บ<b>ข้อความขาเข้า</b> — Manual ไม่มีข้อความ "
      "จึงไม่มี receipt", "red", size=11, valign="middle")

p.band(495, "สิทธิ์การแก้ไขต่อกลุ่มงาน — กติกาล่าสุด")
HD = 545
cols = [(40, 420, "กลุ่ม"), (460, 375, "Result"), (835, 375, "Unit"),
        (1210, 375, "Reference range"), (1585, 375, "Critical")]
for x, w, t in cols:
    p.box(x, HD, w, 32, "<b>%s</b>" % t, "gray", size=11, bold=True, valign="middle")
R = [("Lab ปกติ", [("Manual ได้เฉพาะกรณีที่อนุญาต", "yellow"), ("Read-only จาก LIS / Definition", "blue"),
                   ("Read-only จาก LIS / Definition", "blue"), ("Read-only จาก Agent / LIS", "blue")]),
     ("Micrology <font style=\"font-size:10px\">(ตามชื่อที่ผู้ใช้ระบุ)</font>",
      [("Manual", "green"), ("ไม่มี Unit / ไม่แสดง", "gray"),
       ("แสดงเฉพาะเมื่อมีข้อมูล", "gray"), ("Manual พร้อม audit", "green")])]
y = HD + 32
for name, cells in R:
    p.box(40, y, 420, 56, "<b>%s</b>" % name, "gray", size=11, valign="middle")
    for (x, w, _), (txt, col) in zip(cols[1:], cells):
        p.box(x, y, w, 56, txt, col, size=10, valign="middle")
    y += 56

p.box(40, y + 20, 940, 105,
      "<b>Lab ปกติ — หน้ากรอก Manual</b><br>"
      "เปิดให้แก้ได้เฉพาะ <b>result_value</b> และอาจมี <b>result_comment</b><br>"
      "🔴 Unit, Reference range และ Critical <b>ต้องไม่เปิดให้ผู้ใช้แก้</b>", "red", size=11)
p.box(1020, y + 20, 940, 105,
      "<b>⏳ ข้อยกเว้น Micrology — ยังห้าม implement</b><br>"
      "ต้องยืนยันก่อน: (1) ชื่อ/รหัส <b>lab_section</b> จริง "
      "(2) รูปแบบการกรอก Critical — Boolean, interpretation code หรือข้อความ<br>"
      "<b>ห้ามเดา</b>", "yellow", size=11)
p.legend(y + 150, LEGEND_STD, w=1500)
pages.append(p)

# ============================================================== P5 · สถานะปัจจุบัน
p = Page("labres-status", "สถานะปัจจุบัน", h=1080)
p.title("สถานะปัจจุบัน — มีอะไรแล้ว ยังขาดอะไร",
        "ณ 25 ส.ค. 2569 · ระบบยังไม่ production-ready")

p.band(100, "ของที่มีแล้ว vs ของที่ยังไม่ยืนยัน end-to-end")
p.box(40, 150, 940, 230,
      "<b>✅ มีแล้ว</b><br>"
      "• JSON technical receipt (①)<br>"
      "• JSON UI สำหรับ inbound user view<br>"
      "• Result Report และ Result Item — schema/UI รุ่นทำงาน<br>"
      "• Agent result JSON Schema + diagram mapping<br>"
      "• static tests บางส่วนสำหรับ JSON / hierarchy / mapping", "green", size=11)
p.box(1020, 150, 940, 230,
      "<b>⏳ ยังไม่ยืนยัน end-to-end</b><br>"
      "• Process รับ callback จริงและสร้าง receipt<br>"
      "• การจับคู่ Work Item ด้วยข้อมูลจริง<br>"
      "• การสร้าง/ค้น Report แบบ idempotent<br>"
      "• การแตก items[] และ upsert Result Item<br>"
      "• Partial / complete status<br>"
      "• Correction / version history<br>"
      "• App runtime แสดง ListView และเปิดดูผล<br>"
      "• Manual submit / update / audit", "yellow", size=11)
p.box(40, 395, 1920, 46,
      "🔴 <b>ระบบยังไม่ production-ready — ห้ามกล่าวว่า Agent flow หรือ Manual flow ใช้งานได้จริง "
      "จนกว่าจะผ่านการทดสอบทั้งหมด</b>", "red", size=12, valign="middle")

p.band(470, "ข้อจำกัดของ ListView — อย่าสรุปผิดจากหน้าจอที่ไม่ใช่ของจริง")
p.box(40, 520, 620, 175,
      "<b>สิ่งที่ยืนยันแล้ว</b><br><br>"
      "• Preview <b>แสดงกรอบ ListView ได้แม้มี 0 รายการ</b><br>"
      "• Form Manage CRUD <b>ไม่แสดง list-ui</b> แม้ใช้ไฟล์แม่แบบเดียวกันกับที่ Preview แสดงได้", "blue", size=11)
p.box(700, 520, 620, 175,
      "<b>สิ่งที่ต้องทำ</b><br><br>"
      "• ทดสอบหน้าดูผลจริงใน <b>App / View runtime</b> ที่รองรับ ListView<br>"
      "• 🔴 <b>ห้ามใช้ Form Manage CRUD เป็นหลักฐานว่า ListView เสีย</b><br>"
      "• 🔴 ยังห้ามกล่าวว่า App runtime ใช้งานได้จนกว่าจะทดสอบจริง", "red", size=11)
p.box(1360, 520, 600, 175,
      "<b>บทบาทของไฟล์ view</b><br><br>"
      "<b>Lab_Result_Inbound_Receive_User_View_EMR_Person_v2.json</b><br>"
      "= หน้า<b>ดู</b> receipt + รายการผล<br>"
      "🔴 ไม่ใช่ endpoint รับข้อมูล<br>"
      "ListView ข้างในอ่านจาก <b>Lab_Result_Item</b>", "gray", size=11)

p.band(725, "แหล่งอ้างอิงที่เอกสารนี้ยึด")
for i, (f, d) in enumerate((
        ("HIS_AGENT_Interface_Easy.drawio", "หน้า Flow Overview และ Field Mapping"),
        ("HIS_AGENT_Interface_Schema.md", "schema ฝั่ง interface"),
        ("schemas/agent-to-his-result.schema.json", "JSON Schema ของผลจาก Agent"),
        ("LIS_HIS_INTEGRATION_HANDOFF.md", "สัญญากับทีม LISconnect"),
        ("LAB_MANUAL_RESULT_HANDOFF.md", "กติกา Manual Result"),
        ("Lab_Result_Inbound_Receive_Design.md", "ดีไซน์ชั้นรับข้อความ"))):
    col, row = i % 3, i // 3
    p.box(40 + col * 640, 775 + row * 60, 600, 50,
          "<b>%s</b><br>%s" % (f, d), "gray", size=10)

p.legend(910, LEGEND_STD, w=1500)
pages.append(p)

# ============================================================== P6 · Test checklist
p = Page("labres-test", "Test Checklist", h=1120)
p.title("Test checklist ก่อนปิดงาน · และจุดเริ่มต้นของ session ถัดไป",
        "12 เคสนี้คือเงื่อนไขที่ทำให้พูดได้ว่า flow รับผลใช้งานได้จริง")

p.band(100, "12 เคสที่ต้องผ่าน")
TESTS = [
    ("1", "ส่ง payload ใหม่ → สร้าง receipt <b>หนึ่ง</b> record", "purple"),
    ("2", "ส่ง <b>result_uid เดิมซ้ำ</b> → ไม่สร้าง receipt / report / item ซ้ำ", "red"),
    ("3", "Order match สำเร็จด้วย <b>order_no + filler_order_no + visit_id</b>", "purple"),
    ("4", "Order match ไม่สำเร็จ → เก็บ unmatched receipt + error reason", "red"),
    ("5", "Payload หลาย items → สร้าง/อัปเดต Result Item ครบทุก item", "purple"),
    ("6", "ส่ง partial สองรอบ → <b>update item เดิม</b> และสถานะออกผลบางส่วน", "purple"),
    ("7", "ส่ง completed → ออกผลครบ และ stamp เวลาตามกติกา", "purple"),
    ("8", "ส่ง corrected result → เก็บ version และ<b>ประวัติค่าเดิม</b>", "red"),
    ("9", "ส่ง critical → แสดง alert โดย<b>ไม่คำนวณ threshold ซ้ำ</b>", "red"),
    ("10", "เปิด App/View → เห็น ListView แม้ไม่มีข้อมูล และเห็น items เมื่อมีข้อมูล", "yellow"),
    ("11", "Manual ปกติ → แก้ได้<b>เฉพาะผล / หมายเหตุ</b>", "yellow"),
    ("12", "Micrology → กรอกผลและ critical ได้โดยไม่มี Unit พร้อม audit", "yellow"),
]
for i, (n, t, c) in enumerate(TESTS):
    col, row = i % 2, i // 2
    x, y = 40 + col * 970, 150 + row * 62
    p.box(x, y, 50, 50, "<b>%s</b>" % n, "gray", size=13, valign="middle")
    p.box(x + 55, y, 875, 50, t, c, size=11, valign="middle")

p.band(545, "จุดเริ่มต้นสำหรับ session ถัดไป")
STEPS = [
    ("1", "อ่าน <b>MEMORY.md</b>"),
    ("2", "อ่าน <b>LIS_HIS_INTEGRATION_HANDOFF.md</b>"),
    ("3", "อ่าน <b>LAB_MANUAL_RESULT_HANDOFF.md</b>"),
    ("4", "อ่าน <b>SDFORM_JSON_RULES.md</b> ก่อนแก้ SDForm JSON ทุกครั้ง"),
    ("5", "ตรวจว่าไฟล์ไหนคือ latest และสถานะ import / live เป็นอย่างไร ก่อนแก้"),
    ("6", "🔴 ห้ามแก้ JSON จนกว่าจะระบุชัดว่าจะทำ <b>receipt / report / result item / viewer UI</b>"),
    ("7", "รัน validator + static tests และให้ผู้ใช้ยืนยัน Builder / Preview / App runtime ก่อน claim ว่าใช้งานได้"),
]
for i, (n, t) in enumerate(STEPS):
    y = 595 + i * 48
    p.box(40, y, 50, 40, "<b>%s</b>" % n, "gray", size=12, valign="middle")
    p.box(95, y, 1865, 40, t, "red" if n in ("6", "7") else "blue", size=11, valign="middle")

p.legend(950, LEGEND_STD, w=1500)
pages.append(p)

# ============================================================== write
out = ('<mxfile host="app.diagrams.net" agent="claude-code" version="24.7.7" type="device">\n'
       + "\n".join(pg.xml() for pg in pages) + "\n</mxfile>\n")
import io, sys
path = sys.argv[1]
io.open(path, "w", encoding="utf-8").write(out)
print("wrote %s  (%d pages, %d bytes)" % (path, len(pages), len(out)))
