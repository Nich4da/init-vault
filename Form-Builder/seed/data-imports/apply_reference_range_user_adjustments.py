#!/usr/bin/env python3
"""Apply the Builder-exported adjustments supplied by the user on 2026-08-26.

The source form remains untouched. This script copies its complete exported
widget objects, applies only the changes visible in the user's exported JSON,
and writes a new version for static validation and audit.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Lab_Reference_Range_Config_OneForm_Tabs_v1.json"
OUTPUT = ROOT / "Lab_Reference_Range_Config_OneForm_Tabs_v2_UserAdjusted.json"


def walk(node):
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from walk(value)
    elif isinstance(node, list):
        for value in node:
            yield from walk(value)


def by_option_name(document: dict, name: str) -> dict:
    matches = [
        node
        for node in walk(document)
        if isinstance(node.get("options"), dict)
        and node["options"].get("name") == name
    ]
    if len(matches) != 1:
        raise ValueError(f"expected one widget named {name!r}, found {len(matches)}")
    return matches[0]


def copy_text_widget(template: dict, *, name: str, label: str, placeholder: str,
                     required: bool, widget_id: str) -> dict:
    widget = copy.deepcopy(template)
    widget["id"] = widget_id
    options = widget["options"]
    options["name"] = name
    options["label"] = label
    options["defaultValue"] = None
    options["placeholder"] = placeholder
    options["columnSpan"] = 6
    options["readonly"] = False
    options["required"] = required
    options["hidden"] = False
    return widget


def main() -> None:
    document = json.loads(SOURCE.read_text(encoding="utf-8"))

    # Details tab layout from the user's Builder export: source-document fields
    # removed, effective dates moved beside Lab Test, revision/active retained.
    details = by_option_name(document, "reference_details")
    grids = {grid["options"]["name"]: grid for grid in details["fields"]}
    grid2 = grids["reference_details_grid_2"]
    grid3 = grids["reference_details_grid_3"]

    effective_from = by_option_name(document, "effective_from")
    effective_to = by_option_name(document, "effective_to")
    revision_no = by_option_name(document, "revision_no")
    is_active = by_option_name(document, "is_active")

    grid2["cols"][1]["fields"] = [effective_from, effective_to]
    grid3["cols"][0]["fields"] = [revision_no]
    grid3["cols"][1]["fields"] = [is_active]

    # Static Select option lists exactly as supplied in the user's export.
    by_option_name(document, "physiological_type")["options"]["optionItems"] = [
        {"label": "All", "value": "all_sex"},
        {"label": "F", "value": "female"},
        {"label": "M", "value": "male"},
    ]
    by_option_name(document, "numeric_range_operator")["options"]["optionItems"] = [
        {"label": "Inclusive limits", "value": "Inclusive"},
        {"value": "Exclusive", "label": "Exclusive limits"},
        {"label": "<", "value": "lessthan"},
        {"value": "lessthan-equal", "label": "<="},
        {"value": "greaterthan", "label": ">"},
        {"label": ">=", "value": "greaterthan-equal"},
    ]
    by_option_name(document, "initial_age_unit")["options"]["optionItems"] = [
        {"label": "DAYS", "value": "start_day"},
        {"label": "MONTHS", "value": "start_months"},
        {"label": "YEARS", "value": "start_year"},
    ]
    by_option_name(document, "final_age_unit")["options"]["optionItems"] = [
        {"label": "DAYS", "value": "final_day"},
        {"label": "MONTHS", "value": "final_months"},
        {"label": "YEARS", "value": "final_year"},
    ]
    by_option_name(document, "range_type")["options"]["optionItems"] = [
        {"label": "NormalNumeric", "value": "normal"},
        {"label": "CriticalNumeric", "value": "critical"},
    ]

    # Replace the two Number Input placeholders with complete Text Input objects
    # copied from the same exported form, matching the user's Builder changes.
    text_template = by_option_name(document, "source_test_code")
    first_value = copy_text_widget(
        text_template,
        name="first_value",
        label="First Value",
        placeholder="ค่าเริ่มต้น",
        required=True,
        widget_id="text-input-reference-first-value",
    )
    second_value = copy_text_widget(
        text_template,
        name="second_value",
        label="Second Value",
        placeholder="ค่าที่ 2",
        required=False,
        widget_id="text-input-reference-second-value",
    )

    sub_form = by_option_name(document, "reference_ranges")
    current = {field["options"]["name"]: field for field in sub_form["fields"]}
    current["first_value"] = first_value
    current["second_value"] = second_value
    order = [
        "priority",
        "physiological_type",
        "range_unit_id",
        "numeric_range_operator",
        "initial_age",
        "initial_age_unit",
        "final_age",
        "final_age_unit",
        "range_type",
        "first_value",
        "second_value",
        "min_result_status_id",
        "max_result_status_id",
    ]
    sub_form["fields"] = [current[name] for name in order]

    OUTPUT.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(OUTPUT)


if __name__ == "__main__":
    main()
