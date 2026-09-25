from pathlib import Path

from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[4]
OUTPUT = ROOT / "output/pdf/xray-hn-accession-sticker-8.5x2cm-preview.pdf"
PAGE_WIDTH = 8.5 * cm
PAGE_HEIGHT = 2 * cm
FONT = "/System/Library/Fonts/Supplemental/Tahoma.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Tahoma Bold.ttf"


def make_preview() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdfmetrics.registerFont(TTFont("Tahoma", FONT))
    pdfmetrics.registerFont(TTFont("Tahoma-Bold", FONT_BOLD))

    doc = canvas.Canvas(str(OUTPUT), pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    left = 4
    right = PAGE_WIDTH - 4
    right_column = left + ((PAGE_WIDTH - 8) * 0.57)
    baselines = [45, 34, 23, 12]

    doc.setFont("Tahoma-Bold", 7)
    doc.drawString(left, baselines[0], "สถาบันสุขภาพเด็กแห่งชาติมหาราชินี")
    doc.setFont("Tahoma-Bold", 7)
    doc.drawRightString(right, baselines[0], "SM20260902DX001")

    doc.setFont("Tahoma-Bold", 8)
    doc.drawString(left, baselines[1], "ด.ช.เด็กชายทดสอบ ระบบเอกซเรย์")

    doc.setFont("Tahoma", 8)
    doc.drawString(left, baselines[2], "วันเกิด 04/10/2567")
    doc.drawString(right_column, baselines[2], "อายุ 1 ปี 10 เดือน 22 วัน")
    doc.drawString(left, baselines[3], "วันที่ 02-09-2026")
    doc.drawString(right_column, baselines[3], "HN 00000000")

    doc.showPage()
    doc.save()
    print(OUTPUT)


if __name__ == "__main__":
    make_preview()
