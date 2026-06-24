import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { useAuth } from '../auth/AuthContext'

type Row = Record<string, any>

const STATUS_PILL: Record<string, string> = {
  DRAFT: 'pill-gray',
  SUBMITTED: 'pill-yellow',
  LOCKED: 'pill-blue',
  APPROVED: 'pill-green',
}

export function ReportCardsPage() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const [page, setPage] = useState(1)
  const [genOpen, setGenOpen] = useState(false)
  const [form, setForm] = useState<Row>({})

  const canCreate = hasPermission('report-cards.create')
  const canUpdate = hasPermission('report-cards.update')

  const studentsQuery = useQuery({
    queryKey: ['options', '/students'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Row[]>>('/students', { params: { all: true } })
      return data.data
    },
  })
  const semestersQuery = useQuery({
    queryKey: ['options', '/semesters'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Row[]>>('/semesters', { params: { all: true } })
      return data.data
    },
  })
  const classesQuery = useQuery({
    queryKey: ['options', '/classes'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Row[]>>('/classes', { params: { all: true } })
      return data.data
    },
  })

  const listQuery = useQuery({
    queryKey: ['report-cards', page],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Row[]>>('/report-cards', { params: { page, limit: 10 } })
      return data
    },
  })

  const generateMutation = useMutation({
    mutationFn: async () =>
      api.post('/report-cards/generate', {
        studentId: form.studentId,
        semesterId: form.semesterId,
        classId: form.classId || null,
        attitudeNote: form.attitudeNote || null,
        teacherNote: form.teacherNote || null,
      }),
    onSuccess: () => {
      toast.success('E-rapor berhasil di-generate')
      setGenOpen(false)
      setForm({})
      qc.invalidateQueries({ queryKey: ['report-cards'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const actionMutation = useMutation({
    mutationFn: async (p: { id: string; action: string }) => api.post(`/report-cards/${p.id}/${p.action}`),
    onSuccess: () => {
      toast.success('Status rapor diperbarui')
      qc.invalidateQueries({ queryKey: ['report-cards'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  async function downloadPdf(row: Row) {
    try {
      const res = await api.get(`/report-cards/${row.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rapor-${row.student?.fullName ?? row.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  const items = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  function submit() {
    if (!form.studentId) return toast.error('Siswa wajib dipilih')
    if (!form.semesterId) return toast.error('Semester wajib dipilih')
    generateMutation.mutate()
  }

  return (
    <div>
      <div className="page-header">
        <h1>E-Rapor</h1>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setGenOpen(true)}>
            + Generate E-Rapor
          </button>
        )}
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Siswa</th>
                <th>Kelas</th>
                <th>Rata-rata</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && (
                <tr>
                  <td colSpan={5} className="empty">
                    Memuat…
                  </td>
                </tr>
              )}
              {!listQuery.isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    Belum ada rapor
                  </td>
                </tr>
              )}
              {items.map((r) => (
                <tr key={r.id}>
                  <td>{r.student?.fullName ?? '-'}</td>
                  <td>{r.class?.name ?? '-'}</td>
                  <td>{r.averageScore ?? '-'}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[r.status] ?? 'pill-gray'}`}>{r.status}</span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => downloadPdf(r)}>
                      PDF
                    </button>{' '}
                    {canUpdate && r.status === 'DRAFT' && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => actionMutation.mutate({ id: r.id, action: 'submit' })}
                      >
                        Submit
                      </button>
                    )}
                    {canUpdate && r.status === 'SUBMITTED' && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => actionMutation.mutate({ id: r.id, action: 'lock' })}
                      >
                        Kunci
                      </button>
                    )}
                    {canUpdate && r.status === 'LOCKED' && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => actionMutation.mutate({ id: r.id, action: 'approve' })}
                      >
                        Setujui
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ‹ Prev
            </button>
            <span style={{ fontSize: 13 }}>
              Hal {meta.page} / {meta.totalPages} ({meta.total})
            </span>
            <button
              className="btn btn-sm btn-secondary"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next ›
            </button>
          </div>
        )}
      </div>

      <Modal
        open={genOpen}
        title="Generate E-Rapor"
        onClose={() => setGenOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setGenOpen(false)}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? 'Memproses…' : 'Generate'}
            </button>
          </>
        }
      >
        <p style={{ marginTop: 0, fontSize: 13, color: 'var(--muted)' }}>
          Nilai siswa pada semester terpilih akan diakumulasikan menjadi rata-rata rapor.
        </p>
        <div className="form-group">
          <label>
            Siswa <span className="req">*</span>
          </label>
          <select
            className="select"
            value={form.studentId ?? ''}
            onChange={(e) => setForm({ ...form, studentId: e.target.value })}
          >
            <option value="">— Pilih —</option>
            {(studentsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label>
              Semester <span className="req">*</span>
            </label>
            <select
              className="select"
              value={form.semesterId ?? ''}
              onChange={(e) => setForm({ ...form, semesterId: e.target.value })}
            >
              <option value="">— Pilih —</option>
              {(semestersQuery.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.type} {s.academicYear?.name ?? ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Kelas</label>
            <select
              className="select"
              value={form.classId ?? ''}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
            >
              <option value="">— Pilih —</option>
              {(classesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Catatan Sikap</label>
          <textarea
            rows={2}
            value={form.attitudeNote ?? ''}
            onChange={(e) => setForm({ ...form, attitudeNote: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Catatan Wali Kelas</label>
          <textarea
            rows={2}
            value={form.teacherNote ?? ''}
            onChange={(e) => setForm({ ...form, teacherNote: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  )
}
