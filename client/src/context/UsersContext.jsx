import { createContext, useContext, useEffect, useState } from 'react'
import * as userApi from '../api/userApi'
import { useAuth } from './AuthContext'
import { canLoadUsers } from './providerAccess'

// Users KHÔNG dùng createApiResourceContext (factory generic CRUD) vì backend không có DELETE
// (không implement delete/lock/reset-password ở Phase 4F-1), và create/update có semantics riêng
// (password optional-on-update, role/profile_id immutable, linking chỉ xảy ra atomically lúc tạo) —
// ép vào factory generic sẽ để lộ 1 deleteItem() chắc chắn lỗi runtime nếu lỡ gọi (mục 4 Phase 4F-2).
const UsersContext = createContext(null)

export function UsersProvider({ children }) {
  const { currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Non-admin (hoặc chưa đăng nhập/chưa khôi phục session xong): không gọi API, dọn sạch data cũ
    // nếu account trước đó là admin (mục 4/10 Phase 6A) — không phải "lỗi", chỉ là "không áp dụng".
    if (!canLoadUsers(currentUser)) {
      setUsers([])
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    userApi
      .getUsers()
      .then((data) => {
        if (!cancelled) {
          setUsers(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role])

  function getById(id) {
    return users.find((user) => user.id === Number(id))
  }

  // Trả { success, item? } hoặc { success:false, message, status } — không throw, giống convention
  // mutation của mọi Context API-backed khác (Context không throw để Page không cần try/catch).
  async function createUser(payload) {
    setIsMutating(true)
    setError(null)
    try {
      const created = await userApi.createUser(payload)
      setUsers((prev) => [...prev, created])
      return { success: true, item: created }
    } catch (err) {
      setError(err.message)
      return { success: false, message: err.message, status: err.status }
    } finally {
      setIsMutating(false)
    }
  }

  async function updateUser(id, payload) {
    setIsMutating(true)
    setError(null)
    try {
      const updated = await userApi.updateUser(id, payload)
      setUsers((prev) => prev.map((user) => (user.id === Number(id) ? updated : user)))
      return { success: true, item: updated }
    } catch (err) {
      setError(err.message)
      return { success: false, message: err.message, status: err.status }
    } finally {
      setIsMutating(false)
    }
  }

  // Dùng cho validate trùng email trên UI (gợi ý UX) — backend vẫn là nguồn sự thật (409 nếu bỏ sót
  // race condition), giống isFieldTaken của createApiResourceContext/createResourceContext cũ.
  function isFieldTaken(field, value, ignoreId) {
    return users.some((user) => user[field] === value && user.id !== ignoreId)
  }

  // temporaryPassword chỉ trả về đúng 1 lần trong result — Page tự quyết định hiển thị thế nào
  // (Context không giữ lại nó trong state users[], chỉ cập nhật user.status/thông tin an toàn).
  async function resetPassword(id) {
    setIsMutating(true)
    setError(null)
    try {
      const { user, temporaryPassword } = await userApi.resetUserPassword(id)
      setUsers((prev) => prev.map((item) => (item.id === Number(id) ? user : item)))
      return { success: true, temporaryPassword }
    } catch (err) {
      setError(err.message)
      return { success: false, message: err.message, status: err.status }
    } finally {
      setIsMutating(false)
    }
  }

  async function setStatus(id, status) {
    setIsMutating(true)
    setError(null)
    try {
      const updated = await userApi.setUserStatus(id, status)
      setUsers((prev) => prev.map((item) => (item.id === Number(id) ? updated : item)))
      return { success: true, item: updated }
    } catch (err) {
      setError(err.message)
      return { success: false, message: err.message, status: err.status }
    } finally {
      setIsMutating(false)
    }
  }

  const value = {
    users,
    isLoading,
    isMutating,
    error,
    getById,
    createUser,
    updateUser,
    isFieldTaken,
    resetPassword,
    setStatus,
  }

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>
}

export function useUsers() {
  const context = useContext(UsersContext)
  if (!context) {
    throw new Error('useUsers phải được dùng bên trong UsersProvider')
  }
  return context
}
