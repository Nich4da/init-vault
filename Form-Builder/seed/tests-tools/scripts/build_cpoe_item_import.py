#!/usr/bin/env python3
"""Build one import-ready CPOE Item workbook from the supplied Lab/X-ray files."""

from __future__ import annotations

from pathlib import Path
import html
import re
import zipfile
from xml.etree import ElementTree as ET


NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
HEADERS = [
    "item_code", "item_name", "order_type", "section_id", "section_name", "room_no", "c_specimen", "service_group",
    "item_desc", "item_group", "item_nhso_code", "item_nhso_bkk_code",
    "item_csmbs_code", "tmlt_code", "item_sub_code", "sale_price", "withdraw_price",
]
SOURCE_COLUMNS = {
    "item_code": ("item_code",), "item_name": ("item_name",), "section_id": ("section_id",),
    "section_name": ("section_name",),
    "c_specimen": ("c_specimen",), "service_group": ("service_group",), "item_desc": ("item_desc",),
    "item_nhso_code": ("item_nhso_code", "nhso_code"),
    "item_nhso_bkk_code": ("item_nhso_bkk_code", "nhso_bkk_code"),
    "item_csmbs_code": ("item_csmbs_code", "csmbs_code"),
    "tmlt_code": ("tmlt_code", "tmt_code"), "item_sub_code": ("item_sub_code",),
    "sale_price": ("sale_price",), "withdraw_price": ("withdraw_price",),
}
ROOM_NO_BY_SECTION = {
    "BG": "70", "BB": "50", "MY": "41", "MB": "40", "MI-OUT": "31",
    "IM": "30", "BC": "10", "HH": "22", "ML": "21", "HM": "20",
}


def column_name(cell_ref: str) -> str:
    return re.match(r"[A-Z]+", cell_ref).group(0)


def read_xlsx(path: Path) -> list[dict[str, str]]:
    with zipfile.ZipFile(path) as book:
        strings: list[str] = []
        if "xl/sharedStrings.xml" in book.namelist():
            root = ET.fromstring(book.read("xl/sharedStrings.xml"))
            strings = ["".join(node.text or "" for node in item.findall(".//m:t", NS))
                       for item in root.findall("m:si", NS)]
        root = ET.fromstring(book.read("xl/worksheets/sheet1.xml"))
        rows = root.findall(".//m:sheetData/m:row", NS)
        parsed: list[dict[str, str]] = []
        for row in rows:
            values: dict[str, str] = {}
            for cell in row.findall("m:c", NS):
                raw = cell.find("m:v", NS)
                value = "" if raw is None else raw.text or ""
                if cell.get("t") == "s" and value:
                    value = strings[int(value)]
                values[column_name(cell.get("r", "A1"))] = value
            parsed.append(values)
    headers = [parsed[0].get(chr(65 + i), "") for i in range(26)]
    return [{headers[i]: row.get(chr(65 + i), "") for i in range(26) if headers[i]}
            for row in parsed[1:]]


def excel_column(index: int) -> str:
    out = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        out = chr(65 + remainder) + out
    return out


def cell_xml(ref: str, value: str, style: int = 0) -> str:
    if value is None:
        value = ""
    value = str(value)
    attrs = f' r="{ref}"' + (f' s="{style}"' if style else "")
    if value == "":
        return f"<c{attrs}/>"
    if value.replace(".", "", 1).isdigit() and not value.startswith("0"):
        return f"<c{attrs}><v>{html.escape(value)}</v></c>"
    return f"<c{attrs} t=\"inlineStr\"><is><t>{html.escape(value)}</t></is></c>"


def write_xlsx(path: Path, rows: list[list[str]]) -> None:
    sheet_rows = []
    for row_index, values in enumerate(rows, 1):
        cells = "".join(cell_xml(f"{excel_column(col_index)}{row_index}", value, 1 if row_index == 1 else 0)
                        for col_index, value in enumerate(values, 1))
        sheet_rows.append(f'<row r="{row_index}">{cells}</row>')
    widths = "".join(f'<col min="{i}" max="{i}" width="{width}" customWidth="1"/>'
                     for i, width in enumerate([18, 42, 14, 16, 34, 12, 16, 15, 42, 18, 16, 18, 16, 16, 16, 14, 14], 1))
    sheet = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
             f'<cols>{widths}</cols><sheetData>{"".join(sheet_rows)}</sheetData>'
             '<autoFilter ref="A1:Q1"/></worksheet>')
    files = {
        '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
        '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="CPOE Items" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
        'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf xfId="0"/><xf xfId="0" fontId="1" applyFont="1"/></cellXfs></styleSheet>',
        'xl/worksheets/sheet1.xml': sheet,
    }
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as book:
        for name, content in files.items():
            book.writestr(name, content)


def main() -> None:
    downloads = Path("/Users/nichada/Downloads")
    sources = [downloads / "cpoe_items_lab_fix.xlsx", downloads / "cpoe_items_xray.xlsx"]
    result: list[list[str]] = [HEADERS]
    for source in sources:
        order_type = 'LAB' if 'lab_' in source.name else 'Xray'
        for row in read_xlsx(source):
            if not row.get("item_code", "").strip():
                continue
            values = []
            for field in HEADERS:
                if field == "order_type":
                    values.append(order_type)
                    continue
                if field == "room_no":
                    values.append(ROOM_NO_BY_SECTION.get(row.get("section_id", "").strip().upper(), ""))
                    continue
                if field == "item_group":
                    values.append(row.get("service_group", ""))
                    continue
                aliases = SOURCE_COLUMNS.get(field, ())
                values.append(next((row.get(key, "") for key in aliases if row.get(key, "") != ""), ""))
            result.append(values)
    # initCraft's Import Excel preview infers available columns from the first
    # sample records. Put real records that contain the billing-code columns
    # first so optional columns are offered in its mapping dropdown.
    code_columns = [HEADERS.index(name) for name in (
        "item_nhso_code", "item_nhso_bkk_code", "item_csmbs_code", "tmlt_code",
    )]
    result[1:] = sorted(
        result[1:],
        key=lambda row: sum(bool(str(row[index]).strip()) for index in code_columns),
        reverse=True,
    )
    output = Path("/Users/nichada/Documents/codex-backup/CPOE_Item_Master_Import.xlsx")
    write_xlsx(output, result)
    print(f"Created {output} with {len(result) - 1} data rows and {len(HEADERS)} form fields.")


if __name__ == "__main__":
    main()
