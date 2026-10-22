import { afterAll, beforeEach, jest } from '@jest/globals'

// A versão atual usa a API. Os testes não devem persistir cadastros ou tokens
// no navegador, nem fazer requisições de rede que não tenham sido simuladas.
const storageNames = ['localStorage', 'sessionStorage'] as const
const originalStorages = new Map(storageNames.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))

function blockedStorage(name: string): Storage {
  const rejectAccess = () => { throw new Error(`Uso inesperado de ${name}: os cadastros pertencem à API e o token fica na memória.`) }
  return {
    length: 0,
    clear: jest.fn(rejectAccess),
    getItem: jest.fn(rejectAccess),
    key: jest.fn(rejectAccess),
    removeItem: jest.fn(rejectAccess),
    setItem: jest.fn(rejectAccess),
  }
}

beforeEach(() => {
  for (const name of storageNames) {
    Object.defineProperty(globalThis, name, { configurable: true, value: blockedStorage(name) })
  }
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Requisição não simulada: configure a resposta de fetch no teste.'))
})

afterAll(() => {
  for (const name of storageNames) {
    const descriptor = originalStorages.get(name)
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
})
