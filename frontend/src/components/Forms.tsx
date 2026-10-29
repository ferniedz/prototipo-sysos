import { useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, ArrowLeft, Check, Monitor, UserRound } from './Icons'
import { EQUIPMENT_TYPES, formatPhone, validateClient, validateEquipment, type Client, type ClientInput, type Equipment, type EquipmentInput, type Errors } from '../lib/registry'
import { ApiError, errorMessage } from '../lib/api'

export function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? <span className="field-error" id={id}>{error}</span> : null
}

export function ClientForm({ onSave, onCreated, onCancel, onBusyChange }: {
  onSave: (input: ClientInput, confirmDuplicate: boolean) => Promise<Client>
  onCreated: (client: Client) => void
  onCancel: () => void
  onBusyChange?: (busy: boolean) => void
}) {
  const [input, setInput] = useState<ClientInput>({ name: '', phone: '', email: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false)
  const [duplicates, setDuplicates] = useState<Client[]>([])
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const submitting = useRef(false)

  function change(field: keyof ClientInput, value: string) {
    setInput(previous => ({ ...previous, [field]: field === 'phone' ? formatPhone(value) : value }))
    setErrors({}); setDuplicateConfirmed(false); setDuplicates([]); setSaveError('')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    const validation = validateClient(input)
    setErrors(validation)
    if (Object.keys(validation).length || (duplicates.length > 0 && !duplicateConfirmed)) return
    submitting.current = true
    setSaving(true); setSaveError(''); onBusyChange?.(true)
    try {
      const client = await onSave(input, duplicateConfirmed)
      onCreated(client)
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fields)
        if (error.code === 'POSSIVEL_CLIENTE_DUPLICADO' && error.candidates.length) {
          setDuplicates(error.candidates)
          setDuplicateConfirmed(false)
        } else setSaveError(error.message)
      } else setSaveError(errorMessage(error))
    } finally { submitting.current = false; setSaving(false); onBusyChange?.(false) }
  }
  return <form onSubmit={submit} noValidate aria-busy={saving}>
    <fieldset className="form-fields" disabled={saving}>
      <div className="form-body">
        <div className="form-section-heading"><span className="section-icon"><UserRound size={19} /></span><h3>Dados do cliente</h3></div>
        <label className="field" htmlFor="client-name">Nome completo <span className="required">*</span>
          <input id="client-name" autoFocus autoComplete="name" maxLength={150} placeholder="Ex.: Ana Carolina Souza" value={input.name} onChange={e => change('name', e.target.value)} aria-required="true" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} />
          <FieldError id="name-error" error={errors.name} />
        </label>
        <div className="contact-heading"><h4>Informações de contato <span className="required">*</span></h4><span>Preencha pelo menos uma opção</span></div>
        <div className="form-grid">
          <label className="field" htmlFor="client-phone">Telefone
            <input id="client-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={15} placeholder="(42) 99922-2222" value={input.phone} onChange={e => change('phone', e.target.value)} aria-invalid={!!errors.phone || !!errors.contact} aria-describedby="phone-hint phone-error contact-error" />
            <span className="field-hint" id="phone-hint">Inclua o DDD.</span><FieldError id="phone-error" error={errors.phone} />
          </label>
          <label className="field" htmlFor="client-email">E-mail
            <input id="client-email" type="email" autoComplete="email" maxLength={254} placeholder="nome@exemplo.com" value={input.email} onChange={e => change('email', e.target.value)} aria-invalid={!!errors.email || !!errors.contact} aria-describedby="email-error contact-error" />
            <FieldError id="email-error" error={errors.email} />
          </label>
        </div>
        <FieldError id="contact-error" error={errors.contact} />
        {duplicates.length > 0 && <div className="duplicate-notice" role="alert">
          <div className="notice-title"><AlertTriangle size={19} /><strong>Encontramos um cadastro parecido</strong></div>
          <p>Confira os candidatos retornados pela API antes de criar outro cadastro.</p>
          <ul>{duplicates.map(client => <li key={client.id}><strong>{client.name}</strong><span>{client.code} · {client.phone || client.email}</span></li>)}</ul>
          <label className="checkbox"><input type="checkbox" checked={duplicateConfirmed} onChange={e => setDuplicateConfirmed(e.target.checked)} />Conferi os dados e quero criar um cadastro separado.</label>
        </div>}
        {saveError && <div className="error-notice" role="alert">{saveError}</div>}
      </div>
      <div className="modal-footer"><span><span className="required">*</span> Campo obrigatório</span><div>
        <button type="button" className="button secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="button primary" disabled={duplicates.length > 0 && !duplicateConfirmed}><Check size={17} />{saving ? 'Salvando...' : 'Cadastrar cliente'}</button>
      </div></div>
    </fieldset>
  </form>
}

