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
    },
    {
      id: 'soi-muc-tau-dnt',
      name: 'Soi nhuộm mực tàu DNT',
      fields: [
        { key: 'ketQua', label: 'Kết quả', type: 'text' },
      ],
    },
    {
      id: 'soi-tinh-the-dich',
      name: 'Soi tinh thể dịch',
      fields: [
        { key: 'ketQua', label: 'Kết quả', type: 'text' },
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
      fields: [
        { key: 'ketQua', label: 'Kết quả', type: 'text' },
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
    },
  ],
};

function getTestType(typeId) {
  return LAB_CONFIG.testTypes.find((t) => t.id === typeId) || null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LAB_CONFIG, getTestType };
}
