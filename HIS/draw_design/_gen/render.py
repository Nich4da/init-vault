# -*- coding: utf-8 -*-
"""Rough renderer: draws drawio geometry + wrapped text to PNG so layout/overflow can be eyeballed."""
import sys, re, html, xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

FONT = "/System/Library/Fonts/Supplemental/Ayuthaya.ttf"
cache = {}
def f(sz, bold=False):
    k = (sz, bold)
    if k not in cache:
        cache[k] = ImageFont.truetype(FONT, sz)
    return cache[k]

def light(style, key, dflt=None):
    m = re.search(key + r"=(light-dark\([^)]*\)|[^;]*)", style)
    if not m: return dflt
    v = m.group(1)
    m2 = re.match(r"light-dark\(([^,]*),", v)
    return m2.group(1) if m2 else v

def strip(v):
    v = re.sub(r"<br\s*/?>", "\n", v)
    v = re.sub(r"<[^>]+>", "", v)
    return html.unescape(v)

def wrap(d, text, font, w):
    out = []
    for para in text.split("\n"):
        line = ""
        for ch in para:
            if d.textlength(line + ch, font=font) > w and line:
                out.append(line); line = ch
            else:
                line += ch
        out.append(line)
    return out

tree = ET.parse(sys.argv[1])
for pi, diag in enumerate(tree.getroot()):
    if len(sys.argv) > 3 and str(pi) != sys.argv[3]: continue
    m = diag.find("mxGraphModel")
    W, H = int(m.get("pageWidth")), int(m.get("pageHeight"))
    img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
    root = m.find("root")
    cells = {c.get("id"): c for c in root.iter("mxCell")}
    def abspos(c):
        g = c.find("mxGeometry")
        if g is None or g.get("x") is None: return None
        x, y = float(g.get("x")), float(g.get("y"))
        p = cells.get(c.get("parent"))
        while p is not None and p.get("id") not in ("0", "1"):
            pg = p.find("mxGeometry")
            if pg is not None and pg.get("x"):
                x += float(pg.get("x")); y += float(pg.get("y"))
            p = cells.get(p.get("parent"))
        return x, y, float(g.get("width") or 0), float(g.get("height") or 0)
    boxes = []
    for c in root.iter("mxCell"):
        if c.get("vertex") != "1": continue
        pos = abspos(c)
        if not pos: continue
        x, y, w, h = pos
        st = c.get("style") or ""
        fill = light(st, "fillColor", "#ffffff")
        stroke = light(st, "strokeColor", "#000000")
        if fill == "none": fill = None
        istext = st.startswith("text;")
        if not istext:
            d.rectangle([x, y, x + w, y + h], fill=fill, outline=stroke)
        sz = int(light(st, "fontSize", "11"))
        bold = "fontStyle=1" in st
        val = strip(c.get("value") or "")
        if val:
            fnt = f(max(sz, 8), bold)
            pad = 8 if not istext else 0
            lines = wrap(d, val, fnt, max(w - pad * 2, 10))
            lh = sz + 4
            total = len(lines) * lh
            va = light(st, "verticalAlign", "middle")
            ty = y + 4 if va == "top" else y + max((h - total) / 2, 2)
            al = light(st, "align", "center")
            for i, ln in enumerate(lines):
                tw = d.textlength(ln, font=fnt)
                tx = x + pad if al == "left" else x + (w - tw) / 2
                d.text((tx, ty + i * lh), ln, font=fnt, fill="#222222")
            boxes.append((c.get("id"), x, y, w, h, total + 8, h, val[:40]))
    # edges (straight approximation)
    for c in root.iter("mxCell"):
        if c.get("edge") != "1": continue
        s, t = cells.get(c.get("source")), cells.get(c.get("target"))
        if s is None or t is None: continue
        ps, pt = abspos(s), abspos(t)
        if not ps or not pt: continue
        a = (ps[0] + ps[2] / 2, ps[1] + ps[3] / 2); b = (pt[0] + pt[2] / 2, pt[1] + pt[3] / 2)
        d.line([a, b], fill="#888888", width=2)
    img.save(sys.argv[2] % pi)
    over = [b for b in boxes if b[5] > b[6] + 2]
    print("page %d %s -> %s" % (pi, diag.get("name"), sys.argv[2] % pi))
    for b in over:
        print("   OVERFLOW %-22s need~%dpx have %dpx  | %s" % (b[0], b[5], b[6], b[7]))
