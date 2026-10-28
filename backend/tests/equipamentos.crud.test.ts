import { clienteValido, montar, token } from './helpers/app';
import { BancoMemoria } from './helpers/memoria';

const editor = (id = 12) => ({ Authorization: `Bearer ${token('ATENDENTE', id)}` });

/** Faz a próxima chamada ao repositório falhar, como numa queda do banco. */
function quebrar(banco: BancoMemoria, metodo: 'atualizar' | 'excluir') {
  (banco as unknown as Record<string, unknown>)[metodo] = async () => {
    throw new Error('ERRO SQL: relation "Equipamento" violates constraint at /srv/app/prisma.ts:42');
  };
}

async function cenario() {
  const ctx = montar();
  const a = await ctx.api.post('/api/clientes').set(ctx.atendente).send(clienteValido);
  const b = await ctx.api
    .post('/api/clientes')
    .set(ctx.atendente)
    .send({ nome: 'Pedro Alves', telefone: '42933334444' });
  const eq = await ctx.api
    .post(`/api/clientes/${a.body.id}/equipamentos`)
    .set(ctx.atendente)
    .send({ tipo: 'Notebook', marca: 'Dell', modelo: 'Inspiron', numeroSerie: 'ABC123' });
  return { ...ctx, idA: a.body.id as number, idB: b.body.id as number, criado: eq.body };
}

describe('Equipamento — alteração (PB18, RN09, RN22)', () => {
  it('substitui os dados; dono e código interno ficam; registra quem alterou', async () => {
    const { api, idA, criado } = await cenario();

    const r = await api
      .put(`/api/clientes/${idA}/equipamentos/1`)
      .set(editor(12))
      .send({ tipo: ' Tablet ', marca: 'Samsung', modelo: 'Tab A9', numeroSerie: 'XYZ' });

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      clienteId: idA,
      codigoInterno: 1,
      tipo: 'Tablet',
      marca: 'Samsung',
      modelo: 'Tab A9',
      numeroSerie: 'XYZ',
      criadoPorId: 7,
      atualizadoPorId: 12,
    });
    expect(r.body.criadoEm).toBe(criado.criadoEm);
    expect(r.body.atualizadoEm).toEqual(expect.any(String));
    expect(criado.atualizadoEm).toBeNull();
  });

  it('é substituição completa: campos opcionais omitidos ou vazios passam a nulos', async () => {
    const { api, atendente, idA } = await cenario();
    const r = await api
      .put(`/api/clientes/${idA}/equipamentos/1`)
      .set(atendente)
      .send({ tipo: 'Notebook', marca: '', numeroSerie: '   ' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ tipo: 'Notebook', marca: null, modelo: null, numeroSerie: null });
  });

  it.each([
    ['sem tipo', { marca: 'Dell' }],
    ['tipo em branco', { tipo: '  ' }],
    ['clienteId no corpo (trocar o dono)', { tipo: 'Notebook', clienteId: 2 }],
    ['codigoInterno no corpo', { tipo: 'Notebook', codigoInterno: 9 }],
    ['campo desconhecido', { tipo: 'Notebook', cor: 'preto' }],
    ['marca grande demais', { tipo: 'Notebook', marca: 'x'.repeat(61) }],
  ])('RF10: recusa %s com 400 e não altera', async (_d, corpo) => {
    const { api, atendente, idA, banco } = await cenario();
    const antes = JSON.stringify(banco.equipamentos);

    const r = await api.put(`/api/clientes/${idA}/equipamentos/1`).set(atendente).send(corpo);

    expect(r.status).toBe(400);
    expect(r.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(JSON.stringify(banco.equipamentos)).toBe(antes);
  });

  it('equipamento inexistente: 404; de outro cliente: 404 e o original fica intacto', async () => {
    const { api, atendente, idA, idB, banco } = await cenario();

    const sem = await api.put(`/api/clientes/${idA}/equipamentos/77`).set(atendente).send({ tipo: 'X' });
    expect(sem.status).toBe(404);
    expect(sem.body.erro.codigo).toBe('EQUIPAMENTO_NAO_ENCONTRADO');

    // o código 1 existe só no cliente A; no cliente B não
    const outro = await api.put(`/api/clientes/${idB}/equipamentos/1`).set(atendente).send({ tipo: 'Invasor' });
    expect(outro.status).toBe(404);
    expect(banco.equipamentos).toHaveLength(1);
    expect(banco.equipamentos[0]!.tipo).toBe('Notebook');
  });

  it('cliente inexistente: 404 CLIENTE_NAO_ENCONTRADO; ids inválidos: 400', async () => {
    const { api, atendente } = await cenario();
    const r = await api.put('/api/clientes/999/equipamentos/1').set(atendente).send({ tipo: 'X' });
    expect(r.status).toBe(404);
    expect(r.body.erro.codigo).toBe('CLIENTE_NAO_ENCONTRADO');
    expect((await api.put('/api/clientes/1/equipamentos/abc').set(atendente).send({ tipo: 'X' })).status).toBe(400);
    expect((await api.put('/api/clientes/x/equipamentos/1').set(atendente).send({ tipo: 'X' })).status).toBe(400);
  });

  it('a consulta e a listagem refletem a alteração', async () => {
    const { api, atendente, idA } = await cenario();
    await api.put(`/api/clientes/${idA}/equipamentos/1`).set(atendente).send({ tipo: 'Monitor' });
    expect((await api.get(`/api/clientes/${idA}/equipamentos/1`).set(atendente)).body.tipo).toBe('Monitor');
    expect((await api.get(`/api/clientes/${idA}/equipamentos`).set(atendente)).body.equipamentos[0].tipo).toBe('Monitor');
  });

  it('RF12: falha ao gravar avisa o erro, sem vazar SQL e sem alterar', async () => {
    const { api, atendente, idA, banco } = await cenario();
    quebrar(banco, 'atualizar');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const r = await api.put(`/api/clientes/${idA}/equipamentos/1`).set(atendente).send({ tipo: 'Outro' });

    expect(r.status).toBe(500);
    expect(r.body.erro.codigo).toBe('FALHA_AO_GRAVAR');
    expect(JSON.stringify(r.body)).not.toMatch(/SQL|prisma|Equipamento"|\.ts:|constraint/i);
    expect(banco.equipamentos[0]!.tipo).toBe('Notebook');
    spy.mockRestore();
  });
});

