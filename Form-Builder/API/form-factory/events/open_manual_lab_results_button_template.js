/*
 * Replace the current placeholder s.viewResult in the Lab resulted component.
 * Ready-to-paste handler for the Lab resulted component.
 */

const PREPARE_MANUAL_RESULT_PROCESS_ID = '6a852b0cf851000f28e44a46'
const RESULT_REPORT_MANUAL_UI_FORM_ID = '6a852aa3f851000f28e44a44'

s.viewResult = row => {
  const form = field.getFormRef && field.getFormRef()
  const api = (form && form.userState) || field.globalUserState
  const statusRecordId = s.text(row && (row._id || row.id)).trim()

  if (!statusRecordId) {
    field.notify('ไม่พบ record id ของ Lab Status', 'warning', 3500)
    return
  }
  if (!api || typeof api.runProcess !== 'function') {
    field.notify('ไม่พบ API connector', 'error', 3500)
    return
  }
  if (!form || typeof form.openForm !== 'function') {
    field.notify('ไม่พบ Form connector', 'error', 3500)
    return
  }
  if (!/^[a-f\d]{24}$/i.test(PREPARE_MANUAL_RESULT_PROCESS_ID)) {
    field.notify('ยังไม่ได้กำหนด Prepare Result API ID', 'warning', 4000)
    return
  }

  api.runProcess(
    PREPARE_MANUAL_RESULT_PROCESS_ID,
    { status_record_id: statusRecordId },
    out => {
      const response = (out && out.data) || out || {}
      if (response.success === false) {
        field.notify(response.message || 'เตรียมรายการผลตรวจไม่สำเร็จ', 'error', 4500)
        return
      }
      const prepared = response.data || response
      const params = {
        order_status_id: prepared.order_status_id || statusRecordId,
        lab_no: prepared.lab_no || s.text(row && (row.order_number || row.lab_no)),
        patient_hn: prepared.patient_hn || s.text(row && row.patient_hn),
        patient_name: prepared.patient_name || s.text(row && row.patient_name),
        visit_id: prepared.visit_id || s.text(row && (row.visit_vn || row.visit_id)),
        lab_section: prepared.lab_section || s.text(row && (row.section_name || row.section_code)),
        specimen: prepared.specimen || s.specimens(row),
      }

      form.openForm(
        RESULT_REPORT_MANUAL_UI_FORM_ID,
        null,
        null,
        params,
        {
          params,
          popupType: 'dialog',
          backdrop: false,
        }
      )
    },
    error => field.notify(
      'เตรียมรายการผลตรวจไม่สำเร็จ: ' + String((error && error.message) || error || ''),
      'error',
      4500
    )
  )
}
