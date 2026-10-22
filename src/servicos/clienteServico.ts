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
}

function paraResumo(c: Cliente) {
  return { id: c.id, nome: c.nome, telefone: c.telefone, email: c.email };
}

/** Log apenas no servidor, sem dados do cliente e sem devolver nada à API. */
export function registrarFalha(contexto: string, e: unknown): void {
  const nome = e instanceof Error ? e.name : 'Erro';
  console.error(`[sysos] falha em ${contexto}: ${nome}`);
}
