import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { StudentsPage } from './pages/StudentsPage'
import { PpdbPage } from './pages/PpdbPage'
import { SchedulesPage } from './pages/SchedulesPage'
import { CrudPage } from './pages/CrudPage'
import { getModuleConfig } from './config/modules'

/** Resolves a generic CRUD page from the URL module key. */
function ModulePage() {
  const { moduleKey } = useParams()
  const config = moduleKey ? getModuleConfig(moduleKey) : undefined

  if (!config) {
    return (
      <div>
        <div className="page-header">
          <h1>{moduleKey}</h1>
        </div>
        <div className="card">
          <div className="card-body">
            <p>
              Modul <strong>{moduleKey}</strong> tersedia melalui REST API dan dapat diuji di{' '}
              <a href="http://localhost:5000/api-docs" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                Swagger (/api-docs)
              </a>
              .
            </p>
            <p style={{ color: 'var(--muted)' }}>
              Tambahkan entri di <code>src/config/modules.ts</code> untuk menampilkan halaman CRUD-nya secara otomatis.
            </p>
          </div>
        </div>
      </div>
    )
  }
  return <CrudPage config={config} />
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
              <Route path="/ppdb" element={<PpdbPage />} />
              <Route path="/schedules" element={<SchedulesPage />} />
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
