import { createApiResourceContext } from './createApiResourceContext'
import * as internshipPeriodApi from '../api/internshipPeriodApi'

// Phase 4B-1: InternshipPeriod không còn dùng mock data/internshipPeriods.js làm source of
// truth — state luôn đến từ GET /api/internship-periods (xem createApiResourceContext.jsx).
const { Provider, useResource } = createApiResourceContext(internshipPeriodApi, 'InternshipPeriods')

export const InternshipPeriodsProvider = Provider
export const useInternshipPeriods = useResource
