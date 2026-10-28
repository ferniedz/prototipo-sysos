import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
import { Express } from 'express';

/** Exercita Express em memória, sem abrir portas ou acessar um banco real. */
export function injetar(app: Express, opcoes: {
  metodo?: string; caminho: string; cabecalhos?: Record<string, string>; corpo?: unknown;
}): Promise<{ status: number; headers: ReturnType<ServerResponse['getHeaders']>; body: any }> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    const socket = new Duplex({ read() {}, write(chunk, _encoding, callback) { partes.push(Buffer.from(chunk)); callback(); } });
    const req = new IncomingMessage(socket as never);
    req.method = opcoes.metodo ?? 'GET';
    req.url = opcoes.caminho;
    req.headers = Object.fromEntries(Object.entries(opcoes.cabecalhos ?? {}).map(([nome, valor]) => [nome.toLowerCase(), valor]));
    const body = opcoes.corpo === undefined ? '' : JSON.stringify(opcoes.corpo);
    if (body) {
      req.headers['content-type'] = 'application/json';
      req.headers['content-length'] = String(Buffer.byteLength(body));
    }
    const res = new ServerResponse(req);
    res.assignSocket(socket as never);
    res.on('error', reject);
    res.on('finish', () => {
      try {
        const raw = Buffer.concat(partes).toString();
        const content = raw.slice(raw.indexOf('\r\n\r\n') + 4);
        resolve({ status: res.statusCode, headers: res.getHeaders(), body: content ? JSON.parse(content) : undefined });
      } catch (error) { reject(error); }
      finally { socket.destroy(); }
    });
    app(req, res);
    if (body) req.push(body);
    req.complete = true;
    req.push(null);
    req.resume();
  });
}
