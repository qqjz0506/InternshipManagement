export function isRequired(value) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function isValidPhone(value) {
  return /^0\d{9,10}$/.test(value)
}
