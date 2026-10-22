import { useEffect, useState } from 'react'
import * as reminderApi from '../api/reminderApi'

// Tổng hợp "Việc cần làm" (Mục 16J README) — fetch riêng (không qua Context collection nào) vì đây
// là giá trị TÍNH TOÁN phía server theo currentUser đang đăng nhập, giống hệt tinh thần
// useFinalResult.js. data = null lúc đang tải/lỗi; shape khác nhau theo role, xem reminderApi.js.
export function useRemindersOverview() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    reminderApi
      .getOverview()
      .then((result) => {
        if (!cancelled) setData(result)
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
  }, [])

  return { overview: data, isLoading, error }
}
