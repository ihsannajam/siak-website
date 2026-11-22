import type { ComponentType, ReactNode, SVGProps } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@heroui/react'
import {
  Briefcase, ChartColumn, CircleCheck, ClockArrowRotateLeft, Fingerprint, GraduationCap,
  PersonPlus, SealCheck, Wallet,
} from '@gravity-ui/icons'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import type { ApiResponse } from '../lib/types'
import { DataTable, Loader, PageHeader, Panel, StatusChip } from '../components/ui'

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

type IconType = ComponentType<SVGProps<SVGSVGElement>>

const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

function Stat({ icon: Icon, label, value }: { icon: IconType; label: string; value: string | number }) {
  return (
    <Card className="flex-row items-center gap-4 p-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-[#b86500]">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="text-[12.5px] text-muted">{label}</div>
        <div className="text-2xl font-black tabular-nums">{value}</div>
      </div>
    </Card>
  )
}

function InfoRow({ label, children, tone = '' }: { label: string; children: ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-separator py-2.5 last:border-0">
      <span className="text-muted">{label}</span>
      <strong className={`tabular-nums ${tone}`}>{children}</strong>
    </div>
  )
}

function SectionCard({ icon: Icon, title, children }: { icon: IconType; title: string; children: ReactNode }) {
  return (
    <Card>
      <Card.Header className="flex-row items-center gap-2">
        <Icon className="size-4 text-muted" aria-hidden />
        <Card.Title>{title}</Card.Title>
      </Card.Header>
      <Card.Content className="gap-0">{children}</Card.Content>
    </Card>
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
        <PageHeader title={`Selamat datang, ${user?.fullName ?? ''}`} />
        <Card>
          <Card.Content>Silakan pilih menu di samping untuk mulai bekerja.</Card.Content>
        </Card>
      </div>
    )
  }

  if (isLoading || !data) return <Loader label="Memuat dashboard…" />

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Dashboard" description={`Selamat datang kembali, ${user?.fullName ?? ''}`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat icon={GraduationCap} label="Siswa Aktif" value={data.students.active} />
        <Stat icon={PersonPlus} label="Pendaftar PPDB" value={data.ppdb.total} />
        <Stat icon={CircleCheck} label="PPDB Diterima" value={data.ppdb.accepted} />
        <Stat icon={Briefcase} label="Total Pegawai" value={data.employees.total} />
        <Stat icon={ChartColumn} label="Hadir Siswa (hari ini)" value={data.students.presentToday} />
        <Stat icon={Fingerprint} label="Hadir Pegawai (hari ini)" value={data.employees.presentToday} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard icon={Wallet} title="Ringkasan Keuangan">
          <InfoRow label="Kas Masuk" tone="text-success">{rupiah(data.finance.cashIn)}</InfoRow>
          <InfoRow label="Kas Keluar" tone="text-danger">{rupiah(data.finance.cashOut)}</InfoRow>
          <InfoRow label="Saldo Kas">{rupiah(data.finance.balance)}</InfoRow>
          <InfoRow label="Tunggakan" tone="text-warning">{rupiah(data.finance.outstanding)}</InfoRow>
          <InfoRow label="Pembayaran menunggu verifikasi">{data.finance.pendingPayments}</InfoRow>
        </SectionCard>

        <SectionCard icon={SealCheck} title="Akademik & Aset">
          <InfoRow label="Rapor belum selesai">{data.grades.reportCardsPending}</InfoRow>
          <InfoRow label="Rapor disetujui">{data.grades.reportCardsApproved}</InfoRow>
          <InfoRow label="Total aset">{data.assets.total} (rusak: {data.assets.broken})</InfoRow>
          <div className="pt-3">
            <div className="mb-2 text-muted">Capaian Tahfidz</div>
            <div className="flex flex-wrap gap-2">
              {data.tahfidz.length === 0 && <StatusChip>Belum ada data</StatusChip>}
              {data.tahfidz.map((t) => (
                <StatusChip key={t.quality} color="success">{t.quality}: {t.count}</StatusChip>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <Panel>
        <div className="flex items-center gap-2 border-b border-separator p-4 font-bold">
          <ClockArrowRotateLeft className="size-4 text-muted" aria-hidden /> Aktivitas Terbaru
        </div>
        <DataTable
          label="Aktivitas terbaru"
          columns={[{ label: 'Waktu' }, { label: 'Aksi' }, { label: 'Modul' }, { label: 'Detail' }]}
          rows={data.recentActivities}
          emptyText="Belum ada aktivitas"
          renderRow={(a) => [
            new Date(a.createdAt).toLocaleString('id-ID'),
            <StatusChip color="info">{a.action}</StatusChip>,
            a.module ?? '-',
            a.detail ?? '-',
          ]}
        />
      </Panel>
    </div>
  )
}
