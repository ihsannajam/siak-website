import { lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { Card, Link } from '@heroui/react'
import { PageHeader } from './components/ui'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { getModuleConfig } from './config/modules'
import { API_BASE_URL } from './lib/api'

// Tiap halaman diunduh saat dibuka, supaya unduhan awal aplikasi tetap kecil.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const StudentsPage = lazy(() => import('./pages/StudentsPage').then((m) => ({ default: m.StudentsPage })))
const StudentFormPage = lazy(() => import('./pages/StudentFormPage').then((m) => ({ default: m.StudentFormPage })))
const PpdbPage = lazy(() => import('./pages/PpdbPage').then((m) => ({ default: m.PpdbPage })))
const SchedulesPage = lazy(() => import('./pages/SchedulesPage').then((m) => ({ default: m.SchedulesPage })))
const UsersPage = lazy(() => import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })))
const RolesPage = lazy(() => import('./pages/RolesPage').then((m) => ({ default: m.RolesPage })))
const PermissionsPage = lazy(() => import('./pages/PermissionsPage').then((m) => ({ default: m.PermissionsPage })))
const ReportCardsPage = lazy(() => import('./pages/ReportCardsPage').then((m) => ({ default: m.ReportCardsPage })))
const PaymentsPage = lazy(() => import('./pages/PaymentsPage').then((m) => ({ default: m.PaymentsPage })))
const LeaveRequestsPage = lazy(() => import('./pages/LeaveRequestsPage').then((m) => ({ default: m.LeaveRequestsPage })))
const StudentDocumentsPage = lazy(() => import('./pages/StudentDocumentsPage').then((m) => ({ default: m.StudentDocumentsPage })))
const SchoolProfilePage = lazy(() => import('./pages/SchoolProfilePage').then((m) => ({ default: m.SchoolProfilePage })))
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then((m) => ({ default: m.EmployeesPage })))
const EmployeeFormPage = lazy(() => import('./pages/EmployeeFormPage').then((m) => ({ default: m.EmployeeFormPage })))
const CrudPage = lazy(() => import('./pages/CrudPage').then((m) => ({ default: m.CrudPage })))

// URL Swagger backend: ganti '/api' di akhir base URL menjadi '/api-docs'.
const apiDocsUrl = API_BASE_URL.replace(/\/api\/?$/, '') + '/api-docs'

/** Resolves a generic CRUD page from the URL module key. */
function ModulePage() {
  const { moduleKey } = useParams()
  const config = moduleKey ? getModuleConfig(moduleKey) : undefined

  if (!config) {
    return (
      <div>
        <PageHeader title={moduleKey} />
        <Card>
          <Card.Content className="gap-2">
            <p>
              Modul <strong>{moduleKey}</strong> tersedia melalui REST API dan dapat diuji di{' '}
              <Link href={apiDocsUrl} target="_blank" rel="noreferrer">
                Swagger (/api-docs)
              </Link>
              .
            </p>
            <p className="text-muted">
              Tambahkan entri di <code>src/config/modules.ts</code> untuk menampilkan halaman CRUD-nya secara otomatis.
            </p>
          </Card.Content>
        </Card>
      </div>
    )
  }
  // Key wajib: tiap modul punya kolom sendiri, dan tabel tidak bisa mengganti kolom di tempat.
  return <CrudPage key={config.key} config={config} />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/students/new" element={<StudentFormPage />} />
              <Route path="/students/:id" element={<StudentFormPage />} />
              <Route path="/school-profile" element={<SchoolProfilePage />} />
              <Route path="/employees" element={<EmployeesPage />} />
              <Route path="/employees/new" element={<EmployeeFormPage />} />
              <Route path="/employees/:id" element={<EmployeeFormPage />} />
              <Route path="/student-documents" element={<StudentDocumentsPage />} />
              <Route path="/ppdb" element={<PpdbPage />} />
              <Route path="/schedules" element={<SchedulesPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/permissions" element={<PermissionsPage />} />
              <Route path="/report-cards" element={<ReportCardsPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/leave-requests" element={<LeaveRequestsPage />} />
              <Route path="/:moduleKey" element={<ModulePage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
