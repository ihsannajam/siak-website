import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ApiResponse } from '../lib/types'

type Row = Record<string, any>
interface PermResponse {
  flat: Row[]
  grouped: Record<string, Row[]>
}

const ACTION_PILL: Record<string, string> = {
  read: 'pill-blue',
  create: 'pill-green',
  update: 'pill-yellow',
  delete: 'pill-red',
}

export function PermissionsPage() {
  const permsQuery = useQuery({
    queryKey: ['permissions-catalog'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<PermResponse>>('/permissions')
      return data.data
    },
  })

  const grouped = permsQuery.data?.grouped ?? {}

  return (
    <div>
      <div className="page-header">
        <h1>Manajemen Permission</h1>
      </div>

      <div className="card">
        <div className="card-body">
          <p style={{ marginTop: 0, color: 'var(--muted)' }}>
            Daftar seluruh hak akses sistem (dibentuk dari <code>modul.aksi</code>). Penetapan permission ke role
            dilakukan di menu <strong>Manajemen Role</strong>.
          </p>
        </div>
      </div>

      {permsQuery.isLoading && (
        <div className="card">
          <div className="card-body empty">Memuat…</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {Object.entries(grouped).map(([module, perms]) => (
          <div key={module} className="card">
            <div className="card-body">
              <h4 style={{ margin: '0 0 10px' }}>{module}</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {perms.map((p) => (
                  <span key={p.id} className={`pill ${ACTION_PILL[p.action] ?? 'pill-gray'}`} title={p.description}>
                    {p.action}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
