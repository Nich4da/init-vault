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

