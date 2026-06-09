import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { icon } from '../lib/icons'
import type { ApiResponse, MenuItem } from '../lib/types'

const ROLE_LABEL: Record<string, string> = {
  ADMIN_TU: 'Admin TU',
  GURU: 'Guru',
  KEPALA_SEKOLAH: 'Kepala Sekolah',
  YAYASAN: 'Yayasan',
}

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const { data: menu } = useQuery({
    queryKey: ['menu'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MenuItem[]>>('/menu')
      return data.data
    },
  })

  // Group menu items by their group label, keeping Dashboard first.
  const groups: Record<string, MenuItem[]> = {}
  for (const item of menu ?? []) {
    ;(groups[item.group] ??= []).push(item)
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">🕌 SIAK An Nahl</div>
        <nav style={{ paddingBottom: 20 }}>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setOpen(false)}
          >
            <span>{icon('layout-dashboard')}</span> Dashboard
          </NavLink>
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div className="sidebar-group">{group}</div>
              {items
                .filter((i) => i.key !== 'dashboard')
                .map((item) => (
                  <NavLink
                    key={item.key}
                    to={`/${item.key}`}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    <span>{icon(item.icon)}</span> {item.label}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setOpen((o) => !o)}>
            ☰
          </button>
          <div style={{ fontWeight: 600 }}>Sistem Informasi Akademik</div>
          <div className="topbar-user">
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{user?.fullName}</div>
              <span className="badge-role">
                {user?.roles.map((r) => ROLE_LABEL[r] ?? r).join(', ')}
              </span>
            </div>
            <div className="avatar">{user?.fullName?.charAt(0).toUpperCase()}</div>
            <button className="btn btn-sm btn-secondary" onClick={handleLogout}>
              Keluar
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
