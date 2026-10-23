# Cobertura da referência Squad.com

A referência foi alterada pelo usuário de Datacrazy para Squad.com. O usuário informou que não consegue abrir a conta do Squad; nenhuma tela autenticada desse produto foi inspecionada. A comparação abaixo usa apenas o material público oficial.

| Área | Referência observada | Entrega atual | Limite |
|---|---|---|---|
| Menu e agentes | Captura oficial do app | Menu, grupos, favoritas e seis agentes reproduzidos | Home e telas de chat completas não foram observadas |
| CRM | Captura `waz-dashboard` | Pipeline comercial com cinco colunas, indicadores, cards e CRUD | Fluxos internos do Squad não validados |
| Clientes/conversas | Capturas `waz-sec1` e `waz-sec2` | Clientes com perfil, resumo solicitado à IA, vínculo de conversa, busca de contatos, criação de conversas, paginação e histórico incremental via Chatwoot | Anexos abrem no Chatwoot; regras e janelas dos canais continuam aplicáveis |
| Propostas | Captura `waz-sec3` | Lista, reaproveitamento da última proposta, geração com catálogo, revisão, itens, desconto e impressão | Sem geração de slides/documentos por IA nem envio automático |
| Financeiro | Captura `fin-dashboard` | Indicadores/transações, registros manuais e extração de lançamento pendente por IA | Sem banco, pagamentos, NF ou projeção automática |
| Contratos | Captura `juri-dashboard` | Pastas, filtros de status/prazo, ordenação, prazo de decisão, extração de texto e rascunho de renovação | Sem extração de PDF, assinatura ou revisão jurídica IA |
| Escalas | Captura `opy-dashboard` | Semana/mês, equipe, busca, verificação de dias sem turnos, colaboradores e rascunho de turno por IA | Sem otimização automática de toda a escala ou validação trabalhista |
| Recrutamento | Captura `pipo-dashboard` | Vagas, filtros, contagem de novos candidatos e prévia da página de vagas | Sem candidatura pública publicada, análise de CV ou classificação automática |
| Marketing | Captura `maky-dashboard` e páginas oficiais | Geração revisada de conteúdo, catálogo de rascunhos e painel de mídia paga com filtros e métricas de demonstração | Sem publicar campanhas, monitorar concorrentes ou disparar DMs automaticamente |
| Wiki | Descrição pública do Pipo | Artigos, aprovação manual e consulta por IA às fontes aprovadas selecionadas por relevância | Sem ingestão de arquivos ou garantia automática de veracidade da resposta |
| Chat dos agentes | Descrição pública | Histórico, contexto do negócio e oito ferramentas com geração validada e salvamento após revisão | Execução acionada pelos botões; chat livre ainda não chama ferramentas automaticamente |
| Ligações com IA | Pedido adicional do usuário | SDK LiveKit, worker, discador, transcrição e controle de sala | Não confirmado como recurso do Squad; requer infraestrutura e credenciais |

## Fontes públicas

