import {
  ClienteRepositorio,
  Equipamento,
  EquipamentoRepositorio,
  Usuario,
} from '../dominio/tipos';
import { EquipamentoEntrada } from '../dominio/validacao';
import { AppError, erros } from '../shared/erros';
import { registrarFalha } from './clienteServico';

export class EquipamentoServico {
  constructor(
    private readonly clientes: ClienteRepositorio,
    private readonly equipamentos: EquipamentoRepositorio,
  ) {}

  /**
   * RF07 + RN01 + RN09. O equipamento (entidade fraca) só existe vinculado a
   * um cliente cadastrado; o codigoInterno é gerado pelo sistema por cliente.
   */
  async cadastrar(
    clienteId: number,
    entrada: EquipamentoEntrada,
    usuario: Usuario,
  ): Promise<Equipamento> {
    await this.exigirCliente(clienteId);
    try {
      const criado = await this.equipamentos.criarParaCliente(clienteId, {
        tipo: entrada.tipo,
        marca: entrada.marca ?? null,
        modelo: entrada.modelo ?? null,
        numeroSerie: entrada.numeroSerie ?? null, // opcional (RN09)
        criadoPorId: usuario.id, // RN22
      });
      if (!criado) throw erros.clienteNaoEncontrado();
      return criado;
    } catch (e) {
      if (e instanceof AppError) throw e;
      registrarFalha('cadastro de equipamento', e);
      throw erros.falhaGravacao(); // RF12
    }
  }

  /** RF08: lista os equipamentos do cliente para reaproveitar em novas OS. */
  async listar(clienteId: number): Promise<Equipamento[]> {
    await this.exigirCliente(clienteId);
    return this.equipamentos.listarPorCliente(clienteId);
  }

  async obter(clienteId: number, codigoInterno: number): Promise<Equipamento> {
    await this.exigirCliente(clienteId);
    const eq = await this.equipamentos.buscar(clienteId, codigoInterno);
    if (!eq) throw erros.equipamentoNaoEncontrado();
    return eq;
  }

  /**
   * PB18. Substitui os dados editáveis do equipamento. O dono e o código
   * interno são a identidade (entidade fraca) e não podem ser alterados;
   * campos opcionais omitidos passam a vazios.
   */
  async atualizar(
    clienteId: number,
    codigoInterno: number,
    entrada: EquipamentoEntrada,
    usuario: Usuario,
  ): Promise<Equipamento> {
    await this.exigirCliente(clienteId);
    try {
      const atualizado = await this.equipamentos.atualizar(clienteId, codigoInterno, {
        tipo: entrada.tipo,
        marca: entrada.marca ?? null,
        modelo: entrada.modelo ?? null,
        numeroSerie: entrada.numeroSerie ?? null,
        atualizadoPorId: usuario.id, // RN22
      });
      if (!atualizado) throw erros.equipamentoNaoEncontrado();
      return atualizado;
    } catch (e) {
      if (e instanceof AppError) throw e;
      registrarFalha('alteração de equipamento', e);
      throw erros.falhaGravacao(); // RF12
    }
  }

  /**
   * RN20: nada apaga o histórico. O equipamento com OS vinculada não é
   * excluído (a recusa vem do banco). O código interno excluído não é
   * reaproveitado: o contador do cliente só cresce. Devolve o excluído.
   */
  async excluir(clienteId: number, codigoInterno: number): Promise<Equipamento> {
    await this.exigirCliente(clienteId);
    let resultado;
    try {
      resultado = await this.equipamentos.excluir(clienteId, codigoInterno);
    } catch (e) {
      registrarFalha('exclusão de equipamento', e);
      throw erros.falhaGravacao();
    }
    switch (resultado.resultado) {
      case 'EXCLUIDO':
        return resultado.registro;
      case 'EM_USO':
        throw erros.equipamentoComVinculos();
      case 'NAO_ENCONTRADO':
        throw erros.equipamentoNaoEncontrado();
    }
  }

  private async exigirCliente(clienteId: number): Promise<void> {
    if (!(await this.clientes.buscarPorId(clienteId))) {
      throw erros.clienteNaoEncontrado();
    }
  }
}
