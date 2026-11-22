import { useRef, useState } from 'react'
import { DOCUMENT_LABEL, REQUIRED_DOCUMENTS } from '../config/studentFields'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@heroui/react'
import { api, getErrorMessage, openStudentDocument } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { useAuth } from '../auth/AuthContext'
import { Button, Link } from '@heroui/react'
import { ArrowUpFromLine } from '@gravity-ui/icons'
import {
  DataTable, FormStack, Loader, PageHeader, Panel, RowActions, SearchBox, SectionTitle, SelectInput,
  StatusChip, TablePager, Toolbar,
} from '../components/ui'

type Row = Record<string, any>

const DOC_TYPES = REQUIRED_DOCUMENTS.filter((d) => d.value)

export function StudentDocumentsPage() {
  const { hasPermission } = useAuth()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [activeStudent, setActiveStudent] = useState<Row | null>(null)

  // Document management is backed by the students endpoints.
  const canUpload = hasPermission('students.update') || hasPermission('student-documents.create')

  const listQuery = useQuery({
    queryKey: ['students-docpicker', page, search],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Row[]>>('/students', { params: { page, limit: 10, search } })
      return data
    },
  })

  const items = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div>
      <PageHeader title="Dokumen Siswa" />

      <Panel>
        <Toolbar>
          <SearchBox placeholder="Cari siswa (nama / NIS)…" value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
        </Toolbar>
        <DataTable
          label="Daftar siswa"
          columns={[{ label: 'NIS' }, { label: 'Nama' }, { label: 'Kelas' }, { label: 'Aksi', align: 'right' }]}
          rows={items}
          isLoading={listQuery.isLoading}
          emptyText="Belum ada siswa"
          renderRow={(s) => [
            s.nis ?? '-',
            s.fullName,
            s.classAssignments?.[0]?.class?.name ?? '-',
            <RowActions><Button size="sm" variant="tertiary" onPress={() => setActiveStudent(s)}>Kelola Dokumen</Button></RowActions>,
          ]}
        />
        <TablePager meta={meta} page={page} onChange={setPage} />
      </Panel>

      {activeStudent && (
        <DocumentManager student={activeStudent} canUpload={canUpload} onClose={() => setActiveStudent(null)} />
      )}
    </div>
  )
}

function DocumentManager({
  student,
  canUpload,
  onClose,
}: {
  student: Row
  canUpload: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [docType, setDocType] = useState(DOC_TYPES[0].value)

  const docsQuery = useQuery({
    queryKey: ['student-docs', student.id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Row[]>>(`/students/${student.id}/documents`)
      return data.data
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('docType', docType)
      return api.post(`/students/${student.id}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      toast.success('Dokumen diunggah')
      qc.invalidateQueries({ queryKey: ['student-docs', student.id] })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const docs = docsQuery.data ?? []

  return (
    <Modal
      open
      title={`Dokumen — ${student.fullName}`}
      onClose={onClose}
      footer={<Button variant="tertiary" onPress={onClose}>Tutup</Button>}
    >
      <FormStack>
        {canUpload && (
          <div className="flex items-end gap-2">
            <SelectInput label="Jenis Dokumen" noEmpty options={DOC_TYPES} value={docType} onChange={setDocType} />
            <Button onPress={() => fileRef.current?.click()} isPending={uploadMutation.isPending}>
              <ArrowUpFromLine />{uploadMutation.isPending ? 'Mengunggah…' : 'Upload'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadMutation.mutate(f)
                e.target.value = ''
              }}
            />
          </div>
        )}

        <SectionTitle>Dokumen Tersimpan</SectionTitle>
        {docsQuery.isLoading && <Loader />}
        {!docsQuery.isLoading && docs.length === 0 && <p className="text-muted">Belum ada dokumen.</p>}
        <ul className="flex flex-col gap-2">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2">
              <StatusChip>{DOCUMENT_LABEL[d.docType] ?? d.docType}</StatusChip>
              <Link className="cursor-pointer" onPress={() => openStudentDocument(student.id, d.id)}>{d.fileName}</Link>
            </li>
          ))}
        </ul>
      </FormStack>
    </Modal>
  )
}
