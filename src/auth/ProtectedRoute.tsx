import { Navigate, Outlet } from 'react-router-dom'
import { Alert } from '@heroui/react'
import { Loader } from '../components/ui'
import { useAuth } from './AuthContext'

/** Guards routes: requires authentication, optionally a specific permission. */
export function ProtectedRoute({ permission }: { permission?: string }) {
  const { user, loading, hasPermission } = useAuth()

  if (loading) {
    return <Loader />
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (permission && !hasPermission(permission)) {
    return (
      <div className="mx-auto max-w-lg p-10">
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>403 — Akses Ditolak</Alert.Title>
            <Alert.Description>Anda tidak memiliki izin untuk membuka halaman ini.</Alert.Description>
          </Alert.Content>
        </Alert>
      </div>
    )
  }
  return <Outlet />
}
