import { formatPhone, validateClientSearch, validateId, type Client, type ClientInput, type Equipment, type EquipmentInput, type Errors } from './registry'

export interface ClientDto {
  id: number; nome: string; telefone: string | null; email: string | null; criadoEm?: string
}
export interface EquipmentDto {
  clienteId: number; codigoInterno: number; tipo: string; marca: string | null
  modelo: string | null; numeroSerie: string | null; criadoEm: string
}
export interface ClientSearchResult { clients: Client[]; offerCreate: boolean; total: number }

export function clientFromApi(data: ClientDto): Client {
  return { id: String(data.id), code: `#${data.id}`, name: data.nome, phone: formatPhone(data.telefone ?? ''), email: data.email ?? '', createdAt: data.criadoEm }
}
export function equipmentFromApi(data: EquipmentDto): Equipment {
  return { id: `${data.clienteId}:${data.codigoInterno}`, clientId: String(data.clienteId), code: String(data.codigoInterno), type: data.tipo, brand: data.marca ?? '', model: data.modelo ?? '', serial: data.numeroSerie ?? '', createdAt: data.criadoEm }
}

export class ApiError extends Error {
  constructor(message: string, public status = 0, public code = 'FALHA_DE_CONEXAO', public fields: Errors = {}, public candidates: Client[] = []) {
    super(message)
    this.name = 'ApiError'
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação. Tente novamente.'
}

const fieldNames: Record<string, keyof Errors> = { nome: 'name', telefone: 'phone', email: 'email', contato: 'contact', tipo: 'type', marca: 'brand', modelo: 'model', numeroSerie: 'serial' }

export function createApi(baseUrl: string, token: string, onUnauthorized?: () => void) {
  const base = baseUrl.replace(/\/+$/, '')
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!token.trim()) throw new ApiError('Informe o token de acesso para usar a API.', 401, 'NAO_AUTENTICADO')
    let response: Response
    try {
      response = await fetch(`${base}${path}`, {
        ...init,
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
        cache: 'no-store',
        credentials: 'omit',
      })
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') throw error
      throw new ApiError('Não foi possível conectar à API. Verifique a conexão e tente novamente.')
    }
    if (response.status === 401) onUnauthorized?.()
    let body
    try { body = await response.json() }
    catch { throw new ApiError('A API devolveu uma resposta inválida.', response.status, 'RESPOSTA_INVALIDA') }
    if (!response.ok) {
      const problem = body?.erro
      const fields: Errors = {}
      if (Array.isArray(problem?.detalhes)) {
        for (const detail of problem.detalhes) {
          const field = fieldNames[detail.campo]
          if (field && typeof detail.mensagem === 'string') fields[field] = detail.mensagem
        }
      }
      const candidates = Array.isArray(problem?.detalhes?.candidatos)
        ? problem.detalhes.candidatos.map(clientFromApi) : []
      throw new ApiError(problem?.mensagem || 'Não foi possível concluir a operação.', response.status, problem?.codigo, fields, candidates)
    }
    return body as T
  }
  const id = (value: string) => {
    if (!validateId(value)) throw new ApiError('Identificador inválido.', 400, 'DADOS_INVALIDOS')
    return String(Number(value))
  }
  return {
    async searchClients(query: string, signal?: AbortSignal): Promise<ClientSearchResult> {
      const error = validateClientSearch(query)
      if (error) throw new ApiError(error, 400, 'DADOS_INVALIDOS')
      const data = await request<{ clientes: ClientDto[]; total: number; ofertaCadastro: boolean }>(`/clientes?busca=${encodeURIComponent(query.trim())}`, { signal })
      return { clients: data.clientes.map(clientFromApi), total: data.total, offerCreate: data.ofertaCadastro }
    },
    async getClient(clientId: string, signal?: AbortSignal) {
      return clientFromApi(await request<ClientDto>(`/clientes/${id(clientId)}`, { signal }))
    },
    async createClient(input: ClientInput, confirmDuplicate = false) {
      const data = await request<ClientDto>('/clientes', { method: 'POST', body: JSON.stringify({ nome: input.name.trim(), ...(input.phone.trim() ? { telefone: input.phone.trim() } : {}), ...(input.email.trim() ? { email: input.email.trim() } : {}), ...(confirmDuplicate ? { confirmarDuplicidade: true } : {}) }) })
      return clientFromApi(data)
    },
    async listEquipment(clientId: string, signal?: AbortSignal) {
      const data = await request<{ equipamentos: EquipmentDto[] }>(`/clientes/${id(clientId)}/equipamentos`, { signal })
      return data.equipamentos.map(equipmentFromApi)
    },
    async getEquipment(clientId: string, code: string, signal?: AbortSignal) {
      return equipmentFromApi(await request<EquipmentDto>(`/clientes/${id(clientId)}/equipamentos/${id(code)}`, { signal }))
    },
    async createEquipment(input: EquipmentInput) {
      const data = await request<EquipmentDto>(`/clientes/${id(input.clientId)}/equipamentos`, { method: 'POST', body: JSON.stringify({ tipo: input.type.trim(), ...(input.brand.trim() ? { marca: input.brand.trim() } : {}), ...(input.model.trim() ? { modelo: input.model.trim() } : {}), ...(input.serial.trim() ? { numeroSerie: input.serial.trim() } : {}) }) })
      return equipmentFromApi(data)
    },
  }
}
export type Api = ReturnType<typeof createApi>

/** Usado apenas para apresentação da interface; quem autoriza é o backend. */
export function tokenProfile(token: string): 'ATENDENTE' | 'TECNICO' | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const profile = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))).perfil
    return profile === 'ATENDENTE' || profile === 'TECNICO' ? profile : null
  } catch { return null }
}
