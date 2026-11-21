import { z } from 'zod';

/** "" vira undefined; texto numérico vira número (útil em formulários e query). */
const idObrigatorio = (rotulo: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v),
    z
      .number({
        required_error: `${rotulo} é obrigatório.`,
        invalid_type_error: `${rotulo} inválido.`,
      })
      .int(`${rotulo} inválido.`)
      .positive(`${rotulo} inválido.`)
      .max(2_147_483_647, `${rotulo} inválido.`),
  );

/**
 * RF09 / RN02 / RN01: cliente, equipamento (código interno dentro do cliente) e
 * problema relatado são obrigatórios. O número e o status não são aceitos no
 * corpo: são gerados pelo sistema (RN03, RN04). `.strict()` rejeita campos
 * desconhecidos.
 */
export const ordemSchema = z
  .object({
    clienteId: idObrigatorio('Cliente'),
    equipamentoCodigoInterno: idObrigatorio('Equipamento'),
    problemaRelatado: z
      .string({
        required_error: 'Problema relatado é obrigatório.',
        invalid_type_error: 'Problema relatado inválido.',
      })
      .trim()
      .min(1, 'Problema relatado é obrigatório.')
      .max(1000, 'Problema relatado deve ter no máximo 1000 caracteres.'),
    // RF11/RN06: o atendente confirma que quer abrir mesmo havendo OS em aberto
    confirmarOsEmAberto: z.boolean().optional(),
  })
  .strict();

const vazioVira = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

/** RF14: filtros opcionais por cliente e status. */
export const filtroOrdensSchema = z.object({
  clienteId: z.preprocess(
    vazioVira,
    z.coerce
      .number({ invalid_type_error: 'Cliente inválido.' })
      .int('Cliente inválido.')
      .positive('Cliente inválido.')
      .max(2_147_483_647, 'Cliente inválido.')
      .optional(),
  ),
  status: z.preprocess(vazioVira, z.string().trim().max(40, 'Status inválido.').optional()),
});

export type OrdemEntrada = z.infer<typeof ordemSchema>;
export type FiltroOrdensEntrada = z.infer<typeof filtroOrdensSchema>;