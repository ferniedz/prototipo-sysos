# SysOS — Backend (protótipo: cliente e equipamento)

API REST em **TypeScript / Node.js + Express**, com **Prisma + PostgreSQL**,
testes em **Jest** e hospedagem prevista no **Render** (stack definida nos
slides do projeto).

> **Escopo:** CRUD completo de **clientes**, **equipamentos** e **usuários (funcionários)** — cadastro,
> consulta, alteração e exclusão (PB02, PB03 e PB18). Equipamento é entidade
> fraca: pertence obrigatoriamente a um cliente. Veja `docs/` para o modelo de
> dados, a rastreabilidade e o registro de uso de IA.

## Pré-requisitos

- Node.js **20.6 ou superior** (os scripts usam `--env-file`).
- PostgreSQL acessível (local, Docker ou Render).

## Configuração

1. Crie o arquivo `.env` a partir do exemplo.

   PowerShell (Windows):

   ```powershell
   copy .env.example .env
   ```

   Bash (Linux/Mac):

   ```bash
   cp .env.example .env
   ```

2. Preencha as variáveis no `.env`:

   | Variável | O que colocar |
   |---|---|
   | `DATABASE_URL` | URL do PostgreSQL, no formato `postgresql://USUARIO:SENHA@HOST:PORTA/BANCO?schema=public` |
   | `JWT_SECRET` | Texto aleatório com no mínimo 32 caracteres |
   | `CORS_ORIGINS` | Origens HTTP/HTTPS exatas do frontend, separadas por vírgula e sem barra final; opcional no desenvolvimento local |

   Para gerar o `JWT_SECRET`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

> O `.env` não deve ir para o repositório (já está no `.gitignore`). Os scripts
> `dev`, `token:dev` e `test:int` leem o `.env` automaticamente.

## Como rodar

```bash
npm ci
npx prisma generate
npx prisma migrate deploy   # aplica as migrations de prisma/migrations
npm run dev                 # http://localhost:3000
```

> **Já tinha o banco criado antes do CRUD?** Rode `npx prisma generate` e
> `npx prisma migrate deploy` de novo: a migration `0002_crud_atualizacao`
> acrescenta as colunas de alteração (`atualizadoEm` e `atualizadoPorId`) sem
> apagar nem alterar os dados existentes.

## Testes

```bash
npm run typecheck
npm test            # regras e rotas (repositório em memória, sem banco)
npm run test:cov    # com cobertura (meta de referência: 70%)
npm run test:int    # integração com PostgreSQL real
```

> **Atenção:** `npm run test:int` lê a `DATABASE_URL` do `.env` e executa
> `TRUNCATE` nas tabelas `Cliente`, `Equipamento` e `Usuario`, **apagando os dados
> existentes**. Use um banco de testes.

Sem `DATABASE_URL` carregada, a suíte de integração é ignorada (aparece como
`skipped` em `npm test`).

## Autenticação

Toda rota sob `/api` exige `Authorization: Bearer <token>` (RF02). O **login**
é o PB01 e não faz parte deste protótipo; a API apenas valida tokens JWT
(HS256, com `sub` = id do funcionário e `perfil` = `ATENDENTE` ou `TECNICO`).

Para testar manualmente, gere um token de desenvolvimento (o script `token:dev`
lê o `JWT_SECRET` do `.env`):

PowerShell (Windows):

```powershell
$TOKEN = npm run -s token:dev -- ATENDENTE 1
$h = @{ Authorization = "Bearer $TOKEN" }
```

Bash (Linux/Mac):

```bash
TOKEN=$(npm run -s token:dev -- ATENDENTE 1)
```

Matriz de acesso **proposta**: escrita (`POST`, `PUT` e `DELETE`) só para
`ATENDENTE`; leitura (`GET`) para `ATENDENTE` e `TECNICO`.

## Endpoints

