import { apiClient } from './apiClient'

// Chỉ map 1-1 với 2 endpoint backend thực có (mục 18) — không chứa logic UI/session.
export function login(email, password) {
  return apiClient.post('/auth/login', { email, password }, { auth: false })
}

export function getMe() {
  return apiClient.get('/auth/me')
}

export function changePassword(currentPassword, newPassword) {
  return apiClient.put('/auth/change-password', { currentPassword, newPassword })
}

export function forgotPassword(email) {
  return apiClient.post('/auth/forgot-password', { email }, { auth: false })
}

export function resetPassword(token, newPassword) {
  return apiClient.post('/auth/reset-password', { token, newPassword }, { auth: false })
}

export function setEmailNotifications(emailNotifications) {
  return apiClient.put('/auth/email-notifications', { emailNotifications })
}
