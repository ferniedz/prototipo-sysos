import { describe, expect, jest, test } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server'
import { ClientForm, EquipmentForm } from './Forms'
import type { Client, Equipment } from '../lib/registry'

const client: Client = { id: '7', code: '#7', name: 'Ana Souza', phone: '(42) 99999-0000', email: '' }
const inputTag = (html: string, id: string) => html.match(new RegExp(`<input[^>]*\\sid="${id}"[^>]*>`))?.[0] ?? ''

describe('Formulários ligados à API', () => {
  test('cliente exige nome, permite uma das opções de contato e não envia ao renderizar', () => {
    const onSave = jest.fn<() => Promise<Client>>()
    const html = renderToStaticMarkup(<ClientForm onSave={onSave} onCreated={jest.fn()} onCancel={jest.fn()} />)
    expect(html).toContain('id="client-name"')
    expect(inputTag(html, 'client-name')).toContain('maxLength="150"')
    expect(inputTag(html, 'client-name')).toContain('aria-required="true"')
    expect(inputTag(html, 'client-phone')).toContain('type="tel"')
    expect(inputTag(html, 'client-phone')).toContain('maxLength="15"')
    expect(inputTag(html, 'client-email')).toContain('type="email"')
    expect(inputTag(html, 'client-email')).toContain('maxLength="254"')
    expect(inputTag(html, 'client-phone')).not.toMatch(/\srequired(?:=|\s|>)/)
    expect(inputTag(html, 'client-email')).not.toMatch(/\srequired(?:=|\s|>)/)
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
    expect(inputTag(html, 'equipment-brand')).toContain('maxLength="60"')
    expect(inputTag(html, 'equipment-model')).toContain('maxLength="80"')
    expect(inputTag(html, 'equipment-serial')).toContain('maxLength="80"')
    for (const field of ['equipment-brand', 'equipment-model', 'equipment-serial']) {
      expect(inputTag(html, field)).toContain('value=""')
      expect(inputTag(html, field)).not.toMatch(/\srequired(?:=|\s|>)/)
    }
    expect(onSave).not.toHaveBeenCalled()
  })
})
