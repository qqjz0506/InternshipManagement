import { createApiResourceContext } from './createApiResourceContext'
import * as evaluationApi from '../api/evaluationApi'

// Phase 4E-1: Evaluation không còn dùng mock data/evaluations.js làm source of truth — state đến từ
// GET /api/evaluations. Evaluator identity (lecturer/company) suy ra từ Internship, KHÔNG có
// evaluator_id — không tự thêm field nào. Ownership + unique(internship_id, evaluator_role) +
// publish rule (Lecturer/Company chỉ publish 1 chiều, Admin cả 2 chiều) đã được backend enforce hoàn
// toàn (Phase 3B) — Context chỉ pass-through CRUD, tái dùng factory có sẵn (naming đã tương thích).
const { Provider, useResource } = createApiResourceContext(evaluationApi, 'Evaluations')

export const EvaluationsProvider = Provider
export const useEvaluations = useResource
