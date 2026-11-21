/** Status inicial de toda OS (RN04). Texto exato do backlog (PB04). */
export const STATUS_INICIAL = 'Aguardando Diagnóstico';

/**
 * PROPOSTA (o PB04 deixa "definir quais estados caracterizam OS em aberto"):
 * OS concluída ou cancelada fica só para consulta (RN19), portanto não está em
 * aberto; qualquer outro status está. Hoje só existe o status inicial; os
 * demais entram com o PB09 (atualizar status).
 */
export const STATUS_ENCERRADOS = ['Concluída', 'Cancelada'] as const;

export interface OrdemServico {
  numero: number; // RN03: único, gerado pelo sistema, nunca muda
  clienteId: number;
  equipamentoCodigoInterno: number;
  problemaRelatado: string;
  status: string;
  criadoEm: Date;
  criadoPorId: number; // RN22
}

export interface NovaOrdemServico {
  clienteId: number;
  equipamentoCodigoInterno: number;
  problemaRelatado: string;
  criadoPorId: number;
}

export interface FiltroOrdens {
  clienteId?: number;
  status?: string;
  limite: number;
}

export interface OrdemServicoRepositorio {
  /** Grava a OS com número novo e status inicial, de forma atômica (RF12). */
  abrir(dados: NovaOrdemServico): Promise<OrdemServico>;
  buscarPorNumero(numero: number): Promise<OrdemServico | null>;
  /** Mais recentes primeiro. */
  listar(filtro: FiltroOrdens): Promise<OrdemServico[]>;
  /** OS ainda não encerradas do equipamento (RF11/RN06). */
  buscarEmAbertoDoEquipamento(
    clienteId: number,
    equipamentoCodigoInterno: number,
  ): Promise<OrdemServico[]>;
}