const assert = require('assert')
const fs = require('fs')
const path = require('path')

const apiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/xray_cpoe_reject_api.js'),
  'utf8',
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)

/* MongoDB ของระบบเป็น standalone — Process นี้ห้ามพึ่ง transaction เลย
   ถ้ามีใครใส่ mongoTxn กลับเข้ามา ปุ่มปฏิเสธจะพังเงียบแบบเดียวกับ accession */
assert(!apiBody.includes('mongoTxn'), 'reject must not use a transaction on standalone MongoDB')

const ITEM = 'aaaaaaaaaaaaaaaaaaaaaaa1'
const ITEM_DISPATCHED = 'aaaaaaaaaaaaaaaaaaaaaaa2'
const ITEM_LAB = 'aaaaaaaaaaaaaaaaaaaaaaa3'
const ITEM_REJECTED = 'aaaaaaaaaaaaaaaaaaaaaaa4'
const ITEM_READY = 'aaaaaaaaaaaaaaaaaaaaaaa5'
const ORDER = 'bbbbbbbbbbbbbbbbbbbbbbb1'
const OTHER_ORDER = 'bbbbbbbbbbbbbbbbbbbbbbb2'
const RECORD = 'ccccccccccccccccccccccc1'
const RECORD_OTHER_ITEM = 'ccccccccccccccccccccccc2'
const RECORD_NO_REASON = 'ccccccccccccccccccccccc3'
const RECORD_READY = 'ccccccccccccccccccccccc4'
const RECORD_MISSING = 'ccccccccccccccccccccccc9'

const clone = value => JSON.parse(JSON.stringify(value))

