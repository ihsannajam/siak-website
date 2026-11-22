import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Avatar, Button, Card, Link, Tabs, toast } from '@heroui/react'
import { ArrowLeft, ArrowUpFromLine, Plus, TrashBin } from '@gravity-ui/icons'
import { api, getErrorMessage, openStudentDocument } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { useAuth } from '../auth/AuthContext'
import {
  EDUCATION_FIELDS, REQUIRED_DOCUMENTS, STUDENT_SECTIONS, STUDENT_STATUS_LABEL,
  type FieldOption, type StudentField, type StudentScope,
} from '../config/studentFields'
import {
  IconAction, Loader, PageHeader, SectionTitle, SelectInput, StatusChip, TextAreaInput, TextInput,
} from '../components/ui'

type Row = Record<string, any>
type Values = Record<string, string>
type FormState = Record<StudentScope, Values>
type History = Values & { clientKey: string }

const fieldsOf = (scope: StudentScope) =>
  STUDENT_SECTIONS.filter((s) => s.scope === scope).flatMap((s) => s.fields)

function toValues(source: Row | null | undefined, fields: StudentField[]): Values {
  const out: Values = {}
  for (const f of fields) {
    const v = source?.[f.name]
    out[f.name] = v == null ? '' : f.type === 'date' ? String(v).slice(0, 10) : String(v)
  }
  return out
}

function toPayload(values: Values, fields: StudentField[]): Row {
  const out: Row = {}
  for (const f of fields) {
    const hidden = f.showIf && values[f.showIf.name] !== f.showIf.value
    const v = hidden ? '' : (values[f.name] ?? '').trim()
    out[f.name] = v === '' ? null : f.type === 'number' ? Number(v) : v
  }
  return out
}

const toForm = (s?: Row): FormState => ({
  student: { ...toValues(s, fieldsOf('student')), gender: s?.gender ?? 'LAKI_LAKI', status: s?.status ?? 'AKTIF' },
  family: toValues(s?.family, fieldsOf('family')),
  health: toValues(s?.healthRecord, fieldsOf('health')),
})

let historyCounter = 0
const newHistoryKey = () => `h-${++historyCounter}`
const toHistories = (s?: Row): History[] =>
  (s?.educationHistories ?? []).map((h: Row) => ({
    ...toValues(h, EDUCATION_FIELDS),
    id: h.id,
    clientKey: h.id,
  }))

function fieldError(f: StudentField, value: string): string | undefined {
  const v = (value ?? '').trim()
  if (f.showIf && !v) return undefined
  if (f.required && !v) return `${f.label} wajib diisi`
  if (!v) return undefined
  if (f.type === 'nik' && !/^\d{16}$/.test(v)) return 'NIK harus 16 digit angka'
  if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Format email tidak valid'
  if (f.type === 'number' && (Number.isNaN(Number(v)) || Number(v) < 0)) return 'Nilai tidak valid'
  if (/Year$/.test(f.name) && !(Number.isInteger(Number(v)) && Number(v) >= 1900 && Number(v) <= 2100)) {
    return 'Tahun tidak valid'
  }
  return undefined
}

