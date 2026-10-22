/**
 * APENAS DESENVOLVIMENTO. O login real (PB01) não faz parte deste protótipo;
 * este script gera um token para testar as rotas manualmente.
 *   npm run token:dev -- ATENDENTE 1
 */
import jwt from 'jsonwebtoken';

const [perfil = 'ATENDENTE', id = '1'] = process.argv.slice(2);
const segredo = process.env['JWT_SECRET'];
if (process.env['NODE_ENV'] === 'production') throw new Error('Não use em produção.');
if (!segredo || segredo.length < 32) throw new Error('Defina JWT_SECRET (mín. 32 caracteres).');
if (perfil !== 'ATENDENTE' && perfil !== 'TECNICO') throw new Error('Perfil: ATENDENTE ou TECNICO.');

console.log(jwt.sign({ perfil }, segredo, { subject: id, expiresIn: '2h', algorithm: 'HS256' }));
