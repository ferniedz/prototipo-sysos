import { expect, jest, test } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server'
import App from './App'
import { ClientSearch, EquipmentPanel } from './components/SearchPanels'
import { createApi } from './lib/api'

const api = createApi('http://localhost:3000/api', 'token')

test('não carrega cadastros locais nem consulta a API sem informar o token', () => {
  const storage = jest.spyOn(localStorage, 'getItem')
  const fetchMock = jest.spyOn(globalThis, 'fetch')
  const html = renderToStaticMarkup(<App />)
  expect(html).toContain('Informe o acesso à API')
  expect(html).toContain('Conectar à API')
  expect(html).not.toContain('Clientes cadastrados')
  expect(html).not.toContain('Protótipo local')
  expect(storage).not.toHaveBeenCalled()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('busca de clientes aguarda uma consulta explícita, sem alegar que a base está vazia', () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch')
  const html = renderToStaticMarkup(<ClientSearch api={api} canCreate onSelect={jest.fn()} onDetails={jest.fn()} onNewClient={jest.fn()} />)
  expect(html).toContain('Busque um cliente por nome ou contato')
  expect(html).not.toContain('Nenhum cliente cadastrado')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('consulta de equipamentos exige seleção de um cliente antes de exibir o painel', () => {
  const html = renderToStaticMarkup(<ClientSearch api={api} selecting canCreate={false} onSelect={jest.fn()} onDetails={jest.fn()} onNewClient={jest.fn()} />)
  expect(html).toContain('Selecione o cliente')
  expect(html).toContain('Selecione um cliente para consultar seus equipamentos.')
})

test('painel de equipamentos informa o cliente e limita a busca ao código nesse cliente', () => {
  const html = renderToStaticMarkup(<EquipmentPanel api={api} client={{ id: '7', code: '#7', name: 'Ana', phone: '', email: 'ana@example.com' }} canCreate revision={0} onNew={jest.fn()} onDetails={jest.fn()} onChangeClient={jest.fn()} />)
  expect(html).toContain('Equipamentos de Ana')
  expect(html).toContain('Cliente #7')
  expect(html).toContain('Código interno do equipamento')
  expect(html).toContain('Todos deste cliente')
  expect(html).toContain('Trocar cliente')
})
