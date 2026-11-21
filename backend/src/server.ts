import { PrismaClient } from '@prisma/client';
import { carregarConfig } from './config';
import { criarApp } from './http/app';
import {
  ClientePrismaRepositorio,
  EquipamentoPrismaRepositorio,
} from './infra/prismaRepositorios';
import { OrdemServicoPrismaRepositorio } from './infra/prismaOrdemServico';

const config = carregarConfig();
const prisma = new PrismaClient();

const app = criarApp({
  clientes: new ClientePrismaRepositorio(prisma),
  equipamentos: new EquipamentoPrismaRepositorio(prisma),
  ordens: new OrdemServicoPrismaRepositorio(prisma),
  jwtSegredo: config.jwtSegredo,
  origensCors: config.origensCors,
});

const servidor = app.listen(config.porta, () => {
  console.log(`SysOS backend ouvindo na porta ${config.porta}`);
});

const encerrar = async () => {
  servidor.close();
  await prisma.$disconnect();
};
process.on('SIGTERM', () => void encerrar());
process.on('SIGINT', () => void encerrar());