# Fluxo CRM — continuidade do projeto

Responda em português, de forma direta. Esta pasta é uma cópia do código completo da aplicação e dos serviços próprios, com histórico Git. Dependências, builds, bancos locais e credenciais foram excluídos da cópia.

## Executar e validar

Requer Node.js 22.13 ou mais recente. Na raiz:

```sh
npm ci
npm run dev
```

Use a URL local mostrada pelo terminal. Para verificar:

```sh
npm test
npx tsc --noEmit
npm run build
```

Validação de 23/10/2026: 53 testes Node e 42 testes Python passando. Os testes Python exigem instalar `services/contact-center/requirements.txt`; exigem Python 3.12 (o Python 3.9 do macOS não instala as dependências; use `uv venv -p 3.12`) e são executados com `python -m unittest discover -s services/contact-center/tests -v`. Não trate testes com provedores simulados como prova de operação real.

## Estrutura

- `app/` e `components/`: interface React/TypeScript e rotas autenticadas.
- `lib/`: domínio, validação e preparação das tarefas dos agentes.
- `services/contact-center/`: serviço Python/FastAPI, Chatwoot, IA e LiveKit.
- `deploy/compose.yaml` e `deploy/.env.example`: configuração de implantação.
- `docs/CENTRAL-DE-CONTATO.md`: configuração e limites das integrações.
- `docs/entrega/`: comparação visual, cobertura e explicação dos módulos.
- `upstreams.lock.json`: versões e origens dos componentes de código aberto. Os clones integrais de terceiros não fazem parte desta cópia; a aplicação utiliza as dependências e imagens declaradas no projeto.

## Estado atual

A referência solicitada é Squad.com. Foram usadas capturas públicas; não houve acesso autenticado ao produto Squad e não existe comprovação de equivalência completa. Não afirmar que a plataforma está 100% idêntica ou pronta para revenda.

Os seis agentes possuem oito tarefas estruturadas. Elas abrem dentro da tela do agente, permitem revisar e salvar e registram um resumo do resultado no histórico. `Abrir módulos` é navegação explícita. O chat livre reconhece pedidos que correspondem a uma tarefa do agente (ex.: "monte uma proposta do Plano Growth") e abre essa tarefa preenchida, com produtos/clientes/contratos citados pré-selecionados; o rascunho é gerado automaticamente e salvar continua exigindo revisão. No modo demonstração os rascunhos são SIMULADOS localmente (lib/agent-simulator.ts), sem IA e sem custo — não apresentar como IA real. A Home mostra "Atenção hoje" (lib/daily-brief.ts). Mensagens sem tarefa correspondente seguem para o chat com IA.

A IA real, o Chatwoot, os canais Meta e a telefonia NÃO foram provisionados/conectados em produção. As variáveis do serviço precisam ser configuradas no servidor conforme a documentação. O usuário escolheu WhatsApp oficial com Coexistência e não quer ferramentas de pareamento não oficiais. Não apresentar um botão de configuração como integração funcionando.

O usuário prioriza vendas, atendimento, mensagens e ligações. Escalas e recrutamento são complementares. Não excluir módulos ou dados sem solicitação. Triagem de currículos continua manual; publicação social, Google Ads real, assinatura digital e pagamentos não estão implementados.

## Publicação existente

URL: https://fluxo-crm-lucas.lucas-sapuppo.chatgpt.site

Último commit publicado na origem desta cópia: 2dd3049d590c8b660909c4803e3e2af1de617527.

`.openai/hosting.json` identifica o Site privado existente. Preservar o acesso privado e o projeto; não criar outro Site ou alterar a audiência sem solicitação. Uma mudança local nesta pasta não atualiza automaticamente a publicação. Não armazenar credenciais em arquivos versionados nem solicitá-las no chat.
