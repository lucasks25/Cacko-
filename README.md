# Fluxo — workspace de CRM e atendimento

Aplicação React/TypeScript com persistência D1, dados isolados por usuário, cadastro de clientes, pipeline, atividades e módulos operacionais. A referência visual atual é o **Squad.com**, conforme pedido posterior do usuário; a referência anterior Datacrazy foi substituída.

A interface usa capturas públicas oficiais como referência. **Não é o produto Squad, não usa seu backend e não foi validada como cópia completa de suas telas internas.** Os retratos dos agentes são carregados das URLs públicas oficiais como parte desta prévia visual.

## Executar

```sh
npm install
npm run dev
```

A demonstração abre com dados fictícios. Em **Usar meus dados**, os registros passam a ser salvos na conta autenticada. Não são copiados dados da conta Datacrazy ou Squad.

## Funcionalidades implementadas

- Pipeline comercial com cinco etapas, filtros, criação, edição e movimentação de negócios.
- Clientes, importação CSV, tarefas, notas e histórico comercial.
- Propostas com itens, quantidades, desconto e impressão.
- Registros financeiros de entradas/saídas; não movimentam dinheiro.
- Contratos com texto, contraparte e vencimento; não fazem assinatura digital nem análise jurídica automática.
- Escalas por colaborador, vagas/candidatos manuais, artigos da wiki e rascunhos de conteúdo.
- Navegação por agentes e ferramentas; chat dos agentes usa um motor de IA configurado no servidor. Não executa automaticamente as ferramentas.
- Atendimento Chatwoot por API: conversas existentes, mensagens de texto, notas, status, sugestão e resumo com IA.
- LiveKit: teste de áudio no navegador, chamadas individuais por SIP, transcrição do agente, entrada de humano e encerramento.

## Repositórios aplicados

- **chatwoot/chatwoot** — 38.075 estrelas na consulta, versão v4.19.0. Integração por API e composição Docker completa. Core Community MIT; diretório Enterprise tem licença separada.
- **livekit/agents** — 14.886 estrelas na consulta, versão 1.8.8, Apache-2.0. Worker Python e SDK de áudio no navegador.
- Pipecat (16.700 estrelas) e Twenty (59.235) foram comparados; não foram incorporados, evitando dois motores de voz redundantes e uma troca desnecessária de CRM.

Os códigos completos dos dois escolhidos estão em `../upstream/`, fora do pacote de publicação do frontend. `upstreams.lock.json` registra versões, commits, estrelas e licenças; `deploy/notices/` preserva os avisos.

## Ativar mensagens e voz reais

Consulte [docs/CENTRAL-DE-CONTATO.md](docs/CENTRAL-DE-CONTATO.md). O pacote inclui `services/contact-center/`, o worker e `deploy/compose.yaml`, mas **esses serviços não foram provisionados em um servidor de produção**. O Site publicado contém a interface e a rota autenticada que os acessa.

É necessário configurar Chatwoot, mapear o usuário a uma conta, informar as credenciais no servidor, conectar canais e provisionar LiveKit/SIP. O texto depende de um endpoint de chat completions; a configuração de voz usa LiveKit Inference. Nenhuma chave deve ser digitada em registros do CRM ou enviada pelo chat de suporte.

Limites atuais: a caixa integrada consulta a primeira página de conversas e mensagens do Chatwoot; criação de contatos/conversas e navegação por histórico antigo continuam no Chatwoot. Campanhas externas em massa, Google Ads, publicação social, emissão fiscal, pagamentos, assinatura, roteamento telefônico de entrada e discagem preditiva não estão implementados. Rascunhos não são exibidos como mensagens enviadas.

## Verificar

```sh
npm test
npx tsc --noEmit
node tests/api-smoke.mjs
python -m unittest discover -s services/contact-center/tests -v
```

O serviço Python exige as dependências de `services/contact-center/requirements.txt`; `requirements.lock` registra o ambiente de validação. O smoke test usa registros temporários `qa-*` e os arquiva no fim. Os testes de provedores são simulados: **não comprovam telefonia ou mensagens funcionando em uma conta real**.

A versão entregue é uma prévia funcional em desenvolvimento, com limites documentados, e não uma plataforma SaaS pronta para revenda com todas as funcionalidades do Squad.
