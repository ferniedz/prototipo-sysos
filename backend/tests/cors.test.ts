import { configurarOrigens, ORIGENS_PADRAO } from '../src/http/cors';
import { montar, clienteValido } from './helpers/app';
import { criarApp } from '../src/http/app';
import { BancoMemoria } from './helpers/memoria';
import { SEGREDO } from './helpers/app';
import { injetar } from './helpers/injetar';

describe('CORS e contrato HTTP com Express em memória', () => {
  it('permite preflight de POST com Authorization e Content-Type sem exigir JWT', async () => {
    const { app } = montar();
    const response = await injetar(app, { metodo: 'OPTIONS', caminho: '/api/clientes', cabecalhos: {
      Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type',
    } });
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-headers']).toBe('Authorization, Content-Type');
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    expect(response.headers.vary).toContain('Origin');
  });

  it('mantém autenticação na requisição efetiva e inclui CORS no erro 401', async () => {
    const { app } = montar();
    const response = await injetar(app, { caminho: '/api/clientes?busca=Maria', cabecalhos: { Origin: 'http://localhost:5173' } });
    expect(response.status).toBe(401);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('permite consulta autenticada e bloqueia origem não autorizada', async () => {
    const { app, tecnico } = montar();
    const response = await injetar(app, { caminho: '/api/clientes?busca=Maria', cabecalhos: { ...tecnico, Origin: 'http://127.0.0.1:5173' } });
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
    const rejected = await injetar(app, { caminho: '/health', cabecalhos: { Origin: 'https://origem-invalida.example' } });
    expect(rejected.status).toBe(403);
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('aplica origens configuradas e não bloqueia chamadas sem Origin', async () => {
    const banco = new BancoMemoria();
    const app = criarApp({ clientes: banco, equipamentos: banco, jwtSegredo: SEGREDO, origensCors: ['https://sysos.example'] });
    expect((await injetar(app, { caminho: '/health' })).status).toBe(200);
    const response = await injetar(app, { caminho: '/health', cabecalhos: { Origin: 'https://sysos.example' } });
    expect(response.headers['access-control-allow-origin']).toBe('https://sysos.example');
    expect((await injetar(app, { caminho: '/health', cabecalhos: { Origin: 'http://localhost:5173' } })).status).toBe(403);
  });

  it.each([['PATCH', 'authorization'], ['POST', 'authorization,x-custom']])('recusa preflight fora do contrato: %s / %s', async (method, headers) => {
    const { app } = montar();
    const response = await injetar(app, { metodo: 'OPTIONS', caminho: '/api/clientes', cabecalhos: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': headers } });
    expect(response.status).toBe(403);
  });

  it.each([['PUT', '/api/clientes/1', 'authorization,content-type'], ['DELETE', '/api/clientes/1/equipamentos/1', 'authorization']])('CRUD: permite preflight de %s %s sem exigir JWT', async (method, caminho, headers) => {
    const { app } = montar();
    const response = await injetar(app, { metodo: 'OPTIONS', caminho, cabecalhos: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': headers } });
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-methods']).toBe('GET, POST, PUT, DELETE, OPTIONS');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('valida as origens sem usar coringa', () => {
    expect(configurarOrigens()).toEqual(ORIGENS_PADRAO);
    expect(configurarOrigens(' https://sysos.example, http://localhost:5173 ')).toEqual(['https://sysos.example', 'http://localhost:5173']);
    expect(configurarOrigens('')).toEqual([]);
    expect(() => configurarOrigens('*')).toThrow();
    expect(() => configurarOrigens('https://sysos.example/caminho')).toThrow();
  });

  it('cadastro, duplicidade e busca continuam funcionando para o frontend', async () => {
    const { app, atendente, tecnico } = montar();
    const headers = { ...atendente, Origin: 'http://localhost:5173' };
    const created = await injetar(app, { metodo: 'POST', caminho: '/api/clientes', cabecalhos: headers, corpo: clienteValido });
    expect(created.status).toBe(201);
    expect(created.body.telefone).toBe('42999991234');
    expect(created.headers['access-control-expose-headers']).toBe('Location');
    const duplicate = await injetar(app, { metodo: 'POST', caminho: '/api/clientes', cabecalhos: headers, corpo: clienteValido });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.erro.detalhes.candidatos[0].id).toBe(created.body.id);
    const search = await injetar(app, { caminho: '/api/clientes?busca=Maria', cabecalhos: { ...tecnico, Origin: 'http://localhost:5173' } });
    expect(search.body.clientes).toHaveLength(1);
    expect(search.body.clientes[0].criadoEm).toBeUndefined();
    expect((await injetar(app, { caminho: '/api/clientes', cabecalhos: headers })).status).toBe(400);
  });

  it('mantém equipamentos no contexto de um cliente, mesmo repetindo o código em outro', async () => {
    const { app, atendente } = montar();
    const make = (nome: string) => injetar(app, { metodo: 'POST', caminho: '/api/clientes', cabecalhos: atendente, corpo: { nome, email: `${nome}@example.com` } });
    const a = await make('ClienteA');
    const b = await make('ClienteB');
    for (const client of [a, b]) {
      const result = await injetar(app, { metodo: 'POST', caminho: `/api/clientes/${client.body.id}/equipamentos`, cabecalhos: atendente, corpo: { tipo: 'Notebook' } });
      expect(result.body.codigoInterno).toBe(1);
      expect(result.body.clienteId).toBe(client.body.id);
    }
    const list = await injetar(app, { caminho: `/api/clientes/${a.body.id}/equipamentos`, cabecalhos: atendente });
    expect(list.body.equipamentos).toHaveLength(1);
    expect(list.body.equipamentos[0].clienteId).toBe(a.body.id);
    expect((await injetar(app, { caminho: `/api/clientes/${b.body.id}/equipamentos/1`, cabecalhos: atendente })).body.clienteId).toBe(b.body.id);
  });
});
