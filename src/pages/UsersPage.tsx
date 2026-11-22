import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@heroui/react'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../auth/AuthContext'
import { Button } from '@heroui/react'
import { Plus } from '@gravity-ui/icons'
import {
  CheckInput, DataTable, EditDeleteActions, FormGrid, FormStack, PageHeader, Panel, SearchBox,
  SectionTitle, StatusChip, TablePager, TextInput, Toolbar,
} from '../components/ui'

type Row = Record<string, any>

export function UsersPage() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form, setForm] = useState<Row>({ isActive: true, roleIds: [] })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const canCreate = hasPermission('users.create')
  const canUpdate = hasPermission('users.update')
  const canDelete = hasPermission('users.delete')

  const rolesQuery = useQuery({
    queryKey: ['roles-options'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Row[]>>('/roles')
      return data.data
    },
  })

  const listQuery = useQuery({
    queryKey: ['users', page, search],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Row[]>>('/users', { params: { page, limit: 10, search } })
      return data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Row = {
        username: form.username,
        email: form.email,
        fullName: form.fullName,
        isActive: !!form.isActive,
        roleIds: form.roleIds ?? [],
      }
      if (form.password) payload.password = form.password
      if (editing) return api.put(`/users/${editing.id}`, payload)
      return api.post('/users', payload)
    },
    onSuccess: () => {
      toast.success(editing ? 'User diperbarui' : 'User dibuat')
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success('User dihapus')
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e) => toast.danger(getErrorMessage(e)),
  })

  function openCreate() {
    setEditing(null)
    setForm({ isActive: true, roleIds: [] })
    setModalOpen(true)
  }

  function openEdit(row: Row) {
    setEditing(row)
    setForm({
      username: row.username,
      email: row.email,
      fullName: row.fullName,
      isActive: row.isActive,
      password: '',
      roleIds: (row.userRoles ?? []).map((ur: Row) => ur.role.id),
    })
    setModalOpen(true)
  }

  function toggleRole(id: string) {
    const set = new Set<string>(form.roleIds ?? [])
    if (set.has(id)) set.delete(id)
    else set.add(id)
    setForm({ ...form, roleIds: [...set] })
  }

  function submit() {
    if (!form.username || !form.email || !form.fullName) return toast.danger('Username, email, dan nama wajib diisi')
    if (!editing && !form.password) return toast.danger('Password wajib diisi untuk user baru')
    if (!(form.roleIds ?? []).length) return toast.danger('Pilih minimal satu role')
    saveMutation.mutate()
  }

  const items = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  const bind = (name: string) => ({
    value: form[name],
    onChange: (v: string) => setForm({ ...form, [name]: v }),
  })

  return (
    <div>
      <PageHeader
        title="Manajemen User"
        actions={canCreate && <Button onPress={openCreate}><Plus />Tambah User</Button>}
      />

      <Panel>
        <Toolbar>
          <SearchBox placeholder="Cari username / nama / email…" value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
        </Toolbar>
        <DataTable
          label="Daftar user"
          columns={[{ label: 'Username' }, { label: 'Nama' }, { label: 'Email' }, { label: 'Role' }, { label: 'Aktif' }, { label: 'Aksi', align: 'right' }]}
          rows={items}
          isLoading={listQuery.isLoading}
          emptyText="Belum ada user"
          renderRow={(u) => [
            u.username,
            u.fullName,
            u.email,
            <div className="flex flex-wrap gap-1">
              {(u.userRoles ?? []).map((ur: Row) => (
                <StatusChip key={ur.role.id} color="info">{ur.role.displayName ?? ur.role.name}</StatusChip>
              ))}
            </div>,
            <StatusChip color={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Aktif' : 'Nonaktif'}</StatusChip>,
            <EditDeleteActions
              onEdit={canUpdate ? () => openEdit(u) : undefined}
              onDelete={canDelete ? () => setDeleteId(u.id) : undefined}
            />,
          ]}
        />
        <TablePager meta={meta} page={page} onChange={setPage} />
      </Panel>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit User' : 'Tambah User'}
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
            <TextInput label="Username" required {...bind('username')} />
            <TextInput label="Nama Lengkap" required {...bind('fullName')} />
            <TextInput label="Email" type="email" required {...bind('email')} />
            <TextInput
              label={editing ? 'Password (kosongkan jika tidak diubah)' : 'Password'}
              type="password"
              required={!editing}
              {...bind('password')}
            />
          </FormGrid>
          <div className="flex flex-col gap-2">
            <SectionTitle>Role <span className="text-danger">*</span></SectionTitle>
            <div className="flex flex-wrap gap-4">
              {(rolesQuery.data ?? []).map((r) => (
                <CheckInput
                  key={r.id}
                  label={r.displayName ?? r.name}
                  checked={(form.roleIds ?? []).includes(r.id)}
                  onChange={() => toggleRole(r.id)}
                />
              ))}
            </div>
          </div>
          <CheckInput label="Akun aktif" checked={!!form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
        </FormStack>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        message="Yakin ingin menghapus user ini?"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
