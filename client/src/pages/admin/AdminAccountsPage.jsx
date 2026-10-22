import { useState } from 'react'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import StatCard from '../../components/common/StatCard'
import AccountFormModal from '../../components/accounts/AccountFormModal'
import AccountDetailModal from '../../components/accounts/AccountDetailModal'
import { useDebounce } from '../../hooks/useDebounce'
import { useUsers } from '../../context/UsersContext'
import { useAuth } from '../../context/AuthContext'
import { useStudents } from '../../context/StudentsContext'
import { useLecturers } from '../../context/LecturersContext'
import { useCompanyMentors } from '../../context/CompanyMentorsContext'
import { useCompanies } from '../../context/CompaniesContext'
import { useDepartments } from '../../context/DepartmentsContext'
import { ROLE_LABELS } from '../../data/mockUsers'
import '../../components/common/ListPage.css'

const ROLE_BADGE_TONE = {
  admin: 'danger',
  student: 'info',
  lecturer: 'success',
  company_mentor: 'warning',
}

function AdminAccountsPage() {
  const { users, isLoading, isMutating, error, createUser, updateUser, setStatus, isFieldTaken } = useUsers()
  const { currentUser } = useAuth()
  const { items: students } = useStudents()
  const { items: lecturers } = useLecturers()
  const { items: mentors } = useCompanyMentors()
  const { items: companies } = useCompanies()
  const { items: departments } = useDepartments()

  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [roleFilter, setRoleFilter] = useState('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [viewingAccount, setViewingAccount] = useState(null)
  const [submitError, setSubmitError] = useState('')

  function getLinkedInfo(user) {
    if (user.role === 'student') {
      const student = students.find((item) => item.user_id === user.id)
      return {
        label: student ? `MSSV ${student.student_code} - ${student.full_name}` : 'Chưa liên kết hồ sơ sinh viên',
        searchExtra: student?.student_code ?? '',
        extraFields: student
          ? [
              { label: 'MSSV', value: student.student_code },
              { label: 'Lớp', value: student.class },
              {
                label: 'Khoa',
                value: departments.find((department) => department.id === student.department_id)?.department_name ?? '—',
              },
            ]
          : [],
      }
    }

    if (user.role === 'lecturer') {
      const lecturer = lecturers.find((item) => item.user_id === user.id)
      return {
        label: lecturer ? `GV ${lecturer.lecturer_code} - ${lecturer.full_name}` : 'Chưa liên kết hồ sơ giảng viên',
        searchExtra: lecturer?.lecturer_code ?? '',
        extraFields: lecturer
          ? [
              { label: 'Mã giảng viên', value: lecturer.lecturer_code },
              {
                label: 'Khoa',
                value: departments.find((department) => department.id === lecturer.department_id)?.department_name ?? '—',
              },
              { label: 'Học hàm / học vị', value: lecturer.position },
            ]
          : [],
      }
    }

    if (user.role === 'company_mentor') {
      const mentor = mentors.find((item) => item.user_id === user.id)
      const company = mentor ? companies.find((item) => item.id === mentor.company_id) : null
      return {
        label: mentor ? `${mentor.full_name} - ${company?.company_name ?? 'Chưa rõ doanh nghiệp'}` : 'Chưa liên kết hồ sơ người hướng dẫn',
        searchExtra: mentor?.full_name ?? '',
        extraFields: mentor
          ? [
              { label: 'Chức vụ', value: mentor.position },
              { label: 'Doanh nghiệp', value: company?.company_name ?? '—' },
            ]
          : [],
      }
    }

    return { label: 'Tài khoản quản trị hệ thống', searchExtra: '', extraFields: [] }
  }

  const rows = users.map((user) => {
    const linked = getLinkedInfo(user)
    return { id: user.id, user, roleLabel: ROLE_LABELS[user.role] ?? user.role, ...linked }
  })

  const filteredRows = rows.filter((row) => {
    const keyword = debouncedSearch.trim().toLowerCase()
    const matchesKeyword =
      keyword === '' ||
      row.user.email.toLowerCase().includes(keyword) ||
      row.user.fullName.toLowerCase().includes(keyword) ||
      row.searchExtra.toLowerCase().includes(keyword)
    const matchesRole = roleFilter === 'all' || row.user.role === roleFilter
    return matchesKeyword && matchesRole
  })

  const unlinkedByRole = {
    admin: [],
    student: students
      .filter((student) => !student.user_id)
      .map((student) => ({ id: student.id, label: `${student.student_code} - ${student.full_name}` })),
    lecturer: lecturers
      .filter((lecturer) => !lecturer.user_id)
      .map((lecturer) => ({ id: lecturer.id, label: `${lecturer.lecturer_code} - ${lecturer.full_name}` })),
    company_mentor: mentors
      .filter((mentor) => !mentor.user_id)
      .map((mentor) => ({
        id: mentor.id,
        label: `${mentor.full_name} - ${companies.find((company) => company.id === mentor.company_id)?.company_name ?? ''}`,
      })),
  }

  function openCreateModal() {
    setEditingAccount(null)
    setSubmitError('')
    setIsFormOpen(true)
  }

  function openEditModal(user) {
    setEditingAccount(user)
    setSubmitError('')
    setIsFormOpen(true)
  }

  function closeFormModal() {
    setIsFormOpen(false)
    setEditingAccount(null)
    setSubmitError('')
  }

  // Create/link profile là 1 lệnh gọi DUY NHẤT (POST /api/users) — backend đảm bảo atomic trong 1
  // transaction (Phase 4F-1 mục 6/10). KHÔNG tự tách thành "tạo user" + "PUT profile" 2 bước như
  // luồng mock cũ (mục 12 Phase 4F-2) — tránh dữ liệu dở dang nếu bước thứ 2 lỡ thất bại.
  async function handleSubmit(formValues) {
    if (isMutating) {
      return
    }
    setSubmitError('')
    const result = editingAccount
      ? await updateUser(editingAccount.id, formValues)
      : await createUser(formValues)

    if (result.success) {
      closeFormModal()
    } else {
      setSubmitError(result.message)
    }
  }

  const roleCounts = Object.keys(ROLE_LABELS).reduce((acc, role) => {
    acc[role] = users.filter((user) => user.role === role).length
    return acc
  }, {})

  // setStatus() trả { success:false, message } cho các case bị chặn (tự khóa chính mình, khóa admin
  // cuối cùng...) — hiển thị ngay bằng alert vì đây là hành động đơn lẻ, không có form riêng để gắn lỗi.
  async function handleToggleStatus(user) {
    const nextStatus = user.status === 'locked' ? 'active' : 'locked'
    const actionLabel = nextStatus === 'locked' ? 'khóa' : 'mở khóa'
    const confirmed = window.confirm(`Xác nhận ${actionLabel} tài khoản "${user.email}"?`)
    if (!confirmed) {
      return
    }
    const result = await setStatus(user.id, nextStatus)
    if (!result.success) {
      window.alert(result.message)
    }
  }

  const columns = [
    { key: 'email', label: 'Email', render: (row) => row.user.email },
    { key: 'fullName', label: 'Họ tên', render: (row) => row.user.fullName },
    {
      key: 'role',
      label: 'Vai trò',
      render: (row) => <Badge tone={ROLE_BADGE_TONE[row.user.role] ?? 'neutral'}>{row.roleLabel}</Badge>,
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => <Badge tone={row.user.status === 'locked' ? 'danger' : 'success'}>{row.user.status === 'locked' ? 'Đã khóa' : 'Hoạt động'}</Badge>,
    },
    { key: 'linked', label: 'Đối tượng liên kết', render: (row) => row.label },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="row-actions">
          <Button variant="secondary" className="btn-sm" onClick={() => setViewingAccount(row)}>
            Xem chi tiết
          </Button>
          <Button variant="secondary" className="btn-sm" onClick={() => openEditModal(row.user)}>
            Sửa
          </Button>
          {row.user.id !== currentUser?.id && (
            <Button variant="secondary" className="btn-sm" onClick={() => handleToggleStatus(row.user)} disabled={isMutating}>
              {row.user.status === 'locked' ? 'Mở khóa' : 'Khóa'}
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Tài khoản</h2>
        <Button onClick={openCreateModal}>+ Tạo tài khoản</Button>
      </div>
      <p className="form-hint">Toàn bộ tài khoản đăng nhập của hệ thống.</p>

      <div className="stat-grid">
        <StatCard label="Tổng tài khoản" value={users.length} />
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <StatCard key={role} label={label} value={roleCounts[role]} />
        ))}
      </div>

      <div className="page-filters">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Tìm theo email, họ tên, mã sinh viên/giảng viên..."
        />

        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
          <option value="all">Tất cả vai trò</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <DataTable columns={columns} data={filteredRows} rowKey="id" emptyMessage="Chưa có tài khoản nào." />
      )}

      <AccountFormModal
        isOpen={isFormOpen}
        onClose={closeFormModal}
        onSubmit={handleSubmit}
        initialData={editingAccount}
        isEmailTaken={(email, ignoreId) => isFieldTaken('email', email, ignoreId)}
        unlinkedByRole={unlinkedByRole}
        submitError={submitError}
        isSubmitting={isMutating}
      />

      <AccountDetailModal isOpen={Boolean(viewingAccount)} onClose={() => setViewingAccount(null)} account={viewingAccount} />
    </div>
  )
}

export default AdminAccountsPage
