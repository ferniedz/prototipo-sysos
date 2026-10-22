export interface Client {
  id: string
  code: string
  name: string
  phone: string
  email: string
  createdAt?: string
}

export interface Equipment {
  id: string
  code: string
  clientId: string
  type: string
  brand: string
  model: string
  serial: string
  createdAt: string
}

export type ClientInput = Pick<Client, 'name' | 'phone' | 'email'>
export type EquipmentInput = Pick<Equipment, 'clientId' | 'type' | 'brand' | 'model' | 'serial'>
export type Errors = Partial<Record<keyof ClientInput | keyof EquipmentInput | 'contact', string>>
export const EQUIPMENT_TYPES = ['Notebook', 'Computador', 'Celular', 'Tablet', 'Impressora', 'Monitor', 'Outro']

export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '')
  return /^55\d{10,11}$/.test(digits) ? digits.slice(2) : digits
}

export function formatPhone(value: string): string {
  const phone = phoneDigits(value).slice(0, 11)
  if (!phone) return ''
  if (phone.length <= 2) return `(${phone}`
  const number = phone.slice(2)
  const prefix = number.length > 8 ? 5 : 4
  return `(${phone.slice(0, 2)}) ${number.length > prefix ? `${number.slice(0, prefix)}-${number.slice(prefix)}` : number}`
}

export function validateClient(input: ClientInput): Errors {
  const errors: Errors = {}
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length < 2) errors.name = 'Informe um nome com ao menos 2 caracteres.'
  if (name.length > 150) errors.name = 'Use até 150 caracteres no nome.'
  if (!input.phone.trim() && !input.email.trim()) errors.contact = 'Informe ao menos um contato: telefone ou e-mail.'
  if (input.phone.trim() && !/^[1-9][1-9]\d{8,9}$/.test(phoneDigits(input.phone))) errors.phone = 'Informe um telefone válido com DDD e 8 ou 9 dígitos.'
  if (input.email.trim() && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) || input.email.trim().length > 254)) errors.email = 'Informe um e-mail válido, como nome@exemplo.com.'
  return errors
}

export function validateEquipment(input: EquipmentInput, clients: Client[]): Errors {
  const errors: Errors = {}
  if (!clients.some(client => client.id === input.clientId)) errors.clientId = 'Selecione um cliente cadastrado.'
  if (!input.type.trim() || input.type.trim().length > 60) errors.type = 'Informe o tipo de equipamento (até 60 caracteres).'
  for (const [field, limit] of [['brand', 60], ['model', 80], ['serial', 80]] as const) {
    if (input[field].trim().length > limit) errors[field] = `Use até ${limit} caracteres.`
  }
  return errors
}

export function validateClientSearch(query: string): string {
  return query.trim().length < 2 || query.trim().length > 150
    ? 'Informe de 2 a 150 caracteres para buscar por nome ou contato.' : ''
}

export function validateId(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 2_147_483_647
}

export const displayDate = (value?: string) => value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Não informado'
