import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@heroui/react'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { useAuth } from '../auth/AuthContext'
import { Button } from '@heroui/react'
import { ArrowDownToLine, Check, Lock, PaperPlane, Plus } from '@gravity-ui/icons'
import {
  DataTable, FormGrid, FormStack, PageHeader, Panel, RowActions, SelectInput, StatusChip,
  TablePager, TextAreaInput, type ChipColor,
} from '../components/ui'

type Row = Record<string, any>

const STATUS_COLOR: Record<string, ChipColor> = {
  DRAFT: 'default',
  SUBMITTED: 'warning',
  LOCKED: 'info',
  APPROVED: 'success',
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
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const actionMutation = useMutation({
    mutationFn: async (p: { id: string; action: string }) => api.post(`/report-cards/${p.id}/${p.action}`),
    onSuccess: () => {
      toast.success('Status rapor diperbarui')
      qc.invalidateQueries({ queryKey: ['report-cards'] })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
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
      toast.danger(getErrorMessage(e))
    }
  }

  const items = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  function submit() {
    if (!form.studentId) return toast.danger('Siswa wajib dipilih')
    if (!form.semesterId) return toast.danger('Semester wajib dipilih')
    generateMutation.mutate()
  }

  return (
    <div>
      <PageHeader
        title="E-Rapor"
        actions={canCreate && <Button onPress={() => setGenOpen(true)}><Plus />Generate E-Rapor</Button>}
      />

      <Panel>
        <DataTable
          label="Daftar rapor"
          columns={[{ label: 'Siswa' }, { label: 'Kelas' }, { label: 'Rata-rata' }, { label: 'Status' }, { label: 'Aksi', align: 'right' }]}
          rows={items}
          isLoading={listQuery.isLoading}
          emptyText="Belum ada rapor"
          renderRow={(r) => [
            r.student?.fullName ?? '-',
            r.class?.name ?? '-',
            r.averageScore ?? '-',
            <StatusChip color={STATUS_COLOR[r.status]}>{r.status}</StatusChip>,
            <RowActions>
              <Button size="sm" variant="tertiary" onPress={() => downloadPdf(r)}><ArrowDownToLine />PDF</Button>
              {canUpdate && r.status === 'DRAFT' && (
                <Button size="sm" onPress={() => actionMutation.mutate({ id: r.id, action: 'submit' })}><PaperPlane />Submit</Button>
              )}
              {canUpdate && r.status === 'SUBMITTED' && (
                <Button size="sm" onPress={() => actionMutation.mutate({ id: r.id, action: 'lock' })}><Lock />Kunci</Button>
              )}
              {canUpdate && r.status === 'LOCKED' && (
                <Button size="sm" onPress={() => actionMutation.mutate({ id: r.id, action: 'approve' })}><Check />Setujui</Button>
              )}
            </RowActions>,
          ]}
        />
        <TablePager meta={meta} page={page} onChange={setPage} />
      </Panel>

      <Modal
        open={genOpen}
        title="Generate E-Rapor"
        onClose={() => setGenOpen(false)}
        footer={
          <>
            <Button variant="tertiary" onPress={() => setGenOpen(false)}>Batal</Button>
            <Button onPress={submit} isPending={generateMutation.isPending}>
              {generateMutation.isPending ? 'Memproses…' : 'Generate'}
            </Button>
          </>
        }
      >
        <FormStack>
          <p className="text-[13px] text-muted">
            Nilai siswa pada semester terpilih akan diakumulasikan menjadi rata-rata rapor.
          </p>
          <SelectInput label="Siswa" required value={form.studentId} onChange={(v) => setForm({ ...form, studentId: v })}
            options={(studentsQuery.data ?? []).map((s) => ({ value: s.id, label: s.fullName }))} />
          <FormGrid>
            <SelectInput label="Semester" required value={form.semesterId} onChange={(v) => setForm({ ...form, semesterId: v })}
              options={(semestersQuery.data ?? []).map((s) => ({ value: s.id, label: `${s.type} ${s.academicYear?.name ?? ''}` }))} />
            <SelectInput label="Kelas" value={form.classId} onChange={(v) => setForm({ ...form, classId: v })}
              options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
          </FormGrid>
          <TextAreaInput label="Catatan Sikap" rows={2} value={form.attitudeNote} onChange={(v) => setForm({ ...form, attitudeNote: v })} />
          <TextAreaInput label="Catatan Wali Kelas" rows={2} value={form.teacherNote} onChange={(v) => setForm({ ...form, teacherNote: v })} />
        </FormStack>
      </Modal>
    </div>
  )
}
