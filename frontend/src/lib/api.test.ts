import { beforeEach, expect, jest, test } from '@jest/globals'
import { ApiError, clientFromApi, createApi, equipmentFromApi, tokenProfile } from './api'

const customer = { id: 7, nome: 'Ana Souza', telefone: '42999222222', email: null }
const equipment = { clienteId: 7, codigoInterno: 1, tipo: 'Notebook', marca: null, modelo: null, numeroSerie: null, criadoEm: '2026-10-22T12:00:00Z' }
const base = 'http://localhost:3000/api'
let fetchMock: jest.SpiedFunction<typeof fetch>
beforeEach(() => { fetchMock = jest.spyOn(globalThis, 'fetch') })
function reply(body: unknown, status = 200) { fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) }

test('adapta resumos sem inventar data ou código sequencial de cliente', () => {
  expect(clientFromApi(customer)).toEqual({ id: '7', code: '#7', name: 'Ana Souza', phone: '(42) 99922-2222', email: '', createdAt: undefined })
})

test('preserva a identidade composta do equipamento, mesmo com código repetido em outro cliente', () => {
  expect(equipmentFromApi(equipment).id).toBe('7:1')
  expect(equipmentFromApi({ ...equipment, clienteId: 8 }).id).toBe('8:1')
})

test('busca clientes com termo codificado e Bearer; não requisita listagem global', async () => {
  reply({ total: 1, clientes: [customer], ofertaCadastro: false })
  const result = await createApi(`${base}/`, 'jwt').searchClients(' Ana & Souza ')
  expect(fetchMock).toHaveBeenCalledWith(`${base}/clientes?busca=Ana%20%26%20Souza`, expect.objectContaining({ headers: { Accept: 'application/json', Authorization: 'Bearer jwt' }, credentials: 'omit', cache: 'no-store' }))
  expect(result.clients[0].id).toBe('7')
  expect(result.offerCreate).toBe(false)
})

test.each(['', 'x', ' '.repeat(5)])('não consulta clientes sem termo válido %p', async query => {
  await expect(createApi(base, 'jwt').searchClients(query)).rejects.toThrow(/2 a 150 caracteres/)
  expect(fetchMock).not.toHaveBeenCalled()
})

test('mantém ofertaCadastro quando a API não encontra clientes', async () => {
  reply({ total: 0, clientes: [], ofertaCadastro: true })
  await expect(createApi(base, 'jwt').searchClients('Ausente')).resolves.toEqual({ total: 0, clients: [], offerCreate: true })
})

test('obtém os dados completos do cliente por ID', async () => {
  reply({ ...customer, criadoEm: '2026-10-22T12:00:00Z' })
  const client = await createApi(base, 'jwt').getClient('7')
  expect(fetchMock).toHaveBeenCalledWith(`${base}/clientes/7`, expect.any(Object))
  expect(client.createdAt).toBe('2026-10-22T12:00:00Z')
})

test('cadastro envia somente o contrato do backend e omite contatos vazios', async () => {
  reply(customer, 201)
  await createApi(base, 'jwt').createClient({ name: ' Ana Souza ', phone: '(42) 99922-2222', email: '' })
  const init = fetchMock.mock.calls[0][1]!
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body as string)).toEqual({ nome: 'Ana Souza', telefone: '(42) 99922-2222' })
  expect(init.headers).toHaveProperty('Content-Type', 'application/json')
})

test('409 contém candidatos do servidor e só confirma duplicidade quando solicitado', async () => {
  reply({ erro: { codigo: 'POSSIVEL_CLIENTE_DUPLICADO', mensagem: 'Confira os candidatos.', detalhes: { candidatos: [customer] } } }, 409)
  const api = createApi(base, 'jwt')
  const input = { name: 'Ana Souza', phone: '(42) 99922-2222', email: '' }
  await expect(api.createClient(input)).rejects.toMatchObject({ status: 409, code: 'POSSIVEL_CLIENTE_DUPLICADO', candidates: [expect.objectContaining({ id: '7' })] })
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).not.toHaveProperty('confirmarDuplicidade')
  reply({ ...customer, id: 8 }, 201)
  await expect(api.createClient(input, true)).resolves.toHaveProperty('id', '8')
  expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toHaveProperty('confirmarDuplicidade', true)
})

