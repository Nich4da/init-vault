const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const formPath = path.join(root, 'Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json')
const outputPath = process.env.LAB_WORKLIST_OUTPUT || formPath
const defaultOrderRequestReportId = '6a977ac8422c1ca959829f97'
const orderRequestReportId = String(
  process.env.LAB_ORDER_REQUEST_REPORT_ID === undefined
    ? defaultOrderRequestReportId
    : process.env.LAB_ORDER_REQUEST_REPORT_ID
).trim()
if (orderRequestReportId && !/^[a-f0-9]{24}$/i.test(orderRequestReportId)) {
  throw new Error('LAB_ORDER_REQUEST_REPORT_ID must be the 24-character existing Report Factory ID')
}
const orderRequestPdfAction = orderRequestReportId
  ? `<sd-report v-if="!isCancelledOrder(order)&&orderReportReady(order)" class="lab-plain-action lab-order-report"
            :report-list="orderRequestReportList" :params="orderReportParams(order)" size="small" />
          <el-button v-else-if="!isCancelledOrder(order)" class="lab-plain-action" size="small" disabled
            title="Order นี้ไม่มี Order ID, Visit ID หรือ LAB Section สำหรับสร้าง PDF">PDF</el-button>`
  : `<el-button v-if="!isCancelledOrder(order)" class="lab-plain-action" size="small"
            @click="notifyPending('PDF ใบสั่งตรวจ')">PDF</el-button>`
const form = JSON.parse(fs.readFileSync(formPath, 'utf8'))

// Reuse the proven document-level scanner settings from PIS_ห้องจ่ายยา, but keep
// LAB behavior deliberately smaller: HN selects patient context only. It never
// receives a specimen, creates a LAB NO., changes status, or sends to Agent.
const scanField = {
  key: 73904,
  name: 'Scan HN',
  component: 'scan-code-ui',
  category: 'display_ui',
  icon: 'scan-ui',
  fieldType: 'None',
  fieldLength: null,
  children: false,
  enable: true,
  formItemFlag: false,
  options: {
    name: 'scan_code',
    columnSpan: 4,
    hidden: false,
    disabled: false,
    preset: 'both',
    target: 'document',
    minLength: 6,
    avgTimeByChar: 30,
    extendedCharset: true,
    singleScanQty: 1,
    suffixKeyCodes: [13],
    indicator: 'badge',
    indicatorCorner: 'bottom-right',
    indicatorTimeout: 1,
    indicatorScanOnly: true,
    customClass: '',
    onCreated: '',
    onMounted: '',
    onUnmount: '',
    onScan: `const form=this.getFormRef&&this.getFormRef();
if(!form)return;
if(form.showPopupFlag)return;
const hn=String(value==null?'':value).replace(/\\D/g,'');
if(hn.length<6){this.notify('อ่าน HN ไม่ได้: '+String(value==null?'':value),'warning');return;}
const worklist=form.getFieldRef&&form.getFieldRef('lab_cpoe_worklist');
const state=worklist&&worklist.vueState;
if(!state||typeof state.scanPatientHn!=='function'){this.notify('ไม่พบ LAB Worklist สำหรับรับค่า HN','error');return;}
state.scanPatientHn(hn);`,
    onScanError: '',
    label: 'Scan HN'
  },
  id: 'scan-code-ui-lab-hn'
}

form.fields = Array.isArray(form.fields) ? form.fields : []
form.fields = form.fields.filter(field => !(field && field.options && field.options.name === 'scan_code'))
form.fields.push(scanField)

const walk = (value, fn) => {
  if (!value || typeof value !== 'object') return
  fn(value)
  if (Array.isArray(value)) value.forEach(item => walk(item, fn))
  else Object.values(value).forEach(item => walk(item, fn))
}

let widget = null
walk(form, value => {
  if (value.name === 'lab_cpoe_worklist') widget = value
})
if (!widget) throw new Error('lab_cpoe_worklist widget not found')

