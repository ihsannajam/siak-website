import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import type { ApiResponse } from '../lib/types'

interface DashboardData {
  students: { active: number; presentToday: number }
  ppdb: { total: number; accepted: number }
  employees: { total: number; presentToday: number }
  grades: { reportCardsPending: number; reportCardsApproved: number }
  finance: {
    cashIn: number
    cashOut: number
    balance: number
    paidInvoices: number
    outstanding: number
    pendingPayments: number
  }
  assets: { total: number; broken: number }
  tahfidz: { quality: string; count: number }[]
  recentActivities: { id: string; action: string; module?: string; detail?: string; createdAt: string }[]
}

const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

function Stat({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <div className="icon">{icon}</div>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  )
}

export function DashboardPage() {
  const { user, hasPermission } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    enabled: hasPermission('dashboard.read'),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DashboardData>>('/dashboard/summary')
      return data.data
    },
  })

  if (!hasPermission('dashboard.read')) {
    return (
      <div>
        <div className="page-header">
          <h1>Selamat datang, {user?.fullName} 👋</h1>
        </div>
        <div className="card">
          <div className="card-body">Silakan pilih menu di samping untuk mulai bekerja.</div>
        </div>
      </div>
    )
  }

  if (isLoading || !data) return <div className="page-loader">Memuat dashboard…</div>

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stat-grid">
        <Stat icon="🎓" label="Siswa Aktif" value={data.students.active} />
        <Stat icon="➕" label="Pendaftar PPDB" value={data.ppdb.total} />
        <Stat icon="✅" label="PPDB Diterima" value={data.ppdb.accepted} />
        <Stat icon="💼" label="Total Pegawai" value={data.employees.total} />
        <Stat icon="📊" label="Hadir Siswa (hari ini)" value={data.students.presentToday} />
        <Stat icon="🔏" label="Hadir Pegawai (hari ini)" value={data.employees.presentToday} />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="toolbar">
            <strong>💰 Ringkasan Keuangan</strong>
          </div>
          <div className="card-body">
            <p>Kas Masuk: <strong style={{ color: 'var(--primary)' }}>{rupiah(data.finance.cashIn)}</strong></p>
            <p>Kas Keluar: <strong style={{ color: 'var(--danger)' }}>{rupiah(data.finance.cashOut)}</strong></p>
            <p>Saldo Kas: <strong>{rupiah(data.finance.balance)}</strong></p>
            <p>Tunggakan: <strong style={{ color: 'var(--warning)' }}>{rupiah(data.finance.outstanding)}</strong></p>
            <p>Pembayaran menunggu verifikasi: <strong>{data.finance.pendingPayments}</strong></p>
          </div>
        </div>

        <div className="card">
          <div className="toolbar">
            <strong>📑 Akademik & Aset</strong>
          </div>
          <div className="card-body">
            <p>Rapor belum selesai: <strong>{data.grades.reportCardsPending}</strong></p>
            <p>Rapor disetujui: <strong>{data.grades.reportCardsApproved}</strong></p>
            <p>Total aset: <strong>{data.assets.total}</strong> (rusak: {data.assets.broken})</p>
            <p style={{ marginBottom: 4 }}>Capaian Tahfidz:</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {data.tahfidz.length === 0 && <span className="pill pill-gray">Belum ada data</span>}
              {data.tahfidz.map((t) => (
                <span key={t.quality} className="pill pill-green">
                  {t.quality}: {t.count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="toolbar">
          <strong>🕘 Aktivitas Terbaru</strong>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aksi</th>
                <th>Modul</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.recentActivities.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">Belum ada aktivitas</td>
                </tr>
              )}
              {data.recentActivities.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.createdAt).toLocaleString('id-ID')}</td>
                  <td><span className="pill pill-blue">{a.action}</span></td>
                  <td>{a.module ?? '-'}</td>
                  <td>{a.detail ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
