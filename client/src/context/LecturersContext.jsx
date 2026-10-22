import { createApiResourceContext } from './createApiResourceContext'
import * as lecturerApi from '../api/lecturerApi'

// Phase 4B-2: Lecturer không còn dùng mock data/lecturers.js làm source of truth — state đến từ
// GET /api/lecturers. Ownership (Lecturer chỉ xem chính mình; Student/Company Mentor chỉ xem GV
// liên quan) đã được backend enforce hoàn toàn (Phase 3B) — Context chỉ pass-through CRUD.
const { Provider, useResource } = createApiResourceContext(lecturerApi, 'Lecturers')

export const LecturersProvider = Provider
export const useLecturers = useResource
