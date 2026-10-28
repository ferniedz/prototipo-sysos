import { clienteValido, montar, token } from './helpers/app';
import { BancoMemoria } from './helpers/memoria';

const editor = (id = 12) => ({ Authorization: `Bearer ${token('ATENDENTE', id)}` });

/** Faz a próxima chamada ao repositório falhar, como numa queda do banco. */
function quebrar(banco: BancoMemoria, metodo: 'atualizar' | 'excluir') {
  (banco as unknown as Record<string, unknown>)[metodo] = async () => {
    throw new Error('ERRO SQL: relation "Cliente" violates constraint at /srv/app/prisma.ts:42');
  };
}

describe('Cliente — alteração (PB18, RN07, RN08, RN22)', () => {
  it('substitui os dados, normaliza contatos, mantém id/criação e registra quem alterou', async () => {
    const { api, atendente } = montar();
    const criado = await api.post('/api/clientes').set(atendente).send(clienteValido);

    const r = await api
      .put('/api/clientes/1')
      .set(editor(12))
      .send({ nome: '  Maria   Souza ', telefone: '+55 (42) 98888-7777', email: 'MARIA.SOUZA@exemplo.com' });

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      id: 1,
      nome: 'Maria Souza',
      telefone: '42988887777',
      email: 'maria.souza@exemplo.com',
      criadoPorId: 7,
      atualizadoPorId: 12,
    });
    expect(r.body.criadoEm).toBe(criado.body.criadoEm);
    expect(r.body.atualizadoEm).toEqual(expect.any(String));
    expect(criado.body.atualizadoEm).toBeNull(); // nunca alterado até então
  });

  it('é substituição completa: omitir um contato o remove (desde que reste um)', async () => {
    const { api, atendente } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    const r = await api.put('/api/clientes/1').set(atendente).send({ nome: 'Maria da Silva', email: 'maria@exemplo.com' });
    expect(r.status).toBe(200);
    expect(r.body.telefone).toBeNull();
    expect(r.body.email).toBe('maria@exemplo.com');
  });

  it('reenviar os mesmos dados não é duplicidade (o próprio cliente é ignorado)', async () => {
    const { api, atendente } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    const r = await api.put('/api/clientes/1').set(atendente).send(clienteValido);
    expect(r.status).toBe(200);
  });

  it('RN08: alerta duplicidade com OUTRO cliente, não altera nada e aceita confirmação', async () => {
    const { api, atendente, banco } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    await api.post('/api/clientes').set(atendente).send({ nome: 'Pedro Alves', telefone: '42933334444' });

    const corpo = { nome: 'MARIA DA SILVA', telefone: '42933334444' };
    const alerta = await api.put('/api/clientes/2').set(atendente).send(corpo);
    expect(alerta.status).toBe(409);
    expect(alerta.body.erro.codigo).toBe('POSSIVEL_CLIENTE_DUPLICADO');
    expect(alerta.body.erro.mensagem).toMatch(/alteração/);
    expect(alerta.body.erro.detalhes.candidatos.map((c: { id: number }) => c.id)).toEqual([1]);
    expect(banco.clientes[1]!.nome).toBe('Pedro Alves');
    expect(banco.clientes[1]!.atualizadoEm).toBeNull();

    const ok = await api.put('/api/clientes/2').set(atendente).send({ ...corpo, confirmarDuplicidade: true });
    expect(ok.status).toBe(200);
    expect(ok.body.nome).toBe('MARIA DA SILVA');
    expect(ok.body).not.toHaveProperty('confirmarDuplicidade');
    expect(banco.clientes).toHaveLength(2); // nunca mescla
  });

  it.each([
    ['sem nome', { telefone: '42999991234' }],
    ['sem nenhum contato', { nome: 'Maria da Silva' }],
    ['contatos vazios', { nome: 'Maria da Silva', telefone: '', email: ' ' }],
    ['telefone inválido', { nome: 'Maria da Silva', telefone: '123' }],
    ['e-mail inválido', { nome: 'Maria da Silva', email: 'x' }],
    ['id no corpo', { ...clienteValido, id: 99 }],
    ['criadoPorId no corpo', { ...clienteValido, criadoPorId: 1 }],
    ['CPF (não é coletado)', { ...clienteValido, cpf: '12345678901' }],
  ])('RF10: recusa %s com 400 e não altera', async (_d, corpo) => {
    const { api, atendente, banco } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    const antes = JSON.stringify(banco.clientes);

    const r = await api.put('/api/clientes/1').set(atendente).send(corpo);

    expect(r.status).toBe(400);
    expect(r.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(JSON.stringify(banco.clientes)).toBe(antes);
  });

  it('cliente inexistente: 404 e nada é criado; id inválido: 400', async () => {
    const { api, atendente, banco } = montar();
    const r = await api.put('/api/clientes/999').set(atendente).send(clienteValido);
    expect(r.status).toBe(404);
    expect(r.body.erro.codigo).toBe('CLIENTE_NAO_ENCONTRADO');
    expect(banco.clientes).toHaveLength(0);
    expect((await api.put('/api/clientes/abc').set(atendente).send(clienteValido)).status).toBe(400);
    expect((await api.put('/api/clientes/0').set(atendente).send(clienteValido)).status).toBe(400);
  });

  it('mantém os vínculos: os equipamentos continuam do mesmo cliente', async () => {
    const { api, atendente } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    await api.post('/api/clientes/1/equipamentos').set(atendente).send({ tipo: 'Notebook' });

    await api.put('/api/clientes/1').set(atendente).send({ nome: 'Novo Nome', email: 'novo@x.com' });

    const lista = await api.get('/api/clientes/1/equipamentos').set(atendente);
    expect(lista.body.total).toBe(1);
    expect(lista.body.equipamentos[0]).toMatchObject({ clienteId: 1, codigoInterno: 1 });
  });

  it('a busca enxerga os dados novos e não os antigos', async () => {
    const { api, atendente } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    await api.put('/api/clientes/1').set(atendente).send({ nome: 'Joana Prado', telefone: '42977776666' });

    expect((await api.get('/api/clientes').query({ busca: 'Joana' }).set(atendente)).body.total).toBe(1);
    expect((await api.get('/api/clientes').query({ busca: 'Maria' }).set(atendente)).body.ofertaCadastro).toBe(true);
    expect((await api.get('/api/clientes').query({ busca: '42977776666' }).set(atendente)).body.total).toBe(1);
  });

  it('RF12: falha ao gravar avisa o erro, sem vazar SQL e sem alterar', async () => {
    const banco = new BancoMemoria();
    const { api, atendente } = montar(banco);
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    quebrar(banco, 'atualizar');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const r = await api.put('/api/clientes/1').set(atendente).send({ nome: 'Outro Nome', email: 'o@x.com' });

    expect(r.status).toBe(500);
    expect(r.body.erro.codigo).toBe('FALHA_AO_GRAVAR');
    expect(JSON.stringify(r.body)).not.toMatch(/SQL|prisma|Cliente"|\.ts:|constraint/i);
    expect(banco.clientes[0]!.nome).toBe('Maria da Silva');
    spy.mockRestore();
  });
});

