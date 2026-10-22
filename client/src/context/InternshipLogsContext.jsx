import { createApiResourceContext } from './createApiResourceContext'
import * as internshipLogApi from '../api/internshipLogApi'

// Phase 4D-1: InternshipLog không còn dùng mock data/internshipLogs.js làm source of truth — state
// đến từ GET /api/internship-logs. Ownership (qua Internship cha) + field whitelist theo role
// (Student: nội dung, Lecturer: lecturer_comment+status, Company Mentor: company_comment) + review
// lock đã được backend enforce hoàn toàn (Phase 3B) — Context chỉ pass-through CRUD, giống Topics/
// Companies (đã dùng sẵn naming items/addItem/updateItem/deleteItem nên tái dùng được factory thẳng).
const { Provider, useResource } = createApiResourceContext(internshipLogApi, 'InternshipLogs')

export const InternshipLogsProvider = Provider
export const useInternshipLogs = useResource
