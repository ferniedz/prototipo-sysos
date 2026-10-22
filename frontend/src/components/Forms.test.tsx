import { describe, expect, jest, test } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server'
import { ClientForm, EquipmentForm } from './Forms'
import type { Client, Equipment } from '../lib/registry'

const client: Client = { id: '7', code: '#7', name: 'Ana Souza', phone: '(42) 99999-0000', email: '' }

describe('Formulários ligados à API', () => {
  test('cliente exige nome, permite uma das opções de contato e não envia ao renderizar', () => {
    const onSave = jest.fn<() => Promise<Client>>()
    const html = renderToStaticMarkup(<ClientForm onSave={onSave} onCreated={jest.fn()} onCancel={jest.fn()} />)
    expect(html).toContain('id="client-name"')
    expect(html).toContain('maxLength="150"')
    expect(html).toContain('aria-required="true"')
    expect(html).toContain('type="tel"')
    expect(html).toContain('type="email"')
    expect(html).toContain('Preencha pelo menos uma opção')
    expect(html).not.toContain('CPF')
    expect(onSave).not.toHaveBeenCalled()
  })

  test('equipamento mantém um único cliente e não depende de listagem global de clientes', () => {
    const onSave = jest.fn<() => Promise<Equipment>>()
    const html = renderToStaticMarkup(<EquipmentForm client={client} onSave={onSave} onCreated={jest.fn()} onCancel={jest.fn()} />)
    expect(html).toContain('Ana Souza · #7 · (42) 99999-0000')
    expect(html).not.toContain('id="equipment-client"')
    expect(html).not.toContain('Cadastre agora')
    expect(html).toContain('gerado pela API para este cliente')
    expect(html).toContain('maxLength="60"')
    expect(html).toContain('maxLength="80"')
    expect(onSave).not.toHaveBeenCalled()
  })
})
