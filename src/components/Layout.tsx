import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Button, Chip, Disclosure, Drawer } from '@heroui/react'
import { ArrowRightFromSquare, Bars } from '@gravity-ui/icons'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { MenuIcon } from '../lib/icons'
import type { ApiResponse, MenuItem } from '../lib/types'
import logoSidebar from '../assets/logo-horizontal.png'

const ROLE_LABEL: Record<string, string> = {
  ADMIN_TU: 'Admin TU',
  GURU: 'Guru',
  KEPALA_SEKOLAH: 'Kepala Sekolah',
  YAYASAN: 'Yayasan',
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${
    isActive
      ? 'bg-accent font-bold text-accent-foreground'
      : 'text-muted hover:bg-default hover:text-foreground'
  }`

function SidebarNav({ menu, onNavigate }: { menu: MenuItem[]; onNavigate: () => void }) {
  const { pathname } = useLocation()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const groups: Record<string, MenuItem[]> = {}
  for (const item of menu) {
    if (item.key !== 'dashboard') (groups[item.group] ??= []).push(item)
  }

  return (
    <nav className="flex flex-col gap-1 px-3 pb-5">
      <NavLink to="/dashboard" className={linkClass} onClick={onNavigate}>
        <MenuIcon name="layout-dashboard" /> Dashboard
      </NavLink>
      {Object.entries(groups).map(([group, items]) => {
        const hasActive = items.some((i) => pathname === `/${i.key}`)
        return (
          <Disclosure
            key={group}
            isExpanded={expanded[group] ?? hasActive}
            onExpandedChange={(next) => setExpanded((prev) => ({ ...prev, [group]: next }))}
          >
            <Disclosure.Heading>
              <Disclosure.Trigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted hover:bg-default hover:text-foreground">
                {group}
                <Disclosure.Indicator />
              </Disclosure.Trigger>
            </Disclosure.Heading>
            <Disclosure.Content>
              <Disclosure.Body className="flex flex-col gap-0.5 p-0 pb-1">
                {items.map((item) => (
                  <NavLink key={item.key} to={`/${item.key}`} className={linkClass} onClick={onNavigate}>
                    <MenuIcon name={item.icon} /> {item.label}
                  </NavLink>
                ))}
              </Disclosure.Body>
            </Disclosure.Content>
          </Disclosure>
        )
      })}
    </nav>
  )
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

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const brand = <img className="h-12 object-contain" src={logoSidebar} alt="Logo An Nahl ANDA" />

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-68 flex-col overflow-y-auto border-r border-separator bg-surface lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">{brand}</div>
        <SidebarNav menu={menu ?? []} onNavigate={() => undefined} />
      </aside>

      <Drawer.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Drawer.Content placement="left">
          <Drawer.Dialog aria-label="Menu navigasi" className="w-72 p-0">
            <Drawer.CloseTrigger aria-label="Tutup menu" />
            <Drawer.Header className="px-5 py-2">{brand}</Drawer.Header>
            <Drawer.Body className="p-0">
              <SidebarNav menu={menu ?? []} onNavigate={() => setOpen(false)} />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-68">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-separator bg-surface/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <Button isIconOnly aria-label="Buka menu" className="lg:hidden" variant="ghost" onPress={() => setOpen(true)}>
              <Bars />
            </Button>
            <span className="hidden font-bold sm:inline">Sistem Informasi Akademik</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-[13px] font-bold">{user?.fullName}</div>
              <Chip color="accent" size="sm" variant="soft">
                <Chip.Label>{user?.roles.map((r) => ROLE_LABEL[r] ?? r).join(', ')}</Chip.Label>
              </Chip>
            </div>
            <Avatar color="accent" size="sm" variant="soft">
              <Avatar.Fallback>{user?.fullName?.charAt(0).toUpperCase()}</Avatar.Fallback>
            </Avatar>
            <Button size="sm" variant="tertiary" onPress={handleLogout}>
              <ArrowRightFromSquare />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
