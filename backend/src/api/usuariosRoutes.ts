import { Router } from 'express';
import { UsuariosController } from './usuariosController';
import { UsuarioPrismaRepositorio } from '../infra/prismaRepositorios';
import { PrismaClient } from '@prisma/client';

export function constroiRotasUsuarios(prisma: PrismaClient): Router {
  const router = Router();
  const repo = new UsuarioPrismaRepositorio(prisma);
  const controller = new UsuariosController(repo);

  router.post('/', controller.criar);
  router.get('/', controller.listar);
  router.get('/:id', controller.buscar);
  router.put('/:id', controller.atualizar);
  router.delete('/:id', controller.excluir);

  return router;
}