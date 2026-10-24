import * as internshipApi from '../api/internshipApi'
import { triggerBlobDownload } from './downloadFile'

// Dùng chung bởi StudentInternshipPage/InternshipDetailPage (admin)/LecturerStudentDetailPage (Mục
// 16L README) — gọi GET /internships/:id/documents/*.pdf (requireAuth + scope giống
// getByIdForUser) rồi trigger tải về qua Blob, không lộ token trong URL (giống hệt cách export
// .xlsx/tải báo cáo đã làm ở các phase trước).
export async function downloadIntroductionLetter(internshipId, studentCode) {
  const { blob, filename } = await internshipApi.getIntroductionLetter(internshipId)
  triggerBlobDownload(blob, filename ?? `giay-gioi-thieu-${studentCode ?? internshipId}.pdf`)
}

export async function downloadResultSheet(internshipId, studentCode) {
  const { blob, filename } = await internshipApi.getResultSheet(internshipId)
  triggerBlobDownload(blob, filename ?? `phieu-ket-qua-${studentCode ?? internshipId}.pdf`)
}
