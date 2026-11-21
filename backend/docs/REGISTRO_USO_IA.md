# Registro do uso de IA — protótipo do backend (cliente e equipamento)

Atende à orientação da atividade de Scrum (slide "Trabalho"): apresentar a
sequência e as skills utilizadas. Ferramenta: Claude (Anthropic), modelo
Claude Sonnet 5.5. Data: 21/10/2026.

## Sequência

1. **Pedido do grupo.** Protótipo do backend **apenas** do cadastro de cliente e
   de equipamento; equipamento como entidade fraca; seguir à risca o que já foi
   definido.
2. **Leitura do contexto.**
   - PDFs enviados: slides de Scrum da aula, "Requisitos e RN — SysOS" e
     "Product Backlog — SysOS".
   - Slides do Google (UC01/pseudocódigo/EAP, Tecnologias e Equipe, Gestão de
     Riscos), lidos pela visualização em HTML.
   - A página do Gamma (Comunicação, Aquisições, Stakeholders e Qualidade)
     **não pôde ser lida** (a ferramenta devolveu só a moldura da página). Seus
     critérios de qualidade foram considerados apenas pelo que consta no
     Product Backlog (Definição de Pronto).
3. **Separação entre o definido e o proposto.** Mapeamento de RF04–RF08, RN01,
   RN05, RN07–RN09, RN20, RN22, PB02, PB03, requisitos não funcionais e stack
   (TypeScript, Node.js, Express, Prisma, PostgreSQL, Jest, Render). Pontos sem
   definição foram marcados como **proposta** (ver `MODELO_DADOS.md`).
4. **Modelagem do banco antes do código**, como prevê o slide de riscos:
   `schema.prisma`, migration SQL e documento do modelo.
5. **Implementação** em camadas: validação (zod) → serviços (regras de negócio)
   → repositório (única camada que conhece o Prisma) → rotas Express com
   autenticação e perfil em todas as rotas.
6. **Testes automatizados (Jest + Supertest)** sobre as regras e rotas, com
   repositório em memória, mais um teste de integração para PostgreSQL real
   (pulado quando não há banco).
7. **Execução de type-check e testes**, e documentação (README, modelo de
   dados, rastreabilidade e este registro).

## Skills

- **Nenhuma skill específica** foi aplicada (as skills disponíveis tratam de
  documentos, planilhas, PDF e artefatos, não de backend).
- Ferramentas usadas: leitura de PDF e de páginas web, geração de arquivos,
  shell (npm, TypeScript, Jest).
- Não houve uso de subagentes.

## Sessão 1 — Validação e limitações

- No ambiente da IA, o download dos binários do Prisma foi bloqueado, então ali
  só rodaram os 50 testes de regras (repositório em memória) e o type-check.
- A validação com banco real foi feita pelo grupo em 22/10/2026: `prisma migrate
  deploy` aplicou a migration (escrita à mão pela IA), a API foi testada com
  PostgreSQL local (cadastro de cliente, equipamento e buscas) e a suíte de
  integração passou (4 testes: código interno concorrente, CHECK de contato,
  bloqueio de exclusão e busca/duplicidade).
- Pendências conhecidas: login (PB01) e demais itens fora do escopo; o relatório
  `npm audit` aponta vulnerabilidades em dependências de desenvolvimento, a
  tratar em sprint futura.

  ## Sessão 2 — CRUD completo de clientes e equipamentos (28/10/2026)

Pedido do grupo: completar o CRUD (alterar e excluir) apenas no backend,
mantendo o que já funcionava; o frontend é de outro integrante.

1. **Análise do repositório** clonado (`ferniedz/prototipo-sysos`): o backend
   passou para `backend/`; o colega acrescentou CORS e o frontend. Leitura do
   cliente HTTP do frontend para não quebrar nenhum contrato existente.
2. **Descoberta relevante:** o CORS liberava só `GET` e `POST`, o que barraria
   `PUT` e `DELETE` no navegador; foi estendido e testado.
3. **Decisões de regra** (marcadas como *proposta* quando o documento não define):
   - `PUT` substitui os campos editáveis; `DELETE` só exclui o que não tem
     vínculos (RN20, "nada apaga o histórico"); a política de exclusão/inativação
     do PB18 ficou como proposta a acordar.
   - Auditoria da alteração (RN22): colunas `atualizadoEm`/`atualizadoPorId`.
   - Resposta do `DELETE` em `200` com JSON, porque o cliente HTTP do frontend
     sempre lê o corpo.
