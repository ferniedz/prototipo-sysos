import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Check, ChevronRight, Monitor, Plus, UserRound, UsersRound, X, Zap } from './components/Icons'
import { Modal } from './components/Modal'
import { ClientForm, EquipmentForm } from './components/Forms'
import { ClientSearch, EquipmentPanel } from './components/SearchPanels'
import { ClientDetails, EquipmentDetails } from './components/Details'
import { createApi, tokenProfile } from './lib/api'
import type { Client, Equipment } from './lib/registry'

type Page = 'clients' | 'equipment'
type Dialog = { kind: 'client' } | { kind: 'equipment'; client: Client } | { kind: 'client-detail'; client: Client } | { kind: 'equipment-detail'; client: Client; code: string } | { kind: 'session' } | null

function SessionForm({ onConnect }: { onConnect: (token: string) => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const token = value.trim().replace(/^Bearer\s+/i, '')
    if (!tokenProfile(token)) { setError('Informe um JWT com perfil ATENDENTE ou TECNICO.'); return }
    onConnect(token)
  }
  return <form onSubmit={submit}><div className="form-body">
    <label className="field" htmlFor="access-token">Token de acesso
      <input autoFocus id="access-token" type="password" autoComplete="off" spellCheck={false} value={value} onChange={e => { setValue(e.target.value); setError('') }} aria-describedby="token-hint" />
      <span className="field-hint" id="token-hint">Informe o token fornecido para o protótipo. A API validará seu acesso em cada operação.</span>
    </label>
    {error && <div className="error-notice" role="alert">{error}</div>}
  </div><div className="modal-footer"><span>O token fica apenas na memória desta aba.</span><button type="submit" className="button primary">Usar token</button></div></form>
}