widget.content = `<div class="lab-cpoe">
  <section aria-label="ค้นหาและกรองรายการ">
    <div class="lab-toolbar">
      <el-input class="lab-search-control" :model-value="filters.hn" size="small" clearable
        prefix-icon="Search" placeholder="ค้นหา HN / VN / LN / ชื่อผู้ป่วย…"
        @input="setSearch" @clear="applyFilters" @keyup.enter="applyFilters" />
      <el-date-picker class="lab-date-control" :model-value="filters.dates" size="small" type="daterange"
        :disabled="scanMode && statusKey==='complete'"
        range-separator="ถึง" start-placeholder="Date Range" end-placeholder="Date Range"
        value-format="YYYY-MM-DD" format="DD/MM/YYYY" @update:model-value="setDates" />
      <el-button size="small" type="primary" :loading="loading" @click="applyFilters">Search</el-button>
      <el-dropdown trigger="click" @command="reportCommand">
        <el-button size="small">Report <span class="lab-dropdown-caret">⌄</span></el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="pdf">PDF</el-dropdown-item>
            <el-dropdown-item command="excel">Excel</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button class="lab-create-button" size="small" type="primary" @click="openCreateOrder">สร้างรายการใหม่</el-button>
    </div>

    <div v-if="scanMode" class="lab-scan-context" role="status" aria-live="polite">
      <span class="lab-scan-context-label">โหมดผู้ป่วยจากการสแกน</span>
      <strong class="lab-mono">HN {{ scannedHn }}</strong>
      <span v-if="statusKey==='complete'">แสดงประวัติออกผลครบทุกวัน</span>
      <span v-else>คง HN นี้ไว้เมื่อเปลี่ยนแท็บสถานะ</span>
      <el-button size="small" plain @click="clearScan">ล้าง HN ที่สแกน</el-button>
    </div>

    <div class="lab-status-strip" role="group" aria-label="กรองรายการตามสถานะ">
      <button v-for="filter in statusFilters" :key="filter.key" type="button"
        class="lab-status-chip" :class="{'is-active':statusKey===filter.key}"
        :data-status="filter.key==='all'?'':filter.key" :aria-pressed="statusKey===filter.key"
        @click="setStatus(filter.key)">
        <strong>{{ counts[filter.key] || 0 }}</strong><span>{{ filter.label }}</span>
      </button>
    </div>
  </section>

  <div v-if="loading" class="lab-list-summary">กำลังโหลดรายการ…</div>
  <div v-else-if="errorMessage" class="lab-list-summary is-error">
    {{ errorMessage }} <el-button size="small" @click="loadOrders">ลองใหม่</el-button>
  </div>
  <div v-else class="lab-list-summary">
    แสดง {{ orders.length }} Order จากทั้งหมด {{ page.total }}
    <span v-if="scanMode">· HN {{ scannedHn }}<template v-if="statusKey==='complete'"> · ทุกวันที่เคยออกผลครบ</template></span>
  </div>

  <section class="lab-worklist-shell" aria-label="รายการผู้ป่วย">
    <div class="lab-worklist">
      <div class="lab-list-head" aria-hidden="true">
        <div></div><div>ผู้ป่วย</div><div></div><div>รายการ</div><div>Specimen</div>
        <div>เวลาสั่ง / Order No.</div><div>แพทย์</div><div>สถานะ</div>
        <div>{{ statusKey==='cancelled' ? 'ดำเนินการ' : 'PDF' }}</div><div>{{ statusKey==='cancelled' ? '' : 'EMR' }}</div>
      </div>

      <article v-for="order in orders" :key="order.order_id" class="lab-patient-block"
        :class="{'is-open':isExpanded(order.order_id)}">
        <div class="lab-patient-row">
          <button class="lab-expand-button" type="button"
            :aria-label="isExpanded(order.order_id)?'ย่อรายละเอียด':'ขยายรายละเอียด'"
            :aria-expanded="isExpanded(order.order_id)" @click="toggleOrder(order.order_id)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"></path></svg>
          </button>

          <div class="lab-patient-summary">
            <div class="lab-patient-hn">
              <span class="lab-mono">{{ text(order.patient && order.patient.hn) || '–' }}</span>
              <span v-if="isUrgent(order)" class="lab-inline-tag lab-urgent-tag">เร่งด่วน</span>
            </div>
            <div class="lab-patient-name">{{ patientName(order) || '–' }}</div>
            <div class="lab-patient-demographic">
              <span v-if="text(order.patient && order.patient.gender_text)" class="lab-inline-tag lab-gender-pill">
                {{ text(order.patient.gender_text) }}
              </span>
              <span v-if="ageText(order)">{{ ageText(order) }}</span>
            </div>
          </div>

          <div class="lab-context-tags">
            <div class="lab-context-top">
              <span v-if="sourceRoom(order)" class="lab-inline-tag lab-meta-pill">{{ sourceRoom(order) }}</span>
              <span v-if="isPaid(order)" class="lab-inline-tag lab-meta-pill">ชำระเงินแล้ว</span>
            </div>
            <span v-if="hasPriorMedication(order)" class="lab-prior-medication">💊 {{ priorMedicationText(order) }}</span>
            <span v-if="coverage(order)" class="lab-inline-tag lab-meta-pill">{{ coverage(order) }}</span>
          </div>

          <div class="lab-metric lab-items-cell" data-label="รายการ">
            <el-tooltip placement="top" :disabled="!itemTooltipLines(order).length" popper-class="lab-cpoe-list-popper">
              <span class="lab-field-value lab-hover-summary">{{ order.item_count || 0 }} orders</span>
              <template #content>
                <div v-for="(line,index) in itemTooltipLines(order)" :key="'item-'+index" class="lab-pop-line">{{ line }}</div>
              </template>
            </el-tooltip>
          </div>
          <div class="lab-metric lab-specimen-cell" data-label="Specimen">
            <el-tooltip placement="top" :disabled="!specimenTooltipLines(order).length" popper-class="lab-cpoe-list-popper">
              <span class="lab-field-value lab-hover-summary">{{ specimenCount(order) }} specimens</span>
              <template #content>
                <div v-for="(line,index) in specimenTooltipLines(order)" :key="'specimen-'+index" class="lab-pop-line">{{ line }}</div>
              </template>
            </el-tooltip>
          </div>
          <div class="lab-metric lab-order-cell" data-label="เวลาสั่ง / Order No.">
            <span class="lab-order-no-tag">{{ text(order.order_number) || '–' }}</span>
            <span class="lab-field-value lab-time-value lab-mono">
              <span>{{ datePart(order.requested_at) }}</span><span>{{ timePart(order.requested_at) }}</span>
            </span>
          </div>

          <div class="lab-doctor-cell" data-label="แพทย์">
            <span class="lab-field-value" :title="requesterName(order)">{{ requesterName(order) || '–' }}</span>
            <el-tooltip placement="top" :disabled="!diagnosisText(order)" popper-class="lab-cpoe-diagnosis-popper">
              <span class="lab-diagnosis-summary">Diagnosis:<template v-if="diagnosisText(order)"> {{ diagnosisText(order) }}</template></span>
              <template #content><div class="lab-diagnosis-pop">{{ diagnosisText(order) }}</div></template>
            </el-tooltip>
          </div>
          <span class="lab-row-status" :class="statusClass(orderStatus(order))">{{ statusText(orderStatus(order)) }}</span>
          ${orderRequestPdfAction}
          <el-button v-else class="lab-plain-action" type="primary" size="small" @click="mockRetest(order)">ตรวจใหม่</el-button>
          <el-button v-if="!isCancelledOrder(order)" class="lab-plain-action" size="small" @click="openEmr(order)">EMR</el-button>
          <span v-else class="lab-action-placeholder" aria-hidden="true"></span>
        </div>

        <div v-if="isExpanded(order.order_id)" class="lab-detail-panel">
          <div class="lab-detail-top" role="tablist">
            <button class="lab-detail-tab" :class="{'is-active':detailTab(order)==='order'}" type="button"
              role="tab" :aria-selected="detailTab(order)==='order'" @click="setDetailTab(order,'order')">order</button>
            <button class="lab-detail-tab" :class="{'is-active':detailTab(order)==='results'}" type="button"
              role="tab" :aria-selected="detailTab(order)==='results'"
              title="ดูผลตรวจของรายการใน Order"
              @click="setDetailTab(order,'results')">ออกผล</button>
            <div v-if="detailTab(order)==='order'" class="lab-bulk-actions">
              <el-button size="small" type="success" :loading="receiveLoading"
                :disabled="!canReceiveOrder(order)||receiveLoading||rejectLoading||cancelDialog.loading" @click="receiveSelected(order)">รับ specimen</el-button>
              <el-button size="small" type="danger" plain :loading="rejectLoading"
                :disabled="selectedCount(order)!==1||receiveLoading||rejectLoading||cancelDialog.loading"
                @click="rejectSelected(order)">ปฏิเสธรายการที่เลือก</el-button>
              <el-button size="small" type="danger" plain :loading="cancelDialog.loading&&cancelDialog.order===order"
                :disabled="!canCancelOrder(order)||receiveLoading||rejectLoading||cancelDialog.loading"
                @click="openCancelOrder(order)">ยกเลิก order</el-button>
            </div>
          </div>

          <div v-if="detailTab(order)==='order'" class="lab-item-grid-wrap">
            <div class="lab-item-grid lab-item-head" aria-hidden="true">
              <div>เลือก</div><div>ลำดับ</div><div>Lab no.</div><div>รายการสั่งตรวจ</div><div>specimen</div>
              <div>เวลาเก็บ specimen</div><div>เวลารับ specimen</div><div>สถานะ</div><div>เหตุผล</div><div>ผู้ดำเนินการ</div>
            </div>
            <div v-for="(item,index) in order.items" :key="item.item_id" class="lab-item-grid lab-item-row"
              :class="{'is-selectable':item.current_status==='sent','is-selected':isSelected(item.item_id)}"
              @click="selectRow(order,item,$event)">
              <div data-label="เลือก"><el-checkbox :model-value="isSelected(item.item_id)"
                :disabled="item.current_status!=='sent'" @change="toggleItem(order,item.item_id)" /></div>
              <div data-label="ลำดับ" class="lab-mono">{{ index+1 }}</div>
              <div data-label="Lab no." class="lab-mono">{{ text(item.lab_no) || '–' }}</div>
              <div data-label="รายการสั่งตรวจ" class="lab-test-name">{{ text(item.item_code) }} {{ text(item.item_name) }}</div>
              <div data-label="specimen" class="lab-item-specimen-cell">
                <el-select class="lab-specimen-select" :class="{'lab-specimen-changed':specimenChanged(item)}"
                  size="small" :model-value="specimenValue(item)" placeholder="ค้นหา / เลือก specimen"
                  filterable default-first-option :loading="!!specimenSaving[item.item_id]"
                  :disabled="item.current_status!=='sent'||!!specimenSaving[item.item_id]"
                  @change="setSpecimen(item,$event)">
                  <el-option v-for="option in specimenOptions(item)" :key="option.value"
                    :label="option.label" :value="option.value" />
                </el-select>
              </div>
              <div data-label="เวลาเก็บ specimen" class="lab-mono lab-item-collected-time">
                <span>{{ datePart(item.specimen && item.specimen.ordered && item.specimen.ordered.collected_at) }}</span>
                <span>{{ timePart(item.specimen && item.specimen.ordered && item.specimen.ordered.collected_at) }}</span>
              </div>
              <div data-label="เวลารับ specimen" class="lab-mono">{{ compactDateTime(item.received_at) }}</div>
              <div data-label="สถานะ"><span class="lab-state-tag" :class="statusClass(item.current_status)">
                {{ statusText(item.current_status) }}</span></div>
              <div data-label="เหตุผล">{{ actionReasonText(item) }}</div>
              <div data-label="ผู้ดำเนินการ">{{ actionActorText(item) }}</div>
            </div>
          </div>

          <div v-else class="lab-result-list">
            <div class="lab-result-list-head"><div>ลำดับ</div><div>รายการสั่งตรวจ</div><div>เวลาออกผล</div><div>ผลตรวจ</div><div>สถานะ</div></div>
            <div v-for="(item,index) in resultItems(order)" :key="'result-'+item.item_id" class="lab-result-list-row">
              <div class="lab-mono">{{ index+1 }}</div>
              <div class="lab-test-name">{{ text(item.item_code) }} {{ text(item.item_name) }}</div>
              <div class="lab-mono">{{ resultTime(item) }}</div>
              <div><el-button size="small" type="primary" @click="openResult(item,order,false)">ดูผล</el-button></div>
              <div><span class="lab-critical-status" :class="criticalClass(item)">{{ criticalText(item) }}</span></div>
            </div>
            <div v-if="!resultItems(order).length" class="lab-empty">ไม่มีรายการผลตรวจใน Order นี้</div>
          </div>
        </div>
      </article>

      <div v-if="!loading && !orders.length" class="lab-empty">
        <strong>ไม่พบรายการ</strong><br />
        <template v-if="scanMode">ไม่พบ Order ของ HN {{ scannedHn }} ในสถานะนี้</template>
        <template v-else>ลองเปลี่ยนคำค้น ช่วงวันที่ หรือสถานะ</template>
      </div>
    </div>
  </section>

  <div v-if="page.total>page.size" class="lab-pagination">
    <el-pagination :current-page="page.current" :page-size="page.size"
      :page-sizes="[10,20,30,50,100]" :total="page.total" size="small" background
      layout="total, sizes, prev, pager, next, jumper"
      @current-change="setPage" @size-change="setPageSize" />
  </div>

  <el-dialog v-model="cancelDialog.visible" title="ยกเลิก LAB Order" width="min(560px,94vw)"
    :close-on-click-modal="false" :close-on-press-escape="!cancelDialog.loading" :show-close="!cancelDialog.loading"
    @closed="resetCancelDialog">
    <div class="lab-cancel-summary">
      <strong>Order No. {{ text(cancelDialog.order && cancelDialog.order.order_number) || '–' }}</strong>
      <span>ระบบจะยกเลิก LAB Item ที่ยังดำเนินการได้ทั้งหมดใน Order นี้ และเก็บผู้ทำรายการกับเวลาไว้ใน audit</span>
      <span>ถ้ารายการถูกส่งไป Agent/LIS แล้ว ระบบจะหยุดและไม่ยกเลิกเฉพาะฝั่ง HIS</span>
    </div>
    <label class="lab-cancel-reason"><span>เหตุผลการยกเลิก <b>*</b></span>
      <el-input v-model="cancelDialog.reason" type="textarea" :rows="4" maxlength="1000"
        show-word-limit :disabled="cancelDialog.loading" placeholder="ระบุเหตุผลการยกเลิก Order" />
    </label>
    <template #footer>
      <el-button :disabled="cancelDialog.loading" @click="cancelDialog.visible=false">ไม่ยกเลิก</el-button>
      <el-button type="danger" :loading="cancelDialog.loading" :disabled="!text(cancelDialog.reason)"
        @click="submitCancelOrder">ยืนยันยกเลิกทั้ง Order</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="manual.visible" :title="resultDialogTitle()" width="min(820px,94vw)"
    :close-on-click-modal="false" destroy-on-close @closed="resetManual">
    <div v-loading="manual.loading" class="lab-manual-form">
      <div class="lab-manual-context">
        <div><span>รายการ</span><strong>{{ manual.data.test_code }} {{ manual.data.test_name }}</strong></div>
        <div><span>HN / VN</span><strong>{{ manual.data.patient_hn || '–' }} / {{ manual.data.visit_vn || '–' }}</strong></div>
        <div class="lab-result-dialog-action"><span>LAB NO.</span><strong class="lab-mono">{{ manual.data.lab_no || '–' }}</strong>
          <el-button v-if="!manual.editing && canEditManual(manual.item)" circle plain type="primary"
            aria-label="กรอกหรือแก้ไขผล" title="กรอกหรือแก้ไขผล" @click="startManualEdit">✎</el-button>
        </div>
      </div>
      <div v-if="manual.data.results && manual.data.results.length" class="lab-result-values">
        <div v-for="result in manual.data.results" :key="result.result_item_id || result.entered_at" class="lab-result-value-row">
          <div><span>รายการผล</span><strong>{{ result.test_name || manual.data.test_name || '–' }}</strong><small>{{ result.test_code || manual.data.test_code || '' }}</small></div>
          <div class="lab-result-previous"><span>ผลก่อนหน้า</span><strong class="lab-result-measured">{{ result.previous && result.previous.value || '–' }}</strong><small>{{ result.previous && result.previous.unit || '' }}</small><small v-if="result.previous && result.previous.entered_at">{{ compactDateTime(result.previous.entered_at) }}<template v-if="result.previous.visit_vn"> · VN {{ result.previous.visit_vn }}</template></small></div>
          <div><span>ผลปัจจุบัน</span><strong class="lab-result-measured">{{ result.result_value || 'รอผล' }}</strong><small>{{ result.unit || '' }}</small><small v-if="result.last_edited_by">แก้ไขโดย {{ result.last_edited_by }}<template v-if="result.last_edited_at"> · {{ compactDateTime(result.last_edited_at) }}</template></small></div>
          <div><span>Reference range</span><strong>{{ result.reference_range || '–' }}</strong><small>{{ result.interpretation || '' }}</small></div>
          <div><span>แหล่งผล</span><strong>{{ resultSourceText(result.result_source) }}</strong><small>{{ compactDateTime(result.entered_at) }}</small></div>
          <div><span>Critical</span><strong :class="{'lab-critical-value':result.is_critical===true}">{{ result.is_critical===true ? 'ค่าวิกฤติ' : '–' }}</strong><small v-if="result.is_critical!==true">ไม่อนุมานจาก ref. range</small></div>
        </div>
      </div>
      <div v-else-if="!manual.loading" class="lab-previous-result is-empty">ยังไม่มีผลตรวจ · รอผลจาก Agent/LIS หรือกดดินสอเพื่อกรอกผล</div>
      <div v-if="manual.editing" class="lab-manual-fields">
        <label><span>ค่าที่ตรวจได้</span><el-input v-model="manual.form.result_value" clearable /></label>
        <label><span>Unit</span><el-input v-model="manual.form.unit" clearable /></label>
        <label><span>แปลผล</span>
          <el-select v-model="manual.form.interpretation" clearable filterable allow-create
            default-first-option placeholder="เลือกหรือพิมพ์คำแปลผล">
            <el-option v-for="option in interpretationOptions" :key="option.value"
              :label="option.label" :value="option.value" />
          </el-select>
        </label>
        <label><span>ค่าปกติ / Reference range</span><el-input v-model="manual.form.reference_range" clearable /></label>
      </div>
      <div v-if="manual.editing" class="lab-manual-hint">การกรอกมือจะไม่สร้างสถานะค่าวิกฤติอัตโนมัติ; ค่า Critical จากเครื่องต้องมาจาก LIS โดยตรง</div>
    </div>
    <template #footer>
      <el-button @click="manual.visible=false">{{ manual.editing ? 'ยกเลิก' : 'ปิด' }}</el-button>
      <el-button v-if="manual.editing" type="primary" :loading="manual.saving" @click="saveManualResult">บันทึกผล</el-button>
    </template>
  </el-dialog>
</div>`

