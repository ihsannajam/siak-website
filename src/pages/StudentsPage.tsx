import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@heroui/react'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../auth/AuthContext'
import { Button } from '@heroui/react'
import { ArrowDownToLine, ArrowUpFromLine, Plus } from '@gravity-ui/icons'
import {
  DataTable, EditDeleteActions, FormGrid, FormStack, PageHeader, Panel, SearchBox, SelectInput,
  StatusChip, TablePager, TextAreaInput, TextInput, Toolbar, type ChipColor,
} from '../components/ui'

type Student = Record<string, any>

const STATUS_COLOR: Record<string, ChipColor> = {
  AKTIF: 'success',
  LULUS: 'info',
  PINDAH: 'warning',
  DROP_OUT: 'danger',
}
const GENDER_OPTIONS = [{ value: 'LAKI_LAKI', label: 'Laki-laki' }, { value: 'PEREMPUAN', label: 'Perempuan' }]
const STATUS_OPTIONS = [
  { value: 'AKTIF', label: 'Aktif' }, { value: 'LULUS', label: 'Lulus' },
  { value: 'PINDAH', label: 'Pindah' }, { value: 'DROP_OUT', label: 'Drop Out' },
]
const FILTER_OPTIONS = STATUS_OPTIONS.map((o) => (o.value === 'LULUS' ? { ...o, label: 'Lulus (Alumni)' } : o))

export function StudentsPage() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState<Student>({ gender: 'LAKI_LAKI', status: 'AKTIF' })
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

  const saveMutation = useMutation({
    mutationFn: async (payload: Student) => {
      if (editing) return api.put(`/students/${editing.id}`, payload)
      return api.post('/students', payload)
    },
    onSuccess: () => {
      toast.success(editing ? 'Siswa diperbarui' : 'Siswa ditambahkan')
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
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

  function openCreate() {
    setEditing(null)
    setForm({ gender: 'LAKI_LAKI', status: 'AKTIF' })
    setModalOpen(true)
  }

  function openEdit(s: Student) {
    setEditing(s)
    setForm({
      nis: s.nis ?? '',
      nisn: s.nisn ?? '',
      fullName: s.fullName ?? '',
      gender: s.gender ?? 'LAKI_LAKI',
      birthPlace: s.birthPlace ?? '',
      birthDate: s.birthDate ? s.birthDate.slice(0, 10) : '',
      address: s.address ?? '',
      phone: s.phone ?? '',
      status: s.status ?? 'AKTIF',
    })
    setModalOpen(true)
  }

  function submit() {
    if (!form.fullName) {
      toast.danger('Nama lengkap wajib diisi')
      return
    }
    const payload = { ...form }
    Object.keys(payload).forEach((k) => payload[k] === '' && (payload[k] = undefined))
    saveMutation.mutate(payload)
  }

  const items = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  const bind = (name: string) => ({
    value: form[name],
    onChange: (v: string) => setForm({ ...form, [name]: v }),
  })

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
                <Button onPress={openCreate}><Plus />Tambah Siswa</Button>
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
            <StatusChip color={STATUS_COLOR[s.status]}>{s.status}</StatusChip>,
            <EditDeleteActions
              onEdit={canUpdate ? () => openEdit(s) : undefined}
              onDelete={canDelete ? () => setDeleteId(s.id) : undefined}
            />,
          ]}
        />
        <TablePager meta={meta} page={page} onChange={setPage} />
      </Panel>

      <Modal
        open={modalOpen}
        title={`${editing ? 'Edit' : 'Tambah'} Siswa`}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="tertiary" onPress={() => setModalOpen(false)}>Batal</Button>
            <Button onPress={submit} isPending={saveMutation.isPending}>
              {saveMutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </>
        }
      >
        <FormStack>
          <TextInput label="Nama Lengkap" required {...bind('fullName')} />
          <FormGrid>
            <TextInput label="NIS" {...bind('nis')} />
            <TextInput label="NISN" {...bind('nisn')} />
            <TextInput label="Tempat Lahir" {...bind('birthPlace')} />
            <TextInput label="Tanggal Lahir" type="date" {...bind('birthDate')} />
            <SelectInput label="Jenis Kelamin" noEmpty options={GENDER_OPTIONS} {...bind('gender')} />
            <SelectInput label="Status" noEmpty options={STATUS_OPTIONS} {...bind('status')} />
          </FormGrid>
          <TextAreaInput label="Alamat" rows={2} {...bind('address')} />
          <TextInput label="Telepon" {...bind('phone')} />
        </FormStack>
      </Modal>

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