export function EquipmentForm({ client, onSave, onCreated, onCancel, onBusyChange }: {
  client: Client
  onSave: (input: EquipmentInput) => Promise<Equipment>
  onCreated: (equipment: Equipment) => void
  onCancel: () => void
  onBusyChange?: (busy: boolean) => void
}) {
  const [input, setInput] = useState<EquipmentInput>({ clientId: client.id, type: '', brand: '', model: '', serial: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const submitting = useRef(false)
  function change(field: keyof EquipmentInput, value: string) {
    setInput(previous => ({ ...previous, [field]: value })); setErrors({}); setSaveError('')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    const validation = validateEquipment(input, [client])
    setErrors(validation)
    if (Object.keys(validation).length) return
    submitting.current = true
    setSaving(true); setSaveError(''); onBusyChange?.(true)
    try { onCreated(await onSave(input)) }
    catch (error) {
      if (error instanceof ApiError) setErrors(error.fields)
      setSaveError(errorMessage(error))
    } finally { submitting.current = false; setSaving(false); onBusyChange?.(false) }
  }
  return <form noValidate onSubmit={submit} aria-busy={saving}>
    <fieldset className="form-fields" disabled={saving}>
      <div className="form-body">
        <div className="form-section-heading"><span className="section-icon"><UserRound size={19} /></span><div><h3>Cliente vinculado</h3><p>{client.name} · {client.code} · {client.phone || client.email}</p></div></div>
        <div className="form-divider" />
        <div className="form-section-heading"><span className="section-icon"><Monitor size={19} /></span><div><h3>Identificação do equipamento</h3><p>O código interno será gerado pela API para este cliente.</p></div></div>
        <div className="form-grid">
          <label className="field" htmlFor="equipment-type">Tipo <span className="required">*</span>
            <select autoFocus id="equipment-type" value={input.type} onChange={e => change('type', e.target.value)} aria-required="true" aria-invalid={!!errors.type} aria-describedby="type-error"><option value="">Selecione o tipo</option>{EQUIPMENT_TYPES.map(type => <option key={type}>{type}</option>)}</select><FieldError id="type-error" error={errors.type} />
          </label>
          <label className="field" htmlFor="equipment-brand">Marca <span className="optional">Opcional</span><input id="equipment-brand" maxLength={60} placeholder="Ex.: Samsung" value={input.brand} onChange={e => change('brand', e.target.value)} aria-invalid={!!errors.brand} aria-describedby="brand-error" /><FieldError id="brand-error" error={errors.brand} /></label>
        </div>
        <div className="form-grid">
          <label className="field" htmlFor="equipment-model">Modelo <span className="optional">Opcional</span><input id="equipment-model" maxLength={80} placeholder="Ex.: Galaxy Book4" value={input.model} onChange={e => change('model', e.target.value)} aria-invalid={!!errors.model} aria-describedby="model-error" /><FieldError id="model-error" error={errors.model} /></label>
          <label className="field" htmlFor="equipment-serial">Número de série <span className="optional">Opcional</span><input id="equipment-serial" maxLength={80} placeholder="Informe, se disponível" value={input.serial} onChange={e => change('serial', e.target.value)} aria-invalid={!!errors.serial} aria-describedby="serial-error" /><FieldError id="serial-error" error={errors.serial} /></label>
        </div>
        {saveError && <div className="error-notice" role="alert">{saveError}</div>}
      </div>
      <div className="modal-footer"><span><span className="required">*</span> Campo obrigatório</span><div><button type="button" className="button secondary" onClick={onCancel}><ArrowLeft size={16} />Voltar</button><button type="submit" className="button primary"><Check size={17} />{saving ? 'Salvando...' : 'Cadastrar equipamento'}</button></div></div>
    </fieldset>
  </form>
}
