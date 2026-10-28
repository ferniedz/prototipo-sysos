import { z } from 'zod';

/** "" e espaços viram undefined (campo opcional não preenchido). */
const textoOpcional = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(max).optional(),
  );

const nomeCliente = z
  .string({ required_error: 'Nome é obrigatório.' })
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(2, 'Nome deve ter ao menos 2 caracteres.')
      .max(150, 'Nome deve ter no máximo 150 caracteres.'),
  );

/** Telefone BR: aceita máscara e +55; guarda só dígitos (DDD + 8 ou 9 dígitos). */
export function normalizarTelefone(bruto: string): string | null {
  let d = bruto.replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  return /^[1-9][1-9]\d{8,9}$/.test(d) ? d : null;
}

const telefone = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .string()
    .transform((s, ctx) => {
      const n = normalizarTelefone(s);
      if (!n) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Telefone inválido. Informe DDD + número.',
        });
        return z.NEVER;
      }
      return n;
    })
    .optional(),
);

const email = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .string()
    .trim()
    .max(254)
    .email('E-mail inválido.')
    .transform((s) => s.toLowerCase())
    .optional(),
);

/**
 * RF04 / RN07: nome + ao menos um contato válido. CPF e endereço NÃO são
 * coletados (mínimo de dados — LGPD). `.strict()` rejeita campos desconhecidos
 * (ex.: tentar enviar o id).
 */
export const clienteSchema = z
  .object({
    nome: nomeCliente,
    telefone,
    email,
    confirmarDuplicidade: z.boolean().optional(),
  })
  .strict()
  .refine((c) => c.telefone !== undefined || c.email !== undefined, {
    message: 'Informe ao menos um contato (telefone ou e-mail).',
    path: ['contato'],
  });

/**
 * RF07 / RN09: tipo obrigatório; marca, modelo e série opcionais.
 * O codigoInterno é gerado pelo sistema e não é aceito no corpo.
 */
export const equipamentoSchema = z
  .object({
    tipo: z
      .string({ required_error: 'Tipo é obrigatório.' })
      .trim()
      .min(1, 'Tipo é obrigatório.')
      .max(60),
    marca: textoOpcional(60),
    modelo: textoOpcional(80),
    numeroSerie: textoOpcional(80),
  })
  .strict();

export const idParam = z.coerce
  .number({ invalid_type_error: 'Identificador inválido.' })
  .int('Identificador inválido.')
  .positive('Identificador inválido.')
  .max(2_147_483_647, 'Identificador inválido.');

export const buscaSchema = z.object({
  busca: z
    .string({ required_error: 'Informe nome ou contato para buscar.' })
    .trim()
    .min(2, 'Informe ao menos 2 caracteres para buscar.')
    .max(150),
});

export type ClienteEntrada = z.infer<typeof clienteSchema>;
export type EquipamentoEntrada = z.infer<typeof equipamentoSchema>;
