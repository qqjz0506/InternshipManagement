import { createContext, useContext, useEffect, useState } from 'react'
import * as internshipApi from '../api/internshipApi'
import { useAuth } from './AuthContext'

// Phase 4C: Internship không còn dùng mock data/internships.js làm source of truth — state đến từ
// GET /api/internships. KHÔNG dùng createApiResourceContext (khác InternshipsContext interface cũ:
// `internships`/`addInternship`/`updateInternship`/`deleteInternship`/`isDuplicateRegistration`,
// không phải `items`/`addItem`/`updateItem`/`deleteItem` — giữ nguyên tên để không phá 12 file
// consumer đang dùng tên cũ, đúng mục "giữ interface hiện tại tối đa").
const InternshipsContext = createContext(null)

export function InternshipsProvider({ children }) {
  const { currentUser } = useAuth()
  const [internships, setInternships] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState(null)

  // Dùng chung cho cả 4 role (scoped khác nhau ở backend) — chỉ cần gate "đã đăng nhập" (mục 3 Phase
  // 6A, Internships thuộc nhóm B: shared authenticated data, không cần role-check riêng).
  useEffect(() => {
    if (!currentUser) {
      setInternships([])
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    internshipApi
      .getAll()
      .then((data) => {
        if (!cancelled) setInternships(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role])

  function getById(id) {
    return internships.find((item) => item.id === Number(id))
  }

  // Chỉ còn ý nghĩa đầy đủ trong phạm vi danh sách ĐÃ LOAD (đã bị backend scope theo role) — với
  // Admin (thấy tất cả) hành vi giống hệt bản mock cũ; với Student (chỉ thấy hồ sơ của chính mình)
  // vẫn đúng vì nơi duy nhất gọi hàm này cho Student luôn kiểm tra đúng student.id của chính họ.
  function isDuplicateRegistration(studentId, periodId, ignoreId) {
    return internships.some(
      (item) => item.student_id === studentId && item.period_id === periodId && item.id !== ignoreId,
    )
  }

  // Không throw — trả { success, message?, item? } giống convention các Context API khác, để Page
  // không cần try/catch, chỉ kiểm tra .success (mục 9 Phase 4B-1, áp dụng lại ở đây).
  async function addInternship(payload) {
    setIsMutating(true)
    setError(null)
    try {
      const created = await internshipApi.create(payload)
      setInternships((prev) => [...prev, created])
      return { success: true, item: created }
    } catch (err) {
      setError(err.message)
      return { success: false, message: err.message, status: err.status }
    } finally {
      setIsMutating(false)
    }
  }

  // PUT backend là PARTIAL/merge (khác Department/Student/.../Topic — xem internshipService.js) —
  // forward đúng `changes` như đã nhận, KHÔNG tự merge/full-object ở đây.
  async function updateInternship(id, changes) {
    setIsMutating(true)
    setError(null)
    try {
      const updated = await internshipApi.update(id, changes)
      setInternships((prev) => prev.map((item) => (item.id === Number(id) ? updated : item)))
      return { success: true, item: updated }
    } catch (err) {
      setError(err.message)
      return { success: false, message: err.message, status: err.status }
    } finally {
      setIsMutating(false)
    }
  }

  async function deleteInternship(id) {
    setIsMutating(true)
    setError(null)
    try {
      await internshipApi.remove(id)
      setInternships((prev) => prev.filter((item) => item.id !== Number(id)))
      return { success: true }
    } catch (err) {
      setError(err.message)
      return { success: false, message: err.message, status: err.status }
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <InternshipsContext.Provider
      value={{
        internships,
        isLoading,
        isMutating,
        error,
        getById,
        isDuplicateRegistration,
        addInternship,
        updateInternship,
        deleteInternship,
      }}
    >
      {children}
    </InternshipsContext.Provider>
  )
}

export function useInternships() {
  const context = useContext(InternshipsContext)
  if (!context) {
    throw new Error('useInternships phải được dùng bên trong InternshipsProvider')
  }
  return context
}
