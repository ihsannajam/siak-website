import { useState } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@heroui/react'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../auth/AuthContext'
import { Alert, Button, Separator } from '@heroui/react'
import { Megaphone, Plus, TrashBin } from '@gravity-ui/icons'
import {
  DataTable, FormGrid, FormStack, IconAction, Loader, PageHeader, Panel, RowActions, SectionTitle,
  SelectInput, StatusChip, TextInput,
} from '../components/ui'

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
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const items = listQuery.data ?? []

  return (
    <div>
      <PageHeader
        title="Jadwal Pelajaran"
        actions={canCreate && <Button onPress={() => setCreateOpen(true)}><Plus />Buat Jadwal</Button>}
      />

      <Panel>
        <DataTable
          label="Daftar jadwal"
          columns={[{ label: 'Nama Jadwal' }, { label: 'Status' }, { label: 'Dipublikasi' }, { label: 'Aksi', align: 'right' }]}
          rows={items}
          isLoading={listQuery.isLoading}
          emptyText="Belum ada jadwal"
          renderRow={(s) => [
            s.name,
            <StatusChip color={s.status === 'PUBLISHED' ? 'success' : 'default'}>{s.status}</StatusChip>,
            s.publishedAt ? new Date(s.publishedAt).toLocaleDateString('id-ID') : '-',
            <RowActions><Button size="sm" variant="tertiary" onPress={() => setDetailId(s.id)}>Kelola Slot</Button></RowActions>,
          ]}
        />
      </Panel>

      <Modal open={createOpen} title="Buat Jadwal" onClose={() => setCreateOpen(false)}
        footer={<>
          <Button variant="tertiary" onPress={() => setCreateOpen(false)}>Batal</Button>
          <Button isPending={createMutation.isPending}
            onPress={() => {
              if (!form.name || !form.academicYearId || !form.semesterId) return toast.danger('Lengkapi semua field')
              createMutation.mutate(form)
            }}>Simpan</Button>
        </>}>
        <FormStack>
          <TextInput label="Nama Jadwal" required placeholder="Jadwal Ganjil 2025/2026" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <SelectInput label="Tahun Ajaran" required value={form.academicYearId} onChange={(v) => setForm({ ...form, academicYearId: v })}
            options={(ayQ.data ?? []).map((a) => ({ value: a.id, label: a.name }))} />
          <SelectInput label="Semester" required value={form.semesterId} onChange={(v) => setForm({ ...form, semesterId: v })}
            options={(semQ.data ?? []).map((s) => ({ value: s.id, label: `${s.type} — ${s.academicYear?.name ?? ''}` }))} />
        </FormStack>
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
      toast[res.hasConflict ? 'danger' : 'success'](res.hasConflict ? 'Ada bentrok!' : 'Tidak ada bentrok')
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const addSlot = useMutation({
    mutationFn: async () => api.post(`/schedules/${id}/details`, payload()),
    onSuccess: () => { toast.success('Slot ditambahkan'); setSlot(empty); setConflicts(null); refresh() },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const delSlot = useMutation({
    mutationFn: async (detailId: string) => api.delete(`/schedules/details/${detailId}`),
    onSuccess: () => { toast.success('Slot dihapus'); setDeleteId(null); refresh() },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const publish = useMutation({
    mutationFn: async () => api.post(`/schedules/${id}/publish`),
    onSuccess: () => { toast.success('Jadwal dipublikasikan'); refresh() },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const sch = detailQuery.data
  const details: Row[] = sch?.details ?? []
  const nameOf = (arr: Row[] | undefined, idv: string, key = 'name') => arr?.find((x) => x.id === idv)?.[key] ?? '-'

  const bindSlot = (name: string) => ({
    value: slot[name],
    onChange: (v: string) => setSlot({ ...slot, [name]: v }),
  })
  const toOptions = (rows: Row[] | undefined, key = 'name') => (rows ?? []).map((r) => ({ value: r.id, label: r[key] }))

  return (
    <Modal open title={`Kelola Slot${sch ? ` — ${sch.name}` : ''}`} onClose={onClose}
      footer={<Button variant="tertiary" onPress={onClose}>Tutup</Button>}>
      {!sch ? <Loader /> : (
        <FormStack>
          <div className="flex items-center justify-between">
            <StatusChip color={sch.status === 'PUBLISHED' ? 'success' : 'default'}>{sch.status}</StatusChip>
            {canUpdate && sch.status !== 'PUBLISHED' && (
              <Button size="sm" onPress={() => publish.mutate()} isPending={publish.isPending}><Megaphone />Publikasikan</Button>
            )}
          </div>

          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const dayItems = details.filter((d) => d.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime))
            if (dayItems.length === 0) return null
            return (
              <div key={day}>
                <SectionTitle>{DAYS[day]}</SectionTitle>
                {dayItems.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 border-b border-separator py-1.5 text-[13px]">
                    <span className="min-w-24 tabular-nums">{d.startTime}–{d.endTime}</span>
                    <span className="flex-1">
                      {d.subject?.name ?? d.activityType ?? 'Kegiatan'}
                      {d.class?.name ? ` · ${d.class.name}` : ''}
                      {d.classroom?.name ? ` · ${d.classroom.name}` : ''}
                    </span>
                    {canUpdate && <IconAction danger label="Hapus slot" icon={<TrashBin />} onPress={() => setDeleteId(d.id)} />}
                  </div>
                ))}
              </div>
            )
          })}
          {details.length === 0 && <p className="text-muted">Belum ada slot.</p>}

          {canUpdate && (
            <>
              <Separator />
              <SectionTitle>Tambah Slot</SectionTitle>
              <FormGrid>
                <SelectInput label="Hari" noEmpty options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: DAYS[d] }))} {...bindSlot('dayOfWeek')} />
                <SelectInput label="Tipe Kegiatan" emptyLabel="Mapel" {...bindSlot('activityType')}
                  options={[{ value: 'TAHFIDZ_PAGI', label: 'Tahfidz Pagi' }, { value: 'SHALAT', label: 'Shalat Berjamaah' }, { value: 'HALAQAH', label: 'Halaqah' }]} />
                <TextInput label="Jam Mulai" type="time" {...bindSlot('startTime')} />
                <TextInput label="Jam Selesai" type="time" {...bindSlot('endTime')} />
                <SelectInput label="Mata Pelajaran" emptyLabel="—" options={toOptions(subjQ.data)} {...bindSlot('subjectId')} />
                <SelectInput label="Guru" emptyLabel="—" options={toOptions(teacherQ.data, 'fullName')} {...bindSlot('teacherId')} />
                <SelectInput label="Kelas" emptyLabel="—" options={toOptions(classQ.data)} {...bindSlot('classId')} />
                <SelectInput label="Ruangan" emptyLabel="—" options={toOptions(roomQ.data)} {...bindSlot('classroomId')} />
              </FormGrid>

              {conflicts && conflicts.length > 0 && (
                <Alert status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>Jadwal bentrok</Alert.Title>
                    <Alert.Description>{conflicts.join(', ')}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button size="sm" variant="tertiary" onPress={() => checkConflict.mutate()} isPending={checkConflict.isPending}>Cek Bentrok</Button>
                <Button size="sm" onPress={() => addSlot.mutate()} isPending={addSlot.isPending}><Plus />Tambah Slot</Button>
              </div>
              <p className="text-xs text-muted">
                Sistem menolak slot jika guru/ruangan/kelas bentrok di waktu yang sama (lihat data terkait: {nameOf(teacherQ.data, slot.teacherId, 'fullName')}).
              </p>
            </>
          )}

          <ConfirmDialog open={!!deleteId} message="Hapus slot ini?"
            onCancel={() => setDeleteId(null)}
            onConfirm={() => deleteId && delSlot.mutate(deleteId)}
            loading={delSlot.isPending} />
        </FormStack>
      )}
    </Modal>
  )
}
