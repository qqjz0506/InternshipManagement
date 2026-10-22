import { useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { triggerBlobDownload } from '../../utils/downloadFile'
import { downloadAccountsFile } from '../../api/importApi'
import './ImportModal.css'

// Modal dùng chung cho nhập Excel Sinh viên/Giảng viên (Admin) — xem docs/REQUIREMENT_TRACEABILITY_MATRIX.md
// REQ-081/082. Luồng 2 bước preview/commit đúng với backend (server/controllers/importController.js):
// preview KHÔNG ghi gì vào DB, commit re-validate từ đầu rồi mới ghi — modal chỉ hiển thị kết quả, không
// tự validate lại ở client (tránh lặp/lệch rule với server).
//
// Props:
//   entityLabel: "sinh viên" | "giảng viên" (hiển thị trong text)
//   getTemplate: () => Promise<{ blob, filename }>
//   preview: (file) => Promise<{ totalRows, validRows, invalidRows }>
//   commit: (file, createAccounts) => Promise<{ committed, insertedCount?, invalidRows?, accountsFileToken? }>
//   onImported: () => void  — gọi sau khi commit thành công (Page dùng để refresh() Context)
function ImportModal({ isOpen, onClose, entityLabel, getTemplate, preview, commit, onImported }) {
  const [file, setFile] = useState(null)
  const [previewResult, setPreviewResult] = useState(null)
  const [createAccounts, setCreateAccounts] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [commitResult, setCommitResult] = useState(null)

  function resetState() {
    setFile(null)
    setPreviewResult(null)
    setCreateAccounts(false)
    setErrorMessage('')
    setCommitResult(null)
  }

  function handleClose() {
    resetState()
    onClose()
  }

  async function handleDownloadTemplate() {
    try {
      const { blob, filename } = await getTemplate()
      triggerBlobDownload(blob, filename ?? `mau-nhap-${entityLabel}.xlsx`)
    } catch (err) {
      setErrorMessage(err.message)
    }
  }

  function handleFileChange(event) {
    setFile(event.target.files?.[0] ?? null)
    setPreviewResult(null)
    setCommitResult(null)
    setErrorMessage('')
  }

  async function handlePreview() {
    if (!file) {
      return
    }
    setErrorMessage('')
    setCommitResult(null)
    setIsPreviewing(true)
    try {
      const result = await preview(file)
      setPreviewResult(result)
    } catch (err) {
      setErrorMessage(err.message)
      setPreviewResult(null)
    } finally {
      setIsPreviewing(false)
    }
  }

  async function handleCommit() {
    if (!file) {
      return
    }
    setErrorMessage('')
    setIsCommitting(true)
    try {
      const result = await commit(file, createAccounts)
      if (!result.committed) {
        // Commit tự re-validate, có thể phát sinh lỗi MỚI so với lúc preview (vd. Admin khác vừa
        // nhập trùng mã) — hiển thị lại đúng danh sách lỗi mới nhất, không tin preview cũ nữa.
        setPreviewResult(result)
        setErrorMessage('File còn dòng dữ liệu không hợp lệ, chưa ghi vào hệ thống. Vui lòng xem lại bảng dưới đây.')
        return
      }
      setCommitResult(result)
      onImported?.()
    } catch (err) {
      setErrorMessage(err.message)
    } finally {
      setIsCommitting(false)
    }
  }

  async function handleDownloadAccounts() {
    try {
      const { blob, filename } = await downloadAccountsFile(commitResult.accountsFileToken)
      triggerBlobDownload(blob, filename ?? 'tai-khoan-tao-moi.xlsx')
    } catch (err) {
      setErrorMessage(err.message)
    }
  }

  const rows = previewResult
    ? [
        ...previewResult.validRows.map((row) => ({ row: row.row, ok: true })),
        ...previewResult.invalidRows.map((entry) => ({ row: entry.row, ok: false, errors: entry.errors })),
      ].sort((a, b) => a.row - b.row)
    : []
  const hasErrors = previewResult ? previewResult.invalidRows.length > 0 : false
  const canConfirm = previewResult && !hasErrors && previewResult.validRows.length > 0 && !commitResult

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Nhập ${entityLabel} từ Excel`}>
      <div className="import-modal">
        <div className="import-modal-step">
          <Button variant="secondary" onClick={handleDownloadTemplate}>
            Tải file mẫu
          </Button>
          <span className="import-modal-hint">Điền dữ liệu vào file mẫu, giữ đúng thứ tự cột, rồi chọn file bên dưới.</span>
        </div>

        <div className="import-modal-step">
          <input type="file" accept=".xlsx" onChange={handleFileChange} disabled={isCommitting} />
          <Button onClick={handlePreview} disabled={!file || isPreviewing || isCommitting}>
            {isPreviewing ? 'Đang xem trước...' : 'Xem trước'}
          </Button>
        </div>

        {errorMessage && <p className="form-field-error">{errorMessage}</p>}

        {previewResult && !commitResult && (
          <>
            <p>
              Tổng {previewResult.totalRows} dòng — hợp lệ {previewResult.validRows.length}, lỗi {previewResult.invalidRows.length}.
            </p>
            <div className="import-preview-table-wrap">
              <table className="import-preview-table">
                <thead>
                  <tr>
                    <th>Dòng</th>
                    <th>Trạng thái</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.row} className={item.ok ? 'import-row-valid' : 'import-row-error'}>
                      <td>{item.row}</td>
                      <td>{item.ok ? 'Hợp lệ' : 'Lỗi'}</td>
                      <td>
                        {item.ok ? '—' : item.errors.map((err) => `${err.column}: ${err.message}`).join('; ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="import-modal-checkbox">
              <input
                type="checkbox"
                checked={createAccounts}
                onChange={(event) => setCreateAccounts(event.target.checked)}
                disabled={hasErrors}
              />
              Tạo luôn tài khoản đăng nhập (mật khẩu tạm, bắt đổi khi đăng nhập lần đầu)
            </label>
          </>
        )}

        {commitResult && (
          <div className="import-modal-success">
            <p>Đã nhập thành công {commitResult.insertedCount} dòng.</p>
            {commitResult.accountsFileToken && (
              <Button variant="secondary" onClick={handleDownloadAccounts}>
                Tải file tài khoản (email + mật khẩu tạm)
              </Button>
            )}
          </div>
        )}

        <div className="modal-footer">
          <Button variant="secondary" onClick={handleClose}>
            {commitResult ? 'Đóng' : 'Hủy'}
          </Button>
          {!commitResult && (
            <Button onClick={handleCommit} disabled={!canConfirm || isCommitting}>
              {isCommitting ? 'Đang nhập...' : 'Xác nhận nhập'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default ImportModal
