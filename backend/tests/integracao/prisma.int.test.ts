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
} from '../../src/infra/prismaRepositorios';

const temBanco = !!process.env['DATABASE_URL'];
const suite = temBanco ? describe : describe.skip;

suite('Repositórios Prisma + PostgreSQL', () => {
  // Criados em beforeAll: com describe.skip o corpo ainda executa, e o client
  // só existe depois de `prisma generate`.
  let prisma: PrismaClient;
  let clientes: ClientePrismaRepositorio;
  let equipamentos: EquipamentoPrismaRepositorio;

  beforeAll(() => {
    prisma = new PrismaClient();
    clientes = new ClientePrismaRepositorio(prisma);
    equipamentos = new EquipamentoPrismaRepositorio(prisma);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "Equipamento", "Cliente" RESTART IDENTITY CASCADE');
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
});
