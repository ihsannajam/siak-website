import type { ReactNode } from 'react'
import {
  Button, Card, Checkbox, Chip, FieldError, Input, Label, ListBox, Pagination, SearchField,
  Select, Spinner, Table, TextArea, TextField, Tooltip,
} from '@heroui/react'
import { PencilToSquare, TrashBin } from '@gravity-ui/icons'

export type ChipColor = 'default' | 'accent' | 'info' | 'success' | 'warning' | 'danger'
export interface Option {
  value: string | number
  label: string
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Kartu pembungkus tabel atau konten tanpa padding bawaan. */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Card className={`gap-0 overflow-hidden p-0 ${className}`}>{children}</Card>
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3 border-b border-separator p-4">{children}</div>
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>
}

export function FormStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4 p-1">{children}</div>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h4 className="text-sm font-bold text-foreground">{children}</h4>
}

export function Loader({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-10 text-muted">
      <Spinner size="sm" />
      <span>{label}</span>
    </div>
  )
}

export function StatusChip({ color = 'default', children }: { color?: ChipColor; children: ReactNode }) {
  return (
    <Chip
      className={color === 'info' ? 'bg-blue-100 text-blue-800' : undefined}
      color={color === 'info' ? 'default' : color}
      size="sm"
      variant="soft"
    >
      <Chip.Label>{children}</Chip.Label>
    </Chip>
  )
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <SearchField aria-label={placeholder} className="w-full sm:w-72" value={value} onChange={onChange}>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input placeholder={placeholder} />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  )
}

interface FieldProps {
  label: string
  value: unknown
  onChange: (v: string) => void
  required?: boolean
  disabled?: boolean
  error?: string
  placeholder?: string
}

export function TextInput({ label, value, onChange, required, disabled, error, placeholder, type = 'text', autoFocus }: FieldProps & { type?: string; autoFocus?: boolean }) {
  return (
    <TextField className="w-full" type={type} isRequired={required} isDisabled={disabled} isInvalid={!!error} value={String(value ?? '')} onChange={onChange}>
      <Label>{label}</Label>
      <Input placeholder={placeholder} autoFocus={autoFocus} />
      {error && <FieldError>{error}</FieldError>}
    </TextField>
  )
}

export function TextAreaInput({ label, value, onChange, required, disabled, error, placeholder, rows = 3 }: FieldProps & { rows?: number }) {
  return (
    <TextField className="w-full" isRequired={required} isDisabled={disabled} isInvalid={!!error} value={String(value ?? '')} onChange={onChange}>
      <Label>{label}</Label>
      <TextArea rows={rows} placeholder={placeholder} />
      {error && <FieldError>{error}</FieldError>}
    </TextField>
  )
}

const EMPTY_KEY = '__empty__'