export default function App({ apiBaseUrl = 'http://localhost:3000/api' }: { apiBaseUrl?: string }) {
  const [token, setToken] = useState('')
  const [sessionVersion, setSessionVersion] = useState(0)
  const [page, setPage] = useState<Page>('clients')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState('')
  const [sessionError, setSessionError] = useState('')
  const unauthorized = useCallback(() => {
    setToken(''); setSelectedClient(null); setDialog({ kind: 'session' }); setBusy(false); setNotice('')
    setSessionError('Token inválido ou expirado. Informe um novo token para continuar.')
  }, [])
  const api = useMemo(() => createApi(apiBaseUrl, token, unauthorized), [apiBaseUrl, token, unauthorized])
  const profile = tokenProfile(token)
  const canCreate = !!token && profile === 'ATENDENTE'
  const isClients = page === 'clients'

  function selectClient(client: Client) { setSelectedClient(client); setPage('equipment'); setDialog(null) }
  function clientCreated(client: Client) {
    setNotice(`Cliente ${client.name} cadastrado com sucesso. Identificador ${client.code}.`)
    selectClient(client)
  }
  function equipmentCreated(item: Equipment) {
    setNotice(`Equipamento #${item.code} cadastrado para o cliente #${item.clientId}.`)
    setDialog(null); setRevision(value => value + 1)
  }
  function closeDialog() { if (!busy) setDialog(null) }
  function connect(nextToken: string) {
    setToken(nextToken); setSessionVersion(value => value + 1); setSelectedClient(null); setDialog(null); setSessionError(''); setNotice('')
  }
  function disconnect() {
    setToken(''); setSelectedClient(null); setDialog(null); setNotice(''); setSessionError(''); setSessionVersion(value => value + 1)
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#clientes" onClick={e => { e.preventDefault(); setPage('clients') }} aria-label="SysOS — ir para clientes"><span className="brand-mark"><Zap size={24} fill="currentColor" /></span><span>sys<span className="brand-os">OS</span><span className="brand-dot">.</span></span></a>
      <div className="workspace-label"><span className="workspace-icon"><Monitor size={17} /></span><div><strong>Assistência técnica</strong><span>Espaço de trabalho</span></div></div>
      <div className="nav-label">ESPAÇO DE TRABALHO</div>
      <nav aria-label="Navegação principal">
        <button className={`nav-item ${isClients ? 'active' : ''}`} onClick={() => setPage('clients')} aria-current={isClients ? 'page' : undefined}><UsersRound size={19} /><span>Clientes</span></button>
        <button className={`nav-item ${!isClients ? 'active' : ''}`} onClick={() => setPage('equipment')} aria-current={!isClients ? 'page' : undefined}><Monitor size={19} /><span>Equipamentos</span></button>
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-version"><span className="version-dot" />SysOS <span>v0.2</span></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">Espaço de trabalho<ChevronRight size={14} /><strong>Cadastros</strong></div>
        <div className="topbar-right"><span className="profile-avatar"><UserRound size={18} /></span><span className="session-label">{token ? profile === 'TECNICO' ? 'Técnico · consulta' : 'Atendente' : 'Acesso não informado'}</span>
          <button className="button secondary" disabled={busy} onClick={() => setDialog({ kind: 'session' })}>{token ? 'Trocar token' : 'Conectar à API'}</button>
          {token && <button className="text-button" disabled={busy} onClick={disconnect}>Encerrar acesso</button>}
        </div>
      </header>
      <main>
        <div className="page-heading"><h1>{isClients ? 'Clientes' : 'Equipamentos'}<span className="heading-dot">.</span></h1>
          {canCreate && <button className="button primary" disabled={!isClients && !selectedClient} onClick={() => setDialog(isClients ? { kind: 'client' } : { kind: 'equipment', client: selectedClient! })}><Plus size={18} />{isClients ? 'Novo cliente' : 'Novo equipamento'}</button>}
        </div>
        {sessionError && <div className="error-notice" role="alert">{sessionError}</div>}
        {!token ? <section className="registry-panel"><div className="empty-state"><UserRound size={32} /><h2>Informe o acesso à API</h2><p>Use um token de atendente ou técnico para buscar clientes e equipamentos.</p><button className="button primary" onClick={() => setDialog({ kind: 'session' })}>Informar token</button></div></section> :
          <div key={sessionVersion}>
            {isClients || !selectedClient ? <ClientSearch key={page} api={api} selecting={!isClients} canCreate={canCreate} onSelect={selectClient} onDetails={client => setDialog({ kind: 'client-detail', client })} onNewClient={() => setDialog({ kind: 'client' })} /> :
              <EquipmentPanel key={`${selectedClient.id}:${revision}`} api={api} client={selectedClient} canCreate={canCreate} revision={revision} onNew={() => setDialog({ kind: 'equipment', client: selectedClient })} onDetails={item => setDialog({ kind: 'equipment-detail', client: selectedClient, code: item.code })} onChangeClient={() => setSelectedClient(null)} />}
          </div>}
      </main>
    </div>
    <div className="toast-region" aria-live="polite" aria-atomic="true">{notice && <div className="toast"><span className="toast-check"><Check size={17} /></span><span>{notice}</span><button className="icon-button" aria-label="Dispensar confirmação" onClick={() => setNotice('')}><X size={17} /></button></div>}</div>
    {dialog?.kind === 'session' && <Modal title="Acesso à API" onClose={closeDialog}><SessionForm onConnect={connect} /></Modal>}
    {dialog?.kind === 'client' && <Modal title="Novo cliente" busy={busy} onClose={closeDialog}><ClientForm onSave={api.createClient} onCreated={clientCreated} onCancel={closeDialog} onBusyChange={setBusy} /></Modal>}
    {dialog?.kind === 'equipment' && <Modal title="Novo equipamento" busy={busy} onClose={closeDialog}><EquipmentForm client={dialog.client} onSave={api.createEquipment} onCreated={equipmentCreated} onCancel={closeDialog} onBusyChange={setBusy} /></Modal>}
    {dialog?.kind === 'client-detail' && <Modal title={dialog.client.name} subtitle={`Cliente ${dialog.client.code}`} onClose={closeDialog}><ClientDetails key={dialog.client.id} api={api} client={dialog.client} onEquipment={selectClient} /></Modal>}
    {dialog?.kind === 'equipment-detail' && <Modal title={`Equipamento #${dialog.code}`} subtitle={`${dialog.client.name} · cliente ${dialog.client.code}`} onClose={closeDialog}><EquipmentDetails key={`${dialog.client.id}:${dialog.code}`} api={api} client={dialog.client} code={dialog.code} /></Modal>}
  </div>
}
