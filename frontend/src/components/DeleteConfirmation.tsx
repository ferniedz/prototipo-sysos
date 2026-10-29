import { useRef, useState, type FormEvent } from 'react'
import { errorMessage } from '../lib/api'

export function DeleteConfirmation({ resource, description, onDelete, onDeleted, onCancel, onBusyChange }: {
  resource: 'cliente' | 'equipamento'
  description: string
  onDelete: () => Promise<unknown>
  onDeleted: () => void
  onCancel: () => void
  onBusyChange?: (busy: boolean) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true
    setDeleting(true); setError(''); onBusyChange?.(true)
    try {
      await onDelete()
      onDeleted()
    } catch (cause) { setError(errorMessage(cause)) }
    finally { pending.current = false; setDeleting(false); onBusyChange?.(false) }
  }
  return <form onSubmit={submit} aria-busy={deleting}>
    <div className="form-body delete-confirmation">
      <p>Confirma a exclusão {resource === 'cliente' ? 'do cliente' : 'do equipamento'} <strong>{description}</strong>?</p>
      <p>{resource === 'cliente'
        ? 'Clientes com equipamentos ou ordens de serviço vinculados não podem ser excluídos.'
        : 'Equipamentos com ordens de serviço vinculadas não podem ser excluídos.'}</p>
      {error && <div className="error-notice" role="alert">{error}</div>}
    </div>
    <div className="modal-footer"><div className="delete-confirmation-actions">
      <button autoFocus type="button" className="button secondary" disabled={deleting} onClick={onCancel}>Cancelar</button>
      <button type="submit" className="button danger" disabled={deleting}>{deleting ? 'Excluindo...' : 'Confirmar exclusão'}</button>
    </div></div>
  </form>
}