const makeHarness = ({ plainServiceType = false, stampFails = false, withRadiologyHierarchy = false, creatorUnit = 'm0901', queueUnit = '' } = {}) => {
  const items = new Map([
    [ITEM, {
      _id: ITEM, xrstatx: 1, order_ref_id: ORDER, current_status: 'sent',
      service_type: plainServiceType ? 'xray' : { value: 'xray' },
      item_code: 'RD015', item_name: 'Neck AP',
    }],
    [ITEM_DISPATCHED, {
      _id: ITEM_DISPATCHED, xrstatx: 1, order_ref_id: ORDER, current_status: 'dispatched',
      service_type: { value: 'xray' }, accession_no: 'SM20260901DX001',
    }],
    [ITEM_LAB, {
      _id: ITEM_LAB, xrstatx: 1, order_ref_id: ORDER, current_status: 'sent',
      service_type: { value: 'lab' },
    }],
    [ITEM_REJECTED, {
      _id: ITEM_REJECTED, xrstatx: 1, order_ref_id: ORDER, current_status: 'rejected',
      service_type: { value: 'xray' }, rejected_at: '2026-09-01 08:00:00',
      reject_reason_code: 'PATIENT_ABSENT', reject_reason_detail: 'ผู้ป่วยไม่มาตามนัด',
    }],
    [ITEM_READY, {
      _id: ITEM_READY, xrstatx: 1, order_ref_id: ORDER, current_status: 'ready',
      service_type: { value: 'xray' }, item_code: 'RD020', item_name: 'Skull AP',
    }],
  ])

  const records = new Map([
    [RECORD, {
      _id: RECORD, xrstatx: 1, source_item_id: ITEM,
      reject_reason_code: 'PATIENT_ABSENT', reject_reason_detail: 'ผู้ป่วยไม่มาตามนัด',
      rejection_status: 'recorded',
    }],
    [RECORD_OTHER_ITEM, {
      _id: RECORD_OTHER_ITEM, xrstatx: 1, source_item_id: ITEM_DISPATCHED,
      reject_reason_code: 'PATIENT_ABSENT', rejection_status: 'recorded',
    }],
    [RECORD_NO_REASON, {
      _id: RECORD_NO_REASON, xrstatx: 1, source_item_id: ITEM,
      reject_reason_code: '', reject_reason_detail: '', rejection_status: 'recorded',
    }],
    [RECORD_READY, {
      _id: RECORD_READY, xrstatx: 1, source_item_id: ITEM_READY,
      reject_reason_code: 'XRAYR-00002', reject_reason_detail: '',
      rejection_status: 'recorded',
    }],
  ])

  const reasonCollection = {
    findOne: async query => query.reason_code === 'XRAYR-00002'
      ? { reason_code: 'XRAYR-00002', reason_text: 'ผู้ป่วยไม่มาตามนัด', xrstatx: 1 }
      : null,
  }
  const orders = new Map([[ORDER, {
    _id: ORDER, xrstatx: 1, xparentx: 'visit-reject-1',
    xunitx: { code: creatorUnit, label: creatorUnit },
    vid: { pid: { hn: 'HN-REJECT-1' } },
  }]])

  const itemCollection = {
    findOne: async query => clone(items.get(query._id) || null),
    updateOne: async (query, update) => {
      const row = items.get(query._id)
      if (!row) return { matchedCount: 0, modifiedCount: 0 }
      if (query.current_status) {
        const expected = query.current_status
        const matched = expected && Array.isArray(expected.$in)
          ? expected.$in.includes(row.current_status)
          : row.current_status === expected
        if (!matched) return { matchedCount: 0, modifiedCount: 0 }
      }
      Object.assign(row, clone(update.$set || {}))
      return { matchedCount: 1, modifiedCount: 1 }
    },
  }
  const recordCollection = {
    findOne: async query => clone(records.get(query._id) || null),
    updateOne: async (query, update) => {
      if (stampFails) return { matchedCount: 0, modifiedCount: 0 }
      const row = records.get(query._id)
      if (!row) return { matchedCount: 0, modifiedCount: 0 }
      Object.assign(row, clone(update.$set || {}))
      return { matchedCount: 1, modifiedCount: 1 }
    },
  }

  const app = {
    isAuth: () => true,
    curDate: () => '2026-09-01 15:30:00',
    dbObjectId: id => String(id),
    dbFindAll: async provider => {
      if (!withRadiologyHierarchy) return { success: true, reply: { data: [] } }
      if (provider.from === 'zdata_organization') {
        return {
          success: true,
          reply: {
            data: [
              { _id: 'org-root', unit_code: 'm0900', enable: true },
              { _id: 'org-ra309', unit_code: 'RA-309', unit_parent: { value: 'org-root', label: 'm0900' }, enable: true },
              { _id: 'org-ra309-child', unit_code: 'RA-309-A', unit_parent: { value: 'org-ra309', label: 'RA-309' }, enable: true },
              { _id: 'org-ward', unit_code: '19.P', enable: true },
            ],
          },
        }
      }
      if (provider.from === 'zdata_room') {
        return {
          success: true,
          reply: {
            data: [
              { code: 'US1', unit_id: { value: 'org-ra309', label: 'RA-309' }, enable: true },
              { code: 'WARD-ROOM', unit_id: { value: 'org-ward', label: '19.P' }, enable: true },
            ],
          },
        }
      }
      return { success: true, reply: { data: [] } }
    },
    db: {
      collection: name => ({
        zdata_cpoe_order_item: itemCollection,
        zdata_cpoe_order: { findOne: async query => clone(orders.get(query._id) || null) },
        zdata_visit_tran: {
          find: () => {
            const rows = queueUnit ? [{
              vid: { value: 'visit-reject-1' }, vtran_status: 'waiting',
              unit_to: { code: queueUnit, label: queueUnit }, xrstatx: 1,
            }] : []
            const chain = { sort: () => chain, toArray: async () => clone(rows) }
            return chain
          },
        },
        zdata_xray_reject: recordCollection,
        zdata_xray_reject_reason_settings: reasonCollection,
      })[name],
    },
  }
  return { app, items, records }
}

const radiologyUser = { roles: ['auth'], username: 'xray-test', unit: { code: 'm0901' }, account: { name: 'xray-test' } }
const wardUser = { roles: ['auth'], username: 'ward', unit: { code: '19.P' } }
const call = (h, params, user) => Process.call({}, params, user || radiologyUser, h.app)

