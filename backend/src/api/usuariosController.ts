import { Request, Response } from 'express';
import { UsuarioPrismaRepositorio } from '../infra/prismaRepositorios';

export class UsuariosController {
  constructor(private readonly repo: UsuarioPrismaRepositorio) {}

  criar = async (req: Request, res: Response) => {
    try {
      const { nome, email, senha, perfil } = req.body;
      if (!nome || !email || !senha || !perfil) {
        return res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
      }
      const usuario = await this.repo.criar({ nome, email, senha, perfil });
      res.status(201).json(usuario);
    } catch (e: any) {
      if (e.code === 'P2002') return res.status(409).json({ erro: 'Email já cadastrado.' });
      res.status(500).json({ erro: 'Erro interno' });
    }
  };

  listar = async (req: Request, res: Response) => {
    const usuarios = await this.repo.listarTodos();
    res.json(usuarios);
  };

  buscar = async (req: Request, res: Response) => {
    const usuario = await this.repo.buscarPorId(Number(req.params.id));
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    res.json(usuario);
  };

  atualizar = async (req: Request, res: Response) => {
    const usuario = await this.repo.atualizar(Number(req.params.id), req.body);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    res.json(usuario);
  };

  excluir = async (req: Request, res: Response) => {
    try {
      const sucesso = await this.repo.excluir(Number(req.params.id));
      if (!sucesso) return res.status(404).json({ erro: 'Usuário não encontrado.' });
      res.json({ mensagem: 'Usuário excluído com sucesso.' });
    } catch (e: any) {
      if (e.message === 'EM_USO') return res.status(409).json({ erro: 'Usuário possui vínculos.' });
      res.status(500).json({ erro: 'Erro interno' });
    }
  };
}