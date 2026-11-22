import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Avatar, Button, Card, Link, Tabs, toast } from '@heroui/react'
import { ArrowLeft, ArrowUpFromLine, Plus, TrashBin } from '@gravity-ui/icons'
import { api, getErrorMessage, openPrivateFile } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { useAuth } from '../auth/AuthContext'
import {
  ALL_EMPLOYEE_FIELDS, ASSIGNMENT_FIELDS, DAY_LABEL, EDUCATION_FIELDS, EMPLOYEE_DOCUMENTS, EMPLOYMENT_FIELDS,
  IDENTITY_FIELDS, TRAINING_FIELDS, serviceLength, type EmployeeField,
} from '../config/employeeFields'
import {
  DataTable, IconAction, Loader, PageHeader, SectionTitle, SelectInput, StatusChip, TextAreaInput, TextInput,
} from '../components/ui'

type Row = Record<string, any>
type Values = Record<string, string>
type Training = Values & { clientKey: string }

let trainingCounter = 0
const newTrainingKey = () => `t-${++trainingCounter}`

function toValues(source: Row | null | undefined, fields: EmployeeField[]): Values {
  return Object.fromEntries(fields.map((f) => {
    const value = source?.[f.name]
    return [f.name, value == null ? '' : f.type === 'date' ? String(value).slice(0, 10) : String(value)]
  }))
}

const toForm = (employee?: Row): Values => ({
  ...toValues(employee, ALL_EMPLOYEE_FIELDS),
  employmentStatus: employee?.employmentStatus ?? 'HONORER',
  activeStatus: employee?.activeStatus ?? 'AKTIF',
})

const toTrainings = (employee?: Row): Training[] =>
  (employee?.trainings ?? []).map((t: Row) => ({ ...toValues(t, TRAINING_FIELDS), id: t.id, clientKey: t.id }))

function fieldError(f: EmployeeField, raw: string): string | undefined {
  const v = (raw ?? '').trim()
  if (f.required && !v) return `${f.label} wajib diisi`
  if (!v) return undefined
  if (f.type === 'nik' && !/^\d{16}$/.test(v)) return 'NIK harus 16 digit angka'
  if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Format email tidak valid'
  if (f.type === 'year' && !(/^\d{4}$/.test(v) && Number(v) >= 1900 && Number(v) <= 2100)) return 'Tahun tidak valid'
  return undefined
}

function FieldInput({ field, value, error, disabled, onChange }: {
  field: EmployeeField
  value: string
  error?: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const common = { label: field.label, value, required: field.required, disabled, error, onChange }
  const wrapper = field.wide ? 'sm:col-span-2 lg:col-span-3' : ''
  if (field.type === 'textarea') return <div className={wrapper}><TextAreaInput {...common} rows={3} /></div>
  if (field.type === 'select') {
    // Nilai lama di luar daftar tetap tampil supaya tidak hilang saat disimpan.
    const base = field.options ?? []
    const options = value && !base.some((o) => o.value === value) ? [...base, { value, label: value }] : base
    return <div className={wrapper}><SelectInput {...common} options={options} noEmpty={field.noEmpty} /></div>
  }
  const type = field.type === 'date' || field.type === 'email' ? field.type : 'text'
  return <div className={wrapper}><TextInput {...common} type={type} /></div>
}

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid gap-4 p-1 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
)

