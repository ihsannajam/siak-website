import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@heroui/react'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../auth/AuthContext'
import { Avatar, Button } from '@heroui/react'
import { ArrowDownToLine, ArrowUpFromLine, Eye, PencilToSquare, Plus, TrashBin } from '@gravity-ui/icons'
import {
  DataTable, IconAction, PageHeader, Panel, RowActions, SearchBox, SelectInput, StatusChip,
  TablePager, Toolbar, type ChipColor, type Option, type TableColumnDef,
} from '../components/ui'
import { DOCUMENT_LABEL, GENDER_OPTIONS, STUDENT_STATUS_LABEL, STUDENT_STATUS_OPTIONS } from '../config/studentFields'

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
const EMPTY_FILTERS = { status: '', classId: '', educationProgram: '', entryAcademicYearId: '', gender: '' }
type StudentFilters = typeof EMPTY_FILTERS
const activeFilters = (filters: StudentFilters) =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value))

function StudentCell({ student }: { student: Student }) {
  return (
    <div className="flex items-center gap-2.5 md:min-w-44">
      <Avatar color="accent" size="sm" variant="soft" className="shrink-0 max-sm:hidden">
        {student.photoUrl && <Avatar.Image src={student.photoUrl} alt={`Foto ${student.fullName}`} />}
        <Avatar.Fallback>{student.fullName.charAt(0).toUpperCase()}</Avatar.Fallback>
      </Avatar>
      <div className="min-w-0">
        <div className="font-bold">{student.fullName}</div>
        {student.nickname && <div className="text-xs text-muted">{student.nickname}</div>}
      </div>
    </div>
  )
}

function DocumentProgress({ progress }: { progress?: { uploaded: number; required: number; missing: string[] } }) {
  if (!progress) return '-'
  const complete = progress.uploaded >= progress.required
  const color: ChipColor = complete ? 'success' : progress.uploaded > 0 ? 'warning' : 'danger'
  const title = complete
    ? 'Dokumen lengkap'
    : `Belum ada: ${progress.missing.map((type) => DOCUMENT_LABEL[type] ?? type).join(', ')}`
  return (
    <span title={title} aria-label={`${progress.uploaded} dari ${progress.required} dokumen. ${title}`}>
      <StatusChip color={color}>{progress.uploaded}/{progress.required}</StatusChip>
    </span>
  )
}

export function StudentsPage() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<StudentFilters>(EMPTY_FILTERS)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const canCreate = hasPermission('students.create')
  const canUpdate = hasPermission('students.update')
  const canDelete = hasPermission('students.delete')

  const listQuery = useQuery({
    queryKey: ['students', page, search, filters],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Student[]>>('/students', {
        params: { page, limit: 10, search, ...activeFilters(filters) },
      })
      return data
    },
  })

  const filterOptions = useQuery({
    queryKey: ['students', 'filter-options'],
    queryFn: async () =>
      (await api.get<ApiResponse<{ classes: Option[]; academicYears: Option[]; programs: Option[] }>>('/students/filter-options')).data.data,
  })

  function setFilter(name: keyof StudentFilters, value: string) {
    setFilters((prev) => ({ ...prev, [name]: value }))
    setPage(1)
  }

  const hasFilters = !!search || Object.values(filters).some(Boolean)

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
        params: { search: search || undefined, ...activeFilters(filters) },
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
  const columns: TableColumnDef[] = [
    { label: 'Siswa' },
    { label: 'NIS', hideOnMobile: true },
    { label: 'NISN', hideOnMobile: true },
    { label: 'Kelas' },
    { label: 'L/P', hideOnMobile: true },
    { label: 'Program', hideOnMobile: true },
    { label: 'Tahun Masuk', hideOnMobile: true },
    ...(canUpdate ? [{ label: 'Dokumen', hideOnMobile: true }] : []),
    { label: 'Status' },
    { label: 'Aksi', align: 'right' },
  ]

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
          <SearchBox
            placeholder="Cari nama / panggilan / NIS / NISN…"
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
          />
          <SelectInput ariaLabel="Filter status" className="w-full sm:w-44" emptyLabel="Semua Status" options={FILTER_OPTIONS} value={filters.status} onChange={(v) => setFilter('status', v)} />
          <SelectInput ariaLabel="Filter kelas" className="w-full sm:w-44" emptyLabel="Semua Kelas" options={filterOptions.data?.classes ?? []} value={filters.classId} onChange={(v) => setFilter('classId', v)} />
          <SelectInput ariaLabel="Filter program" className="w-full sm:w-44" emptyLabel="Semua Program" options={filterOptions.data?.programs ?? []} value={filters.educationProgram} onChange={(v) => setFilter('educationProgram', v)} />
          <SelectInput ariaLabel="Filter tahun masuk" className="w-full sm:w-44" emptyLabel="Semua Tahun Masuk" options={filterOptions.data?.academicYears ?? []} value={filters.entryAcademicYearId} onChange={(v) => setFilter('entryAcademicYearId', v)} />
          <SelectInput ariaLabel="Filter jenis kelamin" className="w-full sm:w-44" emptyLabel="Semua L/P" options={GENDER_OPTIONS} value={filters.gender} onChange={(v) => setFilter('gender', v)} />
          {hasFilters && (
            <Button variant="ghost" onPress={() => { setSearch(''); setFilters(EMPTY_FILTERS); setPage(1) }}>
              Reset
            </Button>
          )}
        </Toolbar>
        <DataTable
          label="Data siswa"
          columns={columns}
          rows={items}
          isLoading={listQuery.isLoading}
          emptyText={hasFilters ? 'Tidak ada siswa yang cocok dengan filter' : 'Belum ada data'}
          renderRow={(s) => [
            <StudentCell student={s} />,
            s.nis ?? '-',
            s.nisn ?? '-',
            s.classAssignments?.map((a: Student) => a.class?.name).filter(Boolean).join(', ') || '-',
            s.gender === 'PEREMPUAN' ? 'P' : 'L',
            s.educationProgram ?? '-',
            s.entryAcademicYear?.name ?? '-',
            ...(canUpdate ? [<DocumentProgress progress={s.documentProgress} />] : []),
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
