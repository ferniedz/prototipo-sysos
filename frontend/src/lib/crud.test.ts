import { beforeEach, expect, jest, test } from '@jest/globals'
import { createApi } from './api'

const base = 'http://localhost:3000/api'
const client = { id: 7, nome: 'Ana Souza', telefone: '42999222222', email: null, criadoEm: '2026-10-22T12:00:00Z' }
const item = { clienteId: 7, codigoInterno: 1, tipo: 'Notebook', marca: 'Dell', modelo: null, numeroSerie: null, criadoEm: '2026-10-22T12:00:00Z' }
let fetchMock: jest.SpiedFunction<typeof fetch>
beforeEach(() => { fetchMock = jest.spyOn(globalThis, 'fetch') })
function reply(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

const input = { name: 'Ana Atualizada', phone: '', email: 'ana@example.com' }
const equipmentInput = { clientId: '7', type: 'Monitor', brand: '', model: '', serial: '' }

test('PUT de cliente substitui contatos e mantém o identificador da API', async () => {
  reply({ ...client, nome: input.name, telefone: null, email: input.email })
  const result = await createApi(base, 'jwt').updateClient('7', input)
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/clientes/7`)
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PUT', headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' } })
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ nome: input.name, email: input.email })
  expect(result).toMatchObject({ id: '7', code: '#7', name: input.name, phone: '', email: input.email })
})

test('PUT repete a confirmação explícita da duplicidade, sem confundir com conflito de exclusão', async () => {
  reply({ erro: { codigo: 'POSSIVEL_CLIENTE_DUPLICADO', mensagem: 'Confira os candidatos.', detalhes: { candidatos: [{ ...client, id: 8 }] } } }, 409)
  const api = createApi(base, 'jwt')
  await expect(api.updateClient('7', input)).rejects.toMatchObject({ status: 409, code: 'POSSIVEL_CLIENTE_DUPLICADO', candidates: [expect.objectContaining({ id: '8' })] })
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).not.toHaveProperty('confirmarDuplicidade')
  reply({ ...client, nome: input.name, telefone: null, email: input.email })
  await api.updateClient('7', input, true)
  expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toHaveProperty('confirmarDuplicidade', true)
  expect(fetchMock.mock.calls[1][0]).toBe(`${base}/clientes/7`)
})

test('PUT de equipamento mantém cliente/código na URL e permite limpar os opcionais', async () => {
  reply({ ...item, tipo: 'Monitor', marca: null })
  const result = await createApi(base, 'jwt').updateEquipment('7', '1', equipmentInput)
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/clientes/7/equipamentos/1`)
  expect(fetchMock.mock.calls[0][1]!.method).toBe('PUT')
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ tipo: 'Monitor' })
  expect(result).toMatchObject({ id: '7:1', code: '1', clientId: '7', type: 'Monitor', brand: '', model: '', serial: '' })
})

test('PUT de equipamento envia todos os dados editáveis preenchidos, sem identidade ou auditoria no corpo', async () => {
  reply(item)
  await createApi(base, 'jwt').updateEquipment('7', '1', { ...equipmentInput, type: ' Notebook ', brand: ' Dell ', model: ' Modelo ', serial: ' ABC ' })
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ tipo: 'Notebook', marca: 'Dell', modelo: 'Modelo', numeroSerie: 'ABC' })
})

test('não permite trocar o cliente de um equipamento ao editar', async () => {
  await expect(createApi(base, 'jwt').updateEquipment('8', '1', equipmentInput)).rejects.toThrow('O cliente vinculado ao equipamento não pode ser alterado.')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('DELETE de cliente lê o registro removido em uma resposta 200, sem enviar corpo', async () => {
  reply(client)
  await expect(createApi(base, 'jwt').deleteClient('7')).resolves.toMatchObject({ id: '7', name: 'Ana Souza' })
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/clientes/7`)
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE', headers: { Authorization: 'Bearer jwt' } })
  expect(fetchMock.mock.calls[0][1]!.body).toBeUndefined()
})

test('DELETE de equipamentos com código igual preserva o escopo de cada cliente', async () => {
  const api = createApi(base, 'jwt')
  reply(item)
  const a = await api.deleteEquipment('7', '1')
  reply({ ...item, clienteId: 8 })
  const b = await api.deleteEquipment('8', '1')
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual([`${base}/clientes/7/equipamentos/1`, `${base}/clientes/8/equipamentos/1`])
  expect(a.id).not.toBe(b.id)
  expect(fetchMock.mock.calls.every(call => call[1]!.method === 'DELETE' && call[1]!.body === undefined)).toBe(true)
})

test.each(['cliente', 'equipamento'] as const)('preserva o erro de vínculo ao excluir %s e não tenta forçar a exclusão', async resource => {
  const code = resource === 'cliente' ? 'CLIENTE_COM_VINCULOS' : 'EQUIPAMENTO_COM_VINCULOS'
  reply({ erro: { codigo: code, mensagem: 'O registro possui vínculos e não pode ser excluído.' } }, 409)
  const api = createApi(base, 'jwt')
  const promise = resource === 'cliente' ? api.deleteClient('7') : api.deleteEquipment('7', '1')
  await expect(promise).rejects.toMatchObject({ status: 409, code, message: 'O registro possui vínculos e não pode ser excluído.', candidates: [] })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test.each(['updateClient', 'deleteClient', 'updateEquipment', 'deleteEquipment'] as const)('%s recusa ID inválido antes de chamar a API', async operation => {
  const api = createApi(base, 'jwt')
  const promise = operation === 'updateClient' ? api.updateClient('0', input)
    : operation === 'deleteClient' ? api.deleteClient('0')
    : operation === 'updateEquipment' ? api.updateEquipment('7', '0', equipmentInput)
    : api.deleteEquipment('7', '0')
  await expect(promise).rejects.toHaveProperty('code', 'DADOS_INVALIDOS')
  expect(fetchMock).not.toHaveBeenCalled()
})

test.each([400, 401, 403, 404, 500])('PUT não confirma alteração diante de erro %p', async status => {
  reply({ erro: { codigo: 'ERRO', mensagem: 'Alteração recusada.', detalhes: [{ campo: 'nome', mensagem: 'Revise o nome.' }] } }, status)
  const unauthorized = jest.fn()
  await expect(createApi(base, 'jwt', unauthorized).updateClient('7', input)).rejects.toMatchObject({ status, fields: { name: 'Revise o nome.' } })
  expect(unauthorized).toHaveBeenCalledTimes(status === 401 ? 1 : 0)
})

test.each([401, 403, 404, 500])('DELETE não confirma remoção diante de erro %p', async status => {
  reply({ erro: { codigo: 'ERRO', mensagem: 'Exclusão recusada.' } }, status)
  await expect(createApi(base, 'jwt').deleteEquipment('7', '1')).rejects.toMatchObject({ status, message: 'Exclusão recusada.' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