describe('Equipamento — exclusão (RN20)', () => {
  it('exclui e devolve o equipamento excluído; os demais permanecem', async () => {
    const { api, atendente, idA, banco } = await cenario();
    await api.post(`/api/clientes/${idA}/equipamentos`).set(atendente).send({ tipo: 'Celular' });

    const r = await api.delete(`/api/clientes/${idA}/equipamentos/1`).set(atendente);

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ clienteId: idA, codigoInterno: 1, tipo: 'Notebook' });
    expect(banco.equipamentos.map((e) => e.codigoInterno)).toEqual([2]);
    expect((await api.get(`/api/clientes/${idA}/equipamentos/1`).set(atendente)).status).toBe(404);
    expect((await api.get(`/api/clientes/${idA}/equipamentos`).set(atendente)).body.total).toBe(1);
  });

  it('o código interno excluído não é reaproveitado (o contador só cresce)', async () => {
    const { api, atendente, idA } = await cenario();
    await api.delete(`/api/clientes/${idA}/equipamentos/1`).set(atendente);

    const novo = await api.post(`/api/clientes/${idA}/equipamentos`).set(atendente).send({ tipo: 'Celular' });

    expect(novo.body.codigoInterno).toBe(2);
  });

  it('inexistente: 404; de outro cliente: 404 e o original fica; ids inválidos: 400', async () => {
    const { api, atendente, idA, idB, banco } = await cenario();

    const sem = await api.delete(`/api/clientes/${idA}/equipamentos/77`).set(atendente);
    expect(sem.status).toBe(404);
    expect(sem.body.erro.codigo).toBe('EQUIPAMENTO_NAO_ENCONTRADO');

    expect((await api.delete(`/api/clientes/${idB}/equipamentos/1`).set(atendente)).status).toBe(404);
    expect(banco.equipamentos).toHaveLength(1);

    expect((await api.delete('/api/clientes/999/equipamentos/1').set(atendente)).body.erro.codigo).toBe('CLIENTE_NAO_ENCONTRADO');
    expect((await api.delete(`/api/clientes/${idA}/equipamentos/abc`).set(atendente)).status).toBe(400);
  });

  it('RN20: equipamento com OS vinculada é recusado pelo banco (409) e não é apagado', async () => {
    // Ainda não existe OS; o banco responderá "em uso" quando a tabela existir.
    const { api, atendente, idA, banco } = await cenario();
    (banco as unknown as Record<string, unknown>)['excluir'] = async () => ({ resultado: 'EM_USO' });

    const r = await api.delete(`/api/clientes/${idA}/equipamentos/1`).set(atendente);

    expect(r.status).toBe(409);
    expect(r.body.erro.codigo).toBe('EQUIPAMENTO_COM_VINCULOS');
    expect(banco.equipamentos).toHaveLength(1);
  });

  it('RF12: falha ao gravar avisa o erro, sem vazar SQL e sem apagar', async () => {
    const { api, atendente, idA, banco } = await cenario();
    quebrar(banco, 'excluir');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const r = await api.delete(`/api/clientes/${idA}/equipamentos/1`).set(atendente);

    expect(r.status).toBe(500);
    expect(r.body.erro.codigo).toBe('FALHA_AO_GRAVAR');
    expect(JSON.stringify(r.body)).not.toMatch(/SQL|prisma|Equipamento"|\.ts:|constraint/i);
    expect(banco.equipamentos).toHaveLength(1);
    spy.mockRestore();
  });
});

describe('Equipamento — acesso ao PUT e ao DELETE (RF02)', () => {
  it.each([
    ['put', '/api/clientes/1/equipamentos/1'],
    ['delete', '/api/clientes/1/equipamentos/1'],
  ] as const)('%s %s sem token → 401', async (metodo, rota) => {
    const { api } = montar();
    const r = await api[metodo](rota).send({ tipo: 'Notebook' });
    expect(r.status).toBe(401);
    expect(r.body.erro.codigo).toBe('NAO_AUTENTICADO');
  });

  it('técnico só lê: PUT e DELETE dão 403 e nada muda', async () => {
    const { api, tecnico, idA, banco } = await cenario();
    const antes = JSON.stringify(banco.equipamentos);

    const put = await api.put(`/api/clientes/${idA}/equipamentos/1`).set(tecnico).send({ tipo: 'Hack' });
    const del = await api.delete(`/api/clientes/${idA}/equipamentos/1`).set(tecnico);

    expect(put.status).toBe(403);
    expect(del.status).toBe(403);
    expect(JSON.stringify(banco.equipamentos)).toBe(antes);
  });
});
