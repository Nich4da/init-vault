#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const formPath = path.join(root, 'Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json')
const form = JSON.parse(fs.readFileSync(formPath, 'utf8'))
const tab = form.fields[0]

assert.strictEqual(tab.component, 'tab')
assert.strictEqual(tab.options.name, 'xray_app')

const pane = name => {
  const value = tab.tabs.find(item => item.options && item.options.name === name)
  assert(value, 'missing pane ' + name)
  return value
}
const walkFields = value => {
  if (!value || typeof value !== 'object') return []
  return [value]
    .concat((value.fields || []).flatMap(walkFields))
    .concat((value.cols || []).flatMap(walkFields))
}
const field = (targetPane, name) => {
  const value = walkFields(targetPane).find(item => item.options && item.options.name === name)
  assert(value, 'missing field ' + name)
  return value
}

const unitPane = pane('xray_tab_unit')
const roomPane = pane('xray_tab_room')
const donePane = pane('xray_tab_done')
const worklistPane = pane('xray_tab_worklist')
const trackingPane = pane('xray_tab_tracking')
const labPane = pane('xray_tab_lab_lookup')
const roomButtons = field(roomPane, 'btn_room')
const checkinButtons = field(roomPane, 'button_ui52909')
const unitList = field(unitPane, 'visit_unit')
const roomList = field(roomPane, 'visit_room')
const doneList = field(donePane, 'visit_done')

for (const list of [unitList, roomList, doneList]) {
  assert.strictEqual(list.component, 'list-ui', list.options.name + ' uses the native EMR List View')
  assert.strictEqual(list.options.formId, '6a461235e521219e514d1c4b', 'all queue panes read central Visit Tran')
  assert.strictEqual(list.options.enableWs, true)
  assert.strictEqual(list.options.wsRefresh, true)
}
/* 2026-10-13: the user and live EMR Builder confirmed that Unit Queue now
   calls only from the row action; the old header call-next button is gone. */
assert.deepStrictEqual(unitPane.fields.map(item => item.component), ['list-ui'])
assert(!walkFields(unitPane).some(item => item.component === 'button-ui'))
assert.strictEqual(roomButtons.component, 'button-ui', 'My Room keeps the native EMR Buttons widget')
const roomCallNextScript = roomButtons.options.buttons.find(item => item.label === 'เรียกคิวถัดไป').onClick
assert(roomCallNextScript.includes("const CALL_FRONT = '6ab0bb0afc8b9ef3e717b010'"))
assert(roomCallNextScript.includes("const CALL_NEXT = '6a4b942bac48023662b1b42a'"))
assert(roomCallNextScript.includes('const atFront = !u.room || !u.room.code'))

const roomActionsGrid = field(roomPane, 'xray_room_actions_grid')
assert.strictEqual(roomActionsGrid.component, 'grid', 'latest EMR My Room uses a two-column action header')
assert.strictEqual(roomActionsGrid.cols.length, 2)
assert.strictEqual(checkinButtons.component, 'button-ui')
assert.strictEqual(checkinButtons.options.textAlign, 'right')
assert.deepStrictEqual(checkinButtons.options.customClass, ['mb15'])
assert.strictEqual(checkinButtons.options.buttons.length, 1)
assert.strictEqual(checkinButtons.options.buttons[0].label, 'Check-in')
assert.strictEqual(checkinButtons.options.buttons[0].prefixIcon, 'el-circle-check')
const checkinScript = checkinButtons.options.buttons[0].onClick
assert(checkinScript.includes("const CHECKIN_FORM = '6ac9f156481c196fbb330cab'"))
assert(checkinScript.includes("['visit_unit', 'visit_room']"))
assert(checkinScript.includes('cancelCallback: closeAndRefresh'))
assert(checkinScript.includes('if (autoSave) return'))

for (const list of [unitList, roomList, doneList]) {
  const byName = Object.fromEntries(list.options.customValue.map(item => [item.fieldName, item.expressions]))
  assert(byName.statusLabel.includes("row.recalled_at?'↺'"), list.options.name + ' clones live recalled state')
  assert(byName.statusColor.includes("row.recalled_at?'var(--el-color-warning)'"))
  assert(byName.statusBg.includes("row.recalled_at?'var(--el-color-warning-light-9)'"))
  assert(byName.statusBg.includes("'skipped':'var(--el-color-danger-light-9)'"))
  assert(byName.statusTitle.includes("row.recalled_at?'เรียกกลับ'"))
  assert(list.options.detailContent.includes("title='{{statusTitle}}'"), list.options.name + ' exposes the full recalled label')
}

