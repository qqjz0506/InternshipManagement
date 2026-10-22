// Sinh 2 file demo (docs/demo-files/) dùng cho E2E (Bước "Admin nhập 3 sinh viên") và demo khi bảo vệ
// đồ án — PHẢI khớp đúng thứ tự cột với COLUMNS ở server/services/studentImportService.js /
// lecturerImportService.js (import đọc theo vị trí cột). Chạy 1 lần bằng tay khi cần tái tạo:
//   node server/scripts/generateImportDemoFiles.js
const path = require('path')
const ExcelJS = require('exceljs')

const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'demo-files')

async function buildStudentsDemo() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Dữ liệu')
  sheet.columns = [
    { header: 'Mã sinh viên*', key: 'student_code', width: 16 },
    { header: 'Họ tên*', key: 'full_name', width: 24 },
    { header: 'Giới tính* (Nam/Nữ/Khác)', key: 'gender', width: 22 },
    { header: 'Ngày sinh (YYYY-MM-DD hoặc DD/MM/YYYY)', key: 'date_of_birth', width: 26 },
    { header: 'Số điện thoại', key: 'phone', width: 16 },
    { header: 'Email*', key: 'email', width: 28 },
    { header: 'Địa chỉ', key: 'address', width: 28 },
    { header: 'Mã khoa*', key: 'department_code', width: 14 },
    { header: 'Ngành', key: 'major', width: 20 },
    { header: 'Lớp', key: 'class', width: 16 },
    { header: 'Trạng thái (active/inactive, bỏ trống = active)', key: 'status', width: 20 },
  ]
  sheet.getRow(1).font = { bold: true }
  sheet.addRow({
    student_code: '99990001',
    full_name: 'Đinh Văn Khang',
    gender: 'Nam',
    date_of_birth: '2004-02-10',
    phone: '0909990001',
    email: 'khang.dinh.demo@student.edu.vn',
    address: 'Hà Nội',
    department_code: 'CNTT',
    major: 'Công nghệ thông tin',
    class: 'DH22CNTT01',
    status: 'active',
  })
  sheet.addRow({
    student_code: '99990002',
    full_name: 'Lương Thị Quỳnh',
    gender: 'Nữ',
    date_of_birth: '2004-06-18',
    phone: '0909990002',
    email: 'quynh.luong.demo@student.edu.vn',
    address: 'TP. Hồ Chí Minh',
    department_code: 'KTPM',
    major: 'Kỹ thuật phần mềm',
    class: 'DH22KTPM02',
    status: 'active',
  })
  sheet.addRow({
    student_code: '99990003',
    full_name: 'Phùng Minh Nhật',
    gender: 'Nam',
    date_of_birth: '2004-11-02',
    phone: '0909990003',
    email: 'nhat.phung.demo@student.edu.vn',
    address: 'Đà Nẵng',
    department_code: 'HTTT',
    major: 'Hệ thống thông tin',
    class: 'DH22HTTT03',
    status: 'active',
  })

  const guide = workbook.addWorksheet('Hướng dẫn')
  guide.columns = [{ header: 'Hướng dẫn nhập liệu', key: 'line', width: 100 }]
  guide.getRow(1).font = { bold: true }
  ;[
    'Các cột có dấu (*) là bắt buộc: Mã sinh viên, Họ tên, Giới tính, Email, Mã khoa.',
    'KHÔNG đổi thứ tự cột, KHÔNG xoá dòng header (dòng 1). Dữ liệu bắt đầu từ dòng 2.',
    'File này đã có sẵn 3 dòng demo hợp lệ — dùng trực tiếp để demo chức năng nhập Excel.',
    'Mã khoa hợp lệ: CNTT, KTPM, HTTT, ATTT (xem server/db/seed.sql).',
  ].forEach((line) => guide.addRow({ line }))

  await workbook.xlsx.writeFile(path.join(OUT_DIR, 'students-import-demo.xlsx'))
}

async function buildLecturersDemo() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Dữ liệu')
  sheet.columns = [
    { header: 'Mã giảng viên*', key: 'lecturer_code', width: 16 },
    { header: 'Họ tên*', key: 'full_name', width: 24 },
    { header: 'Email*', key: 'email', width: 28 },
    { header: 'Số điện thoại', key: 'phone', width: 16 },
    { header: 'Mã khoa*', key: 'department_code', width: 14 },
    { header: 'Học hàm / Học vị', key: 'position', width: 24 },
    { header: 'Trạng thái (active/inactive, bỏ trống = active)', key: 'status', width: 20 },
  ]
  sheet.getRow(1).font = { bold: true }
  sheet.addRow({
    lecturer_code: 'GVDEMO01',
    full_name: 'Tạ Thị Hải Yến',
    email: 'yen.ta.demo@edu.vn',
    phone: '0909880001',
    department_code: 'CNTT',
    position: 'Thạc sĩ',
    status: 'active',
  })
  sheet.addRow({
    lecturer_code: 'GVDEMO02',
    full_name: 'Bùi Xuân Trường',
    email: 'truong.bui.demo@edu.vn',
    phone: '0909880002',
    department_code: 'KTPM',
    position: 'Tiến sĩ',
    status: 'active',
  })
  sheet.addRow({
    lecturer_code: 'GVDEMO03',
    full_name: 'Cao Ngọc Diệp',
    email: 'diep.cao.demo@edu.vn',
    phone: '0909880003',
    department_code: 'HTTT',
    position: 'Giảng viên',
    status: 'active',
  })

  const guide = workbook.addWorksheet('Hướng dẫn')
  guide.columns = [{ header: 'Hướng dẫn nhập liệu', key: 'line', width: 100 }]
  guide.getRow(1).font = { bold: true }
  ;[
    'Các cột có dấu (*) là bắt buộc: Mã giảng viên, Họ tên, Email, Mã khoa.',
    'KHÔNG đổi thứ tự cột, KHÔNG xoá dòng header (dòng 1). Dữ liệu bắt đầu từ dòng 2.',
    'File này đã có sẵn 3 dòng demo hợp lệ — dùng trực tiếp để demo chức năng nhập Excel.',
    'Mã khoa hợp lệ: CNTT, KTPM, HTTT, ATTT (xem server/db/seed.sql).',
  ].forEach((line) => guide.addRow({ line }))

  await workbook.xlsx.writeFile(path.join(OUT_DIR, 'lecturers-import-demo.xlsx'))
}

async function main() {
  await buildStudentsDemo()
  await buildLecturersDemo()
  console.log('Đã tạo students-import-demo.xlsx và lecturers-import-demo.xlsx trong docs/demo-files/.')
}

main()
