import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { useAuth } from '../auth/AuthContext'

type Row = Record<string, any>

const STATUS_PILL: Record<string, string> = {
  MENUNGGU_VERIFIKASI: 'pill-yellow',
  LUNAS: 'pill-green',
  DITOLAK: 'pill-red',
}
const rupiah = (n?: number) => 'Rp ' + (n ?? 0).toLocaleString('id-ID')
const label = (s?: string) => (s ?? '').replaceAll('_', ' ')

export function PaymentsPage() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<Row>({})
  const [file, setFile] = useState<File | null>(null)

  const canCreate = hasPermission('payments.create')
  const canUpdate = hasPermission('payments.update')

  const invoicesQuery = useQuery({
    queryKey: ['options', '/invoices'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Row[]>>('/invoices', { params: { all: true } })
      return data.data
    },
  })

  const listQuery = useQuery({
    queryKey: ['payments', page, statusFilter],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Row[]>>('/payments', {
        params: { page, limit: 10, status: statusFilter || undefined },
      })
      return data
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('invoiceId', form.invoiceId)
      fd.append('amount', String(form.amount))
      if (form.method) fd.append('method', form.method)
      if (file) fd.append('file', file)
      return api.post('/payments', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      toast.success('Pembayaran dicatat, menunggu verifikasi')
      setCreateOpen(false)
      setForm({})
      setFile(null)
      qc.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const verifyMutation = useMutation({
    mutationFn: async (p: { id: string; approved: boolean }) =>
      api.post(`/payments/${p.id}/verify`, { approved: p.approved }),
    onSuccess: () => {
      toast.success('Verifikasi disimpan')
      qc.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const items = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  function submit() {
    if (!form.invoiceId) return toast.error('Tagihan wajib dipilih')
    if (!form.amount) return toast.error('Jumlah wajib diisi')
    createMutation.mutate()
  }

  return (
    <div>
      <div className="page-header">
        <h1>Pembayaran</h1>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            + Catat Pembayaran
          </button>
        )}
      </div>

      <div className="card">
        <div className="toolbar">
          <select
            className="select"
            style={{ maxWidth: 240 }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Semua Status</option>
            <option value="MENUNGGU_VERIFIKASI">Menunggu Verifikasi</option>
            <option value="LUNAS">Lunas</option>
            <option value="DITOLAK">Ditolak</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>No. Tagihan</th>
                <th>Siswa</th>
                <th>Jumlah</th>
                <th>Metode</th>
                <th>Bukti</th>
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
                    Belum ada pembayaran
                  </td>
                </tr>
              )}
              {items.map((r) => (
                <tr key={r.id}>
                  <td>{r.invoice?.invoiceNumber ?? '-'}</td>
                  <td>{r.invoice?.student?.fullName ?? '-'}</td>
                  <td>{rupiah(r.amount)}</td>
                  <td>{r.method ?? '-'}</td>
                  <td>
                    {r.proofPath ? (
                      <a href={r.proofPath} target="_blank" rel="noreferrer" style={{ color: 'var(--info)' }}>
                        Lihat
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <span className={`pill ${STATUS_PILL[r.status] ?? 'pill-gray'}`}>{label(r.status)}</span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {canUpdate && r.status === 'MENUNGGU_VERIFIKASI' ? (
                      <>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => verifyMutation.mutate({ id: r.id, approved: true })}
                        >
                          Setujui
                        </button>{' '}
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => verifyMutation.mutate({ id: r.id, approved: false })}
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
        title="Catat Pembayaran"
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
            Tagihan <span className="req">*</span>
          </label>
          <select
            className="select"
            value={form.invoiceId ?? ''}
            onChange={(e) => {
              const inv = (invoicesQuery.data ?? []).find((i) => i.id === e.target.value)
              setForm({ ...form, invoiceId: e.target.value, amount: form.amount ?? inv?.amount })
            }}
          >
            <option value="">— Pilih —</option>
            {(invoicesQuery.data ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.invoiceNumber} — {i.student?.fullName ?? ''} ({rupiah(i.amount)})
              </option>
            ))}
          </select>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label>
              Jumlah Bayar (Rp) <span className="req">*</span>
            </label>
            <input
              className="input"
              type="number"
              value={form.amount ?? ''}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Metode</label>
            <input
              className="input"
              placeholder="Transfer / Tunai"
              value={form.method ?? ''}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Bukti Bayar (opsional)</label>
          <div>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => fileRef.current?.click()}>
              ⬆️ Pilih Berkas
            </button>{' '}
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{file ? file.name : 'Belum ada berkas'}</span>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
