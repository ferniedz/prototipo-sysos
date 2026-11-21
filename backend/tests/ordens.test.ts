import { STATUS_INICIAL } from '../src/dominio/ordemServico';
import { clienteValido, montar } from './helpers/app';
import { BancoMemoria } from './helpers/memoria';

/** Cliente 1 com equipamentos 1 e 2; cliente 2 com equipamento 1. */
async function cenario() {
  const ctx = montar();
  const { api, atendente } = ctx;
  const c1 = await api.post('/api/clientes').set(atendente).send(clienteValido);
  const c2 = await api
    .post('/api/clientes')
    .set(atendente)
    .send({ nome: 'Pedro Alves', telefone: '42933334444' });
  const eq = (id: number, tipo: string) =>
    api.post(`/api/clientes/${id}/equipamentos`).set(atendente).send({ tipo, marca: 'Dell' });
  await eq(c1.body.id, 'Notebook');
  await eq(c1.body.id, 'Impressora');
  await eq(c2.body.id, 'Tablet');
  return { ...ctx, c1: c1.body.id as number, c2: c2.body.id as number };
}

const corpo = (clienteId: number, equipamentoCodigoInterno = 1, extra = {}) => ({
  clienteId,
  equipamentoCodigoInterno,
  problemaRelatado: 'Não liga',
  ...extra,
});

