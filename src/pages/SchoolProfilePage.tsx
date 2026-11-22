import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Tabs, toast } from '@heroui/react'
import { ArrowUpFromLine } from '@gravity-ui/icons'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { useAuth } from '../auth/AuthContext'
import { SCHOOL_IMAGES, SCHOOL_SECTIONS, type SchoolField } from '../config/schoolFields'
import { Loader, PageHeader, SectionTitle, SelectInput, TextAreaInput, TextInput } from '../components/ui'

type Values = Record<string, string>
interface SchoolData {
  profile: Record<string, unknown> | null
  images: Record<'logo' | 'foundationLogo' | 'buildingPhoto', string | null>
  stats: {
    activeAcademicYear: string | null
    activeSemester: string | null
    curriculums: string[]
    classrooms: number
    assets: number
    classes: number
    activeStudents: number
    teachers: number
    staff: number
  }
}

const ALL_FIELDS = [...new Map(SCHOOL_SECTIONS.flatMap((s) => s.fields).map((f) => [f.name, f])).values()]

function toValues(profile: SchoolData['profile']): Values {
  return Object.fromEntries(ALL_FIELDS.map((f) => {
    const value = profile?.[f.name]
    return [f.name, value == null ? '' : f.type === 'date' ? String(value).slice(0, 10) : String(value)]
  }))
}

function fieldError(f: SchoolField, raw: string): string | undefined {
  const v = (raw ?? '').trim()
  if (f.required && !v) return `${f.label} wajib diisi`
  if (!v) return undefined
  if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Format email tidak valid'
  if (f.type === 'year' && !(/^\d{4}$/.test(v) && Number(v) >= 1900 && Number(v) <= 2100)) return 'Tahun tidak valid'
  return undefined
}

