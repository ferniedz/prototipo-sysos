# Rastreabilidade — requisitos, regras e testes

Escopo implementado: **PB02 (cliente)**, **PB03 (equipamento)** e a parte de
alteração/exclusão do **PB18**, formando o CRUD completo desses dois cadastros.
Nada de OS, status, orçamento, login ou administração de contas.

| Item | Onde está implementado | Testes |
|---|---|---|
| RF02 login/perfil em toda rota | `src/http/middlewares.ts`, `src/http/app.ts` | `seguranca.test.ts` |
| RF04 cadastrar cliente (nome + contato) | `validacao.ts`, `clienteServico.ts` | `clientes.test.ts` |
| RF05 buscar por nome/contato; homônimos por id | `clienteServico.buscar`, repositório | `clientes.test.ts` |
| RF06 cliente inexistente: avisar e oferecer cadastro | `erros.clienteNaoEncontrado`, `buscar` | `clientes.test.ts`, `equipamentos.test.ts` |
| RF07 cadastrar equipamento ligado ao cliente | `equipamentoServico.cadastrar` | `equipamentos.test.ts` |
| RF08 reaproveitar equipamento já cadastrado | `GET /clientes/:id/equipamentos` | `equipamentos.test.ts` |
| RF10 bloquear gravação com mensagem clara | `zod` + `tratarErros` | todos |
| RF12 falha ao gravar: avisar, sem registro parcial | serviços + transação Prisma | `seguranca.test.ts`, `prisma.int.test.ts` |
| RN01 equipamento pertence a cliente cadastrado | FK / PK composta | `equipamentos.test.ts`, `prisma.int.test.ts` |
| RN07 nome + contato; sem CPF/endereço obrigatórios | `clienteSchema`, CHECK no banco | `clientes.test.ts` |
| RN08 homônimo/telefone igual ≠ mesmo cliente; alerta, não mescla | `clienteServico.cadastrar` | `clientes.test.ts` |
| RN09 série opcional; código interno sempre | `criarParaCliente` | `equipamentos.test.ts` |
| RN20 nada apaga histórico; cliente com OS não é excluído | `DELETE` só sem vínculos; `ON DELETE RESTRICT` no banco; `409 *_COM_VINCULOS` | `clientes.crud.test.ts`, `equipamentos.crud.test.ts`, `prisma.int.test.ts` |
| RN22 quem fez e quando | `criadoPorId`/`criadoEm` (do token); `atualizadoPorId`/`atualizadoEm` nas alterações | `clientes.test.ts`, `equipamentos.test.ts`, `*.crud.test.ts` |
| PB18 corrigir cadastro de cliente (e equipamento) | `PUT` em `clienteServico.atualizar` e `equipamentoServico.atualizar` | `clientes.crud.test.ts`, `equipamentos.crud.test.ts`, `prisma.int.test.ts` |
| PB18 alteração mantém identificador e vínculos | schema `.strict()` recusa `id`/`clienteId`/`codigoInterno`; repositório não os atualiza | `clientes.crud.test.ts`, `equipamentos.crud.test.ts` |
| PB18 dados inválidos recusados com mensagem clara | mesmo `zod` do cadastro (RN07) | `clientes.crud.test.ts`, `equipamentos.crud.test.ts` |
| RN08 na alteração: duplicidade ignora o próprio cliente | `ignorarId` em `buscarCandidatosDuplicidade` | `clientes.crud.test.ts`, `prisma.int.test.ts` |
| RF02 perfil nas novas rotas (`PUT`/`DELETE`) | `ESCRITA` em `app.ts` | `clientes.crud.test.ts`, `equipamentos.crud.test.ts` |
| CORS permite `PUT` e `DELETE` (integração com o frontend) | `METODOS_PERMITIDOS` em `cors.ts` | `cors.test.ts` |
| RNF erros sem stack/SQL/tabela | `tratarErros` | `seguranca.test.ts` |
| RNF credenciais em variável de ambiente | `config.ts`, `.env.example` | — |
| RNF gravação transacional | `EquipamentoPrismaRepositorio` | `prisma.int.test.ts` |

## Fora do escopo desta entrega (de propósito)

Login/logout e emissão do token (PB01), contas e permissões (PB08), abertura e
consulta de OS (PB04/PB05), histórico de atendimento do cliente (PB17),
inativação/política de retenção e tratamento de dados pessoais (PB18 pede
política própria; aqui só se exclui cadastro sem vínculos), transferência de
proprietário do equipamento (fora da primeira história do PB03), hash de senha
(depende do login), pipeline e backup (PB06/PB07).
