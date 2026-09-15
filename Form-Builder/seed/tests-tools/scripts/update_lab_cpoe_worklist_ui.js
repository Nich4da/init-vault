const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const formPath = path.join(root, 'Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json')
const outputPath = process.env.LAB_WORKLIST_OUTPUT || formPath
const defaultOrderRequestReportId = '6a977ac8422c1ca959829f97'
const resultReportFormId = '6a8d4334f851000f28e5025b'
/* ปุ่ม HN ระดับ Order — เปลี่ยนเป็น "ป้ายติดแฟ้ม (HN)" ตามคำสั่งผู้ใช้ 2026-09-04
   ("เอาเข้า lab ให้ด้วย") ต่อจากฝั่ง X-ray ที่ย้ายไปแล้วในวันเดียวกัน
   ของเดิม `5256d813009293b480d0a15c` (ป้ายติดแฟ้ม/VN) รับ `xparentx` = Visit ID
   ของใหม่รับ `hn` อย่างเดียว ⇒ ต้องเปลี่ยน ready()/params() คู่กันเสมอ ไม่ใช่แค่เลข Report */
const defaultHnOrderReportId = '6a9a355c422c1ca95982a1a2'
const orderRequestReportId = String(
  process.env.LAB_ORDER_REQUEST_REPORT_ID === undefined
    ? defaultOrderRequestReportId
    : process.env.LAB_ORDER_REQUEST_REPORT_ID
).trim()
if (orderRequestReportId && !/^[a-f0-9]{24}$/i.test(orderRequestReportId)) {
  throw new Error('LAB_ORDER_REQUEST_REPORT_ID must be the 24-character existing Report Factory ID')
}
const hnOrderReportId = String(
  process.env.LAB_HN_ORDER_REPORT_ID === undefined
    ? defaultHnOrderReportId
    : process.env.LAB_HN_ORDER_REPORT_ID
).trim()
if (hnOrderReportId && !/^[a-f0-9]{24}$/i.test(hnOrderReportId)) {
  throw new Error('LAB_HN_ORDER_REPORT_ID must be the 24-character existing Report Factory ID')
}
const orderRequestPdfAction = orderRequestReportId
  ? `<sd-report v-if="!isCancelledOrder(order)&&orderReportReady(order)" class="lab-plain-action lab-order-report"
            :report-list="orderRequestReportList" :params="orderReportParams(order)" size="small" />
          <el-button v-else-if="!isCancelledOrder(order)" class="lab-plain-action" size="small" disabled
            title="Order นี้ไม่มี Order ID, Visit ID หรือ LAB Section สำหรับสร้าง PDF">PDF</el-button>`
  : `<el-button v-if="!isCancelledOrder(order)" class="lab-plain-action" size="small"
            @click="notifyPending('PDF ใบสั่งตรวจ')">PDF</el-button>`
const hnOrderPdfAction = hnOrderReportId
  ? `<sd-report v-if="!isCancelledOrder(order)&&hnOrderReportReady(order)" class="lab-plain-action lab-order-report"
            :report-list="hnOrderReportList" :params="hnOrderReportParams(order)" size="small" />
          <el-button v-else-if="!isCancelledOrder(order)" class="lab-plain-action" size="small" disabled
            title="Order นี้ไม่มี HN สำหรับสร้างป้ายติดแฟ้ม">HN</el-button>`
  : `<el-button v-if="!isCancelledOrder(order)" class="lab-plain-action" size="small"
            @click="notifyPending('HN')">HN</el-button>`
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
      <el-button class="lab-create-button" size="small" type="primary" :loading="createOrderLoading" @click="openCreateOrder">สร้างรายการใหม่</el-button>
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
      <div class="lab-status-legend" aria-label="คำอธิบายสีสถานะ">
        <span class="lab-status-legend-item"><i class="lab-status-legend-dot is-waiting" aria-hidden="true"></i><span>รอรับ</span></span>
        <span class="lab-status-legend-item"><i class="lab-status-legend-dot is-received" aria-hidden="true"></i><span>รับแล้ว</span></span>
        <span class="lab-status-legend-item"><i class="lab-status-legend-dot is-partial" aria-hidden="true"></i><span>ออกผลบางส่วน</span></span>
        <span class="lab-status-legend-item"><i class="lab-status-legend-dot is-complete" aria-hidden="true"></i><span>ออกผลครบ</span></span>
        <span class="lab-status-legend-item"><i class="lab-status-legend-dot is-cancelled" aria-hidden="true"></i><span>ยกเลิก / ปฏิเสธ</span></span>
      </div>
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
        <div>{{ statusKey==='cancelled' ? 'ดำเนินการ' : 'PDF' }}</div><div>{{ statusKey==='cancelled' ? '' : (detailTab(order)==='results' ? 'ดูผล' : 'HN') }}</div><div>{{ statusKey==='cancelled' ? '' : 'EMR' }}</div>
      </div>

      <article v-for="order in orders" :key="order.row_key||order.order_id" class="lab-patient-block"
        :class="{'is-open':isExpanded(order)}">
        <div class="lab-patient-row" @click="toggleOrderFromRow(order,$event)">
          <button class="lab-expand-button" type="button"
            :aria-label="isExpanded(order)?'ย่อรายละเอียด':'ขยายรายละเอียด'"
            :aria-expanded="isExpanded(order)" @click="toggleOrder(order)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"></path></svg>
          </button>

          <div class="lab-patient-summary">
            <div class="lab-patient-hn">
              <span class="lab-mono">{{ text(order.patient && order.patient.hn) || '' }}</span>
              <span v-if="isUrgent(order)" class="lab-inline-tag lab-urgent-tag">เร่งด่วน</span>
            </div>
            <div class="lab-patient-name">{{ patientName(order) || '' }}</div>
            <div class="lab-patient-demographic">
              <span v-if="text(order.patient && order.patient.gender_text)" class="lab-inline-tag lab-gender-pill">
                {{ text(order.patient.gender_text) }}
              </span>
              <span v-if="ageText(order)">{{ ageText(order) }}</span>
            </div>
          </div>

          <div class="lab-context-tags">
            <div class="lab-context-top">
              <span v-if="sourceRoom(order)" class="lab-inline-tag lab-meta-pill lab-source-pill">{{ sourceRoom(order) }}</span>
              <span v-if="showPaid(order)" class="lab-inline-tag lab-meta-pill lab-payment-pill">ชำระเงินแล้ว</span>
              <span v-if="coverageAbbrev(order)" class="lab-inline-tag lab-meta-pill lab-coverage-pill">{{ coverageAbbrev(order) }}</span>
            </div>
            <span v-if="hasPriorMedication(order)" class="lab-prior-medication">💊 {{ priorMedicationText(order) }}</span>
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
            <span class="lab-order-no-tag">{{ text(order.order_number) || '' }}</span>
            <span class="lab-field-value lab-time-value lab-mono">
              <span>{{ datePart(order.requested_at) }}</span><span>{{ timePart(order.requested_at) }}</span>
            </span>
          </div>

          <div class="lab-doctor-cell" data-label="แพทย์">
            <span class="lab-field-value" :title="requesterName(order)">{{ requesterName(order) || '' }}</span>
            <el-tooltip placement="top" :disabled="!diagnosisText(order)" popper-class="lab-cpoe-diagnosis-popper">
              <span class="lab-diagnosis-summary">Diagnosis:<template v-if="diagnosisText(order)"> {{ diagnosisText(order) }}</template></span>
              <template #content><div class="lab-diagnosis-pop">{{ diagnosisText(order) }}</div></template>
            </el-tooltip>
          </div>
          <!-- สถานะระดับ Order แสดงจำนวน Item ต่อสี; ชื่อสถานะอ่านจาก legend ด้านบน -->
          <div class="lab-row-status-check" role="img" :aria-label="orderStatusCountAria(order)" :title="orderStatusCountAria(order)">
            <span v-for="step in orderStatusCounts(order)" :key="step.key" class="lab-order-status-step" :class="step.dot_class" :title="step.title">
              <i class="lab-order-status-dot" aria-hidden="true"></i><b>{{ step.count }}</b>
            </span>
          </div>
          ${orderRequestPdfAction}
          <el-button v-else class="lab-plain-action" type="primary" size="small"
            :loading="isRetesting(order)" :disabled="isRetesting(order)"
            title="นำรายการเดิมกลับไปรอรับ specimen · ล้าง LAB NO. เดิมและสร้างใหม่เมื่อกดรับ"
            @click="retestOrder(order)">ตรวจใหม่</el-button>
          <el-button v-if="!isCancelledOrder(order)&&detailTab(order)==='results'" class="lab-plain-action" size="small"
            :disabled="!resultItems(order).length"
            :aria-label="'ดูผลของ '+(text(order.patient&&order.patient.hn)||'Order นี้')"
            @click="openOrderResults(order)">ดูผล</el-button>
          <template v-else>
            ${hnOrderPdfAction}
            <span v-else class="lab-action-placeholder" aria-hidden="true"></span>
          </template>
          <el-button v-if="!isCancelledOrder(order)" class="lab-plain-action" size="small" @click="openEmr(order)">EMR</el-button>
          <span v-else class="lab-action-placeholder" aria-hidden="true"></span>
        </div>

        <div v-if="isExpanded(order)" class="lab-detail-panel">
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
              <el-button size="small" type="warning" :loading="rejectLoading"
                :disabled="selectedCount(order)!==1||receiveLoading||rejectLoading||cancelDialog.loading"
                @click="rejectSelected(order)">ปฏิเสธรายการที่เลือก</el-button>
              <el-button size="small" type="danger" :loading="cancelDialog.loading&&cancelDialog.order===order"
                :disabled="!canCancelOrder(order)||receiveLoading||rejectLoading||cancelDialog.loading"
                @click="openCancelOrder(order)">ยกเลิก order</el-button>
            </div>
          </div>

          <div v-if="detailTab(order)==='order'" class="lab-item-grid-wrap">
            <div class="lab-item-grid lab-item-head">
              <div class="lab-item-check-cell"><el-checkbox :model-value="allSelectableChecked(order)"
                :indeterminate="someSelectableChecked(order)" :disabled="!selectableItems(order).length"
                aria-label="เลือกทุกรายการที่รอรับ" @change="toggleAll(order)" /></div>
              <div>ลำดับ</div><div>Lab no.</div><div>รายการสั่งตรวจ</div><div>specimen</div>
              <div>เวลาเก็บ specimen</div><div>เวลารับ specimen</div><div>สถานะ</div><div>เหตุผล</div><div>ผู้ดำเนินการ</div>
            </div>
            <div v-for="(item,index) in order.items" :key="item.item_id" class="lab-item-grid lab-item-row"
              :class="{'is-selectable':item.current_status==='sent','is-selected':isSelected(item.item_id)}"
              @click="selectRow(order,item,$event)">
              <div data-label="เลือก" class="lab-item-check-cell"><el-checkbox :model-value="isSelected(item.item_id)"
                :disabled="item.current_status!=='sent'" @change="toggleItem(order,item.item_id)" /></div>
              <div data-label="ลำดับ" class="lab-mono">{{ index+1 }}</div>
              <div data-label="Lab no." class="lab-mono">{{ text(item.lab_no) || '' }}</div>
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
              <div><el-button size="small" type="primary" @click="openResult(item,order,false)">แก้ไขผล</el-button></div>
              <div class="lab-result-list-status"><span class="lab-critical-status" :class="criticalClass(item)">{{ criticalText(item) }}</span><span v-if="resultHiddenItem(item)" class="lab-result-hidden-tag">ปกปิด</span></div>
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
      <strong>Order No. {{ text(cancelDialog.order && cancelDialog.order.order_number) || '' }}</strong>
      <span>ระบบจะยกเลิกเฉพาะ LAB Item ของ Section นี้ใน Order เดิม และเก็บผู้ทำรายการกับเวลาไว้ใน audit</span>
      <span>ถ้ารายการถูกส่งไป Agent/LIS แล้ว ระบบจะหยุดและไม่ยกเลิกเฉพาะฝั่ง HIS</span>
    </div>
    <label class="lab-cancel-reason"><span>เหตุผลการยกเลิก <b>*</b></span>
      <el-select v-model="cancelDialog.reason" filterable clearable :disabled="cancelDialog.loading"
        placeholder="กรุณาเลือกเหตุผล">
        <el-option v-for="option in rejectReasonOptions" :key="option.value"
          :label="option.label" :value="option.value" />
      </el-select>
    </label>
    <template #footer>
      <el-button :disabled="cancelDialog.loading" @click="cancelDialog.visible=false">ไม่ยกเลิก</el-button>
      <el-button type="danger" :loading="cancelDialog.loading" :disabled="!text(cancelDialog.reason)"
        @click="submitCancelOrder">ยืนยันยกเลิก Section นี้</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="manual.visible" class="lab-result-dialog" width="min(1040px,calc(100vw - 32px))"
    :close-on-click-modal="false" destroy-on-close @closed="resetManual">
    <template #header>
      <div class="lab-result-dialog-head">
        <div>
          <div class="lab-result-title-row">
            <strong>ผลตรวจทางห้องปฏิบัติการ</strong>
            <button class="lab-result-edit-button" type="button"
            :disabled="manual.loading || manual.saving || !canEditResult()" :aria-pressed="manual.editing"
            :aria-label="manual.editing ? 'ออกจากโหมดแก้ไขผลตรวจ' : 'แก้ไขผลตรวจทั้งหมด'"
            :title="editResultTitle()" @click="toggleResultEdit">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-1 10-10a2 2 0 0 0-5-5l-10 10L4 20Z"></path><path d="m12 6 5 5"></path></svg>
            </button>
            <span class="lab-result-mode" :class="{'is-editing':manual.editing}">{{ manual.editing ? 'โหมดแก้ไข' : 'โหมดดูอย่างเดียว' }}</span>
            <el-button v-if="!manual.orderView && hasPersistedResult()" class="lab-result-visibility-button" size="small" plain
              :type="resultHidden() ? 'warning' : 'danger'"
              :loading="visibilityDialog.loading"
              :disabled="manual.loading || manual.saving || manual.uploading || manual.editing || visibilityDialog.loading"
              @click="openResultVisibilityDialog">
              {{ resultHidden() ? 'ยกเลิกปกปิด' : 'ปกปิดผล' }}
            </el-button>
            <span v-if="resultHidden()" class="lab-result-hidden-tag">ตั้งสถานะปกปิดแล้ว</span>
          </div>
          <small><span class="lab-mono">{{ manual.data.patient_hn || '-' }}</span> · {{ resultTestCount() }} tests · ผลล่าสุด</small>
        </div>
      </div>
    </template>
    <div v-loading="manual.loading" class="lab-manual-form lab-result-viewer">
      <div v-if="!manual.orderView && resultHidden()" class="lab-result-hidden-notice" role="status">
        <strong>ผลนี้ถูกตั้งสถานะปกปิด</strong>
        <span>{{ manual.data.result_visibility_reason || 'ไม่พบเหตุผล' }}</span>
        <small><template v-if="resultVisibilityActor()">โดย {{ resultVisibilityActor() }}</template><template v-if="manual.data.result_visibility_at"> · {{ compactDateTime(manual.data.result_visibility_at) }}</template></small>
      </div>
      <div class="lab-result-values">
        <div class="lab-result-value-head"><span>#</span><span><span class="lab-sr-only">สถานะ</span></span><span>รายการ</span><span title="ประวัติค่าที่เคยบันทึกของ Item นี้ · อ่านอย่างเดียว">ค่าก่อนหน้า</span><span>ค่าที่ตรวจได้</span><span>unit</span><span>แปลผล</span><span>ค่าปกติ</span></div>
        <template v-for="group in resultGroupsForDisplay()" :key="group.group_key || group.item_id || group.test_code || group.test_name">
          <div class="lab-result-profile-row"><strong>{{ group.test_name || '-' }}</strong></div>
          <div v-for="(result,index) in group.results" :key="result.result_item_id || result.test_code || result.entered_at || index" class="lab-result-value-row">
            <div class="lab-mono">{{ index+1 }}</div>
            <div><i v-if="hasResultValue(result)" class="lab-result-signal" :class="resultSignalClass(result)" :title="resultSignalText(result)"></i></div>
            <div class="lab-result-test-name">{{ result.test_name || group.test_name || '-' }}</div>
            <div class="lab-result-previous lab-mono">{{ result.previous && result.previous.value || '-' }}</div>
            <div><el-input v-if="manual.editing && manual.editMap[result._edit_key]" v-model="manual.editMap[result._edit_key].result_value" type="textarea" :autosize="{minRows:1,maxRows:5}" /><strong v-else class="lab-result-measured">{{ result.result_value || 'รอผล' }}</strong></div>
            <div><el-input v-if="manual.editing && manual.editMap[result._edit_key]" v-model="manual.editMap[result._edit_key].unit" /><template v-else>{{ result.unit || '-' }}</template></div>
            <div><el-select v-if="manual.editing && manual.editMap[result._edit_key]" v-model="manual.editMap[result._edit_key].interpretation" clearable filterable allow-create default-first-option><el-option v-for="option in interpretationOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select><template v-else>{{ result.interpretation || '-' }}</template></div>
            <div class="lab-mono"><el-input v-if="manual.editing && manual.editMap[result._edit_key]" v-model="manual.editMap[result._edit_key].reference_range" /><template v-else>{{ result.reference_range || '-' }}</template></div>
          </div>
        </template>
      </div>
      <div v-if="!manual.loading && !hasRecordedResult()" class="lab-previous-result is-empty">ยังไม่มีผลตรวจ · รอผลจาก LIS หรือกดดินสอเพื่อกรอกผล</div>
      <div v-if="manual.editing" class="lab-manual-hint">การแก้ไขใน HIS จะเก็บผู้แก้และเวลาล่าสุด แต่ไม่คำนวณ Critical ใหม่; ค่า Critical คงใช้ค่าที่ Agent/LIS ส่งมา</div>
      <section v-if="manual.orderView" class="lab-result-attachments" aria-label="ไฟล์แนบผลตรวจระดับ Order">
        <div class="lab-result-attachments-head"><div><strong>ไฟล์แนบผลตรวจ</strong><small>PDF / JPG / JPEG / PNG · ไม่เกิน 10 MB ต่อไฟล์ · สูงสุด 3 ไฟล์</small></div><span>{{ manual.attachments.length }}/3</span></div>
        <div v-if="manual.attachments.length" class="lab-result-file-list"><a v-for="fileItem in manual.attachments" :key="attachmentKey(fileItem)" :href="attachmentUrl(fileItem)" target="_blank" rel="noopener" class="lab-result-file"><span>เอกสาร</span><strong>{{ attachmentName(fileItem) }}</strong><small>{{ attachmentSize(fileItem) }}</small></a></div>
        <el-upload class="lab-result-upload" :action="resultUploadAction()" :headers="resultUploadHeaders()" :data="resultUploadData()"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" :multiple="true" :show-file-list="false"
          :limit="3" :file-list="manual.attachments" :disabled="!canUploadResultFile() || manual.uploading || manual.saving"
          :before-upload="beforeResultUpload" :on-exceed="resultUploadExceed" :on-progress="resultUploadProgress"
          :on-success="resultUploadSuccess" :on-error="resultUploadError">
          <el-button plain type="primary" :loading="manual.uploading" :disabled="!canUploadResultFile() || manual.attachments.length>=3">Upload file</el-button>
        </el-upload>
        <small v-if="!canUploadResultFile()" class="lab-result-upload-note">ไม่พบ LAB Item ใน Order สำหรับผูกไฟล์แนบ</small>
      </section>
    </div>
    <template #footer><el-button @click="manual.editing ? cancelResultEdit() : manual.visible=false">{{ manual.editing ? 'ยกเลิก' : 'ปิด' }}</el-button><el-button v-if="manual.editing" type="primary" :loading="manual.saving" @click="requestSaveResult">บันทึกผล</el-button></template>
  </el-dialog>

  <el-dialog v-model="visibilityDialog.visible" :title="visibilityDialog.targetHidden ? 'ยืนยันปกปิดผล' : 'ยืนยันยกเลิกการปกปิดผล'"
    width="min(560px,94vw)" :close-on-click-modal="false"
    :close-on-press-escape="!visibilityDialog.loading" :show-close="!visibilityDialog.loading"
    @closed="resetVisibilityDialog">
    <div class="lab-visibility-summary">
      <strong>{{ manual.data.test_code || '' }} {{ manual.data.test_name || '' }}</strong>
      <span>LAB NO. {{ manual.data.lab_no || '-' }} · HN {{ manual.data.patient_hn || '-' }}</span>
      <span v-if="visibilityDialog.targetHidden">แพทย์จะเห็นว่ามีรายการตรวจ แต่จะไม่เห็นค่าผลจากหน้าที่เชื่อมกับสถานะนี้ ข้อมูลผลจริงยังคงอยู่ในระบบ</span>
      <span v-else>ค่าผลจะกลับมาแสดงในหน้าที่เชื่อมกับสถานะนี้</span>
      <span v-if="manualCriticalCount()" class="is-critical">รายการนี้มี Critical Result {{ manualCriticalCount() }} ค่า · การปกปิดจะไม่ล้างสถานะหรือ workflow แจ้งค่าวิกฤติ</span>
    </div>
    <label class="lab-visibility-reason"><span>เหตุผล <b>*</b></span>
      <el-input v-model="visibilityDialog.reason" type="textarea" :rows="4" maxlength="1000"
        show-word-limit :disabled="visibilityDialog.loading"
        :placeholder="visibilityDialog.targetHidden ? 'ระบุเหตุผลที่ต้องปกปิดผล' : 'ระบุเหตุผลที่ยกเลิกการปกปิดผล'" />
    </label>
    <template #footer>
      <el-button :disabled="visibilityDialog.loading" @click="visibilityDialog.visible=false">ยกเลิก</el-button>
      <el-button :type="visibilityDialog.targetHidden ? 'danger' : 'primary'"
        :loading="visibilityDialog.loading" :disabled="text(visibilityDialog.reason).length<3"
        @click="submitResultVisibility">
        {{ visibilityDialog.targetHidden ? 'ยืนยันปกปิดผล' : 'ยืนยันแสดงผล' }}
      </el-button>
    </template>
  </el-dialog>
