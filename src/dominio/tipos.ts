export type Perfil = 'ATENDENTE' | 'TECNICO';

/** Funcionário autenticado (vem do token validado pelo middleware). */
export interface Usuario {
  id: number;
  perfil: Perfil;
}

export interface Cliente {
  id: number;
  nome: string;
  telefone: string | null; // somente dígitos
  email: string | null;
  criadoEm: Date;
  criadoPorId: number;
}

/** Entidade fraca: identificada por (clienteId, codigoInterno). */
export interface Equipamento {
  clienteId: number;
  codigoInterno: number;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  criadoEm: Date;
  criadoPorId: number;
}

export interface NovoCliente {
  nome: string;
  telefone: string | null;
  email: string | null;
  criadoPorId: number;
}

export interface NovoEquipamento {
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  criadoPorId: number;
}

export interface ClienteRepositorio {
  criar(dados: NovoCliente): Promise<Cliente>;
  buscarPorId(id: number): Promise<Cliente | null>;
  /** Busca por parte do nome ou do contato (telefone/e-mail). */
  buscarPorTexto(termo: string, limite: number): Promise<Cliente[]>;
  /** Clientes com mesmo nome (sem diferenciar maiúsculas) ou mesmo telefone/e-mail. */
  buscarCandidatosDuplicidade(criterio: {
    nome: string;
    telefone: string | null;
    email: string | null;
  }): Promise<Cliente[]>;
}

export interface EquipamentoRepositorio {
  /**
   * Gera o codigoInterno do cliente e grava o equipamento de forma ATÔMICA
   * (uma transação). Retorna null se o cliente não existir.
   */
  criarParaCliente(
    clienteId: number,
    dados: NovoEquipamento,
  ): Promise<Equipamento | null>;
  listarPorCliente(clienteId: number): Promise<Equipamento[]>;
  buscar(clienteId: number, codigoInterno: number): Promise<Equipamento | null>;
}
