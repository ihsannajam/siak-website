import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { icon } from '../lib/icons'
import type { ApiResponse, MenuItem } from '../lib/types'
import logoSidebar from '../assets/logo-horizontal.png'

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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

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

  useEffect(() => {
    if (!menu) return

    const nextState: Record<string, boolean> = {}
    Object.keys(groups).forEach((group, index) => {
      nextState[group] = index === 0
    })
    setExpandedGroups(nextState)
  }, [menu])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <img className="sidebar-brand" src={logoSidebar} alt="Logo An Nahl ANDA" />
        <nav style={{ paddingBottom: 20 }}>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setOpen(false)}
          >
            <span>{icon('layout-dashboard')}</span> Dashboard
          </NavLink>
          {Object.entries(groups).map(([group, items]) => {
            const visibleItems = items.filter((i) => i.key !== 'dashboard')
            if (visibleItems.length === 0) return null

            return (
              <div key={group}>
                <button
                  type="button"
                  className={`sidebar-group ${expandedGroups[group] ? 'expanded' : ''}`}
                  onClick={() =>
                    setExpandedGroups((prev) => ({
                      ...prev,
                      [group]: !prev[group],
                    }))
                  }
                >
                  <span className="sidebar-group-title">
                    <span className="sidebar-group-icon">{icon(visibleItems[0]?.icon ?? 'layout-dashboard')}</span>
                    <span>{group}</span>
                  </span>
                  <span className="sidebar-group-chevron">▾</span>
                </button>
                <div className={`sidebar-submenu ${expandedGroups[group] ? 'open' : ''}`}>
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.key}
                      to={`/${item.key}`}
                      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
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
