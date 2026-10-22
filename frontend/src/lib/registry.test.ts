import { expect, test } from '@jest/globals'
import { formatPhone, phoneDigits, validateClient, validateClientSearch, validateEquipment, validateId, type Client } from './registry'

const ana: Client = { id: '7', code: '#7', name: 'Ana Souza', phone: '(42) 99999-0000', email: '' }

test.each([
  ['', ''], ['4', '(4'], ['42', '(42'], ['429', '(42) 9'], ['429992', '(42) 9992'],
  ['4299922', '(42) 9992-2'], ['4299922222', '(42) 9992-2222'], ['42999222222', '(42) 99922-2222'],
  ['4232222222', '(42) 3222-2222'], ['(42) 99922-2222', '(42) 99922-2222'],
  ['+55 (42) 99922-2222', '(42) 99922-2222'],
])('formata telefone %p como %p', (input, expected) => expect(formatPhone(input)).toBe(expected))

test('permite apagar o telefone até o campo ficar vazio', () => {
  let value = '(42) 99922-2222'
  while (value) {
    const length = value.length
    value = formatPhone(value.slice(0, -1))
    expect(value.length).toBeLessThan(length)
  }
})

test('valida nome e contatos conforme o contrato da API', () => {
  expect(validateClient({ name: 'A', phone: '', email: '' })).toHaveProperty('name')
  expect(validateClient({ name: 'Ana', phone: '', email: '' })).toHaveProperty('contact')
  expect(validateClient({ name: 'Ana', phone: '00999990000', email: '' })).toHaveProperty('phone')
  expect(validateClient({ name: 'Ana', phone: '42999990000', email: 'invalido' })).toHaveProperty('email')
  expect(validateClient({ name: 'Ana', phone: '+55 (42) 99999-0000', email: '' })).toEqual({})
  expect(phoneDigits('+55 (42) 99999-0000')).toBe('42999990000')
  expect(validateClient({ name: 'A'.repeat(150), phone: '', email: 'ana@example.com' })).toEqual({})
  expect(validateClient({ name: 'A'.repeat(151), phone: '', email: 'ana@example.com' })).toHaveProperty('name')
})

test('tipo e cliente são obrigatórios; campos opcionais respeitam os limites do backend', () => {
  const input = { clientId: ana.id, type: 'Notebook', brand: '', model: '', serial: '' }
  expect(validateEquipment(input, [ana])).toEqual({})
  expect(validateEquipment({ ...input, clientId: '8' }, [ana])).toHaveProperty('clientId')
  expect(validateEquipment({ ...input, type: '' }, [ana])).toHaveProperty('type')
  expect(validateEquipment({ ...input, brand: 'a'.repeat(61), model: 'a'.repeat(81), serial: 'a'.repeat(81) }, [ana])).toEqual({ brand: 'Use até 60 caracteres.', model: 'Use até 80 caracteres.', serial: 'Use até 80 caracteres.' })
})

test.each(['', ' ', 'a', 'a'.repeat(151)])('não permite busca de clientes inválida: %p', value => expect(validateClientSearch(value)).not.toBe(''))
test('busca de clientes aceita nome e contato com dois ou mais caracteres', () => expect(validateClientSearch(' Ana ')).toBe(''))
test.each(['', '0', '-1', '1.5', 'abc', '2147483648'])('não aceita identificador ou código inválido %p', value => expect(validateId(value)).toBe(false))
test('aceita identificadores positivos da API', () => expect(validateId('2147483647')).toBe(true))
