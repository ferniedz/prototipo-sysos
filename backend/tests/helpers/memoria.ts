import {
  Cliente,
  ClienteRepositorio,
  Equipamento,
  EquipamentoRepositorio,
  NovoCliente,
  NovoEquipamento,
} from '../../src/dominio/tipos';

/** Repositórios em memória com a mesma semântica dos repositórios Prisma. */
export class BancoMemoria implements ClienteRepositorio, EquipamentoRepositorio {
  clientes: Cliente[] = [];
  equipamentos: Equipamento[] = [];
  private proxId = 1;
  private contador = new Map<number, number>();

  async criar(d: NovoCliente): Promise<Cliente> {
    // espelha o CHECK do banco (RN07)
    if (d.telefone === null && d.email === null) throw new Error('check violado');
    const c: Cliente = { id: this.proxId++, ...d, criadoEm: new Date() };
    this.clientes.push(c);
    this.contador.set(c.id, 1);
    return c;
  }

  async buscarPorId(id: number) {
    return this.clientes.find((c) => c.id === id) ?? null;
  }

  async buscarPorTexto(termo: string, limite: number) {
    const t = termo.toLowerCase();
    const dig = termo.replace(/\D/g, '');
    return this.clientes
      .filter(
        (c) =>
          c.nome.toLowerCase().includes(t) ||
          (c.email ?? '').includes(t) ||
          (dig.length >= 4 && (c.telefone ?? '').includes(dig)),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome) || a.id - b.id)
      .slice(0, limite);
  }

  async buscarCandidatosDuplicidade(k: {
    nome: string;
    telefone: string | null;
    email: string | null;
  }) {
    return this.clientes.filter(
      (c) =>
        c.nome.toLowerCase() === k.nome.toLowerCase() ||
        (k.telefone !== null && c.telefone === k.telefone) ||
        (k.email !== null && c.email === k.email),
    );
  }

  async criarParaCliente(clienteId: number, d: NovoEquipamento) {
    const atual = this.contador.get(clienteId);
    if (atual === undefined) return null;
    this.contador.set(clienteId, atual + 1);
    const eq: Equipamento = {
      clienteId,
      codigoInterno: atual,
      ...d,
      criadoEm: new Date(),
    };
    this.equipamentos.push(eq);
    return eq;
  }

  async listarPorCliente(clienteId: number) {
    return this.equipamentos
      .filter((e) => e.clienteId === clienteId)
      .sort((a, b) => a.codigoInterno - b.codigoInterno);
  }

  async buscar(clienteId: number, codigoInterno: number) {
    return (
      this.equipamentos.find(
        (e) => e.clienteId === clienteId && e.codigoInterno === codigoInterno,
      ) ?? null
    );
  }
}
