import { createApiResourceContext } from './createApiResourceContext'
import * as departmentApi from '../api/departmentApi'

// Phase 4B-1: Department không còn dùng mock data/departments.js làm source of truth —
// state luôn đến từ GET /api/departments (xem createApiResourceContext.jsx).
const { Provider, useResource } = createApiResourceContext(departmentApi, 'Departments')

export const DepartmentsProvider = Provider
export const useDepartments = useResource
