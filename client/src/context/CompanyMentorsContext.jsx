import { createApiResourceContext } from './createApiResourceContext'
import * as companyMentorApi from '../api/companyMentorApi'

// Phase 4B-3: CompanyMentor không còn dùng mock data/companyMentors.js làm source of truth — state
// đến từ GET /api/company-mentors. Ownership/ scoping đã được backend enforce hoàn toàn (Phase 3B);
// transaction "đổi company -> gỡ phân công Internship" cũng nằm trong backend (companyMentorService.
// update) — Context chỉ pass-through CRUD, KHÔNG tự lặp lại business logic này ở frontend.
const { Provider, useResource } = createApiResourceContext(companyMentorApi, 'CompanyMentors')

export const CompanyMentorsProvider = Provider
export const useCompanyMentors = useResource
