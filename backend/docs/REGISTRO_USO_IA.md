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

## Validação e limitações (sessão 1)

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