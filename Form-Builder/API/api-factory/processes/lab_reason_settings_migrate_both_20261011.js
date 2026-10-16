/*
 * One-time UAT migration for LAB Reject/Cancel Reason Settings.
 *
 * preview: read-only validation of the expected 69 imported rows + 138 paired
 * duplicates. execute: convert only those 69 imported rows to BOTH and retire
 * only the verified paired duplicates. Re-running is idempotent.
 */

const COLLECTION = 'zdata_zdata_lab_reject_cancel_reason'
const CONFIRM_TOKEN = 'MIGRATE_207_TO_69_BOTH'
const action = String(params && params.action || 'preview').trim().toLowerCase()
const text = value => value == null ? '' : String(value).trim()
const rowId = row => text(row && row._id)
const now = typeof app.curDate === 'function' ? app.curDate('YYYY-MM-DD HH:mm:ss') : new Date().toISOString()
const actor = text(userInfo && (userInfo.username || userInfo.account && (userInfo.account.username || userInfo.account.name)))

const readActive = async () => {
  const found = await app.dbFindAll({
    from: COLLECTION,
    nosql: {
      type: 'query',
      collection: COLLECTION,
      query: { xrstatx: { $nin: [0, 3] } },
      projection: {
        reason_type: 1,
        section_code: 1,
        reason_code: 1,
        reason_text: 1,
        display_order: 1,
        is_active: 1,
        internal_note: 1,
        xrstatx: 1
      },
      limit: 1000
    }
  }, false, false)
  if (!found || found.success === false || !found.reply || !Array.isArray(found.reply.data)) {
    throw new Error('อ่าน LAB Reject/Cancel Reason Settings ไม่สำเร็จ')
  }
  return found.reply.data
}

const inspect = rows => {
  const imported = []
  const paired = []
  const other = []
  rows.forEach(row => {
    const note = text(row && row.internal_note)
    if (note.indexOf('นำเข้าจาก Master โรงพยาบาล') === 0) imported.push(row)
    else if (note.indexOf('paired reason set') >= 0) paired.push(row)
    else other.push(row)
  })

  const issues = []
  const importedByText = {}
  imported.forEach(row => {
    const reasonText = text(row && row.reason_text)
    if (!reasonText) {
      issues.push('imported_blank_text:' + rowId(row))
      return
    }
    if (importedByText[reasonText]) issues.push('imported_duplicate_text:' + reasonText)
    importedByText[reasonText] = row
  })

  const pairedBySource = {}
  paired.forEach(row => {
    const match = text(row && row.internal_note).match(/source_row=(\d+)/)
    const sourceRow = match ? Number(match[1]) : 0
    if (!Number.isInteger(sourceRow) || sourceRow < 1 || sourceRow > 69) {
      issues.push('paired_invalid_source_row:' + rowId(row))
      return
    }
    if (!pairedBySource[sourceRow]) pairedBySource[sourceRow] = []
    pairedBySource[sourceRow].push(row)
  })

  const sourceByRow = {}
  const matchedImportedIds = {}
  for (let sourceRow = 1; sourceRow <= 69; sourceRow += 1) {
    const copies = pairedBySource[sourceRow] || []
    if (copies.length !== 2) issues.push('paired_count_' + sourceRow + ':' + copies.length)
    if (copies.length === 2) {
      const copyTexts = Array.from(new Set(copies.map(row => text(row && row.reason_text))))
      const source = copyTexts.length === 1 ? importedByText[copyTexts[0]] : null
      const expectedCodes = [
        'LABR-' + String(17 + sourceRow).padStart(5, '0'),
        'LABR-' + String(86 + sourceRow).padStart(5, '0')
      ].sort().join(',')
      const types = copies.map(row => text(row && row.reason_type).toUpperCase()).sort().join(',')
      if (types !== 'ORDER_CANCEL,SPECIMEN_REJECT') issues.push('paired_types_' + sourceRow + ':' + types)
      if (copies.map(row => text(row && row.reason_code)).sort().join(',') !== expectedCodes) issues.push('paired_codes_' + sourceRow)
      if (copyTexts.length !== 1) issues.push('paired_text_mismatch_' + sourceRow)
      else if (!source) issues.push('missing_imported_text_' + sourceRow)
      else {
        sourceByRow[sourceRow] = source
        if (matchedImportedIds[rowId(source)]) issues.push('imported_reused_' + sourceRow)
        matchedImportedIds[rowId(source)] = true
      }
    }
  }

  if (rows.length !== 207) issues.push('active_count:' + rows.length)
  if (imported.length !== 69) issues.push('imported_count:' + imported.length)
  if (paired.length !== 138) issues.push('paired_count:' + paired.length)
  if (other.length) issues.push('unexpected_active_rows:' + other.length)
  if (Object.keys(matchedImportedIds).length !== 69) issues.push('matched_imported_count:' + Object.keys(matchedImportedIds).length)

  return {
    ready: issues.length === 0,
    active_count: rows.length,
    imported_count: imported.length,
    paired_duplicate_count: paired.length,
    unexpected_count: other.length,
    issues,
    imported,
    paired,
    sourceByRow
  }
}

