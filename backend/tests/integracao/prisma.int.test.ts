/**
 * Integração com PostgreSQL REAL (risco "Prisma ORM x modelagem" dos slides).
 * Só roda com DATABASE_URL definido e a migration aplicada:
 *   npx prisma migrate deploy && DATABASE_URL=... npm test -- integracao
 * Sem DATABASE_URL, a suíte é ignorada.
 */
import { PrismaClient } from '@prisma/client';
import {
  ClientePrismaRepositorio,
  EquipamentoPrismaRepositorio,
  UsuarioPrismaRepositorio,
} from '../../src/infra/prismaRepositorios';

const temBanco = !!process.env['DATABASE_URL'];
const suite = temBanco ? describe : describe.skip;

suite('Repositórios Prisma + PostgreSQL', () => {
  // Criados em beforeAll: com describe.skip o corpo ainda executa, e o client
  // só existe depois de `prisma generate`.
  let prisma: PrismaClient;
  let clientes: ClientePrismaRepositorio;
  let equipamentos: EquipamentoPrismaRepositorio;
  let usuarios: UsuarioPrismaRepositorio;

  beforeAll(() => {
    prisma = new PrismaClient();
    clientes = new ClientePrismaRepositorio(prisma);
    equipamentos = new EquipamentoPrismaRepositorio(prisma);
    usuarios = new UsuarioPrismaRepositorio(prisma);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "Equipamento", "Cliente", "Usuario" RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const novo = (nome: string, telefone: string | null = '42999990000') => ({
    nome,
    telefone,
    email: null,
    criadoPorId: 1,
  });

  const novoUsuario = (nome: string, email: string) => ({
    nome,
    email,
    senha: 'senha-segura',
    perfil: 'ATENDENTE' as const,
  });

  it('gera codigoInterno por cliente, sem repetir, mesmo com cadastros simultâneos', async () => {
    const a = await clientes.criar(novo('Cliente A'));
    const b = await clientes.criar(novo('Cliente B', '42988880000'));
    const dados = { tipo: 'Notebook', marca: null, modelo: null, numeroSerie: null, criadoPorId: 1 };

    const feitos = await Promise.all(
      Array.from({ length: 10 }, () => equipamentos.criarParaCliente(a.id, dados)),
    );
    const codigos = feitos.map((e) => e!.codigoInterno).sort((x, y) => x - y);
    expect(codigos).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    expect((await equipamentos.criarParaCliente(b.id, dados))!.codigoInterno).toBe(1);
  });

  it('retorna null para cliente inexistente e não cria equipamento órfão', async () => {
    const r = await equipamentos.criarParaCliente(999, {
      tipo: 'Notebook', marca: null, modelo: null, numeroSerie: null, criadoPorId: 1,
    });
    expect(r).toBeNull();
    expect(await prisma.equipamento.count()).toBe(0);
  });

  it('banco impede cliente sem contato (CHECK) e exclusão de cliente com equipamento (RN20)', async () => {
    await expect(
      prisma.cliente.create({ data: { nome: 'Sem Contato', criadoPorId: 1 } }),
    ).rejects.toBeDefined();

    const c = await clientes.criar(novo('Com Equipamento'));
    await equipamentos.criarParaCliente(c.id, {
      tipo: 'Celular', marca: null, modelo: null, numeroSerie: null, criadoPorId: 1,
    });
    await expect(prisma.cliente.delete({ where: { id: c.id } })).rejects.toBeDefined();
  });

  it('busca por nome (sem diferenciar maiúsculas) e candidatos a duplicidade', async () => {
    const c = await clientes.criar(novo('João Pereira'));
    expect((await clientes.buscarPorTexto('joão', 10)).map((x) => x.id)).toEqual([c.id]);
    expect(
      (await clientes.buscarCandidatosDuplicidade({ nome: 'JOÃO PEREIRA', telefone: null, email: null })).length,
    ).toBe(1);
  });

  // --- CRUD completo (PB18) ---------------------------------------------------

  const dadosEq = { tipo: 'Notebook', marca: null, modelo: null, numeroSerie: null, criadoPorId: 1 };

  it('atualizar cliente: troca os dados, registra quem/quando e mantém id e criação', async () => {
    const c = await clientes.criar(novo('Maria Antiga'));
    expect(c.atualizadoEm).toBeNull();
    expect(c.atualizadoPorId).toBeNull();

    const r = await clientes.atualizar(c.id, {
      nome: 'Maria Nova', telefone: null, email: 'maria@x.com', atualizadoPorId: 12,
    });

    expect(r).toMatchObject({
      id: c.id, nome: 'Maria Nova', telefone: null, email: 'maria@x.com',
      criadoPorId: 1, atualizadoPorId: 12,
    });
    expect(r!.criadoEm.getTime()).toBe(c.criadoEm.getTime());
    expect(r!.atualizadoEm).toBeInstanceOf(Date);
  });

  it('atualizar cliente inexistente retorna null (P2025) e não cria registro', async () => {
    const r = await clientes.atualizar(999, {
      nome: 'Ninguém', telefone: '42999990000', email: null, atualizadoPorId: 1,
    });
    expect(r).toBeNull();
    expect(await prisma.cliente.count()).toBe(0);
  });

  it('o CHECK do banco também vale na alteração: cliente não fica sem contato', async () => {
    const c = await clientes.criar(novo('Com Contato'));
    await expect(
      clientes.atualizar(c.id, { nome: 'Com Contato', telefone: null, email: null, atualizadoPorId: 1 }),
    ).rejects.toBeDefined();
    expect((await clientes.buscarPorId(c.id))!.telefone).toBe('42999990000');
  });

  it('duplicidade na alteração ignora o próprio cliente e enxerga os outros', async () => {
    const a = await clientes.criar(novo('Ana Souza', '42911110000'));
    const b = await clientes.criar(novo('Bia Lima', '42922220000'));
    const criterioA = { nome: 'Ana Souza', telefone: '42911110000', email: null };

    expect((await clientes.buscarCandidatosDuplicidade(criterioA)).map((x) => x.id)).toEqual([a.id]);
    expect(await clientes.buscarCandidatosDuplicidade({ ...criterioA, ignorarId: a.id })).toEqual([]);
    expect(
      (await clientes.buscarCandidatosDuplicidade({ ...criterioA, nome: 'bia lima', ignorarId: a.id })).map((x) => x.id),
    ).toEqual([b.id]);
  });

  it('excluir cliente: EXCLUIDO sem vínculos; NAO_ENCONTRADO se não existe', async () => {
    const c = await clientes.criar(novo('Para Excluir'));

    const r = await clientes.excluir(c.id);
    expect(r).toMatchObject({ resultado: 'EXCLUIDO', registro: { id: c.id, nome: 'Para Excluir' } });
    expect(await clientes.buscarPorId(c.id)).toBeNull();

    expect(await clientes.excluir(c.id)).toEqual({ resultado: 'NAO_ENCONTRADO' });
  });

  it('RN20: excluir cliente com equipamento retorna EM_USO (FK RESTRICT) e nada é apagado', async () => {
    const c = await clientes.criar(novo('Com Equipamento'));
    await equipamentos.criarParaCliente(c.id, dadosEq);

    expect(await clientes.excluir(c.id)).toEqual({ resultado: 'EM_USO' });
    expect(await clientes.buscarPorId(c.id)).not.toBeNull();
    expect(await prisma.equipamento.count()).toBe(1);

    // removido o equipamento, a exclusão passa
    await equipamentos.excluir(c.id, 1);
    expect((await clientes.excluir(c.id)).resultado).toBe('EXCLUIDO');
  });

  it('atualizar equipamento: troca os dados; dono e código ficam; registra quem/quando', async () => {
    const c = await clientes.criar(novo('Dono'));
    const eq = (await equipamentos.criarParaCliente(c.id, { ...dadosEq, marca: 'Dell' }))!;

    const r = await equipamentos.atualizar(c.id, eq.codigoInterno, {
      tipo: 'Tablet', marca: null, modelo: 'A9', numeroSerie: 'S1', atualizadoPorId: 12,
    });

    expect(r).toMatchObject({
      clienteId: c.id, codigoInterno: eq.codigoInterno, tipo: 'Tablet',
      marca: null, modelo: 'A9', numeroSerie: 'S1', criadoPorId: 1, atualizadoPorId: 12,
    });
    expect(r!.atualizadoEm).toBeInstanceOf(Date);
  });

  it('atualizar/excluir equipamento inexistente ou de outro cliente: null / NAO_ENCONTRADO', async () => {
    const a = await clientes.criar(novo('A', '42911110000'));
    const b = await clientes.criar(novo('B', '42922220000'));
    await equipamentos.criarParaCliente(a.id, dadosEq); // código 1 só existe no cliente A

    const alterar = { tipo: 'Invasor', marca: null, modelo: null, numeroSerie: null, atualizadoPorId: 1 };
    expect(await equipamentos.atualizar(b.id, 1, alterar)).toBeNull();
    expect(await equipamentos.atualizar(a.id, 77, alterar)).toBeNull();
    expect(await equipamentos.excluir(b.id, 1)).toEqual({ resultado: 'NAO_ENCONTRADO' });
    expect((await equipamentos.buscar(a.id, 1))!.tipo).toBe('Notebook');
  });

  it('excluir equipamento: devolve o excluído e o código NÃO é reaproveitado', async () => {
    const c = await clientes.criar(novo('Dono'));
    await equipamentos.criarParaCliente(c.id, dadosEq);
    await equipamentos.criarParaCliente(c.id, { ...dadosEq, tipo: 'Celular' });

    const r = await equipamentos.excluir(c.id, 1);
    expect(r).toMatchObject({ resultado: 'EXCLUIDO', registro: { clienteId: c.id, codigoInterno: 1 } });
    expect((await equipamentos.listarPorCliente(c.id)).map((e) => e.codigoInterno)).toEqual([2]);

    expect((await equipamentos.criarParaCliente(c.id, dadosEq))!.codigoInterno).toBe(3);
  });

  // --- CRUD Usuários (Atendentes, Técnicos e Gerentes) ---------------------

  it('cria usuário, busca por id, lista ordenado e impede e-mail duplicado (P2002)', async () => {
    const u1 = await usuarios.criar(novoUsuario('Atendente Um', 'atendente1@sysos.com'));
    expect(u1.id).toBeDefined();
    expect(u1.perfil).toBe('ATENDENTE');

    const busca = await usuarios.buscarPorId(u1.id);
    expect(busca).toMatchObject({ id: u1.id, nome: 'Atendente Um', email: 'atendente1@sysos.com' });

    await usuarios.criar({ ...novoUsuario('Técnico Dois', 'tecnico2@sysos.com'), perfil: 'TECNICO' });
    const todos = await usuarios.listarTodos();
    expect(todos.map((u) => u.nome)).toEqual(['Atendente Um', 'Técnico Dois']);

    await expect(usuarios.criar(novoUsuario('Duplicado', 'atendente1@sysos.com'))).rejects.toBeDefined();
  });

  it('atualizar e excluir usuário: atualiza campos, trata inexistente (null / false) e remove do banco', async () => {
  const u = await usuarios.criar(novoUsuario('Nome Antigo', 'antigo@sysos.com'));

  const atualizado = await usuarios.atualizar(u.id, { nome: 'Nome Novo', perfil: 'TECNICO' });
  expect(atualizado).toMatchObject({ id: u.id, nome: 'Nome Novo', perfil: 'TECNICO' });

    expect(await usuarios.atualizar(999, { nome: 'Inexistente' })).toBeNull();

    const excluido = await usuarios.excluir(u.id);
    expect(excluido).toBe(true);
    expect(await usuarios.buscarPorId(u.id)).toBeNull();

    expect(await usuarios.excluir(999)).toBe(false);
  });
});