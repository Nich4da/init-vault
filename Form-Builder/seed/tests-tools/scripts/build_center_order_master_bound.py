#!/usr/bin/env python3
"""Create an importable Center Lab Order form bound to the current item master."""

from __future__ import annotations

import json
from pathlib import Path


SOURCE = Path('/Users/nichada/Documents/init-vault/HIS/sdform_module/EMR_form/lab_center_order.json')
OUTPUT = Path('/Users/nichada/Documents/codex-backup/Center_Lab_Order_Master_Bound.json')
ITEM_MASTER_FORM_ID = '6a7caae774a0be190cc30756'
SPECIMEN_MASTER_FORM_ID = '6a79a797d5218a5b6a26bddc'


def replace_once(text: str, old: str, new: str) -> str:
    if old not in text:
        raise RuntimeError(f'Expected form-script fragment was not found: {old[:80]!r}')
    return text.replace(old, new, 1)


def main() -> None:
    model = json.loads(SOURCE.read_text())
    def transform(value):
        if isinstance(value, dict):
            return {key: transform(child) for key, child in value.items()}
        if isinstance(value, list):
            return [transform(child) for child in value]
        return value

    model = transform(model)

    def replace_in_scripts(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key == 'onCreated' and isinstance(child, str) and 's.loadLabCatalog' in child:
                    value[key] = update_order_sheet_script(child)
                elif key == 'onCreated' and isinstance(child, str) and "s.orderType = 'xray'" in child:
                    value[key] = update_xray_order_sheet_script(child)
                else:
                    replace_in_scripts(child)
        elif isinstance(value, list):
            for child in value:
                replace_in_scripts(child)

    def update_order_sheet_script(script: str) -> str:
        script = script.replace('6a7c7c2974a0be190cc303e0', ITEM_MASTER_FORM_ID)
        script = script.replace("(row.item_group || '').trim()", "String(row.item_group || '').trim()")
        script = replace_once(
            script,
            """      rows.forEach((row) => {
        const secRef = row.section_id""",
            """      rows.forEach((row) => {
        // Each order sheet reads one catalog from the shared master.
        const expectedOrderType = s.orderType === 'xray' ? 'XRAY' : 'LAB'
        const actualOrderType = String(row.order_type || '').trim().toUpperCase()
        if (actualOrderType !== expectedOrderType) return
        const secRef = row.section_id""",
        )
        script = replace_once(
            script,
            """        const secRef = row.section_id
        const resolved = resolveSectionInfo(secRef)
        const sectionCode = resolved.code
        const sectionName = resolved.name
        if (!sectionsByCode[sectionCode]) sectionsByCode[sectionCode] = { code: sectionCode, name: sectionName }
        const groupName = String(row.item_group || '').trim() || 'อื่นๆ'
        const listKey = sectionCode + '|' + groupName
        if (!groupsByListKey[listKey]) groupsByListKey[listKey] = { id: 'lab-' + sectionCode + '-' + groupName, name: groupName, sectionCode, items: [] }""",
            """        const secRef = row.section_id
        const resolved = resolveSectionInfo(secRef)
        // HM and HH remain distinct routing codes, but share one visual tab.
        const sourceSectionCode = String(row.section_code || (typeof secRef === 'string' ? secRef : '') || resolved.code || '').trim()
        const xrayNames = { CTS: 'Computed Tomogram', INT: 'Intervention', MRI: 'Magnetic Resonance Imaging', URO: 'Urethrography', DRT: 'Dental', NU: 'Nuclear Medicine', RAD: 'Radiology', CTM: 'Contemporary Thai Medicine', SPC: 'Special X-RAY', US: 'Ultrasound', CT: 'CT scan', CTA: 'Computed Tomography Angiography', DX: 'General X-ray' }
        // A code not found in the Lab Room master must not inherit that
        // resolver's "ไม่ระบุหมวด" label. X-ray codes are valid master codes too.
        const resolvedName = resolved.code === 'UNSPECIFIED' ? '' : resolved.name
        const sourceSectionName = String(row.section_name || xrayNames[sourceSectionCode] || resolvedName || sourceSectionCode || 'ไม่ระบุหมวด').trim()
        const tabCode = (sourceSectionCode === 'HM' || sourceSectionCode === 'HH') ? 'HEM' : sourceSectionCode
        const tabName = tabCode === 'HEM' ? 'Hematology' : sourceSectionName
        if (!sectionsByCode[tabCode]) sectionsByCode[tabCode] = { code: tabCode, name: tabName }
        const groupName = String(row.item_group || '').trim() || 'อื่นๆ'
        const listKey = tabCode + '|' + sourceSectionCode + '|' + groupName
        if (!groupsByListKey[listKey]) groupsByListKey[listKey] = { id: 'lab-' + tabCode + '-' + sourceSectionCode + '-' + groupName, name: groupName, sectionCode: sourceSectionCode, sectionName: sourceSectionName, tabCode, items: [] }""",
        )
        script = replace_once(script, "          section_name: sectionName,", "          section_name: sourceSectionName,")
        script = replace_once(
            script,
            "id: 'lab-' + sectionCode + '-' + (row._id || row.item_code),",
            "id: 'lab-' + sourceSectionCode + '-' + (row._id || row.item_code),",
        )
        script = replace_once(
            script,
            """        if (!groupsByKey[g.sectionCode]) groupsByKey[g.sectionCode] = []
        groupsByKey[g.sectionCode].push(g)""",
            """        if (!groupsByKey[g.tabCode]) groupsByKey[g.tabCode] = []
        groupsByKey[g.tabCode].push(g)""",
        )
        script = replace_once(script, "s.sections.lab = sections", "s.sections[s.orderType] = sections")
        script = replace_once(script, "s.sections.lab = []", "s.sections[s.orderType] = []")
        script = replace_once(
            script,
            "s.specimenRecords = []\ns.selectedList = () =>",
            "s.specimenRecords = []\ns.specimenMasterByCode = {}\ns.selectedList = () =>",
        )
        script = replace_once(
            script,
        """      const spec = row.c_specimen\n      if (!spec || !spec.specimen_code) return\n      if (!specimenByCode[spec.specimen_code]) { specimenByCode[spec.specimen_code] = { specimen_code: spec.specimen_code, label: spec.label }; specimenOrder.push(spec.specimen_code) }""",
        """      const rawSpecimen = row.c_specimen\n      let specimenCode = ''\n      let specimenLabel = ''\n      if (rawSpecimen && typeof rawSpecimen === 'object') {\n        specimenCode = String(rawSpecimen.specimen_code || rawSpecimen.code || rawSpecimen.value || '').trim()\n        specimenLabel = String(rawSpecimen.specimen_name || rawSpecimen.label || '').trim()\n      } else if (rawSpecimen != null) {\n        const rawText = String(rawSpecimen).trim()\n        try {\n          const parsed = JSON.parse(rawText)\n          if (parsed && typeof parsed === 'object') {\n            specimenCode = String(parsed.specimen_code || parsed.code || parsed.value || '').trim()\n            specimenLabel = String(parsed.specimen_name || parsed.label || '').trim()\n          }\n        } catch (e) { specimenCode = rawText }\n        if (!specimenCode) specimenCode = rawText\n      }\n      if (!specimenCode) return\n      const specimenMaster = s.specimenMasterByCode[specimenCode]\n      if (!specimenByCode[specimenCode]) {\n        specimenByCode[specimenCode] = { specimen_code: specimenCode, label: (specimenMaster && specimenMaster.specimen_name) || specimenLabel || specimenCode }\n        specimenOrder.push(specimenCode)\n      }""",
        )
        script = replace_once(
            script,
        "s.loadLabCatalog = () => {\n  const makeSectionResolver",
        f"""s.loadLabCatalog = () => {{\n  // Read the specimen master at runtime too. Changes to specimen labels are\n  // therefore visible in a newly opened CPOE Order without editing this form.\n  field.getFormRef().userState.crudGetAll({{\n    sdProvider: {{ providerId: '{SPECIMEN_MASTER_FORM_ID}', providerType: 'FORM', options: {{ limit: 1000 }} }},\n    totalEnable: true\n  }}, (specimenRes) => {{\n    const records = (specimenRes && specimenRes.data) || []\n    const index = {{}}\n    records.forEach((record) => {{\n      const code = String(record.specimen_code || '').trim()\n      if (code && record.is_active !== false && String(record.is_active) !== '0') index[code] = record\n    }})\n    s.specimenMasterByCode = index\n  }}).catch((err) => console.error('[lab_order_sheet_ui] specimen crudGetAll failed:', err))\n  const makeSectionResolver""",
        )
        return script

    def update_xray_order_sheet_script(script: str) -> str:
        """Bind the existing Xray widget to the live shared CPOE master."""
        script = script.replace(
            "groups = s.realGroupsByKey[realKey] || s.mockGroupsFor(s.orderType, sectionCode)",
            "groups = s.realGroupsByKey[realKey] || []",
        )
        loader = "\n".join([
            "s.loadXrayCatalog = () => {",
            "  field.getFormRef().userState.crudGetAll({",
            "    sdProvider: { providerId: '6a7caae774a0be190cc30756', providerType: 'FORM', options: { limit: 5000 } },",
            "    totalEnable: true",
            "  }, (res) => {",
            "    const rows = (res && res.data) || []",
            "    const sectionsByCode = {}",
            "    const groupsByKey = {}",
            "    rows.forEach((row) => {",
            "      if (String(row.order_type || '').trim().toUpperCase() !== 'XRAY') return",
            "      const rawSection = row.section_id",
            "      const sectionCode = String(row.section_code || (rawSection && typeof rawSection === 'object' ? (rawSection.section_code || rawSection.code || rawSection.value) : rawSection) || '').trim()",
            "      if (!sectionCode) return",
            "      const xrayNames = { CTS: 'Computed Tomogram', INT: 'Intervention', MRI: 'Magnetic Resonance Imaging', URO: 'Urethrography', DRT: 'Dental', NU: 'Nuclear Medicine', RAD: 'Radiology', CTM: 'Contemporary Thai Medicine', SPC: 'Special X-RAY', US: 'Ultrasound', CT: 'CT scan', CTA: 'Computed Tomography Angiography', DX: 'General X-ray' }",
            "      const referenceName = rawSection && typeof rawSection === 'object' ? (rawSection.section_name || rawSection.label || rawSection.name) : ''",
            "      const sectionName = String(row.section_name || referenceName || xrayNames[sectionCode] || sectionCode).trim()",
            "      if (!sectionsByCode[sectionCode]) sectionsByCode[sectionCode] = { code: sectionCode, name: sectionName }",
            "      const groupName = String(row.item_group || '').trim() || 'อื่นๆ'",
            "      const key = 'xray|' + sectionCode",
            "      if (!groupsByKey[key]) groupsByKey[key] = []",
            "      let group = groupsByKey[key].find((entry) => entry.name === groupName)",
            "      if (!group) {",
            "        group = { id: 'xray-' + sectionCode + '-' + groupName, name: groupName, sectionCode, sectionName, items: [] }",
            "        groupsByKey[key].push(group)",
            "      }",
            "      group.items.push({",
            "        id: 'xray-' + sectionCode + '-' + (row._id || row.item_code),",
            "        master_id: row._id, code: row.item_code, item_code: row.item_code,",
            "        name: row.item_name, master_item_name: row.item_name,",
            "        section_id: sectionCode, section_name: sectionName, room_code: row.room_code || null,",
            "        sale_price: Number(row.sale_price) || 0, withdraw_price: Number(row.withdraw_price) || 0,",
            "        price: Number(row.sale_price) || 0, data_source: 'master'",
            "      })",
            "    })",
            "    const sections = Object.values(sectionsByCode).sort((a, b) => a.name.localeCompare(b.name, 'th'))",
            "    s.sections.xray = sections",
            "    s.realGroupsByKey = groupsByKey",
            "    if (!sections.some((section) => section.code === s.activeSection)) s.activeSection = sections.length ? sections[0].code : null",
            "    s.buildGroups()",
            "  }).catch((err) => {",
            "    console.error('[xray_order_sheet_ui] master crudGetAll failed:', err)",
            "    s.sections.xray = []",
            "    s.realGroupsByKey = {}",
            "    s.buildGroups()",
            "  })",
            "}",
            "s.loadXrayCatalog()",
            "",
        ])
        return replace_once(script, "s.buildGroups()\n", loader)

    replace_in_scripts(model)
    OUTPUT.write_text(json.dumps(model, ensure_ascii=False, indent=2) + '\n')
    print(f'Created {OUTPUT}')


if __name__ == '__main__':
    main()
