import * as reportApi from '../api/reportApi'
import { triggerBlobDownload } from './downloadFile'

// Dùng chung bởi mọi trang hiển thị báo cáo (Student/Lecturer/Company/Admin) — gọi GET
// /reports/:id/download (requireAuth + scope giống getByIdForUser) rồi trigger tải về qua Blob,
// không lộ token trong URL (giống hệt cách export .xlsx đã làm ở Phase 5).
export async function downloadReportFile(reportId, fallbackName) {
  const { blob, filename } = await reportApi.downloadFile(reportId)
  triggerBlobDownload(blob, filename ?? fallbackName ?? 'bao-cao-thuc-tap')
}
