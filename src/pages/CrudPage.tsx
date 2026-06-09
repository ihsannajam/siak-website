import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import type { FieldDef, ModuleConfig } from '../config/modules'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../auth/AuthContext'

type Row = Record<string, any>

function getNested(obj: Row, path: string) {
  return path.split('.').reduce<any>((acc, k) => (acc == null ? acc : acc[k]), obj)
}

function formatValue(val: unknown): string {
  if (val == null) return '-'
  if (typeof val === 'boolean') return val ? 'Ya' : 'Tidak'
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) return val.slice(0, 10)
  return String(val)
}

export function CrudPage({ config }: { config: ModuleConfig }) {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form, setForm] = useState<Row>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const canCreate = hasPermission(`${config.permissionKey}.create`)
  const canUpdate = hasPermission(`${config.permissionKey}.update`)
  const canDelete = hasPermission(`${config.permissionKey}.delete`)

  const listQuery = useQuery({
    queryKey: [config.key, page, search],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Row[]>>(config.apiPath, {
        params: { page, limit: 10, search },
      })
      return data
    },
  })

  // Load select options for fields using optionsFrom
  const optionFields = useMemo(
    () => config.fields.filter((f) => f.optionsFrom),
    [config.fields],
  )
  const optionQueries = useQueries({
    queries: optionFields.map((f) => ({
      queryKey: ['options', f.optionsFrom!.path],
      queryFn: async () => {
        const { data } = await api.get<ApiResponse<Row[]>>(f.optionsFrom!.path, {
          params: { all: true },
        })
        return data.data
      },
    })),
  })
  const optionsMap: Record<string, { value: string; label: string }[]> = {}
  optionFields.forEach((f, i) => {
    const rows = (optionQueries[i]?.data as Row[]) ?? []
    optionsMap[f.name] = rows.map((r) => ({
      value: r[f.optionsFrom!.valueKey ?? 'id'],
      label: r[f.optionsFrom!.labelKey],
    }))
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: Row) => {
      if (editing) return api.put(`${config.apiPath}/${editing.id}`, payload)
      return api.post(config.apiPath, payload)
    },
    onSuccess: () => {
      toast.success(editing ? 'Data diperbarui' : 'Data ditambahkan')
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: [config.key] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`${config.apiPath}/${id}`),
    onSuccess: () => {
      toast.success('Data dihapus')
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: [config.key] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  function openCreate() {
    setEditing(null)
    setForm({})
    setErrors({})
    setModalOpen(true)
  }

  function openEdit(row: Row) {
    setEditing(row)
    // shallow copy + normalize dates for inputs
    const f: Row = {}
    for (const field of config.fields) {
      let v = getNested(row, field.name)
      if (field.type === 'date' && typeof v === 'string') v = v.slice(0, 10)
      f[field.name] = v ?? ''
    }
    setForm(f)
    setErrors({})
    setModalOpen(true)
  }

  function validateAndSubmit() {
    const errs: Record<string, string> = {}
    for (const field of config.fields) {
      if (field.required && (form[field.name] === '' || form[field.name] == null)) {
        errs[field.name] = `${field.label} wajib diisi`
      }
    }
    setErrors(errs)
    if (Object.keys(errs).length) return

    // clean empty strings to undefined
    const payload: Row = {}
    for (const field of config.fields) {
      let v = form[field.name]
      if (v === '') v = undefined
      if (field.type === 'number' && v != null) v = Number(v)
      payload[field.name] = v
    }
    saveMutation.mutate(payload)
  }

  const items = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div>
      <div className="page-header">
        <h1>{config.title}</h1>
        {canCreate && (
          <button className="btn btn-primary" onClick={openCreate}>
            + Tambah
          </button>
        )}
      </div>

      <div className="card">
        <div className="toolbar">
          <input
            className="input search-input"
            placeholder="Cari…"
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
                {config.columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && (
                <tr>
                  <td colSpan={config.columns.length + 1} className="empty">
                    Memuat…
                  </td>
                </tr>
              )}
              {!listQuery.isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={config.columns.length + 1} className="empty">
                    Belum ada data
                  </td>
                </tr>
              )}
              {items.map((row) => (
                <tr key={row.id}>
                  {config.columns.map((c) => (
                    <td key={c.key}>
                      {formatValue(c.accessor ? getNested(row, c.accessor) : row[c.key])}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {canUpdate && (
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(row)}>
                        Edit
                      </button>
                    )}{' '}
                    {canDelete && (
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteId(row.id)}>
                        Hapus
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="pagination">
            <button
              className="btn btn-sm btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ‹ Prev
            </button>
            <span style={{ fontSize: 13 }}>
              Hal {meta.page} / {meta.totalPages} ({meta.total} data)
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

      <Modal
        open={modalOpen}
        title={`${editing ? 'Edit' : 'Tambah'} ${config.title}`}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Batal
            </button>
            <button
              className="btn btn-primary"
              onClick={validateAndSubmit}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        {config.fields.map((field) => (
          <FieldInput
            key={field.name}
            field={field}
            value={form[field.name]}
            error={errors[field.name]}
            options={field.options ?? optionsMap[field.name]}
            onChange={(v) => setForm((prev) => ({ ...prev, [field.name]: v }))}
          />
        ))}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        message="Yakin ingin menghapus data ini?"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

function FieldInput({
  field,
  value,
  error,
  options,
  onChange,
}: {
  field: FieldDef
  value: any
  error?: string
  options?: { value: string; label: string }[]
  onChange: (v: any) => void
}) {
  const type = field.type ?? 'text'
  return (
    <div className="form-group">
      {type !== 'checkbox' && (
        <label>
          {field.label} {field.required && <span className="req">*</span>}
        </label>
      )}
      {type === 'textarea' ? (
        <textarea
          rows={3}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : type === 'select' ? (
        <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Pilih —</option>
          {(options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : type === 'checkbox' ? (
        <div className="checkbox-row">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          <label style={{ margin: 0 }}>{field.label}</label>
        </div>
      ) : (
        <input
          className="input"
          type={type}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && <div className="form-error">{error}</div>}
    </div>
  )
}
