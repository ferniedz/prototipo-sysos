# Rastreabilidade — requisitos, regras e testes

Escopo implementado: **PB02 (cliente)** e **PB03 (equipamento)**. Nada de OS,
status, orçamento, login ou administração de contas.

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
| RN20 nada apaga histórico | sem rotas de exclusão; `ON DELETE RESTRICT` | `equipamentos.test.ts`, `prisma.int.test.ts` |
| RN22 quem fez e quando | `criadoPorId` (do token), `criadoEm` | `clientes.test.ts`, `equipamentos.test.ts` |
| RNF erros sem stack/SQL/tabela | `tratarErros` | `seguranca.test.ts` |
| RNF credenciais em variável de ambiente | `config.ts`, `.env.example` | — |
| RNF gravação transacional | `EquipamentoPrismaRepositorio` | `prisma.int.test.ts` |

## Fora do escopo desta entrega (de propósito)

Login/logout e emissão do token (PB01), contas e permissões (PB08), abertura e
consulta de OS (PB04/PB05), correção e gestão de cadastro de cliente (PB18),
hash de senha (depende do login), pipeline e backup (PB06/PB07).
