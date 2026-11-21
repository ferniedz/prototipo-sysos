import { PrismaClient } from '@prisma/client';
import {
  FiltroOrdens,
  NovaOrdemServico,
  OrdemServico,
  OrdemServicoRepositorio,
  STATUS_ENCERRADOS,
  STATUS_INICIAL,
} from '../dominio/ordemServico';

/** Camada Prisma da OS. A gravação é um único INSERT: atômico (RF12). */
export class OrdemServicoPrismaRepositorio implements OrdemServicoRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async abrir(dados: NovaOrdemServico): Promise<OrdemServico> {
    const o = await this.prisma.ordemServico.create({
      data: {
        clienteId: dados.clienteId,
        equipamentoCodigoInterno: dados.equipamentoCodigoInterno,
        problemaRelatado: dados.problemaRelatado,
        status: STATUS_INICIAL, // RN04
        criadoPorId: dados.criadoPorId, // RN22
      },
    });
    return paraOrdem(o);
  }

  async buscarPorNumero(numero: number): Promise<OrdemServico | null> {
    const o = await this.prisma.ordemServico.findUnique({ where: { numero } });
    return o ? paraOrdem(o) : null;
  }

  async listar(filtro: FiltroOrdens): Promise<OrdemServico[]> {
    const lista = await this.prisma.ordemServico.findMany({
      where: {
        ...(filtro.clienteId !== undefined ? { clienteId: filtro.clienteId } : {}),
        ...(filtro.status !== undefined ? { status: filtro.status } : {}),
      },
      orderBy: { numero: 'desc' },
      take: filtro.limite,
    });
    return lista.map(paraOrdem);
  }

  async buscarEmAbertoDoEquipamento(
    clienteId: number,
    equipamentoCodigoInterno: number,
  ): Promise<OrdemServico[]> {
    const lista = await this.prisma.ordemServico.findMany({
      where: {
        clienteId,
        equipamentoCodigoInterno,
        status: { notIn: [...STATUS_ENCERRADOS] },
      },
      orderBy: { numero: 'asc' },
    });
    return lista.map(paraOrdem);
  }
}

function paraOrdem(o: {
  numero: number;
  clienteId: number;
  equipamentoCodigoInterno: number;
  problemaRelatado: string;
  status: string;
  criadoEm: Date;
  criadoPorId: number;
}): OrdemServico {
  return {
    numero: o.numero,
    clienteId: o.clienteId,
    equipamentoCodigoInterno: o.equipamentoCodigoInterno,
    problemaRelatado: o.problemaRelatado,
    status: o.status,
    criadoEm: o.criadoEm,
    criadoPorId: o.criadoPorId,
  };
}