/* deep link จากคิว → แท็บ X-ray — เทสแบบ "รันโค้ดจริง" ไม่ใช่เช็คสตริง
 *
 * เพิ่ม 2026-09-08 หลังเจอบั๊กจากหน้างาน: กดปุ่ม X-ray แล้วกรองถูกใบและขึ้นแบนเนอร์
 * "เปิดจากคิว" แล้ว แต่ **ไม่กาง item ให้ดู** เพราะ auto-expand ไปอ่าน order.id
 * ซึ่ง payload ดิบไม่มี (มีแต่ order_id/_id — `id` เป็นชื่อที่ buildRow ตั้งเอง)
 * ⇒ s.expanded กลายเป็น object ว่าง เทสที่เช็คแค่สตริงจับไม่ได้
 *
 * ไฟล์นี้จึงประกอบ onCreated ของ widget แล้วเรียกใช้จริงใน node
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
const findWidget = name => {
  let hit = null
  walk(form, value => { if (value.options && value.options.name === name) hit = value })
  assert(hit, 'missing widget ' + name)
  return hit
}
const worklist = findWidget('xray_cpoe_worklist')

const ORDER_A = { order_id: 'ORDER-A', order_number: 'R2608310006', items: [
  { item_id: 'ITEM-1', item_name: 'Skull AP', item_code: 'RD020', current_status: 'sent' },
  { item_id: 'ITEM-2', item_name: "Skull Towne's", item_code: 'RD021', current_status: 'sent' },
] }
const ORDER_B = { _id: 'ORDER-B', order_number: 'R2608310007', items: [
  { item_id: 'ITEM-3', item_name: 'Chest PA', item_code: 'RD004', current_status: 'sent' },
] }

/* สร้าง widget ใหม่ทุกครั้ง เพื่อไม่ให้ state ของเทสก่อนหน้าไหลข้ามมา */
const boot = (orders, options = {}) => {
  const calls = []
  const notices = []
  const ctx = {
    vueState: {},
    notify: (message, type) => notices.push({ message: String(message), type: type }),
    getFormRef: () => options.form || {},
    getFieldRef: () => null,
    globalUserState: {
      user: { unit: { code: 'm0901' } },
      runProcess: (id, params, ok) => {
        calls.push(params)
        /* refreshCounts ยิงซ้ำ 4 ครั้งด้วย limit:1 — ตอบ payload เดียวกันได้ ไม่กระทบที่ทดสอบ */
        ok({ success: true, data: { orders: orders, total: orders.length, page: 1, limit: 30 } })
      },
    },
  }
  new Function(options.source || worklist.options.onCreated).call(ctx)
  return { s: ctx.vueState, calls, notices }
}

/* runProcess ในเทสเรียก callback ทันที แต่ processCall ห่อด้วย Promise
   จึง resolve ใน microtask — ต้องปล่อยให้คิวเดินก่อนค่อยตรวจผล */
const settle = () => new Promise(resolve => setImmediate(resolve))