/** Select HeroUI dengan nilai string; pilihan kosong dikirim sebagai ''. */
export function SelectInput({
  label, ariaLabel, value, onChange, options, required, disabled, error, emptyLabel = '— Pilih —', noEmpty, className = 'w-full',
}: Omit<FieldProps, 'label' | 'placeholder'> & {
  label?: string
  ariaLabel?: string
  options: Option[]
  emptyLabel?: string
  noEmpty?: boolean
  className?: string
}) {
  const current = value === '' || value == null ? (noEmpty ? null : EMPTY_KEY) : String(value)
  return (
    <Select
      aria-label={label ? undefined : ariaLabel}
      className={className}
      isRequired={required}
      isDisabled={disabled}
      isInvalid={!!error}
      placeholder={emptyLabel}
      value={current}
      onChange={(key) => onChange(key == null || key === EMPTY_KEY ? '' : String(key))}
    >
      {label && <Label>{label}</Label>}
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      {error && <FieldError>{error}</FieldError>}
      <Select.Popover>
        <ListBox>
          {!noEmpty && (
            <ListBox.Item id={EMPTY_KEY} textValue={emptyLabel}>
              {emptyLabel}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          )}
          {options.map((o) => (
            <ListBox.Item key={o.value} id={String(o.value)} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

export function CheckInput({ label, checked, onChange, className }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <Checkbox className={className} isSelected={checked} onChange={onChange}>
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
      <Checkbox.Content>
        <Label>{label}</Label>
      </Checkbox.Content>
    </Checkbox>
  )
}

export interface TableColumnDef {
  label: string
  align?: 'right'
}

export function DataTable<T extends Record<string, any>>({
  label, columns, rows, isLoading, emptyText = 'Belum ada data', renderRow,
}: {
  label: string
  columns: TableColumnDef[]
  rows: T[]
  isLoading?: boolean
  emptyText?: string
  renderRow: (row: T) => ReactNode[]
}) {
  const alignClass = (i: number) => (columns[i]?.align === 'right' ? 'text-right' : '')
  return (
    <Table variant="secondary" className="rounded-none">
      <Table.ScrollContainer>
        <Table.Content aria-label={label}>
          <Table.Header>
            {columns.map((c, i) => (
              <Table.Column key={c.label} id={`col-${i}`} isRowHeader={i === 0} className={alignClass(i)}>
                {c.label}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body
            renderEmptyState={() =>
              isLoading ? <Loader /> : <div className="p-10 text-center text-muted">{emptyText}</div>
            }
          >
            {rows.map((row) => (
              <Table.Row key={row.id} id={row.id}>
                {renderRow(row).map((cell, i) => (
                  <Table.Cell key={i} className={alignClass(i)}>
                    {cell}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  )
}

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-1 whitespace-nowrap">{children}</div>
}

export function IconAction({ label, onPress, danger, icon }: { label: string; onPress: () => void; danger?: boolean; icon: ReactNode }) {
  return (
    <Tooltip delay={200}>
      <Button isIconOnly aria-label={label} size="sm" variant={danger ? 'danger-soft' : 'ghost'} onPress={onPress}>
        {icon}
      </Button>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  )
}

export function EditDeleteActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <RowActions>
      {onEdit && <IconAction label="Edit" icon={<PencilToSquare />} onPress={onEdit} />}
      {onDelete && <IconAction danger label="Hapus" icon={<TrashBin />} onPress={onDelete} />}
    </RowActions>
  )
}

function pageList(current: number, total: number): (number | 'gap')[] {
  const wanted = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  wanted.forEach((p, i) => {
    if (i > 0 && p - wanted[i - 1] > 1) out.push('gap')
    out.push(p)
  })
  return out
}

export function TablePager({ meta, page, onChange }: {
  meta?: { page: number; totalPages: number; total: number }
  page: number
  onChange: (page: number) => void
}) {
  if (!meta || meta.totalPages <= 1) return null
  return (
    <div className="border-t border-separator p-3">
      <Pagination size="sm">
        <Pagination.Summary>{meta.total} data</Pagination.Summary>
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous isDisabled={page <= 1} onPress={() => onChange(page - 1)}>
              <Pagination.PreviousIcon />
              <span>Sebelumnya</span>
            </Pagination.Previous>
          </Pagination.Item>
          {pageList(page, meta.totalPages).map((p, i) => (
            <Pagination.Item key={p === 'gap' ? `gap-${i}` : p}>
              {p === 'gap' ? (
                <Pagination.Ellipsis />
              ) : (
                <Pagination.Link isActive={p === page} onPress={() => onChange(p)}>
                  {p}
                </Pagination.Link>
              )}
            </Pagination.Item>
          ))}
          <Pagination.Item>
            <Pagination.Next isDisabled={page >= meta.totalPages} onPress={() => onChange(page + 1)}>
              <span>Berikutnya</span>
              <Pagination.NextIcon />
            </Pagination.Next>
          </Pagination.Item>
        </Pagination.Content>
      </Pagination>
    </div>
  )
}