test('lista e consulta equipamento exclusivamente sob o cliente selecionado', async () => {
  const api = createApi(base, 'jwt')
  reply({ total: 1, equipamentos: [equipment] })
  await expect(api.listEquipment('7')).resolves.toEqual([expect.objectContaining({ id: '7:1', code: '1', clientId: '7' })])
  reply(equipment)
  await api.getEquipment('7', '1')
  reply({ ...equipment, clienteId: 8 })
  await api.getEquipment('8', '1')
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual([`${base}/clientes/7/equipamentos`, `${base}/clientes/7/equipamentos/1`, `${base}/clientes/8/equipamentos/1`])
})

test('cadastro de equipamento usa o cliente na URL e não gera ID no frontend', async () => {
  reply(equipment, 201)
  await createApi(base, 'jwt').createEquipment({ clientId: '7', type: 'Notebook', brand: '', model: ' Modelo ', serial: '' })
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/clientes/7/equipamentos`)
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ tipo: 'Notebook', modelo: 'Modelo' })
})

test.each(['0', '-1', 'abc', '1/2', '2147483648'])('não chama a API com identificador de cliente inválido: %p', async id => {
  await expect(createApi(base, 'jwt').listEquipment(id)).rejects.toBeInstanceOf(ApiError)
  expect(fetchMock).not.toHaveBeenCalled()
})

test('não busca equipamento sem código positivo', async () => {
  await expect(createApi(base, 'jwt').getEquipment('7', '')).rejects.toThrow('Identificador inválido.')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('preserva erros de validação por campo recebidos do servidor', async () => {
  reply({ erro: { codigo: 'DADOS_INVALIDOS', mensagem: 'Dados inválidos.', detalhes: [{ campo: 'nome', mensagem: 'Revise o nome.' }, { campo: 'contato', mensagem: 'Informe contato.' }] } }, 400)
  await expect(createApi(base, 'jwt').createClient({ name: '', phone: '', email: '' })).rejects.toMatchObject({ fields: { name: 'Revise o nome.', contact: 'Informe contato.' } })
})

test.each([403, 404, 500])('apresenta erro da API (%p) sem sucesso falso', async status => {
  reply({ erro: { codigo: 'ERRO', mensagem: 'Operação recusada.' } }, status)
  const onUnauthorized = jest.fn()
  await expect(createApi(base, 'jwt', onUnauthorized).getClient('7')).rejects.toMatchObject({ status, message: 'Operação recusada.' })
  expect(onUnauthorized).not.toHaveBeenCalled()
})

test('401 invalida acesso; ausência de token nem inicia uma requisição', async () => {
  const expired = jest.fn()
  reply({ erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'Autenticação necessária.' } }, 401)
  await expect(createApi(base, 'jwt', expired).getClient('7')).rejects.toHaveProperty('status', 401)
  expect(expired).toHaveBeenCalledTimes(1)
  fetchMock.mockClear()
  await expect(createApi(base, '').searchClients('Ana')).rejects.toThrow('Informe o token')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('distingue erro de rede e resposta que não é JSON', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
  await expect(createApi(base, 'jwt').searchClients('Ana')).rejects.toThrow('Não foi possível conectar à API')
  fetchMock.mockResolvedValueOnce(new Response('<html>erro</html>', { status: 502 }))
  await expect(createApi(base, 'jwt').searchClients('Ana')).rejects.toHaveProperty('code', 'RESPOSTA_INVALIDA')
})

test('encaminha cancelamento para impedir respostas de buscas antigas', async () => {
  const controller = new AbortController()
  const abort = new DOMException('Cancelado', 'AbortError')
  fetchMock.mockRejectedValueOnce(abort)
  await expect(createApi(base, 'jwt').searchClients('Ana', controller.signal)).rejects.toBe(abort)
  expect(fetchMock.mock.calls[0][1]!.signal).toBe(controller.signal)
})

test('perfil do token só controla apresentação; não substitui autorização na API', () => {
  const token = `header.${Buffer.from(JSON.stringify({ perfil: 'TECNICO' })).toString('base64url')}.signature`
  expect(tokenProfile(token)).toBe('TECNICO')
  expect(tokenProfile('invalido')).toBeNull()
})

test('cliente com somente e-mail é enviado sem telefone vazio nem identificador gerado localmente', async () => {
  reply({ ...customer, telefone: null, email: 'ana@example.com' }, 201)
  const client = await createApi(base, 'jwt').createClient({ name: ' Ana Souza ', phone: '', email: ' ana@example.com ' })
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ nome: 'Ana Souza', email: 'ana@example.com' })
  expect(client.phone).toBe('')
  expect(client.email).toBe('ana@example.com')
  expect(client.code).toBe('#7')
})

test('equipamento envia marca, modelo e série com os nomes e limites do contrato atual', async () => {
  reply({ ...equipment, marca: 'Dell', modelo: 'Inspiron', numeroSerie: 'SERIE-123' }, 201)
  const created = await createApi(base, 'jwt').createEquipment({ clientId: '7', type: ' Notebook ', brand: ' Dell ', model: ' Inspiron ', serial: ' SERIE-123 ' })
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/clientes/7/equipamentos`)
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ tipo: 'Notebook', marca: 'Dell', modelo: 'Inspiron', numeroSerie: 'SERIE-123' })
  expect(created).toMatchObject({ id: '7:1', clientId: '7', code: '1', brand: 'Dell', model: 'Inspiron', serial: 'SERIE-123' })
})

