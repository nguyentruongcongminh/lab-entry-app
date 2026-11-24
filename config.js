'use strict';
/*
 * config.js — Khai báo các loại xét nghiệm và bộ trường kết quả.
 * Muốn thêm/bớt loại xét nghiệm hoặc trường: chỉ sửa file này.
 *
 * Mỗi trường (field):
 *   key    : khóa lưu trong dữ liệu (không dấu, không khoảng trắng)
 *   label  : nhãn hiển thị (phần sau dấu ":" trong form mẫu)
 *   type   : 'text'  -> ô nhập tự do
 *            'chips' -> các nút chọn mức, ví dụ ['(+)', '(++)', '(+++)']
 *            (bấm lại nút đang chọn để bỏ chọn = không ghi nhận)
 *            'tick'  -> nút bật/tắt "Đã có KQ": giá trị lưu là 'Đã có KQ'
 *            khi đã đánh dấu, '' khi chưa (cho các loại chỉ cần xác nhận
 *            đã có kết quả, không nhập chữ — vd 3 loại KSK ở dưới).
 *
 * Ba loại KSK (v118, Minh chốt 2026-11-24) là BA DANH MỤC RIÊNG — nước tiểu
 * NT, máu ống SH-MD, ống CTM — dù chung một ID bệnh nhân vẫn nhận thành 3
 * mẫu riêng (luật trùng chỉ chặn khi trùng cả ID + loại). v117 từng gộp
 * thành 1 loại gói 3 trường tick; Minh sửa lại: mỗi ống là một danh mục.
 */
const LAB_CONFIG = {
  /* Mẫu chờ (chưa có kết quả hoặc chờ phát hành) quá số phút này sẽ bị tô đỏ cảnh báo */
  overdueMinutes: 60,
  testTypes: [
    {
      id: 'cao-tim-nam',
      name: 'Cạo tìm nấm',
      fields: [
        { key: 'ketQua', label: 'Kết quả', type: 'text' },
      ],
      quick: [
        { label: 'Âm tính', values: { ketQua: 'Âm tính' } },
      ],
    },
    {
      id: 'soi-muc-tau-dnt',
      name: 'Soi nhuộm mực tàu DNT',
      fields: [
        { key: 'ketQua', label: 'Kết quả', type: 'text' },
      ],
      quick: [
        { label: 'Âm tính', values: { ketQua: 'Âm tính' } },
      ],
    },
    {
      id: 'soi-tinh-the-dich',
      name: 'Soi tinh thể dịch',
      fields: [
        { key: 'ketQua', label: 'Kết quả', type: 'text' },
      ],
      quick: [
        { label: 'Âm tính', values: { ketQua: 'Âm tính' } },
      ],
    },
    {
      id: 'soi-tuoi-huyet-trang',
      name: 'Soi tươi huyết trắng',
      fields: [
        { key: 'nam', label: 'Nấm', type: 'chips', levels: ['(+)', '(++)', '(+++)'] },
        { key: 'tapTrung', label: 'Tạp trùng', type: 'chips', levels: ['(+)', '(++)', '(+++)'] },
        { key: 'trichomonas', label: 'Trichomonas', type: 'chips', levels: ['(+)', '(++)', '(+++)'] },
        { key: 'bachCau', label: 'Bạch cầu', type: 'text' },
        { key: 'teBao', label: 'Tế bào', type: 'text' },
        { key: 'hongCau', label: 'Hồng cầu', type: 'chips', levels: ['(+)', '(++)', '(+++)'] },
        { key: 'clueCell', label: 'Clue cell', type: 'chips', levels: ['(+)'] },
        { key: 'lactobacilli', label: 'Lactobaccilli', type: 'chips', levels: ['(+)', '(++)'] },
        { key: 'khac', label: 'Khác', type: 'text' },
      ],
    },
    {
      id: 'mau-an',
      name: 'Máu ẩn',
      /* Test nhanh: chờ đủ số phút này mới có kết quả -> hiện nút Bấm giờ cho từng mẫu.
         Loại nào cần đếm giờ thì thêm waitMinutes vào khai báo của loại đó. */
      waitMinutes: 20,
      fields: [
        { key: 'ketQua', label: 'Kết quả', type: 'text' },
      ],
      quick: [
        { label: 'Âm tính', values: { ketQua: 'Âm tính' } },
      ],
    },
    {
      id: 'sp',
      name: 'SP',
      fields: [
        { key: 'hongCau', label: 'Hồng cầu', type: 'chips', levels: ['(+)', '(++)', '(+++)'] },
        { key: 'bachCau', label: 'Bạch cầu', type: 'chips', levels: ['(+)', '(++)', '(+++)'] },
        { key: 'kySinhTrung', label: 'Ký sinh trùng', type: 'text' },
        { key: 'khac', label: 'Khác', type: 'text' },
      ],
      quick: [
        { label: 'Âm tính', values: { hongCau: '', bachCau: '', kySinhTrung: 'Âm tính', khac: '' } },
      ],
    },
    {
      /* v118 (Minh chốt 2026-11-24): khám sức khỏe gồm 3 DANH MỤC RIÊNG —
       * nước tiểu NT, máu ống SH-MD, ống CTM (huyết học). Mỗi danh mục là
       * một loại riêng với 1 trường tick: nhận mẫu chỉ để lên danh sách,
       * máy trả kết quả ống nào thì vào mẫu của ống đó bấm "Đã có KQ" rồi
       * phát hành. Chung ID khác danh mục vẫn nhận bình thường (luật trùng
       * chỉ chặn trùng ID + trùng loại). builtin: loại hệ thống, app tự bổ
       * sung/ép đúng định nghĩa, không sửa/xóa trong app.
       * Giữ id 'ksk-nuoc-tieu' của v117 để 252 mẫu đã chuyển đổi hôm
       * 24/11/2026 (vốn là danh mục NT) nằm nguyên, không phải chuyển lại;
       * giữ key trường 'nt' để tick NT đã đánh ở v117 không bị mất. */
      id: 'ksk-nuoc-tieu',
      name: 'KSK nước tiểu',
      builtin: true,
      fields: [
        { key: 'nt', label: 'NT', type: 'tick' },
      ],
    },
    {
      id: 'ksk-shmd',
      name: 'KSK máu ống SH-MD',
      builtin: true,
      fields: [
        { key: 'shmd', label: 'SH-MD', type: 'tick' },
      ],
    },
    {
      id: 'ksk-ctm',
      name: 'KSK ống CTM',
      builtin: true,
      fields: [
        { key: 'ctm', label: 'CTM', type: 'tick' },
      ],
    },
  ],
};

/*
 * Danh mục đang dùng: mặc định là LAB_CONFIG.testTypes ở trên.
 * Từ v19, người dùng tự quản lý danh mục ngay trong app (thêm/sửa/xóa loại + trường);
 * danh mục tự tạo được app nạp qua setTestTypes() và lưu ở localStorage của máy.
 * getTestType()/getTestTypes() luôn tra trong danh mục đang dùng.
 */
let _activeTypes = null;

function setTestTypes(list) {
  _activeTypes = Array.isArray(list) && list.length ? list : null;
}

function getTestTypes() {
  return _activeTypes || LAB_CONFIG.testTypes;
}

function getTestType(typeId) {
  return getTestTypes().find((t) => t.id === typeId) || null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LAB_CONFIG, getTestType, getTestTypes, setTestTypes };
}
