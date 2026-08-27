#!/usr/bin/env python3
"""Prepare the next safe LAB master-data steps after Unit Master import.

Outputs:
1. Remaining Unit Master records, with the importable four-field sheet first.
2. A Result Definition review workbook.  It is intentionally not a production
   import because local decimal precision, reference ranges, text choices, and
   the final unit ObjectIds are not yet confirmed.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path
import json
import re
import unicodedata

from build_cpoe_tmlt_unit_import import Sheet, write_xlsx


WORKSPACE = Path("/Users/nichada/Documents/codex-backup")
ANALYSIS_JSON = WORKSPACE / "CPOE_TMLT_Unit_Analysis_2026-08-17.json"
UNIT_EXPORT = Path(
    "/Users/nichada/.mongodb/mongodb-mcp/exports/6a82ac934a790c81ec98607e/"
    "6a82ba574a790c81ec986085.json"
)
LAB_TEST_EXPORT = Path(
    "/Users/nichada/.mongodb/mongodb-mcp/exports/6a82ac934a790c81ec98607e/"
    "6a82ba574a790c81ec986086.json"
)
UNIT_OUTPUT = WORKSPACE / "Lab_Unit_Master_Remaining_51_Import_2026-08-17.xlsx"
RESULT_OUTPUT = WORKSPACE / "Lab_Result_Definition_Next_Step_Review_2026-08-17.xlsx"
RESULT_JSON = WORKSPACE / "Lab_Result_Definition_Next_Step_Review_2026-08-17.json"
TMLT_VERSION = "20260803"


def clean(value) -> str:
    return "" if value is None else str(value).strip()


def oid(row: dict) -> str:
    value = row.get("_id", "")
    if isinstance(value, dict):
        return clean(value.get("$oid"))
    return clean(value)


def raw(value) -> str:
    return clean(value).casefold()


def norm(value) -> str:
    value = unicodedata.normalize("NFKC", raw(value))
    return re.sub(r"[^0-9a-zก-๙]+", "", value)


def load_tmlt() -> list[dict]:
    rows = []
    for page in range(1, 28):
        rows.extend(json.loads(Path(f"/private/tmp/tmlt_{page}.json").read_text(encoding="utf-8"))["data"])
    assert len(rows) == 5287
    return rows


def result_type_for_scale(scale: str) -> str:
    return {
        "Quantitative": "number",
        "Quantitative or Ordinal": "number_or_text",
        "Semi-Quantitative": "number_or_text",
        "Ordinal": "text",
        "Nominal": "text",
        "Narrative": "text",
        "Document": "text",
        "N/A": "text",
    }.get(scale, "")


def build_remaining_unit_workbook(analysis: dict, current_units: list[dict]) -> None:
    current_by_code = {clean(row.get("unit_code")): row for row in current_units}
    all_units = analysis["unit_master_import"]
    remaining = [row for row in all_units if row["unit_code"] not in current_by_code]
    assert len(all_units) == 60
    assert len(current_by_code) == 9
    assert len(remaining) == 51

    import_rows = [["unit_code", "unit_symbol", "unit_name_en", "unit_name_th"]]
    import_rows.extend([
        [row["unit_code"], row["unit_symbol"], row["unit_name_en"], row["unit_name_th"]]
        for row in remaining
    ])

    current_audit = [[
        "_id", "unit_code", "current_symbol", "expected_symbol", "status", "action"
    ]]
    expected_by_code = {row["unit_code"]: row for row in all_units}
    for code, row in sorted(current_by_code.items()):
        expected = expected_by_code.get(code, {}).get("unit_symbol", "")
        current = clean(row.get("unit_symbol"))
        status = "OK" if current == expected else "FIX_REQUIRED"
        action = "" if status == "OK" else "แก้ record เดิมด้วยมือ ห้าม import ซ้ำ"
        current_audit.append([oid(row), code, current, expected, status, action])

    summary = [
        ["Unit Master next step", "ตรวจฐานข้อมูลแบบ read-only วันที่ 2026-08-17"],
        ["Unit vocabulary ที่เตรียมไว้", 60],
        ["มีอยู่ใน zdata_lab_unit_master", len(current_by_code)],
        ["เหลือสำหรับ import", len(remaining)],
        ["วิธีใช้", "Import ชีตแรก Unit_Master_Remaining_Import"],
        ["ข้อผิดพลาดปัจจุบัน", "IU_L มี unit_symbol = IU_L; ควรแก้เป็น IU/L ใน record เดิม"],
        ["ห้ามทำ", "อย่า import IU_L ซ้ำ เพราะจะเกิด unit_code ซ้ำ"],
    ]

    sheets = [
        Sheet("Unit_Master_Remaining_Import", import_rows, [24, 22, 48, 48]),
        Sheet("Current_Master_Audit", current_audit, [26, 24, 24, 24, 20, 50]),
        Sheet("Summary", summary, [34, 100], False),
    ]
    write_xlsx(UNIT_OUTPUT, sheets)


def choose_lab_test(cpoe: dict, by_raw_code, by_norm_code, by_name):
    candidates = list(by_raw_code.get(raw(cpoe.get("item_code")), []))
    method = "exact_code"
    if not candidates:
        candidates = list(by_norm_code.get(norm(cpoe.get("item_code")), []))
        method = "normalized_code"
    if not candidates:
        candidates = list(by_name.get(norm(cpoe.get("item_name")), []))
        method = "exact_name" if candidates else "unmatched"
    same_section = [
        row for row in candidates
        if raw(row.get("seccode")) == raw(cpoe.get("section_id")) and clean(cpoe.get("section_id"))
    ]
    if len(same_section) == 1:
        return same_section[0], "HIGH" if method == "exact_code" else "MEDIUM", method, len(candidates)
    if len(candidates) == 1:
        row = candidates[0]
        status = "REVIEW" if raw(row.get("seccode")) not in {"", raw(cpoe.get("section_id"))} else "HIGH"
        return row, status, method, 1
    return None, "AMBIGUOUS" if candidates else "UNMATCHED", method, len(candidates)


def choose_panel_member(panel: dict, member_code: str, cpoe_by_tmlt: dict[str, list[dict]], tmlt_by_code: dict[str, dict]):
    candidates = list(cpoe_by_tmlt.get(member_code, []))
    candidates = [row for row in candidates if clean(row.get("section_id")) == clean(panel.get("section_id"))] or candidates
    member_name = clean(tmlt_by_code.get(member_code, {}).get("longCommonName"))

    panel_name = clean(panel.get("item_name")).casefold()
    if "clotted" in panel_name:
        narrowed = [row for row in candidates if "clotted" in clean(row.get("item_name")).casefold()]
        if narrowed:
            candidates = narrowed
    elif "ionized" in panel_name:
        narrowed = [row for row in candidates if "ionized" in clean(row.get("item_name")).casefold()]
        if narrowed:
            candidates = narrowed

    non_research = [row for row in candidates if "research" not in clean(row.get("item_name")).casefold()]
    if non_research:
        candidates = non_research
    if len(candidates) == 1:
        return candidates[0], "HIGH", member_name, 1
    if len(candidates) > 1:
        # Keep the semantic choice visible as REVIEW.  The shortest local label
        # usually avoids a parent panel such as "Total+Direct", but is not proof.
        chosen = min(candidates, key=lambda row: len(clean(row.get("item_name"))))
        return chosen, "REVIEW", member_name, len(candidates)
    return None, "UNMATCHED", member_name, 0


def build_result_review(analysis: dict, current_units: list[dict], lab_tests: list[dict], tmlt: list[dict]) -> None:
    cpoe_rows = analysis["cpoe_mapping"]
    tmlt_by_code = {clean(row.get("tmltCode")): row for row in tmlt}
    current_unit_by_code = {clean(row.get("unit_code")): row for row in current_units}
    by_raw_code = defaultdict(list)
    by_norm_code = defaultdict(list)
    by_name = defaultdict(list)
    for row in lab_tests:
        by_raw_code[raw(row.get("code"))].append(row)
        by_norm_code[norm(row.get("code"))].append(row)
        by_name[norm(row.get("name"))].append(row)

    cpoe_by_tmlt = defaultdict(list)
    for row in cpoe_rows:
        code = clean(row.get("tmlt_code"))
        if code not in {"", "-"}:
            cpoe_by_tmlt[code].append(row)

    review_headers = [
        "cpoe_item_id", "cpoe_item_code", "cpoe_item_name", "section_id", "c_specimen",
        "tmlt_code", "tmlt_lab_type", "tmlt_scale", "suggested_result_type",
        "tmlt_unit_values", "candidate_unit_codes", "current_default_unit_id",
        "lab_test_id", "lab_test_code", "lab_test_name", "lis_test_code", "lab_test_section",
        "lab_test_match", "candidate_count", "definition_status", "is_active_draft",
        "decimal_places", "reference_range_text", "allowed_text_options", "review_note",
    ]
    review_rows = []
    bc_rows = []
    match_counts = Counter()
    definition_counts = Counter()
    panel_rows = []
    unresolved_panels = []

    for cpoe in cpoe_rows:
        tmlt_code = clean(cpoe.get("tmlt_code"))
        source = tmlt_by_code.get(tmlt_code)
        test, match_status, match_method, candidate_count = choose_lab_test(cpoe, by_raw_code, by_norm_code, by_name)
        match_counts[match_status] += 1
        lab_type = "ITEM" if source and source.get("labType") == 1 else ("PANEL" if source else "")
        scale = clean((source or {}).get("scale"))
        suggested_type = result_type_for_scale(scale) if lab_type == "ITEM" else ""
        unit_values = list((source or {}).get("unit") or [])
        unit_codes = clean(cpoe.get("candidate_unit_codes"))
        candidate_code_list = [part.strip() for part in unit_codes.split("|") if part.strip()]
        default_unit_id = ""
        if len(candidate_code_list) == 1 and candidate_code_list[0] in current_unit_by_code:
            default_unit_id = oid(current_unit_by_code[candidate_code_list[0]])

        if not source:
            status = "NO_TMLT_REVIEW"
            note = "ไม่มี TMLT; ยังสรุปรูปแบบผลและหน่วยไม่ได้"
        elif lab_type == "PANEL":
            members = list(source.get("itemCodesInPanel") or [])
            status = "PANEL_EXPAND" if members else "PANEL_MEMBERS_MISSING"
            note = "ต้องสร้างหลาย Result Definition ตามสมาชิก panel" if members else "TMLT ไม่ให้สมาชิก panel; ต้องขอ LIS test list"
        elif match_status not in {"HIGH", "MEDIUM"}:
            status = "LAB_TEST_MATCH_REVIEW"
            note = "Lab Test Master section/candidate ต้องตรวจ"
        elif clean(cpoe.get("mapping_status")) == "MULTI_UNIT_REVIEW":
            status = "MULTI_UNIT_REVIEW"
            note = "TMLT ให้หลายหน่วย; ต้องเลือกจาก LIS/เครื่องตรวจ"
        else:
            status = "DRAFT_REVIEW"
            note = "ต้องยืนยัน decimal places, reference range และ allowed text options ก่อนเปิดใช้"
        definition_counts[status] += 1

        row = [
            clean(cpoe.get("cpoe_item_id")), clean(cpoe.get("item_code")), clean(cpoe.get("item_name")),
            clean(cpoe.get("section_id")), clean(cpoe.get("c_specimen")), tmlt_code,
            lab_type, scale, suggested_type, " | ".join(unit_values), unit_codes, default_unit_id,
            oid(test or {}), clean((test or {}).get("code")), clean((test or {}).get("name")),
            clean((test or {}).get("lis_test_code")), clean((test or {}).get("seccode")),
            f"{match_status}:{match_method}", candidate_count, status, False,
            "", "", "", note,
        ]
        review_rows.append(row)
        if clean(cpoe.get("section_id")) == "BC":
            bc_rows.append(row)

        if lab_type == "PANEL":
            members = list(source.get("itemCodesInPanel") or [])
            if not members:
                unresolved_panels.append([
                    clean(cpoe.get("cpoe_item_id")), clean(cpoe.get("item_code")), clean(cpoe.get("item_name")),
                    clean(cpoe.get("section_id")), tmlt_code, "NO_MEMBERS_IN_TMLT",
                    "ขอรายการ result components/LIS codes จากห้อง Lab",
                ])
            for sequence, member_code in enumerate(members, 1):
                member_cpoe, member_status, member_name, member_candidates = choose_panel_member(
                    cpoe, member_code, cpoe_by_tmlt, tmlt_by_code
                )
                member_test = None
                member_test_status = "UNMATCHED"
                if member_cpoe:
                    member_test, member_test_status, _, _ = choose_lab_test(
                        member_cpoe, by_raw_code, by_norm_code, by_name
                    )
                panel_rows.append([
                    clean(cpoe.get("cpoe_item_id")), clean(cpoe.get("item_code")), clean(cpoe.get("item_name")),
                    clean(cpoe.get("section_id")), tmlt_code, sequence, member_code, member_name,
                    clean((member_cpoe or {}).get("cpoe_item_id")), clean((member_cpoe or {}).get("item_code")),
                    clean((member_cpoe or {}).get("item_name")), member_status, member_candidates,
                    oid(member_test or {}), clean((member_test or {}).get("code")),
                    clean((member_test or {}).get("name")), clean((member_test or {}).get("lis_test_code")),
                    member_test_status,
                    "REVIEW" if member_status != "UNMATCHED" and member_test else "BLOCKED",
                ])
                if member_status == "UNMATCHED" or not member_test:
                    unresolved_panels.append([
                        clean(cpoe.get("cpoe_item_id")), clean(cpoe.get("item_code")), clean(cpoe.get("item_name")),
                        clean(cpoe.get("section_id")), tmlt_code, f"MEMBER_{member_code}_UNMATCHED",
                        "TMLT member ไม่มี local CPOE/Lab Test ที่ยืนยันได้",
                    ])

    panel_headers = [
        "panel_cpoe_id", "panel_item_code", "panel_item_name", "section_id", "panel_tmlt_code",
        "sequence", "member_tmlt_code", "member_tmlt_name", "member_cpoe_id", "member_item_code",
        "member_item_name", "member_choice_status", "member_candidate_count", "result_test_id",
        "result_test_code", "result_test_name", "lis_test_code", "lab_test_match", "readiness",
    ]
    unresolved_headers = [
        "panel_cpoe_id", "panel_item_code", "panel_item_name", "section_id", "panel_tmlt_code",
        "issue", "required_action",
    ]
    summary = [
        ["Lab Result Definition next step", "Draft/review only — ยังไม่ใช่ production import"],
        ["CPOE active items", len(cpoe_rows)],
        ["Lab Test Master records", len(lab_tests)],
        ["Lab Test match", ", ".join(f"{key}={value}" for key, value in sorted(match_counts.items()))],
        ["Definition status", ", ".join(f"{key}={value}" for key, value in sorted(definition_counts.items()))],
        ["Result Definition records ปัจจุบัน", 0],
        ["Unit Master ปัจจุบัน", len(current_units)],
        ["ลำดับที่ต้องทำ", "1) import 51 units 2) แก้ IU_L symbol 3) re-query unit ObjectIds 4) Lab ยืนยัน draft 5) import Result Definition เป็น inactive ก่อน"],
        ["ค่าที่ไม่เดา", "decimal_places, reference_range_text, allowed_text_options, critical limits"],
        ["Panel", "หนึ่ง CPOE panel ต้องมีหลาย Result Definition; TMLT มี member list เพียงบาง panel"],
        ["การทดลอง", "เริ่ม BC pilot ก่อน: single analyte + LFT + Electrolyte แล้วทดสอบ materialize Result Item"],
    ]

    sheets = [
        Sheet("Summary", summary, [34, 115], False),
        Sheet("Definition_Review_All", [review_headers] + review_rows,
              [25, 16, 48, 14, 15, 16, 16, 22, 24, 34, 40, 26, 26, 16, 48, 18, 16, 24, 18, 26, 18, 18, 38, 38, 65]),
        Sheet("BC_Pilot_Review", [review_headers] + bc_rows,
              [25, 16, 48, 14, 15, 16, 16, 22, 24, 34, 40, 26, 26, 16, 48, 18, 16, 24, 18, 26, 18, 18, 38, 38, 65]),
        Sheet("Panel_Member_Candidates", [panel_headers] + panel_rows,
              [25, 16, 48, 14, 18, 12, 18, 60, 25, 18, 48, 24, 22, 25, 18, 48, 18, 20, 18]),
        Sheet("Panel_Unresolved", [unresolved_headers] + unresolved_panels,
              [25, 16, 48, 14, 18, 34, 65]),
    ]
    write_xlsx(RESULT_OUTPUT, sheets)
    RESULT_JSON.write_text(json.dumps({
        "analysis_date": "2026-08-17",
        "tmlt_version": TMLT_VERSION,
        "counts": {
            "cpoe": len(cpoe_rows),
            "lab_tests": len(lab_tests),
            "current_units": len(current_units),
            "lab_test_match": dict(match_counts),
            "definition_status": dict(definition_counts),
            "panel_member_rows": len(panel_rows),
            "panel_unresolved_rows": len(unresolved_panels),
        },
        "definition_review": [dict(zip(review_headers, row)) for row in review_rows],
        "panel_members": [dict(zip(panel_headers, row)) for row in panel_rows],
        "panel_unresolved": [dict(zip(unresolved_headers, row)) for row in unresolved_panels],
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    analysis = json.loads(ANALYSIS_JSON.read_text(encoding="utf-8"))
    current_units = json.loads(UNIT_EXPORT.read_text(encoding="utf-8"))
    lab_tests = json.loads(LAB_TEST_EXPORT.read_text(encoding="utf-8"))
    tmlt = load_tmlt()
    build_remaining_unit_workbook(analysis, current_units)
    build_result_review(analysis, current_units, lab_tests, tmlt)
    print(f"Created {UNIT_OUTPUT}")
    print(f"Created {RESULT_OUTPUT}")
    print(f"Created {RESULT_JSON}")


if __name__ == "__main__":
    main()