widget.onCreated = `const s=this.vueState;
const field=this;
const PROCESS_ID='6a9434c3422c1ca959829d5e';
const RECEIVE_PROCESS_ID='6a94f634422c1ca959829d70';
const REJECT_PROCESS_ID='6a79ff46d5218a5b6a26bebc';
const REJECTION_FORM_ID='6a7713fdcc7d0a8451130331';
const CPOE_ORDER_APP_ID='6a927860422c1ca959829d26';
const EMR_FORM_ID='6a96557e422c1ca959829eae';
const ORDER_REQUEST_REPORT_ID='${orderRequestReportId}';
const REJECT_REASON_LABELS={
  specimen_incorrect:'สิ่งส่งตรวจไม่ถูกต้อง',
  specimen_insufficient:'ปริมาณสิ่งส่งตรวจไม่เพียงพอ',
  container_incorrect:'ภาชนะบรรจุไม่ถูกต้อง',
  patient_mismatch:'ระบุตัวผู้ป่วยผิดคน',
  specimen_unsuitable:'สิ่งส่งตรวจเสื่อมสภาพหรือปนเปื้อน',
  ward_cancel:'Ward ยกเลิกการส่งตรวจ',
  change_draw:'คลินิกนมแม่ขอเปลี่ยนสิทธิ์คนไข้',
  change_draw_1:'คนไข้ขอเปลี่ยนใช้สิทธิ์บัตรทอง',
  finance_error:'รายการไม่ส่งไปการเงิน',
  other:'อื่น ๆ'
};

s.orders=[];
s.loading=false;
s.errorMessage='';
s.expanded={};
s.detailTabs={};
s.selected={};
s.specimenEdits={};
s.specimenMasterOptions=[];
s.allowedSectionCodes=[];
s.orderRequestReportList=ORDER_REQUEST_REPORT_ID?[{reportId:ORDER_REQUEST_REPORT_ID,label:'PDF',type:'pdf'}]:[];
s.specimenSaving={};
s.receiveLoading=false;
s.rejectLoading=false;
s.cancelDialog={visible:false,loading:false,order:null,reason:''};
s.manual={visible:false,loading:false,saving:false,editing:false,item:null,order:null,data:{results:[]},form:{result_value:'',unit:'',interpretation:'',reference_range:''}};
s.interpretationOptions=[
  {label:'ปกติ (N)',value:'N'},
  {label:'สูง (H)',value:'H'},
  {label:'ต่ำ (L)',value:'L'},
  {label:'ผิดปกติ (A)',value:'A'},
  {label:'พบเชื้อ / Positive',value:'POS'},
  {label:'ไม่พบเชื้อ / Negative',value:'NEG'}
];
s.filters={hn:'',dates:[]};
s.scanMode=false;
s.scannedHn='';
s.scanNoticePending=false;
s.statusKey='all';
s.counts={all:0,active:0,complete:0,cancelled:0};
s.page={current:1,size:30,total:0};
s.loadSeq=0;
s.countSeq=0;
s.statusFilters=[
  {key:'all',label:'ทั้งหมด'},
  {key:'active',label:'รอรับ / รอผล / ออกผลบางส่วน'},
  {key:'complete',label:'ออกผลครบ'},
  {key:'cancelled',label:'ยกเลิก / ปฏิเสธ'}
];
s.statusMap={
  all:['sent','accepted','prepared','ready','dispensed','resulted','completed','cancelled','rejected'],
  active:['sent','accepted','prepared','ready','dispensed','resulted'],
  complete:['completed'],
  cancelled:['cancelled','rejected']
};

s.text=v=>{
  if(v==null)return '';
  if(typeof v==='object')return s.text(v.label||v.name||v.display_name||v.full_name||v.username||v.code||v.value||v._id||'');
  return String(v).trim();
};
s.stripEmail=v=>String(v||'')
  .replace(/\\s*[\\(<\\[]?[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}[\\)>\\]]?\\s*/ig,' ')
  .replace(/\\(\\s*\\)|\\[\\s*\\]|<\\s*>/g,' ')
  .replace(/\\s{2,}/g,' ')
  .trim();
s.personName=v=>{
  if(!v)return '';
  if(typeof v==='object'){
    const parts=[s.text(v.prename||v.prefix||v.title),s.text(v.first_name||v.p_fname||v.firstname),s.text(v.last_name||v.p_lname||v.lastname)].filter(Boolean);
    if(parts.length>=2)return s.stripEmail(parts.join(' '));
    return s.stripEmail(s.text(v.display_name||v.full_name||v.name||v.label||v.username||''));
  }
  return s.stripEmail(v);
};
s.rejectReasonText=i=>{
  const fallback=s.text(i&&i.reject_reason),detail=s.text(i&&i.reject_reason_detail);
  const directCode=s.text(i&&i.reject_reason_code),code=directCode||(REJECT_REASON_LABELS[fallback]?fallback:'');
  const label=REJECT_REASON_LABELS[code]||code;
  if(label&&detail&&label!==detail)return label+' · '+detail;
  return detail||label||fallback||'–';
};
s.actionReasonText=i=>s.text(i&&i.current_status).toLowerCase()==='cancelled'?(s.text(i&&i.cancel_reason)||'ยกเลิก order'):s.rejectReasonText(i);
s.actionActorText=i=>s.personName(s.text(i&&i.current_status).toLowerCase()==='cancelled'?(i&&i.cancelled_by):(i&&i.rejected_by))||'–';
s.patientName=o=>[s.text(o&&o.patient&&o.patient.prename),s.text(o&&o.patient&&o.patient.first_name),s.text(o&&o.patient&&o.patient.last_name)].filter(Boolean).join(' ');
s.optionCode=v=>{if(v==null)return '';if(typeof v==='object')return s.text(v.value||v.code||v.id||v._id||'');return s.text(v);};
s.priorMedicationText=o=>s.text(o&&o.prior_specify);
s.hasPriorMedication=o=>s.optionCode(o&&o.prior_medication)==='2'&&!!s.priorMedicationText(o);
s.coverage=o=>s.text(o&&o.finance&&o.finance.coverage);
s.requesterName=o=>{const r=o&&o.requester||{};return s.personName(r.cosign_user)||s.personName(r.visit_doctor);};
s.sourceRoom=o=>s.text(o&&o.visit&&(o.visit.clinic||o.visit.ward));
s.isPaid=o=>{const f=o&&o.finance||{};const total=Number(f.total_amount||0);return total>0&&Number(f.paid_amount||0)>=total;};
s.isUrgent=o=>{const p=s.text(o&&o.priority).toLowerCase();return p.includes('urgent')||p.includes('stat')||p.includes('ด่วน')||['2','3','4','5'].includes(p);};
s.ageText=o=>s.text(o&&o.patient&&o.patient.age);
s.diagnosisText=o=>s.text(o&&(o.diagnosis||(o.emr_context&&o.emr_context.diagnosis)));
s.itemTooltipLines=o=>(o&&Array.isArray(o.items)?o.items:[]).map(i=>[s.text(i&&i.item_code),s.text(i&&i.item_name)].filter(Boolean).join(' ')).filter(Boolean);
s.specimenDisplay=i=>s.text(i&&i.specimen&&i.specimen.ordered&&i.specimen.ordered.source)||s.text(i&&i.specimen&&i.specimen.master&&i.specimen.master.name)||s.specimenValue(i)||'ไม่ระบุ specimen';
s.specimenTooltipLines=o=>(o&&Array.isArray(o.items)?o.items:[]).map(i=>{const specimen=s.specimenDisplay(i),test=[s.text(i&&i.item_code),s.text(i&&i.item_name)].filter(Boolean).join(' ');return test?specimen+' · '+test:specimen;}).filter(Boolean);
s.specimenCount=o=>(o&&Array.isArray(o.items)?o.items.length:0);
s.specimenBase=i=>s.text(i&&i.specimen&&i.specimen.ordered&&i.specimen.ordered.source_code)||s.text(i&&i.specimen&&i.specimen.master&&i.specimen.master.code)||s.text(i&&i.specimen&&i.specimen.ordered&&i.specimen.ordered.source);
s.specimenValue=i=>s.text(s.specimenEdits[i&&i.item_id])||s.specimenBase(i);
s.specimenExpected=i=>s.text(i&&i.specimen&&i.specimen.master&&i.specimen.master.code)||s.text(i&&i.specimen&&i.specimen.master&&i.specimen.master.name);
s.specimenChanged=i=>{const expected=s.specimenExpected(i).trim().toUpperCase();const selected=s.specimenValue(i).trim().toUpperCase();return !!(expected&&selected&&expected!==selected);};
s.specimenOptions=i=>{
  const out=[];
  const seen={};
  const add=(value,label)=>{const key=s.text(value);if(!key||seen[key])return;seen[key]=true;out.push({value:key,label:s.text(label)||key});};
  const spec=i&&i.specimen||{};
  const choices=Array.isArray(s.specimenMasterOptions)&&s.specimenMasterOptions.length?s.specimenMasterOptions:(Array.isArray(spec.options)?spec.options:[]);
  choices.forEach(x=>add(x&&x.value||x&&x.code||x,x&&x.label||x&&x.name||x));
  add(spec.ordered&&spec.ordered.source,spec.ordered&&spec.ordered.source);
  add(spec.master&&spec.master.code,spec.master&&spec.master.name||spec.master&&spec.master.code);
  if(!out.length)add('ไม่ระบุ','ไม่ระบุ');
  return out;
};
s.isMycology=i=>s.text(i&&i.section&&i.section.code).toUpperCase()==='MY';
s.canEditManual=i=>s.isMycology(i)&&['accepted','prepared','ready','dispensed','resulted'].includes(s.text(i&&i.current_status).toLowerCase());
s.canViewResult=i=>['sent','accepted','prepared','ready','dispensed','resulted','completed'].includes(s.text(i&&i.current_status).toLowerCase());
s.resultItems=o=>(o&&Array.isArray(o.items)?o.items:[]).filter(s.canViewResult);
s.canOpenResultTab=o=>s.resultItems(o).length>0;
s.resultedAt=i=>s.text(i&&(i.resulted_at||(i.result_summary&&i.result_summary.resulted_at)));
s.resultTime=i=>s.resultedAt(i)?s.timePart(s.resultedAt(i)):'–';
s.criticalValue=i=>{
  const summary=i&&i.result_summary&&typeof i.result_summary==='object'?i.result_summary:{};
  const raw=summary.is_critical!=null?summary.is_critical:i&&i.is_critical;
  const normalized=s.text(raw).toLowerCase();
  if(raw===true||raw===1||['true','1','critical'].includes(normalized))return true;
  if(raw===false||raw===0||['false','0','normal','not_critical'].includes(normalized))return false;
  return null;
};
s.criticalText=i=>{const value=s.criticalValue(i);if(value===true)return 'ค่าวิกฤติ';if(value===false)return 'ไม่พบค่าวิกฤติ';return s.resultedAt(i)?'รอยืนยัน':'รอผล';};
s.criticalClass=i=>{const value=s.criticalValue(i);return value===true?'is-critical':value===false?'is-normal':'is-pending';};
s.detailTab=o=>s.detailTabs[s.text(o&&o.order_id)]||'order';
s.setDetailTab=(o,tab)=>{const id=s.text(o&&o.order_id);if(!id)return;s.detailTabs={...s.detailTabs,[id]:tab};};
s.resultSourceText=v=>{const source=s.text(v).toLowerCase();return source==='agent'||source==='lis'?'LIS':source==='manual'?'Manual':source||'–';};
s.resultDialogTitle=()=>s.manual.editing?'กรอกผล':'ผลตรวจทางห้องปฏิบัติการ';
s.resetManual=()=>{s.manual={visible:false,loading:false,saving:false,editing:false,item:null,order:null,data:{results:[]},form:{result_value:'',unit:'',interpretation:'',reference_range:''}};};
s.startManualEdit=()=>{if(!s.canEditManual(s.manual.item))return;s.manual={...s.manual,editing:true};};
s.openResult=async(item,order,startEdit)=>{
  if(!s.canViewResult(item)){field.notify('สถานะ Item นี้ไม่อนุญาตให้เปิดผลตรวจ','warning',3000);return;}
  s.manual={...s.manual,visible:true,loading:true,editing:Boolean(startEdit&&s.canEditManual(item)),item:item,order:order,data:{results:[]},form:{result_value:'',unit:'',interpretation:'',reference_range:''}};
  try{
    const p=await s.processCall(PROCESS_ID,{action:'get_manual_result',organization_code:s.unitCode(),item_id:s.text(item.item_id)});
    if(!p||p.success===false){s.manual={...s.manual,loading:false};field.notify((p&&p.message)||'อ่านผลตรวจไม่สำเร็จ','error',4000);return;}
    const d=p.data||{};
    s.manual={...s.manual,loading:false,data:d,form:{result_value:s.text(d.result_value),unit:s.text(d.unit),interpretation:s.text(d.interpretation),reference_range:s.text(d.reference_range)}};
  }catch(error){s.manual={...s.manual,loading:false};field.notify(s.text(error&&error.message)||'อ่านผลตรวจไม่สำเร็จ','error',4000);}
};
s.saveManualResult=async()=>{
  const item=s.manual.item;
  if(!item){field.notify('ไม่พบข้อมูลสำหรับบันทึกผล Manual','error',3000);return;}
  s.manual={...s.manual,saving:true};
  try{
    const p=await s.processCall(PROCESS_ID,{action:'save_manual_result',organization_code:s.unitCode(),item_id:s.text(item.item_id),manual_result:{...s.manual.form}});
    if(!p||p.success===false){s.manual={...s.manual,saving:false};field.notify((p&&p.message)||'บันทึกผล Manual ไม่สำเร็จ','error',4500);return;}
    const d=p.data||{};
    if(d.result_status==='entered'){
      item.current_status='resulted';
      item.resulted_at=s.text(d.entered_at)||item.resulted_at;
    }
    s.manual={...s.manual,saving:false,editing:false,data:d};
    field.notify((p&&p.message)||'บันทึกผล Manual แล้ว','success',2600);
    s.refreshCounts();
  }catch(error){s.manual={...s.manual,saving:false};field.notify(s.text(error&&error.message)||'บันทึกผล Manual ไม่สำเร็จ','error',4500);}
};
s.setSpecimen=async(item,value)=>{
  const id=s.text(item&&item.item_id);
  const code=s.text(value).toUpperCase();
  if(!id||!code||s.specimenSaving[id])return;
  s.specimenSaving={...s.specimenSaving,[id]:true};
  const done=()=>{const next={...s.specimenSaving};delete next[id];s.specimenSaving=next;};
  try{
    const p=await s.processCall(PROCESS_ID,{action:'update_specimen',organization_code:s.unitCode(),item_id:id,specimen_code:code});
    if(!p||p.success===false){done();field.notify((p&&p.message)||'บันทึก specimen ไม่สำเร็จ','error',3500);return;}
    const d=p.data||{};
    s.specimenEdits={...s.specimenEdits,[id]:s.text(d.specimen_code)||code};
    if(item.specimen){
      item.specimen.complete=true;
      item.specimen.ordered=item.specimen.ordered||{};
      item.specimen.ordered.source=s.text(d.specimen_name)||code;
      item.specimen.ordered.source_code=s.text(d.specimen_code)||code;
    }
    done();field.notify('อัปเดต specimen แล้ว','success',2200);
  }catch(error){done();field.notify(s.text(error&&error.message)||'บันทึก specimen ไม่สำเร็จ','error',3500);}
};

s.toDate=v=>{if(!v)return null;const d=new Date(String(v).replace(' ','T'));return Number.isNaN(d.getTime())?null:d;};
s.datePart=v=>{const d=s.toDate(v);return d?d.toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit',timeZone:'Asia/Bangkok'}):'–';};
s.timePart=v=>{const d=s.toDate(v);return d?d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Bangkok'}):'–';};
s.compactDateTime=v=>{if(!v)return '–';const d=s.toDate(v);return d?s.datePart(v)+' '+s.timePart(v):String(v);};
s.statusText=v=>({sent:'รอรับ',accepted:'รับแล้ว · รอผล',mixed:'รอรับ · รับแล้ว',prepared:'เตรียม',ready:'พร้อม',dispensed:'ดำเนินการ',resulted:'ออกผลบางส่วน',completed:'ออกผลครบ',cancelled:'ยกเลิก',rejected:'ปฏิเสธ',returned:'ส่งกลับ',reversed:'ย้อนรายการ'})[String(v||'').toLowerCase()]||s.text(v)||'–';
s.statusClass=v=>{const x=String(v||'').toLowerCase();if(x==='sent')return 'status-waiting';if(['accepted','prepared','ready','dispensed'].includes(x))return 'status-received';if(x==='resulted')return 'status-result-partial';if(x==='completed')return 'status-result-complete';if(['cancelled','rejected','returned','reversed'].includes(x))return 'status-cancelled';return 'status-mixed';};
s.orderStatus=o=>{
  const statuses=(o&&Array.isArray(o.items)?o.items:[]).map(item=>s.text(item&&item.current_status).toLowerCase()).filter(Boolean);
  if(!statuses.length)return s.text(o&&o.current_status).toLowerCase()||'sent';
  const active=statuses.filter(status=>!['cancelled','rejected','returned','reversed'].includes(status));
  if(!active.length)return statuses.every(status=>status==='rejected')?'rejected':'cancelled';
  if(active.every(status=>status==='sent'))return 'sent';
  if(active.some(status=>status==='sent'))return 'mixed';
  if(active.every(status=>status==='completed'))return 'completed';
  if(active.some(status=>['resulted','completed'].includes(status)))return 'resulted';
  if(active.some(status=>['accepted','prepared','ready','dispensed'].includes(status)))return 'accepted';
  return s.text(o&&o.current_status).toLowerCase()||'mixed';
};
s.isCancelledOrder=o=>['cancelled','rejected'].includes(s.orderStatus(o));
s.orderVisitId=o=>s.text(o&&o.emr_context&&o.emr_context.visit_id||o&&o.visit&&o.visit.visit_id);
s.reportSectionCode=o=>{
  const items=o&&Array.isArray(o.items)?o.items:[];
  for(let i=0;i<items.length;i++){
    const code=s.text(items[i]&&items[i].section&&items[i].section.code).toUpperCase();
    if(code)return code;
  }
  return '';
};
s.orderReportReady=o=>!!(s.text(o&&o.order_id)&&s.orderVisitId(o)&&s.reportSectionCode(o));
s.currentUserName=()=>{
  const state=field.globalUserState||{},user=state.user||state.currentUser||{};
  return s.personName(user)||s.personName(state)||'ผู้ใช้งานระบบ';
};
s.currentPrintTime=()=>new Intl.DateTimeFormat('th-TH',{
  day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',
  hour12:false,timeZone:'Asia/Bangkok'
}).format(new Date());
s.orderReportParams=o=>({
  order_id:s.text(o&&o.order_id),
  visit_id:s.orderVisitId(o),
  section_code:s.reportSectionCode(o),
  printed_by:s.currentUserName(),
  printed_at:s.currentPrintTime()
});

s.setSearch=v=>{s.filters={...s.filters,hn:v||''};};
s.setDates=v=>{s.filters={...s.filters,dates:Array.isArray(v)?v:[]};};
s.scanPatientHn=hn=>{
  const code=s.text(hn).replace(/\\D/g,'');
  if(code.length<6){field.notify('HN จากการสแกนไม่ถูกต้อง','warning',3000);return;}
  s.scanMode=true;
  s.scannedHn=code;
  s.scanNoticePending=true;
  s.filters={...s.filters,hn:''};
  s.expanded={};
  s.detailTabs={};
  s.orders=[];
  s.page={...s.page,current:1,total:0};
  s.loadOrders();
  s.refreshCounts();
};
s.clearScan=()=>{
  s.scanMode=false;
  s.scannedHn='';
  s.scanNoticePending=false;
  s.expanded={};
  s.detailTabs={};
  s.page={...s.page,current:1,total:0};
  s.loadOrders();
  s.refreshCounts();
};
s.isExpanded=id=>!!s.expanded[id];
s.toggleOrder=id=>{s.expanded={...s.expanded,[id]:!s.expanded[id]};s.selected={};};
s.isSelected=id=>!!s.selected[id];
s.orderHasItem=(order,id)=>!!(order&&Array.isArray(order.items)&&order.items.some(item=>s.text(item&&item.item_id)===s.text(id)));
s.toggleItem=(order,id)=>{if(!s.orderHasItem(order,id))return;const next={...s.selected};if(next[id])delete next[id];else next[id]=true;s.selected=next;};
s.selectRow=(order,item,event)=>{
  if(!item||s.text(item.current_status).toLowerCase()!=='sent')return;
  const el=event&&event.target;
  if(el&&typeof el.closest==='function'&&el.closest('.el-checkbox,button,a,input,textarea,select,.el-select,.el-input'))return;
  const selection=(typeof window!=='undefined'&&window.getSelection)?window.getSelection():null;
  if(selection&&s.text(selection.toString()))return;
  s.toggleItem(order,item.item_id);
};
s.selectableItems=o=>(o&&Array.isArray(o.items)?o.items:[]).filter(item=>item&&item.current_status==='sent');
s.allSelectableChecked=o=>{const items=s.selectableItems(o);return !!items.length&&items.every(item=>s.isSelected(item.item_id));};
s.someSelectableChecked=o=>{const items=s.selectableItems(o);const n=items.filter(item=>s.isSelected(item.item_id)).length;return n>0&&n<items.length;};
s.toggleAll=o=>{const next={...s.selected};const items=s.selectableItems(o);const off=items.length&&items.every(item=>next[item.item_id]);items.forEach(item=>{if(off)delete next[item.item_id];else next[item.item_id]=true;});s.selected=next;};
s.selectedItems=order=>(order&&Array.isArray(order.items)?order.items:[]).filter(item=>s.isSelected(s.text(item&&item.item_id)));
s.selectedCount=order=>s.selectedItems(order).length;
s.canReceiveOrder=order=>{const items=s.selectedItems(order);return items.length>0&&items.every(item=>s.text(item&&item.current_status).toLowerCase()==='sent');};
s.canCancelOrder=order=>{
  const terminal=['cancelled','rejected','returned','reversed'];
  const items=order&&Array.isArray(order.items)?order.items:[];
  const active=items.filter(item=>!terminal.includes(s.text(item&&item.current_status).toLowerCase()));
  return active.length>0&&active.every(item=>['sent','accepted'].includes(s.text(item&&item.current_status).toLowerCase()));
};
s.findItem=id=>{for(let i=0;i<s.orders.length;i++){const items=Array.isArray(s.orders[i]&&s.orders[i].items)?s.orders[i].items:[];for(let j=0;j<items.length;j++){if(s.text(items[j]&&items[j].item_id)===s.text(id))return items[j];}}return null;};
s.recordId=v=>{if(v==null)return '';if(typeof v==='object')return s.recordId(v.$oid||v._id||v.id||v.value||'');return String(v).trim();};
s.savedRow=v=>{const c=[v&&v.data&&v.data.data,v&&v.reply&&v.reply.data,v&&v.data,v];for(let i=0;i<c.length;i++){if(c[i]&&typeof c[i]==='object'&&!Array.isArray(c[i]))return c[i];}return {};};
s.applyReceiveResult=(item,data)=>{
  const d=data||{};
  item.current_status=s.text(d.current_status)||'accepted';
  if(s.text(d.lab_no))item.lab_no=s.text(d.lab_no);
  if(s.text(d.received_at))item.received_at=s.text(d.received_at);
  if(s.text(d.received_by))item.received_by=s.text(d.received_by);
  item.hl7_status=s.text(d.hl7_status)||item.hl7_status||'new';
  item.agent_transport_state=s.text(d.agent_transport_state)||item.agent_transport_state||'pending';
  const next={...s.selected};delete next[s.text(item.item_id)];s.selected=next;
};
s.receiveSelected=async order=>{
  const items=s.selectedItems(order);
  if(!items.length){field.notify('กรุณาเลือก LAB Item ใน Order นี้อย่างน้อย 1 รายการ','warning',3000);return;}
  if(items.some(item=>s.text(item&&item.current_status).toLowerCase()!=='sent')){field.notify('รับได้เฉพาะรายการใน Order นี้ที่อยู่ในสถานะรอรับ','warning',3000);return;}
  if(typeof field.confirm==='function'){
    try{
      const labels=items.map(item=>s.text(item.item_code)||s.text(item.item_name)).filter(Boolean);
      const ok=await field.confirm('ระบบจะสร้าง LAB NO. บันทึกเวลารับ specimen และสร้าง Outbound Order โดยยังไม่ส่ง Agent อัตโนมัติ\\n\\nยืนยันรับ '+items.length+' รายการ'+(labels.length?'\\n'+labels.join(' · '):'')+'?','รับ specimen');
      if(ok===false)return;
    }catch(error){return;}
  }
  s.receiveLoading=true;
  const successItems=[];
  const failedItems=[];
  for(let index=0;index<items.length;index++){
    const item=items[index];
    try{
      const p=await s.processCall(RECEIVE_PROCESS_ID,{item_id:s.text(item.item_id)});
      if(!p||p.success===false){failedItems.push({item,message:(p&&p.message)||'รับ specimen ไม่สำเร็จ'});continue;}
      s.applyReceiveResult(item,p.data||{});
      successItems.push(item);
    }catch(error){failedItems.push({item,message:s.text(error&&error.message)||'เรียก API รับ specimen ไม่สำเร็จ'});}
  }
  s.receiveLoading=false;
  if(failedItems.length){
    const names=failedItems.map(row=>s.text(row.item&&row.item.item_code)||s.text(row.item&&row.item.item_name)).filter(Boolean);
    field.notify('รับสำเร็จ '+successItems.length+' รายการ · ไม่สำเร็จ '+failedItems.length+' รายการ'+(names.length?' ('+names.join(', ')+')':''),'warning',6000);
  }else field.notify('รับ specimen และสร้าง LAB NO. แล้ว '+successItems.length+' รายการ','success',4000);
  if(successItems.length){s.loadOrders();s.refreshCounts();}
};

s.rejectSelected=order=>{
  const items=s.selectedItems(order);
  if(items.length!==1){field.notify('กรุณาเลือก LAB Item ใน Order นี้ที่ต้องการปฏิเสธ 1 รายการ','warning',3000);return;}
  const item=items[0];
  if(!item||s.text(item.current_status).toLowerCase()!=='sent'){field.notify('ปฏิเสธได้เฉพาะรายการที่อยู่ในสถานะรอรับ specimen','warning',3500);return;}
  if(!order||!(Array.isArray(order.items)&&order.items.some(row=>s.text(row&&row.item_id)===s.text(item.item_id)))){field.notify('Item ที่เลือกไม่ตรงกับ Order นี้','error',3500);return;}
  const form=field.getFormRef&&field.getFormRef();
  if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิดฟอร์มเหตุผลการปฏิเสธ','error',3500);return;}
  const itemId=s.text(item.item_id),orderId=s.text(order.order_id),orderNumber=s.text(order.order_number),sectionCode=s.text(item.section&&item.section.code).toUpperCase();
  const patientHn=s.text(order.patient&&order.patient.hn),patientName=s.patientName(order);
  const itemSnapshot=[{source_item_id:itemId,item_code:s.text(item.item_code),item_name:s.text(item.item_name),section_code:sectionCode,specimen:item.specimen||{}}];
  const initData={
    source_order_id:itemId,
    order_group_id:orderNumber||orderId,
    patient_hn:patientHn,
    patient_name:patientName,
    patient_display:[patientHn,patientName].filter(Boolean).join(' — '),
    ward_clinic:s.sourceRoom(order),
    lab_section:sectionCode,
    selected_items_json:JSON.stringify(itemSnapshot),
    biochemistry_specimen_json:JSON.stringify(item.specimen||{}),
    treatment_right:s.coverage(order),
    payment_status:s.isPaid(order)?'ชำระเงินแล้ว':'',
    revision_no:'1',
    rejection_status:'recorded'
  };
  form.openForm(REJECTION_FORM_ID,null,null,initData,{
    params:Object.assign({},form.formParams||{},{from:'lab-cpoe-worklist',item_id:itemId,order_id:orderId,order_number:orderNumber,section_code:sectionCode}),
    popupType:'dialog',backdrop:false,
    beforeSaveCallback:()=>({source_order_id:itemId,order_group_id:orderNumber||orderId,lab_section:sectionCode,rejection_status:'recorded'}),
    afterSaveCallback:async saved=>{
      const savedRow=s.savedRow(saved),rejectionRecordId=s.recordId(savedRow._id||savedRow.id);
      if(!rejectionRecordId){field.notify('บันทึกเหตุผลแล้ว แต่ไม่พบ record id สำหรับ Apply สถานะ','error',5000);return;}
      if(s.rejectLoading)return;
      s.rejectLoading=true;
      try{
        const p=await s.processCall(REJECT_PROCESS_ID,{action:'reject_item',item_id:itemId,rejection_record_id:rejectionRecordId,order_id:orderId,order_number:orderNumber,section_code:sectionCode});
        s.rejectLoading=false;
        if(!p||p.success===false){field.notify((p&&p.message)||'ปฏิเสธ LAB Item ไม่สำเร็จ','error',5000);return;}
        const d=p.data||{};
        item.current_status='rejected';item.work_status='rejected';
        item.rejected_at=s.text(d.rejected_at);item.rejected_by=d.rejected_by||'';
        item.reject_reason_code=s.text(d.reject_reason_code);item.reject_reason_detail=s.text(d.reject_reason_detail);
        item.reject_reason=item.reject_reason_detail||item.reject_reason_code||'ปฏิเสธ';
        const next={...s.selected};delete next[itemId];s.selected=next;
        field.notify(p.message||'ปฏิเสธ LAB Item แล้ว',d.audit_sync_pending?'warning':'success',d.audit_sync_pending?5000:3000);
        if(typeof form.subFormClose==='function')form.subFormClose();
        s.loadOrders();s.refreshCounts();
      }catch(error){s.rejectLoading=false;field.notify(s.text(error&&error.message)||'เรียก Reject API ไม่สำเร็จ','error',5000);}
    }
  });
};

s.resetCancelDialog=()=>{if(s.cancelDialog.loading)return;s.cancelDialog={visible:false,loading:false,order:null,reason:''};};
s.openCancelOrder=order=>{
  if(!s.canCancelOrder(order)){field.notify('ยกเลิกทั้ง Order ได้เฉพาะรายการที่ยังรอรับหรือรับแล้วแต่ยังไม่ส่ง Agent/LIS','warning',4500);return;}
  s.selected={};
  s.cancelDialog={visible:true,loading:false,order:order,reason:''};
};
s.submitCancelOrder=async()=>{
  const order=s.cancelDialog.order,reason=s.text(s.cancelDialog.reason);
  if(!order){field.notify('ไม่พบ Order ที่ต้องการยกเลิก','error',3500);return;}
  if(!reason){field.notify('กรุณาระบุเหตุผลการยกเลิก Order','warning',3500);return;}
  if(s.cancelDialog.loading)return;
  s.cancelDialog={...s.cancelDialog,loading:true};
  try{
    const p=await s.processCall(PROCESS_ID,{action:'cancel_order',organization_code:s.unitCode(),order_id:s.text(order.order_id),order_number:s.text(order.order_number),cancel_reason:reason});
    if(!p||p.success===false){s.cancelDialog={...s.cancelDialog,loading:false};field.notify((p&&p.message)||'ยกเลิก LAB Order ไม่สำเร็จ','error',5500);return;}
    const d=p.data||{},terminal=['cancelled','rejected','returned','reversed'];
    (Array.isArray(order.items)?order.items:[]).forEach(item=>{
      if(terminal.includes(s.text(item&&item.current_status).toLowerCase()))return;
      item.current_status='cancelled';item.work_status='cancelled';
      item.cancel_type=s.text(d.cancel_type)||'lab_order_cancelled';item.cancel_reason=s.text(d.cancel_reason)||reason;
      item.cancelled_at=s.text(d.cancelled_at);item.cancelled_by=d.cancelled_by||'';
    });
    s.cancelDialog={visible:false,loading:false,order:null,reason:''};
    field.notify(p.message||'ยกเลิก LAB Order แล้ว',d.audit_sync_pending?'warning':'success',d.audit_sync_pending?5000:3200);
    s.loadOrders();s.refreshCounts();
  }catch(error){s.cancelDialog={...s.cancelDialog,loading:false};field.notify(s.text(error&&error.message)||'เรียก API ยกเลิก Order ไม่สำเร็จ','error',5500);}
};

s.notifyPending=label=>field.notify(label+' รอการเชื่อมต่อ','info',2500);
s.mockRetest=order=>{
  const orderNo=s.text(order&&order.order_number)||'Order นี้';
  field.notify('ตรวจใหม่ (Mock) · '+orderNo+' — เมื่อเชื่อม Write API ระบบจะสร้าง Order No. ใหม่ที่อ้างอิงรายการเดิม และสร้าง LAB NO. เมื่อรับ specimen','info',6000);
};
s.reportCommand=type=>s.notifyPending(type==='excel'?'Report Excel':'Report PDF');
s.openCreateOrder=()=>{
  const form=field.getFormRef&&field.getFormRef();
  if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิด CPOE Order App','error',3000);return;}
  const sectionCodes=Array.isArray(s.allowedSectionCodes)?s.allowedSectionCodes.slice():[];
  if(!sectionCodes.length){field.notify('Organization นี้ยังไม่ได้ผูก Section LAB จึงสร้างรายการไม่ได้','warning',4000);return;}
  form.openForm(CPOE_ORDER_APP_ID,'','',null,{backdrop:false,params:Object.assign({},form.formParams||{}, {
    manual_visit:true,
    source:'lab-worklist',
    lab_scope:true,
    organization_code:s.unitCode(),
    section_codes:sectionCodes
  })});
};
s.openEmr=order=>{
  const form=field.getFormRef&&field.getFormRef();
  const visitId=s.orderVisitId(order);
  if(!visitId){field.notify('Order นี้ไม่มี Visit ID สำหรับเปิด EMR History','warning',3000);return;}
  if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิด EMR','error',3000);return;}
  form.openForm(EMR_FORM_ID,'','',null,{backdrop:false,popupType:'dialog',readonly:true,params:Object.assign({},form.formParams||{},{source:'lab-worklist',lab_deep_link:true,visit_id:visitId})});
};

s.extractProcess=out=>{const c=[out,out&&out.data,out&&out.data&&out.data.data,out&&out.reply&&out.reply.data];for(let i=0;i<c.length;i++){const x=c[i];if(x&&typeof x==='object'&&(typeof x.success==='boolean'||(x.data&&Array.isArray(x.data.orders))))return x;}return out||{};};
s.extractPayload=out=>{const p=s.extractProcess(out);const c=[p&&p.data,p,out&&out.data&&out.data.data,out&&out.data];for(let i=0;i<c.length;i++){if(c[i]&&Array.isArray(c[i].orders))return c[i];}return null;};
s.api=()=>field.globalUserState||((field.getFormRef&&field.getFormRef())||{}).userState;
s.processCall=(id,params)=>new Promise((resolve,reject)=>{
  const api=s.api();
  if(!api||typeof api.runProcess!=='function'){reject(new Error('ไม่พบ API Process connector'));return;}
  api.runProcess(id,params||{},out=>resolve(s.extractProcess(out)),error=>reject(error||new Error('เรียก API Process ไม่สำเร็จ')));
});
s.unitCode=()=>{const user=field.globalUserState&&field.globalUserState.user;return s.text(user&&user.unit&&user.unit.code).toUpperCase();};
s.params=(statuses,limit,page)=>{
  const scopedStatuses=Array.isArray(statuses)?statuses:[];
  const p={statuses:scopedStatuses,page:page||s.page.current,limit:limit||s.page.size,organization_code:s.unitCode()};
  const hn=s.scanMode?s.scannedHn:s.text(s.filters.hn);
  if(hn)p.hn=hn;
  const allCompletedHistory=s.scanMode&&scopedStatuses.length===1&&scopedStatuses[0]==='completed';
  if(!allCompletedHistory&&s.filters.dates&&s.filters.dates.length===2){p.date_from=s.filters.dates[0];p.date_to=s.filters.dates[1];}
  return p;
};
s.call=(params,ok,fail)=>{s.processCall(PROCESS_ID,params).then(p=>{if(p&&p.success===false){fail(new Error(p.message||'API ปฏิเสธคำขอ'));return;}const payload=s.extractPayload(p);if(!payload){fail(new Error('รูปแบบ response ไม่ตรงกับ LAB worklist contract'));return;}ok(payload);}).catch(error=>fail(error||new Error('เรียก API ไม่สำเร็จ')));};
s.refreshCounts=()=>{const seq=++s.countSeq;s.statusFilters.forEach(filter=>{const p=s.params(s.statusMap[filter.key],1,1);p.include_specimens=false;s.call(p,payload=>{if(seq!==s.countSeq)return;s.counts={...s.counts,[filter.key]:Number(payload.total||0)};},()=>{});});};
s.loadOrders=()=>{const seq=++s.loadSeq;s.loading=true;s.errorMessage='';s.selected={};s.specimenEdits={};s.call(s.params(s.statusMap[s.statusKey]),payload=>{if(seq!==s.loadSeq)return;s.orders=payload.orders||[];s.specimenMasterOptions=Array.isArray(payload.specimen_options)?payload.specimen_options:[];s.allowedSectionCodes=Array.isArray(payload.section_codes)?payload.section_codes.map(code=>s.text(code).toUpperCase()).filter(Boolean):[];s.page={...s.page,current:Number(payload.page||s.page.current),size:Number(payload.limit||s.page.size),total:Number(payload.total||0)};s.loading=false;if(s.scanNoticePending){s.scanNoticePending=false;field.notify(s.orders.length?'พบรายการของ HN '+s.scannedHn:'ไม่พบรายการของ HN '+s.scannedHn+' ในสถานะนี้',s.orders.length?'success':'warning',3500);}},()=>{if(seq!==s.loadSeq)return;s.orders=[];s.specimenMasterOptions=[];s.allowedSectionCodes=[];s.page={...s.page,total:0};s.errorMessage='โหลดรายการไม่สำเร็จ';s.scanNoticePending=false;s.loading=false;});};
s.applyFilters=()=>{s.scanMode=false;s.scannedHn='';s.scanNoticePending=false;s.page={...s.page,current:1};s.loadOrders();s.refreshCounts();};
s.setStatus=key=>{if(!s.statusMap[key]||s.statusKey===key)return;s.statusKey=key;s.page={...s.page,current:1};s.loadOrders();};
s.setPage=page=>{s.page={...s.page,current:Number(page)||1};s.loadOrders();};
s.setPageSize=size=>{s.page={...s.page,current:1,size:Number(size)||30};s.loadOrders();};
s.handleUnitChange=()=>{const next=s.unitCode();if(next===s.currentUnitCode)return;s.currentUnitCode=next;s.expanded={};s.page={...s.page,current:1,total:0};s.loadOrders();s.refreshCounts();};`

