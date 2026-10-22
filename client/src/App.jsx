import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { UsersProvider } from './context/UsersContext'
import { StudentsProvider } from './context/StudentsContext'
import { LecturersProvider } from './context/LecturersContext'
import { CompaniesProvider } from './context/CompaniesContext'
import { CompanyMentorsProvider } from './context/CompanyMentorsContext'
import { DepartmentsProvider } from './context/DepartmentsContext'
import { InternshipPeriodsProvider } from './context/InternshipPeriodsContext'
import { TopicsProvider } from './context/TopicsContext'
import { InternshipsProvider } from './context/InternshipsContext'
import { InternshipLogsProvider } from './context/InternshipLogsContext'
import { ReportsProvider } from './context/ReportsContext'
import { EvaluationsProvider } from './context/EvaluationsContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { SettingsProvider } from './context/SettingsContext'
import { ROLE_HOME_PATH } from './data/mockUsers'
import ProtectedRoute from './routes/ProtectedRoute'
import AppLayout from './layouts/AppLayout'
import AuthLayout from './layouts/AuthLayout'
import LoginPage from './pages/auth/LoginPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import UnauthorizedPage from './pages/auth/UnauthorizedPage'
import NotFoundPage from './pages/NotFoundPage'
import StudentsPage from './pages/admin/StudentsPage'
import LecturersPage from './pages/admin/LecturersPage'
import CompaniesPage from './pages/admin/CompaniesPage'
import CompanyMentorsPage from './pages/admin/CompanyMentorsPage'
import DepartmentsPage from './pages/admin/DepartmentsPage'
import InternshipPeriodsPage from './pages/admin/InternshipPeriodsPage'
import TopicsPage from './pages/admin/TopicsPage'
import InternshipsPage from './pages/admin/InternshipsPage'
import InternshipDetailPage from './pages/admin/InternshipDetailPage'
import AdminReportsPage from './pages/admin/AdminReportsPage'
import AdminReportDetailPage from './pages/admin/AdminReportDetailPage'
import AdminEvaluationsPage from './pages/admin/AdminEvaluationsPage'
import AdminEvaluationDetailPage from './pages/admin/AdminEvaluationDetailPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminStatisticsPage from './pages/admin/AdminStatisticsPage'
import AdminAccountsPage from './pages/admin/AdminAccountsPage'
import AdminSettingsPage from './pages/admin/AdminSettingsPage'
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage'
import StudentDashboardPage from './pages/student/StudentDashboardPage'
import StudentProfilePage from './pages/student/StudentProfilePage'
import StudentInternshipPage from './pages/student/StudentInternshipPage'
import StudentProgressPage from './pages/student/StudentProgressPage'
import StudentLogsPage from './pages/student/StudentLogsPage'
import StudentReportsPage from './pages/student/StudentReportsPage'
import StudentEvaluationsPage from './pages/student/StudentEvaluationsPage'
import StudentNotificationsPage from './pages/student/StudentNotificationsPage'
import LecturerDashboardPage from './pages/lecturer/LecturerDashboardPage'
import LecturerStudentsPage from './pages/lecturer/LecturerStudentsPage'
import LecturerStudentDetailPage from './pages/lecturer/LecturerStudentDetailPage'
import LecturerProgressPage from './pages/lecturer/LecturerProgressPage'
import LecturerLogsPage from './pages/lecturer/LecturerLogsPage'
import LecturerReportsPage from './pages/lecturer/LecturerReportsPage'
import LecturerEvaluationsPage from './pages/lecturer/LecturerEvaluationsPage'
import LecturerNotificationsPage from './pages/lecturer/LecturerNotificationsPage'
import LecturerProfilePage from './pages/lecturer/LecturerProfilePage'
import CompanyDashboardPage from './pages/company/CompanyDashboardPage'
import CompanyStudentsPage from './pages/company/CompanyStudentsPage'
import CompanyStudentDetailPage from './pages/company/CompanyStudentDetailPage'
import CompanyProgressPage from './pages/company/CompanyProgressPage'
import CompanyLogsPage from './pages/company/CompanyLogsPage'
import CompanyReportsPage from './pages/company/CompanyReportsPage'
import CompanyEvaluationsPage from './pages/company/CompanyEvaluationsPage'
import CompanyNotificationsPage from './pages/company/CompanyNotificationsPage'
import CompanyProfilePage from './pages/company/CompanyProfilePage'
import ChangePasswordPage from './pages/ChangePasswordPage'