describe('Abrir OS (PB04 — RF09, RN01–RN04)', () => {
  it('grava com número único, status "Aguardando Diagnóstico" e vínculos; quem fez (RN22)', async () => {
    const { api, atendente, c1 } = await cenario();
    const r = await api.post('/api/ordens-servico').set(atendente).send(corpo(c1, 1, { problemaRelatado: '  Tela quebrada  ' }));

    expect(r.status).toBe(201);
    expect(r.headers['location']).toBe(`/api/ordens-servico/${r.body.numero}`);
    expect(r.body).toMatchObject({
      numero: 1,
      status: 'Aguardando Diagnóstico',
      problemaRelatado: 'Tela quebrada',
      criadoPorId: 7,
      cliente: { id: c1, nome: 'Maria da Silva' },
      equipamento: { codigoInterno: 1, tipo: 'Notebook', marca: 'Dell' },
    });
    expect(r.body.status).toBe(STATUS_INICIAL);
    expect(r.body.criadoEm).toEqual(expect.any(String));
  });

  it('RN03: cada OS recebe um número diferente, em sequência', async () => {
    const { api, atendente, c1, c2 } = await cenario();
    const a = await api.post('/api/ordens-servico').set(atendente).send(corpo(c1, 1));
    const b = await api.post('/api/ordens-servico').set(atendente).send(corpo(c1, 2));
    const c = await api.post('/api/ordens-servico').set(atendente).send(corpo(c2, 1));
    expect([a.body.numero, b.body.numero, c.body.numero]).toEqual([1, 2, 3]);
  });

  it('RN03/RN04: número e status não são aceitos no corpo (gerados pelo sistema)', async () => {
    const { api, atendente, banco, c1 } = await cenario();
    for (const extra of [{ numero: 99 }, { status: 'Concluída' }, { criadoPorId: 1 }]) {
      const r = await api.post('/api/ordens-servico').set(atendente).send(corpo(c1, 1, extra));
      expect(r.status).toBe(400);
    }
    expect(banco.ordens).toHaveLength(0);
  });

  it('RN02/RF10: sem cliente, equipamento ou problema, não grava e aponta o campo', async () => {
    const { api, atendente, banco, c1 } = await cenario();
    const casos: Array<[object, string]> = [
      [{ equipamentoCodigoInterno: 1, problemaRelatado: 'x' }, 'Cliente é obrigatório.'],
      [{ clienteId: c1, problemaRelatado: 'x' }, 'Equipamento é obrigatório.'],
      [{ clienteId: c1, equipamentoCodigoInterno: 1 }, 'Problema relatado é obrigatório.'],
      [corpo(c1, 1, { problemaRelatado: '    ' }), 'Problema relatado é obrigatório.'],
      [corpo(c1, 1, { problemaRelatado: 'x'.repeat(1001) }), 'Problema relatado deve ter no máximo 1000 caracteres.'],
    ];
    for (const [dados, mensagem] of casos) {
      const r = await api.post('/api/ordens-servico').set(atendente).send(dados);
      expect(r.status).toBe(400);
      expect(r.body.erro.codigo).toBe('DADOS_INVALIDOS');
      expect(JSON.stringify(r.body.erro.detalhes)).toContain(mensagem);
    }
    expect(banco.ordens).toHaveLength(0);
  });

  it('aceita ids como texto numérico e recusa ids inválidos', async () => {
    const { api, atendente, c1 } = await cenario();
    const ok = await api.post('/api/ordens-servico').set(atendente).send(corpo(c1, 1, { clienteId: String(c1), equipamentoCodigoInterno: '1' }));
    expect(ok.status).toBe(201);
    for (const ruim of [{ clienteId: 'abc' }, { clienteId: -1 }, { clienteId: 1.5 }, { equipamentoCodigoInterno: 0 }]) {
      const r = await api.post('/api/ordens-servico').set(atendente).send(corpo(c1, 2, ruim));
      expect(r.status).toBe(400);
    }
  });

  it('RN05: cliente não cadastrado → avisa, oferece cadastro e não grava', async () => {
    const { api, atendente, banco } = await cenario();
    const r = await api.post('/api/ordens-servico').set(atendente).send(corpo(999));
    expect(r.status).toBe(404);
    expect(r.body.erro).toMatchObject({
      codigo: 'CLIENTE_NAO_ENCONTRADO',
      detalhes: { ofertaCadastro: true },
    });
    expect(banco.ordens).toHaveLength(0);
  });

  it('RN01: equipamento inexistente ou de OUTRO cliente é recusado', async () => {
    const { api, atendente, banco, c1, c2 } = await cenario();
    // equipamento 2 existe só no cliente 1; o cliente 2 tem apenas o 1
    const outro = await api.post('/api/ordens-servico').set(atendente).send(corpo(c2, 2));
    const inexistente = await api.post('/api/ordens-servico').set(atendente).send(corpo(c1, 50));
    for (const r of [outro, inexistente]) {
      expect(r.status).toBe(404);
      expect(r.body.erro.codigo).toBe('EQUIPAMENTO_NAO_ENCONTRADO');
    }
    expect(banco.ordens).toHaveLength(0);
  });

  it('RF11/RN06: equipamento com OS em aberto → 409 mostrando a OS; confirmar permite abrir', async () => {
    const { api, atendente, banco, c1 } = await cenario();
    const primeira = await api.post('/api/ordens-servico').set(atendente).send(corpo(c1, 1));

    const aviso = await api.post('/api/ordens-servico').set(atendente).send(corpo(c1, 1, { problemaRelatado: 'Barulho' }));
    expect(aviso.status).toBe(409);
    expect(aviso.body.erro.codigo).toBe('EQUIPAMENTO_COM_OS_EM_ABERTO');
    expect(aviso.body.erro.detalhes.ordensEmAberto).toEqual([
      expect.objectContaining({ numero: primeira.body.numero, status: STATUS_INICIAL, problemaRelatado: 'Não liga' }),
    ]);
    expect(banco.ordens).toHaveLength(1); // o aviso não gravou nada

    const confirmada = await api
      .post('/api/ordens-servico')
      .set(atendente)
      .send(corpo(c1, 1, { problemaRelatado: 'Barulho', confirmarOsEmAberto: true }));
    expect(confirmada.status).toBe(201);
    expect(confirmada.body.numero).toBe(2);
  });

  it('o aviso vale só para o mesmo equipamento; OS encerrada não conta como em aberto', async () => {
    const { api, atendente, banco, c1 } = await cenario();
    await api.post('/api/ordens-servico').set(atendente).send(corpo(c1, 1));

    const outroEquipamento = await api.post('/api/ordens-servico').set(atendente).send(corpo(c1, 2));
    expect(outroEquipamento.status).toBe(201);

    banco.ordens[0]!.status = 'Concluída'; // RN19: concluída fica só para consulta
    const semAviso = await api.post('/api/ordens-servico').set(atendente).send(corpo(c1, 1));
    expect(semAviso.status).toBe(201);
  });

  it('RF12: falha ao gravar → erro sem vazar detalhes e nenhuma OS pela metade', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { api, atendente, banco, c1 } = await cenario();
    (banco as unknown as Record<string, unknown>)['abrir'] = async () => {
      throw new Error('ERRO SQL: relation "OrdemServico" violates constraint at /srv/app/prisma.ts:42');
    };
    const r = await api.post('/api/ordens-servico').set(atendente).send(corpo(c1, 1));
    expect(r.status).toBe(500);
    expect(r.body.erro.codigo).toBe('FALHA_AO_GRAVAR');
    expect(JSON.stringify(r.body)).not.toMatch(/SQL|OrdemServico|prisma|\/srv/);
    expect(banco.ordens).toHaveLength(0);
    spy.mockRestore();
  });

  it('RF02: exige login e perfil de atendente para abrir', async () => {
    const { api, tecnico, c1 } = await cenario();
    const semToken = await api.post('/api/ordens-servico').send(corpo(c1, 1));
    expect(semToken.status).toBe(401);
    const comoTecnico = await api.post('/api/ordens-servico').set(tecnico).send(corpo(c1, 1));
    expect(comoTecnico.status).toBe(403);
  });

  it('OS não é editada nem apagada nesta entrega (rotas inexistentes)', async () => {
    const { api, atendente, c1 } = await cenario();
    await api.post('/api/ordens-servico').set(atendente).send(corpo(c1, 1));
    for (const metodo of ['put', 'patch', 'delete'] as const) {
      const r = await api[metodo]('/api/ordens-servico/1').set(atendente).send({});
      expect(r.status).toBe(404);
      expect(r.body.erro.codigo).toBe('ROTA_NAO_ENCONTRADA');
    }
  });
});