describe('Cliente — exclusão (RN20: nada apaga o histórico)', () => {
  it('exclui cliente sem vínculos e devolve o cadastro excluído', async () => {
    const { api, atendente, banco } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);

    const r = await api.delete('/api/clientes/1').set(atendente);

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: 1, nome: 'Maria da Silva', telefone: '42999991234' });
    expect(banco.clientes).toHaveLength(0);
    expect((await api.get('/api/clientes/1').set(atendente)).status).toBe(404);
    expect((await api.get('/api/clientes').query({ busca: 'Maria' }).set(atendente)).body.ofertaCadastro).toBe(true);
  });

  it('o identificador excluído não é reaproveitado por um novo cliente', async () => {
    const { api, atendente } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    await api.delete('/api/clientes/1').set(atendente);
    const novo = await api.post('/api/clientes').set(atendente).send(clienteValido);
    expect(novo.body.id).toBe(2);
  });

  it('recusa excluir cliente com equipamento (409) e não apaga nada', async () => {
    const { api, atendente, banco } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    await api.post('/api/clientes/1/equipamentos').set(atendente).send({ tipo: 'Notebook' });

    const r = await api.delete('/api/clientes/1').set(atendente);

    expect(r.status).toBe(409);
    expect(r.body.erro.codigo).toBe('CLIENTE_COM_VINCULOS');
    expect(r.body.erro.mensagem).toMatch(/histórico/i);
    expect(banco.clientes).toHaveLength(1);
    expect(banco.equipamentos).toHaveLength(1);
  });

  it('depois de excluir os equipamentos, o cliente pode ser excluído', async () => {
    const { api, atendente, banco } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    await api.post('/api/clientes/1/equipamentos').set(atendente).send({ tipo: 'Notebook' });
    expect((await api.delete('/api/clientes/1').set(atendente)).status).toBe(409);

    expect((await api.delete('/api/clientes/1/equipamentos/1').set(atendente)).status).toBe(200);
    expect((await api.delete('/api/clientes/1').set(atendente)).status).toBe(200);
    expect(banco.clientes).toHaveLength(0);
  });

  it('excluir um cliente não afeta os outros', async () => {
    const { api, atendente, banco } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    await api.post('/api/clientes').set(atendente).send({ nome: 'Pedro Alves', telefone: '42933334444' });
    await api.post('/api/clientes/2/equipamentos').set(atendente).send({ tipo: 'Celular' });

    await api.delete('/api/clientes/1').set(atendente);

    expect(banco.clientes.map((c) => c.id)).toEqual([2]);
    expect((await api.get('/api/clientes/2/equipamentos').set(atendente)).body.total).toBe(1);
  });

  it('cliente inexistente: 404; id inválido: 400', async () => {
    const { api, atendente } = montar();
    const r = await api.delete('/api/clientes/999').set(atendente);
    expect(r.status).toBe(404);
    expect(r.body.erro.codigo).toBe('CLIENTE_NAO_ENCONTRADO');
    expect((await api.delete('/api/clientes/abc').set(atendente)).status).toBe(400);
    expect((await api.delete('/api/clientes/-5').set(atendente)).status).toBe(400);
  });

  it('RF12: falha ao gravar avisa o erro, sem vazar SQL e sem apagar', async () => {
    const banco = new BancoMemoria();
    const { api, atendente } = montar(banco);
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    quebrar(banco, 'excluir');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const r = await api.delete('/api/clientes/1').set(atendente);

    expect(r.status).toBe(500);
    expect(r.body.erro.codigo).toBe('FALHA_AO_GRAVAR');
    expect(JSON.stringify(r.body)).not.toMatch(/SQL|prisma|Cliente"|\.ts:|constraint/i);
    expect(banco.clientes).toHaveLength(1);
    spy.mockRestore();
  });
});

