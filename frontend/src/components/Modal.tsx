import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from './Icons'

export function Modal({ title, subtitle, children, onClose, wide = false, busy = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const subtitleId = useId()
  useEffect(() => {
    const dialog = ref.current!
    const previous = document.activeElement as HTMLElement | null
    dialog.showModal()
    return () => { dialog.close(); previous?.focus() }
  }, [])
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} aria-labelledby={titleId} aria-describedby={subtitle ? subtitleId : undefined} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="modal-header"><div><span className="eyebrow">CADASTROS / SYSOS</span><h2 id={titleId}>{title}</h2>{subtitle && <p id={subtitleId}>{subtitle}</p>}</div><button className="icon-button" disabled={busy} onClick={onClose} aria-label="Fechar janela"><X size={20} /></button></div>
    {children}
  </dialog>
}
