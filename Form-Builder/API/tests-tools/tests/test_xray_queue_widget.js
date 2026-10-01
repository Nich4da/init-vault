/* วิดเจ็ตคิว X-ray — เทสแบบรันโค้ดจริง (ประกอบ onCreated แล้วเรียกใช้ใน node)
 *
 * เพิ่ม 2026-09-08 พร้อมแท็บที่ 4 และปุ่มส่งต่อ
 * เทสแบบเช็คสตริงจับไม่ได้ว่า ctx ที่ส่งเข้าฟอร์มส่งต่อถูกต้องหรือไม่ และไม่รู้ว่า
 * afterSaveCallback ไปปิดคิวจริงหรือเปล่า — สองอย่างนี้คือหัวใจของงานรอบนี้
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const form = JSON.parse(fs.readFileSync(path.join(root, 'Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json'), 'utf8'))

const walk = (value, fn) => {
  if (!value || typeof value !== 'object') return
  fn(value)
  ;(Array.isArray(value) ? value : Object.values(value)).forEach(item => walk(item, fn))
}
const widgetNamed = name => {
  let hit = null
  walk(form, value => { if (value.options && value.options.name === name) hit = value })
  assert(hit, 'missing widget ' + name)
  return hit
}

const MOVE_FORM_ID = '6a4f828d22f95f21b606d9a2'
const DEST_PROCESS_ID = '6a75820bb902d8cb04375f69'
const WORKLIST_PROCESS_ID = '6a957009422c1ca959829e45'

const baseRow = (extra = {}) => Object.assign({
  visit_id: 'aaaaaaaaaaaaaaaaaaaaaaa1',
  vn: '6900205',
  hn: '6900002',
  patient_name: 'น.ส. มาไว ใจกล้า',
  item_count: 2,
  order_count: 1,
  requested_at: '2026-09-08 08:00:00',
}, extra)

const boot = (name, options = {}) => {
  const widget = widgetNamed(name)
  const opened = []
  const processCalls = []
  const notices = []
  const host = {
    openForm: (formId, a, b, initData, config) => opened.push({ formId, initData, config }),
    subFormClose: () => {},
    getFieldRef: () => null,
  }
  const ctx = {
    vueState: {},
    notify: (message, type) => notices.push({ message: String(message), type: type }),
    getFormRef: () => host,
    getFieldRef: () => null,
    globalUserState: {
      user: { unit: { code: 'm0901' } },
      runProcess: (id, params, ok, fail) => {
        processCalls.push({ id, params })
        const reply = options.replies && options.replies[id === DEST_PROCESS_ID ? 'dest' : (params.action || 'list')]
        if (reply === 'FAIL') { (fail || (() => {}))(new Error('boom')); return }
        ok(reply || { success: true, data: { rows: [], total: 0, counts: {} } })
      },
    },
  }
  new Function(widget.options.onCreated).call(ctx)
  return { s: ctx.vueState, opened, processCalls, notices, host }
}
const settle = () => new Promise(resolve => setImmediate(resolve))

const run = async () => {
  /* ── ถังของแต่ละแท็บต้องไม่สลับกัน ─────────────────────────────────────── */
  {
    const unit = boot('xray_queue_unit')
    const room = boot('xray_queue_room')
    const done = boot('xray_queue_done')
    assert.deepStrictEqual(
      [unit.s.isUnit, unit.s.isRoom, unit.s.isDone], [true, false, false])
    assert.deepStrictEqual(
      [room.s.isUnit, room.s.isRoom, room.s.isDone], [false, true, false])
    assert.deepStrictEqual(
      [done.s.isUnit, done.s.isRoom, done.s.isDone], [false, false, true])

    unit.s.load(); room.s.load(); done.s.load()
    await settle()
    assert.strictEqual(unit.processCalls[0].params.bucket, 'unit')
    assert.strictEqual(room.processCalls[0].params.bucket, 'room')
    assert.strictEqual(done.processCalls[0].params.bucket, 'done')
    assert(unit.processCalls.every(c => c.id === WORKLIST_PROCESS_ID), 'all queues share the worklist Process')
  }

  /* ── แท็บ Completed แสดง "อยู่ในห้องนานเท่าไหร่" ไม่ใช่เวลารอ ──────────── */
  {
    const { s } = boot('xray_queue_done')
    const row = baseRow({ called_at: '2026-09-08 09:00:00', done_at: '2026-09-08 09:25:00' })
    assert.strictEqual(s.waitText(row), '25 นาที')
    assert.strictEqual(s.stampText(row), 'ปิดคิว 09:25')
  }
  {
    const { s } = boot('xray_queue_room')
    assert.strictEqual(s.stampText(baseRow({ called_at: '2026-09-08 09:00:00' })), 'เรียก 09:00')
    const unit = boot('xray_queue_unit')
    assert.strictEqual(unit.s.stampText(baseRow()), 'สั่ง 08:00')
  }

  /* ── ส่งต่อไม่ได้เมื่อไม่มีแถวใน visit_tran — ต้องบอก ไม่ใช่เปิดฟอร์มเปล่า ── */
  {
    const { s, opened, notices } = boot('xray_queue_room')
    s.forwardVisit(baseRow({ tran_id: '' }))
    assert.strictEqual(opened.length, 0, 'no move form is opened without a visit_tran row')
    assert(notices.some(n => n.message.includes('visit_tran')), 'and the reason is shown')
  }

  /* ── ไม่มี consult → ถาม cpoe-order-dest แล้ว prefill ปลายทาง ───────────── */
  {
    const { s, opened, processCalls } = boot('xray_queue_room', {
      replies: { dest: { success: true, data: { found: true, unit: { value: 'm0400', label: 'ห้องยา' }, order_count: 2, order_number: 'RX-9' } } },
    })
    s.forwardVisit(baseRow({ tran_id: 'TRAN-1', unit_to: { value: 'm0901' }, visit_priority: '10' }))
    assert(processCalls.some(c => c.id === DEST_PROCESS_ID && c.params.tran_id === 'TRAN-1'), 'asks EMR\'s dest process')
    assert.strictEqual(opened.length, 1)
    assert.strictEqual(opened[0].formId, MOVE_FORM_ID, "EMR's own move form")
    assert.strictEqual(opened[0].initData.tran_id, 'TRAN-1', 'the move form takes the visit_tran id')
    assert.deepStrictEqual(opened[0].initData.unit_to, { value: 'm0400', label: 'ห้องยา' })
    assert(opened[0].initData.tran_note.includes('RX-9'), 'and warns that several drug orders are waiting')
  }

  /* ── consult มาก่อนการเดาจากใบสั่งยาเสมอ (กติกาเดียวกับ EMR) ───────────── */
  {
    const { s, opened, processCalls } = boot('xray_queue_room', {
      replies: { dest: { success: true, data: { found: true, unit: { value: 'm0400', label: 'ห้องยา' } } } },
    })
    s.forwardVisit(baseRow({
      tran_id: 'TRAN-1',
      unit_to: { value: 'm0901' },
      consult_info: { clinic: 'm0500', to_label: 'อายุรกรรม', reason: 'ขอความเห็น', priority: '20', consult_id: 'C-1' },
    }))
    assert(!processCalls.some(c => c.id === DEST_PROCESS_ID), 'a consult destination never asks the drug-order guess')
    assert.deepStrictEqual(opened[0].initData.unit_to, { value: 'm0500', label: 'อายุรกรรม' })
    assert.strictEqual(opened[0].initData.tran_note, 'ขอความเห็น')
    assert.strictEqual(opened[0].initData.visit_priority, '20')
    assert.strictEqual(opened[0].initData.consult_id, 'C-1')
  }

  /* ── ปลายทางขอส่งกลับ → prefill ต้นทางจาก unit_from ────────────────────── */
  {
    const { s, opened } = boot('xray_queue_room')
    s.forwardVisit(baseRow({
      tran_id: 'TRAN-1',
      unit_to: { value: 'm0901' },
      unit_from: { value: '19.p', label: 'คลินิกวัคซีน' },
      consult_info: { clinic: 'm0901', reply: true },
    }))
    assert.deepStrictEqual(opened[0].initData.unit_to, { value: '19.p', label: 'คลินิกวัคซีน' })
  }

  /* ── dest process ล้ม = ยังต้องเปิดฟอร์มได้ ห้ามบล็อกเจ้าหน้าที่ ────────── */
  {
    const { s, opened } = boot('xray_queue_room', { replies: { dest: 'FAIL' } })
    s.forwardVisit(baseRow({ tran_id: 'TRAN-1', unit_to: { value: 'm0901' } }))
    assert.strictEqual(opened.length, 1, 'a failed prefill still opens the move form')
    assert.strictEqual(opened[0].initData.unit_to, undefined, 'just without a guessed destination')
  }

  /* ── ปิดคิวเกิด "หลังบันทึกสำเร็จ" เท่านั้น ไม่ใช่ตอนเปิดฟอร์ม ───────────── */
  {
    const { s, opened, processCalls } = boot('xray_queue_room', {
      replies: { queue_done: { success: true, data: { already_done: false, done_at: '2026-09-08 10:00:00' } } },
    })
    s.forwardVisit(baseRow({ tran_id: 'TRAN-1', unit_to: { value: 'm0901' } }))
    assert(!processCalls.some(c => c.params && c.params.action === 'queue_done'), 'opening the form closes nothing')

    opened[0].config.cancelCallback()
    await settle()
    assert(!processCalls.some(c => c.params && c.params.action === 'queue_done'), 'cancelling closes nothing either')

    opened[0].config.afterSaveCallback()
    await settle()
    const closed = processCalls.filter(c => c.params && c.params.action === 'queue_done')
    assert.strictEqual(closed.length, 1, 'saving the move form closes the X-ray queue')
    assert.strictEqual(closed[0].params.visit_id, 'aaaaaaaaaaaaaaaaaaaaaaa1')
  }

  /* ── เรียกเข้าห้องยังทำงานเหมือนเดิม (regression ของ flow ที่ทำเสร็จแล้ว) ── */
  {
    const { s, processCalls, notices } = boot('xray_queue_unit', {
      replies: { queue_call: { success: true, data: { already_called: false } } },
    })
    s.callVisit(baseRow())
    await settle()
    const called = processCalls.filter(c => c.params && c.params.action === 'queue_call')
    assert.strictEqual(called.length, 1)
    assert.strictEqual(called[0].params.visit_id, 'aaaaaaaaaaaaaaaaaaaaaaa1')
    assert(notices.some(n => n.type === 'success'))
  }

  /* ── ปุ่ม X-ray ยังเป็นแค่ navigate เหมือนเดิม ไม่แตะคิวและไม่แตะสถานะ ──── */
  {
    const { s, processCalls, host } = boot('xray_queue_room')
    let activeTab = 'xray_tab_room'
    host.getFieldRef = name => (name === 'xray_app' ? { set activeTabName (v) { activeTab = v } } : null)
    s.goXray(baseRow())
    assert.strictEqual(host.$xrayQueueTarget.visit_id, 'aaaaaaaaaaaaaaaaaaaaaaa1')
    assert.strictEqual(activeTab, 'xray_tab_worklist')
    assert.strictEqual(processCalls.length, 0, 'the X-ray button calls no API at all')
  }

  /* ── เลขคิวบนจอต้องเป็นเลขจริงพร้อม prefix ถ้ามี ────────────────────────── */
  {
    const { s } = boot('xray_queue_unit')
    assert.strictEqual(s.seqText(baseRow({ queue_label: 'D002' }), 0), 'D002')
    assert.strictEqual(s.seqText(baseRow(), 4), '5', 'no queue number falls back to the position')
    assert(s.seqHint(baseRow()).includes('visit_tran'), 'and says why the number is missing')
  }

  /* ── ป้ายสถานะคิว (ผู้ใช้ขอ 2026-09-08: My Room ต้องบอกว่า "รับแล้ว") ─────── */
  {
    assert.strictEqual(boot('xray_queue_unit').s.stateLabel, 'รอเรียก')
    assert.strictEqual(boot('xray_queue_room').s.stateLabel, 'รับแล้ว')
    assert.strictEqual(boot('xray_queue_done').s.stateLabel, 'ส่งต่อแล้ว')
    assert.strictEqual(boot('xray_queue_room').s.stateClass, 'is-room')
    /* ป้ายนี้เป็นสถานะของ "คิว" — ห้ามไปหยิบสถานะของใบสั่งมาแสดงปนกัน */
    assert.strictEqual(boot('xray_queue_unit').s.emptyText, 'ไม่มีคิวในวันนี้')
  }

  console.log('X-ray queue widget tests passed')
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
