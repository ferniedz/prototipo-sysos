import {
  AtualizacaoCliente,
  AtualizacaoEquipamento,
  Cliente,
  ClienteRepositorio,
  Equipamento,
  EquipamentoRepositorio,
  NovoCliente,
  NovoEquipamento,
  ResultadoExclusao,
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
    const c: Cliente = {
      id: this.proxId++,
      ...d,
      criadoEm: new Date(),
      atualizadoEm: null,
      atualizadoPorId: null,
    };
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
    ignorarId?: number;
  }) {
    return this.clientes.filter(
      (c) =>
        c.id !== k.ignorarId &&
        (c.nome.toLowerCase() === k.nome.toLowerCase() ||
          (k.telefone !== null && c.telefone === k.telefone) ||
          (k.email !== null && c.email === k.email)),
    );
  }

  async atualizar(id: number, d: AtualizacaoCliente): Promise<Cliente | null>;
  async atualizar(
    clienteId: number,
    codigoInterno: number,
    d: AtualizacaoEquipamento,
  ): Promise<Equipamento | null>;
  async atualizar(
    a: number,
    b: number | AtualizacaoCliente,
    c?: AtualizacaoEquipamento,
  ): Promise<Cliente | Equipamento | null> {
    if (typeof b === 'number') return this.atualizarEquipamento(a, b, c!);
    return this.atualizarCliente(a, b);
  }

  private atualizarCliente(id: number, d: AtualizacaoCliente): Cliente | null {
    // espelha o CHECK do banco (RN07)
    if (d.telefone === null && d.email === null) throw new Error('check violado');
    const atual = this.clientes.find((c) => c.id === id);
    if (!atual) return null;
    atual.nome = d.nome;
    atual.telefone = d.telefone;
    atual.email = d.email;
    atual.atualizadoEm = new Date();
    atual.atualizadoPorId = d.atualizadoPorId;
    return atual;
  }

  private atualizarEquipamento(
    clienteId: number,
    codigoInterno: number,
    d: AtualizacaoEquipamento,
  ): Equipamento | null {
    const atual = this.equipamentos.find(
      (e) => e.clienteId === clienteId && e.codigoInterno === codigoInterno,
    );
    if (!atual) return null;
    atual.tipo = d.tipo;
    atual.marca = d.marca;
    atual.modelo = d.modelo;
    atual.numeroSerie = d.numeroSerie;
    atual.atualizadoEm = new Date();
    atual.atualizadoPorId = d.atualizadoPorId;
    return atual;
  }

  async excluir(id: number): Promise<ResultadoExclusao<Cliente>>;
  async excluir(
    clienteId: number,
    codigoInterno: number,
  ): Promise<ResultadoExclusao<Equipamento>>;
  async excluir(
    a: number,
    b?: number,
  ): Promise<ResultadoExclusao<Cliente> | ResultadoExclusao<Equipamento>> {
    if (b !== undefined) return this.excluirEquipamento(a, b);
    return this.excluirCliente(a);
  }

  private excluirCliente(id: number): ResultadoExclusao<Cliente> {
    const i = this.clientes.findIndex((c) => c.id === id);
    if (i < 0) return { resultado: 'NAO_ENCONTRADO' };
    // espelha a FK com RESTRICT (RN20)
    if (this.equipamentos.some((e) => e.clienteId === id)) return { resultado: 'EM_USO' };
    const [removido] = this.clientes.splice(i, 1);
    this.contador.delete(id);
    return { resultado: 'EXCLUIDO', registro: removido! };
  }

  private excluirEquipamento(
    clienteId: number,
    codigoInterno: number,
  ): ResultadoExclusao<Equipamento> {
    const i = this.equipamentos.findIndex(
      (e) => e.clienteId === clienteId && e.codigoInterno === codigoInterno,
    );
    if (i < 0) return { resultado: 'NAO_ENCONTRADO' };
    // o contador do cliente não volta: o código excluído não é reaproveitado
    const [removido] = this.equipamentos.splice(i, 1);
    return { resultado: 'EXCLUIDO', registro: removido! };
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
      atualizadoEm: null,
      atualizadoPorId: null,
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
