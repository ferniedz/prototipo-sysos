import { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { Perfil, Usuario } from "../dominio/tipos";
import { AppError, erros } from "../shared/erros";

declare module "express-serve-static-core" {
    interface Request {
        usuario?: Usuario;
    }
}

const PERFIS: readonly Perfil[] = ["ATENDENTE", "TECNICO"];

/**
 * RF02: toda rota da API exige login. Valida o token (assinatura e expiração)
 * e carrega o funcionário. A emissão do token (login/logout) pertence ao PB01
 * e NÃO faz parte deste protótipo.
 */
export function autenticar(segredo: string): RequestHandler {
    return (req, _res, next) => {
        const cabecalho = req.headers.authorization ?? "";
        const [esquema, token] = cabecalho.split(" ");
        if (esquema !== "Bearer" || !token) return next(erros.naoAutenticado());
        try {
            const payload = jwt.verify(token, segredo, { algorithms: ["HS256"] });
            if (typeof payload === "string") return next(erros.naoAutenticado());
            const id = Number(payload.sub);
            const perfil = payload["perfil"] as Perfil;
            if (!Number.isInteger(id) || id <= 0 || !PERFIS.includes(perfil)) {
                return next(erros.naoAutenticado());
            }
            req.usuario = { id, perfil };
            next();
        } catch {
            next(erros.naoAutenticado());
        }
    };
}

/** RF02: checa o perfil em cada rota (inclusive em chamada direta à API). */
export function exigirPerfil(...permitidos: Perfil[]): RequestHandler {
    return (req, _res, next) => {
        if (!req.usuario) return next(erros.naoAutenticado());
        if (!permitidos.includes(req.usuario.perfil)) return next(erros.proibido());
        next();
    };
}

export const aguardar =
    (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next) => {
        fn(req, res).catch(next);
    };

/** Erros sem stack trace, SQL ou nomes de tabela (requisito não funcional). */
export function tratarErros(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof AppError) {
        res.status(err.status).json({
            erro: { codigo: err.codigo, mensagem: err.message, detalhes: err.detalhes },
        });
        return;
    }
    if (err instanceof ZodError) {
        res.status(400).json({
            erro: {
                codigo: "DADOS_INVALIDOS",
                mensagem: "Dados inválidos ou ausentes.",
                detalhes: err.issues.map((i) => ({
                    campo: i.path.join(".") || undefined,
                    mensagem: i.message,
                })),
            },
        });
        return;
    }
    if (err instanceof SyntaxError) {
        res.status(400).json({
            erro: { codigo: "JSON_INVALIDO", mensagem: "Corpo da requisição inválido." },
        });
        return;
    }
    console.error(`[sysos] erro não tratado: ${err instanceof Error ? err.name : "Erro"}`);
    res.status(500).json({
        erro: { codigo: "ERRO_INTERNO", mensagem: "Erro interno. Tente novamente mais tarde." },
    });
}
