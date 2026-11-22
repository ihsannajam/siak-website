import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'
import { toast } from '@heroui/react'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import type { FieldDef, ModuleConfig } from '../config/modules'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../auth/AuthContext'
import { Button } from '@heroui/react'
import { Plus } from '@gravity-ui/icons'
import {
  CheckInput, DataTable, EditDeleteActions, FormStack, PageHeader, Panel, SearchBox, SelectInput,
  TablePager, TextAreaInput, TextInput, Toolbar,
} from '../components/ui'

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
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`${config.apiPath}/${id}`),
    onSuccess: () => {
      toast.success('Data dihapus')
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: [config.key] })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
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
      <PageHeader
        title={config.title}
        actions={canCreate && <Button onPress={openCreate}><Plus />Tambah</Button>}
      />

      <Panel>
        <Toolbar>
          <SearchBox placeholder="Cari…" value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
        </Toolbar>
        <DataTable
          label={config.title}
          columns={[...config.columns.map((c) => ({ label: c.label })), { label: 'Aksi', align: 'right' as const }]}
          rows={items}
          isLoading={listQuery.isLoading}
          renderRow={(row) => [
            ...config.columns.map((c) => formatValue(c.accessor ? getNested(row, c.accessor) : row[c.key])),
            <EditDeleteActions
              onEdit={canUpdate ? () => openEdit(row) : undefined}
              onDelete={canDelete ? () => setDeleteId(row.id) : undefined}
            />,
          ]}
        />
        <TablePager meta={meta} page={page} onChange={setPage} />
      </Panel>

      <Modal
        open={modalOpen}
        title={`${editing ? 'Edit' : 'Tambah'} ${config.title}`}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="tertiary" onPress={() => setModalOpen(false)}>Batal</Button>
            <Button onPress={validateAndSubmit} isPending={saveMutation.isPending}>
              {saveMutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </>
        }
      >
        <FormStack>
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
        </FormStack>
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
  const common = { label: field.label, value, required: field.required, error, onChange }
  if (type === 'textarea') return <TextAreaInput {...common} placeholder={field.placeholder} />
  if (type === 'select') return <SelectInput {...common} options={options ?? []} />
  if (type === 'checkbox') {
    return (
      <div>
        <CheckInput label={field.label} checked={!!value} onChange={onChange} />
        {error && <div className="mt-1 text-xs text-danger">{error}</div>}
      </div>
    )
  }
  return <TextInput {...common} type={type} placeholder={field.placeholder} />
}
