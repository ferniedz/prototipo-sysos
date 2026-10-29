import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUpRight, ChevronLeft, ChevronRight, Monitor, Plus, Search, UserRound, X } from './Icons'
import { errorMessage, type Api } from '../lib/api'
import { displayDate, validateClientSearch, validateId, type Client, type Equipment } from '../lib/registry'

const PAGE_SIZE = 7
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase('pt-BR')

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  return <div className="pagination">
    <button aria-label="Página anterior" disabled={page === 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /></button>
    <span>Página <strong>{page}</strong> de {pages}</span>
    <button aria-label="Próxima página" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight size={16} /></button>
  </div>
}

export function ClientSearch({ api, selecting = false, canCreate, onSelect, onDetails, onNewClient, revision = 0 }: {
  api: Api; selecting?: boolean; canCreate: boolean; revision?: number
  onSelect: (client: Client) => void; onDetails: (client: Client) => void; onNewClient: () => void
}) {
  const [query, setQuery] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [offerCreate, setOfferCreate] = useState(false)
  const [page, setPage] = useState(1)
  const [submitted, setSubmitted] = useState<{ query: string } | null>(null)
  const [loadedRevision, setLoadedRevision] = useState(revision)
  const controller = useRef<AbortController | null>(null)
  const effectiveStatus = submitted && revision !== loadedRevision ? 'loading' : status

  useEffect(() => {
    if (!submitted) return
    const request = new AbortController()
    controller.current = request
    void api.searchClients(submitted.query, request.signal).then(result => {
      if (request.signal.aborted) return
      setClients(result.clients); setOfferCreate(result.offerCreate); setStatus('success')
      setError(''); setLoadedRevision(revision); setPage(1)
    }).catch(cause => {
      if (request.signal.aborted) return
      setClients([]); setOfferCreate(false); setError(errorMessage(cause)); setStatus('error')
      setLoadedRevision(revision)
    })
    return () => request.abort()
  }, [api, submitted, revision])

  function search(event: FormEvent) {
    event.preventDefault()
    controller.current?.abort()
    setClients([]); setOfferCreate(false); setPage(1)
    const validation = validateClientSearch(query)
    if (validation) { setSubmitted(null); setError(validation); setStatus('error'); return }
    setError(''); setStatus('loading'); setSubmitted({ query: query.trim() })
  }
  function clear() {
    controller.current?.abort(); setSubmitted(null); setQuery(''); setClients([]); setOfferCreate(false); setError(''); setStatus('idle'); setPage(1)
  }
  return <section className="registry-panel" aria-labelledby="client-search-title">
    <div className="panel-heading"><h2 id="client-search-title">{selecting ? 'Selecione o cliente' : 'Buscar clientes'}</h2></div>
    <form className="toolbar" onSubmit={search} role="search" aria-label="Busca de clientes">
      <div className="search-field"><Search size={18} /><input aria-label="Buscar clientes" maxLength={150} placeholder="Nome, telefone ou e-mail (mínimo 2 caracteres)" value={query} onChange={e => setQuery(e.target.value)} />{query && <button type="button" className="icon-button" aria-label="Limpar busca" onClick={clear}><X size={15} /></button>}</div>
      <button type="submit" className="button primary" disabled={effectiveStatus === 'loading'}><Search size={16} />{effectiveStatus === 'loading' ? 'Buscando...' : 'Buscar'}</button>
    </form>
    {error && <div className="panel-message error-notice" role="alert">{error}</div>}
    {effectiveStatus === 'loading' && <div className="empty-state" role="status">Buscando clientes...</div>}
    {effectiveStatus === 'idle' && <div className="empty-state"><UserRound size={32} /><h3>Busque um cliente por nome ou contato</h3>{selecting && <p>Selecione um cliente para consultar seus equipamentos.</p>}</div>}
    {effectiveStatus === 'success' && clients.length === 0 && <div className="empty-state"><Search size={32} /><h3>Nenhum cliente encontrado</h3>{canCreate && offerCreate && <button className="button secondary" onClick={onNewClient}><Plus size={16} />Cadastrar cliente</button>}</div>}
    {effectiveStatus === 'success' && clients.length > 0 && <>
      <div className="table-wrap"><table className="client-search-table"><thead><tr><th>CLIENTE</th><th>CONTATO</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
        {clients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((client, index) => <tr key={client.id}>
          <td><div className="identity-cell"><span className={`client-avatar color-${index % 4}`}>{initials(client.name)}</span><div><button className="row-name" onClick={() => selecting ? onSelect(client) : onDetails(client)}>{client.name}</button><span className="record-code">Cliente {client.code}</span></div></div></td>
          <td><div className="contact-cell">{client.phone && <span>{client.phone}</span>}{client.email && <span>{client.email}</span>}</div></td>
          <td><button className="button secondary" onClick={() => onSelect(client)}><Monitor size={15} />{selecting ? 'Selecionar' : 'Equipamentos'}</button></td>
        </tr>)}
      </tbody></table></div>
      <div className="table-footer"><span>{clients.length} resultado(s) nesta busca · limite de 20; refine o termo se necessário.</span><Pagination page={page} total={clients.length} onChange={setPage} /></div>
    </>}
  </section>
}

