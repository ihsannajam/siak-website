import type { ComponentType, SVGProps } from 'react'
import {
  Archive, Bell, Book, BookOpen, Bookmark, Books, Box, Briefcase, Calendar, Circle, Clock,
  ClockArrowRotateLeft, CreditCard, FileText, Fingerprint, Folder, GraduationCap, House, Key,
  LayoutCells, LayoutCellsLarge, LayoutHeaderCellsLarge, Link, ListCheck, Pencil, Persons,
  PersonPlus, Plane, Receipt, SealCheck, Shield, SquareCheck, Wallet,
} from '@gravity-ui/icons'

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

/** Memetakan nama ikon dari menu backend ke ikon Gravity UI (set ikon resmi HeroUI). */
const ICONS: Record<string, IconComponent> = {
  users: Persons, shield: Shield, key: Key, history: ClockArrowRotateLeft,
  school: House, calendar: Calendar, 'calendar-range': Calendar, 'calendar-days': Calendar,
  book: Book, 'book-open': BookOpen, 'layout-grid': LayoutCells, 'door-open': LayoutCellsLarge,
  archive: Archive, 'graduation-cap': GraduationCap, 'file-text': FileText, briefcase: Briefcase,
  link: Link, 'user-plus': PersonPlus, clock: Clock, folder: Folder, 'check-square': SquareCheck,
  pencil: Pencil, 'file-badge': SealCheck, 'book-marked': Bookmark, 'list-checks': ListCheck,
  receipt: Receipt, 'credit-card': CreditCard, wallet: Wallet, 'book-text': Books,
  fingerprint: Fingerprint, plane: Plane, package: Box, bell: Bell,
  'layout-dashboard': LayoutHeaderCellsLarge,
}

export function MenuIcon({ name, className = 'size-4' }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Circle
  return <Icon className={className} aria-hidden />
}
