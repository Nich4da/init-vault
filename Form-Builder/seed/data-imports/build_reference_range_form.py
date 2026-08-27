#!/usr/bin/env python3
"""Build the reference-range SDForm strictly from exported widget objects.

The script deliberately leaves Select Input optionItems unchanged. The user will
configure those lists in Builder, as documented in the adjacent setup guide.
First/Second Value use exported Number Input objects until a Dynamic Input export
is available.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CPOE_EXPORT = Path("/Users/nichada/Documents/refrange-.json")
PERSON_EXPORT = ROOT / "person.json"
DISEASE_EXPORT = ROOT / "disease.json"
RESULT_ITEM_EXPORT = Path("/Users/nichada/Documents/lab-result-item.json")
OUTPUT = ROOT / "Lab_Reference_Range_Config_OneForm_Tabs_v1.json"

ALLOWED_OPTION_CHANGES = {
    "name",
    "label",
    "defaultValue",
    "columnSpan",
    "readonly",
    "required",
    "hidden",
    "placeholder",
}


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def walk(node):
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from walk(value)
    elif isinstance(node, list):
        for value in node:
            yield from walk(value)


def find_widget(document: dict, *, component: str, option_name: str | None = None) -> dict:
    for node in walk(document):
        options = node.get("options")
        if node.get("component") != component or not isinstance(options, dict):
            continue
        if option_name is None or options.get("name") == option_name:
            return node
    raise KeyError(f"widget not found: component={component!r}, option_name={option_name!r}")


def clone_widget(template: dict, *, widget_id: str, **changes) -> dict:
    unexpected = set(changes) - ALLOWED_OPTION_CHANGES
    if unexpected:
        raise ValueError(f"disallowed option changes: {sorted(unexpected)}")

    widget = copy.deepcopy(template)
    widget["id"] = widget_id
    options = widget["options"]
    for key, value in changes.items():
        if key in options:
            options[key] = value
    return widget


def clone_container(template: dict, *, container_id: str, name: str, label: str | None = None) -> dict:
    container = copy.deepcopy(template)
    container["id"] = container_id
    if "name" in container.get("options", {}):
        container["options"]["name"] = name
    if label is not None and "label" in container.get("options", {}):
        container["options"]["label"] = label
    return container


def make_two_column_grid(grid_template: dict, *, grid_id: str, name: str, left: list, right: list) -> dict:
    grid = clone_container(grid_template, container_id=grid_id, name=name)
    if len(grid.get("cols", [])) < 2:
        raise ValueError("grid template must have at least two columns")
    grid["cols"] = copy.deepcopy(grid["cols"][:2])
    for index, fields in enumerate((left, right), start=1):
        col = grid["cols"][index - 1]
        col["id"] = f"grid-col-reference-{grid_id}-{index}"
        if "name" in col.get("options", {}):
            col["options"]["name"] = f"{name}_col_{index}"
        col["fields"] = fields
    return grid


def main() -> None:
    cpoe = load(CPOE_EXPORT)
    person = load(PERSON_EXPORT)
    disease = load(DISEASE_EXPORT)
    result_item = load(RESULT_ITEM_EXPORT)

    tab_template = find_widget(cpoe, component="tab", option_name="tab_item")
    tab_pane_details_template = find_widget(cpoe, component="tab-pane", option_name="tab1")
    tab_pane_prices_template = find_widget(cpoe, component="tab-pane", option_name="tab_pane_76865")
    tab_pane_codes_template = find_widget(cpoe, component="tab-pane", option_name="tab_pane_33503")
    grid_template = find_widget(cpoe, component="grid", option_name="service_box")
    sub_form_template = find_widget(cpoe, component="sub-form", option_name="price_data")

    service_type_template = find_widget(cpoe, component="select-form-input", option_name="service_type")
    section_template = find_widget(cpoe, component="select-form-input", option_name="section")
    lab_item_template = find_widget(cpoe, component="select-form-input", option_name="lab_item")

    text_template = find_widget(person, component="text-input")
    number_template = find_widget(person, component="number-input")
    date_template = find_widget(person, component="date-input")
    switch_template = find_widget(person, component="switch-input")
    select_template = find_widget(person, component="select-input")
    textarea_template = find_widget(disease, component="textarea-input")
    unit_template = find_widget(result_item, component="select-form-input", option_name="unit_id")

    service_type = clone_widget(
        service_type_template,
        widget_id="select-form-input-reference-service-type",
        name="service_type",
        label="ประเภทบริการ",
        required=True,
        columnSpan=12,
    )
    section = clone_widget(
        section_template,
        widget_id="select-form-input-reference-section",
        name="section",
        label="Section",
        required=True,
        columnSpan=12,
    )
    lab_item = clone_widget(
        lab_item_template,
        widget_id="select-form-input-reference-lab-item",
        name="lab_item",
        label="Result Test / Lab Test",
        required=True,
        columnSpan=12,
    )

    details_grid_1 = make_two_column_grid(
        grid_template,
        grid_id="grid-reference-details-1",
        name="reference_details_grid_1",
        left=[
            service_type,
            clone_widget(
                text_template,
                widget_id="text-input-reference-test-code",
                name="source_test_code",
                label="Test Code",
                required=True,
                placeholder="รหัส Test จากต้นฉบับ",
                columnSpan=12,
            ),
        ],
        right=[
            section,
            clone_widget(
                text_template,
                widget_id="text-input-reference-test-reference",
                name="source_test_reference",
                label="Test Reference / Name",
                required=True,
                placeholder="ชื่อหรือรหัสอ้างอิง Test",
                columnSpan=12,
            ),
        ],
    )

    details_grid_2 = make_two_column_grid(
        grid_template,
        grid_id="grid-reference-details-2",
        name="reference_details_grid_2",
        left=[
            lab_item,
            clone_widget(
                text_template,
                widget_id="text-input-reference-method",
                name="method",
                label="Method",
                required=False,
                placeholder="เว้นว่างได้สำหรับข้อมูล Biochemistry ปัจจุบัน",
                columnSpan=12,
            ),
        ],
        right=[
            clone_widget(
                text_template,
                widget_id="text-input-reference-source-document",
                name="source_document_name",
                label="Source Document",
                required=False,
                defaultValue="Reference range Chem 13 July 26.numbers",
                columnSpan=12,
            ),
            clone_widget(
                text_template,
                widget_id="text-input-reference-source-sheet",
                name="source_sheet",
                label="Source Sheet",
                required=False,
                defaultValue="Sheet1 / Table 1",
                columnSpan=12,
            ),
        ],
    )

    details_grid_3 = make_two_column_grid(
        grid_template,
        grid_id="grid-reference-details-3",
        name="reference_details_grid_3",
        left=[
            clone_widget(
                number_template,
                widget_id="number-input-reference-revision",
                name="revision_no",
                label="Revision",
                required=True,
                defaultValue=1,
                columnSpan=12,
            ),
            clone_widget(
                date_template,
                widget_id="date-input-reference-effective-from",
                name="effective_from",
                label="วันที่เริ่มใช้งาน",
                required=False,
                columnSpan=12,
            ),
        ],
        right=[
            clone_widget(
                date_template,
                widget_id="date-input-reference-effective-to",
                name="effective_to",
                label="วันที่สิ้นสุด",
                required=False,
                columnSpan=12,
            ),
            clone_widget(
                switch_template,
                widget_id="switch-input-reference-active",
                name="is_active",
                label="เปิดใช้งาน",
                defaultValue=True,
                columnSpan=12,
            ),
        ],
    )

    details_pane = clone_container(
        tab_pane_details_template,
        container_id="tab-pane-reference-details",
        name="reference_details",
        label="รายละเอียดรายการตรวจ",
    )
    details_pane["fields"] = [details_grid_1, details_grid_2, details_grid_3]

    def select_placeholder(name: str, label: str, widget_id: str) -> dict:
        return clone_widget(
            select_template,
            widget_id=widget_id,
            name=name,
            label="[ตั้งค่า Select] " + label,
            required=True,
            defaultValue=None,
            placeholder="ตั้งค่า Option Items ใน Builder ตามคู่มือ",
            columnSpan=6,
        )

    range_sub_form = clone_container(
        sub_form_template,
        container_id="sub-form-reference-ranges",
        name="reference_ranges",
        label="Reference Range Rules",
    )
    range_sub_form["fields"] = [
        clone_widget(
            number_template,
            widget_id="number-input-range-priority",
            name="priority",
            label="Priority",
            required=True,
            defaultValue=1,
            columnSpan=4,
        ),
        select_placeholder("physiological_type", "Physiological Type", "select-input-range-physiological-type"),
        clone_widget(
            number_template,
            widget_id="number-input-range-initial-age",
            name="initial_age",
            label="Initial Age",
            required=False,
            columnSpan=4,
        ),
        select_placeholder("initial_age_unit", "Initial Age Unit", "select-input-range-initial-age-unit"),
        clone_widget(
            number_template,
            widget_id="number-input-range-final-age",
            name="final_age",
            label="Final Age",
            required=False,
            columnSpan=4,
        ),
        select_placeholder("final_age_unit", "Final Age Unit", "select-input-range-final-age-unit"),
        clone_widget(
            unit_template,
            widget_id="select-form-input-range-unit",
            name="range_unit_id",
            label="Range Unit",
            required=False,
            columnSpan=6,
        ),
        select_placeholder("numeric_range_operator", "Numeric Range Operator", "select-input-range-operator"),
        select_placeholder("range_type", "Range Type", "select-input-range-type"),
        clone_widget(
            number_template,
            widget_id="number-input-range-first-value",
            name="first_value",
            label="[แทนด้วย Dynamic Input] First Value",
            required=True,
            placeholder="ลาก Dynamic Input มาแทนช่องนี้",
            columnSpan=6,
        ),
        clone_widget(
            number_template,
            widget_id="number-input-range-second-value",
            name="second_value",
            label="[แทนด้วย Dynamic Input] Second Value",
            required=False,
            placeholder="ลาก Dynamic Input มาแทนช่องนี้",
            columnSpan=6,
        ),
        clone_widget(
            text_template,
            widget_id="text-input-range-min-status",
            name="min_result_status_id",
            label="Min Result Status ID",
            required=False,
            columnSpan=6,
        ),
        clone_widget(
            text_template,
            widget_id="text-input-range-max-status",
            name="max_result_status_id",
            label="Max Result Status ID",
            required=False,
            columnSpan=6,
        ),
    ]

    ranges_pane = clone_container(
        tab_pane_prices_template,
        container_id="tab-pane-reference-ranges",
        name="reference_ranges_tab",
        label="Reference Range",
    )
    ranges_pane["fields"] = [range_sub_form]

    history_grid = make_two_column_grid(
        grid_template,
        grid_id="grid-reference-history",
        name="reference_history_grid",
        left=[
            clone_widget(
                textarea_template,
                widget_id="textarea-input-reference-change-reason",
                name="change_reason",
                label="เหตุผลการแก้ไข",
                required=False,
                placeholder="ระบุเมื่อแก้ไขค่าที่เคยใช้งาน",
                columnSpan=12,
            )
        ],
        right=[
            clone_widget(
                textarea_template,
                widget_id="textarea-input-reference-notes",
                name="notes",
                label="หมายเหตุ",
                required=False,
                columnSpan=12,
            )
        ],
    )
    history_pane = clone_container(
        tab_pane_codes_template,
        container_id="tab-pane-reference-history",
        name="reference_history",
        label="ประวัติและหมายเหตุ",
    )
    history_pane["fields"] = [history_grid]

    root_tab = clone_container(
        tab_template,
        container_id="tab-reference-range-config",
        name="reference_range_config_tabs",
    )
    root_tab["tabs"] = [details_pane, ranges_pane, history_pane]

    output = {
        "fields": [root_tab],
        "formConfig": copy.deepcopy(cpoe["formConfig"]),
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    main()
