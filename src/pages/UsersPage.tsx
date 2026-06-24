import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../lib/types'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../auth/AuthContext'

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
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success('User dihapus')
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
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
    if (!form.username || !form.email || !form.fullName) return toast.error('Username, email, dan nama wajib diisi')
    if (!editing && !form.password) return toast.error('Password wajib diisi untuk user baru')
    if (!(form.roleIds ?? []).length) return toast.error('Pilih minimal satu role')
    saveMutation.mutate()
  }

  const items = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div>
      <div className="page-header">
        <h1>Manajemen User</h1>
        {canCreate && (
          <button className="btn btn-primary" onClick={openCreate}>
            + Tambah User
          </button>
        )}
      </div>

      <div className="card">
        <div className="toolbar">
          <input
            className="input search-input"
            placeholder="Cari username / nama / email…"
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
                <th>Username</th>
                <th>Nama</th>
                <th>Email</th>
                <th>Role</th>
                <th>Aktif</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="empty">
                    Memuat…
                  </td>
                </tr>
              )}
              {!listQuery.isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    Belum ada user
                  </td>
                </tr>
              )}
              {items.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>
                    {(u.userRoles ?? []).map((ur: Row) => (
                      <span key={ur.role.id} className="pill pill-blue" style={{ marginRight: 4 }}>
                        {ur.role.displayName ?? ur.role.name}
                      </span>
                    ))}
                  </td>
                  <td>
                    <span className={`pill ${u.isActive ? 'pill-green' : 'pill-red'}`}>
                      {u.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {canUpdate && (
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(u)}>
                        Edit
                      </button>
                    )}{' '}
                    {canDelete && (
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteId(u.id)}>
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

      <Modal
        open={modalOpen}
        title={editing ? 'Edit User' : 'Tambah User'}
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
              Username <span className="req">*</span>
            </label>
            <input
              className="input"
              value={form.username ?? ''}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>
              Nama Lengkap <span className="req">*</span>
            </label>
            <input
              className="input"
              value={form.fullName ?? ''}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label>
              Email <span className="req">*</span>
            </label>
            <input
              className="input"
              type="email"
              value={form.email ?? ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>
              Password {editing ? '(kosongkan jika tidak diubah)' : <span className="req">*</span>}
            </label>
            <input
              className="input"
              type="password"
              value={form.password ?? ''}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label>
            Role <span className="req">*</span>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {(rolesQuery.data ?? []).map((r) => (
              <label key={r.id} className="checkbox-row" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={(form.roleIds ?? []).includes(r.id)}
                  onChange={() => toggleRole(r.id)}
                />
                {r.displayName ?? r.name}
              </label>
            ))}
          </div>
        </div>

        <div className="checkbox-row">
          <input
            type="checkbox"
            checked={!!form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          <label style={{ margin: 0 }}>Akun aktif</label>
        </div>
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
