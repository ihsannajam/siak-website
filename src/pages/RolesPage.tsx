import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../auth/AuthContext'

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
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      toast.success('Role dihapus')
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
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
    if (!form.name || !form.displayName) return toast.error('Nama dan label role wajib diisi')
    saveMutation.mutate()
  }

  const roles = listQuery.data ?? []
  const grouped = permsQuery.data?.grouped ?? {}
  const selected = new Set<string>(form.permissionIds ?? [])

  return (
    <div>
      <div className="page-header">
        <h1>Manajemen Role</h1>
        {canCreate && (
          <button className="btn btn-primary" onClick={openCreate}>
            + Tambah Role
          </button>
        )}
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Label</th>
                <th>Jumlah Permission</th>
                <th>Jumlah User</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && (
                <tr>
                  <td colSpan={5} className="empty">
                    Memuat…
                  </td>
                </tr>
              )}
              {!listQuery.isLoading && roles.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    Belum ada role
                  </td>
                </tr>
              )}
              {roles.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code>{r.name}</code>
                  </td>
                  <td>{r.displayName}</td>
                  <td>{(r.rolePermissions ?? []).length}</td>
                  <td>{r._count?.userRoles ?? 0}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {canUpdate && (
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(r)}>
                        Edit
                      </button>
                    )}{' '}
                    {canDelete && (
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteId(r.id)}>
                        Hapus
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Role' : 'Tambah Role'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        <div className="grid-2">
          <div className="form-group">
            <label>
              Nama (kode) <span className="req">*</span>
            </label>
            <input
              className="input"
              placeholder="mis. WALI_KELAS"
              value={form.name ?? ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>
              Label <span className="req">*</span>
            </label>
            <input
              className="input"
              placeholder="mis. Wali Kelas"
              value={form.displayName ?? ''}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Deskripsi</label>
          <textarea
            rows={2}
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <label style={{ fontWeight: 600 }}>Hak Akses (Permission)</label>
        <div style={{ marginTop: 8 }}>
          {Object.entries(grouped).map(([module, perms]) => {
            const allOn = perms.every((p) => selected.has(p.id))
            return (
              <div key={module} className="card" style={{ marginBottom: 8 }}>
                <div className="card-body" style={{ padding: 10 }}>
                  <label className="checkbox-row" style={{ margin: 0, fontWeight: 600 }}>
                    <input type="checkbox" checked={allOn} onChange={() => toggleModule(perms)} />
                    {module}
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6, paddingLeft: 24 }}>
                    {perms.map((p) => (
                      <label key={p.id} className="checkbox-row" style={{ margin: 0, fontSize: 13 }}>
                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => togglePerm(p.id)} />
                        {p.action}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
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
