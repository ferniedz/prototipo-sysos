import jwt from 'jsonwebtoken';
import request from 'supertest';
import { criarApp } from '../../src/http/app';
import { Perfil } from '../../src/dominio/tipos';
import { BancoMemoria } from './memoria';

export const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres!!';

export function token(perfil: Perfil = 'ATENDENTE', id = 7, opcoes: jwt.SignOptions = {}) {
  return jwt.sign({ perfil }, SEGREDO, {
    subject: String(id),
    expiresIn: '1h',
    algorithm: 'HS256',
    ...opcoes,
  });
}

export function montar(banco = new BancoMemoria()) {
  const app = criarApp({ clientes: banco, equipamentos: banco, jwtSegredo: SEGREDO });
  const api = request(app);
  const atendente = { Authorization: `Bearer ${token('ATENDENTE', 7)}` };
  const tecnico = { Authorization: `Bearer ${token('TECNICO', 9)}` };
  return { app, api, banco, atendente, tecnico };
}

export const clienteValido = {
  nome: 'Maria da Silva',
  telefone: '(42) 99999-1234',
  email: 'Maria@Exemplo.com',
};
