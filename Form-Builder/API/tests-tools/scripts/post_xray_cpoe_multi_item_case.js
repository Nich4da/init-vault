/*
 * เตรียม/ยิงคำขอ X-ray CPOE แบบ 1 Order หลาย item ไปที่ dispatch Process
 * ตัว Process จะอ่านข้อมูลผู้ป่วย/visit/order จริงจาก DB แล้วสร้าง flat RIS payload
 * แยกหนึ่งชุดต่อ item; สคริปต์นี้ไม่เก็บ PHI และไม่ยิงจริงถ้าไม่มี flag ยืนยันสองชั้น
 *
 * Dry-run (พิมพ์ request เท่านั้น):
 *   node post_xray_cpoe_multi_item_case.js \
 *     --order-id <24-hex> --item-id <24-hex> --item-id <24-hex>
 *
 * ยิงจริง (เปลี่ยน DB + ส่ง RIS):
 *   XRAY_CPOE_DISPATCH_URL='https://.../api/v1/process/6a967029422c1ca959829edc' \
 *   XRAY_CPOE_AUTH_TOKEN='<current user bearer token>' \
 *   node post_xray_cpoe_multi_item_case.js ... --send --confirm-write
 */

const args = process.argv.slice(2)

const valuesOf = flag => {
  const values = []
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === flag && args[i + 1]) values.push(args[i + 1])
  }
  return values
}

const valueOf = flag => valuesOf(flag)[0] || ''
const has = flag => args.includes(flag)
const isObjectId = value => /^[a-f0-9]{24}$/i.test(String(value || '').trim())

const orderId = valueOf('--order-id').trim()
const itemIds = [...new Set(valuesOf('--item-id').map(value => value.trim()))]

if (!isObjectId(orderId)) {
  console.error('ต้องระบุ --order-id เป็น ObjectId 24 ตัว')
  process.exit(1)
}
if (!itemIds.length || itemIds.some(id => !isObjectId(id))) {
  console.error('ต้องระบุ --item-id อย่างน้อย 1 ค่า และทุกค่าต้องเป็น ObjectId 24 ตัว')
  process.exit(1)
}
if (itemIds.length > 50) {
  console.error('รองรับไม่เกิน 50 รายการต่อคำขอ')
  process.exit(1)
}

const body = {
  params: {
    order_id: orderId,
    item_ids: itemIds,
  },
}

console.log('# X-ray CPOE multi-item dispatch · ' + itemIds.length + ' item(s)')
console.log(JSON.stringify(body, null, 2))

if (!has('--send')) {
  console.log('\nDRY RUN: ยังไม่เขียน DB และยังไม่ส่ง RIS')
  console.log('เติม --send --confirm-write เฉพาะเมื่อพร้อมทดสอบจริง')
  process.exit(0)
}

if (!has('--confirm-write')) {
  console.error('\nยกเลิก: --send ต้องใช้คู่กับ --confirm-write เพราะคำขอนี้ออก Accession เปลี่ยนสถานะ และส่ง RIS จริง')
  process.exit(1)
}

const url = String(process.env.XRAY_CPOE_DISPATCH_URL || '').trim()
const token = String(process.env.XRAY_CPOE_AUTH_TOKEN || '').trim()
if (!url || !token) {
  console.error('\nต้องตั้ง XRAY_CPOE_DISPATCH_URL และ XRAY_CPOE_AUTH_TOKEN ก่อนยิงจริง')
  process.exit(1)
}

;(async () => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify(body),
  })
  const responseText = await response.text()
  console.log('\n# HTTP ' + response.status)
  try {
    console.log(JSON.stringify(JSON.parse(responseText), null, 2))
  } catch (error) {
    console.log(responseText)
  }
  if (!response.ok) process.exitCode = 1
})().catch(error => {
  console.error('ยิงไม่สำเร็จ: ' + ((error && error.message) || error))
  process.exitCode = 1
})
