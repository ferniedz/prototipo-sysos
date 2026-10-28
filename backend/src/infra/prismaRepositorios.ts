import { Prisma, PrismaClient } from '@prisma/client';
import {
  AtualizacaoCliente,
  AtualizacaoEquipamento,
  Cliente,
  ClienteRepositorio,
  Equipamento,
  EquipamentoRepositorio,
  NovoCliente,
  NovoEquipamento,
  ResultadoExclusao,
} from '../dominio/tipos';

/** Única camada que conhece o Prisma/PostgreSQL. */

function codigoPrisma(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null ? (e as { code?: string }).code : undefined;
}

/** P2025: registro não existe. */
const NAO_ENCONTRADO = 'P2025';
/** P2003/P2014: o banco recusou por haver registros dependentes (RESTRICT). */
const EM_USO = ['P2003', 'P2014'];

export class ClientePrismaRepositorio implements ClienteRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async criar(dados: NovoCliente): Promise<Cliente> {
    const c = await this.prisma.cliente.create({
      data: {
        nome: dados.nome,
        telefone: dados.telefone,
        email: dados.email,
        criadoPorId: dados.criadoPorId,
      },
    });
    return paraCliente(c);
  }

  async buscarPorId(id: number): Promise<Cliente | null> {
    const c = await this.prisma.cliente.findUnique({ where: { id } });
    return c ? paraCliente(c) : null;
  }

  async buscarPorTexto(termo: string, limite: number): Promise<Cliente[]> {
    const digitos = termo.replace(/\D/g, '');
    const lista = await this.prisma.cliente.findMany({
      where: {
        OR: [
          { nome: { contains: termo, mode: 'insensitive' } },
          { email: { contains: termo.toLowerCase() } },
          ...(digitos.length >= 4 ? [{ telefone: { contains: digitos } }] : []),
        ],
      },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
      take: limite,
    });
    return lista.map(paraCliente);
  }

  async buscarCandidatosDuplicidade(criterio: {
    nome: string;
    telefone: string | null;
    email: string | null;
    ignorarId?: number;
  }): Promise<Cliente[]> {
    const lista = await this.prisma.cliente.findMany({
      where: {
        OR: [
          { nome: { equals: criterio.nome, mode: 'insensitive' } },
          ...(criterio.telefone ? [{ telefone: criterio.telefone }] : []),
          ...(criterio.email ? [{ email: criterio.email }] : []),
        ],
        ...(criterio.ignorarId !== undefined ? { NOT: { id: criterio.ignorarId } } : {}),
      },
      orderBy: { id: 'asc' },
      take: 10,
    });
    return lista.map(paraCliente);
  }

  async atualizar(id: number, dados: AtualizacaoCliente): Promise<Cliente | null> {
    try {
      const c = await this.prisma.cliente.update({
        where: { id },
        data: {
          nome: dados.nome,
          telefone: dados.telefone,
          email: dados.email,
          atualizadoEm: new Date(),
          atualizadoPorId: dados.atualizadoPorId,
        },
      });
      return paraCliente(c);
    } catch (e) {
      if (codigoPrisma(e) === NAO_ENCONTRADO) return null;
      throw e;
    }
  }

  async excluir(id: number): Promise<ResultadoExclusao<Cliente>> {
    try {
      const c = await this.prisma.cliente.delete({ where: { id } });
      return { resultado: 'EXCLUIDO', registro: paraCliente(c) };
    } catch (e) {
      const codigo = codigoPrisma(e);
      if (codigo === NAO_ENCONTRADO) return { resultado: 'NAO_ENCONTRADO' };
      if (codigo !== undefined && EM_USO.includes(codigo)) return { resultado: 'EM_USO' };
      throw e;
    }
  }
}

export class EquipamentoPrismaRepositorio implements EquipamentoRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Transação única: o UPDATE com incremento trava a linha do cliente, então
   * dois cadastros simultâneos nunca recebem o mesmo codigoInterno. Se o
   * INSERT falhar, o incremento também é desfeito (sem registro pela metade).
   */
  async criarParaCliente(
    clienteId: number,
    dados: NovoEquipamento,
  ): Promise<Equipamento | null> {
    try {
      const criado = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const cliente = await tx.cliente.update({
          where: { id: clienteId },
          data: { proximoCodigoEquipamento: { increment: 1 } },
          select: { proximoCodigoEquipamento: true },
        });
        return tx.equipamento.create({
          data: {
            clienteId,
            codigoInterno: cliente.proximoCodigoEquipamento - 1,
            tipo: dados.tipo,
            marca: dados.marca,
            modelo: dados.modelo,
            numeroSerie: dados.numeroSerie,
            criadoPorId: dados.criadoPorId,
          },
        });
      });
      return criado;
    } catch (e) {
      // P2025: registro a atualizar não existe (cliente inexistente)
      if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2025') {
        return null;
      }
      throw e;
    }
  }

  async listarPorCliente(clienteId: number): Promise<Equipamento[]> {
    return this.prisma.equipamento.findMany({
      where: { clienteId },
      orderBy: { codigoInterno: 'asc' },
    });
  }

  async buscar(clienteId: number, codigoInterno: number): Promise<Equipamento | null> {
    return this.prisma.equipamento.findUnique({
      where: { clienteId_codigoInterno: { clienteId, codigoInterno } },
    });
  }

  async atualizar(
    clienteId: number,
    codigoInterno: number,
    dados: AtualizacaoEquipamento,
  ): Promise<Equipamento | null> {
    try {
      return await this.prisma.equipamento.update({
        where: { clienteId_codigoInterno: { clienteId, codigoInterno } },
        data: {
          tipo: dados.tipo,
          marca: dados.marca,
          modelo: dados.modelo,
          numeroSerie: dados.numeroSerie,
          atualizadoEm: new Date(),
          atualizadoPorId: dados.atualizadoPorId,
        },
      });
    } catch (e) {
      if (codigoPrisma(e) === NAO_ENCONTRADO) return null;
      throw e;
    }
  }

  async excluir(
    clienteId: number,
    codigoInterno: number,
  ): Promise<ResultadoExclusao<Equipamento>> {
    try {
      const eq = await this.prisma.equipamento.delete({
        where: { clienteId_codigoInterno: { clienteId, codigoInterno } },
      });
      return { resultado: 'EXCLUIDO', registro: eq };
    } catch (e) {
      const codigo = codigoPrisma(e);
      if (codigo === NAO_ENCONTRADO) return { resultado: 'NAO_ENCONTRADO' };
      // Hoje não há tabela que referencie o equipamento; quando a OS existir,
      // a FK com RESTRICT fará o banco recusar e cairá neste caso.
      if (codigo !== undefined && EM_USO.includes(codigo)) return { resultado: 'EM_USO' };
      throw e;
    }
  }
}

function paraCliente(c: {
  id: number;
  nome: string;
  telefone: string | null;
  email: string | null;
  criadoEm: Date;
  criadoPorId: number;
  atualizadoEm: Date | null;
  atualizadoPorId: number | null;
}): Cliente {
  return {
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    email: c.email,
    criadoEm: c.criadoEm,
    criadoPorId: c.criadoPorId,
    atualizadoEm: c.atualizadoEm,
    atualizadoPorId: c.atualizadoPorId,
  };
}
