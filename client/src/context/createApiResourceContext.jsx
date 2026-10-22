import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

// Factory dùng chung cho các entity đã migrate sang REST API (Phase 4B+), tương tự tinh thần
// createResourceContext.jsx (mock) nhưng state luôn server-confirmed: không optimistic update,
// không fallback sang mock khi API lỗi (mục 22). `api` phải có { getAll, create, update, remove }.
//
// Phase 6A: fetch giờ auth-aware (chỉ gọi API khi đã biết currentUser, tránh gọi lúc chưa đăng nhập/
// chưa khôi phục session xong) và role-aware qua `shouldLoad(currentUser)` — mặc định "bất kỳ ai đã
// đăng nhập" (đúng cho hầu hết entity, vì mọi role đều cần đọc dữ liệu này ở phạm vi scoped riêng của
// mình). Chỉ entity nào THỰC SỰ không cần cho 1 role nào đó (ví dụ Notifications không dùng ở Admin)
// mới truyền `shouldLoad` riêng — không thêm if/else role ở đây cho từng entity.
// extraActions (tùy chọn): các hành động CRUD generic (addItem/updateItem/deleteItem) không đủ cho
// 1-2 entity có hành động riêng (vd. Notifications cần "đánh dấu tất cả đã đọc" — 1 API bulk, không
// map được vào update(id, payload) vì không có đúng 1 id). Mỗi entry nhận ({api, setItems, items}, ...args)
// và tự quyết định gọi API nào — Context tự wrap isMutating/error/try-catch giống addItem/updateItem.
// pollIntervalMs (tùy chọn): tự fetch lại định kỳ TRONG LÚC tab đang mở (không polling khi tab ẩn) —
// CHỈ dùng cho entity cần cập nhật gần-thời-gian-thực (vd. Notifications badge), KHÔNG set cho 10
// entity còn lại (giữ nguyên hành vi cũ, mặc định undefined = không polling).
export function createApiResourceContext(api, name, { shouldLoad = Boolean, extraActions = {}, pollIntervalMs } = {}) {
  const Context = createContext(null)

  function Provider({ children }) {
    const { currentUser } = useAuth()
    const [items, setItems] = useState([])
    // Initial loading: danh sách chưa load lần nào. Mutation loading (isMutating): create/update/
    // delete đang chạy — tách riêng để UI không tưởng nhầm 2 trạng thái (mục 13).
    const [isLoading, setIsLoading] = useState(true)
    const [isMutating, setIsMutating] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
      // Chưa đăng nhập, đang khôi phục session, hoặc role hiện tại không cần entity này — không gọi
      // API, và dọn sạch state cũ (mục 4/10 Phase 6A: không giữ data của identity trước, không báo
      // lỗi giả cho trường hợp "không áp dụng").
      if (!shouldLoad(currentUser)) {
        setItems([])
        setIsLoading(false)
        setError(null)
        return
      }

      let cancelled = false
      setIsLoading(true)
      api
        .getAll()
        .then((data) => {
          if (!cancelled) setItems(data)
        })
        .catch((err) => {
          if (!cancelled) setError(err.message)
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })

      // Polling nền: KHÔNG động vào isLoading/error (tránh UI flicker "Đang tải dữ liệu..." mỗi lần
      // poll) — lỗi lúc poll chỉ bỏ qua êm, lần fetch kế tiếp tự thử lại. Bỏ qua khi tab đang ẩn
      // (document.hidden) để không tốn request vô ích.
      let intervalId
      if (pollIntervalMs) {
        intervalId = setInterval(() => {
          if (cancelled || document.hidden) return
          api.getAll().then((data) => {
            if (!cancelled) setItems(data)
          }).catch(() => {})
        }, pollIntervalMs)
      }

      return () => {
        cancelled = true
        if (intervalId) clearInterval(intervalId)
      }
      // currentUser?.id/role (không phải cả object) — đổi identity hoặc đổi role phải trigger lại
      // đúng 1 lần, không phụ thuộc vào reference equality của object currentUser.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id, currentUser?.role])

    function getById(id) {
      return items.find((item) => item.id === Number(id))
    }

    // addItem/updateItem/deleteItem không throw — trả { success, message?, item? } giống convention
    // AuthContext.login() để Page không cần try/catch, chỉ kiểm tra .success (mục 12, 14, 15).
    async function addItem(payload) {
      setIsMutating(true)
      setError(null)
      try {
        const created = await api.create(payload)
        setItems((prev) => [...prev, created])
        return { success: true, item: created }
      } catch (err) {
        setError(err.message)
        return { success: false, message: err.message, status: err.status }
      } finally {
        setIsMutating(false)
      }
    }

    async function updateItem(id, payload) {
      setIsMutating(true)
      setError(null)
      try {
        const updated = await api.update(id, payload)
        setItems((prev) => prev.map((item) => (item.id === Number(id) ? updated : item)))
        return { success: true, item: updated }
      } catch (err) {
        setError(err.message)
        return { success: false, message: err.message, status: err.status }
      } finally {
        setIsMutating(false)
      }
    }

    // Lỗi (vd. 409 FK restriction) không xoá item khỏi state — không optimistic delete (mục 19).
    async function deleteItem(id) {
      setIsMutating(true)
      setError(null)
      try {
        await api.remove(id)
        setItems((prev) => prev.filter((item) => item.id !== Number(id)))
        return { success: true }
      } catch (err) {
        setError(err.message)
        return { success: false, message: err.message, status: err.status }
      } finally {
        setIsMutating(false)
      }
    }

    // Kiểm tra trùng giá trị trên state đã load từ API — vẫn chỉ là gợi ý UX, backend vẫn là
    // nguồn sự thật cho uniqueness (409 nếu client check bỏ sót, vd. race condition).
    function isFieldTaken(field, value, ignoreId) {
      return items.some((item) => item[field] === value && item.id !== ignoreId)
    }

    const extraActionHandlers = {}
    Object.entries(extraActions).forEach(([actionName, handler]) => {
      extraActionHandlers[actionName] = async (...args) => {
        setIsMutating(true)
        setError(null)
        try {
          await handler({ api, setItems, items }, ...args)
          return { success: true }
        } catch (err) {
          setError(err.message)
          return { success: false, message: err.message, status: err.status }
        } finally {
          setIsMutating(false)
        }
      }
    })

    const value = {
      items,
      isLoading,
      isMutating,
      error,
      getById,
      addItem,
      updateItem,
      deleteItem,
      isFieldTaken,
      ...extraActionHandlers,
    }

    return <Context.Provider value={value}>{children}</Context.Provider>
  }

  function useResource() {
    const context = useContext(Context)
    if (!context) {
      throw new Error(`use${name} phải được dùng bên trong ${name}Provider`)
    }
    return context
  }

  return { Provider, useResource }
}
