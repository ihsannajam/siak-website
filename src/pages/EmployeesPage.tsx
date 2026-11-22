import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Avatar, Button, toast } from '@heroui/react'
import { Eye, PencilToSquare, Plus, TrashBin } from '@gravity-ui/icons'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { useAuth } from '../auth/AuthContext'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  DataTable, IconAction, PageHeader, Panel, RowActions, SearchBox, SelectInput, StatusChip, TablePager, Toolbar,
  type ChipColor, type TableColumnDef,
} from '../components/ui'
import {
  ACTIVE_OPTIONS, CATEGORY_OPTIONS, EMPLOYEE_DOCUMENTS, EMPLOYMENT_OPTIONS, labelOf, serviceLength,
} from '../config/employeeFields'

type Employee = Record<string, any>

const ACTIVE_COLOR: Record<string, ChipColor> = { AKTIF: 'success', CUTI: 'warning', NONAKTIF: 'default', KELUAR: 'danger' }
const EMPTY_FILTERS = { personnelCategory: '', employmentStatus: '', activeStatus: '' }
type Filters = typeof EMPTY_FILTERS
const activeFilters = (filters: Filters) => Object.fromEntries(Object.entries(filters).filter(([, v]) => v))

function DocumentProgress({ progress }: { progress?: { uploaded: number; required: number; missing: string[] } }) {
  if (!progress) return '-'
  const complete = progress.uploaded >= progress.required
  const color: ChipColor = complete ? 'success' : progress.uploaded > 0 ? 'warning' : 'danger'
  const title = complete
    ? 'Dokumen lengkap'
    : `Belum ada: ${progress.missing.map((t) => EMPLOYEE_DOCUMENTS.find((d) => d.value === t)?.label ?? t).join(', ')}`
  return (
    <span title={title} aria-label={`${progress.uploaded} dari ${progress.required} dokumen. ${title}`}>
      <StatusChip color={color}>{progress.uploaded}/{progress.required}</StatusChip>
    </span>
  )
}

export function EmployeesPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const canCreate = hasPermission('employees.create')
  const canUpdate = hasPermission('employees.update')
  const canDelete = hasPermission('employees.delete')

  const list = useQuery({
    queryKey: ['employees', page, search, filters],
    queryFn: async () =>
      (await api.get<ApiResponse<Employee[]>>('/employees', { params: { page, limit: 10, search, ...activeFilters(filters) } })).data,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => {
      toast.success('Pegawai dihapus')
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['options', '/employees'] })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const setFilter = (name: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [name]: value }))
    setPage(1)
  }
  const hasFilters = !!search || Object.values(filters).some(Boolean)
  const columns: TableColumnDef[] = [
    { label: 'Pegawai' },
    { label: 'ID Personel', hideOnMobile: true },
    { label: 'Kategori', hideOnMobile: true },
    { label: 'Jabatan' },
    { label: 'Kepegawaian', hideOnMobile: true },
    { label: 'Masa Kerja', hideOnMobile: true },
    ...(canUpdate ? [{ label: 'Dokumen', hideOnMobile: true }] : []),
    { label: 'Status' },
    { label: 'Aksi', align: 'right' },
  ]

  return (
    <div>
      <PageHeader
        title="Data Pegawai & Guru"
        actions={canCreate && <Button onPress={() => navigate('/employees/new')}><Plus />Tambah Pegawai</Button>}
      />
      <Panel>
        <Toolbar>
          <SearchBox
            placeholder="Cari nama / ID / NUPTK / jabatan…"
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
          />
          <SelectInput ariaLabel="Filter kategori" className="w-full sm:w-48" emptyLabel="Semua Kategori" options={CATEGORY_OPTIONS} value={filters.personnelCategory} onChange={(v) => setFilter('personnelCategory', v)} />
          <SelectInput ariaLabel="Filter status kepegawaian" className="w-full sm:w-44" emptyLabel="Semua Kepegawaian" options={EMPLOYMENT_OPTIONS} value={filters.employmentStatus} onChange={(v) => setFilter('employmentStatus', v)} />
          <SelectInput ariaLabel="Filter status keaktifan" className="w-full sm:w-44" emptyLabel="Semua Status" options={ACTIVE_OPTIONS} value={filters.activeStatus} onChange={(v) => setFilter('activeStatus', v)} />
          {hasFilters && (
            <Button variant="ghost" onPress={() => { setSearch(''); setFilters(EMPTY_FILTERS); setPage(1) }}>Reset</Button>
          )}
        </Toolbar>
        <DataTable
          label="Data pegawai dan guru"
          columns={columns}
          rows={list.data?.data ?? []}
          isLoading={list.isLoading}
          emptyText={hasFilters ? 'Tidak ada pegawai yang cocok dengan filter' : 'Belum ada data'}
          renderRow={(e) => [
            <div className="flex items-center gap-2.5 md:min-w-44">
              <Avatar color="accent" size="sm" variant="soft" className="shrink-0 max-sm:hidden">
                {e.photoUrl && <Avatar.Image src={e.photoUrl} alt={`Foto ${e.fullName}`} />}
                <Avatar.Fallback>{e.fullName.charAt(0).toUpperCase()}</Avatar.Fallback>
              </Avatar>
              <span className="font-bold">{e.fullName}</span>
            </div>,
            <span className="whitespace-nowrap">{e.nip ?? '-'}</span>,
            labelOf(CATEGORY_OPTIONS, e.personnelCategory),
            e.position,
            labelOf(EMPLOYMENT_OPTIONS, e.employmentStatus),
            <span className="whitespace-nowrap">{serviceLength(e.workStartDate).replace(' tahun', ' th').replace(' bulan', ' bln')}</span>,
            ...(canUpdate ? [<DocumentProgress progress={e.documentProgress} />] : []),
            <StatusChip color={ACTIVE_COLOR[e.activeStatus]}>{labelOf(ACTIVE_OPTIONS, e.activeStatus)}</StatusChip>,
            <RowActions>
              <IconAction
                label={canUpdate ? 'Edit' : 'Lihat detail'}
                icon={canUpdate ? <PencilToSquare /> : <Eye />}
                onPress={() => navigate(`/employees/${e.id}`)}
              />
              {canDelete && <IconAction danger label="Hapus" icon={<TrashBin />} onPress={() => setDeleteId(e.id)} />}
            </RowActions>,
          ]}
        />
        <TablePager meta={list.data?.meta} page={page} onChange={setPage} />
      </Panel>
      <ConfirmDialog
        open={!!deleteId}
        message="Yakin ingin menghapus pegawai ini? (soft delete)"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
        loading={remove.isPending}
      />
    </div>
  )
}
