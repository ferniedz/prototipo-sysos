import { ClienteRepositorio, Cliente, Usuario } from '../dominio/tipos';
import { ClienteEntrada, normalizarTelefone } from '../dominio/validacao';
import { AppError, erros } from '../shared/erros';

const LIMITE_BUSCA = 20;

export class ClienteServico {
  constructor(private readonly repo: ClienteRepositorio) {}

  /**
   * RF04 + RN07 + RN08. Nome ou telefone iguais NÃO significam o mesmo
   * cliente: havendo suspeita de duplicidade o sistema alerta (409) e só
   * cadastra se o atendente confirmar. Nunca mescla sozinho.
   */
  async cadastrar(entrada: ClienteEntrada, usuario: Usuario): Promise<Cliente> {
    const telefone = entrada.telefone ?? null;
    const email = entrada.email ?? null;

    if (!entrada.confirmarDuplicidade) {
      const candidatos = await this.repo.buscarCandidatosDuplicidade({
        nome: entrada.nome,
        telefone,
        email,
      });
      if (candidatos.length > 0) {
        throw erros.possivelDuplicidade(candidatos.map(paraResumo));
      }
    }

    try {
      return await this.repo.criar({
        nome: entrada.nome,
        telefone,
        email,
        criadoPorId: usuario.id, // RN22
      });
    } catch (e) {
      if (e instanceof AppError) throw e;
      registrarFalha('cadastro de cliente', e);
      throw erros.falhaGravacao(); // RF12: sem sucesso falso
    }
  }

  /** RF05 + RF06. Homônimos se distinguem por identificador e contato. */
  async buscar(termo: string) {
    const telefoneNormalizado = normalizarTelefone(termo);
    const clientes = await this.repo.buscarPorTexto(
      telefoneNormalizado ?? termo,
      LIMITE_BUSCA,
    );
    const encontrados = clientes.map(paraResumo);
    return encontrados.length > 0
      ? { total: encontrados.length, clientes: encontrados, ofertaCadastro: false }
      : {
          total: 0,
          clientes: [],
          ofertaCadastro: true, // RF06: avisar e oferecer o cadastro
          mensagem: 'Cliente não encontrado. Deseja cadastrá-lo?',
        };
  }

  async obter(id: number): Promise<Cliente> {
    const cliente = await this.repo.buscarPorId(id);
    if (!cliente) throw erros.clienteNaoEncontrado();
    return cliente;
  }

  /**
   * PB18 + RN07 + RN08. Substitui os dados editáveis do cliente (mesmas regras
   * do cadastro). O identificador e os vínculos com equipamentos/OS não mudam.
   * A checagem de duplicidade ignora o próprio cliente.
   */
  async atualizar(
    id: number,
    entrada: ClienteEntrada,
    usuario: Usuario,
  ): Promise<Cliente> {
    await this.obter(id);
    const telefone = entrada.telefone ?? null;
    const email = entrada.email ?? null;

    if (!entrada.confirmarDuplicidade) {
      const candidatos = await this.repo.buscarCandidatosDuplicidade({
        nome: entrada.nome,
        telefone,
        email,
        ignorarId: id,
      });
      if (candidatos.length > 0) {
        throw erros.possivelDuplicidade(candidatos.map(paraResumo), 'alteração');
      }
    }

    try {
      const atualizado = await this.repo.atualizar(id, {
        nome: entrada.nome,
        telefone,
        email,
        atualizadoPorId: usuario.id, // RN22
      });
      if (!atualizado) throw erros.clienteNaoEncontrado();
      return atualizado;
    } catch (e) {
      if (e instanceof AppError) throw e;
      registrarFalha('alteração de cliente', e);
      throw erros.falhaGravacao(); // RF12
    }
  }

  /**
   * RN20: nada apaga o histórico. Só é excluído o cliente sem equipamentos
   * nem OS; a recusa vem do próprio banco (FK com RESTRICT), sem corrida
   * entre "conferir" e "apagar". Devolve o cadastro excluído.
   */
  async excluir(id: number): Promise<Cliente> {
    let resultado;
    try {
      resultado = await this.repo.excluir(id);
    } catch (e) {
      registrarFalha('exclusão de cliente', e);
      throw erros.falhaGravacao();
    }
    switch (resultado.resultado) {
      case 'EXCLUIDO':
        return resultado.registro;
      case 'EM_USO':
        throw erros.clienteComVinculos();
      case 'NAO_ENCONTRADO':
        throw erros.clienteNaoEncontrado();
    }
  }
}

function paraResumo(c: Cliente) {
  return { id: c.id, nome: c.nome, telefone: c.telefone, email: c.email };
}

/** Log apenas no servidor, sem dados do cliente e sem devolver nada à API. */
export function registrarFalha(contexto: string, e: unknown): void {
  const nome = e instanceof Error ? e.name : 'Erro';
  console.error(`[sysos] falha em ${contexto}: ${nome}`);
}
