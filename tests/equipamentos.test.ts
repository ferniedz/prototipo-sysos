import { clienteValido, montar } from './helpers/app';

async function comClientes() {
  const ctx = montar();
  const a = await ctx.api.post('/api/clientes').set(ctx.atendente).send(clienteValido);
  const b = await ctx.api
    .post('/api/clientes')
    .set(ctx.atendente)
    .send({ nome: 'Pedro Alves', telefone: '42933334444' });
  return { ...ctx, idA: a.body.id as number, idB: b.body.id as number };
}

describe('Equipamento — entidade fraca vinculada ao cliente (RF07, RN01, RN09)', () => {
  it('cadastra só com o tipo; marca, modelo e série são opcionais; código interno é gerado', async () => {
    const { api, atendente, idA } = await comClientes();
    const r = await api.post(`/api/clientes/${idA}/equipamentos`).set(atendente).send({ tipo: 'Notebook' });

    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      clienteId: idA,
      codigoInterno: 1,
      tipo: 'Notebook',
      marca: null,
      modelo: null,
      numeroSerie: null,
      criadoPorId: 7,
    });
    expect(r.headers['location']).toBe(`/api/clientes/${idA}/equipamentos/1`);
  });

  it('grava todos os campos quando informados e trata vazio como ausente', async () => {
    const { api, atendente, idA } = await comClientes();
    const cheio = await api
      .post(`/api/clientes/${idA}/equipamentos`)
      .set(atendente)
      .send({ tipo: ' Celular ', marca: 'Samsung', modelo: 'A54', numeroSerie: 'R58M123' });
    expect(cheio.body).toMatchObject({ tipo: 'Celular', marca: 'Samsung', modelo: 'A54', numeroSerie: 'R58M123' });

    const vazio = await api
      .post(`/api/clientes/${idA}/equipamentos`)
      .set(atendente)
      .send({ tipo: 'Tablet', numeroSerie: '   ', marca: '' });
    expect(vazio.body.numeroSerie).toBeNull();
    expect(vazio.body.marca).toBeNull();
  });

  it('código interno é sequencial POR CLIENTE (chave parcial da entidade fraca)', async () => {
    const { api, atendente, idA, idB } = await comClientes();
    const post = (id: number, tipo: string) =>
      api.post(`/api/clientes/${id}/equipamentos`).set(atendente).send({ tipo });

    expect((await post(idA, 'Notebook')).body.codigoInterno).toBe(1);
    expect((await post(idA, 'Celular')).body.codigoInterno).toBe(2);
    expect((await post(idB, 'Console')).body.codigoInterno).toBe(1); // reinicia por cliente
    expect((await post(idA, 'Monitor')).body.codigoInterno).toBe(3);
  });

  it('não existe sem cliente: cliente inexistente avisa, oferece cadastro e não grava', async () => {
    const { api, atendente, banco } = await comClientes();
    const r = await api.post('/api/clientes/999/equipamentos').set(atendente).send({ tipo: 'Notebook' });
    expect(r.status).toBe(404);
    expect(r.body.erro.codigo).toBe('CLIENTE_NAO_ENCONTRADO');
    expect(r.body.erro.detalhes.ofertaCadastro).toBe(true);
    expect(banco.equipamentos).toHaveLength(0);
  });

  it.each([
    ['sem tipo', {}],
    ['tipo em branco', { tipo: '  ' }],
    ['código interno enviado pelo cliente', { tipo: 'Notebook', codigoInterno: 50 }],
    ['clienteId no corpo (tentativa de trocar o dono)', { tipo: 'Notebook', clienteId: 2 }],
    ['campo desconhecido', { tipo: 'Notebook', cor: 'preto' }],
    ['marca grande demais', { tipo: 'Notebook', marca: 'x'.repeat(61) }],
  ])('RF10: recusa %s e não grava', async (_d, corpo) => {
    const { api, atendente, idA, banco } = await comClientes();
    const r = await api.post(`/api/clientes/${idA}/equipamentos`).set(atendente).send(corpo);
    expect(r.status).toBe(400);
    expect(r.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(banco.equipamentos).toHaveLength(0);
  });

  it('RF08: lista os equipamentos do cliente para reaproveitar; sem mistura entre clientes', async () => {
    const { api, atendente, idA, idB } = await comClientes();
    await api.post(`/api/clientes/${idA}/equipamentos`).set(atendente).send({ tipo: 'Notebook' });
    await api.post(`/api/clientes/${idA}/equipamentos`).set(atendente).send({ tipo: 'Celular' });
    await api.post(`/api/clientes/${idB}/equipamentos`).set(atendente).send({ tipo: 'Console' });

    const lista = await api.get(`/api/clientes/${idA}/equipamentos`).set(atendente);
    expect(lista.status).toBe(200);
    expect(lista.body.total).toBe(2);
    expect(lista.body.equipamentos.map((e: { tipo: string }) => e.tipo)).toEqual(['Notebook', 'Celular']);

    const vazia = await api.get(`/api/clientes/${idB}/equipamentos`).set(atendente);
    expect(vazia.body.equipamentos.map((e: { tipo: string }) => e.tipo)).toEqual(['Console']);
  });

  it('consulta por (cliente, código); equipamento de outro cliente não é acessível', async () => {
    const { api, atendente, idA, idB } = await comClientes();
    await api.post(`/api/clientes/${idA}/equipamentos`).set(atendente).send({ tipo: 'Notebook' });

    const ok = await api.get(`/api/clientes/${idA}/equipamentos/1`).set(atendente);
    expect(ok.status).toBe(200);
    expect(ok.body.tipo).toBe('Notebook');

    const outro = await api.get(`/api/clientes/${idB}/equipamentos/1`).set(atendente);
    expect(outro.status).toBe(404);
    expect(outro.body.erro.codigo).toBe('EQUIPAMENTO_NAO_ENCONTRADO');

    expect((await api.get(`/api/clientes/${idA}/equipamentos/77`).set(atendente)).status).toBe(404);
    expect((await api.get(`/api/clientes/${idA}/equipamentos/zero`).set(atendente)).status).toBe(400);
    expect((await api.get('/api/clientes/999/equipamentos').set(atendente)).status).toBe(404);
  });

  it('RN20: não há exclusão nem alteração de cliente/equipamento nesta entrega', async () => {
    const { api, atendente, idA, banco } = await comClientes();
    await api.post(`/api/clientes/${idA}/equipamentos`).set(atendente).send({ tipo: 'Notebook' });

    for (const [metodo, rota] of [
      ['delete', `/api/clientes/${idA}`],
      ['delete', `/api/clientes/${idA}/equipamentos/1`],
      ['put', `/api/clientes/${idA}`],
      ['patch', `/api/clientes/${idA}/equipamentos/1`],
    ] as const) {
      const r = await api[metodo](rota).set(atendente).send({ nome: 'X' });
      expect(r.status).toBe(404);
    }
    expect(banco.clientes).toHaveLength(2);
    expect(banco.equipamentos).toHaveLength(1);
  });
});
