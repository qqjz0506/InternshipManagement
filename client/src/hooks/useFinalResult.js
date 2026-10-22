import { useEffect, useState } from 'react'
import * as internshipApi from '../api/internshipApi'

// Điểm tổng kết thực tập của 1 internship — fetch riêng (không qua Context collection nào) vì đây là
// giá trị TÍNH TOÁN phía server theo internshipId, không phải entity CRUD. data = null khi chưa đủ 2
// đánh giá công bố (data-availability gate — xem evaluationService.computeFinalResult), hoặc khi
// internshipId chưa có (chưa đăng ký/chưa chọn hồ sơ).
export function useFinalResult(internshipId) {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(internshipId))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!internshipId) {
      setData(null)
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)
    internshipApi
      .getFinalResult(internshipId)
      .then((result) => {
        if (!cancelled) {
          setData(result)
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
  }, [internshipId])

  return { finalResult: data, isLoading, error }
}
