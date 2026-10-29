import { expect, jest, test } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server'
import { ClientForm, EquipmentForm } from './Forms'
import { DeleteConfirmation } from './DeleteConfirmation'
import { RecordActions } from './RecordActions'
import type { Client, Equipment } from '../lib/registry'

const client: Client = { id: '7', code: '#7', name: 'Ana Souza', phone: '(42) 99922-2222', email: 'ana@example.com' }
const item: Equipment = { id: '7:1', clientId: '7', code: '1', type: 'Servidor', brand: 'Dell', model: 'PowerEdge', serial: 'ABC-123', createdAt: '2026-10-22T12:00:00Z' }

const inputTag = (html: string, id: string) => html.match(new RegExp(`<input[^>]*\\sid="${id}"[^>]*>`))?.[0] ?? ''

test('edição de cliente preenche nome e contatos, usa ação de salvar e não permite editar o ID', () => {
  const save = jest.fn<() => Promise<Client>>()
  const html = renderToStaticMarkup(<ClientForm initialClient={client} onSave={save} onCreated={jest.fn()} onCancel={jest.fn()} />)
  expect(inputTag(html, 'client-name')).toContain('value="Ana Souza"')
  expect(inputTag(html, 'client-phone')).toContain('value="(42) 99922-2222"')
  expect(inputTag(html, 'client-email')).toContain('value="ana@example.com"')
  expect(html).toContain('Salvar alterações')
  expect(html).not.toContain('Cadastrar cliente')
  expect(html).not.toMatch(/<input[^>]*\s(?:name|id)="(?:client-id|id)"/)
  expect(save).not.toHaveBeenCalled()
})

test('edição de equipamento preserva tipo fora da lista padrão e preenche os dados', () => {
  const html = renderToStaticMarkup(<EquipmentForm client={client} initialEquipment={item} onSave={jest.fn<() => Promise<Equipment>>()} onCreated={jest.fn()} onCancel={jest.fn()} />)
  expect(html).toContain('<option selected="">Servidor</option>')
  expect(inputTag(html, 'equipment-brand')).toContain('value="Dell"')
  expect(inputTag(html, 'equipment-model')).toContain('value="PowerEdge"')
  expect(inputTag(html, 'equipment-serial')).toContain('value="ABC-123"')
  expect(html).toContain('cliente e código não podem ser alterados')
  expect(html).toContain('Salvar alterações')
  expect(html).not.toContain('id="equipment-client"')
})

test('ações de edição e exclusão ficam disponíveis ao atendente', () => {
  const html = renderToStaticMarkup(<RecordActions canManage onEdit={jest.fn()} onDelete={jest.fn()} />)
  expect(html).toContain('Editar')
  expect(html).toContain('Excluir')
})

test('perfil de consulta não recebe ações de alteração', () => {
  expect(renderToStaticMarkup(<RecordActions canManage={false} onEdit={jest.fn()} onDelete={jest.fn()} />)).toBe('')
})

test.each(['cliente', 'equipamento'] as const)('exclusão de %s identifica o alvo, informa restrições e aguarda confirmação', resource => {
  const onDelete = jest.fn<() => Promise<unknown>>()
  const onDeleted = jest.fn()
  const description = resource === 'cliente' ? 'Ana Souza (#7)' : '#1 · Notebook · cliente Ana Souza (#7)'
  const html = renderToStaticMarkup(<DeleteConfirmation resource={resource} description={description} onDelete={onDelete} onDeleted={onDeleted} onCancel={jest.fn()} />)
  expect(html).toContain(description)
  expect(html).toContain('não podem ser excluídos')
  expect(html).toContain('Cancelar')
  expect(html).toContain('Confirmar exclusão')
  expect(onDelete).not.toHaveBeenCalled()
  expect(onDeleted).not.toHaveBeenCalled()
})