test('campos opcionais nulos da API viram campos vazios para a interface', () => {
  expect(clientFromApi({ ...customer, telefone: null, email: 'ana@example.com' })).toMatchObject({ phone: '', email: 'ana@example.com' })
  expect(equipmentFromApi(equipment)).toMatchObject({ brand: '', model: '', serial: '' })
})

test('erros de equipamento são associados aos campos do formulário sem perder a mensagem da API', async () => {
  reply({ erro: { codigo: 'DADOS_INVALIDOS', mensagem: 'Revise o equipamento.', detalhes: [
    { campo: 'tipo', mensagem: 'Informe o tipo.' },
    { campo: 'marca', mensagem: 'Marca muito longa.' },
    { campo: 'modelo', mensagem: 'Modelo muito longo.' },
    { campo: 'numeroSerie', mensagem: 'Série muito longa.' },
  ] } }, 400)
  await expect(createApi(base, 'jwt').createEquipment({ clientId: '7', type: '', brand: '', model: '', serial: '' })).rejects.toMatchObject({
    status: 400, message: 'Revise o equipamento.',
    fields: { type: 'Informe o tipo.', brand: 'Marca muito longa.', model: 'Modelo muito longo.', serial: 'Série muito longa.' },
  })
})

test('equipamento não encontrado não dispara busca em outro cliente ou rota global', async () => {
  reply({ erro: { codigo: 'EQUIPAMENTO_NAO_ENCONTRADO', mensagem: 'Equipamento não encontrado.' } }, 404)
  await expect(createApi(base, 'jwt').getEquipment('7', '99')).rejects.toMatchObject({ status: 404, code: 'EQUIPAMENTO_NAO_ENCONTRADO' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/clientes/7/equipamentos/99`)
})

test('401 limpa o acesso mesmo quando o servidor devolve um corpo que não é JSON', async () => {
  const onUnauthorized = jest.fn()
  fetchMock.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
  await expect(createApi(base, 'jwt', onUnauthorized).getClient('7')).rejects.toMatchObject({ status: 401, code: 'RESPOSTA_INVALIDA' })
  expect(onUnauthorized).toHaveBeenCalledTimes(1)
})

test.each(['cliente', 'equipamento'] as const)('falha no POST de %s não produz um cadastro local ou sucesso falso', async resource => {
  reply({ erro: { codigo: 'FALHA_AO_GRAVAR', mensagem: 'Não foi possível concluir o registro.' } }, 500)
  const api = createApi(base, 'jwt')
  const request = resource === 'cliente'
    ? api.createClient({ name: 'Ana Souza', phone: '', email: 'ana@example.com' })
    : api.createEquipment({ clientId: '7', type: 'Notebook', brand: '', model: '', serial: '' })
  await expect(request).rejects.toMatchObject({ status: 500, code: 'FALHA_AO_GRAVAR' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(localStorage.setItem).not.toHaveBeenCalled()
  expect(sessionStorage.setItem).not.toHaveBeenCalled()
})

test.each(['cliente', 'lista', 'equipamento'] as const)('consulta de %s encaminha o sinal de cancelamento sem gravar dados', async resource => {
  const controller = new AbortController()
  const api = createApi(base, 'jwt')
  if (resource === 'cliente') reply(customer)
  else if (resource === 'lista') reply({ equipamentos: [equipment], total: 1 })
  else reply(equipment)
  const request = resource === 'cliente' ? api.getClient('7', controller.signal)
    : resource === 'lista' ? api.listEquipment('7', controller.signal)
    : api.getEquipment('7', '1', controller.signal)
  await request
  const init = fetchMock.mock.calls[0][1]!
  expect(init.signal).toBe(controller.signal)
  expect(init.body).toBeUndefined()
  expect(localStorage.setItem).not.toHaveBeenCalled()
})
