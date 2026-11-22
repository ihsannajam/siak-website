import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Card } from '@heroui/react'
import { Loader, PageHeader, StatusChip, type ChipColor } from '../components/ui'

type Row = Record<string, any>
interface PermResponse {
  flat: Row[]
  grouped: Record<string, Row[]>
}

const ACTION_COLOR: Record<string, ChipColor> = {
  read: 'info',
  create: 'success',
  update: 'warning',
  delete: 'danger',
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
      <PageHeader
        title="Manajemen Permission"
        description={
          <>
            Daftar seluruh hak akses sistem (dibentuk dari <code>modul.aksi</code>). Penetapan permission ke role
            dilakukan di menu <strong>Manajemen Role</strong>.
          </>
        }
      />

      {permsQuery.isLoading && <Loader />}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(grouped).map(([module, perms]) => (
          <Card key={module} className="gap-3 p-4">
            <Card.Title>{module}</Card.Title>
            <div className="flex flex-wrap gap-1.5">
              {perms.map((p) => (
                <span key={p.id} title={p.description}>
                  <StatusChip color={ACTION_COLOR[p.action]}>{p.action}</StatusChip>
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