export function EquipmentPanel({ api, client, canCreate, onNew, onDetails, onChangeClient, revision }: {
  api: Api; client: Client; canCreate: boolean; revision: number
  onNew: () => void; onDetails: (equipment: Equipment) => void; onChangeClient: () => void
}) {
  const [query, setQuery] = useState('')
  const [code, setCode] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<{ items: Equipment[]; status: 'loading' | 'success' | 'error'; error: string }>({ items: [], status: 'loading', error: '' })
  const [validation, setValidation] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    const request = code ? api.getEquipment(client.id, code, controller.signal).then(item => [item]) : api.listEquipment(client.id, controller.signal)
    void request.then(items => {
      if (!controller.signal.aborted) setResult({ items, status: 'success', error: '' })
    }).catch(cause => {
      if (!controller.signal.aborted) setResult({ items: [], status: 'error', error: errorMessage(cause) })
    })
    return () => controller.abort()
  }, [api, client.id, code, refresh, revision])

  function search(event: FormEvent) {
    event.preventDefault()
    if (query.trim() && !validateId(query.trim())) { setValidation('Informe um código interno numérico válido.'); return }
    setValidation(''); setResult({ items: [], status: 'loading', error: '' }); setPage(1); setCode(query.trim()); setRefresh(value => value + 1)
  }
  return <section className="registry-panel" aria-labelledby="equipment-title">
    <div className="panel-heading"><div><h2 id="equipment-title">Equipamentos de {client.name}</h2><p className="scope-caption">Cliente {client.code} · {client.phone || client.email}</p></div><button className="button secondary" onClick={onChangeClient}>Trocar cliente</button></div>
    <form className="toolbar" role="search" aria-label="Busca de equipamentos do cliente" onSubmit={search}>
      <div className="search-field"><Search size={18} /><input aria-label="Código interno do equipamento" inputMode="numeric" placeholder="Buscar por código interno deste cliente" value={query} onChange={e => setQuery(e.target.value)} /></div>
      <button className="button primary" type="submit" disabled={result.status === 'loading'}>Buscar</button>
      <button className="button secondary" type="button" disabled={result.status === 'loading'} onClick={() => { setQuery(''); setCode(''); setValidation(''); setResult({ items: [], status: 'loading', error: '' }); setPage(1); setRefresh(value => value + 1) }}>Todos deste cliente</button>
    </form>
    {(validation || result.error) && <div className="panel-message error-notice" role="alert">{validation || result.error}{result.error && <button className="text-button" onClick={() => { setResult({ items: [], status: 'loading', error: '' }); setPage(1); setRefresh(value => value + 1) }}>Tentar novamente</button>}</div>}
    {result.status === 'loading' && <div className="empty-state" role="status">Consultando equipamentos deste cliente...</div>}
    {result.status === 'success' && result.items.length === 0 && <div className="empty-state"><Monitor size={32} /><h3>Nenhum equipamento encontrado para este cliente</h3>{canCreate && <button className="button secondary" onClick={onNew}><Plus size={16} />Cadastrar equipamento</button>}</div>}
    {result.status === 'success' && result.items.length > 0 && <>
      <div className="table-wrap"><table><thead><tr><th>EQUIPAMENTO</th><th>CÓDIGO INTERNO</th><th>NÚMERO DE SÉRIE</th><th>CADASTRADO EM</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
        {result.items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(item => <tr key={item.id}>
          <td><div className="identity-cell"><span className="equipment-avatar"><Monitor size={20} /></span><button className="row-name" onClick={() => onDetails(item)}>{[item.type, item.brand, item.model].filter(Boolean).join(' · ')}</button></div></td>
          <td><span className="record-code">#{item.code} · cliente {client.code}</span></td><td>{item.serial || 'Não informado'}</td><td className="date-cell">{displayDate(item.createdAt)}</td>
          <td><button className="table-action" aria-label={`Ver equipamento ${item.code} do cliente ${client.id}`} onClick={() => onDetails(item)}><ArrowUpRight size={18} /></button></td>
        </tr>)}
      </tbody></table></div>
      <div className="table-footer"><span>{result.items.length} equipamento(s) deste cliente{code ? ` · código ${code}` : ''}</span><Pagination page={page} total={result.items.length} onChange={setPage} /></div>
    </>}
  </section>
}