4. **Banco antes do código:** migration `0002_crud_atualizacao`, aplicada e
   testada em um PostgreSQL 16 real (sobre dados já existentes; recusa de
   `DELETE` de cliente com equipamento confirmada pelo banco).
5. **Implementação** nas mesmas camadas (serviços → repositório → rotas) e
   **testes**: 109 testes passando (eram 59), com repositório em memória.
6. **Verificação por mutação:** três falhas foram injetadas de propósito (rota
   sem proteção de perfil, duplicidade que não ignora o próprio cliente, RN22
   sem gravar o autor) e os testes novos as detectaram.

**Skills:** nenhuma skill específica foi aplicada. Ferramentas: leitura de
repositório e de PDFs, shell (npm, TypeScript, Jest, `psql`), sem subagentes.

**Limitações desta sessão:** o download dos binários do Prisma voltou a ser
bloqueado, então o **código do repositório Prisma** (`prismaRepositorios.ts`)
**não foi executado** pela IA, e `prisma generate` não rodou (o type-check não
confere os tipos do Prisma). Foram escritos 9 novos testes de integração em
`tests/integracao/prisma.int.test.ts`, que precisam ser executados pelo grupo
(`npx prisma generate`, `npx prisma migrate deploy`, `npm run test:int`) antes
de considerar o CRUD validado de ponta a ponta.

**Defeito encontrado pela suíte de integração do grupo (28/10/2026):** ao rodar
`npm run test:int`, 12 dos 13 testes passaram e 1 falhou: excluir cliente com
equipamento devia devolver `EM_USO` (409), mas o PostgreSQL do grupo respondeu
com SQLSTATE `23001` ("violates RESTRICT setting"), que o Prisma entrega como
erro **sem código** (`PrismaClientUnknownRequestError`). O código só tratava o
`P2003`, então a API devolveria 500 em vez de 409. Correção: classificação dos
erros isolada em `src/infra/errosBanco.ts` (reconhece `P2003`/`P2014`, SQLSTATE
`23001`/`23503` e o texto da mensagem), mais uma conferência por contagem de
equipamentos como rede de segurança; teste unitário `tests/errosBanco.test.ts`
com a mensagem real do erro. Isso mostra o valor da suíte com banco real, que a
IA não conseguiu executar. A IA não executou o código Prisma; a
correção só está confirmada quando o grupo rodar de novo `npm run test:int` e o
teste "RN20: excluir cliente com equipamento retorna EM_USO" passar.

  
## Sessão 3 — Abrir e consultar ordem de serviço (20/11/2026)

Pedido do grupo: reaproveitar o projeto na disciplina de Desenvolvimento Web
(Trabalho 02 — React, API REST própria) e implementar **apenas o backend** da
geração da OS; o frontend é de outro integrante.

1. **Leitura dos documentos** do projeto (Requisitos e RN, Product Backlog):
   PB04 (abrir OS), PB05 (consultar OS), RF09–RF15, RN01–RN06 e o caso de uso
   "Abrir OS". Pontos que os documentos deixam em aberto foram marcados como
   **proposta** (OS em aberto, bloqueio x confirmação, matriz de acesso).
2. **Banco antes do código:** migration `0003_ordem_servico` com FK composta
   para o equipamento (RN01), `RESTRICT` (RN20) e CHECK do problema (RN02),
   aplicada e testada em PostgreSQL 16 real (recusa de equipamento de outro
   cliente, problema vazio e exclusão de equipamento/cliente com OS).
3. **Implementação** nas mesmas camadas: validação (zod) → serviço → repositório
   (Prisma) → rotas Express com login e perfil (RF02).
4. **Testes:** 21 novos testes com repositório em memória (136 no total, sem
   banco) e 7 testes de integração para o banco real. Verificação por mutação:
   três falhas injetadas de propósito (sem aviso de OS em aberto, sem conferir o
   dono do equipamento, status inicial errado) foram detectadas pelos testes.
5. **Documentação da API** em `docs/ORDEM_SERVICO.md` (exigida pela atividade:
   "descrição da API em repositório GitHub").

**Skills:** nenhuma skill específica. Ferramentas: leitura dos PDFs, shell (npm,
TypeScript, Jest, `psql`), sem subagentes.

**Limitações:** o download dos binários do Prisma segue bloqueado no ambiente da
IA, então o **código do repositório Prisma da OS** (`prismaOrdemServico.ts`)
**não foi executado** pela IA. Os testes de integração `ordens.int.test.ts`
precisam ser executados pelo grupo (`npx prisma generate`,
`npx prisma migrate deploy`, `npm run test:int`).