function FieldControl({ field, values, error, disabled, dynamicOptions, onChange }: {
  field: StudentField
  values: Values
  error?: string
  disabled: boolean
  dynamicOptions: Record<string, FieldOption[]>
  onChange: (name: string, value: string) => void
}) {
  if (field.showIf && values[field.showIf.name] !== field.showIf.value) return null
  const value = values[field.name] ?? ''
  const common = {
    label: field.label,
    value,
    required: field.required,
    disabled,
    error,
    onChange: (v: string) => onChange(field.name, v),
  }
  const wrapper = field.wide ? 'sm:col-span-2 lg:col-span-3' : ''

  if (field.type === 'textarea') {
    return <div className={wrapper}><TextAreaInput {...common} rows={2} /></div>
  }
  if (field.type === 'select') {
    const base = field.dynamicOptions ? dynamicOptions[field.dynamicOptions] ?? [] : field.options ?? []
    // Nilai lama di luar daftar tetap tampil supaya tidak hilang saat disimpan.
    const options = value && !base.some((o) => o.value === value)
      ? [...base, { value, label: STUDENT_STATUS_LABEL[value] ?? value }]
      : base
    return <div className={wrapper}><SelectInput {...common} options={options} noEmpty={field.noEmpty} /></div>
  }
  const type = field.type === 'nik' ? 'text' : field.type ?? 'text'
  return <div className={wrapper}><TextInput {...common} type={type} /></div>
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 p-1 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

function DocumentsPanel({ studentId, canEdit }: { studentId?: string; canEdit: boolean }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [activeType, setActiveType] = useState(REQUIRED_DOCUMENTS[0].value)

  const docsQuery = useQuery({
    queryKey: ['student-docs', studentId],
    enabled: !!studentId,
    queryFn: async () => (await api.get<ApiResponse<Row[]>>(`/students/${studentId}/documents`)).data.data,
  })

  const upload = useMutation({
    mutationFn: async ({ file, docType }: { file: File; docType: string }) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('docType', docType)
      return api.post(`/students/${studentId}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      toast.success('Dokumen diunggah')
      qc.invalidateQueries({ queryKey: ['student-docs', studentId] })
      qc.invalidateQueries({ queryKey: ['student', studentId] })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  if (!studentId) {
    return (
      <Alert status="accent">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>Simpan data siswa terlebih dahulu, lalu unggah dokumen pendukung.</Alert.Description>
        </Alert.Content>
      </Alert>
    )
  }

  const docs = docsQuery.data ?? []
  const visible = REQUIRED_DOCUMENTS.filter((d) => canEdit || !d.sensitive)
  const active = REQUIRED_DOCUMENTS.find((d) => d.value === activeType)

  return (
    <div className="flex flex-col gap-2 p-1">
      <input
        ref={fileRef}
        type="file"
        hidden
        accept={active?.imageOnly ? '.jpg,.jpeg,.png,.webp' : '.pdf,.jpg,.jpeg,.png'}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload.mutate({ file, docType: activeType })
          e.target.value = ''
        }}
      />
      {docsQuery.isLoading && <Loader />}
      {visible.map((d) => {
        const files = docs.filter((x) => x.docType === d.value)
        return (
          <div key={d.value} className="flex flex-wrap items-center justify-between gap-3 border-b border-separator py-3 last:border-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-bold">
                {d.label}
                <StatusChip color={files.length ? 'success' : 'default'}>{files.length ? 'Terunggah' : 'Belum ada'}</StatusChip>
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {files.map((f) => (
                  <Link key={f.id} className="cursor-pointer text-[13px]" onPress={() => openStudentDocument(studentId, f.id)}>{f.fileName}</Link>
                ))}
              </div>
            </div>
            {canEdit && (
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
            )}
          </div>
        )
      })}
    </div>
  )
}

function StudentForm({ student, canEdit }: { student?: Row; canEdit: boolean }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState('identity')
  const [form, setForm] = useState<FormState>(() => toForm(student))
  const [histories, setHistories] = useState<History[]>(() => toHistories(student))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [yearsQuery, classesQuery] = useQueries({
    queries: [
      { queryKey: ['options', '/academic-years'], queryFn: async () => (await api.get<ApiResponse<Row[]>>('/academic-years', { params: { all: true } })).data.data },
      { queryKey: ['options', '/classes'], queryFn: async () => (await api.get<ApiResponse<Row[]>>('/classes', { params: { all: true } })).data.data },
    ],
  })
  // Nilai siswa tetap punya label walau pengguna tidak berizin memuat daftar master.
  const withCurrent = (options: FieldOption[], current?: Row | null) =>
    current && !options.some((o) => o.value === current.id)
      ? [...options, { value: current.id, label: current.name }]
      : options
  const dynamicOptions = {
    academicYears: withCurrent((yearsQuery.data ?? []).map((y) => ({ value: y.id, label: y.name })), student?.entryAcademicYear),
    classes: withCurrent((classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name })), student?.admissionClass),
  }

  const save = useMutation({
    mutationFn: async (payload: Row) => {
      const res = student
        ? await api.put<ApiResponse<Row>>(`/students/${student.id}`, payload)
        : await api.post<ApiResponse<Row>>('/students', payload)
      return res.data.data
    },
    onSuccess: (saved) => {
      toast.success(student ? 'Data siswa diperbarui' : 'Siswa ditambahkan')
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['student', saved.id] })
      // Riwayat baru mendapat id dari server, jadi simpan ulang tidak menggandakannya.
      setForm(toForm(saved))
      setHistories(toHistories(saved))
      if (!student) navigate(`/students/${saved.id}`, { replace: true })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  function setField(scope: StudentScope, name: string, value: string) {
    setForm((prev) => ({ ...prev, [scope]: { ...prev[scope], [name]: value } }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[`${scope}.${name}`]
      return next
    })
  }

  function setHistoryField(key: string, name: string, value: string) {
    setHistories((prev) => prev.map((h) => (h.clientKey === key ? { ...h, [name]: value } : h)))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[`education.${key}.${name}`]
      return next
    })
  }

  function submit() {
    const next: Record<string, string> = {}
    let firstTab: string | null = null
    for (const section of STUDENT_SECTIONS) {
      for (const f of section.fields) {
        const values = form[section.scope]
        if (f.showIf && values[f.showIf.name] !== f.showIf.value) continue
        const err = fieldError(f, values[f.name])
        if (err) {
          next[`${section.scope}.${f.name}`] = err
          firstTab ??= section.key
        }
      }
    }
    for (const h of histories) {
      for (const f of EDUCATION_FIELDS) {
        const err = fieldError(f, h[f.name])
        if (err) {
          next[`education.${h.clientKey}.${f.name}`] = err
          firstTab ??= 'education'
        }
      }
    }
    setErrors(next)
    if (firstTab) {
      setTab(firstTab)
      toast.danger('Periksa kembali isian yang ditandai')
      return
    }

    const hasValue = (v: Row) => Object.values(v).some((x) => x !== null)
    const family = toPayload(form.family, fieldsOf('family'))
    const health = toPayload(form.health, fieldsOf('health'))
    save.mutate({
      ...toPayload(form.student, fieldsOf('student')),
      ...(student?.family || hasValue(family) ? { family } : {}),
      ...(student?.healthRecord || hasValue(health) ? { health } : {}),
      educationHistories: histories.map((h) => ({
        ...(h.id ? { id: h.id } : {}),
        ...toPayload(h, EDUCATION_FIELDS),
      })),
    })
  }

  const tabs = [
    ...STUDENT_SECTIONS.slice(0, 5).map((s) => ({ key: s.key, title: s.title })),
    { key: 'education', title: 'Pendidikan' },
    ...STUDENT_SECTIONS.slice(5).map((s) => ({ key: s.key, title: s.title })),
    { key: 'documents', title: 'Dokumen' },
  ]
  const errorTabs = new Set(
    STUDENT_SECTIONS
      .filter((s) => s.fields.some((f) => errors[`${s.scope}.${f.name}`]))
      .map((s) => s.key),
  )
  if (Object.keys(errors).some((k) => k.startsWith('education.'))) errorTabs.add('education')

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar color="accent" variant="soft">
              {student?.photoUrl && <Avatar.Image src={student.photoUrl} alt={`Foto ${student.fullName}`} />}
              <Avatar.Fallback>{(form.student.fullName || 'S').charAt(0).toUpperCase()}</Avatar.Fallback>
            </Avatar>
            {student ? student.fullName : 'Tambah Siswa'}
          </span>
        }
        actions={
          <>
            <Button variant="tertiary" onPress={() => navigate('/students')}><ArrowLeft />Kembali</Button>
            {canEdit && (
              <Button onPress={submit} isPending={save.isPending}>
                {save.isPending ? 'Menyimpan…' : 'Simpan'}
              </Button>
            )}
          </>
        }
      />

      {!canEdit && (
        <div className="mb-4">
          <Alert status="accent">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>Mode lihat saja. NIK, penghasilan, dan dokumen identitas disembunyikan.</Alert.Description>
            </Alert.Content>
          </Alert>
        </div>
      )}

      <Card>
        <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
          <Tabs.ListContainer className="overflow-x-auto">
            <Tabs.List aria-label="Bagian data siswa" className="w-max">
              {tabs.map((t) => (
                <Tabs.Tab key={t.key} id={t.key} className="whitespace-nowrap">
                  {t.title}{errorTabs.has(t.key) && <span className="ml-1 text-danger">•</span>}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>

          {STUDENT_SECTIONS.map((section) => (
            <Tabs.Panel key={section.key} id={section.key} className="pt-4">
              <FieldGrid>
                {section.fields.map((f) => (
                  <FieldControl
                    key={f.name}
                    field={f}
                    values={form[section.scope]}
                    error={errors[`${section.scope}.${f.name}`]}
                    disabled={!canEdit}
                    dynamicOptions={dynamicOptions}
                    onChange={(name, v) => setField(section.scope, name, v)}
                  />
                ))}
              </FieldGrid>
              {section.key === 'health' && student?.healthRecord?.allergies && (
                <p className="mt-3 px-1 text-[13px] text-muted">
                  Data alergi lama: {student.healthRecord.allergies}
                </p>
              )}
            </Tabs.Panel>
          ))}

          <Tabs.Panel id="education" className="flex flex-col gap-4 pt-4">
            {histories.length === 0 && <p className="p-1 text-muted">Belum ada riwayat sekolah.</p>}
            {histories.map((h, i) => (
              <Card key={h.clientKey} variant="secondary" className="gap-3 p-4">
                <div className="flex items-center justify-between">
                  <SectionTitle>Riwayat Sekolah {i + 1}</SectionTitle>
                  {canEdit && (
                    <IconAction
                      danger
                      label="Hapus riwayat"
                      icon={<TrashBin />}
                      onPress={() => setHistories((prev) => prev.filter((x) => x.clientKey !== h.clientKey))}
                    />
                  )}
                </div>
                <FieldGrid>
                  {EDUCATION_FIELDS.map((f) => (
                    <FieldControl
                      key={f.name}
                      field={f}
                      values={h}
                      error={errors[`education.${h.clientKey}.${f.name}`]}
                      disabled={!canEdit}
                      dynamicOptions={dynamicOptions}
                      onChange={(name, v) => setHistoryField(h.clientKey, name, v)}
                    />
                  ))}
                </FieldGrid>
              </Card>
            ))}
            {canEdit && (
              <div>
                <Button
                  variant="tertiary"
                  onPress={() => setHistories((prev) => [
                    ...prev,
                    { ...toValues(null, EDUCATION_FIELDS), clientKey: newHistoryKey() },
                  ])}
                >
                  <Plus />Tambah Riwayat Sekolah
                </Button>
              </div>
            )}
          </Tabs.Panel>

          <Tabs.Panel id="documents" className="pt-4">
            <DocumentsPanel studentId={student?.id} canEdit={canEdit} />
          </Tabs.Panel>
        </Tabs>
      </Card>
    </div>
  )
}

export function StudentFormPage() {
  const { id } = useParams()
  const { hasPermission } = useAuth()
  const isNew = !id
  const canEdit = hasPermission(isNew ? 'students.create' : 'students.update')

  const detail = useQuery({
    queryKey: ['student', id],
    enabled: !isNew,
    queryFn: async () => (await api.get<ApiResponse<Row>>(`/students/${id}`)).data.data,
  })

  if (isNew && !canEdit) {
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content><Alert.Title>Anda tidak memiliki izin menambah siswa.</Alert.Title></Alert.Content>
      </Alert>
    )
  }
  if (!isNew && detail.isLoading) return <Loader label="Memuat data siswa…" />
  if (!isNew && !detail.data) {
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Data siswa tidak dapat dimuat.</Alert.Title>
          <Alert.Description>{getErrorMessage(detail.error)}</Alert.Description>
        </Alert.Content>
      </Alert>
    )
  }
  return <StudentForm key={id ?? 'new'} student={detail.data} canEdit={canEdit} />
}
