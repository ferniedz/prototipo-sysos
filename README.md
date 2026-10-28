# SysOS

Projeto acadêmico de um sistema de gerenciamento de ordens de serviço para assistências técnicas de pequeno e médio porte, desenvolvido no contexto da disciplina de Gestão de Projetos.

O protótipo atual implementa **cadastro e consulta de clientes e equipamentos**, com frontend integrado a uma API REST e persistência em PostgreSQL. O gerenciamento das ordens de serviço faz parte da evolução prevista do produto e ainda não está implementado.

## Documentação

- [Backend](backend/README.md): configuração da API, autenticação, endpoints, testes e deploy.
- [Frontend](frontend/README.md): configuração da interface, fluxos de consulta e cadastro e testes.
- [Modelo de dados](backend/docs/MODELO_DADOS.md).
- [Rastreabilidade dos requisitos](backend/docs/RASTREABILIDADE.md).
- [Registro de uso de IA do backend](backend/docs/REGISTRO_USO_IA.md).

## Funcionalidades atuais

- Cadastro de clientes com nome e ao menos um contato válido: telefone ou e-mail.
- Formatação do telefone com DDD, como `(42) 99922-2222`.
- Busca de clientes por nome, telefone ou e-mail, com até 20 resultados por consulta.
- Confirmação explícita de possíveis duplicidades, sem mesclar cadastros automaticamente.
- Cadastro de equipamentos vinculados a um cliente, com tipo obrigatório e marca, modelo e número de série opcionais.
- Consulta dos equipamentos de um cliente e busca por código interno nesse contexto.
- Acesso à API com JWT e permissões para atendentes e técnicos.
- Interface em português voltada a computadores.

Não há listagem global de clientes ou equipamentos. Primeiro o funcionário busca um cliente; depois, seleciona-o para consultar ou cadastrar seus equipamentos. Um equipamento é identificado pelo par **cliente + código interno**, portanto clientes diferentes podem ter equipamentos com o mesmo código.

Abertura e acompanhamento de OS, diagnóstico, orçamento, reparo e conclusão técnica são etapas futuras. Pagamento, entrega física de aparelhos, estoque e administração da loja ficam fora do escopo atual do projeto.

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Frontend | React, TypeScript e Vite |
| Backend | Node.js, TypeScript, Express e Zod |
| Persistência | PostgreSQL e Prisma ORM |
| Autenticação da API | JWT (HS256) |
| Testes | Jest; Supertest nas suítes HTTP do backend |

## Estrutura

```text
prototipo-sysos/
├── README.md
├── backend/
│   ├── README.md
│   ├── .env.example
│   ├── src/          # API, serviços e repositórios
│   ├── prisma/       # Modelo e migrações do banco
│   ├── tests/        # Regras, rotas, CORS e integração
│   └── docs/         # Documentação do backend
└── frontend/
    ├── README.md
    ├── .env.example
    ├── src/          # Telas, formulários e cliente HTTP
    ├── public/       # Recursos estáticos
    └── test/         # Configuração dos testes
```

Cada aplicação tem seu próprio `package.json` e suas dependências. Os comandos abaixo indicam em qual pasta devem ser executados.

## Executar o projeto localmente

### Pré-requisitos

- Node.js **22.13 ou superior**, compatível com as duas aplicações.
- npm.
- PostgreSQL em execução e um banco criado para o projeto.

### 1. Configurar e iniciar o backend

Em um terminal aberto na raiz do repositório:

```bash
cd backend
npm ci
cp .env.example .env
```

No PowerShell, substitua `cp .env.example .env` por `Copy-Item .env.example .env`.

Preencha `backend/.env` antes de continuar:

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão com o banco PostgreSQL criado para o projeto |
| `JWT_SECRET` | Segredo aleatório com pelo menos 32 caracteres |
| `PORT` | Porta da API; padrão `3000` |
| `CORS_ORIGINS` | Origens permitidas do frontend, separadas por vírgula e sem barra final |

Para gerar um valor para `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Ainda na pasta `backend`, gere o cliente Prisma, aplique as migrações e inicie a API:

```bash
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Por padrão, a API fica em `http://localhost:3000/api`. A rota `http://localhost:3000/health` verifica a disponibilidade do servidor e não exige token.

### 2. Configurar e iniciar o frontend

Em outro terminal aberto na raiz do repositório:

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

No PowerShell, use `Copy-Item .env.example .env` para criar o arquivo de configuração.

Abra **http://localhost:5173**. O exemplo define `VITE_API_URL=http://localhost:3000/api`; ajuste essa variável se a API estiver em outro endereço e reinicie o Vite.

As origens locais nas portas `5173` e `4173`, com `localhost` ou `127.0.0.1`, são permitidas por padrão no CORS do backend. Se mudar a origem do frontend, atualize `CORS_ORIGINS` e reinicie a API. Essa variável substitui a lista padrão.

### 3. Informar o token de acesso

O protótipo ainda não possui uma rota de login. Em outro terminal, na raiz do repositório, gere um token usando a configuração do backend:

```bash
npm --prefix backend run -s token:dev -- ATENDENTE 1
```

Na interface, clique em **Conectar à API**, cole o token e escolha **Usar token**.

| Perfil | Operações permitidas |
|---|---|
| `ATENDENTE` | Cadastro e consulta de clientes e equipamentos |
| `TECNICO` | Consulta de clientes e equipamentos |

Para testar o perfil de técnico:

```bash
npm --prefix backend run -s token:dev -- TECNICO 2
```

A API verifica assinatura, expiração e perfil em cada requisição. O frontend mantém o token apenas na memória da aba; recarregar a página exige informá-lo novamente. **Encerrar acesso** limpa o acesso na interface, mas não revoga o JWT no servidor.

Clientes e equipamentos são armazenados pelo backend no PostgreSQL. O frontend não persiste esses cadastros no navegador. Não coloque o `JWT_SECRET` nem tokens em variáveis `VITE_*`, pois elas são públicas no bundle, e não versione arquivos `.env` com credenciais reais.

## Testes e verificações

Os comandos abaixo são executados a partir da raiz do repositório, após instalar as dependências de cada aplicação.

| Verificação | Comando |
|---|---|
| Testes do frontend | `npm --prefix frontend test` |
| Cobertura do frontend | `npm --prefix frontend run test:coverage` |
| Lint do frontend | `npm --prefix frontend run lint` |
| Build e tipos do frontend | `npm --prefix frontend run build` |
| Tipos do backend | `npm --prefix backend run typecheck` |
| Testes do backend | `npm --prefix backend test -- --runInBand` |
| CORS e contratos HTTP em memória | `npm --prefix backend test -- --runInBand cors.test.ts` |
| Cobertura do backend | `npm --prefix backend run test:cov` |
| Build do backend | `npm --prefix backend run build` |

Os testes de renderização do frontend usam React no ambiente Node; não substituem a conferência visual e os testes de interação em navegador. Os testes de rotas com Supertest precisam de permissão para abrir portas locais. A suíte de CORS usa Express em memória, sem abrir portas.

**Integração com PostgreSQL:** `npm --prefix backend run test:int` executa `TRUNCATE` e apaga os dados das tabelas de clientes e equipamentos. Use exclusivamente um banco de testes, indicado pela `DATABASE_URL` carregada pelo comando. Se `DATABASE_URL` já estiver definida no ambiente, a suíte de integração também poderá ser incluída em uma execução geral dos testes do backend. Consulte o [README do backend](backend/README.md) antes de executá-la.

Os READMEs de cada aplicação contêm os detalhes dos contratos da API, configurações, limitações e roteiros de validação manual.
