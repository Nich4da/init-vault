#!/usr/bin/env python3
"""Render a PHI-free visual QA preview for X-ray Order Request v1."""

from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import Request, urlopen

from reportlab.graphics.barcode import code128
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[4]
OUTPUT = ROOT / "output/pdf/xray-order-request-v1-preview.pdf"
LOGO_URL = (
    "https://apihis.softmax-one.com/assets/sdform/6a607f2ba608039c539ebb7c/"
    "picture/2026/2026_07/2026_07_27/6a58678ad448dfc9d33e2ba8/"
    "logo_2026_07_27_15_07_3392455.jpeg"
)
FONT_PATH = Path(
    "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/"
    "cf0dc8d3b09f9ba379660e591e82566e2b557949.asset/AssetData/Sarabun.ttc"
)


def draw_pair(pdf, x, y, label, value, split=34 * mm, right=None):
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

    width, height = landscape(A4)
    pdf = canvas.Canvas(str(OUTPUT), pagesize=landscape(A4))
    left = 24
    right = width - 24

    with TemporaryDirectory() as scratch:
        logo = Path(scratch) / "logo.jpeg"
        request = Request(LOGO_URL, headers={"User-Agent": "Mozilla/5.0"})
        logo.write_bytes(urlopen(request, timeout=20).read())
        pdf.drawImage(str(logo), left + 27, height - 24 - 112.5, 81, 112.5, preserveAspectRatio=True, mask="auto")

    center_x = 413
    pdf.setFont("Sarabun-Bold", 21)
    pdf.drawCentredString(center_x, height - 62, "สถาบันสุขภาพเด็กแห่งชาติมหาราชินี")
    pdf.setFont("Sarabun-Bold", 13.5)
    pdf.drawCentredString(center_x, height - 82, "QUEEN SIRIKIT NATIONAL INSTITUTE OF CHILD HEALTH")
    pdf.drawCentredString(center_x, height - 99, "กรมการแพทย์ กระทรวงสาธารณสุข")

    info_x = width - 174
    pdf.setFont("Sarabun-Bold", 12)
    pdf.drawString(info_x, height - 42, "Order No. :")
    pdf.setFont("Sarabun", 12)
    pdf.drawRightString(right, height - 42, "XR-DEMO-0001")
    pdf.setFont("Sarabun-Bold", 12)
    pdf.drawString(info_x, height - 61, "วันที่ :")
    pdf.setFont("Sarabun", 12)
    pdf.drawRightString(right, height - 61, "2026-09-03")
    pdf.setFont("Sarabun-Bold", 12)
    pdf.drawString(info_x, height - 80, "เวลา :")
    pdf.setFont("Sarabun", 12)
    pdf.drawRightString(right, height - 80, "00:40:00")

    barcode = code128.Code128("XR-DEMO-0001", barHeight=30, barWidth=0.72)
    barcode.drawOn(pdf, right - barcode.width, height - 116)

    y = height - 167
    pdf.setFont("Sarabun-Bold", 13.5)
    pdf.drawString(left, y, "เอกซเรย์ทั่วไป")

    y = height - 197
    col2 = left + 412
    draw_pair(pdf, left, y, "ชื่อ :", "นาย ทดสอบ ระบบ", 38,
              (col2, "อายุ :", "25    เพศ : ชาย    HN : 0000000", 38))
    y -= 22.5
    draw_pair(pdf, left, y, "คลินิกที่ส่ง :", "คลินิกตัวอย่าง", 82,
              (col2, "วันที่ :", "2026-09-03    AN :", 43))
    y -= 22.5
    draw_pair(pdf, left, y, "ยาที่เคยได้รับ :", "", 90,
              (col2, "สิทธิการรักษา :", "สิทธิทดสอบ", 90))
    y -= 22.5
    draw_pair(pdf, left, y, "Diagnosis :", "Z00.0 ข้อมูลจำลองสำหรับตรวจ layout", 70)

    y = height - 323
    draw_pair(pdf, left, y, "ผู้ส่งตรวจ :", "QSNICH Admin", 75,
              (col2, "แพทย์ผู้ส่งตรวจ :", "แพทย์ ทดสอบ", 102))
    y -= 21.75
    draw_pair(pdf, left, y, "ความเร่งด่วน :", "ปกติ", 90,
              (col2, "ประเภทการตรวจวินิจฉัย :", "DX", 135))
    y -= 21.75
    draw_pair(pdf, left, y, "หมายเหตุ / ข้อบ่งชี้ :", "", 123)

    y = height - 386
    columns = [left, left + 33, left + 176, left + 524, left + 629, right]
    row_h = 36
    for line_y in (y, y - row_h, y - 2 * row_h):
        pdf.setLineWidth(0.7)
        pdf.line(left, line_y, right, line_y)
    headers = ["#", "Accession No.", "รายการตรวจ", "เครื่อง", "ตำแหน่ง"]
    values = ["1", "", "XR001 Chest PA", "DX", "Chest"]
    for index, text in enumerate(headers):
        x = (columns[index] + columns[index + 1]) / 2
        pdf.setFont("Sarabun-Bold", 12)
        pdf.drawCentredString(x, y - 21, text)
    for index, text in enumerate(values):
        x = (columns[index] + columns[index + 1]) / 2
        pdf.setFont("Sarabun", 12)
        pdf.drawCentredString(x, y - row_h - 21, text)

    footer_y = height - 492
    pdf.setFont("Sarabun", 10.5)
    pdf.drawString(left, footer_y, "Print by : QA User")
    pdf.drawRightString(right, footer_y, "Date : 03/09/2569 00:40:00")
    pdf.save()


if __name__ == "__main__":
    build_preview()
    print(OUTPUT)
