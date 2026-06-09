import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api, getErrorMessage, tokenStore } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../auth/AuthContext'

type Student = Record<string, any>

const STATUS_PILL: Record<string, string> = {
  AKTIF: 'pill-green',
  LULUS: 'pill-blue',
  PINDAH: 'pill-yellow',
  DROP_OUT: 'pill-red',
}

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
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/students/${id}`),
    onSuccess: () => {
      toast.success('Siswa dihapus')
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
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
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  function handleExport() {
    // Export hits a streaming endpoint; open with token via query is not allowed,
    // so fetch as blob and trigger download.
    fetch(`/api/students/export${statusFilter ? `?status=${statusFilter}` : ''}`, {
      headers: { Authorization: `Bearer ${tokenStore.access}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `data-siswa-${Date.now()}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => toast.error('Gagal export'))
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
      toast.error('Nama lengkap wajib diisi')
      return
    }
    const payload = { ...form }
    Object.keys(payload).forEach((k) => payload[k] === '' && (payload[k] = undefined))
    saveMutation.mutate(payload)
  }

  const items = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div>
      <div className="page-header">
        <h1>Data Siswa</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExport}>⬇️ Export Excel</button>
          {canCreate && (
            <>
              <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>⬆️ Import</button>
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
              <button className="btn btn-primary" onClick={openCreate}>+ Tambah Siswa</button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <input
            className="input search-input"
            placeholder="Cari nama / NIS / NISN…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <select className="select" style={{ maxWidth: 180 }} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
            <option value="">Semua Status</option>
            <option value="AKTIF">Aktif</option>
            <option value="LULUS">Lulus (Alumni)</option>
            <option value="PINDAH">Pindah</option>
            <option value="DROP_OUT">Drop Out</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>NIS</th><th>NISN</th><th>Nama</th><th>JK</th><th>Status</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && <tr><td colSpan={6} className="empty">Memuat…</td></tr>}
              {!listQuery.isLoading && items.length === 0 && <tr><td colSpan={6} className="empty">Belum ada data</td></tr>}
              {items.map((s) => (
                <tr key={s.id}>
                  <td>{s.nis ?? '-'}</td>
                  <td>{s.nisn ?? '-'}</td>
                  <td>{s.fullName}</td>
                  <td>{s.gender === 'PEREMPUAN' ? 'P' : 'L'}</td>
                  <td><span className={`pill ${STATUS_PILL[s.status] ?? 'pill-gray'}`}>{s.status}</span></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {canUpdate && <button className="btn btn-sm btn-secondary" onClick={() => openEdit(s)}>Edit</button>}{' '}
                    {canDelete && <button className="btn btn-sm btn-danger" onClick={() => setDeleteId(s.id)}>Hapus</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
            <span style={{ fontSize: 13 }}>Hal {meta.page} / {meta.totalPages} ({meta.total} data)</span>
            <button className="btn btn-sm btn-secondary" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={`${editing ? 'Edit' : 'Tambah'} Siswa`}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Batal</button>
            <button className="btn btn-primary" onClick={submit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        <div className="form-group"><label>Nama Lengkap <span className="req">*</span></label>
          <input className="input" value={form.fullName ?? ''} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
        <div className="grid-2">
          <div className="form-group"><label>NIS</label><input className="input" value={form.nis ?? ''} onChange={(e) => setForm({ ...form, nis: e.target.value })} /></div>
          <div className="form-group"><label>NISN</label><input className="input" value={form.nisn ?? ''} onChange={(e) => setForm({ ...form, nisn: e.target.value })} /></div>
        </div>
        <div className="grid-2">
          <div className="form-group"><label>Tempat Lahir</label><input className="input" value={form.birthPlace ?? ''} onChange={(e) => setForm({ ...form, birthPlace: e.target.value })} /></div>
          <div className="form-group"><label>Tanggal Lahir</label><input className="input" type="date" value={form.birthDate ?? ''} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} /></div>
        </div>
        <div className="grid-2">
          <div className="form-group"><label>Jenis Kelamin</label>
            <select className="select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="LAKI_LAKI">Laki-laki</option><option value="PEREMPUAN">Perempuan</option>
            </select></div>
          <div className="form-group"><label>Status</label>
            <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="AKTIF">Aktif</option><option value="LULUS">Lulus</option>
              <option value="PINDAH">Pindah</option><option value="DROP_OUT">Drop Out</option>
            </select></div>
        </div>
        <div className="form-group"><label>Alamat</label><textarea rows={2} value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="form-group"><label>Telepon</label><input className="input" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
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