assert.strictEqual(unitList.options.where,
  "`visit_date` = DATE_TO_STRING(DATE_ADD(CURRENT_DATE(), 'hour', 7), '%Y-%m-%d') AND vtran_status = 'waiting' AND `unit_path` = :xunit_codex AND COALESCE(`room_to.value`, 'FRONT') = (CASE WHEN :xroom_codex = '__NONE__' THEN 'FRONT' ELSE :xroom_codex END)")
assert.strictEqual(roomList.options.where,
  "`visit_date` = DATE_TO_STRING(DATE_ADD(CURRENT_DATE(), 'hour', 7), '%Y-%m-%d') AND vtran_status IN ('called', 'in_progress', 'skipped') AND `unit_path` = :xunit_codex AND `room_to.value` = CASE WHEN :xroom_codex = '__NONE__' THEN 'FRONT' ELSE :xroom_codex END")
assert.strictEqual(doneList.options.where,
  "`visit_date` = DATE_TO_STRING(DATE_ADD(CURRENT_DATE(), 'hour', 7), '%Y-%m-%d') AND vtran_status = 'done' AND `unit_path` = :xunit_codex")

assert.deepStrictEqual(unitList.options.orderBy, [
  { column: 'vid.visit_priority', sort: 'DESC' },
  { column: 'queue_ts', sort: 'ASC' }
])
assert.deepStrictEqual(roomList.options.orderBy, unitList.options.orderBy)
/* 2026-10-18: ผู้ใช้สั่งลบ action “ซักประวัติ” ออกจาก X-ray Unit Queue;
   assertion ยังตรึงปุ่มที่เหลือและลำดับเดิมครบทุกตัว */
assert.deepStrictEqual(unitList.options.buttonsRow.map(item => item.label), ['เรียก', 'ย้ายห้อง', 'ส่งต่อ'])
/* 2026-10-15: ผู้ใช้สั่งลบเฉพาะ action “ซักประวัติ” ใน My Room;
   assertion ยังตรึงปุ่มที่เหลือและลำดับเดิมครบทุกตัว */
assert.deepStrictEqual(roomList.options.buttonsRow.map(item => item.label), ['X-ray', 'ข้าม/เรียกกลับ', 'ย้ายห้อง', 'ส่งต่อ'])
assert.deepStrictEqual(doneList.options.buttonsRow.map(item => item.label), ['X-ray'])

const rowCall = unitList.options.buttonsRow.find(item => item.label === 'เรียก').onClick
assert(rowCall.includes("? { tran_id: String(dataRow._id), unit: u.unit.code }"), 'front desk calls the selected parent queue')
assert(rowCall.includes('pick_id: String(dataRow._id)'), 'a selected child room calls only the chosen transaction')
assert(rowCall.includes('room: { value: u.room.code, label: u.room.name, qtype: u.room.qtype || null }'))

const unitScripts = unitList.options.buttonsRow.map(item => item.onClick).join('\n')
const roomScripts = roomList.options.buttonsRow.map(item => item.onClick).join('\n')
assert(unitScripts.includes("const MOVE_ROOM_FORM = '6a9524df422c1ca959829d9e'"), 'room transfer clones EMR')
assert(unitScripts.includes("openForm('6a4f828d22f95f21b606d9a2'"), 'unit forwarding clones EMR Move Unit')
assert(roomScripts.includes("runProcess('6a4f852422f95f21b606d9a3'"), 'X-ray starts the central queue before opening Worklist')
assert(roomScripts.includes('form.$xrayQueueTarget = target'), 'the queue opens the existing X-ray Worklist')
assert(roomScripts.includes("tab.activeTabName = 'xray_tab_worklist'"))

const generated = JSON.stringify(form)
assert(!generated.includes('"name":"btn_unit"'), 'obsolete Unit Queue header button is not shipped')
assert(!generated.includes('xray_queue_unit'))
assert(!generated.includes('xray_queue_room'))
assert(!generated.includes('xray_queue_done'))
assert(!generated.includes("action:'queue'"), 'the Form no longer calls the X-ray queue adapter')
assert(!String(form.formConfig.cssCode || '').includes('.xray-queue{'), 'retired mutable custom queue CSS is not shipped')
assert(String(form.formConfig.cssCode || '').includes('.xray-queue-tracking{'), 'read-only tracking CSS is isolated')
assert(worklistPane.fields.length > 0, 'the existing X-ray Worklist stays in place')
assert(trackingPane.fields.length > 0, 'the read-only tracking pane stays in place')
assert(labPane.fields.length > 0, 'the read-only LAB lookup stays in place')

console.log('ok - X-ray clones native EMR Unit Queue, My Room and Completed around the existing Worklist')
