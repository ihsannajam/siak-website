import { AlertDialog, Button } from '@heroui/react'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function ConfirmDialog({
  open,
  title = 'Konfirmasi',
  message,
  confirmLabel = 'Hapus',
  onConfirm,
  onCancel,
  loading,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Backdrop isOpen={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog>
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>{message}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="tertiary" onPress={onCancel} isDisabled={loading}>
              Batal
            </Button>
            <Button variant="danger" onPress={onConfirm} isPending={loading}>
              {loading ? 'Memproses…' : confirmLabel}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
