/** RNF: credenciais só em variáveis de ambiente, nunca no repositório. */
export interface Config {
  porta: number;
  jwtSegredo: string;
}

export function carregarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const jwtSegredo = env['JWT_SECRET'];
  if (!jwtSegredo || jwtSegredo.length < 32) {
    throw new Error('JWT_SECRET ausente ou curto demais (mínimo 32 caracteres).');
  }
  if (!env['DATABASE_URL']) {
    throw new Error('DATABASE_URL ausente.');
  }
  return { porta: Number(env['PORT'] ?? 3000), jwtSegredo };
}
