import { createApiResourceContext } from './createApiResourceContext'
import * as reportApi from '../api/reportApi'

// Phase 4D-2: Report không còn dùng mock data/reports.js làm source of truth — state đến từ
// GET /api/reports. Ownership (qua Internship cha) + field whitelist theo role (Lecturer:
// status+reviewer_comment, Company Mentor: company_comment, Student: không có PUT) đã được backend
// enforce hoàn toàn (Phase 3B) — Context chỉ pass-through CRUD, tái dùng factory có sẵn (naming
// items/addItem/updateItem/deleteItem đã tương thích sẵn, giống InternshipLogs/Topics).
const { Provider, useResource } = createApiResourceContext(reportApi, 'Reports')

export const ReportsProvider = Provider
export const useReports = useResource
