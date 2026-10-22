/**
 * Erro de negócio/validação com mensagem segura para o cliente da API.
 * O tratador de erros (middlewares/errorHandler.ts) só devolve `codigo`,
 * `mensagem` e `detalhes` — nunca stack trace, SQL ou nomes de tabela.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensagem: string,
    public readonly detalhes?: unknown,
  ) {
    super(mensagem);
    this.name = 'AppError';
  }
}

export const erros = {
  naoAutenticado: () =>
    new AppError(401, 'NAO_AUTENTICADO', 'Autenticação necessária.'),
  proibido: () =>
    new AppError(403, 'ACESSO_NEGADO', 'Seu perfil não permite esta operação.'),
  validacao: (detalhes: unknown) =>
    new AppError(400, 'DADOS_INVALIDOS', 'Dados inválidos ou ausentes.', detalhes),
  clienteNaoEncontrado: () =>
    new AppError(
      404,
      'CLIENTE_NAO_ENCONTRADO',
      'Cliente não encontrado. Deseja cadastrá-lo?',
      { ofertaCadastro: true },
    ),
  equipamentoNaoEncontrado: () =>
    new AppError(404, 'EQUIPAMENTO_NAO_ENCONTRADO', 'Equipamento não encontrado.'),
  possivelDuplicidade: (candidatos: unknown) =>
    new AppError(
      409,
      'POSSIVEL_CLIENTE_DUPLICADO',
      'Já existe cliente com nome ou contato semelhante. Confira os candidatos ' +
        'e, se for realmente outra pessoa, repita o cadastro com confirmarDuplicidade=true.',
      { candidatos },
    ),
  falhaGravacao: () =>
    new AppError(
      500,
      'FALHA_AO_GRAVAR',
      'Não foi possível concluir o registro. Nada foi gravado; tente novamente mais tarde.',
    ),
};
