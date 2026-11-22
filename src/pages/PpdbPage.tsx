import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@heroui/react'
import { api, getErrorMessage, openPrivateFile } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { useAuth } from '../auth/AuthContext'
import { Alert, Button, Link, Separator } from '@heroui/react'
import { ArrowsRotateRight, ArrowUpFromLine, Check, Plus, Xmark } from '@gravity-ui/icons'
import {
  DataTable, FormGrid, FormStack, Loader, PageHeader, Panel, RowActions, SearchBox, SectionTitle,
  SelectInput, StatusChip, TablePager, TextAreaInput, TextInput, Toolbar, type ChipColor,
} from '../components/ui'

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

const STATUS_COLOR: Record<string, ChipColor> = {
  DITERIMA: 'success',
  CADANGAN: 'warning',
  TIDAK_DITERIMA: 'danger',
  TERVERIFIKASI: 'info',
  BERKAS_TIDAK_LENGKAP: 'danger',
}
const GENDER_OPTIONS = [{ value: 'LAKI_LAKI', label: 'Laki-laki' }, { value: 'PEREMPUAN', label: 'Perempuan' }]

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
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const items = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  const bind = (name: string) => ({
    value: form[name],
    onChange: (v: string) => setForm({ ...form, [name]: v }),
  })

  return (
    <div>
      <PageHeader
        title="PPDB — Penerimaan Peserta Didik Baru"
        actions={canCreate && <Button onPress={() => setCreateOpen(true)}><Plus />Tambah Pendaftar</Button>}
      />

      <Panel>
        <Toolbar>
          <SearchBox placeholder="Cari nama / no. pendaftaran…" value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
          <SelectInput
            ariaLabel="Filter status"
            className="w-full sm:w-60"
            emptyLabel="Semua Status"
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: label(s) }))}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}
          />
        </Toolbar>
        <DataTable
          label="Pendaftar PPDB"
          columns={[{ label: 'No. Pendaftaran' }, { label: 'Nama' }, { label: 'JK' }, { label: 'Status' }, { label: 'Aksi', align: 'right' }]}
          rows={items}
          isLoading={listQuery.isLoading}
          emptyText="Belum ada pendaftar"
          renderRow={(r) => [
            r.registrationNumber,
            r.fullName,
            r.gender === 'PEREMPUAN' ? 'P' : 'L',
            <StatusChip color={STATUS_COLOR[r.status]}>{label(r.status)}</StatusChip>,
            <RowActions><Button size="sm" variant="tertiary" onPress={() => setDetailId(r.id)}>Kelola</Button></RowActions>,
          ]}
        />
        <TablePager meta={meta} page={page} onChange={setPage} />
      </Panel>

      <Modal
        open={createOpen}
        title="Tambah Pendaftar PPDB"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="tertiary" onPress={() => setCreateOpen(false)}>Batal</Button>
            <Button
              isPending={createMutation.isPending}
              onPress={() => { if (!form.fullName) return toast.danger('Nama wajib diisi'); createMutation.mutate(form) }}
            >
              {createMutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </>
        }
      >
        <FormStack>
          <TextInput label="Nama Lengkap" required {...bind('fullName')} />
          <FormGrid>
            <TextInput label="Tempat Lahir" {...bind('birthPlace')} />
            <TextInput label="Tanggal Lahir" type="date" {...bind('birthDate')} />
          </FormGrid>
          <SelectInput label="Jenis Kelamin" noEmpty options={GENDER_OPTIONS} {...bind('gender')} />
          <TextAreaInput label="Alamat" rows={2} {...bind('address')} />
          <FormGrid>
            <TextInput label="Nama Ayah" {...bind('fatherName')} />
            <TextInput label="Nama Ibu" {...bind('motherName')} />
            <TextInput label="Nama Wali" {...bind('guardianName')} />
            <TextInput label="No. HP Wali" {...bind('guardianPhone')} />
          </FormGrid>
        </FormStack>
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
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const uploadDoc = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('docType', 'PERSYARATAN')
      return api.post(`/ppdb/${id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => { toast.success('Dokumen diunggah'); refresh() },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const verifyDoc = useMutation({
    mutationFn: async (p: { documentId: string; isVerified: boolean }) => api.post(`/ppdb/${id}/verify-document`, p),
    onSuccess: () => { toast.success('Verifikasi diperbarui'); refresh() },
    onError: (e) => toast.danger(getErrorMessage(e)),
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
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const sync = useMutation({
    mutationFn: async () => api.post(`/ppdb/${id}/sync-to-student`),
    onSuccess: (res) => { toast.success(`Disinkronkan ke data siswa (NIS ${res.data.data.nis})`); refresh() },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const reg = detailQuery.data

  const bindScore = (name: string) => ({
    value: score[name],
    disabled: !canUpdate,
    onChange: (v: string) => setScore({ ...score, [name]: v }),
  })

  return (
    <Modal open title={`Kelola Pendaftar${reg ? ` — ${reg.fullName}` : ''}`} onClose={onClose}
      footer={<Button variant="tertiary" onPress={onClose}>Tutup</Button>}>
      {!reg ? (
        <Loader />
      ) : (
        <FormStack>
          <div className="flex flex-wrap gap-2">
            <StatusChip>{reg.registrationNumber}</StatusChip>
            <StatusChip color={STATUS_COLOR[reg.status]}>{label(reg.status)}</StatusChip>
          </div>

          <SectionTitle>1. Dokumen Persyaratan</SectionTitle>
          {canUpdate && (
            <div>
              <Button size="sm" variant="tertiary" isPending={uploadDoc.isPending} onPress={() => fileRef.current?.click()}>
                <ArrowUpFromLine />Upload Dokumen
              </Button>
              <input ref={fileRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc.mutate(f); e.target.value = '' }} />
            </div>
          )}
          {(reg.documents ?? []).length === 0 && <p className="text-muted">Belum ada dokumen.</p>}
          {(reg.documents ?? []).map((d: Reg) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2">
              {canUpdate
                ? <Link className="cursor-pointer" onPress={() => openPrivateFile(`/ppdb/${id}/documents/${d.id}/url`)}>{d.fileName}</Link>
                : <span>{d.fileName}</span>}
              <StatusChip color={d.isVerified ? 'success' : 'warning'}>{d.isVerified ? 'Terverifikasi' : 'Belum'}</StatusChip>
              {canUpdate && (
                <Button size="sm" variant="ghost" onPress={() => verifyDoc.mutate({ documentId: d.id, isVerified: !d.isVerified })}>
                  {d.isVerified ? 'Batalkan' : 'Verifikasi'}
                </Button>
              )}
            </div>
          ))}

          <Separator />
          <SectionTitle>2. Digital Scorecard</SectionTitle>
          <FormGrid>
            <TextInput label="Nilai Tertulis" type="number" {...bindScore('writtenScore')} />
            <TextInput label="Nilai Wawancara" type="number" {...bindScore('interviewScore')} />
            <TextInput label="Nilai Observasi" type="number" {...bindScore('behaviorScore')} />
            <TextInput label="Rekomendasi" {...bindScore('recommendation')} />
          </FormGrid>
          <TextAreaInput label="Catatan Evaluator" rows={2} {...bindScore('evaluatorNote')} />
          {canUpdate && (
            <div><Button size="sm" onPress={() => saveScore.mutate()} isPending={saveScore.isPending}>Simpan Scorecard</Button></div>
          )}
          {(reg.scorecards ?? []).length > 0 && (
            <p className="text-xs text-muted">{reg.scorecards.length} scorecard tersimpan.</p>
          )}

          {canUpdate && (
            <>
              <Separator />
              <SectionTitle>3. Hasil Seleksi</SectionTitle>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onPress={() => setResult.mutate('DITERIMA')}><Check />Diterima</Button>
                <Button size="sm" variant="tertiary" onPress={() => setResult.mutate('CADANGAN')}>Cadangan</Button>
                <Button size="sm" variant="danger" onPress={() => setResult.mutate('TIDAK_DITERIMA')}><Xmark />Tidak Diterima</Button>
              </div>

              <Separator />
              <SectionTitle>4. Sinkronisasi ke Data Siswa</SectionTitle>
              <Alert status="accent">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>Hanya bisa untuk status <strong>DITERIMA</strong>. NIS akan dibuat otomatis.</Alert.Description>
                </Alert.Content>
              </Alert>
              <div>
                <Button size="sm" isDisabled={reg.status !== 'DITERIMA'} isPending={sync.isPending} onPress={() => sync.mutate()}>
                  <ArrowsRotateRight />{sync.isPending ? 'Memproses…' : 'Sinkronkan ke Siswa'}
                </Button>
              </div>
            </>
          )}

          <Separator />
          <SectionTitle>Log Aktivitas</SectionTitle>
          {(logsQuery.data ?? []).length === 0 && <p className="text-muted">Belum ada aktivitas.</p>}
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[12.5px] text-muted">
            {(logsQuery.data ?? []).map((l) => (
              <li key={l.id}>{new Date(l.createdAt).toLocaleString('id-ID')} — <strong>{l.activity}</strong> {l.detail ? `(${l.detail})` : ''}</li>
            ))}
          </ul>
        </FormStack>
      )}
    </Modal>
  )
}
