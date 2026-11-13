'use strict';
/*
 * build-single.js — Sinh lab-entry-single.html (bản 1 file) từ index.html:
 * nhúng styles.css/print.css vào thẻ <style>, nhúng các file <script src> vào thẻ <script>.
 * Chạy: node tools/build-single.js [--check]
 *   --check : không ghi file, chỉ so sánh với lab-entry-single.html hiện có (thoát mã 1 nếu khác).
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

function build() {
  let html = read('index.html');
  html = html.replace(/<link rel="stylesheet" href="([^"?]+)(?:\?v=\d+)?">/g, (m, href) => {
    return '<style>\n' + read(href) + '\n</style>';
  });
  html = html.replace(/<script src="([^"?]+)(?:\?v=\d+)?"><\/script>/g, (m, src) => {
    return '<script>\n' + read(src) + '\n</script>';
  });
  return html;
}

if (require.main === module) {
  const out = build();
  const target = path.join(root, 'lab-entry-single.html');
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    const same = cur === out;
    console.log(same ? 'KHỚP: lab-entry-single.html đúng bản build' : 'KHÁC: lab-entry-single.html khác bản build (' + cur.length + ' vs ' + out.length + ' ký tự)');
    process.exit(same ? 0 : 1);
  }
  fs.writeFileSync(target, out);
  console.log('Đã ghi lab-entry-single.html (' + out.length + ' ký tự)');
}

module.exports = { build };
