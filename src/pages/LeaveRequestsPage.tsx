import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@heroui/react'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { useAuth } from '../auth/AuthContext'
import { Button } from '@heroui/react'
import { Check, Plus, Xmark } from '@gravity-ui/icons'
import {
  DataTable, FormGrid, FormStack, PageHeader, Panel, RowActions, SelectInput, StatusChip,
  TablePager, TextAreaInput, TextInput, Toolbar, type ChipColor,
} from '../components/ui'

type Row = Record<string, any>

const TYPE_LABEL: Record<string, string> = { IZIN: 'Izin', CUTI: 'Cuti', SAKIT: 'Sakit' }
const STATUS_COLOR: Record<string, ChipColor> = {
  DIAJUKAN: 'warning',
  DISETUJUI: 'success',
  DITOLAK: 'danger',
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
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const decisionMutation = useMutation({
    mutationFn: async (p: { id: string; status: string }) =>
      api.post(`/leave-requests/${p.id}/decision`, { status: p.status }),
    onSuccess: () => {
      toast.success('Keputusan disimpan')
      qc.invalidateQueries({ queryKey: ['leave-requests'] })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const items = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  function submit() {
    if (!form.employeeId) return toast.danger('Pegawai wajib dipilih')
    if (!form.startDate || !form.endDate) return toast.danger('Tanggal wajib diisi')
    createMutation.mutate(form)
  }

  return (
    <div>
      <PageHeader
        title="Cuti / Izin"
        actions={canCreate && <Button onPress={() => setCreateOpen(true)}><Plus />Ajukan Izin/Cuti</Button>}
      />

      <Panel>
        <Toolbar>
          <SelectInput
            ariaLabel="Filter status"
            className="w-full sm:w-56"
            emptyLabel="Semua Status"
            options={[
              { value: 'DIAJUKAN', label: 'Diajukan' },
              { value: 'DISETUJUI', label: 'Disetujui' },
              { value: 'DITOLAK', label: 'Ditolak' },
            ]}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}
          />
        </Toolbar>
        <DataTable
          label="Daftar pengajuan"
          columns={[{ label: 'Pegawai' }, { label: 'Jenis' }, { label: 'Mulai' }, { label: 'Selesai' }, { label: 'Alasan' }, { label: 'Status' }, { label: 'Aksi', align: 'right' }]}
          rows={items}
          isLoading={listQuery.isLoading}
          emptyText="Belum ada pengajuan"
          renderRow={(r) => [
            r.employee?.fullName ?? '-',
            TYPE_LABEL[r.type] ?? r.type,
            fmtDate(r.startDate),
            fmtDate(r.endDate),
            r.reason ?? '-',
            <StatusChip color={STATUS_COLOR[r.status]}>{r.status}</StatusChip>,
            canUpdate && r.status === 'DIAJUKAN' ? (
              <RowActions>
                <Button size="sm" onPress={() => decisionMutation.mutate({ id: r.id, status: 'DISETUJUI' })}><Check />Setujui</Button>
                <Button size="sm" variant="danger-soft" onPress={() => decisionMutation.mutate({ id: r.id, status: 'DITOLAK' })}><Xmark />Tolak</Button>
              </RowActions>
            ) : (
              <span className="text-xs text-muted">—</span>
            ),
          ]}
        />
        <TablePager meta={meta} page={page} onChange={setPage} />
      </Panel>

      <Modal
        open={createOpen}
        title="Ajukan Izin / Cuti"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="tertiary" onPress={() => setCreateOpen(false)}>Batal</Button>
            <Button onPress={submit} isPending={createMutation.isPending}>
              {createMutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </>
        }
      >
        <FormStack>
          <SelectInput label="Pegawai" required value={form.employeeId} onChange={(v) => setForm({ ...form, employeeId: v })}
            options={(employeesQuery.data ?? []).map((e) => ({ value: e.id, label: e.fullName }))} />
          <SelectInput label="Jenis" noEmpty value={form.type} onChange={(v) => setForm({ ...form, type: v })}
            options={[{ value: 'IZIN', label: 'Izin' }, { value: 'CUTI', label: 'Cuti' }, { value: 'SAKIT', label: 'Sakit' }]} />
          <FormGrid>
            <TextInput label="Tanggal Mulai" type="date" required value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
            <TextInput label="Tanggal Selesai" type="date" required value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} />
          </FormGrid>
          <TextAreaInput label="Alasan" value={form.reason} onChange={(v) => setForm({ ...form, reason: v })} />
        </FormStack>
      </Modal>
    </div>
  )
}
