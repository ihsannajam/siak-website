import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { useAuth } from '../auth/AuthContext'

type Reg = Record<string, any>

const STATUS_OPTIONS = [
  'BELUM_VERIFIKASI',
  'TERVERIFIKASI',
  'BERKAS_TIDAK_LENGKAP',
  'SUDAH_SELEKSI',
  'SEDANG_DIPROSES',
  'BELUM_HADIR',
  'DITERIMA',
  'CADANGAN',
  'TIDAK_DITERIMA',
]

const STATUS_PILL: Record<string, string> = {
  DITERIMA: 'pill-green',
  CADANGAN: 'pill-yellow',
  TIDAK_DITERIMA: 'pill-red',
  TERVERIFIKASI: 'pill-blue',
  BERKAS_TIDAK_LENGKAP: 'pill-red',
}

const label = (s: string) => s.replaceAll('_', ' ')

export function PpdbPage() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [form, setForm] = useState<Reg>({ gender: 'LAKI_LAKI' })

  const canCreate = hasPermission('ppdb.create')
  const canUpdate = hasPermission('ppdb.update')

  const listQuery = useQuery({
    queryKey: ['ppdb', page, search, statusFilter],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Reg[]>>('/ppdb', {
        params: { page, limit: 10, search, status: statusFilter || undefined },
      })
      return data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: Reg) => api.post('/ppdb', payload),
    onSuccess: () => {
      toast.success('Pendaftar ditambahkan')
      setCreateOpen(false)
      setForm({ gender: 'LAKI_LAKI' })
      qc.invalidateQueries({ queryKey: ['ppdb'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const items = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div>
      <div className="page-header">
        <h1>PPDB — Penerimaan Peserta Didik Baru</h1>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            + Tambah Pendaftar
          </button>
        )}
      </div>

      <div className="card">
        <div className="toolbar">
          <input
            className="input search-input"
            placeholder="Cari nama / no. pendaftaran…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <select className="select" style={{ maxWidth: 220 }} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
            <option value="">Semua Status</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>No. Pendaftaran</th><th>Nama</th><th>JK</th><th>Status</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && <tr><td colSpan={5} className="empty">Memuat…</td></tr>}
              {!listQuery.isLoading && items.length === 0 && <tr><td colSpan={5} className="empty">Belum ada pendaftar</td></tr>}
              {items.map((r) => (
                <tr key={r.id}>
                  <td>{r.registrationNumber}</td>
                  <td>{r.fullName}</td>
                  <td>{r.gender === 'PEREMPUAN' ? 'P' : 'L'}</td>
                  <td><span className={`pill ${STATUS_PILL[r.status] ?? 'pill-gray'}`}>{label(r.status)}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => setDetailId(r.id)}>Kelola</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
            <span style={{ fontSize: 13 }}>Hal {meta.page} / {meta.totalPages} ({meta.total})</span>
            <button className="btn btn-sm btn-secondary" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
          </div>
        )}
      </div>

      {/* Create */}
      <Modal
        open={createOpen}
        title="Tambah Pendaftar PPDB"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Batal</button>
            <button className="btn btn-primary" disabled={createMutation.isPending}
              onClick={() => { if (!form.fullName) return toast.error('Nama wajib diisi'); createMutation.mutate(form) }}>
              {createMutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        <div className="form-group"><label>Nama Lengkap <span className="req">*</span></label>
          <input className="input" value={form.fullName ?? ''} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
        <div className="grid-2">
          <div className="form-group"><label>Tempat Lahir</label><input className="input" value={form.birthPlace ?? ''} onChange={(e) => setForm({ ...form, birthPlace: e.target.value })} /></div>
          <div className="form-group"><label>Tanggal Lahir</label><input className="input" type="date" value={form.birthDate ?? ''} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} /></div>
        </div>
        <div className="form-group"><label>Jenis Kelamin</label>
          <select className="select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="LAKI_LAKI">Laki-laki</option><option value="PEREMPUAN">Perempuan</option>
          </select></div>
        <div className="form-group"><label>Alamat</label><textarea rows={2} value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="grid-2">
          <div className="form-group"><label>Nama Ayah</label><input className="input" value={form.fatherName ?? ''} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} /></div>
          <div className="form-group"><label>Nama Ibu</label><input className="input" value={form.motherName ?? ''} onChange={(e) => setForm({ ...form, motherName: e.target.value })} /></div>
        </div>
        <div className="grid-2">
          <div className="form-group"><label>Nama Wali</label><input className="input" value={form.guardianName ?? ''} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} /></div>
          <div className="form-group"><label>No. HP Wali</label><input className="input" value={form.guardianPhone ?? ''} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} /></div>
        </div>
      </Modal>

      {detailId && (
        <PpdbDetail id={detailId} canUpdate={canUpdate} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}

function PpdbDetail({ id, canUpdate, onClose }: { id: string; canUpdate: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [score, setScore] = useState<Reg>({})

  const detailQuery = useQuery({
    queryKey: ['ppdb', id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Reg>>(`/ppdb/${id}`)
      return data.data
    },
  })
  const logsQuery = useQuery({
    queryKey: ['ppdb', id, 'logs'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Reg[]>>(`/ppdb/${id}/logs`)
      return data.data
    },
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ppdb'] })
  }

  const setResult = useMutation({
    mutationFn: async (status: string) => api.post(`/ppdb/${id}/set-selection-result`, { status }),
    onSuccess: () => { toast.success('Status seleksi diperbarui'); refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const uploadDoc = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('docType', 'PERSYARATAN')
      return api.post(`/ppdb/${id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => { toast.success('Dokumen diunggah'); refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const verifyDoc = useMutation({
    mutationFn: async (p: { documentId: string; isVerified: boolean }) => api.post(`/ppdb/${id}/verify-document`, p),
    onSuccess: () => { toast.success('Verifikasi diperbarui'); refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const saveScore = useMutation({
    mutationFn: async () => api.post(`/ppdb/${id}/scorecard`, {
      writtenScore: score.writtenScore ? Number(score.writtenScore) : null,
      interviewScore: score.interviewScore ? Number(score.interviewScore) : null,
      behaviorScore: score.behaviorScore ? Number(score.behaviorScore) : null,
      evaluatorNote: score.evaluatorNote || null,
      recommendation: score.recommendation || null,
    }),
    onSuccess: () => { toast.success('Scorecard disimpan'); refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const sync = useMutation({
    mutationFn: async () => api.post(`/ppdb/${id}/sync-to-student`),
    onSuccess: (res) => { toast.success(`Disinkronkan ke data siswa (NIS ${res.data.data.nis})`); refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const reg = detailQuery.data

  return (
    <Modal open title={`Kelola Pendaftar${reg ? ` — ${reg.fullName}` : ''}`} onClose={onClose}
      footer={<button className="btn btn-secondary" onClick={onClose}>Tutup</button>}>
      {!reg ? (
        <p>Memuat…</p>
      ) : (
        <div>
          <p style={{ marginTop: 0 }}>
            <span className="pill pill-gray">{reg.registrationNumber}</span>{' '}
            <span className={`pill ${STATUS_PILL[reg.status] ?? 'pill-gray'}`}>{label(reg.status)}</span>
          </p>

          {/* 1. Dokumen */}
          <h4>1. Dokumen Persyaratan</h4>
          {canUpdate && (
            <div style={{ marginBottom: 8 }}>
              <button className="btn btn-sm btn-secondary" onClick={() => fileRef.current?.click()}>⬆️ Upload Dokumen</button>
              <input ref={fileRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc.mutate(f); e.target.value = '' }} />
            </div>
          )}
          {(reg.documents ?? []).length === 0 && <p style={{ color: 'var(--muted)' }}>Belum ada dokumen.</p>}
          {(reg.documents ?? []).map((d: Reg) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <a href={d.filePath} target="_blank" rel="noreferrer" style={{ color: 'var(--info)' }}>{d.fileName}</a>
              <span className={`pill ${d.isVerified ? 'pill-green' : 'pill-yellow'}`}>{d.isVerified ? 'Terverifikasi' : 'Belum'}</span>
              {canUpdate && (
                <button className="btn btn-sm btn-secondary"
                  onClick={() => verifyDoc.mutate({ documentId: d.id, isVerified: !d.isVerified })}>
                  {d.isVerified ? 'Batalkan' : 'Verifikasi'}
                </button>
              )}
            </div>
          ))}

          {/* 2. Scorecard */}
          <h4 style={{ marginTop: 18 }}>2. Digital Scorecard</h4>
          <div className="grid-2">
            <div className="form-group"><label>Nilai Tertulis</label><input className="input" type="number" value={score.writtenScore ?? ''} onChange={(e) => setScore({ ...score, writtenScore: e.target.value })} disabled={!canUpdate} /></div>
            <div className="form-group"><label>Nilai Wawancara</label><input className="input" type="number" value={score.interviewScore ?? ''} onChange={(e) => setScore({ ...score, interviewScore: e.target.value })} disabled={!canUpdate} /></div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label>Nilai Observasi</label><input className="input" type="number" value={score.behaviorScore ?? ''} onChange={(e) => setScore({ ...score, behaviorScore: e.target.value })} disabled={!canUpdate} /></div>
            <div className="form-group"><label>Rekomendasi</label><input className="input" value={score.recommendation ?? ''} onChange={(e) => setScore({ ...score, recommendation: e.target.value })} disabled={!canUpdate} /></div>
          </div>
          <div className="form-group"><label>Catatan Evaluator</label><textarea rows={2} value={score.evaluatorNote ?? ''} onChange={(e) => setScore({ ...score, evaluatorNote: e.target.value })} disabled={!canUpdate} /></div>
          {canUpdate && <button className="btn btn-sm btn-primary" onClick={() => saveScore.mutate()} disabled={saveScore.isPending}>Simpan Scorecard</button>}
          {(reg.scorecards ?? []).length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>{reg.scorecards.length} scorecard tersimpan.</p>
          )}

          {/* 3. Hasil seleksi */}
          {canUpdate && (
            <>
              <h4 style={{ marginTop: 18 }}>3. Hasil Seleksi</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-sm btn-primary" onClick={() => setResult.mutate('DITERIMA')}>Diterima</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setResult.mutate('CADANGAN')}>Cadangan</button>
                <button className="btn btn-sm btn-danger" onClick={() => setResult.mutate('TIDAK_DITERIMA')}>Tidak Diterima</button>
              </div>

              {/* 4. Sync */}
              <h4 style={{ marginTop: 18 }}>4. Sinkronisasi ke Data Siswa</h4>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>
                Hanya bisa untuk status <strong>DITERIMA</strong>. NIS akan dibuat otomatis.
              </p>
              <button className="btn btn-sm btn-primary" disabled={reg.status !== 'DITERIMA' || sync.isPending}
                onClick={() => sync.mutate()}>
                {sync.isPending ? 'Memproses…' : '🔄 Sinkronkan ke Siswa'}
              </button>
            </>
          )}

          {/* Log */}
          <h4 style={{ marginTop: 18 }}>Log Aktivitas</h4>
          {(logsQuery.data ?? []).length === 0 && <p style={{ color: 'var(--muted)' }}>Belum ada aktivitas.</p>}
          <ul style={{ fontSize: 12.5, color: 'var(--muted)', paddingLeft: 18 }}>
            {(logsQuery.data ?? []).map((l) => (
              <li key={l.id}>{new Date(l.createdAt).toLocaleString('id-ID')} — <strong>{l.activity}</strong> {l.detail ? `(${l.detail})` : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