// "/" tự động chuyển đến dashboard theo role, hoặc /login nếu chưa đăng nhập
function RootRedirect() {
  const { currentUser, isInitializing } = useAuth()

  if (isInitializing) {
    return null
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={ROLE_HOME_PATH[currentUser.role]} replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/students" element={<StudentsPage />} />
          <Route path="/admin/lecturers" element={<LecturersPage />} />
          <Route path="/admin/companies" element={<CompaniesPage />} />
          <Route path="/admin/company-mentors" element={<CompanyMentorsPage />} />
          <Route path="/admin/departments" element={<DepartmentsPage />} />
          <Route path="/admin/internship-periods" element={<InternshipPeriodsPage />} />
          <Route path="/admin/topics" element={<TopicsPage />} />
          <Route path="/admin/internships" element={<InternshipsPage />} />
          <Route path="/admin/internships/:id" element={<InternshipDetailPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
          <Route path="/admin/reports/:id" element={<AdminReportDetailPage />} />
          <Route path="/admin/evaluations" element={<AdminEvaluationsPage />} />
          <Route path="/admin/evaluations/:id" element={<AdminEvaluationDetailPage />} />
          <Route path="/admin/statistics" element={<AdminStatisticsPage />} />
          <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
          <Route path="/admin/accounts" element={<AdminAccountsPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['student']} />}>
        <Route element={<AppLayout />}>
          <Route path="/student/dashboard" element={<StudentDashboardPage />} />
          <Route path="/student/profile" element={<StudentProfilePage />} />
          <Route path="/student/internship" element={<StudentInternshipPage />} />
          <Route path="/student/progress" element={<StudentProgressPage />} />
          <Route path="/student/logs" element={<StudentLogsPage />} />
          <Route path="/student/reports" element={<StudentReportsPage />} />
          <Route path="/student/evaluations" element={<StudentEvaluationsPage />} />
          <Route path="/student/notifications" element={<StudentNotificationsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['lecturer']} />}>
        <Route element={<AppLayout />}>
          <Route path="/lecturer/dashboard" element={<LecturerDashboardPage />} />
          <Route path="/lecturer/students" element={<LecturerStudentsPage />} />
          <Route path="/lecturer/students/:id" element={<LecturerStudentDetailPage />} />
          <Route path="/lecturer/progress" element={<LecturerProgressPage />} />
          <Route path="/lecturer/logs" element={<LecturerLogsPage />} />
          <Route path="/lecturer/reports" element={<LecturerReportsPage />} />
          <Route path="/lecturer/evaluations" element={<LecturerEvaluationsPage />} />
          <Route path="/lecturer/notifications" element={<LecturerNotificationsPage />} />
          <Route path="/lecturer/profile" element={<LecturerProfilePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['company_mentor']} />}>
        <Route element={<AppLayout />}>
          <Route path="/company/dashboard" element={<CompanyDashboardPage />} />
          <Route path="/company/students" element={<CompanyStudentsPage />} />
          <Route path="/company/students/:id" element={<CompanyStudentDetailPage />} />
          <Route path="/company/progress" element={<CompanyProgressPage />} />
          <Route path="/company/logs" element={<CompanyLogsPage />} />
          <Route path="/company/reports" element={<CompanyReportsPage />} />
          <Route path="/company/evaluations" element={<CompanyEvaluationsPage />} />
          <Route path="/company/notifications" element={<CompanyNotificationsPage />} />
          <Route path="/company/profile" element={<CompanyProfilePage />} />
        </Route>
      </Route>

      {/* Dùng chung cho cả 4 role — hành động đổi mật khẩu không gắn riêng 1 role/menu nào, truy cập
          qua Topbar (xem Topbar.jsx), không lặp lại route này 4 lần trong 4 block role ở trên. */}
      <Route element={<ProtectedRoute allowedRoles={['admin', 'student', 'lecturer', 'company_mentor']} />}>
        <Route element={<AppLayout />}>
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

// AuthProvider PHẢI là provider ngoài cùng (Phase 6A): mọi Context dữ liệu bên trong giờ tự quyết
// định có fetch hay không dựa trên currentUser/role (useAuth()), nên currentUser phải sẵn sàng để
// đọc được TỪ MỌI provider con — UsersProvider trước đây nằm ngoài AuthProvider nên không thể tự
// biết currentUser, phải gọi /api/users vô điều kiện dù role không phải admin (gây 403 cho 3/4 role
// ở mọi lần tải trang). Mount ở gốc app (không riêng route) vì mọi vai trò đều cần đọc/ghi cùng 1
// nguồn dữ liệu — không tạo state riêng theo route.
function AppProviders({ children }) {
  return (
    <AuthProvider>
      <UsersProvider>
        <StudentsProvider>
          <LecturersProvider>
            <CompaniesProvider>
              <CompanyMentorsProvider>
                <DepartmentsProvider>
                  <InternshipPeriodsProvider>
                    <TopicsProvider>
                      <InternshipsProvider>
                        <InternshipLogsProvider>
                          <ReportsProvider>
                            <EvaluationsProvider>
                              <NotificationsProvider>
                              <SettingsProvider>{children}</SettingsProvider>
                            </NotificationsProvider>
                            </EvaluationsProvider>
                          </ReportsProvider>
                        </InternshipLogsProvider>
                      </InternshipsProvider>
                    </TopicsProvider>
                  </InternshipPeriodsProvider>
                </DepartmentsProvider>
              </CompanyMentorsProvider>
            </CompaniesProvider>
          </LecturersProvider>
        </StudentsProvider>
      </UsersProvider>
    </AuthProvider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  )
}

export default App