function SchoolInput({ field, value, error, disabled, onChange }: {
  field: SchoolField
  value: string
  error?: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const common = { label: field.label, value, required: field.required, disabled, error, onChange }
  const wrapper = field.wide ? 'sm:col-span-2 lg:col-span-3' : ''
  if (field.type === 'textarea') return <div className={wrapper}><TextAreaInput {...common} rows={4} /></div>
  if (field.type === 'select') return <div className={wrapper}><SelectInput {...common} options={field.options ?? []} /></div>
  const type = field.type === 'year' ? 'text' : field.type ?? 'text'
  return <div className={wrapper}><TextInput {...common} type={type} /></div>
}

function AutoData({ title, source, items }: { title: string; source: string; items: [string, string | number][] }) {
  return (
    <Card variant="secondary" className="mt-5 gap-3 p-4">
      <div>
        <SectionTitle>{title}</SectionTitle>
        <p className="mt-0.5 text-[13px] text-muted">Terisi otomatis dari menu {source}.</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="font-bold">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function ImageUploads({ data, canEdit }: { data: SchoolData; canEdit: boolean }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const kindRef = useRef<string>('logo')
  const uploadImage = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: string }) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post<ApiResponse<SchoolData>>(`/school-profile/images/${kind}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data.data
    },
    onSuccess: (saved) => {
      qc.setQueryData(['school-profile'], saved)
      toast.success('Gambar diunggah')
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  return (
    <div className="mb-5 grid gap-4 sm:grid-cols-3">
      <input
        ref={fileRef}
        type="file"
        hidden
        accept=".jpg,.jpeg,.png,.webp"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) uploadImage.mutate({ file, kind: kindRef.current })
          e.target.value = ''
        }}
      />
      {SCHOOL_IMAGES.map((image) => {
        const url = data.images[image.key]
        return (
          <Card key={image.kind} variant="secondary" className="gap-3 p-3">
            <SectionTitle>{image.label}</SectionTitle>
            <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-surface">
              {url
                ? <img src={url} alt={image.label} className="h-full w-full object-contain" />
                : <span className="text-[13px] text-muted">Belum ada gambar</span>}
            </div>
            {canEdit && (
              <Button
                size="sm"
                variant="tertiary"
                isDisabled={!data.profile}
                isPending={uploadImage.isPending && uploadImage.variables?.kind === image.kind}
                onPress={() => { kindRef.current = image.kind; fileRef.current?.click() }}
              >
                <ArrowUpFromLine />Upload
              </Button>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function SchoolForm({ data, canEdit }: { data: SchoolData; canEdit: boolean }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState(SCHOOL_SECTIONS[0].key)
  const [values, setValues] = useState<Values>(() => toValues(data.profile))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const sections = SCHOOL_SECTIONS.map((s) => ({
    ...s,
    fields: s.fields.filter((f) => canEdit || !f.personal),
  }))
  const { stats } = data

  const save = useMutation({
    mutationFn: async (payload: Record<string, string | null>) =>
      (await api.put<ApiResponse<SchoolData>>('/school-profile', payload)).data.data,
    onSuccess: (saved) => {
      qc.setQueryData(['school-profile'], saved)
      setValues(toValues(saved.profile))
      toast.success('Identitas sekolah disimpan')
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  function submit() {
    const next: Record<string, string> = {}
    for (const f of ALL_FIELDS) {
      const err = fieldError(f, values[f.name])
      if (err) next[f.name] = err
    }
    setErrors(next)
    const errorSection = SCHOOL_SECTIONS.find((s) => s.fields.some((f) => next[f.name]))
    if (errorSection) {
      setTab(errorSection.key)
      toast.danger('Periksa kembali isian yang ditandai')
      return
    }
    save.mutate(Object.fromEntries(ALL_FIELDS.map((f) => [f.name, values[f.name].trim() || null])))
  }

  return (
    <div>
      <PageHeader
        title="Identitas Sekolah"
        actions={canEdit && <Button onPress={submit} isPending={save.isPending}>{save.isPending ? 'Menyimpan…' : 'Simpan'}</Button>}
      />
      {!canEdit && (
        <div className="mb-4">
          <Alert status="accent">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>Mode lihat saja. NIK, tanggal lahir, dan kontak pribadi Kepala Sekolah disembunyikan.</Alert.Description>
            </Alert.Content>
          </Alert>
        </div>
      )}
      <Card>
        <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
          <Tabs.ListContainer className="overflow-x-auto">
            <Tabs.List aria-label="Bagian identitas sekolah" className="w-max">
              {sections.map((s) => (
                <Tabs.Tab key={s.key} id={s.key} className="whitespace-nowrap">
                  {s.title}{s.fields.some((f) => errors[f.name]) && <span className="ml-1 text-danger">•</span>}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          {sections.map((section) => (
            <Tabs.Panel key={section.key} id={section.key} className="pt-4">
              {section.key === 'branding' && <ImageUploads data={data} canEdit={canEdit} />}
              <div className="grid gap-4 p-1 sm:grid-cols-2 lg:grid-cols-3">
                {section.fields.map((f) => (
                  <SchoolInput
                    key={f.name}
                    field={f}
                    value={values[f.name] ?? ''}
                    error={errors[f.name]}
                    disabled={!canEdit}
                    onChange={(v) => {
                      setValues((prev) => ({ ...prev, [f.name]: v }))
                      setErrors((prev) => { const n = { ...prev }; delete n[f.name]; return n })
                    }}
                  />
                ))}
              </div>
              {section.key === 'general' && (
                <AutoData title="Periode dan kurikulum" source="Tahun Ajaran, Semester, dan Kurikulum" items={[
                  ['Kurikulum yang Digunakan', stats.curriculums.join(', ') || '-'],
                  ['Tahun Ajaran Aktif', stats.activeAcademicYear ?? '-'],
                  ['Semester Aktif', stats.activeSemester === 'GANJIL' ? 'Ganjil' : stats.activeSemester === 'GENAP' ? 'Genap' : '-'],
                ]} />
              )}
              {section.key === 'operations' && (
                <AutoData title="Jumlah saat ini" source="Ruang Kelas, Sarpras, Rombel, Data Siswa, dan Data Pegawai" items={[
                  ['Ruang Kelas', stats.classrooms],
                  ['Jenis Sarana Prasarana', stats.assets],
                  ['Rombongan Belajar', stats.classes],
                  ['Peserta Didik Aktif', stats.activeStudents],
                  ['Guru', stats.teachers],
                  ['Tenaga Kependidikan', stats.staff],
                ]} />
              )}
            </Tabs.Panel>
          ))}
        </Tabs>
      </Card>
    </div>
  )
}

export function SchoolProfilePage() {
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('school-profile.update')
  const query = useQuery({
    queryKey: ['school-profile'],
    queryFn: async () => (await api.get<ApiResponse<SchoolData>>('/school-profile')).data.data,
  })

  if (query.isLoading) return <Loader label="Memuat identitas sekolah…" />
  if (!query.data) {
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Identitas sekolah tidak dapat dimuat.</Alert.Title>
          <Alert.Description>{getErrorMessage(query.error)}</Alert.Description>
        </Alert.Content>
      </Alert>
    )
  }
  return <SchoolForm key={String(query.data.profile?.id ?? 'new')} data={query.data} canEdit={canEdit} />
}
