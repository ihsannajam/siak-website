import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@heroui/react'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../auth/AuthContext'
import { Button } from '@heroui/react'
import { ArrowDownToLine, ArrowUpFromLine, Eye, PencilToSquare, Plus, TrashBin } from '@gravity-ui/icons'
import {
  DataTable, IconAction, PageHeader, Panel, RowActions, SearchBox, SelectInput, StatusChip,
  TablePager, Toolbar, type ChipColor,
} from '../components/ui'
import { STUDENT_STATUS_LABEL, STUDENT_STATUS_OPTIONS } from '../config/studentFields'

type Student = Record<string, any>

const STATUS_COLOR: Record<string, ChipColor> = {
  AKTIF: 'success',
  LULUS: 'info',
  PINDAH: 'warning',
  NONAKTIF: 'default',
  MENGUNDURKAN_DIRI: 'danger',
  DROP_OUT: 'danger',
}
const FILTER_OPTIONS = [
  ...STUDENT_STATUS_OPTIONS.map((o) => (o.value === 'LULUS' ? { ...o, label: 'Lulus (Alumni)' } : o)),
  { value: 'DROP_OUT', label: 'Drop Out' },
]

export function StudentsPage() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const canCreate = hasPermission('students.create')
  const canUpdate = hasPermission('students.update')
  const canDelete = hasPermission('students.delete')

  const listQuery = useQuery({
    queryKey: ['students', page, search, statusFilter],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Student[]>>('/students', {
        params: { page, limit: 10, search, status: statusFilter || undefined },
      })
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/students/${id}`),
    onSuccess: () => {
      toast.success('Siswa dihapus')
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post<ApiResponse<{ created: number; failed: number }>>(
        '/students/import',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return data.data
    },
    onSuccess: (res) => {
      toast.success(`Import selesai: ${res.created} berhasil, ${res.failed} gagal`)
      qc.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  async function handleExport() {
    // Pakai client api agar mengikuti VITE_API_URL, token, dan refresh token.
    try {
      const res = await api.get<Blob>('/students/export', {
        params: { status: statusFilter || undefined },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `data-siswa-${Date.now()}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      // Dengan responseType blob, pesan error backend juga berbentuk Blob.
      const body = (e as { response?: { data?: unknown } }).response?.data
      let message = 'Gagal export'
      if (body instanceof Blob) {
        try {
          message = JSON.parse(await body.text()).message || message
        } catch {
          /* respons bukan JSON */
        }
      } else {
        message = getErrorMessage(e)
      }
      toast.danger(message)
    }
  }

  const items = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div>
      <PageHeader
        title="Data Siswa"
        actions={
          <>
            <Button variant="tertiary" onPress={handleExport}><ArrowDownToLine />Export Excel</Button>
            {canCreate && (
              <>
                <Button variant="tertiary" onPress={() => fileRef.current?.click()} isPending={importMutation.isPending}>
                  <ArrowUpFromLine />Import
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.csv"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) importMutation.mutate(f)
                    e.target.value = ''
                  }}
                />
                <Button onPress={() => navigate('/students/new')}><Plus />Tambah Siswa</Button>
              </>
            )}
          </>
        }
      />

      <Panel>
        <Toolbar>
          <SearchBox placeholder="Cari nama / NIS / NISN…" value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
          <SelectInput
            ariaLabel="Filter status"
            className="w-full sm:w-48"
            emptyLabel="Semua Status"
            options={FILTER_OPTIONS}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}
          />
        </Toolbar>
        <DataTable
          label="Data siswa"
          columns={[{ label: 'NIS' }, { label: 'NISN' }, { label: 'Nama' }, { label: 'JK' }, { label: 'Status' }, { label: 'Aksi', align: 'right' }]}
          rows={items}
          isLoading={listQuery.isLoading}
          renderRow={(s) => [
            s.nis ?? '-',
            s.nisn ?? '-',
            s.fullName,
            s.gender === 'PEREMPUAN' ? 'P' : 'L',
            <StatusChip color={STATUS_COLOR[s.status]}>{STUDENT_STATUS_LABEL[s.status] ?? s.status}</StatusChip>,
            <RowActions>
              <IconAction
                label={canUpdate ? 'Edit' : 'Lihat detail'}
                icon={canUpdate ? <PencilToSquare /> : <Eye />}
                onPress={() => navigate(`/students/${s.id}`)}
              />
              {canDelete && <IconAction danger label="Hapus" icon={<TrashBin />} onPress={() => setDeleteId(s.id)} />}
            </RowActions>,
          ]}
        />
        <TablePager meta={meta} page={page} onChange={setPage} />
      </Panel>

      <ConfirmDialog
        open={!!deleteId}
        message="Yakin ingin menghapus siswa ini? (soft delete)"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