</div>`

widget.onCreated = `const s=this.vueState;
const field=this;
const PROCESS_ID='6a9434c3422c1ca959829d5e';
const RECEIVE_PROCESS_ID='6a94f634422c1ca959829d70';
const REJECT_PROCESS_ID='6a79ff46d5218a5b6a26bebc';
const REJECTION_FORM_ID='6a7713fdcc7d0a8451130331';
const CPOE_ORDER_APP_ID='6a995d064744260ea8c9498c';
const EMR_FORM_ID='6a96557e422c1ca959829eae';
const RESULT_REPORT_FORM_ID='${resultReportFormId}';
const ORDER_REQUEST_REPORT_ID='${orderRequestReportId}';
const HN_ORDER_REPORT_ID='${hnOrderReportId}';
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
const REJECT_REASON_OPTIONS=Object.keys(REJECT_REASON_LABELS).map(value=>({value:value,label:REJECT_REASON_LABELS[value]}));

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
s.hnOrderReportList=HN_ORDER_REPORT_ID?[{reportId:HN_ORDER_REPORT_ID,label:'HN',type:'pdf'}]:[];
s.specimenSaving={};
s.receiveLoading=false;
s.agentDispatching={};
s.rejectLoading=false;
s.rejectReasonOptions=REJECT_REASON_OPTIONS;
s.cancelDialog={visible:false,loading:false,order:null,reason:''};
s.visibilityDialog={visible:false,loading:false,targetHidden:true,reason:''};
s.manual={visible:false,loading:false,saving:false,uploading:false,editing:false,orderView:false,item:null,order:null,data:{results:[]},groups:[],editRows:[],editMap:{},attachments:[]};
s.interpretationOptions=[
  {label:'ปกติ (N)',value:'N'},
  {label:'สูง (H)',value:'H'},
  {label:'ต่ำ (L)',value:'L'},
  {label:'ผิดปกติ (A)',value:'A'},
  {label:'พบเชื้อ / Positive',value:'POS'},
  {label:'ไม่พบเชื้อ / Negative',value:'NEG'}
];
s.bangkokToday=()=>new Date(Date.now()+(7*60*60*1000)).toISOString().slice(0,10);
s.currentDay=s.bangkokToday();
s.filters={hn:'',dates:[s.currentDay,s.currentDay]};
s.scanMode=false;
s.scannedHn='';
s.scanNoticePending=false;
s.createOrderLoading=false;
s.statusKey='all';
s.counts={all:0,waiting:0,received:0,partial:0,complete:0,cancelled:0};
s.page={current:1,size:30,total:0};
s.loadSeq=0;
s.countSeq=0;
s.statusFilters=[
  {key:'all',label:'ทั้งหมด'},
  {key:'waiting',label:'รอรับ'},
  {key:'received',label:'รับแล้ว'},
  {key:'partial',label:'ออกผลบางส่วน'},
  {key:'complete',label:'ออกผลครบ'},
  {key:'cancelled',label:'ยกเลิก / ปฏิเสธ'}
];
s.statusMap={
  all:['sent','accepted','prepared','ready','dispensed','resulted','completed','cancelled','rejected'],
  waiting:['sent'],
  received:['accepted','prepared','ready','dispensed'],
  partial:['resulted'],
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
  return detail||label||fallback||'';
};
s.actionReasonText=i=>s.text(i&&i.current_status).toLowerCase()==='cancelled'?(s.text(i&&i.cancel_reason)||'ยกเลิก order'):s.rejectReasonText(i);
s.actionActorText=i=>s.personName(s.text(i&&i.current_status).toLowerCase()==='cancelled'?(i&&i.cancelled_by):(i&&i.rejected_by))||'';
s.patientName=o=>[s.text(o&&o.patient&&o.patient.prename),s.text(o&&o.patient&&o.patient.first_name),s.text(o&&o.patient&&o.patient.last_name)].filter(Boolean).join(' ');
s.optionCode=v=>{if(v==null)return '';if(typeof v==='object')return s.text(v.value||v.code||v.id||v._id||'');return s.text(v);};
s.priorMedicationText=o=>s.text(o&&o.prior_specify);
s.hasPriorMedication=o=>s.optionCode(o&&o.prior_medication)==='2'&&!!s.priorMedicationText(o);
s.coverage=o=>s.text(o&&o.finance&&o.finance.coverage);
s.coverageAbbrev=o=>{
  const raw=o&&o.finance&&o.finance.coverage;
  let list=[];
  if(Array.isArray(raw))list=raw;
  else if(typeof raw==='string'&&['[','{'].includes(raw.trim().charAt(0))){try{const parsed=JSON.parse(raw);list=Array.isArray(parsed)?parsed:[parsed];}catch(e){list=[raw];}}
  else if(raw!=null&&raw!=='')list=[raw];
  for(let index=0;index<list.length;index++){
    const item=list[index],main=item&&typeof item==='object'&&item.inscl_item_main;
    const code=s.text(main&&typeof main==='object'?(main.value||main.code||main.id):(item&&typeof item==='object'?(item.value||item.code||item.id):item));
    if(code)return code.toUpperCase()==='CASH'?'':code;
  }
  return '';
};
s.requesterName=o=>{const r=o&&o.requester||{};return s.personName(r.cosign_user)||s.personName(r.visit_doctor);};
s.sourceRoom=o=>s.text(o&&o.visit&&(o.visit.clinic||o.visit.ward));
s.isPaid=o=>{const f=o&&o.finance||{};const total=Number(f.total_amount||0);return total>0&&Number(f.paid_amount||0)>=total;};
s.showPaid=o=>s.isPaid(o)&&!s.coverageAbbrev(o);
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
s.resultEntryStatuses=['accepted','prepared','ready','dispensed','resulted'];
s.resultEditStatuses=['accepted','prepared','ready','dispensed','resulted','completed'];
s.canEditManual=i=>!!i&&s.resultEntryStatuses.includes(s.text(i&&i.current_status).toLowerCase());
s.canEditResultRow=result=>{const item=result&&result._item,status=s.text(item&&item.current_status).toLowerCase(),persisted=/^[a-f0-9]{24}$/i.test(s.text(result&&result.result_item_id));return persisted?s.resultEditStatuses.includes(status):s.canEditManual(item);};
s.canEditResult=()=>{
  if(s.manual&&s.manual.orderView)return s.resultGroupsForDisplay().some(group=>(Array.isArray(group&&group.results)?group.results:[]).some(s.canEditResultRow));
  const item=s.manual&&s.manual.item;
  const status=s.text(item&&item.current_status).toLowerCase();
  return s.canEditManual(item)||(s.hasPersistedResult()&&s.resultEditStatuses.includes(status));
};
s.orderAttachmentItem=()=>{
  if(!s.manual||!s.manual.orderView)return null;
  const items=s.manual.order&&Array.isArray(s.manual.order.items)?s.manual.order.items:[];
  return items.find(item=>item&&s.canViewResult(item))||null;
};
s.canUploadResultFile=()=>!!s.orderAttachmentItem();
s.canViewResult=i=>['sent','accepted','prepared','ready','dispensed','resulted','completed'].includes(s.text(i&&i.current_status).toLowerCase());
s.resultItems=o=>(o&&Array.isArray(o.items)?o.items:[]).filter(s.canViewResult);
s.canOpenResultTab=o=>s.resultItems(o).length>0;
s.resultedAt=i=>s.text(i&&(i.resulted_at||(i.result_summary&&i.result_summary.resulted_at)));
s.resultTime=i=>s.resultedAt(i)?s.timePart(s.resultedAt(i)):'';
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
s.resultHiddenItem=i=>!!(i&&i.is_hide_result===true);
s.detailTab=o=>s.detailTabs[s.orderRowKey(o)]||'order';
s.setDetailTab=(o,tab)=>{const id=s.orderRowKey(o);if(!id)return;s.detailTabs={...s.detailTabs,[id]:tab};};
s.resultSourceText=v=>{const source=s.text(v).toLowerCase();return source==='agent'||source==='lis'?'LIS':source==='manual'?'Manual':source||'';};
s.resultDialogTitle=()=>s.manual.editing?'แก้ไขผลตรวจ':'ผลตรวจทางห้องปฏิบัติการ';
s.editResultTitle=()=>s.canEditResult()?(s.manual.editing?'ออกจากโหมดแก้ไขผลตรวจ':s.manual.orderView?'กรอกหรือแก้ไขผลทุก Item ใน Order':'กรอกหรือแก้ไขผลตรวจ'):'รับ specimen ก่อนกรอกหรือแก้ไขผล';
s.emptyResultData=()=>({results:[]});
s.resultContext=(item,order)=>({
  item_id:s.text(item&&item.item_id),
  order_id:s.text(order&&order.order_id),
  order_no:s.text(order&&order.order_number),
  section_code:s.text(item&&item.section&&item.section.code).toUpperCase(),
  patient_hn:s.text(order&&order.patient&&order.patient.hn),
  patient_name:s.patientName(order),
  patient_age:s.ageText(order),
  visit_vn:s.text(order&&order.visit&&order.visit.vn||order&&order.emr_context&&order.emr_context.vn),
  ward_clinic:s.sourceRoom(order),
  lab_no:s.text(item&&item.lab_no),
  test_code:s.text(item&&item.item_code),
  test_name:s.text(item&&item.item_name),
  specimen_name:s.specimenDisplay(item),
  collected_at:s.text(item&&item.specimen&&item.specimen.ordered&&item.specimen.ordered.collected_at),
  received_at:s.text(item&&item.received_at),
  reported_at:s.resultedAt(item),
  is_hide_result:s.resultHiddenItem(item),
  result_visibility_action:s.text(item&&item.result_visibility_action),
  result_visibility_reason:s.text(item&&item.result_visibility_reason),
  result_visibility_by:item&&item.result_visibility_by||null,
  result_visibility_at:s.text(item&&item.result_visibility_at),
  results:[]
});
s.patientInitials=name=>{const parts=s.text(name).split(/\\s+/).filter(Boolean);return parts.slice(0,2).map(part=>part.charAt(0)).join('').toUpperCase()||'LAB';};
s.resultRowsFromData=data=>{
  data=data&&typeof data==='object'?data:{};
  if(Array.isArray(data.results)&&data.results.length)return data.results;
  return [{result_item_id:'',test_code:s.text(data.test_code),test_name:s.text(data.test_name),result_value:s.text(data.result_value),unit:s.text(data.unit),reference_range:s.text(data.reference_range),interpretation:s.text(data.interpretation),result_source:s.text(data.result_source),is_critical:false}];
};
s.resultRowsWithEditKeys=(item,rows)=>(Array.isArray(rows)?rows:[]).map((result,index)=>{const itemId=s.text(item&&item.item_id),identity=s.text(result&&result.result_item_id)||s.text(result&&result.test_code)||String(index);return {...result,_item:item,_item_id:itemId,_edit_key:itemId+'|'+identity+'|'+index};});
s.resultGroupsForDisplay=()=>{
  if(s.manual&&s.manual.orderView)return Array.isArray(s.manual.groups)?s.manual.groups:[];
  const data=s.manual&&s.manual.data||{};
  const rows=s.resultRowsWithEditKeys(s.manual&&s.manual.item,s.resultRowsFromData(data));
  return [{item_id:s.text(data.item_id),test_code:s.text(data.test_code),test_name:s.text(data.test_name)||(rows[0]&&rows[0].test_name),results:rows}];
};
s.resultRowsForDisplay=()=>s.resultGroupsForDisplay().reduce((rows,group)=>rows.concat(Array.isArray(group&&group.results)?group.results:[]),[]);
s.resultTestCount=()=>s.resultGroupsForDisplay().length;
s.hasRecordedResult=()=>s.resultRowsForDisplay().some(result=>s.text(result&&result.result_value)!=='');
s.hasPersistedResult=()=>s.resultRowsForDisplay().some(result=>/^[a-f0-9]{24}$/i.test(s.text(result&&result.result_item_id)));
s.manualCriticalCount=()=>s.resultRowsForDisplay().filter(result=>result&&result.is_critical===true).length;
s.resultHidden=()=>!!(s.manual&&s.manual.data&&s.manual.data.is_hide_result===true);
s.resultVisibilityActor=()=>s.personName(s.manual&&s.manual.data&&s.manual.data.result_visibility_by);
s.hasResultValue=result=>s.text(result&&result.result_value)!=='';
s.resultSignalClass=result=>result&&result.is_critical===true?'is-critical':'is-normal';
s.resultSignalText=result=>result&&result.is_critical===true?'ค่าวิกฤติ':'ไม่มีค่าวิกฤติ';
s.editRow=result=>{const row={item_id:s.text(result&&result._item_id),result_item_id:s.text(result&&result.result_item_id),result_value:s.text(result&&result.result_value),unit:s.text(result&&result.unit),interpretation:s.text(result&&result.interpretation),reference_range:s.text(result&&result.reference_range)};return {...row,_initial:[row.result_value,row.unit,row.interpretation,row.reference_range].join('\u001f')};};
s.editRowChanged=row=>s.text(row&&row._initial)!==[s.text(row&&row.result_value),s.text(row&&row.unit),s.text(row&&row.interpretation),s.text(row&&row.reference_range)].join('\u001f');
s.resetManual=()=>{s.manual={visible:false,loading:false,saving:false,uploading:false,editing:false,orderView:false,item:null,order:null,data:s.emptyResultData(),groups:[],editRows:[],editMap:{},attachments:[]};};
s.startManualEdit=()=>{if(!s.canEditResult())return;const editRows=[],editMap={};s.resultRowsForDisplay().forEach(result=>{if(!s.canEditResultRow(result))return;const row=s.editRow(result);editRows.push(row);editMap[result._edit_key]=row;});s.manual={...s.manual,editing:true,editRows:editRows,editMap:editMap};};
s.cancelResultEdit=()=>{s.manual={...s.manual,editing:false,editRows:[],editMap:{}};};
s.toggleResultEdit=()=>{if(s.manual.editing)s.cancelResultEdit();else s.startManualEdit();};
s.resetVisibilityDialog=()=>{s.visibilityDialog={visible:false,loading:false,targetHidden:true,reason:''};};
s.openResultVisibilityDialog=()=>{
  if(!s.hasPersistedResult()){field.notify('ยังไม่มีผลตรวจที่บันทึกไว้ให้ปกปิด','warning',3200);return;}
  s.visibilityDialog={visible:true,loading:false,targetHidden:!s.resultHidden(),reason:''};
};
s.submitResultVisibility=async()=>{
  const item=s.manual&&s.manual.item,reason=s.text(s.visibilityDialog&&s.visibilityDialog.reason);
  if(!item||!s.hasPersistedResult()){field.notify('ไม่พบผลตรวจที่ต้องการเปลี่ยนการมองเห็น','error',3500);return;}
  if(reason.length<3){field.notify('กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร','warning',3200);return;}
  const hidden=s.visibilityDialog.targetHidden===true;
  s.visibilityDialog={...s.visibilityDialog,loading:true};
  try{
    const p=await s.processCall(PROCESS_ID,{action:'set_result_visibility',organization_code:s.unitCode(),item_id:s.text(item.item_id),hidden:hidden,reason:reason});
    if(!p||p.success===false){s.visibilityDialog={...s.visibilityDialog,loading:false};field.notify(s.text(p&&p.message)||'บันทึกสถานะปกปิดผลไม่สำเร็จ','error',4500);return;}
    const d=p.data||{};
    item.is_hide_result=d.is_hide_result===true;
    item.result_visibility_action=s.text(d.result_visibility_action);
    item.result_visibility_reason=s.text(d.result_visibility_reason);
    item.result_visibility_by=d.result_visibility_by||null;
    item.result_visibility_at=s.text(d.result_visibility_at);
    s.manual={...s.manual,data:{...s.manual.data,...d,is_hide_result:d.is_hide_result===true}};
    s.resetVisibilityDialog();
    field.notify(s.text(p.message)||(hidden?'ปกปิดผลแล้ว':'ยกเลิกการปกปิดผลแล้ว'),'success',3000);
  }catch(error){s.visibilityDialog={...s.visibilityDialog,loading:false};field.notify(s.text(error&&error.message)||'บันทึกสถานะปกปิดผลไม่สำเร็จ','error',4500);}
};
s.attachmentResponse=fileItem=>fileItem&&fileItem.response&&typeof fileItem.response==='object'?fileItem.response:fileItem||{};
s.attachmentKey=fileItem=>s.text(s.attachmentResponse(fileItem).fileId)||s.text(fileItem&&fileItem.uid)||s.text(fileItem&&fileItem.url)||s.text(fileItem&&fileItem.name);
s.attachmentName=fileItem=>s.text(fileItem&&fileItem.name)||s.text(s.attachmentResponse(fileItem).fileName)||'ไฟล์ผลตรวจ';
s.attachmentUrl=fileItem=>s.text(fileItem&&fileItem.url)||s.text(s.attachmentResponse(fileItem).filePath);
s.attachmentSize=fileItem=>{const bytes=Number(fileItem&&fileItem.size||0);if(!bytes)return '';return bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':Math.ceil(bytes/1024)+' KB';};
s.uniqueAttachments=attachments=>{
  const unique=[],seen={};
  (Array.isArray(attachments)?attachments:[]).forEach(fileItem=>{const key=s.attachmentKey(fileItem);if(!key||seen[key])return;seen[key]=true;unique.push(fileItem);});
  return unique;
};
s.normalizeAttachment=(result,fileItem)=>{const response=result&&result.data&&result.data.fileId?result.data:result||{};return {name:s.text(fileItem&&fileItem.name)||s.text(response.fileName)||'ไฟล์ผลตรวจ',percentage:100,status:'success',size:Number(fileItem&&fileItem.size||0),uid:fileItem&&fileItem.uid||Date.now(),url:s.text(response.filePath)||s.text(fileItem&&fileItem.url),response:response};};
s.resultUploadAction=()=>{const api=s.api();return s.text(api&&api.host)+'/v1/files/form-upload';};
s.resultUploadHeaders=()=>{const api=s.api(),token=s.text(api&&api.user&&api.user.token);return token?{Authorization:'Bearer '+token}:{};};
s.resultUploadData=()=>({formId:RESULT_REPORT_FORM_ID,category:'file'});
s.resultUploadExceed=()=>field.notify('แนบไฟล์ได้สูงสุด 3 ไฟล์ต่อผลตรวจ','warning',3500);
s.beforeResultUpload=fileItem=>{
  const name=s.text(fileItem&&fileItem.name),ext=(name.split('.').pop()||'').toLowerCase(),mime=s.text(fileItem&&fileItem.type).toLowerCase();
  const allowedExt=['pdf','jpg','jpeg','png'],allowedMime=['application/pdf','image/jpeg','image/png'];
  if(!allowedExt.includes(ext)||mime&&!allowedMime.includes(mime)){field.notify('รองรับเฉพาะ PDF, JPG, JPEG และ PNG','warning',4000);return false;}
  const size=Number(fileItem&&fileItem.size||0);
  if(size>10*1024*1024){field.notify('ไฟล์ต้องมีขนาดไม่เกิน 10 MB','warning',4000);return false;}
  const total=s.manual.attachments.reduce((sum,item)=>sum+Number(item&&item.size||0),0)+size;
  if(total>30*1024*1024){field.notify('ไฟล์แนบรวมต้องไม่เกิน 30 MB','warning',4000);return false;}
  s.manual={...s.manual,uploading:true};
  return true;
};
s.resultUploadProgress=()=>{if(!s.manual.uploading)s.manual={...s.manual,uploading:true};};
s.persistResultAttachments=async attachments=>{
  const item=s.orderAttachmentItem();
  if(!item)throw new Error('ไม่พบ LAB Item ใน Order สำหรับผูกไฟล์แนบ');
  const p=await s.processCall(PROCESS_ID,{action:'save_result_attachments',attachment_scope:'order',organization_code:s.unitCode(),item_id:s.text(item.item_id),result_attachments:attachments});
  if(!p||p.success===false)throw new Error(s.text(p&&p.message)||'บันทึกไฟล์แนบไม่สำเร็จ');
  const saved=Array.isArray(p.data&&p.data.result_attachments)?p.data.result_attachments:attachments;
  s.manual={...s.manual,uploading:false,attachments:saved,data:{...s.manual.data,result_report_id:s.text(p.data&&p.data.result_report_id)||s.manual.data.result_report_id,result_attachments:saved}};
  field.notify('อัปโหลดและบันทึกไฟล์แนบแล้ว','success',2800);
};
s.resultUploadSuccess=async(result,fileItem)=>{
  const attachment=s.normalizeAttachment(result,fileItem),previous=s.manual.attachments.slice(),next=[...previous,attachment];
  s.manual={...s.manual,attachments:next};
  try{await s.persistResultAttachments(next);}catch(error){s.manual={...s.manual,uploading:false,attachments:previous};field.notify(s.text(error&&error.message)||'บันทึกไฟล์แนบไม่สำเร็จ','error',5000);}
};
s.resultUploadError=()=>{s.manual={...s.manual,uploading:false};field.notify('อัปโหลดไฟล์ไม่สำเร็จ','error',4500);};
s.resultGroup=(item,order,data)=>{
  const fallback=s.resultContext(item,order),d=data&&typeof data==='object'?data:{};
  const merged={...fallback,...d,
    patient_hn:s.text(d.patient_hn)||fallback.patient_hn,
    patient_name:s.text(d.patient_name)||fallback.patient_name,
    patient_age:s.text(d.patient_age)||fallback.patient_age,
    visit_vn:s.text(d.visit_vn)||fallback.visit_vn,
    ward_clinic:s.text(d.ward_clinic)||fallback.ward_clinic,
    lab_no:s.text(d.lab_no)||fallback.lab_no,
    test_code:s.text(d.test_code)||fallback.test_code,
    test_name:s.text(d.test_name)||fallback.test_name,
    specimen_name:s.text(d.specimen_name)||fallback.specimen_name,
    received_at:s.text(d.received_at)||fallback.received_at,
    reported_at:s.text(d.reported_at)||fallback.reported_at,
    results:Array.isArray(d.results)?d.results:[]
  };
  return {item_id:s.text(item&&item.item_id),test_code:merged.test_code,test_name:merged.test_name,panel:item&&item.panel&&typeof item.panel==='object'?item.panel:{},data:merged,results:s.resultRowsWithEditKeys(item,s.resultRowsFromData(merged)),attachments:Array.isArray(d.result_attachments)?d.result_attachments:[],load_failed:false};
};
s.groupOrderResultGroups=groups=>{
  const grouped=[],byKey={};
  (Array.isArray(groups)?groups:[]).forEach(group=>{
    const panel=group&&group.panel&&typeof group.panel==='object'?group.panel:{};
    const parentCode=s.text(panel.set_code)||s.text(panel.parent_code);
    const key=parentCode?'panel:'+parentCode:'item:'+s.text(group&&group.item_id);
    const parentName=s.text(panel.set_name)||s.text(panel.parent_name)||s.text(group&&group.test_name)||'-';
    if(!byKey[key]){
      byKey[key]={...group,group_key:key,test_code:parentCode||s.text(group&&group.test_code),test_name:parentName,item_ids:[s.text(group&&group.item_id)].filter(Boolean),results:Array.isArray(group&&group.results)?group.results.slice():[],attachments:Array.isArray(group&&group.attachments)?group.attachments.slice():[]};
      grouped.push(byKey[key]);
      return;
    }
    const target=byKey[key];
    target.item_ids=target.item_ids.concat([s.text(group&&group.item_id)].filter(Boolean));
    target.results=target.results.concat(Array.isArray(group&&group.results)?group.results:[]);
    target.attachments=target.attachments.concat(Array.isArray(group&&group.attachments)?group.attachments:[]);
    target.load_failed=target.load_failed||!!(group&&group.load_failed);
  });
  return grouped;
};
s.openResult=async(item,order,startEdit)=>{
  if(!s.canViewResult(item)){field.notify('สถานะ Item นี้ไม่อนุญาตให้เปิดผลตรวจ','warning',3000);return;}
  const fallback=s.resultContext(item,order);
  s.manual={...s.manual,visible:true,loading:true,uploading:false,editing:false,orderView:false,item:item,order:order,data:fallback,groups:[],editRows:[],editMap:{},attachments:[]};
  try{
    const p=await s.processCall(PROCESS_ID,{action:'get_manual_result',organization_code:s.unitCode(),item_id:s.text(item.item_id)});
    if(!p||p.success===false){s.manual={...s.manual,loading:false};field.notify((p&&p.message)||'อ่านผลตรวจไม่สำเร็จ','error',4000);return;}
    const d=p.data||{};
    const group=s.resultGroup(item,order,d);
    s.manual={...s.manual,loading:false,data:group.data,attachments:group.attachments};
    if(startEdit)s.startManualEdit();
  }catch(error){s.manual={...s.manual,loading:false};field.notify(s.text(error&&error.message)||'อ่านผลตรวจไม่สำเร็จ','error',4000);}
};
s.loadOrderResultGroup=async(item,order)=>{
  const fallback=s.resultGroup(item,order,{});
  try{
    const p=await s.processCall(PROCESS_ID,{action:'get_manual_result',organization_code:s.unitCode(),item_id:s.text(item.item_id)});
    if(!p||p.success===false)return {...fallback,load_failed:true};
    return s.resultGroup(item,order,p.data||{});
  }catch(error){return {...fallback,load_failed:true};}
};
s.openOrderResults=async order=>{
  const items=s.resultItems(order);
  if(!items.length){field.notify('ไม่มีรายการผลตรวจใน Order นี้','warning',3000);return;}
  const fallback=s.resultContext(items[0],order);
  s.manual={...s.manual,visible:true,loading:true,uploading:false,editing:false,orderView:true,item:null,order:order,data:fallback,groups:[],editRows:[],editMap:{},attachments:[]};
  const loadedGroups=await Promise.all(items.map(item=>s.loadOrderResultGroup(item,order)));
  if(!s.manual.visible||!s.manual.orderView||s.manual.order!==order)return;
  const groups=s.groupOrderResultGroups(loadedGroups);
  const attachments=s.uniqueAttachments(loadedGroups.reduce((all,group)=>all.concat(Array.isArray(group&&group.attachments)?group.attachments:[]),[]));
  const firstData=groups[0]&&groups[0].data||fallback;
  s.manual={...s.manual,loading:false,data:{...fallback,...firstData,results:[]},groups:groups,attachments:attachments};
  const failed=loadedGroups.filter(group=>group.load_failed).length;
  if(failed)field.notify('มี '+failed+' รายการที่อ่านผลไม่สำเร็จ จึงแสดงข้อมูลจาก Order แทน','warning',4500);
};
s.saveResult=async()=>{
  const item=s.manual.item,order=s.manual.order,orderView=s.manual.orderView===true;
  if(!orderView&&!item){field.notify('ไม่พบข้อมูลสำหรับบันทึกผล','error',3000);return;}
  s.manual={...s.manual,saving:true};
  try{
    const rows=s.manual.editRows.filter(s.editRowChanged).map(row=>({...row}));
    if(!rows.length)throw new Error('ไม่มีค่าผลที่เปลี่ยนแปลง');
    const byItem={};
    rows.forEach(row=>{const itemId=s.text(row&&row.item_id)||s.text(item&&item.item_id);if(!itemId)return;(byItem[itemId]=byItem[itemId]||[]).push(row);});
    let lastData={};
    for(const itemId of Object.keys(byItem)){
      const itemRows=byItem[itemId],persisted=itemRows.every(row=>/^[a-f0-9]{24}$/i.test(s.text(row&&row.result_item_id)));
      const request=persisted
        ?{action:'save_result_edits',organization_code:s.unitCode(),item_id:itemId,results:itemRows}
        :{action:'save_manual_result',organization_code:s.unitCode(),item_id:itemId,manual_result:{...(itemRows[0]||{})}};
      const p=await s.processCall(PROCESS_ID,request);
      if(!p||p.success===false)throw new Error(s.text(p&&p.message)||'บันทึกผลไม่สำเร็จ');
      const d=p.data||{};lastData=d;
      const targetItems=order&&Array.isArray(order.items)?order.items:[];
      const target=targetItems.find(candidate=>s.text(candidate&&candidate.item_id)===itemId)||(!orderView?item:null);
      if(target&&d.result_status==='entered'){target.current_status='resulted';target.resulted_at=s.text(d.entered_at)||target.resulted_at;}
    }
    if(orderView){await s.openOrderResults(order);}else{s.manual={...s.manual,saving:false,editing:false,editRows:[],editMap:{},data:{...s.manual.data,...lastData,results:Array.isArray(lastData.results)?lastData.results:s.manual.data.results}};}
    field.notify(orderView?'บันทึกผลระดับ Order แล้ว '+Object.keys(byItem).length+' Item':'บันทึกผลแล้ว','success',2600);
    s.refreshCounts();
  }catch(error){s.manual={...s.manual,saving:false};field.notify(s.text(error&&error.message)||'บันทึกผลไม่สำเร็จ','error',4500);}
};
s.requestSaveResult=()=>{if(typeof field.confirm==='function')return field.confirm('ยืนยันบันทึกผลที่แก้ไข?\\nระบบจะเก็บผู้แก้ไขและเวลาล่าสุด โดยไม่เปลี่ยนค่า Critical ที่ Agent/LIS ส่งมา',()=>s.saveResult(),'warning','ยืนยันการบันทึกผลตรวจ');return s.saveResult();};
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
s.datePart=v=>{const d=s.toDate(v);return d?d.toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit',timeZone:'Asia/Bangkok'}):'';};
s.timePart=v=>{const d=s.toDate(v);return d?d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Bangkok'}):'';};
s.compactDateTime=v=>{if(!v)return '';const d=s.toDate(v);return d?s.datePart(v)+' '+s.timePart(v):String(v);};
s.statusText=v=>({sent:'รอรับ',accepted:'รับแล้ว',mixed:'รอรับ · รับแล้ว',prepared:'เตรียม',ready:'พร้อม',dispensed:'ดำเนินการ',resulted:'ออกผลบางส่วน',completed:'ออกผลครบ',cancelled:'ยกเลิก',rejected:'ปฏิเสธ',returned:'ส่งกลับ',reversed:'ย้อนรายการ'})[String(v||'').toLowerCase()]||s.text(v)||'';
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
s.orderStatusCounts=o=>{
  const items=o&&Array.isArray(o.items)?o.items:[];
  const statuses=items.length?items.map(item=>s.text(item&&item.current_status).toLowerCase()):[s.orderStatus(o)];
  const groups=[
    {key:'waiting',label:'รอรับ',statuses:s.statusMap.waiting,dot_class:'is-waiting'},
    {key:'received',label:'รับแล้ว',statuses:s.statusMap.received,dot_class:'is-received'},
    {key:'partial',label:'ออกผลบางส่วน',statuses:s.statusMap.partial,dot_class:'is-partial'},
    {key:'complete',label:'ออกผลครบ',statuses:s.statusMap.complete,dot_class:'is-complete'},
    {key:'cancelled',label:'ยกเลิก / ปฏิเสธ',statuses:['cancelled','rejected','returned','reversed'],dot_class:'is-cancelled'}
  ];
  return groups.map(group=>{
    const count=statuses.filter(status=>group.statuses.includes(status)).length;
    return {...group,count:count,title:group.label+' · '+count+' รายการ'};
  }).filter(group=>group.count>0);
};
s.orderStatusCountAria=o=>{
  const groups=s.orderStatusCounts(o);
  return groups.length?groups.map(group=>group.label+' '+group.count+' รายการ').join(' · '):'ไม่พบสถานะรายการ';
};
s.orderVisitId=o=>s.text(o&&o.emr_context&&o.emr_context.visit_id||o&&o.visit&&o.visit.visit_id);
s.reportSectionCode=o=>{
  const scoped=s.text(o&&o.section_code).toUpperCase();
  if(scoped)return scoped;
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
/* เปลี่ยน 2026-09-04 พร้อมกับ HN_ORDER_REPORT_ID: ป้ายใหม่ค้นด้วย HN ไม่ใช่ Visit ID
   ⇒ กันไว้ที่ patient.hn แทน orderVisitId · Order ที่ไม่มี HN ปุ่มยัง disabled เหมือนเดิม
   s.orderVisitId ยังถูกใช้ที่อื่น (EMR History, PDF ใบสั่งตรวจ) จึงไม่ถูกแตะ */
s.hnOrderReportReady=o=>!!(HN_ORDER_REPORT_ID&&s.text(o&&o.patient&&o.patient.hn));
s.hnOrderReportParams=o=>({hn:s.text(o&&o.patient&&o.patient.hn)});

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
s.orderRowKey=o=>{if(o&&typeof o==='object')return s.text(o.row_key)||[s.text(o.order_id),s.reportSectionCode(o)].filter(Boolean).join('|');return s.text(o);};
s.isExpanded=o=>!!s.expanded[s.orderRowKey(o)];
s.toggleOrder=o=>{const id=s.orderRowKey(o);if(!id)return;s.expanded={...s.expanded,[id]:!s.expanded[id]};s.selected={};};
/* Design parity 2026-09-11: กดพื้นที่ว่างทั้งแถว Order เพื่อเปิด/ย่อได้
   control ภายในแถวและการลากเลือกข้อความยังเป็นเจ้าของ interaction ของตัวเอง */
s.toggleOrderFromRow=(order,event)=>{
  const id=s.orderRowKey(order);
  if(!id)return;
  const el=event&&event.target;
  if(el&&typeof el.closest==='function'&&el.closest('button,a,input,textarea,select,label,.el-button,.el-input,.el-select,.el-checkbox,.el-dropdown,[role="button"]'))return;
  const selection=(typeof window!=='undefined'&&window.getSelection)?window.getSelection():null;
  if(selection&&s.text(selection.toString()))return;
  s.toggleOrder(order);
};
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
s.receiveGroupKey=item=>s.specimenValue(item).trim().toUpperCase()||'__UNSPECIFIED__';
s.receiveGroups=items=>{
  const groups=[];
  const byKey={};
  (Array.isArray(items)?items:[]).forEach(item=>{
    const key=s.receiveGroupKey(item);
    if(!byKey[key]){byKey[key]=[];groups.push(byKey[key]);}
    byKey[key].push(item);
  });
  return groups;
};
s.dispatchAgentInBackground=(items,receiveData)=>{
  const rows=Array.isArray(items)?items.filter(Boolean):[items].filter(Boolean);
  const itemIds=rows.map(item=>s.text(item&&item.item_id)).filter(Boolean);
  const outboundId=s.text(receiveData&&receiveData.outbound_order_id);
  const dispatchKey=s.text(receiveData&&receiveData.receipt_batch_id)||outboundId||itemIds[0];
  if(!itemIds.length||!outboundId||receiveData.agent_dispatch_queued!==true||s.agentDispatching[dispatchKey])return;
  s.agentDispatching={...s.agentDispatching,[dispatchKey]:true};
  // 2026-09-08: ส่งเป็น request แยกหลัง Receive คืน LAB NO. แล้ว
  // Outbound ที่ persist ไว้ทำหน้าที่เป็น durable queue; Receive รอบ sync เดิมเป็น
  // dispatcher/idempotency owner จึงไม่ต้องเปิดเผย payload หรือ Agent key ให้ browser.
  const dispatchParams={item_id:itemIds[0],dispatch_mode:'sync'};
  if(itemIds.length>1)dispatchParams.item_ids=itemIds;
  s.processCall(RECEIVE_PROCESS_ID,dispatchParams).then(p=>{
    const d=p&&p.data||{};
    if(p&&p.success!==false&&d.agent_send_success===true){
      rows.forEach(item=>{
        const live=s.findItem(s.text(item&&item.item_id))||item;
        live.hl7_status=s.text(d.hl7_status)||'queued';
        live.agent_transport_state=s.text(d.agent_transport_state)||'queued';
      });
      return;
    }
    rows.forEach(item=>{
      const live=s.findItem(s.text(item&&item.item_id))||item;
      live.hl7_status=s.text(d.hl7_status)||'new';
      live.agent_transport_state=s.text(d.agent_transport_state)||'failed';
    });
    field.notify('รับ specimen แล้ว แต่ส่ง Agent ไม่สำเร็จ: '+(s.text(d.agent_message)||s.text(p&&p.message)||'รอส่งใหม่จาก Outbound'),'warning',6000);
  }).catch(error=>{
    rows.forEach(item=>{
      const live=s.findItem(s.text(item&&item.item_id))||item;
      live.hl7_status='new';
      live.agent_transport_state='failed';
    });
    field.notify('รับ specimen แล้ว แต่เรียกงานส่ง Agent เบื้องหลังไม่สำเร็จ: '+(s.text(error&&error.message)||'รอส่งใหม่จาก Outbound'),'warning',6000);
  }).then(()=>{const next={...s.agentDispatching};delete next[dispatchKey];s.agentDispatching=next;});
};
s.performReceive=async(order,items)=>{
  s.receiveLoading=true;
  const successItems=[];
  const agentSentGroups=[];
  const agentQueuedGroups=[];
  const agentPendingItems=[];
  const failedItems=[];
  const groups=s.receiveGroups(items);
  for(let index=0;index<groups.length;index++){
    const group=groups[index],itemIds=group.map(item=>s.text(item&&item.item_id)).filter(Boolean);
    try{
      const receiveParams={item_id:itemIds[0],dispatch_mode:'deferred'};
      if(itemIds.length>1)receiveParams.item_ids=itemIds;
      const p=await s.processCall(RECEIVE_PROCESS_ID,receiveParams);
      if(!p||p.success===false){group.forEach(item=>failedItems.push({item,message:(p&&p.message)||'รับ specimen ไม่สำเร็จ'}));continue;}
      const receiveData=p.data||{};
      const returnedItems=Array.isArray(receiveData.items)?receiveData.items:[];
      group.forEach(item=>{
        const itemData=returnedItems.find(row=>s.text(row&&row.item_id)===s.text(item&&item.item_id))||receiveData;
        s.applyReceiveResult(item,itemData);
        successItems.push(item);
      });
      if(receiveData.agent_dispatch_queued===true){agentQueuedGroups.push(group);s.dispatchAgentInBackground(group,receiveData);}
      else if(receiveData.agent_send_success===true)agentSentGroups.push(group);
      else group.forEach(item=>agentPendingItems.push({item,message:s.text(receiveData.agent_message)||s.text(p.message)||'ส่ง Agent ไม่สำเร็จ'}));
    }catch(error){group.forEach(item=>failedItems.push({item,message:s.text(error&&error.message)||'เรียก API รับ specimen ไม่สำเร็จ'}));}
  }
  s.receiveLoading=false;
  if(failedItems.length||agentPendingItems.length){
    const receiveFailedNames=failedItems.map(row=>s.text(row.item&&row.item.item_code)||s.text(row.item&&row.item.item_name)).filter(Boolean);
    const agentPendingNames=agentPendingItems.map(row=>s.text(row.item&&row.item.item_code)||s.text(row.item&&row.item.item_name)).filter(Boolean);
    const agentDetail=agentPendingItems.length?s.text(agentPendingItems[0].message):'';
    field.notify('รับ specimen สำเร็จ '+successItems.length+' รายการ'+(agentQueuedGroups.length?' · กำลังส่ง Agent เบื้องหลัง '+agentQueuedGroups.length+' ชุด ('+agentQueuedGroups.reduce((total,group)=>total+group.length,0)+' รายการ)':'')+(agentSentGroups.length?' · ส่ง Agent แล้ว '+agentSentGroups.length+' ชุด ('+agentSentGroups.reduce((total,group)=>total+group.length,0)+' รายการ)':'')+(agentPendingItems.length?' · ยังไม่พร้อมส่ง/รอตรวจสอบ '+agentPendingItems.length+' รายการ'+(agentPendingNames.length?' ('+agentPendingNames.join(', ')+')':''):'')+(failedItems.length?' · รับไม่สำเร็จ '+failedItems.length+' รายการ'+(receiveFailedNames.length?' ('+receiveFailedNames.join(', ')+')':''):'')+(agentDetail?' · '+agentDetail:''),'warning',7500);
  }else field.notify('รับ specimen สำเร็จ '+successItems.length+' รายการ'+(agentQueuedGroups.length?' · กำลังส่ง Agent เบื้องหลัง '+agentQueuedGroups.length+' ชุด ('+agentQueuedGroups.reduce((total,group)=>total+group.length,0)+' รายการ)':'')+(agentSentGroups.length?' · ส่ง Agent แล้ว '+agentSentGroups.length+' ชุด ('+agentSentGroups.reduce((total,group)=>total+group.length,0)+' รายการ)':''),'success',4500);
  if(successItems.length){s.loadOrders();s.refreshCounts();}
};
// Deployed initCraft v1.6 confirm is callback-based:
// confirm(message, callback, type, title). Passing the title as argument 2
// makes the runtime call a string and display \"e is not a function\".
s.receiveSelected=order=>{
  const items=s.selectedItems(order);
  if(!items.length){field.notify('กรุณาเลือก LAB Item ใน Order นี้อย่างน้อย 1 รายการ','warning',3000);return;}
  if(items.some(item=>s.text(item&&item.current_status).toLowerCase()!=='sent')){field.notify('รับได้เฉพาะรายการใน Order นี้ที่อยู่ในสถานะรอรับ','warning',3000);return;}
  if(typeof field.confirm==='function'){
    const labels=items.map(item=>s.text(item.item_code)||s.text(item.item_name)).filter(Boolean);
    const groupCount=s.receiveGroups(items).length;
    return field.confirm(
      'ระบบจะสร้าง LAB NO. '+groupCount+' เลขตาม specimen ที่เลือก และรวมรายการ specimen เดียวกันส่ง Agent เป็นชุดเดียว\\nหน้าจอไม่ต้องรอ Agent ตอบ และหากติดต่อไม่ได้ Outbound จะยังอยู่ให้ตรวจสอบและส่งใหม่\\n\\nยืนยันรับ '+items.length+' รายการ'+(labels.length?'\\n'+labels.join(' · '):'')+'?',
      ()=>s.performReceive(order,items),
      'warning',
      'รับ specimen'
    );
  }
  return s.performReceive(order,items);
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
  if(!s.canCancelOrder(order)){field.notify('ยกเลิก Section นี้ได้เฉพาะรายการที่ยังรอรับหรือรับแล้วแต่ยังไม่ส่ง Agent/LIS','warning',4500);return;}
  if(!s.reportSectionCode(order)){field.notify('ไม่พบ Section ของแถว Order จึงยกเลิกไม่ได้','warning',4500);return;}
  s.selected={};
  s.cancelDialog={visible:true,loading:false,order:order,reason:''};
};
s.submitCancelOrder=async()=>{
  const order=s.cancelDialog.order,reasonCode=s.text(s.cancelDialog.reason),reason=REJECT_REASON_LABELS[reasonCode]||reasonCode;
  if(!order){field.notify('ไม่พบ Order ที่ต้องการยกเลิก','error',3500);return;}
  if(!reason){field.notify('กรุณาระบุเหตุผลการยกเลิก Order','warning',3500);return;}
  if(s.cancelDialog.loading)return;
  s.cancelDialog={...s.cancelDialog,loading:true};
  try{
    const p=await s.processCall(PROCESS_ID,{action:'cancel_order',organization_code:s.unitCode(),section_codes:[s.reportSectionCode(order)],order_id:s.text(order.order_id),order_number:s.text(order.order_number),cancel_reason:reason});
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
s.retesting={};
s.isRetesting=order=>!!s.retesting[s.orderRowKey(order)];
s.retestAnswered=p=>{
  const d=p&&p.data||{};
  return !Array.isArray(d.orders)&&Object.prototype.hasOwnProperty.call(d,'reopened_item_count');
};
s.performRetest=async order=>{
  const key=s.orderRowKey(order),orderId=s.text(order&&order.order_id),sectionCode=s.reportSectionCode(order);
  if(!orderId){field.notify('ไม่พบรหัส Order','error',3200);return;}
  if(!sectionCode){field.notify('ไม่พบ Section ของแถว Order จึงเปิดตรวจใหม่ไม่ได้','warning',4200);return;}
  if(s.retesting[key])return;
  s.retesting={...s.retesting,[key]:true};
  try{
    const p=await s.processCall(PROCESS_ID,{action:'retest_order',organization_code:s.unitCode(),section_codes:[sectionCode],order_id:orderId,order_number:s.text(order&&order.order_number)});
    if(!p||p.success===false){field.notify(s.text(p&&p.message)||'เปิดตรวจใหม่ไม่สำเร็จ','error',6500);return;}
    if(!s.retestAnswered(p)){field.notify('Process worklist ที่ deploy อยู่ยังไม่มี action retest_order — ต้อง replace body ล่าสุดก่อน','error',7000);return;}
    const d=p.data||{};
    field.notify(s.text(p.message)||'เปิดตรวจใหม่แล้ว',d.audit_sync_pending?'warning':'success',d.audit_sync_pending?6500:4000);
    s.selected={};
    s.statusKey='waiting';
    s.page={...s.page,current:1};
    s.loadOrders();
    s.refreshCounts();
  }catch(error){field.notify(s.text(error&&error.message)||'เรียก API ตรวจใหม่ไม่สำเร็จ','error',6500);}
  finally{const next={...s.retesting};delete next[key];s.retesting=next;}
};
s.retestOrder=order=>{
  const orderNo=s.text(order&&order.order_number)||'Order นี้';
  const run=()=>s.performRetest(order);
  const message='ยืนยันตรวจใหม่ '+orderNo+'?\\nระบบจะนำรายการที่ยกเลิก/ปฏิเสธกลับไปรอรับ specimen ล้าง LAB NO. เดิมโดยเก็บไว้ในประวัติ และสร้าง LAB NO. ใหม่เมื่อกดรับ specimen';
  if(typeof field.confirm==='function')return field.confirm(message,run,'warning','ตรวจใหม่');
  return run();
};
s.reportCommand=type=>s.notifyPending(type==='excel'?'Report Excel':'Report PDF');
s.createOrderSearchHn=()=>{
  const raw=s.text(s.filters&&s.filters.hn).replace(/^HN\\s*/i,'').trim();
  return /^\\d{6,}$/.test(raw)?raw:'';
};
s.createOrderVisitContext=visit=>{
  const p=visit&&visit.pid||{};
  const name=[s.text(p.prename),s.text(p.p_fname),s.text(p.p_lname)].filter(Boolean).join(' ').replace(/\\s+/g,' ').trim();
  const gender=({'1':'ชาย','2':'หญิง'})[s.text(p.p_gender)]||s.text(p.p_gender);
  return {
    person_id:s.text(visit&&visit.xtbxlv1_xfx_id||p.value),
    hn:s.text(p.hn),
    full_name:name,
    sex:gender,
    age:p.age==null?'':p.age,
    blood_group:s.text(p.p_abogroup),
    p_pic:Array.isArray(p.p_pic)?p.p_pic:null,
    allergy_tags:[],
    visit_id:s.text(visit&&visit._id||visit&&visit.value),
    vn:s.text(visit&&visit.vn),
    visit_type:s.text(visit&&visit.visit_type),
    visit_datetime:s.text(visit&&visit.visit_date||visit&&visit.created_at),
    visit_clinic:s.text(visit&&visit.visit_clinic),
    visit_doctor:s.text(visit&&visit.visit_doctor),
    dx_summary:'',
    service_type:'',
    inscl_hos:Array.isArray(visit&&visit.inscl_hos)?visit.inscl_hos:[]
  };
};
s.openCreateOrder=async()=>{
  const form=field.getFormRef&&field.getFormRef();
  if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิด CPOE Order App','error',3000);return;}
  const sectionCodes=Array.isArray(s.allowedSectionCodes)?s.allowedSectionCodes.slice():[];
  if(!sectionCodes.length){field.notify('Organization นี้ยังไม่ได้ผูก Section LAB จึงสร้างรายการไม่ได้','warning',4000);return;}
  if(s.createOrderLoading)return;
  const launchParams=Object.assign({},form.formParams||{}, {
    manual_visit:true,
    source:'lab-worklist',
    lab_scope:true,
    organization_code:s.unitCode(),
    section_codes:sectionCodes
  });
  const hn=s.createOrderSearchHn();
  if(hn){
    s.createOrderLoading=true;
    try{
      const response=await s.processCall(PROCESS_ID,{action:'list_open_visits',organization_code:s.unitCode(),hn:hn});
      if(!response||response.success===false){field.notify(s.text(response&&response.message)||'ตรวจสอบ Visit วันนี้ไม่สำเร็จ','error',4500);return;}
      const visits=response.data&&Array.isArray(response.data.visits)?response.data.visits:[];
      const matches=visits.filter(visit=>s.text(visit&&visit.pid&&visit.pid.hn).replace(/^HN\\s*/i,'')===hn);
      if(!matches.length){field.notify('HN '+hn+' ยังไม่ได้เปิด VN วันนี้','warning',4200);return;}
      Object.assign(launchParams,s.createOrderVisitContext(matches[matches.length-1]));
    }catch(error){field.notify(s.text(error&&error.message)||'ตรวจสอบ Visit วันนี้ไม่สำเร็จ','error',4500);return;}
    finally{s.createOrderLoading=false;}
  }
  form.openForm(CPOE_ORDER_APP_ID,'','',null,{backdrop:false,params:launchParams});
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
  if(allCompletedHistory)p.all_dates=true;
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
s.handleUnitChange=()=>{
  const next=s.unitCode(),nextDay=s.bangkokToday();
  const unitChanged=next!==s.currentUnitCode,dayChanged=nextDay!==s.currentDay;
  if(!unitChanged&&!dayChanged)return;
  s.currentUnitCode=next;
  if(dayChanged){
    s.currentDay=nextDay;
    s.filters={hn:'',dates:[nextDay,nextDay]};
    s.scanMode=false;
    s.scannedHn='';
    s.scanNoticePending=false;
  }
  s.expanded={};
  s.detailTabs={};
  s.selected={};
  s.page={...s.page,current:1,total:0};
  s.loadOrders();
  s.refreshCounts();
};`

form.formConfig.cssCode = `.lab-cpoe{--primary:var(--el-color-primary,#409eff);--primary-50:var(--el-color-primary-light-9,#ecf5ff);--success:var(--el-color-success,#67c23a);--success-50:var(--el-color-success-light-9,#f0f9eb);--warning:var(--el-color-warning,#e6a23c);--warning-50:var(--el-color-warning-light-9,#fdf6ec);--danger:var(--el-color-danger,#f56c6c);--danger-50:var(--el-color-danger-light-9,#fef0f0);--ink:var(--el-text-color-primary,#303133);--text:var(--el-text-color-regular,#606266);--muted:var(--el-text-color-secondary,#909399);--placeholder:var(--el-text-color-placeholder,#a8abb2);--border:var(--el-border-color,#dcdfe6);--border-light:var(--el-border-color-light,#e4e7ed);--border-lighter:var(--el-border-color-lighter,#ebeef5);--fill:var(--el-fill-color,#f0f2f5);--fill-light:var(--el-fill-color-light,#f5f7fa);--fill-lighter:var(--el-fill-color-lighter,#fafafa);--fill-soft:var(--el-fill-color-lighter,#fafafa);--white:var(--el-bg-color,#fff);--lab-wait-bg:#fffbe6;--lab-wait-text:#8a6d00;--mono:"SFMono-Regular","Roboto Mono",Consolas,monospace;width:100%;padding:0 0 36px;background:var(--white);color:var(--text);font-family:"Leelawadee UI","Noto Sans Thai",Tahoma,"Segoe UI",sans-serif;font-size:13px;line-height:1.4}
.dark .lab-cpoe{--lab-wait-bg:rgba(250,219,20,.14);--lab-wait-text:#ffe45c}
.lab-cpoe *{box-sizing:border-box}
.lab-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.lab-toolbar .el-button+.el-button{margin-left:0}
.lab-search-control{width:290px}.lab-toolbar .lab-date-control{width:220px!important;flex:0 0 220px}
.lab-dropdown-caret{margin-left:5px;color:var(--muted);font-size:12px}
.lab-scan-context{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:0 0 10px;padding:8px 10px;border:1px solid var(--el-color-primary-light-5,#a0cfff);border-radius:6px;background:var(--primary-50);color:var(--primary)}.lab-scan-context-label{font-size:11px;font-weight:700}.lab-scan-context strong{color:var(--ink);font-size:14px}.lab-scan-context>span:not(.lab-scan-context-label){font-size:11px}.lab-scan-context .el-button{margin-left:auto}
.lab-status-strip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.lab-status-chip{--chip-color:#73767a;--chip-border:var(--primary);display:flex;align-items:baseline;gap:6px;padding:6px 12px;border:1px solid var(--border-light);border-radius:6px;background:var(--fill-light);color:var(--muted);font:inherit;cursor:pointer;transition:border-color .15s,background-color .15s;user-select:none}
.lab-status-chip strong{color:var(--chip-color);font-size:18px;line-height:1}.lab-status-chip span{font-size:12px}
.lab-status-chip[data-status="waiting"]{--chip-color:#fadb14;--chip-border:#fadb14}.lab-status-chip[data-status="received"]{--chip-color:#e6a23c;--chip-border:#e6a23c}.lab-status-chip[data-status="partial"]{--chip-color:var(--el-color-success-light-3,#95d475);--chip-border:var(--el-color-success-light-3,#95d475)}.lab-status-chip[data-status="complete"]{--chip-color:#67c23a;--chip-border:#67c23a}.lab-status-chip[data-status="cancelled"]{--chip-color:#f56c6c;--chip-border:#f56c6c}
.lab-status-chip:hover,.lab-status-chip.is-active{border-color:var(--chip-border)}.lab-status-chip.is-active{background:var(--fill)}
.lab-status-legend{display:flex;align-items:center;gap:14px;margin-left:auto;padding:5px 10px;border:1px solid var(--border-light);border-radius:6px;background:var(--white);color:var(--text);font-size:11px;white-space:nowrap}.lab-status-legend-item{display:inline-flex;align-items:center;gap:6px}.lab-status-legend-dot{width:10px;height:10px;flex:none;border-radius:50%}.lab-status-legend-dot.is-waiting{background:#fadb14}.lab-status-legend-dot.is-received{background:#e6a23c}.lab-status-legend-dot.is-partial{background:var(--el-color-success-light-3,#95d475)}.lab-status-legend-dot.is-complete{background:#67c23a}.lab-status-legend-dot.is-cancelled{background:#f56c6c}
.lab-list-summary{margin:0 0 8px;color:var(--muted);font-size:12px}.lab-list-summary.is-error{color:var(--danger)}
.lab-worklist-shell{border-top:1px solid var(--border);border-bottom:1px solid var(--border)}.lab-worklist{width:100%;min-width:0;background:var(--white)}
.lab-list-head,.lab-patient-row{display:grid;grid-template-columns:32px minmax(210px,1.45fr) minmax(220px,1.45fr) 78px 90px minmax(150px,1.2fr) minmax(155px,1.3fr) 120px 58px 58px 58px;gap:10px;align-items:center;padding:8px 10px}
.lab-list-head{color:var(--muted);font-size:11px;font-weight:650;border-bottom:1px solid var(--border);letter-spacing:.02em}
.lab-patient-block{position:relative;border-bottom:1px solid var(--border-lighter);content-visibility:auto;contain-intrinsic-size:74px}.lab-patient-block:last-child{border-bottom:0}
.lab-patient-row{min-height:74px;background:var(--white);cursor:pointer;transition:background-color .15s}.lab-patient-row:hover{background:var(--fill-light)}.lab-patient-block.is-open>.lab-patient-row{background:var(--fill)}
.lab-expand-button{display:grid;width:28px;height:30px;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--muted);cursor:pointer}.lab-expand-button:hover{background:var(--fill-light);color:var(--primary)}.lab-expand-button svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;transition:transform .16s}.lab-patient-block.is-open .lab-expand-button svg{transform:rotate(90deg)}
.lab-patient-summary,.lab-context-tags,.lab-metric,.lab-doctor-cell{min-width:0}.lab-patient-hn{display:flex;align-items:center;gap:6px;min-width:0;color:var(--ink);font-weight:700}.lab-patient-hn .lab-mono{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lab-patient-name{margin-top:1px;overflow:hidden;color:var(--ink);font-weight:650;text-overflow:ellipsis;white-space:nowrap}.lab-patient-demographic{display:flex;align-items:center;gap:6px;margin-top:1px;color:var(--muted);font-size:11px}
.lab-inline-tag,.lab-state-tag{display:inline-flex;min-height:20px;align-items:center;justify-content:center;padding:1px 6px;border:1px solid;border-radius:4px;font-size:10px;font-weight:650;white-space:nowrap}.lab-state-tag.status-waiting{border-color:#fadb14;background:var(--lab-wait-bg);color:var(--lab-wait-text)}.lab-state-tag.status-received{border-color:#e6a23c;background:var(--warning-50);color:var(--warning)}.lab-state-tag.status-resulted,.lab-state-tag.status-result-partial{border-color:var(--el-color-success-light-3,#95d475);background:var(--success-50);color:var(--el-color-success-dark-2,#529b2e)}.lab-state-tag.status-result-complete{border-color:#67c23a;background:var(--success-50);color:var(--success)}.lab-state-tag.status-cancelled{border-color:#f56c6c;background:var(--danger-50);color:var(--danger)}.lab-state-tag.status-mixed{border-color:var(--el-text-color-placeholder,#a8abb2);background:var(--fill);color:var(--muted)}.lab-urgent-tag{min-height:18px;padding:0 5px;border-color:var(--el-color-danger-light-5,#fab6b6);background:var(--danger-50);color:var(--danger);font-size:9px}.lab-meta-pill{min-height:21px;padding:1px 8px;border-color:var(--el-border-color-darker,#c8c9cc);border-radius:999px;background:var(--white);color:var(--text)}.lab-gender-pill{min-height:18px;padding:0 6px;border-color:var(--el-border-color-darker,#c8c9cc);border-radius:999px;background:var(--white);color:var(--text);font-size:9px}
.lab-context-top{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:4px}.lab-context-top .lab-source-pill{border-color:var(--el-color-primary-light-5,#a0cfff);background:var(--primary-50);color:var(--primary)}.lab-context-top .lab-payment-pill{border-color:var(--el-color-success-light-5,#b3e19d);background:var(--success-50);color:var(--success)}.lab-context-top .lab-coverage-pill{border-color:var(--el-color-warning-light-5,#f3d19e);background:var(--warning-50);color:var(--warning)}.lab-prior-medication{display:flex;width:max-content;max-width:100%;min-height:22px;align-items:center;margin:0 0 4px;padding:1px 9px;overflow:hidden;border:1px solid var(--el-color-danger-light-5,#fab6b6);border-radius:999px;background:var(--danger-50);color:var(--danger);font-size:11px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}
.lab-field-value{display:block;min-width:0;overflow:hidden;color:var(--ink);font-size:12px;font-weight:650;text-overflow:ellipsis;white-space:nowrap}.lab-hover-summary{cursor:help}.lab-time-value{margin-top:3px;line-height:1.25}.lab-time-value span{display:block}.lab-order-no-tag{display:inline-flex;max-width:100%;min-height:18px;align-items:center;padding:0 6px;overflow:hidden;border:1px solid var(--el-color-primary-light-5,#a0cfff);border-radius:999px;background:var(--primary-50);color:var(--primary);font-family:var(--mono);font-size:9px;text-overflow:ellipsis;white-space:nowrap}.lab-diagnosis-summary{display:block;max-width:100%;margin-top:2px;overflow:hidden;color:var(--muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap;cursor:help}.lab-cpoe-list-popper .lab-pop-line{line-height:1.5;white-space:nowrap}.lab-cpoe-diagnosis-popper{max-width:420px}.lab-cpoe-diagnosis-popper .lab-diagnosis-pop{line-height:1.5;white-space:normal;overflow-wrap:anywhere}
.lab-row-status-check{display:flex;min-width:0;align-items:center;justify-self:start;gap:8px}.lab-order-status-step{display:inline-flex;align-items:center;gap:3px;color:var(--text);font-size:10px;cursor:default}.lab-order-status-step b{font-weight:650;line-height:1}.lab-order-status-dot{width:10px;height:10px;flex:none;border-radius:50%}.lab-order-status-step.is-waiting .lab-order-status-dot{background:#fadb14}.lab-order-status-step.is-waiting b{color:var(--lab-wait-text)}.lab-order-status-step.is-received .lab-order-status-dot{background:#e6a23c}.lab-order-status-step.is-received b{color:var(--warning)}.lab-order-status-step.is-partial .lab-order-status-dot{background:var(--el-color-success-light-3,#95d475)}.lab-order-status-step.is-partial b{color:var(--el-color-success-dark-2,#529b2e)}.lab-order-status-step.is-complete .lab-order-status-dot{background:#67c23a}.lab-order-status-step.is-complete b{color:var(--success)}.lab-order-status-step.is-cancelled .lab-order-status-dot{background:#f56c6c}.lab-order-status-step.is-cancelled b{color:var(--danger)}
.lab-plain-action{width:100%;margin:0!important;padding:5px 7px!important;font-size:11px}
.lab-order-report{display:block;width:100%;padding:0!important}
.lab-order-report .el-button{width:100%;margin:0!important;padding:5px 7px!important;font-size:11px}
.lab-detail-panel{padding:0 10px 14px 42px;border-top:1px solid var(--border-lighter);background:var(--fill-lighter)}.lab-detail-top{display:flex;min-height:42px;align-items:flex-end;gap:16px;border-bottom:1px solid var(--border-light)}.lab-detail-tab{height:42px;padding:0;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:650;cursor:pointer}.lab-detail-tab.is-active{border-bottom-color:var(--primary);color:var(--primary)}.lab-detail-tab:disabled{color:var(--placeholder);cursor:not-allowed}.lab-bulk-actions{display:flex;align-items:center;gap:6px;margin-left:auto;padding-bottom:6px}.lab-bulk-actions .el-button+.el-button{margin-left:0}
/* ใช้ pattern เดียวกับ X-ray เฉพาะงานภาพ: header ชิด tab, ครบความกว้าง และ checkbox sticky
   โครงคอลัมน์/การเลือก specimen/LAB NO. ของ LAB ไม่เปลี่ยน */
.lab-item-grid-wrap{overflow-x:auto;margin-left:-42px;padding-top:0}.lab-item-grid{display:grid;grid-template-columns:42px 52px 100px minmax(190px,1.5fr) minmax(170px,1.1fr) 135px 125px 86px minmax(115px,.9fr) minmax(105px,.8fr);gap:10px;align-items:center;min-width:1210px;padding:6px 0}.lab-item-head{min-height:44px;color:var(--ink);font-size:11px;font-weight:650;border-top:1px solid var(--el-color-primary-light-7,#c6e2ff);border-bottom:1px solid var(--el-color-primary-light-7,#c6e2ff);background:var(--primary-50)}.lab-item-row{min-height:52px;border-bottom:1px dashed var(--border-lighter);font-size:12px;transition:background-color .12s}.lab-item-row:last-child{border-bottom:0}.lab-item-row.is-selectable{cursor:pointer}.lab-item-row.is-selectable:hover{background:var(--fill-light)}.lab-item-row.is-selected,.lab-item-row.is-selected:hover{background:var(--primary-50)}.lab-item-check-cell{position:sticky;left:0;z-index:2;align-self:stretch;display:flex;align-items:center;padding-left:12px;background:var(--fill-lighter);box-shadow:1px 0 0 var(--border-lighter)}.lab-item-head>.lab-item-check-cell{z-index:3;background:var(--primary-50);box-shadow:1px 0 0 var(--el-color-primary-light-7,#c6e2ff)}.lab-item-row.is-selectable:hover>.lab-item-check-cell{background:var(--fill-light)}.lab-item-row.is-selected>.lab-item-check-cell,.lab-item-row.is-selected:hover>.lab-item-check-cell{background:var(--primary-50)}.lab-test-name{color:var(--ink);font-weight:650}.lab-item-specimen-cell{padding-right:8px;transform:translateX(-8px)}.lab-specimen-select{width:100%}.lab-specimen-select .el-select__wrapper{min-height:30px}.lab-specimen-select .el-select__selected-item{color:var(--text);font-weight:700}.lab-specimen-select.lab-specimen-changed .el-select__selected-item{color:var(--danger);font-weight:700}.lab-item-collected-time span{display:block;font-weight:400;line-height:1.35}.lab-item-row [data-label]:before{display:none}
/* แท็บออกผลใช้ขนาด/สีเดียวกับ tab order แต่เว้น gutter 42px โดยไม่มี checkbox */
.lab-result-list{padding-top:0;overflow-x:auto;margin-left:-42px}.lab-result-list-head,.lab-result-list-row{display:grid;grid-template-columns:52px minmax(260px,1.8fr) 130px 120px minmax(120px,.8fr);gap:12px;align-items:center;min-width:772px;padding:6px 0 6px 42px}.lab-result-list-head{min-height:44px;border-top:1px solid var(--el-color-primary-light-7,#c6e2ff);border-bottom:1px solid var(--el-color-primary-light-7,#c6e2ff);background:var(--primary-50);color:var(--ink);font-size:11px;font-weight:650}.lab-result-list-row{min-height:52px;border-bottom:1px dashed var(--border-lighter)}.lab-result-list-status{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.lab-critical-status{display:inline-flex;min-height:26px;align-items:center;padding:2px 8px;border:1px solid;border-radius:4px;font-size:11px;font-weight:650;white-space:nowrap}.lab-critical-status.is-critical{border-color:var(--el-color-danger-light-5,#fab6b6);background:var(--danger-50);color:var(--danger)}.lab-critical-status.is-normal{border-color:var(--el-color-success-light-5,#b3e19d);background:var(--success-50);color:var(--success)}.lab-critical-status.is-pending{border-color:var(--el-border-color-darker,#c8c9cc);background:var(--fill);color:var(--muted)}.lab-result-hidden-tag{display:inline-flex;min-height:22px;align-items:center;padding:1px 7px;border:1px solid var(--el-color-warning-light-5,#f3d19e);border-radius:999px;background:var(--warning-50);color:var(--warning);font-size:10px;font-weight:700;white-space:nowrap}
.lab-cancel-summary{display:grid;gap:6px;margin-bottom:14px;padding:13px 14px;border:1px solid #fab6b6;border-radius:6px;background:#fef0f0;color:#c45656}.lab-cancel-summary strong{color:var(--ink)}.lab-cancel-summary span{font-size:12px;line-height:1.5}.lab-cancel-reason{display:block}.lab-cancel-reason>span{display:block;margin-bottom:6px;color:var(--ink);font-weight:650}.lab-cancel-reason b{color:var(--danger)}.lab-cancel-reason .el-select{width:100%}
.lab-manual-form{min-height:300px}.lab-result-viewer{color:var(--text)}.lab-result-critical-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;padding:10px 13px;border:1px solid #fab6b6;border-radius:7px;background:#fef0f0;color:#c45656}.lab-result-critical-banner span{font-size:11px}.lab-result-patient-card{display:grid;grid-template-columns:52px minmax(190px,1.35fr) repeat(3,minmax(108px,.7fr));gap:13px 16px;align-items:center;padding:15px;border:1px solid var(--border-light);border-radius:8px;background:var(--fill-lighter)}.lab-result-avatar{display:grid;width:44px;height:44px;grid-row:1/3;place-items:center;border-radius:50%;background:#ecf5ff;color:#337ecc;font-size:13px;font-weight:750}.lab-result-patient-main{min-width:0}.lab-result-patient-main span,.lab-result-meta span,.lab-manual-fields label>span,.lab-result-value-row>div>span{display:block;margin-bottom:4px;color:var(--muted);font-size:11px;font-weight:650}.lab-result-patient-main strong{display:block;overflow:hidden;color:var(--ink);font-size:16px;text-overflow:ellipsis;white-space:nowrap}.lab-result-patient-main small{display:block;margin-top:3px;color:var(--muted);font-size:11px}.lab-result-meta{min-width:0}.lab-result-meta strong{display:block;overflow:hidden;color:var(--ink);font-size:12px;text-overflow:ellipsis;white-space:nowrap}.lab-result-dialog-action{position:relative;padding-right:42px}.lab-result-dialog-action>.el-button{position:absolute;top:0;right:0}.lab-result-section-head{display:flex;align-items:center;justify-content:space-between;margin-top:17px;padding-bottom:8px}.lab-result-section-head strong{color:var(--ink);font-size:14px}.lab-result-section-head span{color:var(--warning);font-size:11px}.lab-result-values{border:1px solid var(--border-light);border-radius:7px;overflow-x:auto}.lab-result-value-head,.lab-result-value-row{display:grid;grid-template-columns:90px minmax(180px,1.45fr) minmax(110px,.8fr) minmax(115px,.8fr) 80px minmax(105px,.8fr) minmax(130px,1fr);gap:12px;min-width:940px;padding:10px 12px}.lab-result-value-head{border-bottom:1px solid var(--border);background:var(--fill);color:var(--muted);font-size:11px;font-weight:700}.lab-result-value-row{align-items:center;border-bottom:1px solid var(--border-lighter)}.lab-result-value-row:last-child{border-bottom:0}.lab-result-value-row>div{min-width:0}.lab-result-value-row strong,.lab-result-value-row small{display:block;overflow-wrap:anywhere}.lab-result-value-row small{margin-top:2px;color:var(--muted);font-size:10px}.lab-result-measured{color:var(--primary);font-size:17px}.lab-result-previous{padding:7px 9px;border-radius:5px;background:var(--fill-light)}.lab-critical-value{color:var(--danger)!important}.lab-previous-result{margin:12px 0;padding:10px 12px;border:1px solid #b3d8ff;border-radius:6px;background:#ecf5ff;color:#337ecc}.lab-previous-result.is-empty{border-color:var(--border-light);background:var(--fill-light);color:var(--muted)}.lab-manual-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.lab-manual-fields label{display:block;min-width:0}.lab-manual-fields .el-select{width:100%}.lab-manual-hint{margin-top:9px;color:var(--muted);font-size:11px}
.lab-result-dialog .el-dialog__body{max-height:calc(100vh - 190px);overflow:auto}.lab-result-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding-right:28px}.lab-result-dialog-head>div:first-child{display:grid;gap:3px}.lab-result-dialog-head strong{color:var(--ink);font-size:18px}.lab-result-dialog-head small{color:var(--muted);font-size:12px}.lab-result-dialog-tools{display:flex;align-items:center;gap:9px}.lab-result-edit-button svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.lab-result-mode{display:inline-flex;min-height:25px;align-items:center;padding:2px 9px;border:1px solid var(--border);border-radius:999px;background:var(--fill-light);color:var(--muted);font-size:11px;font-weight:650;white-space:nowrap}.lab-result-mode.is-editing{border-color:#a0cfff;background:#ecf5ff;color:#337ecc}.lab-result-visibility-button{margin-left:auto!important}.lab-result-hidden-notice{display:grid;gap:3px;margin-bottom:12px;padding:10px 12px;border:1px solid #f3d19e;border-radius:7px;background:#fdf6ec;color:#b88230}.lab-result-hidden-notice strong{color:#b88230}.lab-result-hidden-notice span{font-size:12px}.lab-result-hidden-notice small{color:var(--muted);font-size:11px}.lab-visibility-summary{display:grid;gap:6px;margin-bottom:14px;padding:13px 14px;border:1px solid #f3d19e;border-radius:7px;background:#fdf6ec}.lab-visibility-summary strong{color:var(--ink)}.lab-visibility-summary span{font-size:12px;line-height:1.5}.lab-visibility-summary .is-critical{color:var(--danger);font-weight:650}.lab-visibility-reason{display:block}.lab-visibility-reason>span{display:block;margin-bottom:6px;color:var(--ink);font-weight:650}.lab-visibility-reason b{color:var(--danger)}.lab-result-value-head,.lab-result-value-row{grid-template-columns:56px 48px minmax(180px,1fr) 132px 132px 94px 104px 188px;min-width:940px}.lab-result-value-row .el-select{width:100%}.lab-result-signal{display:block;width:10px;height:10px;margin-left:7px;border:1px solid;border-radius:50%}.lab-result-signal.is-normal{border-color:#4e9631;background:#2f761e;box-shadow:0 0 0 3px rgba(103,194,58,.10)}.lab-result-signal.is-critical{border-color:#d46a6a;background:#b84d4d;box-shadow:0 0 0 3px rgba(245,108,108,.12)}.lab-result-attachments{display:grid;gap:10px;margin-top:16px;padding:14px;border:1px solid var(--border-light);border-radius:7px;background:var(--fill-lighter)}.lab-result-attachments-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.lab-result-attachments-head>div{display:grid;gap:3px}.lab-result-attachments-head strong{color:var(--ink);font-size:14px}.lab-result-attachments-head small,.lab-result-upload-note{color:var(--muted);font-size:11px}.lab-result-attachments-head>span{color:var(--muted);font-size:11px}.lab-result-file-list{display:grid;gap:6px}.lab-result-file{display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--border-light);border-radius:6px;background:var(--white);color:var(--text);text-decoration:none}.lab-result-file:hover{border-color:#a0cfff;color:#337ecc}.lab-result-file>span{color:#337ecc;font-size:10px;font-weight:700}.lab-result-file>strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lab-result-file>small{color:var(--muted);font-size:10px}.lab-result-upload .el-upload{display:inline-flex}
.lab-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}.lab-result-dialog .el-dialog__header{margin:0;padding:15px 18px;border-bottom:1px solid var(--border-lighter)}.lab-result-dialog .el-dialog__headerbtn{top:9px;right:10px}.lab-result-dialog .el-dialog__body{max-height:calc(100vh - 160px);padding:18px;overflow:auto;overscroll-behavior:contain}.lab-result-dialog .el-dialog__footer{padding:12px 18px;border-top:1px solid var(--border-lighter)}.lab-result-dialog-head{display:block;padding-right:32px}.lab-result-dialog-head>div:first-child{display:grid;gap:2px}.lab-result-title-row{display:flex;align-items:center;gap:8px}.lab-result-dialog-head strong{font-size:17px}.lab-result-dialog-head small{font-size:11px}.lab-result-edit-button{display:grid;width:28px;height:28px;place-items:center;padding:0;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--muted);cursor:pointer}.lab-result-edit-button:hover:not(:disabled){border-color:#a0cfff;background:#ecf5ff;color:var(--primary)}.lab-result-edit-button[aria-pressed=true]{border-color:var(--primary);background:#ecf5ff;color:var(--primary)}.lab-result-edit-button:disabled{cursor:not-allowed;opacity:.45}.lab-result-edit-button svg{width:15px;height:15px}.lab-result-mode{min-height:20px;margin-left:4px;padding:0 7px;background:var(--fill-lighter);font-size:10px}.lab-result-values{border-color:var(--border);border-radius:7px}.lab-result-value-head,.lab-result-value-row{grid-template-columns:56px 48px minmax(180px,1fr) 132px 132px 94px 104px 188px;gap:0;min-width:940px;padding:0}.lab-result-value-head{min-height:42px;align-items:center;background:var(--fill-soft)}.lab-result-value-head>span,.lab-result-value-row>div{box-sizing:border-box;padding:10px}.lab-result-value-row{min-height:46px;align-items:start}.lab-result-profile-row{display:flex;min-width:940px;min-height:40px;align-items:center;padding:5px 10px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--fill-light)}.lab-result-value-head+.lab-result-profile-row{border-top:0}.lab-result-profile-row strong{color:var(--ink);font-size:13px}.lab-result-test-name{color:var(--ink);font-weight:650}.lab-result-previous{padding:10px!important;border-radius:0;background:transparent;color:var(--muted)}.lab-result-measured{color:var(--ink);font-size:inherit;font-weight:700}.lab-result-value-row .el-input,.lab-result-value-row .el-select{width:100%}
.lab-empty{padding:34px 20px;text-align:center;color:var(--muted);line-height:1.7}.lab-empty strong{color:var(--ink)}.lab-pagination{display:flex;justify-content:flex-end;padding-top:10px}.lab-mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
@media(max-width:1100px){.lab-list-head{display:none}.lab-patient-row{grid-template-columns:32px minmax(180px,1.4fr) minmax(130px,1fr) minmax(135px,1fr) 58px 58px 58px;gap:6px 10px}.lab-expand-button{grid-column:1;grid-row:1/3}.lab-patient-summary{grid-column:2;grid-row:1}.lab-context-tags{grid-column:3;grid-row:1}.lab-row-status-check{grid-column:4;grid-row:1}.lab-patient-row>.lab-plain-action:nth-last-child(3){grid-column:5;grid-row:1}.lab-patient-row>.lab-plain-action:nth-last-child(2){grid-column:6;grid-row:1}.lab-patient-row>.lab-plain-action:last-child{grid-column:7;grid-row:1}.lab-items-cell{grid-column:2;grid-row:2}.lab-specimen-cell{grid-column:3;grid-row:2}.lab-order-cell{grid-column:4;grid-row:2}.lab-doctor-cell{grid-column:5/8;grid-row:2}.lab-metric:before,.lab-doctor-cell:before{display:block;content:attr(data-label);margin-bottom:3px;color:var(--muted);font-size:10px;font-weight:650}}
@media(max-width:900px){.lab-search-control{width:calc(50% - 5px)}.lab-date-control{width:calc(50% - 5px)}.lab-create-button{margin-left:0}.lab-item-grid-wrap{overflow:visible;margin-left:0}.lab-item-head{display:none}.lab-item-grid.lab-item-row{display:grid;grid-template-columns:1fr 1fr;gap:0 14px;min-width:0;padding:10px 0}.lab-item-grid.lab-item-row>.lab-item-check-cell{position:static;z-index:auto;padding-left:0;background:transparent;box-shadow:none}.lab-item-row>div{display:grid;grid-template-columns:minmax(92px,.42fr) minmax(0,1fr);align-items:center;gap:8px;min-height:34px;padding:3px 0;border-bottom:1px dashed var(--border-lighter)}.lab-item-row>div:before{display:block;content:attr(data-label);color:var(--muted);font-size:10px;font-weight:650}.lab-item-row>div:last-child{border-bottom:0}.lab-item-specimen-cell{padding-right:0;transform:none}.lab-item-collected-time span:last-child{grid-column:2}.lab-specimen-select{max-width:none}.lab-result-list{margin-left:0}.lab-result-list-head,.lab-result-list-row{grid-template-columns:44px minmax(180px,1fr) 110px 120px 82px;min-width:584px;padding:6px 0}}
@media(max-width:720px){.lab-toolbar{display:grid;grid-template-columns:1fr 1fr;gap:8px}.lab-search-control,.lab-toolbar .lab-date-control{width:100%!important;max-width:none;flex:auto;grid-column:1/-1}.lab-toolbar>.el-button,.lab-toolbar>.el-dropdown{width:100%}.lab-toolbar>.el-dropdown .el-button{width:100%}.lab-create-button{grid-column:1/-1}.lab-scan-context .el-button{width:100%;margin-left:0}.lab-status-strip{flex-wrap:nowrap;overflow-x:auto;padding-bottom:3px}.lab-status-chip,.lab-status-legend{flex:0 0 auto}.lab-patient-row{grid-template-columns:28px minmax(0,1fr) 58px 58px 58px;padding:9px 8px}.lab-expand-button{grid-column:1;grid-row:1}.lab-patient-summary{grid-column:2;grid-row:1}.lab-row-status-check{grid-column:3/6;grid-row:1;justify-self:end}.lab-context-tags{grid-column:2/6;grid-row:2}.lab-items-cell{grid-column:2;grid-row:3}.lab-specimen-cell{grid-column:3/6;grid-row:3}.lab-order-cell{grid-column:2/6;grid-row:4}.lab-doctor-cell{grid-column:2/6;grid-row:5}.lab-patient-row>.lab-plain-action:nth-last-child(3){grid-column:3;grid-row:6}.lab-patient-row>.lab-plain-action:nth-last-child(2){grid-column:4;grid-row:6}.lab-patient-row>.lab-plain-action:last-child{grid-column:5;grid-row:6}.lab-detail-panel{padding:0 8px 12px}.lab-detail-top{align-items:flex-start;flex-wrap:wrap}.lab-bulk-actions{width:100%;margin:0;padding-bottom:7px;flex-wrap:wrap}.lab-item-grid.lab-item-row{grid-template-columns:1fr}.lab-pagination{justify-content:flex-start;overflow-x:auto}.lab-result-patient-card{grid-template-columns:44px 1fr}.lab-result-avatar{grid-row:auto}.lab-result-patient-main{grid-column:2}.lab-result-meta{grid-column:1/-1}.lab-manual-fields{grid-template-columns:1fr}.lab-result-list-head{display:none}.lab-result-list-row{grid-template-columns:1fr 1fr;min-width:0;padding:8px 0}.lab-result-list-row>div:nth-child(2){grid-column:1/-1;grid-row:1}}
@media(prefers-reduced-motion:reduce){.lab-cpoe *{scroll-behavior:auto!important;transition-duration:.001ms!important}}`

fs.writeFileSync(outputPath, JSON.stringify(form, null, 2) + '\n')
