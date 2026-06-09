import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

/** Guards routes: requires authentication, optionally a specific permission. */
export function ProtectedRoute({ permission }: { permission?: string }) {
  const { user, loading, hasPermission } = useAuth()

  if (loading) {
    return <div className="page-loader">Memuat…</div>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (permission && !hasPermission(permission)) {
    return (
      <div className="forbidden">
        <h2>403 — Akses Ditolak</h2>
        <p>Anda tidak memiliki izin untuk membuka halaman ini.</p>
      </div>
    )
  }
  return <Outlet />
}