- [Visão do aplicativo](https://squad.com/assets/app-preview-DcOHVJbs.png)
- [Pipeline comercial](https://squad.com/assets/waz-dashboard-Bc58Hk2F.png)
- [Clientes](https://squad.com/assets/waz-sec1-Dqp5I1oN.png)
- [Conversas](https://squad.com/assets/waz-sec2-BuCy3BUz.png)
- [Propostas](https://squad.com/assets/waz-sec3-11wOsphe.png)
- [Financeiro](https://squad.com/assets/fin-dashboard-cZ_j74Q9.png)
- [Contratos](https://squad.com/assets/juri-dashboard-CpwuSHk0.png)
- [Escalas](https://squad.com/assets/opy-dashboard-roDJM2Tn.png)
- [Recrutamento](https://squad.com/assets/pipo-dashboard-EPYB4bCT.png)
- [Marketing](https://squad.com/assets/maky-dashboard-D_Zbv3gd.png)
- [Funcionalidades divulgadas](https://squad.com/)

Não foi comprovada identidade visual de todas as páginas, nem equivalência funcional completa. As integrações foram testadas com provedores simulados; nenhuma mensagem ou ligação real foi realizada. A prévia usa dados fictícios e preserva os registros reais em um modo separado.

## Atualização de 22/10/2026

A caixa operacional permite cadastrar ou escolher um contato, selecionar uma caixa elegível e abrir atendimento humano sem enviar mensagem automaticamente. Há carregamento de mais conversas e mensagens anteriores. O polling conserva o histórico já carregado, atualiza status recentes e ignora respostas atrasadas de requisições anteriores. A ativação guiada mostra configuração de mensagens, IA, voz e telefonia sem solicitar segredos pelo formulário.

A rolagem do menu foi separada do cabeçalho e dos controles inferiores, com barra discreta e rodapé sempre visível. Configurações passou a respeitar o espaçamento lateral do restante da aplicação.

Validação desta atualização: 27 testes Node e 30 testes Python; teste manual local com serviço de canais simulado para cadastro, criação de conversa, histórico e envio. Nenhum provedor real foi contratado ou ativado.

## Alinhamento das páginas e ações dos agentes

Foram reinspecionadas as capturas oficiais de Clientes, Conversas, Propostas, Pipeline, Financeiro, Contratos, Escalas, Recrutamento e Mídia Paga. A comparação visual e os controles ajustados estão em `O-QUE-FOI-ALINHADO.md`.

As oito ferramentas implementadas são: proposta com catálogo (Waz), conteúdo (Maky), lançamento pendente (Fin), turno (Opy), extração de contrato e rascunho de renovação (Juri), artigo e consulta à wiki aprovada (Pipo). Todas dependem do motor de IA configurado; o retorno é validado e apresentado para revisão antes de salvar. Nenhuma delas envia mensagens, movimenta dinheiro, assina contratos ou publica anúncios automaticamente.

Importação/exportação, arquivados e histórico detalhado dos clientes continuam em **Clientes → Gerenciar base de clientes**; o perfil resumido também abre o histórico completo. Os extras de telefonia ficaram no grupo Atendimento adicional.

A revisão corrigiu desconto inválido, valor negativo de contrato, contexto grande da wiki, conflito concorrente de escalas, cobertura de semana que atravessa meses, seleção de conversa por link e recorte mensal de métricas. A proteção de escalas é aplicada no SQL da escrita, além da validação da tela.

Validação do alinhamento: 38 testes Node e 40 testes Python passaram, além da verificação de tipos, do fluxo de API local e da revisão visual das páginas. A geração e o salvamento de conteúdo foram exercitados com IA simulada; isso não comprova uma conexão real com provedor.


## Correção do fluxo dos agentes — 23/10/2026

Os botões de tarefa deixam de redirecionar para páginas. Eles abrem a preparação/revisão dentro do agente, com resultado salvo também na conversa. **Abrir módulos** preserva os atalhos explícitos. Os campos estruturados de propostas e contratos são preservados no resumo do histórico, mesmo quando há observações ou texto de origem. Conteúdos extensos têm limite de contexto indicado.

Foi verificado localmente, com IA simulada, abrir → gerar → revisar → salvar → continuar → recarregar e consultar o histórico. A abertura do módulo ocorre somente por botão explícito. A integração real de IA continua pendente. A identidade de todos os cliques do Squad não foi validada.

## Chat livre aciona as tarefas — 23/10/2026

Ao escrever no chat de um agente um pedido que corresponde a uma das suas tarefas (por exemplo, "monte uma proposta do Plano Growth" no Waz ou "qual é o nosso processo de atendimento?" no Pipo), a tarefa abre dentro da conversa com o pedido preenchido. Produtos, clientes e contratos citados pelo nome já aparecem selecionados. O reconhecimento é determinístico, funciona também no modo demonstração e considera somente as tarefas do agente aberto. Gerar o rascunho continua dependendo do motor de IA, e salvar continua exigindo revisão. Mensagens sem tarefa correspondente seguem para o chat com IA.

Validação: 44 testes Node e 40 testes Python, verificação de tipos, build e teste no navegador (modo demonstração) para Waz e Pipo. A IA real não foi conectada.

## Modo de teste sem custo e resumo do dia — 23/10/2026

No modo demonstração, as oito tarefas geram rascunhos **simulados localmente** a partir do pedido (valores em R$, datas, horários, quantidades, desconto, contraparte e multa de contratos, trechos da wiki). O rascunho aparece com o selo "Simulado · sem IA" e passa pela mesma validação de um rascunho real. Não há chamada a provedor nem custo. Pedidos feitos no chat geram o rascunho automaticamente quando os dados necessários estão presentes.

A Home ganhou **Atenção hoje**: tarefas atrasadas ou de hoje, negócios com previsão de fechamento vencida ou sem atualização há 14 dias, contratos vencidos ou com decisão de renovação em até 15 dias e lançamentos pendentes nos próximos 7 dias. Só considera dados cadastrados.

Validação: 47 testes Node, tipos, build e teste no navegador (proposta pedida no chat → rascunho → aprovar → salvar → histórico; lançamento do Fin; Home).

## Entrada única de leads (Entrega A) — 23/10/2026

`lib/lead-intake.ts` organiza qualquer mensagem recebida (WhatsApp, Instagram, Facebook, site, e-mail, telefone):

1. **Sem duplicar:** procura o contato pela conversa, telefone (com ou sem +55), e-mail ou @ do Instagram.
2. **Lead novo:** origem e etiqueta do canal, qualificação com pontuação (Quente/Morno/Frio, com os motivos) e responsável por rodízio equilibrado (quem tem menos leads abertos).
3. **Funil:** cria o negócio no pipeline comercial. Leads quentes entram em "Em qualificação"; os demais, em "Novos leads". Não cria um segundo negócio se já houver um aberto.
4. **Ação:** tarefa "Responder <nome> (<canal>)" para hoje, sem repetir enquanto houver uma aberta, e a mensagem registrada no histórico.

Onde atua: botão **Simular lead recebido** no CRM (modo de teste) e a **Caixa conectada**, que organiza automaticamente os contatos novos das conversas carregadas. Limite atual: a caixa só organiza enquanto está aberta no navegador. A recepção pelo servidor (webhook do Chatwoot gravando no CRM 24h) é o próximo passo, junto com o follow-up por tempo e a passagem de negócio ganho para o financeiro e o contrato (Entrega B).

Validação: 51 testes Node, tipos, build e teste no navegador (lead novo e contato repetido). Canais reais não conectados.

## Automação ponta a ponta (Entrega B) — 23/10/2026

- **Recepção 24h pelo servidor:** o serviço repassa cada mensagem recebida do Chatwoot para `POST /api/crm/intake`, que aplica a entrada única de forma atômica, roda as automações de lead e ignora mensagens repetidas. A configuração está em `docs/CENTRAL-DE-CONTATO.md`.
- **Formulário do site:** em Integrações, gera uma chave e o código para colar no site. Inclui proteção simples contra robôs (campo oculto).
- **Follow-up:** ao abrir o app e a cada 30 minutos, cada negócio aberto sem contato há 48h (ajustável por `followUpHours` na configuração da empresa) ganha uma tarefa de follow-up para o responsável, uma por vez.
- **Negócio ganho:** cria uma entrada pendente no financeiro (quando há valor) e um rascunho de contrato, ligados ao negócio e ao cliente, sem duplicar. Não movimenta dinheiro nem assina contratos.

Limites: o follow-up depende de alguém abrir o app (não há agendador no servidor); com a publicação privada, chamadas externas à rota de recepção ficam bloqueadas até liberar essa rota; não há limite de envios por minuto no formulário.

Validação: 53 testes Node, 42 testes Python, tipos, build e teste no navegador (negócio ganho → financeiro + contrato). Canais reais não conectados.
