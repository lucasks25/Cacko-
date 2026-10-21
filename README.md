# Fluxo CRM

CRM em português inspirado na documentação pública do Datacrazy, com interface própria, demonstração navegável e persistência individual em Cloudflare D1. A cobertura e as diferenças estão em `../COBERTURA.md`; não há comprovação de equivalência integral com a aplicação privada original.

## Executar

Requer Node.js `>=22.13.0`. Na pasta deste projeto:

```sh
npm run install:ci
npm test
npm run dev
```

Abra a URL mostrada no terminal. No perfil portátil, o desenvolvimento começa normalmente em `http://127.0.0.1:5173`; `npm run dev -- --port 5174` escolhe outra porta. O login local de desenvolvimento é iniciado por `/signin-with-chatgpt?return_to=/` e usa uma identidade simulada apenas em loopback; não equivale ao login hospedado.

| Comando | Finalidade |
|---|---|
| `npm test` | Executa os testes de domínio: validação, CSV, métricas, condições de automação e conflitos de revisão. |
| `npm run dev` | Inicia Vinext/Vite com atualização durante a edição. |
| `npm run build` | Gera o aplicativo e o Worker em `dist/`; não publica o site. |
| `npm start` | Abre o Worker compilado localmente com Wrangler; execute o build antes. |
| `npm run db:generate` | Gera migrações após alterações no esquema Drizzle. |
| `npm run lint` | Executa ESLint. |

Os comandos descrevem como verificar e executar o projeto; esta seção não declara resultados de testes ou publicação.

## Demonstração e dados persistentes

O aplicativo inicia em **Demonstração**, com dados fictícios em memória. As alterações nos exemplos são reiniciadas ao recarregar a página ou abrir novamente a demonstração. O navegador guarda somente a escolha do ambiente.

**Começar com meus dados** e **Configurações → Ambiente** abrem o modo **Meu CRM**. Nesse modo, `/api/crm` lê e grava no D1 usando a identidade autenticada. Se a conta ainda não tiver pipeline, uma pipeline inicial é criada; a base fictícia não é copiada para a conta. Voltar à demonstração preserva os registros persistentes.

Cada registro pertence ao `userId` autenticado: usuários distintos têm bases separadas. **Equipe** cadastra nomes e funções de referência para atribuições; não envia convites, compartilha dados nem concede permissões. Perfil, preferências e empresa são cadastros do CRM, sem alterar a conta de autenticação.

## Sites, autenticação e D1

`.openai/hosting.json` declara o binding D1 `DB`; não há bucket R2 configurado. `app/page.tsx` exige Sign in with ChatGPT. A hospedagem Sites gerencia `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback` e os cabeçalhos de identidade; não crie rotas próprias para esses caminhos nem exponha esses cabeçalhos como autenticação de uma hospedagem sem um proxy confiável.

No ambiente Sites, publique com o fluxo do plugin para provisionar bindings e aplicar migrações de produção. Para restringir quem entra no site, configure a política de acesso da hospedagem. Essa política não implementa um workspace compartilhado ou papéis internos do CRM. Fora do Sites, é necessário fornecer autenticação confiável e um ambiente Cloudflare com o binding `DB`; copiar somente arquivos estáticos não fornece esses serviços.

A migração inicial é `drizzle/0000_glorious_pretty_boy.sql`. Para preparar o banco **local**, faça o build e aplique a migração uma vez:

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_glorious_pretty_boy.sql
npm run dev
```

Não reaplique uma migração já aplicada. Use `.wrangler/state` como raiz: o Wrangler cria as subpastas de versão. Essa operação altera somente o D1 local; o banco hospedado recebe suas próprias migrações no fluxo de publicação. Se mudar bindings ou esquema, gere as migrações necessárias e reconstrua antes de aplicar.

O backend valida registros e referências principais, separa dados por usuário, usa revisão otimista e arquivamento recuperável. A consulta atual limita o retorno a 10.000 registros totais por usuário; não há paginação no servidor. A implementação não inclui backups operacionais, auditoria completa de alterações, cobrança ou gestão de acesso de equipe.

## Navegação

A interface é uma SPA servida em `/`. As telas usam hashes próprios, por exemplo `/#pipelines`, `/#leads`, `/#inbox` e `/#settings`; um identificador pode seguir o hash, como `/#leads/ID`. Esses caminhos não são uma reprodução das URLs privadas do Datacrazy. `/api/crm` é a API interna autenticada deste projeto.

## Integrações pendentes

WhatsApp, Instagram, Crazy API, conexão universal, IA, webhooks, pagamentos e APIs de terceiros não têm provedores conectados. Os formulários de conexão e integração salvam metadados e referências; não realizam OAuth, leitura de QR, sincronização ou chamadas externas. Os agentes permanecem em rascunho e o playground informa que nenhuma resposta foi processada.

Mensagens e campanhas são rascunhos ou agendas persistidas. Não existe um serviço de disparo agendado, recebimento externo, confirmação de entrega ou envio em massa. As automações executam somente ações internas implementadas: criar atividade, adicionar tag ao lead e mover negócio para etapa válida da mesma pipeline; ações de mensagem ficam registradas como dependentes de conexão.

Nenhum segredo é necessário para explorar a demonstração ou usar o armazenamento Sites autenticado. Não coloque senhas, tokens, chaves privadas ou credenciais do Datacrazy nos formulários, código, base de conhecimento ou arquivos de publicação. Futuras integrações exigem implementação de backend e configuração de segredos no ambiente do servidor.

## Estrutura principal

| Caminho | Conteúdo |
|---|---|
| `app/crm.tsx` | Navegação, seleção de ambiente e gravações. |
| `components/` | Pipelines, leads, atividades, atendimento, automações, IA, campanhas e administração. |
| `lib/domain.ts` | Validação, CSV, métricas e avaliação das automações. |
| `app/api/crm/route.ts` | API interna autenticada, persistência D1 e ações internas. |
| `db/schema.ts` e `drizzle/` | Esquema e migrações. |
| `tests/domain.test.ts` | Testes automatizados de domínio. |

Fontes públicas principais: [Datacrazy](https://datacrazy.io/), [central oficial](https://help.datacrazy.io/pt-br), [leads](https://help.datacrazy.io/pt-br/articles/10670814-leads-como-utilizar-essa-aba-no-datacrazy), [negócios](https://help.datacrazy.io/pt-br/articles/10670806-gerenciamento-de-negocios), [multiatendimento](https://help.datacrazy.io/pt-br/articles/10670613-funcionalidades-do-multiatendimento) e [automações](https://help.datacrazy.io/pt-br/articles/10670672-como-criar-a-primeira-automacao). Pesquisa de referência: 21/10/2026.