| Método e rota | Perfil | Descrição |
|---|---|---|
| `POST /api/clientes` | atendente | Cadastra cliente (nome + ao menos um contato). Responde `409` se houver possível duplicidade; para confirmar, repita com `"confirmarDuplicidade": true` |
| `GET /api/clientes?busca=` | ambos | Busca por nome, telefone ou e-mail; sem resultado devolve `ofertaCadastro: true` |
| `GET /api/clientes/:clienteId` | ambos | Consulta um cliente |
| `PUT /api/clientes/:clienteId` | atendente | Altera o cliente (mesmo corpo do `POST`). O `id` não muda. Duplicidade com **outro** cliente responde `409`; confirme com `"confirmarDuplicidade": true` |
| `DELETE /api/clientes/:clienteId` | atendente | Exclui o cliente **sem equipamentos nem OS**; com vínculos responde `409 CLIENTE_COM_VINCULOS` |
| `POST /api/clientes/:clienteId/equipamentos` | atendente | Cadastra equipamento (só `tipo` é obrigatório; o código interno é gerado) |
| `GET /api/clientes/:clienteId/equipamentos` | ambos | Lista os equipamentos do cliente (para reaproveitar) |
| `GET /api/clientes/:clienteId/equipamentos/:codigoInterno` | ambos | Consulta um equipamento |
| `PUT /api/clientes/:clienteId/equipamentos/:codigoInterno` | atendente | Altera o equipamento (mesmo corpo do `POST`). Dono e código interno não mudam |
| `DELETE /api/clientes/:clienteId/equipamentos/:codigoInterno` | atendente | Exclui o equipamento **sem OS vinculada**; com vínculos responde `409 EQUIPAMENTO_COM_VINCULOS` |
| `POST /api/usuarios` | atendente | Cadastra usuário (nome, email, senha, perfil). Responde `409` para e-mail duplicado |
| `GET /api/usuarios` | ambos | Lista todos os usuários cadastrados |
| `GET /api/usuarios/:id` | ambos | Consulta um usuário específico |
| `PUT /api/usuarios/:id` | atendente | Altera os dados e/ou perfil do usuário |
| `DELETE /api/usuarios/:id` | atendente | Exclui o usuário do sistema |

`GET /health` não exige login e não expõe dados.

### Como funcionam a alteração e a exclusão

- **`PUT` substitui os dados editáveis** (não é parcial): envie o cadastro
  completo. Num cliente, omitir um contato o remove, desde que reste ao menos
  um (RN07). Num equipamento, `marca`, `modelo` e `numeroSerie` omitidos ou
  vazios passam a nulos; só `tipo` é obrigatório.
- **Campos que nunca mudam:** `id` do cliente, `clienteId` e `codigoInterno` do
  equipamento (a identidade da entidade fraca), e `criadoEm`/`criadoPorId`.
  Enviá-los no corpo resulta em `400`. Não há transferência de equipamento para
  outro cliente.
- **Quem alterou e quando (RN22):** a resposta traz `atualizadoEm` e
  `atualizadoPorId` (nulos enquanto o cadastro nunca foi alterado).
- **Exclusão e histórico (RN20):** nada apaga o histórico. O banco recusa a
  exclusão de cliente que tenha equipamentos (e, quando existirem, OS), e de
  equipamento que tenha OS. Para excluir um cliente com equipamentos, exclua
  antes os equipamentos que não tenham OS. **Política proposta:** o PB18 deixa
  exclusão e inativação "dependentes de política própria a acordar"; aqui só se
  exclui o que não tem nenhum vínculo.
- **Códigos não são reaproveitados:** o `id` do cliente e o `codigoInterno` do
  equipamento excluídos nunca são reutilizados por novos cadastros.
- **Resposta do `DELETE`:** `200` com o cadastro excluído em JSON (não `204`),
  para o cliente HTTP do frontend, que sempre lê o corpo da resposta.

A busca de clientes exige um termo com 2 a 150 caracteres e retorna no máximo 20 resumos (id, nome e contatos), sem data de cadastro. Não há listagem global. O código interno de equipamento é único **por cliente**, por isso todas as consultas e cadastros exigem `clienteId` na URL.

### Exemplos

PowerShell (Windows), usando o `$h` da seção anterior:

```powershell
$body = @{ nome = "Maria da Silva"; telefone = "(42) 99999-1234" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/clientes -Headers $h `
  -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes($body))

