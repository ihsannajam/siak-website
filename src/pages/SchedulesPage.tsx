import { useState } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../auth/AuthContext'

type Row = Record<string, any>

const DAYS = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export function SchedulesPage() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [form, setForm] = useState<Row>({})

  const canCreate = hasPermission('schedules.create')
  const canUpdate = hasPermission('schedules.update')

  const listQuery = useQuery({
    queryKey: ['schedules'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Row[]>>('/schedules', { params: { limit: 50 } })
      return data.data
    },
  })

  // options for the create form
  const [ayQ, semQ] = useQueries({
    queries: [
      { queryKey: ['options', '/academic-years'], queryFn: async () => (await api.get<ApiResponse<Row[]>>('/academic-years', { params: { all: true } })).data.data },
      { queryKey: ['options', '/semesters'], queryFn: async () => (await api.get<ApiResponse<Row[]>>('/semesters', { params: { all: true } })).data.data },
    ],
  })

  const createMutation = useMutation({
    mutationFn: async (payload: Row) => api.post('/schedules', payload),
    onSuccess: () => {
      toast.success('Jadwal dibuat')
      setCreateOpen(false)
      setForm({})
      qc.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const items = listQuery.data ?? []

  return (
    <div>
      <div className="page-header">
        <h1>Jadwal Pelajaran</h1>
        {canCreate && <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>+ Buat Jadwal</button>}
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr><th>Nama Jadwal</th><th>Status</th><th>Dipublikasi</th><th style={{ textAlign: 'right' }}>Aksi</th></tr>
            </thead>
            <tbody>
              {listQuery.isLoading && <tr><td colSpan={4} className="empty">Memuat…</td></tr>}
              {!listQuery.isLoading && items.length === 0 && <tr><td colSpan={4} className="empty">Belum ada jadwal</td></tr>}
              {items.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td><span className={`pill ${s.status === 'PUBLISHED' ? 'pill-green' : 'pill-gray'}`}>{s.status}</span></td>
                  <td>{s.publishedAt ? new Date(s.publishedAt).toLocaleDateString('id-ID') : '-'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => setDetailId(s.id)}>Kelola Slot</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={createOpen} title="Buat Jadwal" onClose={() => setCreateOpen(false)}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Batal</button>
          <button className="btn btn-primary" disabled={createMutation.isPending}
            onClick={() => {
              if (!form.name || !form.academicYearId || !form.semesterId) return toast.error('Lengkapi semua field')
              createMutation.mutate(form)
            }}>Simpan</button>
        </>}>
        <div className="form-group"><label>Nama Jadwal <span className="req">*</span></label>
          <input className="input" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jadwal Ganjil 2025/2026" /></div>
        <div className="form-group"><label>Tahun Ajaran <span className="req">*</span></label>
          <select className="select" value={form.academicYearId ?? ''} onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}>
            <option value="">— Pilih —</option>
            {(ayQ.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></div>
        <div className="form-group"><label>Semester <span className="req">*</span></label>
          <select className="select" value={form.semesterId ?? ''} onChange={(e) => setForm({ ...form, semesterId: e.target.value })}>
            <option value="">— Pilih —</option>
            {(semQ.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.type} — {s.academicYear?.name ?? ''}</option>)}
          </select></div>
      </Modal>

      {detailId && <ScheduleDetail id={detailId} canUpdate={canUpdate} onClose={() => setDetailId(null)} />}
    </div>
  )
}

function ScheduleDetail({ id, canUpdate, onClose }: { id: string; canUpdate: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const empty = { dayOfWeek: 1, startTime: '07:00', endTime: '08:00' }
  const [slot, setSlot] = useState<Row>(empty)
  const [conflicts, setConflicts] = useState<string[] | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const detailQuery = useQuery({
    queryKey: ['schedules', id],
    queryFn: async () => (await api.get<ApiResponse<Row>>(`/schedules/${id}`)).data.data,
  })

  const [subjQ, classQ, roomQ, teacherQ] = useQueries({
    queries: [
      { queryKey: ['options', '/subjects'], queryFn: async () => (await api.get<ApiResponse<Row[]>>('/subjects', { params: { all: true } })).data.data },
      { queryKey: ['options', '/classes'], queryFn: async () => (await api.get<ApiResponse<Row[]>>('/classes', { params: { all: true } })).data.data },
      { queryKey: ['options', '/classrooms'], queryFn: async () => (await api.get<ApiResponse<Row[]>>('/classrooms', { params: { all: true } })).data.data },
      { queryKey: ['options', '/employees'], queryFn: async () => (await api.get<ApiResponse<Row[]>>('/employees', { params: { all: true } })).data.data },
    ],
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['schedules', id] })
    qc.invalidateQueries({ queryKey: ['schedules'] })
  }

  const payload = () => ({
    dayOfWeek: Number(slot.dayOfWeek),
    startTime: slot.startTime,
    endTime: slot.endTime,
    subjectId: slot.subjectId || null,
    teacherId: slot.teacherId || null,
    classId: slot.classId || null,
    classroomId: slot.classroomId || null,
    activityType: slot.activityType || null,
  })

  const checkConflict = useMutation({
    mutationFn: async () => (await api.post<ApiResponse<{ hasConflict: boolean; conflicts: string[] }>>(`/schedules/${id}/check-conflict`, payload())).data.data,
    onSuccess: (res) => {
      setConflicts(res.conflicts)
      toast[res.hasConflict ? 'error' : 'success'](res.hasConflict ? 'Ada bentrok!' : 'Tidak ada bentrok')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const addSlot = useMutation({
    mutationFn: async () => api.post(`/schedules/${id}/details`, payload()),
    onSuccess: () => { toast.success('Slot ditambahkan'); setSlot(empty); setConflicts(null); refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const delSlot = useMutation({
    mutationFn: async (detailId: string) => api.delete(`/schedules/details/${detailId}`),
    onSuccess: () => { toast.success('Slot dihapus'); setDeleteId(null); refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const publish = useMutation({
    mutationFn: async () => api.post(`/schedules/${id}/publish`),
    onSuccess: () => { toast.success('Jadwal dipublikasikan'); refresh() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const sch = detailQuery.data
  const details: Row[] = sch?.details ?? []
  const nameOf = (arr: Row[] | undefined, idv: string, key = 'name') => arr?.find((x) => x.id === idv)?.[key] ?? '-'

  return (
    <Modal open title={`Kelola Slot${sch ? ` — ${sch.name}` : ''}`} onClose={onClose}
      footer={<button className="btn btn-secondary" onClick={onClose}>Tutup</button>}>
      {!sch ? <p>Memuat…</p> : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className={`pill ${sch.status === 'PUBLISHED' ? 'pill-green' : 'pill-gray'}`}>{sch.status}</span>
            {canUpdate && sch.status !== 'PUBLISHED' && (
              <button className="btn btn-sm btn-primary" onClick={() => publish.mutate()} disabled={publish.isPending}>📢 Publikasikan</button>
            )}
          </div>

          {/* Slot list grouped by day */}
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const dayItems = details.filter((d) => d.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime))
            if (dayItems.length === 0) return null
            return (
              <div key={day} style={{ marginBottom: 10 }}>
                <strong style={{ fontSize: 13 }}>{DAYS[day]}</strong>
                {dayItems.map((d) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ minWidth: 90 }}>{d.startTime}–{d.endTime}</span>
                    <span style={{ flex: 1 }}>
                      {d.subject?.name ?? d.activityType ?? 'Kegiatan'}
                      {d.class?.name ? ` · ${d.class.name}` : ''}
                      {d.classroom?.name ? ` · ${d.classroom.name}` : ''}
                    </span>
                    {canUpdate && <button className="btn btn-sm btn-danger" onClick={() => setDeleteId(d.id)}>✕</button>}
                  </div>
                ))}
              </div>
            )
          })}
          {details.length === 0 && <p style={{ color: 'var(--muted)' }}>Belum ada slot.</p>}

          {/* Add slot form */}
          {canUpdate && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '2px solid var(--border)' }}>
              <h4 style={{ marginTop: 0 }}>Tambah Slot</h4>
              <div className="grid-2">
                <div className="form-group"><label>Hari</label>
                  <select className="select" value={slot.dayOfWeek} onChange={(e) => setSlot({ ...slot, dayOfWeek: e.target.value })}>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}
                  </select></div>
                <div className="form-group"><label>Tipe Kegiatan</label>
                  <select className="select" value={slot.activityType ?? ''} onChange={(e) => setSlot({ ...slot, activityType: e.target.value })}>
                    <option value="">Mapel</option>
                    <option value="TAHFIDZ_PAGI">Tahfidz Pagi</option>
                    <option value="SHALAT">Shalat Berjamaah</option>
                    <option value="HALAQAH">Halaqah</option>
                  </select></div>
              </div>
              <div className="grid-2">
                <div className="form-group"><label>Jam Mulai</label><input className="input" type="time" value={slot.startTime} onChange={(e) => setSlot({ ...slot, startTime: e.target.value })} /></div>
                <div className="form-group"><label>Jam Selesai</label><input className="input" type="time" value={slot.endTime} onChange={(e) => setSlot({ ...slot, endTime: e.target.value })} /></div>
              </div>
              <div className="grid-2">
                <div className="form-group"><label>Mata Pelajaran</label>
                  <select className="select" value={slot.subjectId ?? ''} onChange={(e) => setSlot({ ...slot, subjectId: e.target.value })}>
                    <option value="">—</option>
                    {(subjQ.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></div>
                <div className="form-group"><label>Guru</label>
                  <select className="select" value={slot.teacherId ?? ''} onChange={(e) => setSlot({ ...slot, teacherId: e.target.value })}>
                    <option value="">—</option>
                    {(teacherQ.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                  </select></div>
              </div>
              <div className="grid-2">
                <div className="form-group"><label>Kelas</label>
                  <select className="select" value={slot.classId ?? ''} onChange={(e) => setSlot({ ...slot, classId: e.target.value })}>
                    <option value="">—</option>
                    {(classQ.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select></div>
                <div className="form-group"><label>Ruangan</label>
                  <select className="select" value={slot.classroomId ?? ''} onChange={(e) => setSlot({ ...slot, classroomId: e.target.value })}>
                    <option value="">—</option>
                    {(roomQ.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select></div>
              </div>

              {conflicts && conflicts.length > 0 && (
                <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
                  ⚠️ {conflicts.join(', ')}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-secondary" onClick={() => checkConflict.mutate()} disabled={checkConflict.isPending}>Cek Bentrok</button>
                <button className="btn btn-sm btn-primary" onClick={() => addSlot.mutate()} disabled={addSlot.isPending}>+ Tambah Slot</button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                Sistem menolak slot jika guru/ruangan/kelas bentrok di waktu yang sama (lihat data terkait: {nameOf(teacherQ.data, slot.teacherId)}).
              </p>
            </div>
          )}

          <ConfirmDialog open={!!deleteId} message="Hapus slot ini?"
            onCancel={() => setDeleteId(null)}
            onConfirm={() => deleteId && delSlot.mutate(deleteId)}
            loading={delSlot.isPending} />
        </div>
      )}
    </Modal>
  )
}
