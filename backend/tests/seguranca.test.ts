import jwt from 'jsonwebtoken';
import { SEGREDO, clienteValido, montar, token } from './helpers/app';
import { BancoMemoria } from './helpers/memoria';

const ROTAS = [
  ['post', '/api/clientes'],
  ['get', '/api/clientes?busca=maria'],
  ['get', '/api/clientes/1'],
  ['post', '/api/clientes/1/equipamentos'],
  ['get', '/api/clientes/1/equipamentos'],
  ['get', '/api/clientes/1/equipamentos/1'],
  ['get', '/api/rota-que-nao-existe'],
] as const;

describe('RF02 — login exigido em toda rota da API, inclusive chamada direta', () => {
  it.each(ROTAS)('%s %s sem token → 401', async (metodo, rota) => {
    const { api } = montar();
    const r = await api[metodo](rota).send({});
    expect(r.status).toBe(401);
    expect(r.body.erro.codigo).toBe('NAO_AUTENTICADO');
  });

  it('recusa token inválido, de outro segredo, expirado, sem perfil válido e alg=none', async () => {
    const { api } = montar();
    const rota = '/api/clientes?busca=maria';
    const ruins = [
      'lixo',
      jwt.sign({ perfil: 'ATENDENTE' }, 'outro-segredo-qualquer-com-32-caracteres!!', { subject: '1' }),
      token('ATENDENTE', 1, { expiresIn: -10 }),
      jwt.sign({ perfil: 'ADMIN' }, SEGREDO, { subject: '1' }),
      jwt.sign({ perfil: 'ATENDENTE' }, SEGREDO, { subject: 'abc' }),
      `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(
        '{"sub":"1","perfil":"ATENDENTE"}',
      ).toString('base64url')}.`,
    ];
    for (const t of ruins) {
      const r = await api.get(rota).set('Authorization', `Bearer ${t}`);
      expect(r.status).toBe(401);
    }
    expect((await api.get(rota).set('Authorization', 'Basic abc')).status).toBe(401);
  });

  it('aceita token válido', async () => {
    const { api, atendente } = montar();
    expect((await api.get('/api/clientes?busca=maria').set(atendente)).status).toBe(200);
  });
});

describe('RF02 — perfil checado em cada rota (matriz de acesso proposta)', () => {
  it('técnico não cadastra cliente nem equipamento (403) e nada é gravado', async () => {
    const { api, atendente, tecnico, banco } = montar();
    const c = await api.post('/api/clientes').set(atendente).send(clienteValido);

    const r1 = await api.post('/api/clientes').set(tecnico).send({ nome: 'Fulano Teste', email: 'f@x.com' });
    const r2 = await api.post(`/api/clientes/${c.body.id}/equipamentos`).set(tecnico).send({ tipo: 'Notebook' });

    expect(r1.status).toBe(403);
    expect(r2.status).toBe(403);
    expect(r1.body.erro.codigo).toBe('ACESSO_NEGADO');
    expect(banco.clientes).toHaveLength(1);
    expect(banco.equipamentos).toHaveLength(0);
  });

  it('técnico consulta cliente e equipamentos (leitura)', async () => {
    const { api, atendente, tecnico } = montar();
    const c = await api.post('/api/clientes').set(atendente).send(clienteValido);
    await api.post(`/api/clientes/${c.body.id}/equipamentos`).set(atendente).send({ tipo: 'Notebook' });

    expect((await api.get('/api/clientes?busca=maria').set(tecnico)).status).toBe(200);
    expect((await api.get(`/api/clientes/${c.body.id}`).set(tecnico)).status).toBe(200);
    expect((await api.get(`/api/clientes/${c.body.id}/equipamentos`).set(tecnico)).status).toBe(200);
    expect((await api.get(`/api/clientes/${c.body.id}/equipamentos/1`).set(tecnico)).status).toBe(200);
  });
});

describe('RNF — erros sem detalhes internos e gravação sem resultado parcial (RF12)', () => {
  class BancoQuebrado extends BancoMemoria {
    constructor(private readonly alvo: 'cliente' | 'equipamento') {
      super();
    }
    override async criar(...a: Parameters<BancoMemoria['criar']>): ReturnType<BancoMemoria['criar']> {
      if (this.alvo === 'cliente') {
        throw new Error('ERRO SQL: relation "Cliente" violates constraint at /srv/app/prisma.ts:42');
      }
      return super.criar(...a);
    }
    override async criarParaCliente(
      ...a: Parameters<BancoMemoria['criarParaCliente']>
    ): ReturnType<BancoMemoria['criarParaCliente']> {
      if (this.alvo === 'equipamento') {
        throw new Error('ERRO SQL: relation "Equipamento" violates constraint');
      }
      return super.criarParaCliente(...a);
    }
  }

  it('falha ao gravar cliente: avisa o erro, sem sucesso falso e sem vazar SQL/stack/tabela', async () => {
    const banco = new BancoQuebrado('cliente');
    const { api, atendente } = montar(banco);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const r = await api.post('/api/clientes').set(atendente).send(clienteValido);

    expect(r.status).toBe(500);
    expect(r.body.erro.codigo).toBe('FALHA_AO_GRAVAR');
    const texto = JSON.stringify(r.body);
    expect(texto).not.toMatch(/SQL|prisma|Cliente"|stack|\.ts:|constraint/i);
    expect(banco.clientes).toHaveLength(0);
    spy.mockRestore();
  });

  it('falha ao gravar equipamento: avisa o erro e não deixa registro pela metade', async () => {
    const banco = new BancoQuebrado('equipamento');
    const { api, atendente } = montar(banco);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const c = await api.post('/api/clientes').set(atendente).send(clienteValido);

    const r = await api.post(`/api/clientes/${c.body.id}/equipamentos`).set(atendente).send({ tipo: 'Notebook' });

    expect(r.status).toBe(500);
    expect(r.body.erro.codigo).toBe('FALHA_AO_GRAVAR');
    expect(JSON.stringify(r.body)).not.toMatch(/SQL|Equipamento"|stack|constraint/i);
    expect(banco.equipamentos).toHaveLength(0);
    spy.mockRestore();
  });

  it('erro inesperado vira 500 genérico; JSON malformado vira 400', async () => {
    const banco = new BancoMemoria();
    banco.buscarPorId = async () => {
      throw new TypeError('detalhe interno secreto');
    };
    const { api, atendente } = montar(banco);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const r = await api.get('/api/clientes/1').set(atendente);
    expect(r.status).toBe(500);
    expect(r.body.erro.codigo).toBe('ERRO_INTERNO');
    expect(JSON.stringify(r.body)).not.toMatch(/secreto|stack/i);
    spy.mockRestore();

    const ctx = montar();
    const ruim = await ctx.api
      .post('/api/clientes')
      .set(ctx.atendente)
      .set('Content-Type', 'application/json')
      .send('{"nome": ');
    expect(ruim.status).toBe(400);
    expect(ruim.body.erro.codigo).toBe('JSON_INVALIDO');
  });

  it('não expõe o cabeçalho x-powered-by', async () => {
    const { api } = montar();
    const r = await api.get('/health');
    expect(r.status).toBe(200);
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.body).toEqual({ status: 'ok' });
  });
});