const publicSummary = state => ({
  ready: state.ready,
  active_count: state.active_count,
  imported_count: state.imported_count,
  paired_duplicate_count: state.paired_duplicate_count,
  unexpected_count: state.unexpected_count,
  issues: state.issues
})

let beforeRows
try {
  beforeRows = await readActive()
} catch (error) {
  return { success: false, message: text(error && error.message || error) }
}
const before = inspect(beforeRows)

if (action === 'preview') {
  return { success: true, action: 'preview', data: publicSummary(before) }
}
if (action !== 'execute') {
  return { success: false, message: 'รองรับเฉพาะ action preview หรือ execute' }
}
if (text(params && params.confirm_token) !== CONFIRM_TOKEN) {
  return { success: false, message: 'confirm_token ไม่ถูกต้อง' }
}
if (!before.ready) {
  return { success: false, message: 'ข้อมูลไม่ตรงชุด 207 รายการที่ตรวจไว้ จึงไม่ทำ migration', data: publicSummary(before) }
}

const jobs = []
for (let sourceRow = 1; sourceRow <= 69; sourceRow += 1) {
  const row = before.sourceByRow[sourceRow]
  const reasonCode = 'LABR-' + String(17 + sourceRow).padStart(5, '0')
  const note = text(row.internal_note)
  jobs.push({
    id: rowId(row),
    patch: {
      reason_type: 'BOTH',
      section_code: 'ALL',
      reason_code: reasonCode,
      display_order: 100 + sourceRow,
      is_active: true,
      internal_note: note + ' | migrated_to=BOTH 2026-10-11',
      reason_scope_migrated_at: now,
      reason_scope_migrated_by: actor
    }
  })
}
before.paired.forEach(row => {
  jobs.push({
    id: rowId(row),
    patch: {
      xrstatx: 3,
      migration_retired: true,
      migration_retired_at: now,
      migration_retired_by: actor,
      migration_reason: 'replaced_by_imported_BOTH_master'
    }
  })
})

const failures = []
for (let offset = 0; offset < jobs.length; offset += 15) {
  const batch = jobs.slice(offset, offset + 15)
  const results = await Promise.all(batch.map(async job => {
    if (!/^[a-f0-9]{24}$/i.test(job.id)) return { success: false, id: job.id, message: 'invalid_id' }
    try {
      const saved = await app.dbUpdate(job.patch, COLLECTION, userInfo, { _id: app.dbObjectId(job.id) })
      return saved && saved.success !== false ? { success: true, id: job.id } : { success: false, id: job.id, message: text(saved && saved.message) }
    } catch (error) {
      return { success: false, id: job.id, message: text(error && error.message || error) }
    }
  }))
  results.filter(result => !result.success).forEach(result => failures.push(result))
  if (failures.length) break
}

if (failures.length) {
  return { success: false, message: 'migration หยุดเพราะบันทึกบางรายการไม่สำเร็จ', failures: failures.slice(0, 10) }
}

let afterRows
try {
  afterRows = await readActive()
} catch (error) {
  return { success: false, message: 'บันทึกแล้ว แต่ตรวจผลหลัง migration ไม่สำเร็จ: ' + text(error && error.message || error) }
}
const allBoth = afterRows.every(row => text(row.reason_type).toUpperCase() === 'BOTH')
const allActive = afterRows.every(row => row.is_active === true || row.is_active === 1 || text(row.is_active).toLowerCase() === 'true')
const codes = afterRows.map(row => text(row.reason_code))
const uniqueCodes = Array.from(new Set(codes))
const verified = afterRows.length === 69 && allBoth && allActive && uniqueCodes.length === 69 &&
  codes.includes('LABR-00018') && codes.includes('LABR-00086')

return {
  success: verified,
  action: 'execute',
  message: verified ? 'migrated 207 active rows to 69 shared BOTH rows' : 'migration completed but post-check failed',
  data: {
    before: publicSummary(before),
    after_active_count: afterRows.length,
    after_all_both: allBoth,
    after_all_active: allActive,
    after_unique_code_count: uniqueCodes.length,
    retired_duplicate_count: before.paired.length,
    updated_imported_count: before.imported.length
  }
}
