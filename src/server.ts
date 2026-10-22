import { PrismaClient } from '@prisma/client';
import { carregarConfig } from './config';
import { criarApp } from './http/app';
import {
  ClientePrismaRepositorio,
  EquipamentoPrismaRepositorio,
} from './infra/prismaRepositorios';

const config = carregarConfig();
const prisma = new PrismaClient();

const app = criarApp({
  clientes: new ClientePrismaRepositorio(prisma),
  equipamentos: new EquipamentoPrismaRepositorio(prisma),
  jwtSegredo: config.jwtSegredo,
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