function Summary({ items }: { items: [string, string | number][] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function AssignmentPanel({ assignments }: { assignments?: Row }) {
  if (!assignments) {
    return <p className="p-1 text-[13px] text-muted">Penugasan tampil setelah data pegawai disimpan.</p>
  }
  const list = (values: string[]) => values.join(', ') || '-'
  return (
    <Card variant="secondary" className="mt-5 gap-4 p-4">
      <div>
        <SectionTitle>Penugasan saat ini</SectionTitle>
        <p className="mt-0.5 text-[13px] text-muted">Terisi otomatis dari Mapping Guru-Mapel, Rombel, dan jadwal terbit semester aktif.</p>
      </div>
      <Summary items={[
        ['Mata Pelajaran yang Diampu', list(assignments.subjects)],
        ['Kelas yang Diajar', list(assignments.classes)],
        ['Status Wali Kelas', assignments.homeroomClasses.length ? `Wali kelas ${list(assignments.homeroomClasses)}` : 'Bukan wali kelas'],
        ['Jumlah Jam Mengajar', `${assignments.teachingHoursPerWeek} jam/minggu`],
      ]} />
      <div>
        <SectionTitle>Jadwal Mengajar</SectionTitle>
        <div className="mt-2">
          <DataTable
            label="Jadwal mengajar"
            columns={[{ label: 'Hari' }, { label: 'Jam' }, { label: 'Mapel' }, { label: 'Kelas' }, { label: 'Ruang', hideOnMobile: true }]}
            rows={assignments.schedule}
            emptyText="Belum ada jadwal terbit"
            renderRow={(s: Row) => [
              DAY_LABEL[s.dayOfWeek] ?? '-', `${s.startTime}–${s.endTime}`, s.subject ?? '-', s.className ?? '-', s.classroom ?? '-',
            ]}
          />
        </div>
      </div>
    </Card>
  )
}

function DocumentsPanel({ employeeId, canEdit }: { employeeId?: string; canEdit: boolean }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [activeType, setActiveType] = useState(EMPLOYEE_DOCUMENTS[0].value)
  const docs = useQuery({
    queryKey: ['employee-docs', employeeId],
    enabled: !!employeeId && canEdit,
    queryFn: async () => (await api.get<ApiResponse<Row[]>>(`/employees/${employeeId}/documents`)).data.data,
  })
  const upload = useMutation({
    mutationFn: async ({ file, docType }: { file: File; docType: string }) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('docType', docType)
      return api.post(`/employees/${employeeId}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      toast.success('Dokumen diunggah')
      qc.invalidateQueries({ queryKey: ['employee-docs', employeeId] })
      qc.invalidateQueries({ queryKey: ['employee', employeeId] })
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  if (!canEdit) {
    return <p className="p-1 text-muted">Dokumen pegawai hanya dapat dibuka oleh pengguna yang berhak mengubah data pegawai.</p>
  }
  if (!employeeId) {
    return <p className="p-1 text-muted">Simpan data pegawai terlebih dahulu, lalu unggah dokumen.</p>
  }
  const active = EMPLOYEE_DOCUMENTS.find((d) => d.value === activeType)
  return (
    <div className="flex flex-col gap-2 p-1">
      <input
        ref={fileRef}
        type="file"
        hidden
        accept={active?.imageOnly ? '.jpg,.jpeg,.png,.webp' : '.pdf,.jpg,.jpeg,.png,.webp'}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload.mutate({ file, docType: activeType })
          e.target.value = ''
        }}
      />
      {docs.isLoading && <Loader />}
      {EMPLOYEE_DOCUMENTS.map((d) => {
        const files = (docs.data ?? []).filter((x) => x.docType === d.value)
        return (
          <div key={d.value} className="flex flex-wrap items-center justify-between gap-3 border-b border-separator py-3 last:border-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-bold">
                {d.label}
                <StatusChip color={files.length ? 'success' : 'default'}>{files.length ? 'Terunggah' : 'Belum ada'}</StatusChip>
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {files.map((f) => (
                  <Link key={f.id} className="cursor-pointer text-[13px]" onPress={() => openPrivateFile(`/employees/${employeeId}/documents/${f.id}/url`)}>
                    {f.fileName}
                  </Link>
                ))}
              </div>
            </div>
            <Button
              size="sm"
              variant="tertiary"
              isPending={upload.isPending && upload.variables?.docType === d.value}
              onPress={() => {
                setActiveType(d.value)
                // Tunggu accept input diperbarui sebelum membuka pemilih file.
                requestAnimationFrame(() => fileRef.current?.click())
              }}
            >
              <ArrowUpFromLine />Upload
            </Button>
          </div>
        )
      })}
    </div>
  )
}

function EmployeeForm({ employee, canEdit }: { employee?: Row; canEdit: boolean }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState('identity')
  const [values, setValues] = useState<Values>(() => toForm(employee))
  const [trainings, setTrainings] = useState<Training[]>(() => toTrainings(employee))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const visible = (fields: EmployeeField[]) => fields.filter((f) => canEdit || !f.personal)

  const save = useMutation({
    mutationFn: async (payload: Row) => {
      const res = employee
        ? await api.put<ApiResponse<Row>>(`/employees/${employee.id}`, payload)
        : await api.post<ApiResponse<Row>>('/employees', payload)
      return res.data.data
    },
    onSuccess: (saved) => {
      toast.success(employee ? 'Data pegawai diperbarui' : 'Pegawai ditambahkan')
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['options', '/employees'] })
      qc.setQueryData(['employee', saved.id], saved)
      // Pelatihan baru mendapat id dari server, jadi simpan ulang tidak menggandakannya.
      setValues(toForm(saved))
      setTrainings(toTrainings(saved))
      if (!employee) navigate(`/employees/${saved.id}`, { replace: true })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const clearError = (key: string) => setErrors((prev) => { const n = { ...prev }; delete n[key]; return n })

  function submit() {
    const sections: [string, EmployeeField[]][] = [
      ['identity', IDENTITY_FIELDS], ['employment', EMPLOYMENT_FIELDS], ['education', EDUCATION_FIELDS], ['assignment', ASSIGNMENT_FIELDS],
    ]
    const next: Record<string, string> = {}
    let firstTab: string | null = null
    for (const [key, fields] of sections) {
      for (const f of fields) {
        const err = fieldError(f, values[f.name])
        if (err) { next[f.name] = err; firstTab ??= key }
      }
    }
    for (const t of trainings) {
      for (const f of TRAINING_FIELDS) {
        const err = fieldError(f, t[f.name])
        if (err) { next[`training.${t.clientKey}.${f.name}`] = err; firstTab ??= 'education' }
      }
    }
    setErrors(next)
    if (firstTab) {
      setTab(firstTab)
      toast.danger('Periksa kembali isian yang ditandai')
      return
    }
    const clean = (v: string) => v.trim() || null
    save.mutate({
      ...Object.fromEntries(ALL_EMPLOYEE_FIELDS.map((f) => [f.name, clean(values[f.name])])),
      trainings: trainings.map((t) => ({
        ...(t.id ? { id: t.id } : {}),
        ...Object.fromEntries(TRAINING_FIELDS.map((f) => [f.name, clean(t[f.name])])),
      })),
    })
  }

  const renderFields = (fields: EmployeeField[]) => (
    <Grid>
      {visible(fields).map((f) => (
        <FieldInput
          key={f.name}
          field={f}
          value={values[f.name] ?? ''}
          error={errors[f.name]}
          disabled={!canEdit}
          onChange={(v) => { setValues((prev) => ({ ...prev, [f.name]: v })); clearError(f.name) }}
        />
      ))}
    </Grid>
  )
  const tabs = [
    { key: 'identity', title: 'A. Identitas Pribadi', fields: IDENTITY_FIELDS },
    { key: 'employment', title: 'B. Kepegawaian', fields: EMPLOYMENT_FIELDS },
    { key: 'education', title: 'C. Pendidikan', fields: EDUCATION_FIELDS },
    { key: 'assignment', title: 'D. Penugasan', fields: ASSIGNMENT_FIELDS },
    { key: 'documents', title: 'E. Dokumen', fields: [] as EmployeeField[] },
  ]
  const trainingError = Object.keys(errors).some((k) => k.startsWith('training.'))

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar color="accent" variant="soft">
              {employee?.photoUrl && <Avatar.Image src={employee.photoUrl} alt={`Foto ${employee.fullName}`} />}
              <Avatar.Fallback>{(values.fullName || 'P').charAt(0).toUpperCase()}</Avatar.Fallback>
            </Avatar>
            {employee ? employee.fullName : 'Tambah Pegawai'}
          </span>
        }
        actions={
          <>
            <Button variant="tertiary" onPress={() => navigate('/employees')}><ArrowLeft />Kembali</Button>
            {canEdit && <Button onPress={submit} isPending={save.isPending}>{save.isPending ? 'Menyimpan…' : 'Simpan'}</Button>}
          </>
        }
      />
      {!canEdit && (
        <div className="mb-4">
          <Alert status="accent">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>Mode lihat saja. NIK, data pribadi, kontak, rekening, dan dokumen disembunyikan.</Alert.Description>
            </Alert.Content>
          </Alert>
        </div>
      )}
      <Card>
        <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
          <Tabs.ListContainer className="overflow-x-auto">
            <Tabs.List aria-label="Bagian data pegawai" className="w-max">
              {tabs.map((t) => (
                <Tabs.Tab key={t.key} id={t.key} className="whitespace-nowrap">
                  {t.title}
                  {(t.fields.some((f) => errors[f.name]) || (t.key === 'education' && trainingError)) && <span className="ml-1 text-danger">•</span>}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel id="identity" className="pt-4">{renderFields(IDENTITY_FIELDS)}</Tabs.Panel>

          <Tabs.Panel id="employment" className="pt-4">
            {renderFields(EMPLOYMENT_FIELDS)}
            <Card variant="secondary" className="mt-5 gap-2 p-4">
              <p className="text-xs text-muted">Masa Kerja (dihitung otomatis)</p>
              <p className="font-bold">{serviceLength(values.workStartDate)}</p>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel id="education" className="flex flex-col gap-4 pt-4">
            {renderFields(EDUCATION_FIELDS)}
            <SectionTitle>Riwayat Pelatihan dan Sertifikat</SectionTitle>
            {trainings.length === 0 && <p className="px-1 text-muted">Belum ada riwayat pelatihan.</p>}
            {trainings.map((t, i) => (
              <Card key={t.clientKey} variant="secondary" className="gap-3 p-4">
                <div className="flex items-center justify-between">
                  <SectionTitle>Pelatihan {i + 1}</SectionTitle>
                  {canEdit && (
                    <IconAction danger label="Hapus pelatihan" icon={<TrashBin />} onPress={() => setTrainings((prev) => prev.filter((x) => x.clientKey !== t.clientKey))} />
                  )}
                </div>
                <Grid>
                  {TRAINING_FIELDS.map((f) => {
                    const key = `training.${t.clientKey}.${f.name}`
                    return (
                      <FieldInput
                        key={f.name}
                        field={f}
                        value={t[f.name] ?? ''}
                        error={errors[key]}
                        disabled={!canEdit}
                        onChange={(v) => {
                          setTrainings((prev) => prev.map((x) => (x.clientKey === t.clientKey ? { ...x, [f.name]: v } : x)))
                          clearError(key)
                        }}
                      />
                    )
                  })}
                </Grid>
              </Card>
            ))}
            {canEdit && (
              <div>
                <Button variant="tertiary" onPress={() => setTrainings((prev) => [...prev, { ...toValues(null, TRAINING_FIELDS), clientKey: newTrainingKey() }])}>
                  <Plus />Tambah Pelatihan
                </Button>
              </div>
            )}
          </Tabs.Panel>

          <Tabs.Panel id="assignment" className="pt-4">
            {renderFields(ASSIGNMENT_FIELDS)}
            <AssignmentPanel assignments={employee?.assignments} />
          </Tabs.Panel>

          <Tabs.Panel id="documents" className="pt-4">
            <DocumentsPanel employeeId={employee?.id} canEdit={canEdit} />
          </Tabs.Panel>
        </Tabs>
      </Card>
    </div>
  )
}

export function EmployeeFormPage() {
  const { id } = useParams()
  const { hasPermission } = useAuth()
  const isNew = !id
  const canEdit = hasPermission(isNew ? 'employees.create' : 'employees.update')
  const detail = useQuery({
    queryKey: ['employee', id],
    enabled: !isNew,
    queryFn: async () => (await api.get<ApiResponse<Row>>(`/employees/${id}`)).data.data,
  })

  if (isNew && !canEdit) {
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content><Alert.Title>Anda tidak memiliki izin menambah pegawai.</Alert.Title></Alert.Content>
      </Alert>
    )
  }
  if (!isNew && detail.isLoading) return <Loader label="Memuat data pegawai…" />
  if (!isNew && !detail.data) {
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Data pegawai tidak dapat dimuat.</Alert.Title>
          <Alert.Description>{getErrorMessage(detail.error)}</Alert.Description>
        </Alert.Content>
      </Alert>
    )
  }
  return <EmployeeForm key={id ?? 'new'} employee={detail.data} canEdit={canEdit} />
}
