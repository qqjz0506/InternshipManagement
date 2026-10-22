// Đồng bộ logic với client/src/utils/validators.js — validate tối thiểu, không thêm rule mới.
function isRequired(value) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidPhone(value) {
  return /^0\d{9,10}$/.test(value)
}

function isValidId(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0
}

// Khớp format input type="date" của Frontend (YYYY-MM-DD) — chỉ kiểm tra format + ngày thật tồn tại.
function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

// Rule đổi mật khẩu: tối thiểu 8 ký tự, có ít nhất 1 chữ và 1 số.
function isStrongPassword(value) {
  return typeof value === 'string' && /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(value)
}

module.exports = { isRequired, isValidEmail, isValidPhone, isValidId, isValidDate, isStrongPassword }
