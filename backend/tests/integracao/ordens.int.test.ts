/**
 * Integração da OS com PostgreSQL REAL (npm run test:int). Apaga os dados das
 * tabelas a cada teste; use um banco de teste.
 */
import { PrismaClient } from '@prisma/client';
import { STATUS_INICIAL } from '../../src/dominio/ordemServico';
import { OrdemServicoPrismaRepositorio } from '../../src/infra/prismaOrdemServico';
import {
  ClientePrismaRepositorio,
  EquipamentoPrismaRepositorio,
} from '../../src/infra/prismaRepositorios';

const temBanco = !!process.env['DATABASE_URL'];
const suite = temBanco ? describe : describe.skip;

suite('OS: repositório Prisma + PostgreSQL', () => {
  let prisma: PrismaClient;
  let clientes: ClientePrismaRepositorio;
  let equipamentos: EquipamentoPrismaRepositorio;
  let ordens: OrdemServicoPrismaRepositorio;

  beforeAll(() => {
    prisma = new PrismaClient();
    clientes = new ClientePrismaRepositorio(prisma);
    equipamentos = new EquipamentoPrismaRepositorio(prisma);
    ordens = new OrdemServicoPrismaRepositorio(prisma);
  });
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "OrdemServico", "Equipamento", "Cliente" RESTART IDENTITY CASCADE',
    );
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function clienteComEquipamento(nome = 'Maria') {
    const c = await clientes.criar({ nome, telefone: '42999990000', email: null, criadoPorId: 1 });
    const e = await equipamentos.criarParaCliente(c.id, {
      tipo: 'Notebook', marca: null, modelo: null, numeroSerie: null, criadoPorId: 1,
    });
    return { c, e: e! };
  }
  const nova = (clienteId: number, codigo: number, problema = 'Não liga') => ({
    clienteId, equipamentoCodigoInterno: codigo, problemaRelatado: problema, criadoPorId: 3,
  });

  it('abre a OS com número sequencial, status inicial e autor (RN03, RN04, RN22)', async () => {
    const { c, e } = await clienteComEquipamento();
    const a = await ordens.abrir(nova(c.id, e.codigoInterno));
    const b = await ordens.abrir(nova(c.id, e.codigoInterno, 'Outro'));
    expect(a).toMatchObject({ numero: 1, status: STATUS_INICIAL, criadoPorId: 3, problemaRelatado: 'Não liga' });
    expect(a.status).toBe('Aguardando Diagnóstico');
    expect(b.numero).toBe(2);
    expect((await ordens.buscarPorNumero(1))?.criadoEm).toBeInstanceOf(Date);
    expect(await ordens.buscarPorNumero(99)).toBeNull();
  });

  it('abertura simultânea nunca repete número (RN03)', async () => {
    const { c, e } = await clienteComEquipamento();
    const feitas = await Promise.all(
      Array.from({ length: 10 }, (_, i) => ordens.abrir(nova(c.id, e.codigoInterno, `Problema ${i}`))),
    );
    expect(new Set(feitas.map((o) => o.numero)).size).toBe(10);
  });

  it('RN01: o banco recusa OS de equipamento inexistente ou de outro cliente', async () => {
    const { c } = await clienteComEquipamento('Maria');
    const outro = await clientes.criar({ nome: 'Pedro', telefone: '42988887777', email: null, criadoPorId: 1 });
    await expect(ordens.abrir(nova(c.id, 99))).rejects.toBeDefined();
    await expect(ordens.abrir(nova(outro.id, 1))).rejects.toBeDefined(); // outro não tem equipamento 1
    expect(await prisma.ordemServico.count()).toBe(0); // nada pela metade (RF12)
  });

  it('RN02: o banco recusa problema vazio ou só com espaços', async () => {
    const { c, e } = await clienteComEquipamento();
    await expect(ordens.abrir(nova(c.id, e.codigoInterno, '   '))).rejects.toBeDefined();
    expect(await prisma.ordemServico.count()).toBe(0);
  });

  it('lista mais recentes primeiro e filtra por cliente e status (RF14)', async () => {
    const m = await clienteComEquipamento('Maria');
    const p = await clienteComEquipamento('Pedro');
    await ordens.abrir(nova(m.c.id, m.e.codigoInterno)); // 1
    await ordens.abrir(nova(p.c.id, p.e.codigoInterno)); // 2
    await ordens.abrir(nova(m.c.id, m.e.codigoInterno, 'Outra')); // 3

    expect((await ordens.listar({ limite: 100 })).map((o) => o.numero)).toEqual([3, 2, 1]);
    expect((await ordens.listar({ clienteId: m.c.id, limite: 100 })).map((o) => o.numero)).toEqual([3, 1]);
    expect(await ordens.listar({ status: 'Concluída', limite: 100 })).toEqual([]);
    expect((await ordens.listar({ clienteId: p.c.id, status: STATUS_INICIAL, limite: 100 })).map((o) => o.numero)).toEqual([2]);
    expect(await ordens.listar({ limite: 2 })).toHaveLength(2);
  });

  it('OS em aberto do equipamento: ignora concluídas e canceladas (RF11, RN19)', async () => {
    const { c, e } = await clienteComEquipamento();
    await ordens.abrir(nova(c.id, e.codigoInterno)); // 1
    await ordens.abrir(nova(c.id, e.codigoInterno, 'B')); // 2
    await ordens.abrir(nova(c.id, e.codigoInterno, 'C')); // 3
    await prisma.ordemServico.update({ where: { numero: 2 }, data: { status: 'Concluída' } });
    await prisma.ordemServico.update({ where: { numero: 3 }, data: { status: 'Cancelada' } });
    const abertas = await ordens.buscarEmAbertoDoEquipamento(c.id, e.codigoInterno);
    expect(abertas.map((o) => o.numero)).toEqual([1]);
  });

  it('RN20: cliente e equipamento com OS não são excluídos, e a OS permanece', async () => {
    const { c, e } = await clienteComEquipamento();
    await ordens.abrir(nova(c.id, e.codigoInterno));

    expect(await equipamentos.excluir(c.id, e.codigoInterno)).toEqual({ resultado: 'EM_USO' });
    expect(await clientes.excluir(c.id)).toEqual({ resultado: 'EM_USO' });

    expect(await prisma.ordemServico.count()).toBe(1);
    expect(await clientes.buscarPorId(c.id)).not.toBeNull();
    expect(await equipamentos.buscar(c.id, e.codigoInterno)).not.toBeNull();
  });
});