import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@heroui/react'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../auth/AuthContext'
import { Button, Card } from '@heroui/react'
import { Plus } from '@gravity-ui/icons'
import {
  CheckInput, DataTable, EditDeleteActions, FormGrid, FormStack, PageHeader, Panel, SectionTitle,
  TextAreaInput, TextInput,
} from '../components/ui'

type Row = Record<string, any>
interface PermResponse {
  flat: Row[]
  grouped: Record<string, Row[]>
}

export function RolesPage() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form, setForm] = useState<Row>({ permissionIds: [] })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const canCreate = hasPermission('roles.create')
  const canUpdate = hasPermission('roles.update')
  const canDelete = hasPermission('roles.delete')

  const permsQuery = useQuery({
    queryKey: ['permissions-catalog'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<PermResponse>>('/permissions')
      return data.data
    },
  })

  const listQuery = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Row[]>>('/roles')
      return data.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        displayName: form.displayName,
        description: form.description || null,
        permissionIds: form.permissionIds ?? [],
      }
      if (editing) return api.put(`/roles/${editing.id}`, payload)
      return api.post('/roles', payload)
    },
    onSuccess: () => {
      toast.success(editing ? 'Role diperbarui' : 'Role dibuat')
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      toast.success('Role dihapus')
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  function openCreate() {
    setEditing(null)
    setForm({ permissionIds: [] })
    setModalOpen(true)
  }

  function openEdit(role: Row) {
    setEditing(role)
    setForm({
      name: role.name,
      displayName: role.displayName,
      description: role.description ?? '',
      permissionIds: (role.rolePermissions ?? []).map((rp: Row) => rp.permission.id),
    })
    setModalOpen(true)
  }

  function togglePerm(id: string) {
    const set = new Set<string>(form.permissionIds ?? [])
    if (set.has(id)) set.delete(id)
    else set.add(id)
    setForm({ ...form, permissionIds: [...set] })
  }

  function toggleModule(perms: Row[]) {
    const ids = perms.map((p) => p.id)
    const set = new Set<string>(form.permissionIds ?? [])
    const allOn = ids.every((id) => set.has(id))
    ids.forEach((id) => (allOn ? set.delete(id) : set.add(id)))
    setForm({ ...form, permissionIds: [...set] })
  }

  function submit() {
    if (!form.name || !form.displayName) return toast.danger('Nama dan label role wajib diisi')
    saveMutation.mutate()
  }

  const roles = listQuery.data ?? []
  const grouped = permsQuery.data?.grouped ?? {}
  const selected = new Set<string>(form.permissionIds ?? [])

  const bind = (name: string) => ({
    value: form[name],
    onChange: (v: string) => setForm({ ...form, [name]: v }),
  })

  return (
    <div>
      <PageHeader
        title="Manajemen Role"
        actions={canCreate && <Button onPress={openCreate}><Plus />Tambah Role</Button>}
      />

      <Panel>
        <DataTable
          label="Daftar role"
          columns={[{ label: 'Nama' }, { label: 'Label' }, { label: 'Jumlah Permission' }, { label: 'Jumlah User' }, { label: 'Aksi', align: 'right' }]}
          rows={roles}
          isLoading={listQuery.isLoading}
          emptyText="Belum ada role"
          renderRow={(r) => [
            <code className="text-xs">{r.name}</code>,
            r.displayName,
            (r.rolePermissions ?? []).length,
            r._count?.userRoles ?? 0,
            <EditDeleteActions
              onEdit={canUpdate ? () => openEdit(r) : undefined}
              onDelete={canDelete ? () => setDeleteId(r.id) : undefined}
            />,
          ]}
        />
      </Panel>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Role' : 'Tambah Role'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="tertiary" onPress={() => setModalOpen(false)}>Batal</Button>
            <Button onPress={submit} isPending={saveMutation.isPending}>
              {saveMutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </>
        }
      >
        <FormStack>
          <FormGrid>
            <TextInput label="Nama (kode)" required placeholder="mis. WALI_KELAS" {...bind('name')} />
            <TextInput label="Label" required placeholder="mis. Wali Kelas" {...bind('displayName')} />
          </FormGrid>
          <TextAreaInput label="Deskripsi" rows={2} {...bind('description')} />
          <SectionTitle>Hak Akses (Permission)</SectionTitle>
          <div className="flex flex-col gap-2">
            {Object.entries(grouped).map(([module, perms]) => (
              <Card key={module} variant="secondary" className="gap-2 p-3">
                <CheckInput
                  label={<strong>{module}</strong>}
                  checked={perms.every((p) => selected.has(p.id))}
                  onChange={() => toggleModule(perms)}
                />
                <div className="flex flex-wrap gap-3 pl-6">
                  {perms.map((p) => (
                    <CheckInput key={p.id} label={p.action} checked={selected.has(p.id)} onChange={() => togglePerm(p.id)} />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </FormStack>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        message="Yakin ingin menghapus role ini?"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
