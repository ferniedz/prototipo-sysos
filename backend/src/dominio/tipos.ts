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
  /** Última correção do cadastro (RN22); nulos se nunca foi alterado. */
  atualizadoEm: Date | null;
  atualizadoPorId: number | null;
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
  atualizadoEm: Date | null;
  atualizadoPorId: number | null;
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

/** Substitui os dados editáveis do cliente (o id e o histórico são mantidos). */
export interface AtualizacaoCliente {
  nome: string;
  telefone: string | null;
  email: string | null;
  atualizadoPorId: number;
}

/**
 * Substitui os dados editáveis do equipamento. O dono (clienteId) e o
 * codigoInterno nunca mudam: são a identidade da entidade fraca.
 */
export interface AtualizacaoEquipamento {
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  atualizadoPorId: number;
}

/**
 * Resultado de uma exclusão. EM_USO = o banco recusou porque há registros
 * dependentes (RN20: nada apaga o histórico).
 */
export type ResultadoExclusao<T> =
  | { resultado: 'EXCLUIDO'; registro: T }
  | { resultado: 'NAO_ENCONTRADO' }
  | { resultado: 'EM_USO' };

export interface ClienteRepositorio {
  criar(dados: NovoCliente): Promise<Cliente>;
  buscarPorId(id: number): Promise<Cliente | null>;
  /** Busca por parte do nome ou do contato (telefone/e-mail). */
  buscarPorTexto(termo: string, limite: number): Promise<Cliente[]>;
  /**
   * Clientes com mesmo nome (sem diferenciar maiúsculas) ou mesmo
   * telefone/e-mail. `ignorarId` exclui o próprio cliente numa alteração.
   */
  buscarCandidatosDuplicidade(criterio: {
    nome: string;
    telefone: string | null;
    email: string | null;
    ignorarId?: number;
  }): Promise<Cliente[]>;
  /** Retorna null se o cliente não existir. */
  atualizar(id: number, dados: AtualizacaoCliente): Promise<Cliente | null>;
  /** Só exclui cliente sem equipamentos/OS (restrição no banco). */
  excluir(id: number): Promise<ResultadoExclusao<Cliente>>;
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
  /** Retorna null se o equipamento não existir naquele cliente. */
  atualizar(
    clienteId: number,
    codigoInterno: number,
    dados: AtualizacaoEquipamento,
  ): Promise<Equipamento | null>;
  /** Só exclui equipamento sem OS vinculada (restrição no banco). */
  excluir(
    clienteId: number,
    codigoInterno: number,
  ): Promise<ResultadoExclusao<Equipamento>>;
}
