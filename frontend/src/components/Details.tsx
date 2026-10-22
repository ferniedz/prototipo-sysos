import { useEffect, useState } from 'react'
import { Monitor } from './Icons'
import { errorMessage, type Api } from '../lib/api'
import { displayDate, type Client, type Equipment } from '../lib/registry'

export function ClientDetails({ api, client, onEquipment }: { api: Api; client: Client; onEquipment: (client: Client) => void }) {
  const [state, setState] = useState<{ client?: Client; error?: string }>({})
  useEffect(() => {
    const controller = new AbortController()
    void api.getClient(client.id, controller.signal).then(result => {
      if (!controller.signal.aborted) setState({ client: result })
    }).catch(error => { if (!controller.signal.aborted) setState({ error: errorMessage(error) }) })
    return () => controller.abort()
  }, [api, client.id])
  if (state.error) return <div className="detail-body"><div className="error-notice" role="alert">{state.error}</div></div>
  if (!state.client) return <div className="detail-body" role="status">Consultando cliente...</div>
  const data = state.client
  return <div className="detail-body">
    <dl className="detail-grid"><div><dt>Identificador</dt><dd>{data.code}</dd></div><div><dt>Cadastrado em</dt><dd>{displayDate(data.createdAt)}</dd></div>
      <div><dt>Telefone</dt><dd>{data.phone || 'Não informado'}</dd></div><div><dt>E-mail</dt><dd>{data.email || 'Não informado'}</dd></div>
    </dl>
    <button className="button secondary" onClick={() => onEquipment(data)}><Monitor size={17} />Consultar equipamentos deste cliente</button>
  </div>
}

export function EquipmentDetails({ api, client, code }: { api: Api; client: Client; code: string }) {
  const [state, setState] = useState<{ item?: Equipment; error?: string }>({})
  useEffect(() => {
    const controller = new AbortController()
    void api.getEquipment(client.id, code, controller.signal).then(item => {
      if (!controller.signal.aborted) setState({ item })
    }).catch(error => { if (!controller.signal.aborted) setState({ error: errorMessage(error) }) })
    return () => controller.abort()
  }, [api, client.id, code])
  if (state.error) return <div className="detail-body"><div className="error-notice" role="alert">{state.error}</div></div>
  if (!state.item) return <div className="detail-body" role="status">Consultando equipamento...</div>
  const item = state.item
  return <div className="detail-body"><dl className="detail-grid">
    <div><dt>Cliente vinculado</dt><dd>{client.name} · {client.code}</dd></div><div><dt>Código interno neste cliente</dt><dd>#{item.code}</dd></div>
    <div><dt>Tipo</dt><dd>{item.type}</dd></div><div><dt>Marca</dt><dd>{item.brand || 'Não informada'}</dd></div>
    <div><dt>Modelo</dt><dd>{item.model || 'Não informado'}</dd></div><div><dt>Número de série</dt><dd>{item.serial || 'Não informado'}</dd></div>
    <div><dt>Cadastrado em</dt><dd>{displayDate(item.createdAt)}</dd></div>
  </dl></div>
}
