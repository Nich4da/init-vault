#!/usr/bin/env python3
"""Build an import-ready Lab Unit Master workbook from CPOE + official TMLT Browser.

The first worksheet contains exactly the four user-approved Unit Master fields.
Other worksheets are audit evidence.  TMLT's Unit part is a terminology
candidate, not proof of the unit configured in the hospital's local LIS.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from pathlib import Path
import html
import json
import re
import zipfile


WORKSPACE = Path("/Users/nichada/Documents/codex-backup")
CPOE_EXPORT = Path(
    "/Users/nichada/.mongodb/mongodb-mcp/exports/6a82ac934a790c81ec98607e/"
    "6a82b5f14a790c81ec986084.json"
)
TMLT_PAGE_PATTERN = "/private/tmp/tmlt_{page}.json"
TMLT_VERSION = "20260803"
ANALYSIS_DATE = "2026-08-17"
OUTPUT = WORKSPACE / "Lab_Unit_Master_Import_from_CPOE_TMLT_2026-08-17.xlsx"
SOURCE_JSON = WORKSPACE / "CPOE_TMLT_Unit_Analysis_2026-08-17.json"
NON_UNIT_MARKERS = {"N/A", "+/-"}


UNIT_NAMES = {
    "%": ("percent", "เปอร์เซ็นต์"),
    "10*3/uL": ("10^3 per microlitre", "10^3 ต่อไมโครลิตร"),
    "10*9/L": ("10^9 per litre", "10^9 ต่อลิตร"),
    "INR": ("international normalized ratio", "อัตราส่วนมาตรฐานสากล"),
    "IU/L": ("international unit per litre", "หน่วยสากลต่อลิตร"),
    "IU/g Hb": ("international unit per gram of hemoglobin", "หน่วยสากลต่อกรัมฮีโมโกลบิน"),
    "IU/mL": ("international unit per millilitre", "หน่วยสากลต่อมิลลิลิตร"),
    "KAU/L": ("kilo allergy unit per litre", "กิโลอัลเลอร์จีหน่วยต่อลิตร"),
    "RU/mL": ("relative unit per millilitre", "หน่วยสัมพัทธ์ต่อมิลลิลิตร"),
    "Ratio": ("ratio", "อัตราส่วน"),
    "Titer": ("titer", "ไตเตอร์"),
    "U/L": ("unit per litre", "หน่วยต่อลิตร"),
    "U/g Hgb": ("unit per gram of hemoglobin", "หน่วยต่อกรัมฮีโมโกลบิน"),
    "U/mL": ("unit per millilitre", "หน่วยต่อมิลลิลิตร"),
    "U/mL RBC": ("unit per millilitre of red blood cells", "หน่วยต่อมิลลิลิตรเม็ดเลือดแดง"),
    "Units/mL": ("units per millilitre", "หน่วยต่อมิลลิลิตร"),
    "Units/volume": ("units per volume", "หน่วยต่อปริมาตร"),
    "arb U/mL": ("arbitrary unit per millilitre", "หน่วยสมมติต่อมิลลิลิตร"),
    "cells/mm3": ("cells per cubic millimetre", "เซลล์ต่อลูกบาศก์มิลลิเมตร"),
    "cells/uL": ("cells per microlitre", "เซลล์ต่อไมโครลิตร"),
    "copies/mL": ("copies per millilitre", "สำเนาต่อมิลลิลิตร"),
    "g/L": ("gram per litre", "กรัมต่อลิตร"),
    "g/dL": ("gram per decilitre", "กรัมต่อเดซิลิตร"),
    "gm/24H": ("gram per 24 hours", "กรัมต่อ 24 ชั่วโมง"),
    "kU/L": ("kilounit per litre", "กิโลยูนิตต่อลิตร"),
    "log copies/mL": ("log copies per millilitre", "ลอการิทึมสำเนาต่อมิลลิลิตร"),
    "mIU/L": ("milli-international unit per litre", "มิลลิหน่วยสากลต่อลิตร"),
    "mIU/mL": ("milli-international unit per millilitre", "มิลลิหน่วยสากลต่อมิลลิลิตร"),
    "mL/min": ("millilitre per minute", "มิลลิลิตรต่อนาที"),
    "mOsm/L": ("milliosmole per litre", "มิลลิออสโมลต่อลิตร"),
    "mOsmol/kg": ("milliosmole per kilogram", "มิลลิออสโมลต่อกิโลกรัม"),
    "mU/L": ("milliunit per litre", "มิลลิยูนิตต่อลิตร"),
    "mU/mL": ("milliunit per millilitre", "มิลลิยูนิตต่อมิลลิลิตร"),
    "mcg/dL": ("microgram per decilitre", "ไมโครกรัมต่อเดซิลิตร"),
    "mcg/mL": ("microgram per millilitre", "ไมโครกรัมต่อมิลลิลิตร"),
    "mg/24H": ("milligram per 24 hours", "มิลลิกรัมต่อ 24 ชั่วโมง"),
    "mg/L": ("milligram per litre", "มิลลิกรัมต่อลิตร"),
    "mg/dL": ("milligram per decilitre", "มิลลิกรัมต่อเดซิลิตร"),
    "mg/mL": ("milligram per millilitre", "มิลลิกรัมต่อมิลลิลิตร"),
    "min": ("minute", "นาที"),
    "mm/hr": ("millimetre per hour", "มิลลิเมตรต่อชั่วโมง"),
    "mmol/L": ("millimole per litre", "มิลลิโมลต่อลิตร"),
    "mol/L": ("mole per litre", "โมลต่อลิตร"),
    "mosm/kg": ("milliosmole per kilogram", "มิลลิออสโมลต่อกิโลกรัม"),
    "ng/L": ("nanogram per litre", "นาโนกรัมต่อลิตร"),
    "ng/dL": ("nanogram per decilitre", "นาโนกรัมต่อเดซิลิตร"),
    "ng/mL": ("nanogram per millilitre", "นาโนกรัมต่อมิลลิลิตร"),
    "ng/mL/90 min": ("nanogram per millilitre per 90 minutes", "นาโนกรัมต่อมิลลิลิตรต่อ 90 นาที"),
    "ng/mL/H": ("nanogram per millilitre per hour", "นาโนกรัมต่อมิลลิลิตรต่อชั่วโมง"),
    "pH": ("pH", "พีเอช"),
    "pg/mL": ("picogram per millilitre", "พิโคกรัมต่อมิลลิลิตร"),
    "pmol/h/mg Hb": ("picomole per hour per milligram of hemoglobin", "พิโคโมลต่อชั่วโมงต่อมิลลิกรัมฮีโมโกลบิน"),
    "sec": ("second", "วินาที"),
    "uIU/mL": ("micro-international unit per millilitre", "ไมโครหน่วยสากลต่อมิลลิลิตร"),
    "uU/mL": ("microunit per millilitre", "ไมโครยูนิตต่อมิลลิลิตร"),
    "ug/L": ("microgram per litre", "ไมโครกรัมต่อลิตร"),
    "ug/dL": ("microgram per decilitre", "ไมโครกรัมต่อเดซิลิตร"),
    "ug/g": ("microgram per gram", "ไมโครกรัมต่อกรัม"),
    "ug/mL": ("microgram per millilitre", "ไมโครกรัมต่อมิลลิลิตร"),
    "umol/L": ("micromole per litre", "ไมโครโมลต่อลิตร"),
}


LIKELY_ALIAS = {
    "gm/24H": "g/24H (ไม่มีอยู่ในชุด CPOE นี้; คง symbol ตาม TMLT)",
    "mcg/dL": "ug/dL",
    "mcg/mL": "ug/mL",
    "mOsmol/kg": "mosm/kg (ตรวจยืนยันรูปแบบตัวพิมพ์/การสะกด)",
    "mosm/kg": "mOsmol/kg (ตรวจยืนยันรูปแบบตัวพิมพ์/การสะกด)",
}


def clean(value) -> str:
    return "" if value is None else str(value).strip()


def object_id(row: dict) -> str:
    value = row.get("_id", "")
    if isinstance(value, dict):
        return clean(value.get("$oid"))
    return clean(value)


def unit_code(symbol: str) -> str:
    special = {"%": "PERCENT", "10*3/uL": "COUNT_10E3_UL", "10*9/L": "COUNT_10E9_L"}
    if symbol in special:
        return special[symbol]
    code = symbol.upper().replace("/", "_").replace("*", "E")
    code = re.sub(r"[^A-Z0-9]+", "_", code).strip("_")
    return code


def unit_class(symbol: str) -> str:
    if symbol in {"%", "INR", "Ratio", "Titer", "pH"}:
        return "REPORTING_SCALE"
    if symbol in {"Units/volume", "Units/mL", "U/L", "U/mL", "U/g Hgb", "U/mL RBC", "arb U/mL", "RU/mL"}:
        return "GENERIC_REPORTING_UNIT"
    return "MEASUREMENT_UNIT"


def mapping_status(units: list[str]) -> str:
    candidates = [unit for unit in units if unit not in NON_UNIT_MARKERS]
    if len(candidates) > 1:
        return "MULTI_UNIT_REVIEW"
    if len(candidates) == 1:
        return "SINGLE_UNIT_CANDIDATE"
    if units and set(units) == {"+/-"}:
        return "QUALITATIVE_MARKER"
    if units and set(units) == {"N/A"}:
        return "NO_UNIT"
    return "REVIEW"


def review_note(status: str) -> str:
    return {
        "NO_TMLT": "CPOE ไม่มี TMLT code; ต้องใช้ LIS/result export หรือให้ห้อง Lab ยืนยัน",
        "MULTI_UNIT_REVIEW": "TMLT ให้ได้หลายหน่วย; ห้ามตั้ง default จนกว่าจะยืนยันจาก LIS/เครื่องตรวจ",
        "SINGLE_UNIT_CANDIDATE": "TMLT ให้ candidate เดียว แต่ยังต้องยืนยันว่าเป็นหน่วยที่ LIS โรงพยาบาลใช้จริง",
        "QUALITATIVE_MARKER": "+/- เป็นรูปแบบผล ไม่ต้อง import เป็น Unit Master",
        "NO_UNIT": "N/A หมายถึงไม่มีหน่วย ไม่ต้อง import เป็น Unit Master",
        "REVIEW": "ต้องตรวจสอบเพิ่มเติม",
    }[status]


def load_sources():
    cpoe = json.loads(CPOE_EXPORT.read_text(encoding="utf-8"))
    tmlt = []
    for page in range(1, 28):
        path = Path(TMLT_PAGE_PATTERN.format(page=page))
        tmlt.extend(json.loads(path.read_text(encoding="utf-8"))["data"])
    assert len(cpoe) == 830, f"Expected 830 active CPOE rows, got {len(cpoe)}"
    assert len(tmlt) == 5287, f"Expected 5,287 TMLT records, got {len(tmlt)}"
    return cpoe, tmlt


@dataclass
class Sheet:
    name: str
    rows: list[list]
    widths: list[int]
    auto_filter: bool = True


def build_sheets(cpoe: list[dict], tmlt: list[dict]):
    tmlt_by_code = {clean(row.get("tmltCode")): row for row in tmlt}
    mapped_rows = []
    no_tmlt_rows = []
    multi_rows = []
    status_counts = Counter()
    unit_occurrences = Counter()
    unit_code_occurrences: dict[str, set[str]] = {}
    used_tmlt_codes = set()

    for item in cpoe:
        code = clean(item.get("tmlt_code"))
        source = tmlt_by_code.get(code) if code not in {"", "-"} else None
        if source is None:
            status = "NO_TMLT"
            units = []
            no_tmlt_rows.append([
                object_id(item), clean(item.get("item_code")), clean(item.get("item_name")),
                clean(item.get("section_id")), clean(item.get("c_specimen")), code,
                review_note(status),
            ])
        else:
            used_tmlt_codes.add(code)
            units = list(source.get("unit") or [])
            status = mapping_status(units)
            for symbol in units:
                unit_occurrences[symbol] += 1
                unit_code_occurrences.setdefault(symbol, set()).add(code)
        status_counts[status] += 1
        candidates = [symbol for symbol in units if symbol not in NON_UNIT_MARKERS]
        candidate_codes = [unit_code(symbol) for symbol in candidates]
        mapped = [
            object_id(item), clean(item.get("item_code")), clean(item.get("item_name")),
            clean(item.get("section_id")), clean(item.get("c_specimen")), code,
            clean((source or {}).get("longCommonName")),
            "ITEM" if (source or {}).get("labType") == 1 else ("PANEL" if source else ""),
            clean((source or {}).get("scale")), " | ".join(units), len(candidates),
            status, " | ".join(candidate_codes), "NO", review_note(status), TMLT_VERSION,
        ]
        mapped_rows.append(mapped)
        if status == "MULTI_UNIT_REVIEW":
            multi_rows.append(mapped)

    import_symbols = sorted(symbol for symbol in unit_occurrences if symbol not in NON_UNIT_MARKERS)
    assert set(import_symbols) == set(UNIT_NAMES), (
        f"UNIT_NAMES mismatch; missing={set(import_symbols)-set(UNIT_NAMES)}, "
        f"extra={set(UNIT_NAMES)-set(import_symbols)}"
    )
    codes = [unit_code(symbol) for symbol in import_symbols]
    assert len(codes) == len(set(codes)), "Generated unit_code collision"

    import_rows = [["unit_code", "unit_symbol", "unit_name_en", "unit_name_th"]]
    audit_rows = [[
        "unit_code", "unit_symbol", "unit_name_en", "unit_name_th", "unit_class",
        "cpoe_row_occurrences", "distinct_tmlt_codes", "likely_alias_review",
        "source", "source_version", "local_lis_confirmed",
    ]]
    for symbol in import_symbols:
        name_en, name_th = UNIT_NAMES[symbol]
        code = unit_code(symbol)
        import_rows.append([code, symbol, name_en, name_th])
        audit_rows.append([
            code, symbol, name_en, name_th, unit_class(symbol), unit_occurrences[symbol],
            len(unit_code_occurrences[symbol]), LIKELY_ALIAS.get(symbol, ""),
            "TMLT Browser Unit part", TMLT_VERSION, "NO",
        ])

    all_source_unit_rows = [[
        "source_unit_value", "cpoe_row_occurrences", "distinct_tmlt_codes", "handling", "reason"
    ]]
    for symbol in sorted(unit_occurrences):
        if symbol == "N/A":
            handling = "DO_NOT_IMPORT"
            reason = "ไม่มีหน่วย"
        elif symbol == "+/-":
            handling = "DO_NOT_IMPORT"
            reason = "รูปแบบผลเชิงคุณภาพ ไม่ใช่หน่วยวัด"
        else:
            handling = "IN_UNIT_MASTER_IMPORT"
            reason = "Unit part ที่พบใน TMLT code ของ CPOE"
        all_source_unit_rows.append([
            symbol, unit_occurrences[symbol], len(unit_code_occurrences[symbol]), handling, reason
        ])

    tmlt_cpoe_rows = sum(value for key, value in status_counts.items() if key != "NO_TMLT")
    summary_rows = [
        ["CPOE → TMLT Unit analysis", "ผลวิเคราะห์สำหรับสร้าง Lab Unit Master"],
        ["วันที่วิเคราะห์", ANALYSIS_DATE],
        ["TMLT Browser version", TMLT_VERSION],
        ["CPOE active items", len(cpoe)],
        ["CPOE rows ที่มี TMLT code", tmlt_cpoe_rows],
        ["TMLT code ที่จับคู่ได้", f"{tmlt_cpoe_rows}/{tmlt_cpoe_rows} rows; {len(used_tmlt_codes)} distinct codes"],
        ["CPOE rows ที่ไม่มี TMLT code", status_counts["NO_TMLT"]],
        ["ค่า Unit part ที่พบ", len(unit_occurrences)],
        ["Unit Master import", f"{len(import_symbols)} records (ตัด N/A และ +/- ออก)"],
        ["ไม่มีหน่วย (N/A)", status_counts["NO_UNIT"]],
        ["ผลเชิงคุณภาพ (+/-)", status_counts["QUALITATIVE_MARKER"]],
        ["Candidate หน่วยเดียว", status_counts["SINGLE_UNIT_CANDIDATE"]],
        ["หลายหน่วย ต้องเลือก", status_counts["MULTI_UNIT_REVIEW"]],
        ["คำตอบเรื่อง 18 หน่วยเดิม", "ไม่ครอบคลุม: TMLT ของรายการ CPOE ที่มีรหัสพบ 60 unit/reporting symbols ที่ควรอยู่ใน master"],
        ["ข้อจำกัดสำคัญ", "60 คือ candidate vocabulary จาก TMLT ไม่ใช่หลักฐานว่า LIS โรงพยาบาลตั้งใช้ครบทุกหน่วย"],
        ["ห้ามทำอัตโนมัติ", "อย่านำ candidate ไปตั้ง default_unit ราย CPOE โดยไม่ยืนยันจาก LIS/เครื่องตรวจ โดยเฉพาะ 58 rows ที่มีหลายหน่วย"],
        ["วิธี import", "ใช้ชีตแรก Unit_Master_Import; มีเพียง 4 fields ตามฟอร์ม Unit Master"],
        ["แหล่ง CPOE", "MongoDB his.zdata_6a7c7c2974a0be190cc303e0 (read-only export, xrstatx=1)"],
        ["แหล่งมาตรฐาน", "Official TMLT Browser API: https://tmlt-browser.this.or.th/"],
        ["มาตรฐานรูปแบบหน่วย", "UCUM reference: https://ucum.org/ucum"],
    ]

    mapping_headers = [
        "cpoe_item_id", "item_code", "item_name", "section_id", "c_specimen", "tmlt_code",
        "tmlt_long_common_name", "tmlt_lab_type", "tmlt_scale", "tmlt_unit_values",
        "candidate_unit_count", "mapping_status", "candidate_unit_codes",
        "auto_set_default_unit", "review_note", "tmlt_version",
    ]
    no_tmlt_headers = [
        "cpoe_item_id", "item_code", "item_name", "section_id", "c_specimen", "tmlt_code", "review_note"
    ]

    return [
        Sheet("Unit_Master_Import", import_rows, [24, 22, 48, 48]),
        Sheet("Summary", summary_rows, [32, 115], False),
        Sheet("Unit_Audit", audit_rows, [24, 22, 48, 48, 26, 22, 22, 50, 30, 18, 20]),
        Sheet("CPOE_TMLT_Unit_Map", [mapping_headers] + mapped_rows,
              [25, 16, 48, 14, 15, 16, 60, 16, 20, 34, 20, 24, 40, 22, 65, 16]),
        Sheet("Multi_Unit_Review", [mapping_headers] + multi_rows,
              [25, 16, 48, 14, 15, 16, 60, 16, 20, 34, 20, 24, 40, 22, 65, 16]),
        Sheet("No_TMLT_Review", [no_tmlt_headers] + no_tmlt_rows,
              [25, 16, 48, 14, 15, 16, 65]),
        Sheet("Source_Unit_Values", all_source_unit_rows, [28, 24, 22, 26, 55]),
    ], {
        "analysis_date": ANALYSIS_DATE,
        "tmlt_browser_version": TMLT_VERSION,
        "source": {
            "cpoe_collection": "his.zdata_6a7c7c2974a0be190cc303e0",
            "cpoe_filter": {"xrstatx": 1},
            "tmlt_browser": "https://tmlt-browser.this.or.th/",
            "tmlt_api": "https://tmlt-backend.this.or.th/api/tmlt/viewer/filter",
        },
        "counts": {
            "cpoe_active_rows": len(cpoe),
            "cpoe_rows_with_tmlt": tmlt_cpoe_rows,
            "distinct_tmlt_codes": len(used_tmlt_codes),
            "cpoe_rows_without_tmlt": status_counts["NO_TMLT"],
            "source_unit_values_including_markers": len(unit_occurrences),
            "unit_master_import_records": len(import_symbols),
            "mapping_status": dict(status_counts),
        },
        "non_unit_markers_excluded": sorted(NON_UNIT_MARKERS),
        "unit_master_import": [
            {
                "unit_code": unit_code(symbol),
                "unit_symbol": symbol,
                "unit_name_en": UNIT_NAMES[symbol][0],
                "unit_name_th": UNIT_NAMES[symbol][1],
                "cpoe_row_occurrences": unit_occurrences[symbol],
                "distinct_tmlt_codes": len(unit_code_occurrences[symbol]),
            }
            for symbol in import_symbols
        ],
        "cpoe_mapping": [dict(zip(mapping_headers, row)) for row in mapped_rows],
    }


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
            style = 1 if row_index == 1 else (2 if sheet.name == "Summary" and column_index == 1 else 0)
            cells.append(cell_xml(f"{excel_column(column_index)}{row_index}", value, style))
        rows_xml.append(f'<row r="{row_index}">{"".join(cells)}</row>')
    widths_xml = "".join(
        f'<col min="{index}" max="{index}" width="{width}" customWidth="1"/>'
        for index, width in enumerate(sheet.widths, 1)
    )
    last_column = excel_column(max((len(row) for row in sheet.rows), default=1))
    auto_filter = f'<autoFilter ref="A1:{last_column}1"/>' if sheet.auto_filter else ""
    freeze = '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' if sheet.auto_filter else ""
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetViews><sheetView workbookViewId="0">{freeze}</sheetView></sheetViews>'
        f'<cols>{widths_xml}</cols><sheetData>{"".join(rows_xml)}</sheetData>{auto_filter}'
        '</worksheet>'
    )


def write_xlsx(path: Path, sheets: list[Sheet]) -> None:
    overrides = "".join(
        f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        for i in range(1, len(sheets) + 1)
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        f'{overrides}</Types>'
    )
    workbook_sheets = "".join(
        f'<sheet name="{html.escape(sheet.name)}" sheetId="{i}" r:id="rId{i}"/>'
        for i, sheet in enumerate(sheets, 1)
    )
    workbook = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<sheets>{workbook_sheets}</sheets></workbook>'
    )
    relationships = "".join(
        f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>'
        for i in range(1, len(sheets) + 1)
    )
    workbook_rels = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f'{relationships}'
        f'<Relationship Id="rId{len(sheets)+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        '</Relationships>'
    )
    styles = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="3"><fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FF2F75B5"/><bgColor indexed="64"/></patternFill></fill></fills>'
        '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs>'
        '<cellXfs count="3"><xf xfId="0"/><xf xfId="0" fontId="1" fillId="2" applyFont="1" applyFill="1"/>'
        '<xf xfId="0" fontId="2" applyFont="1"/></cellXfs></styleSheet>'
    )
    files = {
        "[Content_Types].xml": content_types,
        "_rels/.rels": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '</Relationships>'
        ),
        "xl/workbook.xml": workbook,
        "xl/_rels/workbook.xml.rels": workbook_rels,
        "xl/styles.xml": styles,
    }
    for i, sheet in enumerate(sheets, 1):
        files[f"xl/worksheets/sheet{i}.xml"] = sheet_xml(sheet)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as book:
        for name, content in files.items():
            book.writestr(name, content)


def main() -> None:
    cpoe, tmlt = load_sources()
    sheets, audit_json = build_sheets(cpoe, tmlt)
    write_xlsx(OUTPUT, sheets)
    SOURCE_JSON.write_text(json.dumps(audit_json, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Created {OUTPUT} with {len(sheets[0].rows)-1} Unit Master import records")
    print(f"Created {SOURCE_JSON} with {len(audit_json['cpoe_mapping'])} CPOE audit rows")


if __name__ == "__main__":
    main()
