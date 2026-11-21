/**
 * Classificação dos erros do banco/Prisma. Isolada para poder ser testada sem
 * PostgreSQL e porque o formato do erro muda entre versões do PostgreSQL e do
 * Prisma: a recusa por RESTRICT chega como P2003 (SQLSTATE 23503, comum no
 * PostgreSQL 16) ou como erro SEM código do Prisma com SQLSTATE 23001, quando
 * a mensagem do banco é "violates RESTRICT setting" (visto em versões mais novas).
 */

/** P2025: o registro a atualizar/excluir não existe. */
export function registroNaoExiste(e: unknown): boolean {
  return codigoPrisma(e) === 'P2025';
}

/**
 * O banco recusou a operação por haver registros dependentes (RN20).
 * Reconhece o código do Prisma, o SQLSTATE e o texto da mensagem do banco.
 */
export function violacaoDeVinculo(e: unknown): boolean {
  const codigo = codigoPrisma(e);
  if (codigo === 'P2003' || codigo === 'P2014') return true;
  const mensagem = e instanceof Error ? e.message : '';
  return (
    /code: "(23001|23503)"/.test(mensagem) ||
    /violates (RESTRICT setting of )?foreign key constraint/i.test(mensagem)
  );
}

function codigoPrisma(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null) return undefined;
  const codigo = (e as { code?: unknown }).code;
  return typeof codigo === 'string' ? codigo : undefined;
}