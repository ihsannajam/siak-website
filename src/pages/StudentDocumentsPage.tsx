import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { useAuth } from '../auth/AuthContext'

type Row = Record<string, any>

const DOC_TYPES = [
  { value: 'AKTA_KELAHIRAN', label: 'Akta Kelahiran' },
  { value: 'KARTU_KELUARGA', label: 'Kartu Keluarga' },
  { value: 'IJAZAH', label: 'Ijazah' },
  { value: 'FOTO', label: 'Foto Profil' },
  { value: 'LAINNYA', label: 'Lainnya' },
]

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
      <div className="page-header">
        <h1>Dokumen Siswa</h1>
      </div>

      <div className="card">
        <div className="toolbar">
          <input
            className="input search-input"
            placeholder="Cari siswa (nama / NIS)…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>NIS</th>
                <th>Nama</th>
                <th>Kelas</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && (
                <tr>
                  <td colSpan={4} className="empty">
                    Memuat…
                  </td>
                </tr>
              )}
              {!listQuery.isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    Belum ada siswa
                  </td>
                </tr>
              )}
              {items.map((s) => (
                <tr key={s.id}>
                  <td>{s.nis ?? '-'}</td>
                  <td>{s.fullName}</td>
                  <td>{s.classAssignments?.[0]?.class?.name ?? '-'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => setActiveStudent(s)}>
                      Kelola Dokumen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ‹ Prev
            </button>
            <span style={{ fontSize: 13 }}>
              Hal {meta.page} / {meta.totalPages} ({meta.total})
            </span>
            <button
              className="btn btn-sm btn-secondary"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next ›
            </button>
          </div>
        )}
      </div>

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
  const [docType, setDocType] = useState('AKTA_KELAHIRAN')

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
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const docs = docsQuery.data ?? []

  return (
    <Modal
      open
      title={`Dokumen — ${student.fullName}`}
      onClose={onClose}
      footer={
        <button className="btn btn-secondary" onClick={onClose}>
          Tutup
        </button>
      }
    >
      {canUpload && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 14 }}>
          <div className="form-group" style={{ margin: 0, flex: 1 }}>
            <label>Jenis Dokumen</label>
            <select className="select" value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? 'Mengunggah…' : '⬆️ Upload'}
          </button>
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

      <h4 style={{ marginTop: 0 }}>Dokumen Tersimpan</h4>
      {docsQuery.isLoading && <p>Memuat…</p>}
      {!docsQuery.isLoading && docs.length === 0 && <p style={{ color: 'var(--muted)' }}>Belum ada dokumen.</p>}
      <ul style={{ paddingLeft: 0, listStyle: 'none' }}>
        {docs.map((d) => (
          <li key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="pill pill-gray">{d.docType}</span>
            <a href={d.filePath} target="_blank" rel="noreferrer" style={{ color: 'var(--info)' }}>
              {d.fileName}
            </a>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