form.formConfig.cssCode = `.lab-cpoe{--primary:var(--el-color-primary,#409eff);--success:var(--el-color-success,#67c23a);--warning:var(--el-color-warning,#e6a23c);--danger:var(--el-color-danger,#f56c6c);--ink:var(--el-text-color-primary,#303133);--text:var(--el-text-color-regular,#606266);--muted:var(--el-text-color-secondary,#909399);--placeholder:var(--el-text-color-placeholder,#a8abb2);--border:var(--el-border-color,#dcdfe6);--border-light:var(--el-border-color-light,#e4e7ed);--border-lighter:var(--el-border-color-lighter,#ebeef5);--fill:var(--el-fill-color,#f0f2f5);--fill-light:var(--el-fill-color-light,#f5f7fa);--fill-lighter:var(--el-fill-color-lighter,#fafafa);--white:var(--el-bg-color,#fff);--mono:"SFMono-Regular","Roboto Mono",Consolas,monospace;width:100%;padding:0 0 36px;background:var(--white);color:var(--text);font-family:"Leelawadee UI","Noto Sans Thai",Tahoma,"Segoe UI",sans-serif;font-size:13px;line-height:1.4}
.lab-cpoe *{box-sizing:border-box}
.lab-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.lab-toolbar .el-button+.el-button{margin-left:0}
.lab-search-control{width:290px}.lab-toolbar .lab-date-control{width:220px!important;flex:0 0 220px}.lab-create-button{margin-left:auto}
.lab-dropdown-caret{margin-left:5px;color:var(--muted);font-size:12px}
.lab-scan-context{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:0 0 10px;padding:8px 10px;border:1px solid #a0cfff;border-radius:6px;background:#ecf5ff;color:#337ecc}.lab-scan-context-label{font-size:11px;font-weight:700}.lab-scan-context strong{color:var(--ink);font-size:14px}.lab-scan-context>span:not(.lab-scan-context-label){font-size:11px}.lab-scan-context .el-button{margin-left:auto}
.lab-status-strip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.lab-status-chip{--chip-color:var(--primary);--chip-border:var(--primary);display:flex;align-items:baseline;gap:6px;padding:6px 12px;border:1px solid var(--border-light);border-radius:6px;background:var(--fill-light);color:var(--muted);font:inherit;cursor:pointer;transition:border-color .15s,background-color .15s;user-select:none}
.lab-status-chip strong{color:var(--chip-color);font-size:18px;line-height:1}.lab-status-chip span{font-size:12px}
.lab-status-chip[data-status="active"]{--chip-color:var(--warning);--chip-border:var(--warning)}.lab-status-chip[data-status="complete"]{--chip-color:var(--success);--chip-border:var(--success)}.lab-status-chip[data-status="cancelled"]{--chip-color:var(--danger);--chip-border:var(--danger)}
.lab-status-chip:hover,.lab-status-chip.is-active{border-color:var(--chip-border)}.lab-status-chip.is-active{background:var(--fill)}
.lab-list-summary{margin:0 0 8px;color:var(--muted);font-size:12px}.lab-list-summary.is-error{color:var(--danger)}
.lab-worklist-shell{border-top:1px solid var(--border);border-bottom:1px solid var(--border)}.lab-worklist{width:100%;min-width:0;background:var(--white)}
.lab-list-head,.lab-patient-row{display:grid;grid-template-columns:32px minmax(210px,1.45fr) minmax(220px,1.45fr) 78px 90px minmax(150px,1.2fr) minmax(155px,1.3fr) 78px 58px 58px;gap:10px;align-items:center;padding:8px 10px}
.lab-list-head{color:var(--muted);font-size:11px;font-weight:650;border-bottom:1px solid var(--border);letter-spacing:.02em}
.lab-patient-block{position:relative;border-bottom:1px solid var(--border-lighter);content-visibility:auto;contain-intrinsic-size:74px}.lab-patient-block:last-child{border-bottom:0}
.lab-patient-row{min-height:74px;background:var(--white);transition:background-color .15s}.lab-patient-row:hover{background:var(--fill-light)}.lab-patient-block.is-open>.lab-patient-row{background:var(--fill)}
.lab-expand-button{display:grid;width:28px;height:30px;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--muted);cursor:pointer}.lab-expand-button:hover{background:var(--fill-light);color:var(--primary)}.lab-expand-button svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;transition:transform .16s}.lab-patient-block.is-open .lab-expand-button svg{transform:rotate(90deg)}
.lab-patient-summary,.lab-context-tags,.lab-metric,.lab-doctor-cell{min-width:0}.lab-patient-hn{display:flex;align-items:center;gap:6px;min-width:0;color:var(--ink);font-weight:700}.lab-patient-hn .lab-mono{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lab-patient-name{margin-top:1px;overflow:hidden;color:var(--ink);font-weight:650;text-overflow:ellipsis;white-space:nowrap}.lab-patient-demographic{display:flex;align-items:center;gap:6px;margin-top:1px;color:var(--muted);font-size:11px}
.lab-inline-tag,.lab-state-tag{display:inline-flex;min-height:20px;align-items:center;justify-content:center;padding:1px 6px;border:1px solid;border-radius:4px;font-size:10px;font-weight:650;white-space:nowrap}.lab-urgent-tag{min-height:18px;padding:0 5px;border-color:#fab6b6;background:#fef0f0;color:#c45656;font-size:9px}.lab-meta-pill{min-height:21px;padding:1px 8px;border-color:#c8c9cc;border-radius:999px;background:var(--white);color:var(--text)}.lab-gender-pill{min-height:18px;padding:0 6px;border-color:#c8c9cc;border-radius:999px;background:var(--white);color:var(--text);font-size:9px}
.lab-context-top{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:4px}.lab-context-top .lab-meta-pill:first-child{border-color:#a0cfff;background:#ecf5ff;color:#337ecc}.lab-context-top .lab-meta-pill:last-child{border-color:#b3e19d;background:#f0f9eb;color:#529b2e}.lab-context-tags>.lab-meta-pill{border-color:#f3d19e;background:#fdf6ec;color:#b88230}.lab-prior-medication{display:flex;width:max-content;max-width:100%;min-height:22px;align-items:center;margin:0 0 4px;padding:1px 9px;overflow:hidden;border:1px solid #fab6b6;border-radius:999px;background:#fef0f0;color:#c45656;font-size:11px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}
.lab-field-value{display:block;min-width:0;overflow:hidden;color:var(--ink);font-size:12px;font-weight:650;text-overflow:ellipsis;white-space:nowrap}.lab-hover-summary{cursor:help}.lab-time-value{margin-top:3px;line-height:1.25}.lab-time-value span{display:block}.lab-order-no-tag{display:inline-flex;max-width:100%;min-height:18px;align-items:center;padding:0 6px;overflow:hidden;border:1px solid #a0cfff;border-radius:999px;background:#ecf5ff;color:#337ecc;font-family:var(--mono);font-size:9px;text-overflow:ellipsis;white-space:nowrap}.lab-diagnosis-summary{display:block;max-width:100%;margin-top:2px;overflow:hidden;color:var(--muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap;cursor:help}.lab-cpoe-list-popper .lab-pop-line{line-height:1.5;white-space:nowrap}.lab-cpoe-diagnosis-popper{max-width:420px}.lab-cpoe-diagnosis-popper .lab-diagnosis-pop{line-height:1.5;white-space:normal;overflow-wrap:anywhere}
.lab-row-status{display:inline-flex;min-height:22px;align-items:center;justify-content:center;justify-self:start;padding:1px 7px;border:1px solid;border-radius:4px;font-size:10px;font-weight:650;white-space:nowrap}.status-waiting{border-color:#f3d19e;background:#fdf6ec;color:#b88230}.status-received,.status-resulted,.status-result-complete{border-color:#b3e19d;background:#f0f9eb;color:#529b2e}.status-result-partial{border-color:#f3d19e;background:#fdf6ec;color:#b88230}.status-cancelled{border-color:#fab6b6;background:#fef0f0;color:#c45656}.status-mixed{border-color:#c8c9cc;background:#f4f4f5;color:#73767a}
.lab-plain-action{width:100%;margin:0!important;padding:5px 7px!important;font-size:11px}
.lab-order-report{display:block;width:100%;padding:0!important}
.lab-order-report .el-button{width:100%;margin:0!important;padding:5px 7px!important;font-size:11px}
.lab-detail-panel{padding:0 10px 14px 42px;border-top:1px solid var(--border-lighter);background:var(--fill-lighter)}.lab-detail-top{display:flex;min-height:42px;align-items:flex-end;gap:16px;border-bottom:1px solid var(--border-light)}.lab-detail-tab{height:42px;padding:0;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:650;cursor:pointer}.lab-detail-tab.is-active{border-bottom-color:var(--primary);color:var(--primary)}.lab-detail-tab:disabled{color:var(--placeholder);cursor:not-allowed}.lab-bulk-actions{display:flex;align-items:center;gap:6px;margin-left:auto;padding-bottom:6px}.lab-bulk-actions .el-button+.el-button{margin-left:0}
.lab-item-grid-wrap{overflow-x:auto;padding-top:10px}.lab-item-grid{display:grid;grid-template-columns:38px 52px 100px minmax(190px,1.5fr) minmax(170px,1.1fr) 135px 125px 86px minmax(115px,.9fr) minmax(105px,.8fr);gap:10px;align-items:center;min-width:1180px;padding:6px 0}.lab-item-head{color:var(--muted);font-size:11px;font-weight:650;border-bottom:1px solid var(--border)}.lab-item-row{min-height:52px;border-bottom:1px dashed var(--border-lighter);font-size:12px;transition:background-color .12s}.lab-item-row:last-child{border-bottom:0}.lab-item-row.is-selectable{cursor:pointer}.lab-item-row.is-selectable:hover{background:var(--fill-light)}.lab-item-row.is-selected,.lab-item-row.is-selected:hover{background:#ecf5ff}.lab-test-name{color:var(--ink);font-weight:650}.lab-item-specimen-cell{padding-right:8px;transform:translateX(-8px)}.lab-specimen-select{width:100%}.lab-specimen-select .el-select__wrapper{min-height:30px}.lab-specimen-select .el-select__selected-item{color:var(--text);font-weight:700}.lab-specimen-select.lab-specimen-changed .el-select__selected-item{color:#c45656;font-weight:700}.lab-item-collected-time span{display:block;font-weight:400;line-height:1.35}.lab-item-row [data-label]:before{display:none}
.lab-result-list{padding-top:10px}.lab-result-list-head,.lab-result-list-row{display:grid;grid-template-columns:52px minmax(260px,1.8fr) 130px 120px minmax(120px,.8fr);gap:12px;align-items:center;padding:8px 0}.lab-result-list-head{border-bottom:1px solid var(--border);color:var(--muted);font-size:11px;font-weight:650}.lab-result-list-row{min-height:48px;border-bottom:1px dashed var(--border-lighter)}.lab-critical-status{display:inline-flex;min-height:26px;align-items:center;padding:2px 8px;border:1px solid;border-radius:4px;font-size:11px;font-weight:650;white-space:nowrap}.lab-critical-status.is-critical{border-color:#fab6b6;background:#fef0f0;color:#c45656}.lab-critical-status.is-normal{border-color:#b3e19d;background:#f0f9eb;color:#529b2e}.lab-critical-status.is-pending{border-color:#c8c9cc;background:#f4f4f5;color:#73767a}
.lab-cancel-summary{display:grid;gap:6px;margin-bottom:14px;padding:13px 14px;border:1px solid #fab6b6;border-radius:6px;background:#fef0f0;color:#c45656}.lab-cancel-summary strong{color:var(--ink)}.lab-cancel-summary span{font-size:12px;line-height:1.5}.lab-cancel-reason{display:block}.lab-cancel-reason>span{display:block;margin-bottom:6px;color:var(--ink);font-weight:650}.lab-cancel-reason b{color:var(--danger)}
.lab-manual-form{min-height:210px}.lab-manual-context{display:grid;grid-template-columns:1.5fr 1fr .9fr;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--border-light)}.lab-manual-context>div{min-width:0}.lab-result-dialog-action{position:relative;padding-right:42px}.lab-result-dialog-action>.el-button{position:absolute;top:0;right:0}.lab-manual-context span,.lab-manual-fields label>span,.lab-result-value-row>div>span{display:block;margin-bottom:4px;color:var(--muted);font-size:11px;font-weight:650}.lab-manual-context strong{display:block;overflow:hidden;color:var(--ink);text-overflow:ellipsis;white-space:nowrap}.lab-result-values{margin-top:12px;border-top:1px solid var(--border-light);overflow-x:auto}.lab-result-value-row{display:grid;grid-template-columns:minmax(160px,1.15fr) minmax(118px,.8fr) minmax(125px,.85fr) minmax(135px,.95fr) minmax(100px,.7fr) minmax(100px,.7fr);gap:12px;min-width:900px;padding:11px 0;border-bottom:1px solid var(--border-lighter)}.lab-result-value-row>div{min-width:0}.lab-result-value-row strong,.lab-result-value-row small{display:block;overflow-wrap:anywhere}.lab-result-value-row small{margin-top:2px;color:var(--muted);font-size:10px}.lab-result-measured{font-size:17px}.lab-result-previous{padding:7px 9px;border-radius:5px;background:var(--fill-light)}.lab-result-previous .lab-result-measured{color:#73767a}.lab-critical-value{color:var(--danger)}.lab-previous-result{margin:12px 0;padding:10px 12px;border:1px solid #b3d8ff;border-radius:6px;background:#ecf5ff;color:#337ecc}.lab-previous-result.is-empty{border-color:var(--border-light);background:var(--fill-light);color:var(--muted)}.lab-manual-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}.lab-manual-fields label{display:block;min-width:0}.lab-manual-fields .el-select{width:100%}.lab-manual-hint{margin-top:9px;color:var(--muted);font-size:11px}
.lab-empty{padding:34px 20px;text-align:center;color:var(--muted);line-height:1.7}.lab-empty strong{color:var(--ink)}.lab-pagination{display:flex;justify-content:flex-end;padding-top:10px}.lab-mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
@media(max-width:1100px){.lab-list-head{display:none}.lab-patient-row{grid-template-columns:32px minmax(180px,1.4fr) minmax(130px,1fr) minmax(135px,1fr) 58px 58px;gap:6px 10px}.lab-expand-button{grid-column:1;grid-row:1/3}.lab-patient-summary{grid-column:2;grid-row:1}.lab-context-tags{grid-column:3;grid-row:1}.lab-row-status{grid-column:4;grid-row:1}.lab-patient-row>.lab-plain-action:nth-last-child(2){grid-column:5;grid-row:1}.lab-patient-row>.lab-plain-action:last-child{grid-column:6;grid-row:1}.lab-items-cell{grid-column:2;grid-row:2}.lab-specimen-cell{grid-column:3;grid-row:2}.lab-order-cell{grid-column:4;grid-row:2}.lab-doctor-cell{grid-column:5/7;grid-row:2}.lab-metric:before,.lab-doctor-cell:before{display:block;content:attr(data-label);margin-bottom:3px;color:var(--muted);font-size:10px;font-weight:650}}
@media(max-width:900px){.lab-search-control{width:calc(50% - 5px)}.lab-date-control{width:calc(50% - 5px)}.lab-create-button{margin-left:0}.lab-item-grid-wrap{overflow:visible}.lab-item-head{display:none}.lab-item-grid.lab-item-row{display:grid;grid-template-columns:1fr 1fr;gap:0 14px;min-width:0;padding:10px 0}.lab-item-row>div{display:grid;grid-template-columns:minmax(92px,.42fr) minmax(0,1fr);align-items:center;gap:8px;min-height:34px;padding:3px 0;border-bottom:1px dashed var(--border-lighter)}.lab-item-row>div:before{display:block;content:attr(data-label);color:var(--muted);font-size:10px;font-weight:650}.lab-item-row>div:last-child{border-bottom:0}.lab-item-specimen-cell{padding-right:0;transform:none}.lab-item-collected-time span:last-child{grid-column:2}.lab-specimen-select{max-width:none}.lab-result-list-head,.lab-result-list-row{grid-template-columns:44px minmax(180px,1fr) 110px 120px 82px}}
@media(max-width:720px){.lab-toolbar{display:grid;grid-template-columns:1fr 1fr;gap:8px}.lab-search-control,.lab-toolbar .lab-date-control{width:100%!important;max-width:none;flex:auto;grid-column:1/-1}.lab-toolbar>.el-button,.lab-toolbar>.el-dropdown{width:100%}.lab-toolbar>.el-dropdown .el-button{width:100%}.lab-create-button{grid-column:1/-1}.lab-scan-context .el-button{width:100%;margin-left:0}.lab-status-strip{flex-wrap:nowrap;overflow-x:auto;padding-bottom:3px}.lab-status-chip{flex:0 0 auto}.lab-patient-row{grid-template-columns:28px minmax(0,1fr) 58px 58px;padding:9px 8px}.lab-expand-button{grid-column:1;grid-row:1}.lab-patient-summary{grid-column:2;grid-row:1}.lab-row-status{grid-column:3/5;grid-row:1;justify-self:end}.lab-context-tags{grid-column:2/5;grid-row:2}.lab-items-cell{grid-column:2;grid-row:3}.lab-specimen-cell{grid-column:3/5;grid-row:3}.lab-order-cell{grid-column:2/5;grid-row:4}.lab-doctor-cell{grid-column:2/5;grid-row:5}.lab-patient-row>.lab-plain-action:nth-last-child(2){grid-column:3;grid-row:6}.lab-patient-row>.lab-plain-action:last-child{grid-column:4;grid-row:6}.lab-detail-panel{padding:0 8px 12px}.lab-detail-top{align-items:flex-start;flex-wrap:wrap}.lab-bulk-actions{width:100%;margin:0;padding-bottom:7px;flex-wrap:wrap}.lab-item-grid.lab-item-row{grid-template-columns:1fr}.lab-pagination{justify-content:flex-start;overflow-x:auto}.lab-manual-context,.lab-manual-fields{grid-template-columns:1fr}.lab-result-list-head{display:none}.lab-result-list-row{grid-template-columns:1fr 1fr}.lab-result-list-row>div:nth-child(2){grid-column:1/-1;grid-row:1}}
@media(prefers-reduced-motion:reduce){.lab-cpoe *{scroll-behavior:auto!important;transition-duration:.001ms!important}}`

fs.writeFileSync(outputPath, JSON.stringify(form, null, 2) + '\n')
