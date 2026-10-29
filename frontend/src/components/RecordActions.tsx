export function RecordActions({ canManage, onEdit, onDelete }: {
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  if (!canManage) return null
  return <div className="record-actions" aria-label="Ações do cadastro">
    <button className="button secondary" onClick={onEdit}>Editar</button>
    <button className="button danger-outline" onClick={onDelete}>Excluir</button>
  </div>
}
