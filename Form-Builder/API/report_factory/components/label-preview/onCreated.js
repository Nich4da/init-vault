const s = this.vueState;
const field = this;

// ขนาดฉลากจริง 8 × 6 ซม. ที่ 96 DPI
s.cardW = 302;
s.cardH = 227;
s.cardFont = 10;

// Logo
s.logoUrl =
  'https://apihis.softmax-one.com/assets/sdform/6a607f2ba608039c539ebb7c/picture/2026/2026_08/2026_08_03/6a58678ad448dfc9d33e2ba8/logo2_all__2026_08_03_21_07_0796585.png';

s.logoReady = true;

// Modal Preview
s.previewVisible = false;
s.currentSig = null;
s.currentSigIndex = -1;

// ข้อมูลผู้ป่วยจำลอง
s.patient = {
  name: 'ด.ช. ทดสอบ จิตใจ',
  hn: '00000001'
};

// อ่าน Generic snapshot จาก formModel
s.getGeneric = () => {
  const model = field.formModel || {};
  const generic = model.gp_ref;

  if (generic && typeof generic === 'object') {
    return generic;
  }

  return {};
};

// อ่านรายการวิธีใช้ยา
s.getSigs = () => {
  const generic = s.getGeneric();

  if (Array.isArray(generic.sigs)) {
    return generic.sigs;
  }

  return [];
};

// อ่านค่าปัจจุบันของ field
s.getFieldValue = (fieldName) => {
  if (field.refField) {
    try {
      const target = field.refField(fieldName);

      if (target && target.getValue) {
        const value = target.getValue();

        if (
          value !== null &&
          value !== undefined &&
          value !== ''
        ) {
          return value;
        }
      }
    } catch (error) {
      console.warn(
        '[label preview] refField failed:',
        fieldName,
        error
      );
    }
  }

  if (field.getFormRef) {
    try {
      const form = field.getFormRef();

      if (form && form.getFieldValue) {
        const value = form.getFieldValue(fieldName);

        if (
          value !== null &&
          value !== undefined &&
          value !== ''
        ) {
          return value;
        }
      }
    } catch (error) {
      console.warn(
        '[label preview] getFieldValue failed:',
        fieldName,
        error
      );
    }
  }

  const model = field.formModel || {};

  return model[fieldName];
};

// แปลง object/string เป็นข้อความ
s.valueToText = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return String(
      value.label ||
      value.name ||
      value.value ||
      ''
    ).trim();
  }

  return String(value).trim();
};

// ชื่อยาหลัก = item_name + special_symbol
s.drugName = () => {
  const itemName = s.valueToText(
    s.getFieldValue('item_name')
  );

  const symbol = s.valueToText(
    s.getFieldValue('special_symbol')
  );

  return (
    itemName +
    (symbol ? ' ' + symbol : '')
  ).trim();
};

// Generic name
s.genericName = () => {
  const generic = s.getGeneric();

  return String(
    generic.generic_name || ''
  ).trim();
};

// เปิด Preview ของ SIG ที่เลือก
s.openPreview = (sig, index) => {
  s.currentSig = sig || {};
  s.currentSigIndex = Number(index);
  s.previewVisible = true;
};

// ปิด Preview
s.closePreview = () => {
  s.previewVisible = false;
};

// Logo โหลดไม่ได้
s.hideBrokenLogo = () => {
  s.logoReady = false;
};
