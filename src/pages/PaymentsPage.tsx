import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@heroui/react'
import { api, getErrorMessage, openPrivateFile } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { useAuth } from '../auth/AuthContext'
import { Button, Label, Link } from '@heroui/react'
import { ArrowUpFromLine, Check, Plus, Xmark } from '@gravity-ui/icons'
import {
  DataTable, FormGrid, FormStack, PageHeader, Panel, RowActions, SelectInput, StatusChip,
  TablePager, TextInput, Toolbar, type ChipColor,
} from '../components/ui'

type Row = Record<string, any>

const STATUS_COLOR: Record<string, ChipColor> = {
  MENUNGGU_VERIFIKASI: 'warning',
  LUNAS: 'success',
  DITOLAK: 'danger',
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
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const verifyMutation = useMutation({
    mutationFn: async (p: { id: string; approved: boolean }) =>
      api.post(`/payments/${p.id}/verify`, { approved: p.approved }),
    onSuccess: () => {
      toast.success('Verifikasi disimpan')
      qc.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const items = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  function submit() {
    if (!form.invoiceId) return toast.danger('Tagihan wajib dipilih')
    if (!form.amount) return toast.danger('Jumlah wajib diisi')
    createMutation.mutate()
  }

  return (
    <div>
      <PageHeader
        title="Pembayaran"
        actions={canCreate && <Button onPress={() => setCreateOpen(true)}><Plus />Catat Pembayaran</Button>}
      />

      <Panel>
        <Toolbar>
          <SelectInput
            ariaLabel="Filter status"
            className="w-full sm:w-60"
            emptyLabel="Semua Status"
            options={[
              { value: 'MENUNGGU_VERIFIKASI', label: 'Menunggu Verifikasi' },
              { value: 'LUNAS', label: 'Lunas' },
              { value: 'DITOLAK', label: 'Ditolak' },
            ]}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}
          />
        </Toolbar>
        <DataTable
          label="Daftar pembayaran"
          columns={[{ label: 'No. Tagihan' }, { label: 'Siswa' }, { label: 'Jumlah' }, { label: 'Metode' }, { label: 'Bukti' }, { label: 'Status' }, { label: 'Aksi', align: 'right' }]}
          rows={items}
          isLoading={listQuery.isLoading}
          emptyText="Belum ada pembayaran"
          renderRow={(r) => [
            r.invoice?.invoiceNumber ?? '-',
            r.invoice?.student?.fullName ?? '-',
            rupiah(r.amount),
            r.method ?? '-',
            r.hasProof ? <Link className="cursor-pointer" onPress={() => openPrivateFile(`/payments/${r.id}/proof-url`)}>Lihat</Link> : '-',
            <StatusChip color={STATUS_COLOR[r.status]}>{label(r.status)}</StatusChip>,
            canUpdate && r.status === 'MENUNGGU_VERIFIKASI' ? (
              <RowActions>
                <Button size="sm" onPress={() => verifyMutation.mutate({ id: r.id, approved: true })}><Check />Setujui</Button>
                <Button size="sm" variant="danger-soft" onPress={() => verifyMutation.mutate({ id: r.id, approved: false })}><Xmark />Tolak</Button>
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
        title="Catat Pembayaran"
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
          <SelectInput
            label="Tagihan"
            required
            value={form.invoiceId}
            options={(invoicesQuery.data ?? []).map((i) => ({
              value: i.id,
              label: `${i.invoiceNumber} — ${i.student?.fullName ?? ''} (${rupiah(i.amount)})`,
            }))}
            onChange={(v) => {
              const inv = (invoicesQuery.data ?? []).find((i) => i.id === v)
              setForm({ ...form, invoiceId: v, amount: form.amount ?? inv?.amount })
            }}
          />
          <FormGrid>
            <TextInput label="Jumlah Bayar (Rp)" type="number" required value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
            <TextInput label="Metode" placeholder="Transfer / Tunai" value={form.method} onChange={(v) => setForm({ ...form, method: v })} />
          </FormGrid>
          <div className="flex flex-col gap-1.5">
            <Label>Bukti Bayar (opsional)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="tertiary" onPress={() => fileRef.current?.click()}><ArrowUpFromLine />Pilih Berkas</Button>
              <span className="text-[13px] text-muted">{file ? file.name : 'Belum ada berkas'}</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </FormStack>
      </Modal>
    </div>
  )
}
