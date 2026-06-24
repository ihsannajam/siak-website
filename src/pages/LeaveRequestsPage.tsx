import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { useAuth } from '../auth/AuthContext'

type Row = Record<string, any>

const TYPE_LABEL: Record<string, string> = { IZIN: 'Izin', CUTI: 'Cuti', SAKIT: 'Sakit' }
const STATUS_PILL: Record<string, string> = {
  DIAJUKAN: 'pill-yellow',
  DISETUJUI: 'pill-green',
  DITOLAK: 'pill-red',
}
const fmtDate = (v?: string) => (v ? v.slice(0, 10) : '-')

export function LeaveRequestsPage() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<Row>({ type: 'IZIN' })

  const canCreate = hasPermission('leave-requests.create')
  const canUpdate = hasPermission('leave-requests.update')

  const employeesQuery = useQuery({
    queryKey: ['options', '/employees'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Row[]>>('/employees', { params: { all: true } })
      return data.data
    },
  })

  const listQuery = useQuery({
    queryKey: ['leave-requests', page, statusFilter],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Row[]>>('/leave-requests', {
        params: { page, limit: 10, status: statusFilter || undefined },
      })
      return data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: Row) => api.post('/leave-requests', payload),
    onSuccess: () => {
      toast.success('Pengajuan dibuat')
      setCreateOpen(false)
      setForm({ type: 'IZIN' })
      qc.invalidateQueries({ queryKey: ['leave-requests'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const decisionMutation = useMutation({
    mutationFn: async (p: { id: string; status: string }) =>
      api.post(`/leave-requests/${p.id}/decision`, { status: p.status }),
    onSuccess: () => {
      toast.success('Keputusan disimpan')
      qc.invalidateQueries({ queryKey: ['leave-requests'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const items = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  function submit() {
    if (!form.employeeId) return toast.error('Pegawai wajib dipilih')
    if (!form.startDate || !form.endDate) return toast.error('Tanggal wajib diisi')
    createMutation.mutate(form)
  }

  return (
    <div>
      <div className="page-header">
        <h1>Cuti / Izin</h1>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            + Ajukan Izin/Cuti
          </button>
        )}
      </div>

      <div className="card">
        <div className="toolbar">
          <select
            className="select"
            style={{ maxWidth: 220 }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Semua Status</option>
            <option value="DIAJUKAN">Diajukan</option>
            <option value="DISETUJUI">Disetujui</option>
            <option value="DITOLAK">Ditolak</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Pegawai</th>
                <th>Jenis</th>
                <th>Mulai</th>
                <th>Selesai</th>
                <th>Alasan</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && (
                <tr>
                  <td colSpan={7} className="empty">
                    Memuat…
                  </td>
                </tr>
              )}
              {!listQuery.isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    Belum ada pengajuan
                  </td>
                </tr>
              )}
              {items.map((r) => (
                <tr key={r.id}>
                  <td>{r.employee?.fullName ?? '-'}</td>
                  <td>{TYPE_LABEL[r.type] ?? r.type}</td>
                  <td>{fmtDate(r.startDate)}</td>
                  <td>{fmtDate(r.endDate)}</td>
                  <td>{r.reason ?? '-'}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[r.status] ?? 'pill-gray'}`}>{r.status}</span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {canUpdate && r.status === 'DIAJUKAN' ? (
                      <>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => decisionMutation.mutate({ id: r.id, status: 'DISETUJUI' })}
                        >
                          Setujui
                        </button>{' '}
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => decisionMutation.mutate({ id: r.id, status: 'DITOLAK' })}
                        >
                          Tolak
                        </button>
                      </>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
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
        open={createOpen}
        title="Ajukan Izin / Cuti"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label>
            Pegawai <span className="req">*</span>
          </label>
          <select
            className="select"
            value={form.employeeId ?? ''}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
          >
            <option value="">— Pilih —</option>
            {(employeesQuery.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Jenis</label>
          <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="IZIN">Izin</option>
            <option value="CUTI">Cuti</option>
            <option value="SAKIT">Sakit</option>
          </select>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label>
              Tanggal Mulai <span className="req">*</span>
            </label>
            <input
              className="input"
              type="date"
              value={form.startDate ?? ''}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>
              Tanggal Selesai <span className="req">*</span>
            </label>
            <input
              className="input"
              type="date"
              value={form.endDate ?? ''}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Alasan</label>
          <textarea rows={3} value={form.reason ?? ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>
      </Modal>
    </div>
  )
}
