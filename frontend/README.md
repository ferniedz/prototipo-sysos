# SysOS — Frontend integrado à API

React, TypeScript e Vite, com interface voltada a computadores. O frontend usa a API Express em `../backend`; clientes e equipamentos são persistidos pelo backend, sem cadastro ou cache em `localStorage`.

## Executar

Requer Node.js 22.13 ou superior e npm. Configure e inicie primeiro o backend conforme [seu README](../backend/README.md), incluindo PostgreSQL, migrações e `JWT_SECRET`.

```bash
# Na pasta frontend
npm ci
cp .env.example .env
npm run dev
```

Abra `http://localhost:5173`. `VITE_API_URL` é a URL pública incluindo `/api`, por padrão `http://localhost:3000/api`. Reinicie o Vite após alterá-la. Não coloque `JWT_SECRET` ou tokens em variáveis `VITE_*`, pois elas são públicas no bundle.

### Acesso ao protótipo

O backend ainda não emite tokens por uma rota de login. Gere o JWT usando a configuração do backend:

```bash
# Em outro terminal, na pasta backend
npm run -s token:dev -- ATENDENTE 1
# Para acesso somente de consulta:
npm run -s token:dev -- TECNICO 2
```

No frontend, clique em **Conectar à API**, informe o token e escolha **Usar token**. O token fica apenas na memória da aba e é enviado como `Authorization: Bearer ...`. Recarregar exige informá-lo novamente. **Encerrar acesso** remove o token e os resultados exibidos, sem invalidar o JWT no servidor (não há endpoint de logout).

A leitura local do perfil controla apenas os botões; a API verifica assinatura, expiração e permissões em todas as requisições. Respostas 401 limpam o acesso e os resultados. Respostas 403 exibem a recusa do backend. Um token informado não é apresentado como prova de autenticação até a API processar as operações.

## Fluxos

### Clientes

- Informe de 2 a 150 caracteres de **nome, telefone ou e-mail** e pressione Buscar/Enter.
- Não existe carregamento inicial nem listagem de todos os clientes. A API retorna até 20 correspondências; refine o termo quando necessário. A paginação visual percorre somente essa resposta.
- A busca não retorna data de cadastro nem quantidade de equipamentos. Essas informações não são inventadas nos resultados. O identificador mostrado é o ID real da API.
- A ação sobre o nome consulta o cadastro por ID. **Equipamentos** seleciona esse cliente para a próxima tela.
- O atendente pode cadastrar cliente. Campos opcionais vazios são omitidos; telefone é exibido com máscara, enquanto a API guarda os dígitos.
- Possíveis duplicidades são determinadas pelo servidor: uma resposta 409 mostra os candidatos. Apenas a confirmação explícita envia `confirmarDuplicidade: true` em uma nova tentativa. Alterar dados revoga a confirmação.

### Equipamentos

1. Abra Equipamentos e busque um cliente.
2. Selecione o cliente. Somente então seus aparelhos são consultados em `GET /api/clientes/:clienteId/equipamentos`.
3. Busque um código interno exato desse cliente ou use **Todos deste cliente** para repetir a consulta dos aparelhos daquele cliente.
4. Para consultar outra pessoa, use **Trocar cliente**. A troca limpa o contexto anterior; respostas antigas são descartadas/canceladas.

O cadastro também exige esse cliente selecionado, mantido fixo no formulário. Os detalhes consultam `GET /api/clientes/:clienteId/equipamentos/:codigoInterno`. Não há busca global por marca, série, modelo ou proprietário. O código interno pode se repetir entre clientes; a identidade usada pelo frontend é o par **cliente + código**, sem gerar códigos próprios.

Os cadastros exibem estado de gravação, impedem submissão repetida durante a requisição e mantêm dados preenchidos em caso de erro. Mensagens e erros de campos do backend são apresentados ao funcionário. A tela não afirma que um cadastro inexistente foi salvo quando a API retorna erro.

## CORS

O backend permite por padrão as origens locais do Vite nas portas 5173 e 4173 (localhost e 127.0.0.1). Outra origem exige configurar `CORS_ORIGINS` no backend. As portas do frontend são fixas para evitar que o Vite troque silenciosamente de porta e seja bloqueado pelo CORS.

## Verificações

```bash
npm test
npm run test:watch
npm run test:coverage
npm run lint
npm run build
npm run preview
```

A suíte Jest testa validações alinhadas ao contrato, formatação de telefone, URLs aninhadas, mapeamento das respostas, Bearer, payloads de POST, confirmação de duplicidade, erros de campos, acesso expirado, falha de rede, cancelamento e renderização dos formulários e estados de consulta. `fetch` é simulado nos testes de contrato; os testes de renderização usam React no ambiente Node, sem navegador.

Na pasta backend, `npm test -- --runInBand cors.test.ts` exercita o Express em memória, sem porta ou PostgreSQL: preflight, origens, JWT, cadastro, duplicidade, busca e separação dos equipamentos por cliente. A suíte HTTP original usa Supertest e precisa de permissão para abrir portas. A integração Prisma exige banco de testes e apaga tabelas, conforme o README do backend; não foi executada nesta adaptação.

Roteiro manual com a API e um banco de desenvolvimento:

1. Informar token de atendente e buscar clientes por nome/contato; verificar erro para termo curto e oferta de cadastro para resultado vazio.
2. Cadastrar um cliente, repetir o nome/contato e conferir a confirmação de duplicidade retornada pelo servidor.
3. Selecionar um cliente, cadastrar equipamento e consultar pelo código interno. Trocar para outro cliente e verificar a separação mesmo que os códigos sejam iguais.
4. Usar token de técnico: consultar é permitido, e os botões de cadastro ficam ocultos; POST direto continua bloqueado pelo backend.
5. Testar token expirado, backend desligado e erro de gravação; não deve aparecer sucesso falso.

## Estrutura

- `src/lib/api.ts`: cliente HTTP e adaptação dos DTOs da API.
- `src/lib/registry.ts`: modelos e validações do frontend, sem persistência local.
- `src/components/SearchPanels.tsx`: consultas de clientes e equipamentos por cliente.
- `src/components/Forms.tsx`: gravação assíncrona e erros da API.
- `src/components/Details.tsx`: consultas individuais.
- `src/App.tsx`: navegação, seleção de cliente e acesso por token.

O escopo continua sendo cadastro e consulta. Pagamento, entrega, estoque, administração da loja e implementação do login não integram esta etapa. Nenhuma skill específica ou subagente foi utilizado nesta adaptação.
