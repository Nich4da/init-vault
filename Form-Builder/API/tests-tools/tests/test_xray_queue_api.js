/* คิวห้องรังสี — action 'queue' / 'queue_call' และ filter visit_id ของ action 'list'
 *
 * เพิ่ม 2026-09-08 ตามคำสั่งผู้ใช้:
 *   "จากตอนแรก ถ้ามีการสั่ง → เข้าห้องเลย เปลี่ยนเป็นเข้าคิวก่อน"
 *   "ปุ่ม xray กดปุ๊บ จะเด้งมาที่ tab xray … แบบแค่กาง order ให้ดู"
 *
 * ไฟล์นี้แยกจาก test_xray_cpoe_worklist_api.js โดยตั้งใจ — mock ของไฟล์นั้น
 * ผูกกับเส้นทาง list/get_report เดิม ถ้าไปขยาย mock ที่นั่นเพื่อรองรับ aggregate
 * ของคิว จะเสี่ยงทำให้ assertion เดิมหลวมลงโดยไม่มีใครสังเกต
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const apiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/xray_cpoe_worklist_api.js'),
  'utf8',
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)

const userInfo = {
  roles: ['user'],
  unit: { code: 'm0901' },
  employee_code: 'RAD-01',
  fullname: 'ณิชดา รังสี',
  _id: 'USER-1',
}
const VISIT_1 = 'aaaaaaaaaaaaaaaaaaaaaaa1'
const NOW = '2026-09-08 10:20:30'

/* แถวที่ pipeline คืนกลับมา — รูปร่างตรงกับ $group ของ queueVisitPipeline */
const queueRowRaw = (overrides = {}) => Object.assign({
  _id: VISIT_1,
  vn: 'VN-0001',
  hn: '0012345',
  prename: 'ด.ช.',
  first_name: 'ธนกฤต',
  last_name: 'ใจดี',
  age: 7,
  gender_text: 'ชาย',
  visit_date: '2026-09-07',
  order_ids: ['ORDER-1'],
  order_numbers: ['R2609070002'],
  item_count: 3,
  first_requested_at: '2026-09-07 16:02:58',
}, overrides)

const makeApp = (captures, options = {}) => {
  const queueDocs = options.queueDocs === undefined ? [] : options.queueDocs
  return {
    isAuth: () => options.auth !== false,
    dbObjectId: id => String(id),
    curDate: fmt => (fmt ? NOW : NOW.slice(0, 10)),
    dbFindById: async () => ({ success: true, reply: { data: null } }),
    dbFindAll: async provider => {
      captures.push({ type: 'dbFindAll', provider })
      if (provider.from === 'zdata_organization') return { success: true, reply: { data: [] } }
      return { success: true, reply: { data: options.listRows || [] } }
    },
    sdformGetAll: async () => ({ success: true, data: [] }),
    db: {
      collection: name => ({
        aggregate: (pipeline, opts) => {
          captures.push({ type: 'aggregate', collection: name, pipeline, opts })
          const isCount = pipeline.some(stage => stage.$count)
          return {
            toArray: async () => {
              if (options.aggregateThrows) throw new Error('AGG_BOOM')
              if (isCount) return [{ value: options.countValue == null ? 2 : options.countValue }]
              return (options.rows || []).map(row => JSON.parse(JSON.stringify(row)))
            },
          }
        },
        findOne: async query => {
          captures.push({ type: 'findOne', collection: name, query })
          return queueDocs[0] || null
        },
        insertOne: async doc => {
          captures.push({ type: 'insertOne', collection: name, doc })
          return { insertedId: 'QUEUE-1' }
        },
        updateOne: async (filter, update) => {
          captures.push({ type: 'updateOne', collection: name, filter, update })
          return { modifiedCount: 1 }
        },
        find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => [] }) }) }),
      }),
    },
  }
}

