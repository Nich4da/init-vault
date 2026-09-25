#!/usr/bin/env python3
"""Render a PHI-free visual QA preview for LAB Order Request v1."""

from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import Request, urlopen

from reportlab.graphics.barcode import code128
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[4]
OUTPUT = ROOT / "output/pdf/lab-order-request-v1-preview.pdf"
LOGO_URL = (
    "https://apihis.softmax-one.com/assets/sdform/6a607f2ba608039c539ebb7c/"
    "picture/2026/2026_07/2026_07_27/6a58678ad448dfc9d33e2ba8/"
    "logo_2026_07_27_15_07_3392455.jpeg"
)
FONT_PATH = Path(
    "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/"
    "cf0dc8d3b09f9ba379660e591e82566e2b557949.asset/AssetData/Sarabun.ttc"
)


def draw_pair(pdf, x, y, label, value, split, right=None):
    pdf.setFont("Sarabun-Bold", 12)
    pdf.drawString(x, y, label)
    pdf.setFont("Sarabun", 12)
    pdf.drawString(x + split, y, value)
    if right:
        rx, rlabel, rvalue, rsplit = right
        pdf.setFont("Sarabun-Bold", 12)
        pdf.drawString(rx, y, rlabel)
        pdf.setFont("Sarabun", 12)
        pdf.drawString(rx + rsplit, y, rvalue)


def build_preview():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdfmetrics.registerFont(TTFont("Sarabun", str(FONT_PATH), subfontIndex=0))
    pdfmetrics.registerFont(TTFont("Sarabun-Bold", str(FONT_PATH), subfontIndex=6))

    width, height = A4
    pdf = canvas.Canvas(str(OUTPUT), pagesize=A4)
    left = 24
    right = width - 24

    with TemporaryDirectory() as scratch:
        logo = Path(scratch) / "logo.jpeg"
        request = Request(LOGO_URL, headers={"User-Agent": "Mozilla/5.0"})
        logo.write_bytes(urlopen(request, timeout=20).read())
        pdf.drawImage(
            str(logo),
            left + 12,
            height - 24 - 10 - 86,
            62,
            86,
            preserveAspectRatio=True,
            mask="auto",
        )

    center_x = width / 2
    pdf.setFont("Sarabun-Bold", 19.5)
    pdf.drawCentredString(center_x, height - 61, "สถาบันสุขภาพเด็กแห่งชาติมหาราชินี")
    pdf.setFont("Sarabun-Bold", 12.75)
    pdf.drawCentredString(center_x, height - 82, "QUEEN SIRIKIT NATIONAL INSTITUTE OF CHILD HEALTH")
    pdf.drawCentredString(center_x, height - 99, "กรมการแพทย์ กระทรวงสาธารณสุข")

    info = (("Order No. :", "LAB-DEMO-0001"), ("วันที่ :", "2026-09-03"), ("เวลา :", "11:30:00"))
    for offset, (label, value) in enumerate(info):
        y = height - 34 - offset * 18
        pdf.setFont("Sarabun", 10)
        pdf.drawRightString(right, y, f"{label}  {value}")

    barcode = code128.Code128("LAB-DEMO-0001", barHeight=22, barWidth=0.47)
    barcode.drawOn(pdf, right - barcode.width, height - 116)

    y = height - 148
    pdf.setFont("Sarabun-Bold", 14)
    pdf.drawString(left, y, "10 Biochemistry งานชีวเคมี")

    y = height - 180
    col2 = left + 284
    draw_pair(pdf, left, y, "ชื่อ :", "นาย ทดสอบ ระบบ", 38,
              (col2, "อายุ :", "25    HN : 0000000", 38))
    y -= 21
    draw_pair(pdf, left, y, "คลินิกที่ส่ง :", "คลินิกตัวอย่าง", 82,
              (col2, "วันที่ :", "2026-09-03    AN :", 43))
    y -= 21
    draw_pair(pdf, left, y, "ยาที่เคยได้รับ :", "", 90,
              (col2, "สิทธิการรักษา :", "สิทธิทดสอบ", 90))
    y -= 21
    pdf.setFont("Sarabun-Bold", 12)
    pdf.drawString(left, y, "Diagnosis :")
    pdf.setFont("Sarabun", 12)
    pdf.drawString(left + 70, y, "Z00.0 ข้อมูลจำลองสำหรับตรวจ layout และการตัดบรรทัด")
    pdf.drawString(left, y - 21, "บรรทัดที่สองต้องอยู่ในคอลัมน์ซ้ายตาม mockup")

    y = height - 300
    draw_pair(pdf, left, y, "Source of specimen :", "Blood", 116,
              (col2, "เก็บวันที่ :", "2026-09-03 10:40:00", 66))
    y -= 21
    draw_pair(pdf, left, y, "Collected by :", "QA User", 82,
              (col2, "การเก็บรักษาก่อนนำส่ง :", "อุณหภูมิห้อง", 142))
    y -= 21
    draw_pair(pdf, left, y, "ผู้ส่งตรวจ :", "QSNICH Admin", 75,
              (col2, "แพทย์ผู้ส่งตรวจ :", "แพทย์ ทดสอบ", 102))

    y = height - 370
    columns = [left, left + 26, left + 130, right - 120, right]
    row_h = 32
    for line_y in (y, y - row_h, y - 2 * row_h, y - 3 * row_h):
        pdf.setLineWidth(0.7)
        pdf.line(left, line_y, right, line_y)
    headers = ["#", "Lab Number", "รายการตรวจ", "Specimen"]
    values = [
        ["1", "LAB-DEMO-001", "C34 Gamma GT", "Clotted blood"],
        ["2", "LAB-DEMO-001", "C64 Ammonia", "EDTA blood"],
    ]
    alignments = ["center", "left", "left", "left"]
    for index, text in enumerate(headers):
        pdf.setFont("Sarabun-Bold", 10)
        if alignments[index] == "center":
            x = (columns[index] + columns[index + 1]) / 2
            pdf.drawCentredString(x, y - 19, text)
        else:
            pdf.drawString(columns[index] + 4, y - 19, text)
    for row_index, row in enumerate(values, start=1):
        for index, text in enumerate(row):
            pdf.setFont("Sarabun", 10)
            baseline = y - row_h * row_index - 19
            if alignments[index] == "center":
                x = (columns[index] + columns[index + 1]) / 2
                pdf.drawCentredString(x, baseline, text)
            else:
                pdf.drawString(columns[index] + 4, baseline, text)

    footer_y = height - 490
    pdf.setFont("Sarabun", 9)
    pdf.drawString(left, footer_y, "Print by : QA User")
    pdf.drawRightString(right, footer_y, "Date : 03/09/2569 11:30:00")
    pdf.save()


if __name__ == "__main__":
    build_preview()
    print(OUTPUT)
