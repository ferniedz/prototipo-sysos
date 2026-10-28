import express, { Express, Router } from 'express';
import { ClienteRepositorio, EquipamentoRepositorio } from '../dominio/tipos';
import {
  buscaSchema,
  clienteSchema,
  equipamentoSchema,
  idParam,
} from '../dominio/validacao';
import { ClienteServico } from '../servicos/clienteServico';
import { EquipamentoServico } from '../servicos/equipamentoServico';
import { AppError } from '../shared/erros';
import { aguardar, autenticar, exigirPerfil, tratarErros } from './middlewares';
import { cors, ORIGENS_PADRAO } from './cors';

export interface Dependencias {
  clientes: ClienteRepositorio;
  equipamentos: EquipamentoRepositorio;
  jwtSegredo: string;
  origensCors?: readonly string[];
}

/**
 * Matriz de acesso PROPOSTA (a matriz oficial ainda será acordada — PB01):
 * escrita só para o atendente (quem cadastra cliente/equipamento nos
 * documentos); leitura para atendente e técnico.
 */
const ESCRITA = exigirPerfil('ATENDENTE');
const LEITURA = exigirPerfil('ATENDENTE', 'TECNICO');

export function criarApp(dep: Dependencias): Express {
  const clienteServico = new ClienteServico(dep.clientes);
  const equipamentoServico = new EquipamentoServico(dep.clientes, dep.equipamentos);

  const app = express();
  app.disable('x-powered-by');
  app.use(cors(dep.origensCors ?? ORIGENS_PADRAO));
  app.use(express.json({ limit: '10kb' }));

  // Verificação de saúde para a hospedagem; não expõe nenhum dado.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const api = Router();
  api.use(autenticar(dep.jwtSegredo)); // RF02: tudo sob /api exige login

  // --- Clientes (RF04, RF05, RF06) -----------------------------------------
  api.post(
    '/clientes',
    ESCRITA,
    aguardar(async (req, res) => {
      const entrada = clienteSchema.parse(req.body);
      const criado = await clienteServico.cadastrar(entrada, req.usuario!);
      res.status(201).location(`/api/clientes/${criado.id}`).json(criado);
    }),
  );

  api.get(
    '/clientes',
    LEITURA,
    aguardar(async (req, res) => {
      const { busca } = buscaSchema.parse(req.query);
      res.json(await clienteServico.buscar(busca));
    }),
  );

  api.get(
    '/clientes/:clienteId',
    LEITURA,
    aguardar(async (req, res) => {
      const id = idParam.parse(req.params['clienteId']);
      res.json(await clienteServico.obter(id));
    }),
  );

  // PB18: PUT substitui os dados editáveis (mesmo corpo do POST). O id nunca
  // muda. Possível duplicidade segue a mesma regra do cadastro (RN08).
  api.put(
    '/clientes/:clienteId',
    ESCRITA,
    aguardar(async (req, res) => {
      const id = idParam.parse(req.params['clienteId']);
      const entrada = clienteSchema.parse(req.body);
      res.json(await clienteServico.atualizar(id, entrada, req.usuario!));
    }),
  );

  // RN20: só exclui cliente sem equipamentos/OS (409 CLIENTE_COM_VINCULOS).
  // Responde 200 com o cadastro excluído (o corpo JSON facilita o cliente HTTP).
  api.delete(
    '/clientes/:clienteId',
    ESCRITA,
    aguardar(async (req, res) => {
      const id = idParam.parse(req.params['clienteId']);
      res.json(await clienteServico.excluir(id));
    }),
  );

  // --- Equipamentos: entidade fraca, sempre aninhada no cliente (RF07, RF08)
  api.post(
    '/clientes/:clienteId/equipamentos',
    ESCRITA,
    aguardar(async (req, res) => {
      const clienteId = idParam.parse(req.params['clienteId']);
      const entrada = equipamentoSchema.parse(req.body);
      const criado = await equipamentoServico.cadastrar(clienteId, entrada, req.usuario!);
      res
        .status(201)
        .location(`/api/clientes/${clienteId}/equipamentos/${criado.codigoInterno}`)
        .json(criado);
    }),
  );

  api.get(
    '/clientes/:clienteId/equipamentos',
    LEITURA,
    aguardar(async (req, res) => {
      const clienteId = idParam.parse(req.params['clienteId']);
      const lista = await equipamentoServico.listar(clienteId);
      res.json({ total: lista.length, equipamentos: lista });
    }),
  );

  api.get(
    '/clientes/:clienteId/equipamentos/:codigoInterno',
    LEITURA,
    aguardar(async (req, res) => {
      const clienteId = idParam.parse(req.params['clienteId']);
      const codigo = idParam.parse(req.params['codigoInterno']);
      res.json(await equipamentoServico.obter(clienteId, codigo));
    }),
  );

  api.put(
    '/clientes/:clienteId/equipamentos/:codigoInterno',
    ESCRITA,
    aguardar(async (req, res) => {
      const clienteId = idParam.parse(req.params['clienteId']);
      const codigo = idParam.parse(req.params['codigoInterno']);
      const entrada = equipamentoSchema.parse(req.body);
      res.json(await equipamentoServico.atualizar(clienteId, codigo, entrada, req.usuario!));
    }),
  );

  api.delete(
    '/clientes/:clienteId/equipamentos/:codigoInterno',
    ESCRITA,
    aguardar(async (req, res) => {
      const clienteId = idParam.parse(req.params['clienteId']);
      const codigo = idParam.parse(req.params['codigoInterno']);
      res.json(await equipamentoServico.excluir(clienteId, codigo));
    }),
  );

  // Rota desconhecida (ex.: PATCH, que não é usado): 404 padronizado.
  api.use((_req, _res, next) => {
    next(new AppError(404, 'ROTA_NAO_ENCONTRADA', 'Recurso não encontrado.'));
  });

  app.use('/api', api);
  app.use(tratarErros);
  return app;
}
