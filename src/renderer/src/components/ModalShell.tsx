import { useEffect, useRef } from 'react'

export default function ModalShell({
  title,
  onClose,
  className = '',
  children
}: {
  title?: string
  onClose: () => void
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className={`modal-card ${className}`.trim()} ref={ref}>
        {title && <h2 className="modal-title">{title}</h2>}
        {children}
      </div>
    </div>
  )
}
