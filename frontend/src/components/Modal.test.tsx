import { expect, jest, test } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server'
import { Modal } from './Modal'

test('diálogo associa título e descrição acessíveis e disponibiliza ação de fechar', () => {
  const onClose = jest.fn()
  const html = renderToStaticMarkup(<Modal title="Novo cliente" subtitle="Preencha os dados." onClose={onClose}><p>Conteúdo do formulário</p></Modal>)
  const titleId = html.match(/aria-labelledby="([^"]+)"/)?.[1]
  const descriptionId = html.match(/aria-describedby="([^"]+)"/)?.[1]
  expect(html).toContain('<dialog')
  expect(titleId).toBeDefined()
  expect(descriptionId).toBeDefined()
  expect(html).toContain(`id="${titleId}">Novo cliente`)
  expect(html).toContain(`id="${descriptionId}">Preencha os dados.`)
  expect(html).toContain('aria-label="Fechar janela"')
  expect(html).toContain('Conteúdo do formulário')
  expect(onClose).not.toHaveBeenCalled()
})
