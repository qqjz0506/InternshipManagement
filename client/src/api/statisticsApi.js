import { apiClient } from './apiClient'

// Filter đúng 3 filter đang có ở AdminStatisticsPage.jsx (period/department/company) — 'all' ở UI
// nghĩa là không gửi field đó lên API (giống exportApi.js).
function buildQuery({ period_id, department_id, company_id } = {}) {
  const params = new URLSearchParams()
  if (period_id) params.set('period_id', period_id)
  if (department_id) params.set('department_id', department_id)
  if (company_id) params.set('company_id', company_id)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function getSummary(filters) {
  return apiClient.get(`/statistics/summary${buildQuery(filters)}`)
}