const run = async () => {
  /* ── regression: โหลดปกติต้อง **ไม่** กางอะไรเอง ────────────────────────
     ถ้าวันหนึ่ง auto-expand หลุดออกมานอกเงื่อนไข focusVisitId ผู้ใช้จะเจอ
     ทุกแถวกางพรืดตอนเปิดหน้า ซึ่งเป็นการทำ flow เดิมพัง */
  {
    const { s } = boot([ORDER_A, ORDER_B])
    s.loadOrders()
    await settle()
    assert.deepStrictEqual(s.expanded, {}, 'a normal load must never expand rows by itself')
    assert.strictEqual(s.view.rows.length, 2)
    assert(s.view.rows.every(row => !s.isExpanded(row.id)), 'and every row stays collapsed')
  }

  /* ── deep link: กางทุกใบของ visit นั้นให้เห็น item ทันที ────────────────
     ผู้ใช้สั่ง 2026-09-08: "กาง item แบบรูปที่ 2 ให้ด้วย" */
  {
    const { s, calls } = boot([ORDER_A, ORDER_B])
    s.focusVisit({ visit_id: 'aaaaaaaaaaaaaaaaaaaaaaa1', vn: '6900205' })
    await settle()

    assert.strictEqual(s.focusVisitId, 'aaaaaaaaaaaaaaaaaaaaaaa1')
    assert.strictEqual(s.focusVisitVn, '6900205')

    /* 🔴 หัวใจของบั๊กที่เจอหน้างาน — คีย์ของ s.expanded ต้องตรงกับ row.id
       ไม่ใช่ order.id ที่ payload ดิบไม่มี */
    assert.deepStrictEqual(s.expanded, { 'ORDER-A': true, 'ORDER-B': true })
    assert.strictEqual(s.view.rows.length, 2)
    s.view.rows.forEach(row => {
      assert(s.isExpanded(row.id), 'order ' + row.id + ' must render expanded')
    })
    /* กางแล้วต้องเห็น item จริง ๆ ไม่ใช่กางกล่องเปล่า */
    assert.deepStrictEqual(s.view.rows[0].items.map(i => i.name), ['Skull AP', "Skull Towne's"])
    assert.strictEqual(s.detailTab(s.view.rows[0].id), 'order', 'and opens on the order tab, like the screenshot')

    /* กรองด้วย visit_id แบบ exact — ไม่ใช่ยัด VN ลงช่องค้นหา */
    const listCall = calls.filter(c => c.action === 'list' && c.limit !== 1)[0]
    assert.strictEqual(listCall.visit_id, 'aaaaaaaaaaaaaaaaaaaaaaa1')
    assert.strictEqual(listCall.q, undefined, 'the VN must never leak into the regex search')
  }

  /* ── กดจากคิวแต่ visit นั้นไม่มีใบสั่งในสถานะที่เลือก = ต้องบอก ไม่ใช่เงียบ ── */
  {
    const { s, notices } = boot([])
    s.focusVisit({ visit_id: 'aaaaaaaaaaaaaaaaaaaaaaa1', vn: '6900205' })
    await settle()
    assert.deepStrictEqual(s.expanded, {})
    assert(notices.some(n => n.message.includes('6900205')), 'the user is told which VN came up empty')
  }

  /* ── "แสดงทั้งหมด" กลับไปโหมดปกติ และไม่กางค้างไว้ ────────────────────── */
  {
    const { s, calls } = boot([ORDER_A])
    s.focusVisit({ visit_id: 'aaaaaaaaaaaaaaaaaaaaaaa1', vn: '6900205' })
    await settle()
    assert.deepStrictEqual(s.expanded, { 'ORDER-A': true })

    s.clearFocusVisit()
    await settle()
    assert.strictEqual(s.focusVisitId, '')
    assert.strictEqual(s.focusVisitVn, '')
    assert.deepStrictEqual(s.expanded, {}, 'leaving focus mode collapses what focus mode opened')
    const last = calls.filter(c => c.action === 'list' && c.limit !== 1).pop()
    assert.strictEqual(last.visit_id, undefined, 'and the filter is gone from the query')
  }

  /* ── สแกน HN ต้องล้างโหมดคิวทิ้ง ไม่กรองซ้อนกัน ────────────────────────── */
  {
    const { s } = boot([ORDER_A])
    s.focusVisit({ visit_id: 'aaaaaaaaaaaaaaaaaaaaaaa1', vn: '6900205' })
    await settle()
    s.scanPatientHn('6900002')
    await settle()
    assert.strictEqual(s.focusVisitId, '', 'scanning leaves queue-focus mode')
    assert.strictEqual(s.scanMode, true)
    assert.strictEqual(s.scannedHn, '6900002')
  }

  /* ── คีย์ order มาจากที่เดียว — กันบั๊กเดิมกลับมาในรูปแบบอื่น ──────────── */
  {
    const { s } = boot([])
    assert.strictEqual(s.orderKey({ order_id: 'X' }), 'X')
    assert.strictEqual(s.orderKey({ _id: 'Y' }), 'Y')
    assert.strictEqual(s.orderKey({}), '')
    assert.strictEqual(s.buildRow(ORDER_A).id, s.orderKey(ORDER_A), 'row.id and orderKey can never drift')
  }

  /* ── 🔴 ปุ่ม "นัดล่วงหน้า" ถูกถอดออก 2026-09-26 ตามคำสั่งผู้ใช้ ───────────────
     ("เอาปุ่มนัดล่วงหน้าออกได้เลย ... ควรแยก module ดีกว่า")
     บล็อกเดิมสองอัน (ปุ่มเชื่อมจอจริง / ปิดปุ่มด้วย env แล้วต้องบอกเหตุผล) ถูกแทนด้วย
     assertion ว่าปุ่มและกลไกของมันต้องไม่มีอยู่แล้ว กันไม่ให้แอบกลับมาเงียบ ๆ */
  {
    assert(!/const APPOINTMENT_FORM_ID=/.test(worklist.options.onCreated), 'no appointment form id ships any more')
    const { s } = boot([], { form: { openForm: () => {} } })
    assert.strictEqual(typeof s.openAppointment, 'undefined', 'the handler is gone')
    assert.strictEqual(typeof s.appointmentHint, 'undefined', 'and so is its tooltip')
  }
  /* 🔴 ปุ่มเดิมต้องไม่เปลี่ยนปลายทาง — สร้างรายการใหม่ยังเปิดโคลนที่เลือก VN ได้เอง */
  {
    const opened = []
    const { s } = boot([], { form: { openForm: (id, a, b, init, cfg) => opened.push({ id, cfg }) } })
    s.openCreateOrder()
    assert.strictEqual(opened[0].id, '6a995d064744260ea8c9498c')
    assert.strictEqual(opened[0].cfg.params.appointment, undefined, 'creating an order is not an appointment')
  }

  console.log('X-ray queue deep-link tests passed')
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
