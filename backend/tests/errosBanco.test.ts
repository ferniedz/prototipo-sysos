import { registroNaoExiste, violacaoDeVinculo } from '../src/infra/errosBanco';

/** Imita o erro do Prisma sem código, como chega no PostgreSQL mais novo. */
function erroSemCodigo(mensagem: string): Error {
  const e = new Error(mensagem);
  e.name = 'PrismaClientUnknownRequestError';
  return e;
}

// Mensagem real capturada na suíte de integração do grupo (SQLSTATE 23001).
const MENSAGEM_23001 =
  'Invalid `this.prisma.cliente.delete()` invocation:\n' +
  'Error occurred during query execution:\n' +
  'ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { ' +
  'code: "23001", message: "update or delete on table \\"Cliente\\" violates RESTRICT setting of ' +
  'foreign key constraint \\"Equipamento_clienteId_fkey\\" on table \\"Equipamento\\"", ' +
  'severity: "ERRO", detail: Some("Key (id)=(1) is referenced from table \\"Equipamento\\"."), ' +
  'column: None, hint: None }), transient: false })';

describe('errosBanco', () => {
  describe('violacaoDeVinculo', () => {
    it('reconhece o erro real SQLSTATE 23001 (RESTRICT), que chega sem código Prisma', () => {
      expect(violacaoDeVinculo(erroSemCodigo(MENSAGEM_23001))).toBe(true);
    });

    it('reconhece SQLSTATE 23503 (violação de chave estrangeira)', () => {
      const msg = 'QueryError(PostgresError { code: "23503", message: "x" })';
      expect(violacaoDeVinculo(erroSemCodigo(msg))).toBe(true);
    });

    it('reconhece pelo texto da mensagem do banco', () => {
      const msg = 'update or delete on table "Cliente" violates foreign key constraint "x"';
      expect(violacaoDeVinculo(erroSemCodigo(msg))).toBe(true);
    });

    it('reconhece os códigos do Prisma P2003 e P2014', () => {
      expect(violacaoDeVinculo({ code: 'P2003' })).toBe(true);
      expect(violacaoDeVinculo({ code: 'P2014' })).toBe(true);
    });

    it('não confunde outros erros com vínculo', () => {
      expect(violacaoDeVinculo({ code: 'P2025' })).toBe(false);
      expect(violacaoDeVinculo(erroSemCodigo('connection refused'))).toBe(false);
      expect(violacaoDeVinculo(erroSemCodigo('Authentication failed'))).toBe(false);
      expect(violacaoDeVinculo(null)).toBe(false);
      expect(violacaoDeVinculo(undefined)).toBe(false);
      expect(violacaoDeVinculo('texto')).toBe(false);
    });
  });

  describe('registroNaoExiste', () => {
    it('reconhece apenas P2025', () => {
      expect(registroNaoExiste({ code: 'P2025' })).toBe(true);
      expect(registroNaoExiste({ code: 'P2003' })).toBe(false);
      expect(registroNaoExiste(erroSemCodigo(MENSAGEM_23001))).toBe(false);
      expect(registroNaoExiste(null)).toBe(false);
    });
  });
});