$body = @{ tipo = "Notebook"; marca = "Dell" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/clientes/1/equipamentos -Headers $h `
  -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes($body))

# Alterar o cliente 1 (PUT substitui os dados editáveis)
$body = @{ nome = "Maria Souza"; email = "maria@exemplo.com" } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri http://localhost:3000/api/clientes/1 -Headers $h `
  -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes($body))

# Alterar o equipamento 1 do cliente 1
$body = @{ tipo = "Notebook"; marca = "Lenovo"; modelo = "IdeaPad" } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri http://localhost:3000/api/clientes/1/equipamentos/1 -Headers $h `
  -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes($body))

# Excluir o equipamento e depois o cliente
Invoke-RestMethod -Method Delete -Uri http://localhost:3000/api/clientes/1/equipamentos/1 -Headers $h
Invoke-RestMethod -Method Delete -Uri http://localhost:3000/api/clientes/1 -Headers $h
```

> No PowerShell, `Invoke-RestMethod` mostra só o status em respostas de erro.
> Para ver o corpo, envolva a chamada em `try { ... } catch { $_.ErrorDetails.Message }`.

Bash (Linux/Mac):

```bash
curl -X POST localhost:3000/api/clientes -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nome":"Maria da Silva","telefone":"(42) 99999-1234"}'

curl -X POST localhost:3000/api/clientes/1/equipamentos -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tipo":"Notebook","marca":"Dell"}'

curl -X PUT localhost:3000/api/clientes/1 -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nome":"Maria Souza","email":"maria@exemplo.com"}'

curl -X DELETE localhost:3000/api/clientes/1/equipamentos/1 -H "Authorization: Bearer $TOKEN"
curl -X DELETE localhost:3000/api/clientes/1 -H "Authorization: Bearer $TOKEN"
```

### Formato dos erros

```json
{ "erro": { "codigo": "...", "mensagem": "...", "detalhes": "..." } }
```

As respostas de erro nunca incluem stack trace, SQL ou nomes de tabela.

## Deploy (Render)

| Campo | Valor |
|---|---|
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run migrate:deploy && npm start` |
| Variáveis de ambiente | `DATABASE_URL` e `JWT_SECRET`, definidas no painel (nunca no repositório) |

## Estrutura

```
prisma/            schema.prisma e migration SQL
src/dominio/       tipos, interfaces de repositório e validação (zod)
src/servicos/      regras de negócio (RN01, RN07, RN08, RN09, RN22…)
src/infra/         repositórios Prisma (única camada que conhece o banco)
src/http/          app Express, autenticação/perfil e tratamento de erros
tests/             Jest + Supertest; tests/integracao exige PostgreSQL
docs/              modelo de dados, rastreabilidade, registro de uso de IA
```

## Integração com o frontend e CORS

O frontend em `../frontend` usa `VITE_API_URL=http://localhost:3000/api` e permite informar o JWT gerado por `token:dev`, sem incluir segredos no código do navegador.

Por padrão, o backend aceita as origens `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:4173` e `http://127.0.0.1:4173`. Para outra origem, configure `CORS_ORIGINS` com valores exatos separados por vírgula, por exemplo `https://sysos.example`. A configuração substitui a lista padrão; valor vazio não permite origens de navegador.

O middleware trata preflight `OPTIONS` antes do JWT, permite `GET`, `POST`, `PUT` e `DELETE` com `Authorization` e `Content-Type` e expõe `Location`. As requisições efetivas continuam exigindo token e perfil; respostas de erro para origens permitidas também recebem CORS. Não usa coringa nem cookies. Chamadas sem `Origin` (como scripts e ferramentas de API) continuam sujeitas à autenticação das rotas `/api`.

```bash
npm test -- --runInBand cors.test.ts
```

Essa suíte usa o Express e os serviços reais com repositórios em memória e injeção HTTP sem abrir portas. Ela verifica CORS, preservação do JWT nas operações efetivas e os contratos de cadastro/busca usados pelo frontend. Os demais testes HTTP continuam usando Supertest. Os testes de PostgreSQL não são necessários para verificar CORS e não foram executados nesta adaptação.