const run = async () => {
  /* ── ด่านสิทธิ์ต้องคุม action ใหม่ด้วย ไม่ใช่แค่ list ────────────────── */
  {
    let out = await Process({ action: 'queue' }, userInfo, makeApp([], { auth: false }))
    assert.strictEqual(out.success, false, 'no auth, no queue')

    out = await Process({ action: 'queue' }, { roles: ['user'], unit: { code: 'OPD' } }, makeApp([]))
    assert.strictEqual(out.success, false, 'a non-radiology organization cannot read the queue')

    out = await Process({ action: 'queue_call', visit_id: VISIT_1 }, { roles: ['user'], unit: { code: 'OPD' } }, makeApp([]))
    assert.strictEqual(out.success, false, 'nor call one in')
  }

  /* ── Unit Queue = ใบที่ยัง 'sent' และยังไม่ถูกเรียก ─────────────────── */
  {
    const captures = []
    const out = await Process({ action: 'queue' }, userInfo, makeApp(captures, { rows: [queueRowRaw()] }))
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.data.bucket, 'unit')

    const row = out.data.rows[0]
    assert.strictEqual(row.visit_id, VISIT_1)
    assert.strictEqual(row.vn, 'VN-0001')
    assert.strictEqual(row.hn, '0012345')
    assert.strictEqual(row.patient_name, 'ด.ช. ธนกฤต ใจดี', 'ชื่อประกอบจาก prename + ชื่อ + สกุล')
    assert.strictEqual(row.item_count, 3)
    assert.strictEqual(row.order_count, 1, 'นับจากจำนวนใบสั่งจริง ไม่ใช่จำนวน item')
    assert.strictEqual(row.requested_at, '2026-09-07 16:02:58')
    assert.strictEqual(row.called_at, '', 'ยังไม่ถูกเรียก')

    const rowsAgg = captures.filter(c => c.type === 'aggregate' && !c.pipeline.some(s => s.$count))[0]
    assert.strictEqual(rowsAgg.collection, 'zdata_cpoe_order_item')
    const text = JSON.stringify(rowsAgg.pipeline)
    assert(text.includes('"current_status":{"$in":["sent"]}'), 'unit queue only holds orders nobody has moved yet')
    assert(text.includes('"service_type.value":"xray"'), 'and only radiology items')
    assert(text.includes('zdata_xray_queue'), 'queue state is joined from its own collection')
    assert(text.includes('"$sort":{"first_requested_at":1,"vn":1}'), 'FIFO — เรียงตามเวลาสั่งที่เก่าที่สุดของ VN')

    /* 🔴 ห้ามเขียนอะไรทั้งสิ้นตอนแค่อ่านคิว */
    assert(!captures.some(c => ['insertOne', 'updateOne'].includes(c.type)), 'reading the queue writes nothing')

    /* นับให้ครบทุกถังเพื่อให้ badge ของทุกแท็บตรงกันเสมอ
       เพิ่ม done 2026-09-08 ตามคำสั่งผู้ใช้ที่ขอแท็บที่ 4 (สำเร็จ/ส่งต่อคิว) */
    assert.deepStrictEqual(out.data.counts, { unit: 2, room: 2, done: 2 })
  }

  /* ── My Room = ใบที่ยังเดินอยู่ และ visit ถูกเรียกแล้ว ───────────────── */
  {
    const captures = []
    const out = await Process(
      { action: 'queue', bucket: 'room' },
      userInfo,
      makeApp(captures, { rows: [queueRowRaw({ queue_doc: { called_at: '2026-09-08 09:00:00', called_by: { id: 'USER-9', name: 'พี่เอ' } } })] }),
    )
    assert.strictEqual(out.data.bucket, 'room')
    assert.strictEqual(out.data.rows[0].called_at, '2026-09-08 09:00:00')
    assert.deepStrictEqual(out.data.rows[0].called_by, { id: 'USER-9', name: 'พี่เอ' })

    const text = JSON.stringify(captures.filter(c => c.type === 'aggregate' && !c.pipeline.some(s => s.$count))[0].pipeline)
    assert(text.includes('"queue_doc.called_at":{"$nin":[null,""]}'), 'My Room shows only queues that were called in')
    /* ปิดคิวแล้วต้องหลุดจาก My Room ไปแท็บ Completed ไม่ค้างอยู่สองที่ */
    assert(text.includes('"queue_doc.done_at":{"$in":[null,""]}'), 'and drops the ones already closed')
    assert(text.includes('zdata_visit_tran'), 'the forward button needs the visit_tran row joined in')
    assert(text.includes('"in_progress"'), 'and follows every live status, not just sent')
    assert(text.includes('"$sort":{"queue_doc.called_at":1,"vn":1}'), 'เรียงตามลำดับที่เรียกเข้าห้อง')
  }

  /* bucket แปลก ๆ ต้องตกกลับมาที่ unit ไม่ใช่ระเบิด */
  {
    const out = await Process({ action: 'queue', bucket: 'ROOMY' }, userInfo, makeApp([], { rows: [] }))
    assert.strictEqual(out.data.bucket, 'unit')
  }

  /* aggregate ล้ม = ตอบ error ที่อ่านออก ไม่ใช่โยน exception ใส่ผู้ใช้ */
  {
    const out = await Process({ action: 'queue' }, userInfo, makeApp([], { aggregateThrows: true }))
    assert.strictEqual(out.success, false)
    assert(out.message.includes('อ่านคิวห้องรังสีไม่สำเร็จ'))
  }

  /* ── เรียกคิวเข้าห้อง ────────────────────────────────────────────────── */
  {
    const out = await Process({ action: 'queue_call', visit_id: 'not-an-id' }, userInfo, makeApp([]))
    assert.strictEqual(out.error, 'invalid_visit_id')
  }
  {
    const captures = []
    const out = await Process(
      { action: 'queue_call', visit_id: VISIT_1 },
      userInfo,
      makeApp(captures, { rows: [queueRowRaw()] }),
    )
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.data.already_called, false)
    assert.strictEqual(out.data.called_at, NOW)

    const insert = captures.filter(c => c.type === 'insertOne')[0]
    assert(insert, 'a queue document is created')
    assert.strictEqual(insert.collection, 'zdata_xray_queue')
    assert.strictEqual(insert.doc.visit_id, VISIT_1)
    assert.strictEqual(insert.doc.called_at, NOW)
    assert.deepStrictEqual(insert.doc.called_by, { id: 'USER-1', name: 'ณิชดา รังสี' })
    assert.strictEqual(insert.doc.queue_date, '2026-09-08')
    assert.strictEqual(insert.doc.xrstatx, 1)
    /* บันทึกไว้ว่าเรียกจาก org ไหนเพื่อตรวจย้อนหลัง — แต่ไม่ได้เอาไปกรอง My Room
       เพราะผู้ใช้ยืนยัน 2026-09-08 ว่า m0900/m0901 เรียกแล้วเห็นชุดเดียวกัน */
    assert.strictEqual(insert.doc.called_unit, 'M0901')

    /* 🔴 หัวใจของงานนี้ — เรียกคิวต้องไม่ไปยุ่งกับใบสั่งหรือรายการตรวจเลย
       ถ้าวันหนึ่งมีคนย้ายสถานะคิวไปเขียน current_status ปุ่ม "ส่งเข้าเครื่อง"
       จะพังทันทีเพราะ accepted แปลว่า "ส่งเข้าเครื่องแล้ว" อยู่ก่อนแล้ว */
    const written = captures.filter(c => ['insertOne', 'updateOne'].includes(c.type))
    assert.deepStrictEqual(
      Array.from(new Set(written.map(c => c.collection))),
      ['zdata_xray_queue'],
      'calling a queue must never write to the CPOE order or item collections',
    )
  }

  /* กดซ้ำ = ไม่รีเซ็ตเวลาเรียกเดิม ไม่งั้นลำดับใน My Room สลับทุกครั้งที่กด */
  {
    const captures = []
    const out = await Process(
      { action: 'queue_call', visit_id: VISIT_1 },
      userInfo,
      makeApp(captures, {
        rows: [queueRowRaw()],
        queueDocs: [{ _id: 'QUEUE-1', visit_id: VISIT_1, called_at: '2026-09-08 08:00:00', called_by: { id: 'USER-9', name: 'พี่เอ' } }],
      }),
    )
    assert.strictEqual(out.success, true)
    assert.strictEqual(out.data.already_called, true)
    assert.strictEqual(out.data.called_at, '2026-09-08 08:00:00', 'เวลาเรียกเดิมต้องอยู่เหมือนเดิม')
    assert(!captures.some(c => ['insertOne', 'updateOne'].includes(c.type)), 'and nothing is rewritten')
  }

  /* เรียกคิวว่างเข้าห้องไม่ได้ */
  {
    const out = await Process({ action: 'queue_call', visit_id: VISIT_1 }, userInfo, makeApp([], { rows: [] }))
    assert.strictEqual(out.success, false)
    assert.strictEqual(out.error, 'nothing_to_call')
  }

  /* ── เรียกคิวได้เฉพาะ visit ของวันนี้ ─────────────────────────────────────
     กันไม่ให้เรียก visit เก่าเข้าห้องผ่านการยิงตรง แม้หน้าจอจะไม่มีปุ่มให้กดแล้ว */
  {
    const captures = []
    await Process({ action: 'queue_call', visit_id: VISIT_1 }, userInfo, makeApp(captures, { rows: [queueRowRaw()] }))
    const pending = captures.filter(c => c.type === 'aggregate').pop()
    assert(
      JSON.stringify(pending.pipeline).includes('"visit_day":"2026-09-08"'),
      'calling a queue in also checks the visit is today',
    )
  }

  /* ── deep link: action list + visit_id ───────────────────────────────── */
  {
    const captures = []
    const out = await Process({ action: 'list', visit_id: VISIT_1 }, userInfo, makeApp(captures, { listRows: [] }))
    assert.strictEqual(out.success, true, out.message)
    const provider = captures.filter(c => c.type === 'dbFindAll' && c.provider.from === 'zdata_cpoe_order_item')[0]
    assert(provider, 'the list still goes through the same provider as before')
    /* เทียบเป็นสตริงทั้งสองฝั่ง (เปลี่ยน 2026-09-08) — ของเดิมยัด ObjectId ลงไปตรง ๆ
       ใบที่เก็บ xparentx เป็น string จึงไม่ match แล้วหน้าจอขึ้น "ไม่พบใบสั่ง"
       ทั้งที่ใบมีอยู่จริง · ยังเป็น exact match เหมือนเดิม ไม่ใช่ regex */
    assert(
      JSON.stringify(provider.provider).includes(
        '"$expr":{"$eq":[{"$toString":"$order.xparentx"},"' + VISIT_1 + '"]}',
      ),
      'the deep link filters by exact visit id and survives either id type',
    )
  }
  {
    const out = await Process({ action: 'list', visit_id: 'nope' }, userInfo, makeApp([]))
    assert.strictEqual(out.error, 'invalid_visit_id')
  }
  /* regression — ไม่ส่ง visit_id ต้องได้ query เดิมเป๊ะ ไม่มี order.xparentx โผล่มา */
  {
    const captures = []
    await Process({ action: 'list' }, userInfo, makeApp(captures, { listRows: [] }))
    const provider = captures.filter(c => c.type === 'dbFindAll' && c.provider.from === 'zdata_cpoe_order_item')[0]
    /* projection เดิมใช้ {$toString:'$order.xparentx'} อยู่แล้วสองที่ (visit.visit_id
       และ emr_context.visit_id) จึงต้องเช็คเฉพาะ "เงื่อนไขกรอง" ไม่ใช่คำดิบ
       ไม่งั้นเทสจะแดงทั้งที่ยังไม่มีตัวกรองใด ๆ เพิ่มเข้ามา */
    assert(
      !JSON.stringify(provider.provider).includes('"$expr":{"$eq":[{"$toString":"$order.xparentx"}'),
      'callers that never heard of the queue must get exactly the old query',
    )
  }

  /* ── แท็บที่ 4 · Completed (สำเร็จ/ส่งต่อคิว) ─────────────────────────────
     ผู้ใช้ระบุ 2026-09-08 ว่า "คนละความหมายกับผลออกครบ" ⇒ เป็นสถานะของคิวล้วน ๆ */
  {
    const captures = []
    const out = await Process(
      { action: 'queue', bucket: 'done' },
      userInfo,
      makeApp(captures, { rows: [queueRowRaw({ queue_doc: {
        called_at: '2026-09-08 09:00:00',
        done_at: '2026-09-08 09:40:00',
        done_by: { id: 'USER-9', name: 'พี่เอ' },
      } })] }),
    )
    assert.strictEqual(out.data.bucket, 'done')
    assert.strictEqual(out.data.rows[0].done_at, '2026-09-08 09:40:00')
    assert.deepStrictEqual(out.data.rows[0].done_by, { id: 'USER-9', name: 'พี่เอ' })

    const text = JSON.stringify(captures.filter(c => c.type === 'aggregate' && !c.pipeline.some(st => st.$count))[0].pipeline)
    assert(text.includes('"queue_doc.done_at":{"$nin":[null,""]}'), 'Completed holds only closed queues')
    assert(text.includes('"$sort":{"queue_doc.done_at":-1,"vn":1}'), 'newest first, like the EMR Completed tab')
    /* 🔴 ห้ามผูกกับสถานะผลอ่าน — ไม่งั้นพอ RIS ส่งผลกลับมา แถวจะหายจาก Completed
       ทั้งที่คิวปิดไปแล้ว ซึ่งเป็นคนละความหมายกันตามที่ผู้ใช้ย้ำ */
    assert(text.includes('"resulted"') && text.includes('"cancelled"'), 'Completed keeps rows in every item status')
  }

  /* ── ข้อมูลสำหรับปุ่มส่งต่อ ─────────────────────────────────────────────── */
  {
    const out = await Process({ action: 'queue', bucket: 'room' }, userInfo, makeApp([], {
      rows: [queueRowRaw({
        queue_doc: { called_at: '2026-09-08 09:00:00' },
        visit_tran: {
          _id: 'TRAN-1',
          vtran_status: 'in_progress',
          unit_to: { value: 'm0901', label: 'งานรังสีวิทยา' },
          unit_from: { value: '19.p', label: 'คลินิกวัคซีน' },
          visit_priority: '10',
          consult_info: { clinic: 'm0500', reason: 'ขอความเห็น' },
        },
      })],
    }))
    const row = out.data.rows[0]
    assert.strictEqual(row.tran_id, 'TRAN-1', 'the forward form takes the visit_tran id, not the visit id')
    assert.strictEqual(row.vtran_status, 'in_progress')
    assert.deepStrictEqual(row.unit_to, { value: 'm0901', label: 'งานรังสีวิทยา' })
    assert.deepStrictEqual(row.unit_from, { value: '19.p', label: 'คลินิกวัคซีน' })
    assert.strictEqual(row.visit_priority, '10')
    assert.deepStrictEqual(row.consult_info, { clinic: 'm0500', reason: 'ขอความเห็น' })
  }
  /* ไม่มีแถวใน visit_tran = ส่งต่อไม่ได้ · ต้องคืนค่าว่างให้ปุ่มปิดตัวเองพร้อมเหตุผล
     ไม่ใช่ปล่อยให้กดแล้วเปิดฟอร์มที่ไม่มี tran_id */
  {
    const out = await Process({ action: 'queue', bucket: 'room' }, userInfo, makeApp([], {
      rows: [queueRowRaw({ queue_doc: { called_at: '2026-09-08 09:00:00' } })],
    }))
    assert.strictEqual(out.data.rows[0].tran_id, '')
  }

  /* ── ปิดคิว ──────────────────────────────────────────────────────────────── */
  {
    const out = await Process({ action: 'queue_done', visit_id: 'nope' }, userInfo, makeApp([]))
    assert.strictEqual(out.error, 'invalid_visit_id')
  }
  /* ยังไม่เคยเรียกเข้าห้อง = ปิดคิวไม่ได้ ห้ามข้ามจาก Unit Queue ไป Completed */
  {
    const out = await Process({ action: 'queue_done', visit_id: VISIT_1 }, userInfo, makeApp([], { queueDocs: [] }))
    assert.strictEqual(out.error, 'not_called')
  }
  {
    const out = await Process({ action: 'queue_done', visit_id: VISIT_1 }, userInfo, makeApp([], {
      queueDocs: [{ _id: 'QUEUE-1', visit_id: VISIT_1 }],
    }))
    assert.strictEqual(out.error, 'not_called', 'a queue document without called_at is not in a room either')
  }
  {
    const captures = []
    const out = await Process({ action: 'queue_done', visit_id: VISIT_1 }, userInfo, makeApp(captures, {
      queueDocs: [{ _id: 'QUEUE-1', visit_id: VISIT_1, called_at: '2026-09-08 09:00:00' }],
    }))
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.data.already_done, false)
    assert.strictEqual(out.data.done_at, NOW)

    const update = captures.filter(c => c.type === 'updateOne')[0]
    assert.strictEqual(update.collection, 'zdata_xray_queue')
    assert.strictEqual(update.update.$set.done_at, NOW)
    assert.deepStrictEqual(update.update.$set.done_by, { id: 'USER-1', name: 'ณิชดา รังสี' })
    assert.strictEqual(update.update.$set.done_reason, 'forwarded')
    /* 🔴 ปิดคิวต้องไม่แตะใบสั่งหรือรายการตรวจเลย — นี่คือเหตุผลที่แท็บนี้
       มีความหมายต่างจาก "ออกผลครบ" ได้ตั้งแต่แรก */
    const written = captures.filter(c => ['insertOne', 'updateOne'].includes(c.type))
    assert.deepStrictEqual(
      Array.from(new Set(written.map(c => c.collection))),
      ['zdata_xray_queue'],
      'closing a queue must never write to the CPOE order or item collections',
    )
  }
  /* กดซ้ำ = เวลาเดิมอยู่เหมือนเดิม ลำดับใน Completed จะได้ไม่สลับ */
  {
    const captures = []
    const out = await Process({ action: 'queue_done', visit_id: VISIT_1 }, userInfo, makeApp(captures, {
      queueDocs: [{ _id: 'QUEUE-1', visit_id: VISIT_1, called_at: '2026-09-08 09:00:00', done_at: '2026-09-08 09:40:00' }],
    }))
    assert.strictEqual(out.data.already_done, true)
    assert.strictEqual(out.data.done_at, '2026-09-08 09:40:00')
    assert(!captures.some(c => ['insertOne', 'updateOne'].includes(c.type)), 'and nothing is rewritten')
  }

  /* ── คิวต้องรีทุกวันเหมือนตาราง (ผู้ใช้ทักท้วง 2026-09-08) ────────────────
     ของเดิมไม่มีตัวกรองวันเลย ⇒ ใบเมื่อวานค้างรออยู่หน้าจอ (เห็นจริง "119 ชม.") */
  {
    /* 🔴 แกนคือ "วันของ visit" ไม่ใช่เวลาที่สั่ง order (แก้ 2026-09-08 รอบสอง)
       ผู้ใช้เจอ VN เก่าโผล่ในคิววันนี้เพราะใบสั่งของมันถูกแตะวันนี้
       การมีคิว = คนไข้มายืนรอวันนี้ ซึ่งเป็นคุณสมบัติของ visit ไม่ใช่ของใบสั่ง */
    for (const bucket of ['unit', 'room', 'done']) {
      const captures = []
      await Process({ action: 'queue', bucket: bucket }, userInfo, makeApp(captures, { rows: [] }))
      const pipeline = captures.filter(c => c.type === 'aggregate' && !c.pipeline.some(st => st.$count))[0].pipeline
      const text = JSON.stringify(pipeline)
      assert(text.includes('"$ifNull":["$visit_date",""]'), bucket + ' keys its day off the visit')
      assert(text.includes('"visit_day":"2026-09-08"'), bucket + ' shows only today')
      assert(
        !text.includes('"queue_day"'),
        bucket + ' must not fall back to the old order-time axis',
      )
    }
    /* นับก็ต้องกรองวันเหมือนกัน ไม่งั้น badge จะไม่ตรงกับจำนวนแถวที่เห็น */
    const captures = []
    await Process({ action: 'queue' }, userInfo, makeApp(captures, { rows: [] }))
    const countPipe = captures.filter(c => c.type === 'aggregate' && c.pipeline.some(st => st.$count))[0].pipeline
    assert(JSON.stringify(countPipe).includes('"visit_day"'), 'the counts follow the same day filter')
  }

  /* ── เลขคิวจริงมี prefix อยู่ข้างหน้า (ผู้ใช้ทักท้วง 2026-09-08) ──────────── */
  {
    const withLabel = await Process({ action: 'queue' }, userInfo, makeApp([], {
      rows: [queueRowRaw({ visit_tran: { _id: 'TRAN-1', queue_label: 'D002', qtype: 'D', queue_no: 2 } })],
    }))
    assert.strictEqual(withLabel.data.rows[0].queue_label, 'D002', 'the ready-made label wins')

    /* visit เก่ากว่า ~2026-07-27 ไม่มี queue_label — ต้องประกอบเองจาก qtype + queue_no
       ไม่งั้นคิวเก่าจะไม่มีเลขให้เจ้าหน้าที่เรียก */
    const built = await Process({ action: 'queue' }, userInfo, makeApp([], {
      rows: [queueRowRaw({ visit_tran: { _id: 'TRAN-1', qtype: 'D', queue_no: 7 } })],
    }))
    assert.strictEqual(built.data.rows[0].queue_label, 'D007', 'zero-padded like the EMR queue label')

    const none = await Process({ action: 'queue' }, userInfo, makeApp([], { rows: [queueRowRaw()] }))
    assert.strictEqual(none.data.rows[0].queue_label, '', 'no visit_tran row means no queue number')
  }

  /* ── คำนำหน้าต้องเป็นชื่อ ไม่ใช่รหัส ──────────────────────────────────────
     เห็นจริงบนจอ 2026-09-08: "003 ศุภัทร มณีวงศ์" เพราะ valueText คืนรหัสของ coded field */
  {
    const out = await Process({ action: 'queue' }, userInfo, makeApp([], {
      rows: [queueRowRaw({ prename: { value: '003', label: 'นาย' }, first_name: 'ศุภัทร', last_name: 'มณีวงศ์' })],
    }))
    assert.strictEqual(out.data.rows[0].patient_name, 'นาย ศุภัทร มณีวงศ์')
  }

  /* ── hybrid: ใบจากคลินิกอื่นต้องเรียกคิวก่อนถึงโผล่ในตาราง X-ray ──────────
     ผู้ใช้สั่ง 2026-09-08 · ตัวแยกคือ "ยูนิตต้นทางที่สั่ง" (m0900/m0901/CT = สั่งเอง) */
  {
    const captures = []
    await Process({ action: 'list' }, userInfo, makeApp(captures, { listRows: [] }))
    const text = JSON.stringify(
      captures.filter(c => c.type === 'dbFindAll' && c.provider.from === 'zdata_cpoe_order_item')[0].provider,
    )
    /* ยูนิตต้นทางต้องถูกอ่านและส่งกลับไปให้ตรวจได้จากหน้าจอ ไม่ต้องเปิด DB */
    assert(text.includes('"origin_unit_code"'), 'the list resolves the ordering unit')
    assert(text.includes('"origin_unit":1'), 'and returns it on every order row')
    /* ประตูคิว: ไม่รู้ที่มา หรือ ต้นทางเป็นรังสี หรือ เรียกคิวแล้ว = แสดง */
    assert(text.includes('"_called_queue"'), 'the gate joins the queue by visit')
    assert(text.includes('"$in":[{"$ifNull":["$origin_unit",""]},["M0900","M0901","CT"]]'),
      'orders raised by radiology itself skip the queue entirely')
    assert(text.includes('"$eq":[{"$ifNull":["$origin_unit",""]},""]'),
      'an unreadable origin must fail open, never hide the order')
    /* เทียบ visit เป็นสตริงทั้งสองฝั่ง — xparentx เป็น ObjectId หรือ string ก็ได้ */
    assert(text.includes('"$eq":[{"$toString":"$visit_id"},{"$toString":"$$visit_id"}]'))
    /* นับเฉพาะคิวที่ "เรียกแล้ว" เท่านั้น เอกสารคิวเปล่าไม่ปลดล็อกให้แสดง */
    assert(text.includes('"$ne":[{"$ifNull":["$called_at",""]},""]'))
  }

  /* ── Unit Queue ต้องไม่รับใบที่ห้องรังสีสั่งเอง ("ไม่โผล่เลย") ────────────── */
  {
    const captures = []
    await Process({ action: 'queue' }, userInfo, makeApp(captures, { rows: [] }))
    const text = JSON.stringify(
      captures.filter(c => c.type === 'aggregate' && !c.pipeline.some(st => st.$count))[0].pipeline,
    )
    assert(text.includes('"origin_units"'), 'the queue collects the ordering units of the visit')
    assert(
      text.includes('"$in":["$$unit",["M0900","M0901","CT"]]'),
      'and drops visits whose orders are all self-raised',
    )
  }
  /* My Room / Completed ไม่ต้องกรองซ้ำ — ผ่านคิวมาแล้ว ไม่ว่าต้นทางเป็นใคร */
  {
    for (const bucket of ['room', 'done']) {
      const captures = []
      await Process({ action: 'queue', bucket: bucket }, userInfo, makeApp(captures, { rows: [] }))
      const text = JSON.stringify(
        captures.filter(c => c.type === 'aggregate' && !c.pipeline.some(st => st.$count))[0].pipeline,
      )
      assert(!text.includes('"$in":["$$unit"'), bucket + ' must not re-filter by origin')
    }
  }

  /* action ที่ไม่รู้จักยังต้องถูกปฏิเสธเหมือนเดิม */
  {
    const out = await Process({ action: 'queue_uncall' }, userInfo, makeApp([]))
    assert.strictEqual(out.success, false)
    assert.strictEqual(out.message, 'ไม่รองรับ action นี้')
  }

  console.log('X-ray queue API tests passed')
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
