#!/usr/bin/env python3
"""Build a review workbook for Lab Result Definition and Unit Master.

The workbook is generated from read-only MongoDB exports.  It deliberately
does not invent result types, decimal precision, reference ranges, text
choices, or units that are absent from the source masters.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path
import html
import json
import re
import unicodedata
import zipfile


EXPORT_ROOT = Path("/Users/nichada/.mongodb/mongodb-mcp/exports/6a82ac934a790c81ec98607e")
CPOE_EXPORT = EXPORT_ROOT / "6a82add34a790c81ec986080.json"
LAB_TEST_EXPORT = EXPORT_ROOT / "6a82adde4a790c81ec986081.json"
UNIT_EXPORT = EXPORT_ROOT / "6a82adde4a790c81ec986082.json"
OUTPUT = Path("/Users/nichada/Documents/codex-backup/Lab_Result_Definition_Unit_Audit_2026-08-17.xlsx")


def read_export(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def oid(row: dict) -> str:
    value = row.get("_id", "")
    if isinstance(value, dict):
        return str(value.get("$oid", ""))
    return str(value or "")


def clean(value) -> str:
    return "" if value is None else str(value).strip()


def norm(value) -> str:
    text = unicodedata.normalize("NFKC", clean(value)).casefold()
    return re.sub(r"[^0-9a-zก-๙]+", "", text)


def section(row: dict, key: str) -> str:
    return clean(row.get(key)).upper()


def choose_candidate(cpoe: dict, tests_by_code: dict[str, list[dict]], tests_by_name: dict[str, list[dict]]):
    code = norm(cpoe.get("item_code"))
    cpoe_section = section(cpoe, "section_id")
    candidates = list(tests_by_code.get(code, []))
    method = "exact_code"

    if not candidates:
        candidates = list(tests_by_name.get(norm(cpoe.get("item_name")), []))
        method = "exact_name" if candidates else "unmatched"

    if not candidates:
        return None, "UNMATCHED", "ไม่พบ code หรือชื่อที่ตรงกันใน Lab Test Master", method, 0

    same_section = [row for row in candidates if section(row, "seccode") == cpoe_section and cpoe_section]
    if len(same_section) == 1:
        chosen = same_section[0]
        confidence = "HIGH" if method == "exact_code" else "MEDIUM"
        reason = "code และ section ตรงกัน" if method == "exact_code" else "ชื่อตรงและ section ตรงกัน"
        return chosen, confidence, reason, method, len(candidates)

    if len(candidates) == 1:
        chosen = candidates[0]
        test_section = section(chosen, "seccode")
        if cpoe_section and test_section and cpoe_section != test_section:
            return chosen, "REVIEW", f"code/ชื่อตรง แต่ section ต่างกัน ({cpoe_section} != {test_section})", method, 1
        confidence = "HIGH" if method == "exact_code" else "MEDIUM"
        return chosen, confidence, "พบ candidate เดียว", method, 1

    if len(same_section) > 1:
        return None, "AMBIGUOUS", f"พบ {len(same_section)} รายการที่ code/ชื่อและ section ตรงกัน", method, len(candidates)

    return None, "AMBIGUOUS", f"พบ {len(candidates)} candidates แต่ไม่มี section ที่ชี้ได้เพียงรายการเดียว", method, len(candidates)


def unit_issue_rows(units: list[dict]) -> list[list]:
    issues: list[list] = []
    symbol_groups: dict[str, list[dict]] = defaultdict(list)
    for row in units:
        symbol_groups[norm(row.get("unit_symbol"))].append(row)

        code = str(row.get("unit_code") or "")
        symbol = str(row.get("unit_symbol") or "")
        name_en = clean(row.get("unit_name_en")).casefold()
        if code != code.strip():
            issues.append([code, symbol, "TRAILING_SPACE", "unit_code มีช่องว่างหัว/ท้าย", code.strip(), "แก้ก่อนใช้งาน"])
        if symbol in {"IU_L", "U_L"}:
            issues.append([code, symbol, "SYMBOL_FORMAT", "unit_symbol ใช้ underscore แทนเครื่องหมาย /", symbol.replace("_", "/"), "ตรวจยืนยันแล้วแก้"])
        if code.strip() == "ML" and "picogram" in name_en:
            issues.append([code, symbol, "NAME_MISMATCH", "ML แต่ unit_name_en เป็น picogram per millilitre", "millilitre", "ตรวจยืนยันแล้วแก้"])
        if code.strip() == "MMOL_L" and "micromole" in name_en:
            issues.append([code, symbol, "NAME_MISMATCH", "MMOL_L แต่ unit_name_en เป็น micromole per litre", "millimole per litre", "ตรวจยืนยันแล้วแก้"])
        if code.strip() == "NG_L" and norm(symbol) == norm("ng/mL"):
            issues.append([code, symbol, "CODE_SYMBOL_MISMATCH", "NG_L แต่ symbol เป็น ng/mL", "ng/L", "ต้องให้ห้อง Lab ยืนยัน"])

    for rows in symbol_groups.values():
        if len(rows) < 2:
            continue
        labels = ", ".join(clean(row.get("unit_code")) for row in rows)
        for row in rows:
            issues.append([
                clean(row.get("unit_code")), clean(row.get("unit_symbol")), "DUPLICATE_SYMBOL",
                f"unit_symbol ซ้ำในรหัส: {labels}", "", "ตรวจว่าเป็นหน่วยเดียวกันหรือกรอกผิด",
            ])
    return issues


def build_data():
    cpoe_rows = read_export(CPOE_EXPORT)
    test_rows = read_export(LAB_TEST_EXPORT)
    units = read_export(UNIT_EXPORT)

    active_cpoe = [row for row in cpoe_rows if row.get("xrstatx") == 1]
    excluded_cpoe = [row for row in cpoe_rows if row.get("xrstatx") != 1]
    tests_by_code: dict[str, list[dict]] = defaultdict(list)
    tests_by_name: dict[str, list[dict]] = defaultdict(list)
    for row in test_rows:
        if norm(row.get("code")):
            tests_by_code[norm(row.get("code"))].append(row)
        if norm(row.get("name")):
            tests_by_name[norm(row.get("name"))].append(row)

    review_rows: list[list] = []
    status_counts = Counter()
    for cpoe in sorted(active_cpoe, key=lambda row: (section(row, "section_id"), clean(row.get("item_code")), clean(row.get("item_name")))):
        result, status, reason, method, candidate_count = choose_candidate(cpoe, tests_by_code, tests_by_name)
        status_counts[status] += 1
        review_rows.append([
            oid(cpoe), clean(cpoe.get("item_code")), clean(cpoe.get("item_name")),
            section(cpoe, "section_id"), clean(cpoe.get("c_specimen")), clean(cpoe.get("tmlt_code")),
            oid(result or {}), clean((result or {}).get("code")), clean((result or {}).get("name")),
            section(result or {}, "seccode"), clean((result or {}).get("lis_test_code")), clean((result or {}).get("speccode")),
            method, status, candidate_count, reason,
            "", "", "", "", "", "", "",
        ])

    cpoe_code_counts = Counter(norm(row.get("item_code")) for row in active_cpoe)
    duplicate_cpoe = sum(1 for count in cpoe_code_counts.values() if count > 1)
    issue_rows = unit_issue_rows(units)

    readme = [
        ["Lab Result Definition + Unit Master Audit", "สร้างจาก MongoDB แบบ read-only วันที่ 2026-08-17"],
        ["ข้อสรุป", "Dropdown ใช้งานได้แล้ว แต่รายการใน dropdown เป็น catalog รวมทุก section จึงเลือกข้ามห้องได้; ตัวอย่าง ABO group & Rh typing → HM10 PAS stain เป็นคู่ที่ผิด"],
        ["CPOE source", f"836 records ทั้งหมด; ใช้เฉพาะ xrstatx=1 จำนวน {len(active_cpoe)} records; ตัดสถานะอื่น {len(excluded_cpoe)} recordsออกจาก candidate"],
        ["Lab Test source", f"{len(test_rows)} records"],
        ["Unit Master", f"{len(units)} records; ยังสรุปว่าครอบคลุมทุก CPOE ไม่ได้ เพราะ CPOE Master ไม่มี field หน่วย และ Result Definition ยังไม่ได้รับการยืนยัน"],
        ["จับคู่อัตโนมัติ", ", ".join(f"{key}={value}" for key, value in sorted(status_counts.items()))],
        ["CPOE code ซ้ำ", f"พบ {duplicate_cpoe} code ที่มีมากกว่า 1 active row; ต้องยึด _id เป็นตัวอ้างอิง ห้าม map ด้วย code อย่างเดียว"],
        ["ห้าม import ทันที", "Sheet definition_review เป็น candidate เท่านั้น ต้องให้ห้อง Lab ยืนยัน result_type, decimal_places, default_unit, reference range และ text options ก่อน"],
        ["Panel", "CPOE หนึ่งรายการอาจออกหลายผล จึงอาจต้องทำหลายแถวต่อ CPOE _id; exact-code match เพียงอย่างเดียวไม่พิสูจน์ว่าองค์ประกอบ panel ครบ"],
        ["Unit audit", "Sheet unit_issues แสดงข้อผิดปกติในข้อมูลเดิม; proposed_value เป็นข้อเสนอให้ตรวจ ไม่ใช่คำสั่งแก้อัตโนมัติ"],
    ]

    definition_headers = [
        "cpoe_item_id", "cpoe_item_code", "cpoe_item_name", "cpoe_section", "cpoe_specimen", "cpoe_tmlt_code",
        "result_test_id", "result_code", "result_name", "result_section", "lis_test_code", "result_specimen",
        "match_method", "review_status", "candidate_count", "review_reason",
        "confirmed", "result_type", "decimal_places", "default_unit_id", "default_unit_symbol",
        "reference_range_text", "allowed_text_options",
    ]
    current_unit_headers = [
        "_id", "unit_code", "unit_symbol", "unit_name_th", "unit_name_en", "unit_dimension",
        "decimal_places_default", "is_active", "unit_note",
    ]
    current_unit_rows = [[
        oid(row), clean(row.get("unit_code")), clean(row.get("unit_symbol")), clean(row.get("unit_name_th")),
        clean(row.get("unit_name_en")), clean(row.get("unit_dimension")), row.get("decimal_places_default", ""),
        row.get("is_active", ""), clean(row.get("unit_note")),
    ] for row in sorted(units, key=lambda row: clean(row.get("unit_code")))]

    coverage_headers = [
        "cpoe_item_id", "item_code", "item_name", "section_id", "c_specimen", "result_mapping_status",
        "confirmed_result_type", "confirmed_unit_code", "confirmed_unit_symbol", "lab_confirmed_by", "note",
    ]
    coverage_rows = [[
        row[0], row[1], row[2], row[3], row[4], row[13], "", "", "", "", "",
    ] for row in review_rows]

    return [
        Sheet("README", readme, [30, 110], False),
        Sheet("definition_review", [definition_headers] + review_rows,
              [25, 16, 45, 14, 14, 16, 25, 16, 45, 14, 16, 14, 16, 16, 14, 48, 12, 16, 14, 25, 18, 42, 42]),
        Sheet("unit_master_current", [current_unit_headers] + current_unit_rows,
              [25, 18, 18, 30, 34, 18, 20, 12, 35]),
        Sheet("unit_issues", [["unit_code", "unit_symbol", "issue_type", "issue", "proposed_value", "action"]] + issue_rows,
              [18, 18, 24, 55, 30, 34]),
        Sheet("cpoe_unit_coverage", [coverage_headers] + coverage_rows,
              [25, 16, 45, 14, 14, 20, 22, 22, 24, 24, 40]),
    ]


class Sheet:
    def __init__(self, name: str, rows: list[list], widths: list[int], auto_filter: bool = True, merge: str = ""):
        self.name = name
        self.rows = rows
        self.widths = widths
        self.auto_filter = auto_filter
        self.merge = merge


def excel_column(index: int) -> str:
    output = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        output = chr(65 + remainder) + output
    return output


def cell_xml(ref: str, value, style: int = 0) -> str:
    attrs = f' r="{ref}"' + (f' s="{style}"' if style else "")
    if value is None or value == "":
        return f"<c{attrs}/>"
    if isinstance(value, bool):
        return f'<c{attrs} t="b"><v>{1 if value else 0}</v></c>'
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f"<c{attrs}><v>{value}</v></c>"
    text = html.escape(str(value))
    preserve = ' xml:space="preserve"' if str(value) != str(value).strip() else ""
    return f'<c{attrs} t="inlineStr"><is><t{preserve}>{text}</t></is></c>'


def sheet_xml(sheet: Sheet) -> str:
    rows_xml = []
    for row_index, values in enumerate(sheet.rows, 1):
        cells = []
        for column_index, value in enumerate(values, 1):
            style = 1 if row_index == 1 else (2 if sheet.name == "README" and column_index == 1 else 0)
            cells.append(cell_xml(f"{excel_column(column_index)}{row_index}", value, style))
        rows_xml.append(f'<row r="{row_index}">{"".join(cells)}</row>')
    widths_xml = "".join(
        f'<col min="{index}" max="{index}" width="{width}" customWidth="1"/>'
        for index, width in enumerate(sheet.widths, 1)
    )
    last_column = excel_column(max((len(row) for row in sheet.rows), default=1))
    auto_filter = f'<autoFilter ref="A1:{last_column}1"/>' if sheet.auto_filter and sheet.rows else ""
    freeze = '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' if sheet.auto_filter else ""
    merge = f'<mergeCells count="1"><mergeCell ref="{sheet.merge}"/></mergeCells>' if sheet.merge else ""
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetViews><sheetView workbookViewId="0">{freeze}</sheetView></sheetViews>'
        f'<cols>{widths_xml}</cols><sheetData>{"".join(rows_xml)}</sheetData>{auto_filter}{merge}'
        '</worksheet>'
    )


def write_xlsx(path: Path, sheets: list[Sheet]) -> None:
    content_types = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    ]
    for index in range(1, len(sheets) + 1):
        content_types.append(f'<Override PartName="/xl/worksheets/sheet{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>')
    content_types.append('</Types>')

    workbook_sheets = "".join(
        f'<sheet name="{html.escape(sheet.name)}" sheetId="{index}" r:id="rId{index}"/>'
        for index, sheet in enumerate(sheets, 1)
    )
    workbook_rels = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    ]
    for index in range(1, len(sheets) + 1):
        workbook_rels.append(f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>')
    workbook_rels.append(f'<Relationship Id="rId{len(sheets) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>')
    workbook_rels.append('</Relationships>')

    styles = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><color rgb="FF1F4E78"/><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill></fills>'
        '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs>'
        '<cellXfs count="3"><xf xfId="0"/><xf xfId="0" fontId="1" fillId="2" applyFont="1" applyFill="1"/>'
        '<xf xfId="0" fontId="2" applyFont="1"/></cellXfs></styleSheet>'
    )

    files = {
        '[Content_Types].xml': "".join(content_types),
        '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        'xl/workbook.xml': f'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>{workbook_sheets}</sheets></workbook>',
        'xl/_rels/workbook.xml.rels': "".join(workbook_rels),
        'xl/styles.xml': styles,
    }
    for index, sheet in enumerate(sheets, 1):
        files[f'xl/worksheets/sheet{index}.xml'] = sheet_xml(sheet)

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as book:
        for name, content in files.items():
            book.writestr(name, content)


def main() -> None:
    sheets = build_data()
    write_xlsx(OUTPUT, sheets)
    print(f"Created {OUTPUT}")
    for sheet in sheets:
        print(f"{sheet.name}: {max(len(sheet.rows) - 1, 0)} data rows")


if __name__ == "__main__":
    main()