describe('Cliente — acesso ao PUT e ao DELETE (RF02)', () => {
  it.each([
    ['put', '/api/clientes/1'],
    ['delete', '/api/clientes/1'],
  ] as const)('%s %s sem token → 401', async (metodo, rota) => {
    const { api } = montar();
    const r = await api[metodo](rota).send(clienteValido);
    expect(r.status).toBe(401);
    expect(r.body.erro.codigo).toBe('NAO_AUTENTICADO');
  });

  it('token adulterado (assinatura trocada) → 401 e nada é excluído', async () => {
    const { api, atendente, banco } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    const adulterado = `Bearer ${token('ATENDENTE', 1).slice(0, -3)}abc`;

    expect((await api.delete('/api/clientes/1').set('Authorization', adulterado)).status).toBe(401);
    expect((await api.put('/api/clientes/1').set('Authorization', adulterado).send(clienteValido)).status).toBe(401);
    expect(banco.clientes).toHaveLength(1);
  });

  it('técnico só lê: PUT e DELETE dão 403 e nada muda', async () => {
    const { api, atendente, tecnico, banco } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    const antes = JSON.stringify(banco.clientes);

    const put = await api.put('/api/clientes/1').set(tecnico).send({ nome: 'Hack', email: 'h@x.com' });
    const del = await api.delete('/api/clientes/1').set(tecnico);

    expect(put.status).toBe(403);
    expect(del.status).toBe(403);
    expect(put.body.erro.codigo).toBe('ACESSO_NEGADO');
    expect(JSON.stringify(banco.clientes)).toBe(antes);
  });

  it('o perfil é checado antes de qualquer consulta: técnico não descobre se o id existe', async () => {
    const { api, tecnico } = montar();
    expect((await api.delete('/api/clientes/999').set(tecnico)).status).toBe(403);
    expect((await api.put('/api/clientes/999').set(tecnico).send(clienteValido)).status).toBe(403);
  });
});
