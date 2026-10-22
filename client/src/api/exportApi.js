import { apiClient } from './apiClient'

// Filter tối giản đúng 3 filter thực sự tồn tại ở AdminStatisticsPage.jsx (period/department/company)
// — không tự thêm filter mới (mục 14 Phase 5). Query string chỉ chứa field có giá trị.
function buildQuery({ period_id, department_id, company_id } = {}) {
  const params = new URLSearchParams()
  if (period_id) params.set('period_id', period_id)
  if (department_id) params.set('department_id', department_id)
  if (company_id) params.set('company_id', company_id)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function exportInternships(filters) {
  return apiClient.getBlob(`/exports/internships.xlsx${buildQuery(filters)}`)
}

export function exportEvaluations(filters) {
  return apiClient.getBlob(`/exports/evaluations.xlsx${buildQuery(filters)}`)
}
