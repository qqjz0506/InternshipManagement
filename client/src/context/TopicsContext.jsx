import { createApiResourceContext } from './createApiResourceContext'
import * as topicApi from '../api/topicApi'

// Phase 4B-4: Topic không còn dùng mock data/topics.js làm source of truth — state đến từ
// GET /api/topics. Ownership khi Student tự đề xuất (suggested_by_student_id không được mạo danh)
// đã được backend enforce hoàn toàn (Phase 3B, topicController.create) — Context chỉ pass-through
// CRUD, không tự thêm logic ownership/mutual-exclusivity nào ở frontend.
const { Provider, useResource } = createApiResourceContext(topicApi, 'Topics')

export const TopicsProvider = Provider
export const useTopics = useResource
