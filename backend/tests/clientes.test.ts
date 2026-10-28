import { clienteValido, montar } from './helpers/app';

describe('Cliente — cadastro (RF04, RN07, RN22)', () => {
  it('cadastra cliente válido, normaliza contatos e registra quem criou', async () => {
    const { api, atendente, banco } = montar();
    const r = await api.post('/api/clientes').set(atendente).send(clienteValido);

    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      id: 1,
      nome: 'Maria da Silva',
      telefone: '42999991234',
      email: 'maria@exemplo.com',
      criadoPorId: 7,
    });
    expect(r.body.criadoEm).toBeDefined();
    expect(r.headers['location']).toBe('/api/clientes/1');
    expect(banco.clientes).toHaveLength(1);
  });

  it('aceita só e-mail ou só telefone (um contato basta)', async () => {
    const { api, atendente } = montar();
    const a = await api.post('/api/clientes').set(atendente).send({ nome: 'Ana Lima', email: 'ana@x.com' });
    const b = await api.post('/api/clientes').set(atendente).send({ nome: 'Bruno Reis', telefone: '4232221111' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
  });

  it('aceita telefone com +55 e máscara', async () => {
    const { api, atendente } = montar();
    const r = await api.post('/api/clientes').set(atendente).send({ nome: 'Carlos Dias', telefone: '+55 (42) 98888-7777' });
    expect(r.status).toBe(201);
    expect(r.body.telefone).toBe('42988887777');
  });

  it('CPF e endereço não são exigidos nem coletados (RN07 / LGPD)', async () => {
    const { api, atendente } = montar();
    const r = await api.post('/api/clientes').set(atendente).send({ ...clienteValido, cpf: '12345678901' });
    expect(r.status).toBe(400); // campo desconhecido é rejeitado, não armazenado
    const ok = await api.post('/api/clientes').set(atendente).send(clienteValido);
    expect(ok.body).not.toHaveProperty('cpf');
    expect(ok.body).not.toHaveProperty('endereco');
  });

  it.each([
    ['sem nome', { telefone: '42999991234' }],
    ['nome em branco', { nome: '   ', telefone: '42999991234' }],
    ['nome com 1 caractere', { nome: 'A', telefone: '42999991234' }],
    ['sem nenhum contato', { nome: 'Maria da Silva' }],
    ['contatos vazios', { nome: 'Maria da Silva', telefone: '', email: '  ' }],
    ['telefone inválido', { nome: 'Maria da Silva', telefone: '123' }],
    ['e-mail inválido', { nome: 'Maria da Silva', email: 'nao-e-email' }],
    ['id enviado pelo cliente', { ...clienteValido, id: 99 }],
    ['tipo errado', { nome: 123, telefone: '42999991234' }],
  ])('RN07/RF10: recusa %s, aponta o problema e não grava', async (_d, corpo) => {
    const { api, atendente, banco } = montar();
    const r = await api.post('/api/clientes').set(atendente).send(corpo);
    expect(r.status).toBe(400);
    expect(r.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(r.body.erro.detalhes.length).toBeGreaterThan(0);
    expect(banco.clientes).toHaveLength(0);
  });
});

describe('Cliente — duplicidade (RN08)', () => {
  it('alerta nome igual (sem diferenciar maiúsculas) e NÃO mescla nem grava', async () => {
    const { api, atendente, banco } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);

    const r = await api
      .post('/api/clientes')
      .set(atendente)
      .send({ nome: 'MARIA DA SILVA', telefone: '42911112222' });

    expect(r.status).toBe(409);
    expect(r.body.erro.codigo).toBe('POSSIVEL_CLIENTE_DUPLICADO');
    expect(r.body.erro.detalhes.candidatos).toHaveLength(1);
    expect(r.body.erro.detalhes.candidatos[0].id).toBe(1);
    expect(banco.clientes).toHaveLength(1);
  });

  it('alerta telefone igual com nome diferente', async () => {
    const { api, atendente } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    const r = await api.post('/api/clientes').set(atendente).send({ nome: 'José Souza', telefone: '42 99999 1234' });
    expect(r.status).toBe(409);
  });

  it('alerta e-mail igual', async () => {
    const { api, atendente } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    const r = await api.post('/api/clientes').set(atendente).send({ nome: 'José Souza', email: 'MARIA@exemplo.com' });
    expect(r.status).toBe(409);
  });

  it('com confirmarDuplicidade cria outro cliente, com identificador próprio', async () => {
    const { api, atendente, banco } = montar();
    await api.post('/api/clientes').set(atendente).send(clienteValido);
    const r = await api
      .post('/api/clientes')
      .set(atendente)
      .send({ nome: 'Maria da Silva', telefone: '42955554444', confirmarDuplicidade: true });
    expect(r.status).toBe(201);
    expect(r.body.id).toBe(2);
    expect(banco.clientes).toHaveLength(2);
    expect(r.body).not.toHaveProperty('confirmarDuplicidade');
  });
});