describe('Consultar OS (PB05 — RF13, RF14, RF15)', () => {
  async function comOrdens() {
    const ctx = await cenario();
    const abrir = (c: number, e: number, problema: string) =>
      ctx.api.post('/api/ordens-servico').set(ctx.atendente).send(corpo(c, e, { problemaRelatado: problema }));
    await abrir(ctx.c1, 1, 'Não liga'); // 1
    await abrir(ctx.c2, 1, 'Tela trincada'); // 2
    await abrir(ctx.c1, 2, 'Não imprime'); // 3
    return ctx;
  }

  it('RF13/RF15: consulta por número mostra número, cliente, equipamento, problema e status', async () => {
    const { api, tecnico, c1 } = await comOrdens();
    const r = await api.get('/api/ordens-servico/3').set(tecnico);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      numero: 3,
      status: 'Aguardando Diagnóstico',
      problemaRelatado: 'Não imprime',
      cliente: { id: c1, nome: 'Maria da Silva', telefone: '42999991234', email: 'maria@exemplo.com' },
      equipamento: { codigoInterno: 2, tipo: 'Impressora' },
    });
  });

  it('RF13: número inexistente → avisa que não existe; número inválido → 400', async () => {
    const { api, atendente } = await comOrdens();
    const nao = await api.get('/api/ordens-servico/999').set(atendente);
    expect(nao.status).toBe(404);
    expect(nao.body.erro.codigo).toBe('ORDEM_SERVICO_NAO_ENCONTRADA');
    for (const ruim of ['abc', '0', '-3', '1.5']) {
      expect((await api.get(`/api/ordens-servico/${ruim}`).set(atendente)).status).toBe(400);
    }
  });

  it('RF14: lista todas (mais recentes primeiro) e filtra por cliente e por status', async () => {
    const { api, atendente, banco, c1, c2 } = await comOrdens();

    const todas = await api.get('/api/ordens-servico').set(atendente);
    expect(todas.status).toBe(200);
    expect(todas.body.total).toBe(3);
    expect(todas.body.ordens.map((o: { numero: number }) => o.numero)).toEqual([3, 2, 1]);

    const doC1 = await api.get(`/api/ordens-servico?clienteId=${c1}`).set(atendente);
    expect(doC1.body.ordens.map((o: { numero: number }) => o.numero)).toEqual([3, 1]);
    const doC2 = await api.get(`/api/ordens-servico?clienteId=${c2}`).set(atendente);
    expect(doC2.body.total).toBe(1);

    banco.ordens[1]!.status = 'Concluída';
    const porStatus = await api
      .get(`/api/ordens-servico?status=${encodeURIComponent('Aguardando Diagnóstico')}`)
      .set(atendente);
    expect(porStatus.body.ordens.map((o: { numero: number }) => o.numero)).toEqual([3, 1]);
    const combinado = await api
      .get(`/api/ordens-servico?clienteId=${c2}&status=${encodeURIComponent('Aguardando Diagnóstico')}`)
      .set(atendente);
    expect(combinado.body).toEqual({ total: 0, ordens: [] });
  });

  it('RF14: filtro vazio é ignorado; cliente inválido → 400; sem resultado → lista vazia', async () => {
    const { api, atendente } = await comOrdens();
    expect((await api.get('/api/ordens-servico?clienteId=&status=').set(atendente)).body.total).toBe(3);
    expect((await api.get('/api/ordens-servico?clienteId=abc').set(atendente)).status).toBe(400);
    expect((await api.get('/api/ordens-servico?clienteId=999').set(atendente)).body).toEqual({ total: 0, ordens: [] });
  });

  it('RF15: consultar não altera nada', async () => {
    const { api, atendente, banco } = await comOrdens();
    const antes = JSON.stringify([banco.ordens, banco.clientes, banco.equipamentos]);
    await api.get('/api/ordens-servico').set(atendente);
    await api.get('/api/ordens-servico/1').set(atendente);
    await api.get('/api/ordens-servico/999').set(atendente);
    expect(JSON.stringify([banco.ordens, banco.clientes, banco.equipamentos])).toBe(antes);
  });

  it('RF02: exige login; atendente e técnico podem consultar', async () => {
    const { api, atendente, tecnico } = await comOrdens();
    expect((await api.get('/api/ordens-servico')).status).toBe(401);
    expect((await api.get('/api/ordens-servico/1')).status).toBe(401);
    expect((await api.get('/api/ordens-servico').set(atendente)).status).toBe(200);
    expect((await api.get('/api/ordens-servico').set(tecnico)).status).toBe(200);
  });
});

