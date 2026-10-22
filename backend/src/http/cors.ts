import { RequestHandler } from 'express';
import { AppError } from '../shared/erros';

export const ORIGENS_PADRAO = [
  'http://localhost:5173', 'http://127.0.0.1:5173',
  'http://localhost:4173', 'http://127.0.0.1:4173',
];

export function configurarOrigens(valor?: string): string[] {
  if (valor === undefined) return [...ORIGENS_PADRAO];
  const origens = valor.split(',').map(origem => origem.trim()).filter(Boolean);
  for (const origem of origens) {
    const url = new URL(origem);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origem) {
      throw new Error('CORS_ORIGINS deve conter origens HTTP/HTTPS sem caminho nem barra final.');
    }
  }
  return origens;
}

/** Preflight antes do JWT; o acesso às rotas continua autenticado. */
export function cors(origens: readonly string[]): RequestHandler {
  return (req, res, next) => {
    res.vary('Origin');
    const origem = req.get('Origin');
    if (!origem) return next();
    if (!origens.includes(origem)) {
      return next(new AppError(403, 'ORIGEM_NAO_PERMITIDA', 'Origem não permitida.'));
    }
    res.setHeader('Access-Control-Allow-Origin', origem);
    res.setHeader('Access-Control-Expose-Headers', 'Location');
    if (req.method === 'OPTIONS') {
      const metodo = req.get('Access-Control-Request-Method');
      const cabecalhos = (req.get('Access-Control-Request-Headers') ?? '')
        .toLowerCase().split(',').map(valor => valor.trim()).filter(Boolean);
      if (!metodo || !['GET', 'POST'].includes(metodo) ||
        cabecalhos.some(nome => !['authorization', 'content-type'].includes(nome))) {
        return next(new AppError(403, 'PREFLIGHT_NAO_PERMITIDO', 'Requisição não permitida.'));
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
      res.status(204).end();
      return;
    }
    next();
  };
}