describe('Cliente — busca (RF05, RF06)', () => {
  async function semear() {
    const ctx = montar();
    const { api, atendente } = ctx;
    await api.post('/api/clientes').set(atendente).send({ nome: 'João Pereira', telefone: '42999990001', email: 'joao1@x.com' });
    await api.post('/api/clientes').set(atendente).send({ nome: 'João Pereira', telefone: '42999990002', confirmarDuplicidade: true });
    await api.post('/api/clientes').set(atendente).send({ nome: 'Paula Gomes', email: 'paula@x.com' });
    return ctx;
  }

  it('busca por parte do nome; homônimos se distinguem por id e contato', async () => {
    const { api, atendente } = await semear();
    const r = await api.get('/api/clientes').query({ busca: 'joão' }).set(atendente);
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(2);
    const [a, b] = r.body.clientes;
    expect(a.id).not.toBe(b.id);
    expect(a.telefone).not.toBe(b.telefone);
    expect(r.body.ofertaCadastro).toBe(false);
  });

  it('busca por telefone (com ou sem máscara) e por e-mail', async () => {
    const { api, atendente } = await semear();
    const t = await api.get('/api/clientes').query({ busca: '(42) 99999-0002' }).set(atendente);
    expect(t.body.clientes.map((c: { id: number }) => c.id)).toEqual([2]);
    const e = await api.get('/api/clientes').query({ busca: 'paula@x.com' }).set(atendente);
    expect(e.body.clientes.map((c: { id: number }) => c.id)).toEqual([3]);
  });

  it('RF06: sem resultado, avisa e oferece o cadastro', async () => {
    const { api, atendente } = await semear();
    const r = await api.get('/api/clientes').query({ busca: 'inexistente' }).set(atendente);
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(0);
    expect(r.body.ofertaCadastro).toBe(true);
    expect(r.body.mensagem).toMatch(/cadastr/i);
  });

  it('exige termo de busca (mín. 2 caracteres)', async () => {
    const { api, atendente } = await semear();
    expect((await api.get('/api/clientes').set(atendente)).status).toBe(400);
    expect((await api.get('/api/clientes').query({ busca: 'a' }).set(atendente)).status).toBe(400);
  });

  it('consulta por id; inexistente avisa e oferece cadastro; consulta não altera nada', async () => {
    const { api, atendente, banco } = await semear();
    const antes = JSON.stringify(banco.clientes);
    const ok = await api.get('/api/clientes/3').set(atendente);
    expect(ok.status).toBe(200);
    expect(ok.body.nome).toBe('Paula Gomes');

    const nao = await api.get('/api/clientes/999').set(atendente);
    expect(nao.status).toBe(404);
    expect(nao.body.erro.codigo).toBe('CLIENTE_NAO_ENCONTRADO');
    expect(nao.body.erro.detalhes.ofertaCadastro).toBe(true);

    expect((await api.get('/api/clientes/abc').set(atendente)).status).toBe(400);
    expect((await api.get('/api/clientes/-1').set(atendente)).status).toBe(400);
    expect(JSON.stringify(banco.clientes)).toBe(antes);
  });
});
