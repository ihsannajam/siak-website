import type { ReactNode } from 'react'
import { Modal as HeroModal } from '@heroui/react'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, title, onClose, children, footer, size = 'lg' }: ModalProps) {
  return (
    <HeroModal.Backdrop isOpen={open} onOpenChange={(next) => !next && onClose()}>
      <HeroModal.Container scroll="inside" size={size}>
        <HeroModal.Dialog>
          <HeroModal.CloseTrigger aria-label="Tutup" />
          <HeroModal.Header>
            <HeroModal.Heading>{title}</HeroModal.Heading>
          </HeroModal.Header>
          <HeroModal.Body>{children}</HeroModal.Body>
          {footer && <HeroModal.Footer>{footer}</HeroModal.Footer>}
        </HeroModal.Dialog>
      </HeroModal.Container>
    </HeroModal.Backdrop>
  )
}
