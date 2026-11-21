import { Router } from 'express';
import { filtroOrdensSchema, ordemSchema } from '../dominio/validacaoOs';
import { idParam } from '../dominio/validacao';
import { OrdemServicoServico } from '../servicos/ordemServicoServico';
import { aguardar, exigirPerfil } from './middlewares';

/**
 * Matriz de acesso PROPOSTA (a oficial é do PB01): quem abre a OS é o
 * atendente (UC01); atendente e técnico consultam. Não há PUT/DELETE: a OS não
 * é editada nem apagada nesta entrega (RN03, RN20); a mudança de status é o PB09.
 */
const ABRIR = exigirPerfil('ATENDENTE');
const CONSULTAR = exigirPerfil('ATENDENTE', 'TECNICO');

export function criarRotasOs(servico: OrdemServicoServico): Router {
  const rotas = Router();

  rotas.post(
    '/',
    ABRIR,
    aguardar(async (req, res) => {
      const entrada = ordemSchema.parse(req.body);
      const criada = await servico.abrir(entrada, req.usuario!);
      res.status(201).location(`/api/ordens-servico/${criada.numero}`).json(criada);
    }),
  );

  rotas.get(
    '/',
    CONSULTAR,
    aguardar(async (req, res) => {
      const filtro = filtroOrdensSchema.parse(req.query);
      res.json(await servico.listar(filtro));
    }),
  );

  rotas.get(
    '/:numero',
    CONSULTAR,
    aguardar(async (req, res) => {
      const numero = idParam.parse(req.params['numero']);
      res.json(await servico.obter(numero));
    }),
  );

  return rotas;
}