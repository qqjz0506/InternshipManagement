import { createApiResourceContext } from './createApiResourceContext'
import * as companyApi from '../api/companyApi'

// Phase 4B-3: Company không còn dùng mock data/companies.js làm source of truth — state đến từ
// GET /api/companies.
const { Provider, useResource } = createApiResourceContext(companyApi, 'Companies')

export const CompaniesProvider = Provider
export const useCompanies = useResource