describe('RN20 com OS: nada apaga o histórico', () => {
  it('cliente e equipamento com OS não são excluídos (409) e a OS permanece', async () => {
    const { api, atendente, banco, c1 } = await cenario();
    await api.post('/api/ordens-servico').set(atendente).send(corpo(c1, 1));

    const eq = await api.delete(`/api/clientes/${c1}/equipamentos/1`).set(atendente);
    expect(eq.status).toBe(409);
    expect(eq.body.erro.codigo).toBe('EQUIPAMENTO_COM_VINCULOS');

    const cli = await api.delete(`/api/clientes/${c1}`).set(atendente);
    expect(cli.status).toBe(409);
    expect(cli.body.erro.codigo).toBe('CLIENTE_COM_VINCULOS');

    expect(banco.ordens).toHaveLength(1);
    expect((await api.get('/api/ordens-servico/1').set(atendente)).status).toBe(200);
  });

  it('o equipamento sem OS continua podendo ser excluído', async () => {
    const { api, atendente, c1 } = await cenario();
    await api.post('/api/ordens-servico').set(atendente).send(corpo(c1, 1));
    const livre = await api.delete(`/api/clientes/${c1}/equipamentos/2`).set(atendente);
    expect(livre.status).toBe(200);
  });
});

it('BancoMemoria espelha o banco: não grava OS de equipamento inexistente', async () => {
  const banco = new BancoMemoria();
  await expect(
    banco.abrir({ clienteId: 1, equipamentoCodigoInterno: 1, problemaRelatado: 'x', criadoPorId: 1 }),
  ).rejects.toThrow();
});