;(async () => {
  /* ── ปฏิเสธสำเร็จ ────────────────────────────────────────────────────── */
  {
    const h = makeHarness()
    const out = await call(h, { action: 'reject_item', item_id: ITEM, rejection_record_id: RECORD, order_id: ORDER, order_number: 'R2609010003' })
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.data.audit_sync_pending, false)
    assert.strictEqual(out.data.reject_reason_code, 'PATIENT_ABSENT')

    const row = h.items.get(ITEM)
    assert.strictEqual(row.current_status, 'rejected')
    assert.strictEqual(row.rejected_at, '2026-09-01 15:30:00')
    assert.strictEqual(row.reject_reason_detail, 'ผู้ป่วยไม่มาตามนัด')
    assert.strictEqual(row.reject_reason, 'ผู้ป่วยไม่มาตามนัด', 'the worklist column reads reject_reason')
    assert.strictEqual(row.rejection_record_id, RECORD, 'the audit record stays reachable from the item')
    assert.strictEqual(row.accession_no, undefined, 'a rejected item never burns an accession number')

    const record = h.records.get(RECORD)
    assert.strictEqual(record.rejection_status, 'applied')
    assert.strictEqual(record.applied_item_id, ITEM)
    assert.strictEqual(record.applied_order_number, 'R2609010003')
  }

  /* ── ready คือผ่านการเงินแล้ว แต่ยังไม่ใช่สถานะของ RIS: ปฏิเสธได้ ─────── */
  {
    const h = makeHarness()
    const out = await call(h, {
      action: 'reject_item', item_id: ITEM_READY, rejection_record_id: RECORD_READY,
      order_id: ORDER, order_number: 'R2609010004',
    })
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(h.items.get(ITEM_READY).current_status, 'rejected')
    assert.strictEqual(h.items.get(ITEM_READY).accession_no, undefined)
    assert.strictEqual(h.items.get(ITEM_READY).reject_reason_code, 'XRAYR-00002')
    assert.strictEqual(h.items.get(ITEM_READY).reject_reason, 'ผู้ป่วยไม่มาตามนัด')
    assert.strictEqual(h.records.get(RECORD_READY).rejection_status, 'applied')
  }

  /* ── ส่งเข้าเครื่องไปแล้ว = ห้ามปฏิเสธเงียบ ๆ ฝั่งเรา ─────────────────── */
  {
    const h = makeHarness()
    const out = await call(h, { item_id: ITEM_DISPATCHED, rejection_record_id: RECORD_OTHER_ITEM, order_id: ORDER })
    assert.strictEqual(out.success, false)
    assert(out.message.includes('RIS'), out.message)
    assert.strictEqual(h.items.get(ITEM_DISPATCHED).current_status, 'dispatched', 'nothing changes')
    assert.strictEqual(h.records.get(RECORD_OTHER_ITEM).rejection_status, 'recorded')
  }

  /* ── กดซ้ำ = ไม่ใช่ error คืนสถานะเดิม ────────────────────────────────── */
  {
    const h = makeHarness()
    const out = await call(h, { item_id: ITEM_REJECTED, rejection_record_id: RECORD })
    assert.strictEqual(out.success, true)
    assert.strictEqual(out.data.already_rejected, true)
    assert.strictEqual(out.data.reject_reason_detail, 'ผู้ป่วยไม่มาตามนัด')
  }

  /* ── หลักฐานต้องมีจริง ตรงรายการ และมีเหตุผล ─────────────────────────── */
  {
    const h = makeHarness()

    const noRecord = await call(h, { item_id: ITEM, rejection_record_id: RECORD_MISSING })
    assert.strictEqual(noRecord.success, false)
    assert(noRecord.message.includes('ไม่พบฟอร์มเหตุผล'))
    assert.strictEqual(h.items.get(ITEM).current_status, 'sent')

    const mismatched = await call(h, { item_id: ITEM, rejection_record_id: RECORD_OTHER_ITEM })
    assert.strictEqual(mismatched.success, false)
    assert(mismatched.message.includes('ไม่ตรงกับรายการตรวจ'))
    assert.strictEqual(h.items.get(ITEM).current_status, 'sent')

    const noReason = await call(h, { item_id: ITEM, rejection_record_id: RECORD_NO_REASON })
    assert.strictEqual(noReason.success, false)
    assert(noReason.message.includes('เหตุผล'))
    assert.strictEqual(h.items.get(ITEM).current_status, 'sent')

    const unsaved = await call(h, { item_id: ITEM, rejection_record_id: '' })
    assert.strictEqual(unsaved.success, false)
    assert(unsaved.message.includes('บันทึกฟอร์มเหตุผล'))
  }

  /* ── ใบสั่งที่ส่งมาต้องตรงกับใบของรายการจริง ─────────────────────────── */
  {
    const h = makeHarness()
    const out = await call(h, { item_id: ITEM, rejection_record_id: RECORD, order_id: OTHER_ORDER })
    assert.strictEqual(out.success, false)
    assert(out.message.includes('ไม่ได้อยู่ในใบสั่งนี้'))
    assert.strictEqual(h.items.get(ITEM).current_status, 'sent')
  }

  /* ── ขอบเขต: เฉพาะรายการรังสี และเฉพาะหน่วยงานรังสี ──────────────────── */
  {
    const h = makeHarness()

    const lab = await call(h, { item_id: ITEM_LAB, rejection_record_id: RECORD })
    assert.strictEqual(lab.success, false)
    assert(lab.message.includes('เฉพาะรายการทางรังสี'))

    const ward = await call(h, { item_id: ITEM, rejection_record_id: RECORD }, wardUser)
    assert.strictEqual(ward.success, false)
    assert(ward.message.includes('ไม่ใช่หน่วยงานรังสี'))
    assert.strictEqual(h.items.get(ITEM).current_status, 'sent')

    /* ทุกหน่วยยังผ่านประตู Worklist แต่ action ต้องตรงหน่วยผู้สร้างหรือหน่วยถือคิว */
    for (const code of ['m0900', 'CT']) {
      const scoped = makeHarness()
      const out = await call(scoped, { item_id: ITEM, rejection_record_id: RECORD },
        { roles: ['auth'], username: 'u', unit: { code }, account: { name: 'u' } })
      assert.strictEqual(out.success, false, code + ' must be view-only for an m0901 order')
      assert.strictEqual(out.error, 'action_unit_denied')
    }

    /* หน่วยลูกหลายชั้นและ Room ใต้ root ต้องผ่านเหมือน Worklist */
    for (const code of ['RA-309', 'RA-309-A', 'US1']) {
      const scoped = makeHarness({ withRadiologyHierarchy: true, creatorUnit: code === 'US1' ? 'RA-309' : code })
      const out = await call(scoped, { item_id: ITEM, rejection_record_id: RECORD },
        { roles: ['auth'], username: 'u', unit: { code }, account: { name: 'u' } })
      assert.strictEqual(out.success, true, code + ' must inherit radiology access: ' + out.message)
    }

    const unrelatedRoom = makeHarness({ withRadiologyHierarchy: true })
    const roomOut = await call(unrelatedRoom, { item_id: ITEM, rejection_record_id: RECORD },
      { roles: ['auth'], username: 'u', unit: { code: 'WARD-ROOM' }, account: { name: 'u' } })
    assert.strictEqual(roomOut.success, false, 'a room outside the radiology hierarchy must remain blocked')
  }

  /* คิวล่าสุดที่ส่งมาหาหน่วยนี้ให้สิทธิ์ได้ แม้ Order จะถูกสร้างจากอีกหน่วย */
  {
    const h = makeHarness({ withRadiologyHierarchy: true, creatorUnit: 'm0901', queueUnit: 'RA-309' })
    const out = await call(h, { item_id: ITEM, rejection_record_id: RECORD },
      { roles: ['auth'], username: 'u', unit: { code: 'RA-309' }, account: { name: 'u' } })
    assert.strictEqual(out.success, true, out.message)
  }

  /* ── service_type ที่เก็บเป็น string ตรง ๆ ต้องอ่านได้ ────────────────── */
  {
    const h = makeHarness({ plainServiceType: true })
    const out = await call(h, { item_id: ITEM, rejection_record_id: RECORD })
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(h.items.get(ITEM).current_status, 'rejected')
  }

  /* ── ประทับหลักฐานพลาด = สถานะยังถูก แต่ต้องบอกให้รู้ ────────────────── */
  {
    const h = makeHarness({ stampFails: true })
    const out = await call(h, { item_id: ITEM, rejection_record_id: RECORD })
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.data.audit_sync_pending, true)
    assert(out.message.includes('แจ้งผู้ดูแล'))
    assert.strictEqual(h.items.get(ITEM).current_status, 'rejected', 'the status change still stands')
  }

  /* ── รูปแบบ input และ action ที่ไม่รองรับ ─────────────────────────────── */
  {
    const h = makeHarness()
    const badItem = await call(h, { item_id: 'nope', rejection_record_id: RECORD })
    assert.strictEqual(badItem.success, false)
    assert(badItem.message.includes('item_id'))

    const badAction = await call(h, { action: 'cancel_order', item_id: ITEM, rejection_record_id: RECORD })
    assert.strictEqual(badAction.success, false)
    assert(badAction.message.includes('ไม่รองรับ action'))
    assert.strictEqual(h.items.get(ITEM).current_status, 'sent')
  }

  console.log('X-ray CPOE reject API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
