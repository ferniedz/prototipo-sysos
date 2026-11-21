import {
  Cliente,
  ClienteRepositorio,
  Equipamento,
  EquipamentoRepositorio,
  Usuario,
} from '../dominio/tipos';
import { OrdemServico, OrdemServicoRepositorio } from '../dominio/ordemServico';
import { FiltroOrdensEntrada, OrdemEntrada } from '../dominio/validacaoOs';
import { AppError, erros } from '../shared/erros';
import { errosOs } from '../shared/errosOs';
import { registrarFalha } from './clienteServico';

const LIMITE_LISTA = 100;

export interface OrdemDetalhada {
  numero: number;
  status: string;
  problemaRelatado: string;
  criadoEm: Date;
  criadoPorId: number;
  cliente: Pick<Cliente, 'id' | 'nome' | 'telefone' | 'email'>;
  equipamento: Pick<
    Equipamento,
    'codigoInterno' | 'tipo' | 'marca' | 'modelo' | 'numeroSerie'
  >;
}

export class OrdemServicoServico {
  constructor(
    private readonly clientes: ClienteRepositorio,
    private readonly equipamentos: EquipamentoRepositorio,
    private readonly ordens: OrdemServicoRepositorio,
  ) {}

  /**
   * PB04 / RF09. Ordem das checagens: cliente (RN05) → equipamento do mesmo
   * cliente (RN01) → OS em aberto (RF11/RN06) → gravação atômica (RF12).
   * Número e status inicial são gerados pelo sistema (RN03, RN04).
   */
  async abrir(entrada: OrdemEntrada, usuario: Usuario): Promise<OrdemDetalhada> {
    const cliente = await this.clientes.buscarPorId(entrada.clienteId);
    if (!cliente) throw erros.clienteNaoEncontrado(); // RN05: oferece o cadastro

    const equipamento = await this.equipamentos.buscar(
      entrada.clienteId,
      entrada.equipamentoCodigoInterno,
    );
    if (!equipamento) throw erros.equipamentoNaoEncontrado(); // RN01

    if (!entrada.confirmarOsEmAberto) {
      const abertas = await this.ordens.buscarEmAbertoDoEquipamento(
        entrada.clienteId,
        entrada.equipamentoCodigoInterno,
      );
      if (abertas.length > 0) {
        throw errosOs.equipamentoComOsEmAberto(
          abertas.map((o) => ({
            numero: o.numero,
            status: o.status,
            problemaRelatado: o.problemaRelatado,
            criadoEm: o.criadoEm,
          })),
        );
      }
    }

    try {
      const criada = await this.ordens.abrir({
        clienteId: entrada.clienteId,
        equipamentoCodigoInterno: entrada.equipamentoCodigoInterno,
        problemaRelatado: entrada.problemaRelatado,
        criadoPorId: usuario.id, // RN22
      });
      return montar(criada, cliente, equipamento);
    } catch (e) {
      if (e instanceof AppError) throw e;
      registrarFalha('abertura de OS', e);
      throw erros.falhaGravacao(); // RF12: sem sucesso falso e sem OS parcial
    }
  }

  /** RF13 + RF15. Só leitura: consultar não altera nada. */
  async obter(numero: number): Promise<OrdemDetalhada> {
    const ordem = await this.ordens.buscarPorNumero(numero);
    if (!ordem) throw errosOs.ordemNaoEncontrada();
    const [detalhada] = await this.detalhar([ordem]);
    return detalhada!;
  }

  /** RF14: filtra por cliente e status. */
  async listar(filtro: FiltroOrdensEntrada) {
    const ordens = await this.ordens.listar({
      ...(filtro.clienteId !== undefined ? { clienteId: filtro.clienteId } : {}),
      ...(filtro.status !== undefined ? { status: filtro.status } : {}),
      limite: LIMITE_LISTA,
    });
    const lista = await this.detalhar(ordens);
    return { total: lista.length, ordens: lista };
  }

  private async detalhar(ordens: OrdemServico[]): Promise<OrdemDetalhada[]> {
    const clientes = new Map<number, Cliente>();
    const equipamentos = new Map<string, Equipamento>();
    const resultado: OrdemDetalhada[] = [];
    for (const o of ordens) {
      let cliente = clientes.get(o.clienteId);
      if (!cliente) {
        const achado = await this.clientes.buscarPorId(o.clienteId);
        if (!achado) throw new Error('OS sem cliente: integridade violada');
        cliente = achado;
        clientes.set(o.clienteId, achado);
      }
      const chave = `${o.clienteId}/${o.equipamentoCodigoInterno}`;
      let equipamento = equipamentos.get(chave);
      if (!equipamento) {
        const achado = await this.equipamentos.buscar(o.clienteId, o.equipamentoCodigoInterno);
        if (!achado) throw new Error('OS sem equipamento: integridade violada');
        equipamento = achado;
        equipamentos.set(chave, achado);
      }
      resultado.push(montar(o, cliente, equipamento));
    }
    return resultado;
  }
}

function montar(o: OrdemServico, c: Cliente, e: Equipamento): OrdemDetalhada {
  return {
    numero: o.numero,
    status: o.status,
    problemaRelatado: o.problemaRelatado,
    criadoEm: o.criadoEm,
    criadoPorId: o.criadoPorId,
    cliente: { id: c.id, nome: c.nome, telefone: c.telefone, email: c.email },
    equipamento: {
      codigoInterno: e.codigoInterno,
      tipo: e.tipo,
      marca: e.marca,
      modelo: e.modelo,
      numeroSerie: e.numeroSerie,
    },
  };
}