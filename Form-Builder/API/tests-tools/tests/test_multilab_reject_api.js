const fs = require('fs')
const assert = require('assert')

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const source = fs.readFileSync('Lab_Bio_Reject_Specimen_API.js', 'utf8')
const runProcess = new AsyncFunction('params', 'userInfo', 'app', source)

const clone = value => JSON.parse(JSON.stringify(value))

const makeRuntime = ({ status, rejection }) => {
  const statusRows = { [status._id]: clone(status) }
  const rejectionRows = rejection ? { [rejection._id]: clone(rejection) } : {}
  const updates = []
  const app = {
    isAuth: () => true,
    dbObjectId: value => String(value),
    curDate: () => '2026-08-17 03:00:00',
    dbFindById: async (id, collection) => {
      const rows = collection === 'zdata_specimen_collection_status' ? statusRows : rejectionRows
      return { success: true, reply: { data: rows[String(id)] || null } }
    },
    dbUpdate: async (patch, collection, userInfo, where) => {
      const rows = collection === 'zdata_specimen_collection_status' ? statusRows : rejectionRows
      const id = String(where._id)
      if (!rows[id]) return { success: false, message: 'record missing' }
      Object.assign(rows[id], clone(patch))
      updates.push({ collection, id, patch: clone(patch) })
      return { success: true }
    }
  }
  return { app, statusRows, rejectionRows, updates }
}

const userInfo = { roles: ['lab'], username: 'Earn_admin' }

const rejectCase = async ({ statusId, rejectionId, orderNumber, sectionCode }) => {
  const status = {
    _id: statusId,
    order_number: orderNumber,
    section_code: sectionCode,
    section_name: sectionCode === '10' ? 'Biochemistry' : 'Biomolecular and Genetics',
    specimen_status: 'waiting',
    work_status: ''
  }
  const rejection = {
    _id: rejectionId,
    source_order_id: statusId,
    lab_section: sectionCode,
    reject_reason_code: 'specimen_insufficient',
    reject_reason_detail: 'sample test'
  }
  const runtime = makeRuntime({ status, rejection })
  const result = await runProcess({
    source_order_id: statusId,
    rejection_record_id: rejectionId,
    order_number: orderNumber,
    section_code: sectionCode
  }, userInfo, runtime.app)
  assert.equal(result.success, true)
  assert.equal(runtime.statusRows[statusId].work_status, 'rejected')
  assert.equal(runtime.statusRows[statusId].reject_reason_code, 'specimen_insufficient')
  assert.equal(runtime.rejectionRows[rejectionId].rejection_status, 'applied')
  return runtime
}

async function main () {
  await rejectCase({
    statusId: '6a820e21ebe955d6977ec9d1',
    rejectionId: '6a830000ebe955d6977ec001',
    orderNumber: '1069000017',
    sectionCode: '10'
  })

  await rejectCase({
    statusId: '6a8210b7ebe955d6977ec9d3',
    rejectionId: '6a830000ebe955d6977ec002',
    orderNumber: '7069000009',
    sectionCode: '70'
  })

  const mismatch = makeRuntime({
    status: { _id: '6a8210b7ebe955d6977ec9d3', order_number: '7069000009', section_code: '70', work_status: '' },
    rejection: { _id: '6a830000ebe955d6977ec003', source_order_id: '6a8210b7ebe955d6977ec9d3', reject_reason_code: 'other' }
  })
  const mismatchResult = await runProcess({
    source_order_id: '6a8210b7ebe955d6977ec9d3',
    rejection_record_id: '6a830000ebe955d6977ec003',
    order_number: '7069000009',
    section_code: '10'
  }, userInfo, mismatch.app)
  assert.equal(mismatchResult.success, false)
  assert.match(mismatchResult.message, /ห้อง Lab ไม่ตรง/)
  assert.equal(mismatch.updates.length, 0)

  const blocked = makeRuntime({
    status: { _id: '6a820e21ebe955d6977ec9d1', order_number: '1069000017', section_code: '10', work_status: 'processing' },
    rejection: { _id: '6a830000ebe955d6977ec004', source_order_id: '6a820e21ebe955d6977ec9d1', reject_reason_code: 'other' }
  })
  const blockedResult = await runProcess({
    source_order_id: '6a820e21ebe955d6977ec9d1',
    rejection_record_id: '6a830000ebe955d6977ec004',
    order_number: '1069000017',
    section_code: '10'
  }, userInfo, blocked.app)
  assert.equal(blockedResult.success, false)
  assert.equal(blocked.updates.length, 0)

  const recheck = makeRuntime({
    status: { _id: '6a820e21ebe955d6977ec9d1', order_number: '1069000017', section_code: '10', work_status: 'rejected', received_at: '2026-08-16 18:07:20' }
  })
  const recheckResult = await runProcess({
    source_order_id: '6a820e21ebe955d6977ec9d1',
    action: 'recheck',
    order_number: '1069000017',
    section_code: '10'
  }, userInfo, recheck.app)
  assert.equal(recheckResult.success, true)
  assert.equal(recheck.statusRows['6a820e21ebe955d6977ec9d1'].work_status, 'waiting_receive')
  assert.equal(recheck.statusRows['6a820e21ebe955d6977ec9d1'].received_at, '2026-08-17 03:00:00')
  assert.equal(recheck.statusRows['6a820e21ebe955d6977ec9d1'].received_by, 'Earn_admin')
  assert.equal(recheck.statusRows['6a820e21ebe955d6977ec9d1'].rechecked_at, '2026-08-17 03:00:00')
  assert.equal(recheck.statusRows['6a820e21ebe955d6977ec9d1'].rechecked_by, 'Earn_admin')
  assert.equal(recheckResult.data.work_status, 'waiting_receive')
  assert.equal(recheckResult.data.received_at, '2026-08-17 03:00:00')

  const invalidResult = await runProcess({ source_order_id: '[object Object]' }, userInfo, recheck.app)
  assert.equal(invalidResult.success, false)

  process.stdout.write('PASS: reject section 10, reject section 70, room guard, state guard, recheck, invalid id\n')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
