# CRM com atendimento e voz

O frontend é um CRM próprio com referência visual nas capturas públicas do Squad.com. O servidor de canais é Chatwoot Community; voz usa o SDK e o worker oficial LiveKit Agents. Nenhum desses componentes é o backend proprietário do Squad.

## Componentes entregues

| Componente | Origem | Versão aplicada | Aplicação |
|---|---|---|---|
| Chatwoot | https://github.com/chatwoot/chatwoot | v4.19.0 | Docker Compose e adaptador REST para conversas, mensagens, notas e status |
| LiveKit Agents | https://github.com/livekit/agents | 1.8.8 | Worker Python com áudio, transcrição e solicitação de humano |
| LiveKit Client | https://github.com/livekit/client-sdk-js | Veja package-lock.json | Áudio WebRTC dentro do navegador |

Os repositórios completos, nas versões fixadas, também foram baixados em `../upstream/`. Licenças estão preservadas nesses repositórios e em `deploy/notices/`. O conteúdo Enterprise do Chatwoot tem licença própria; o adaptador não usa Captain, SSO ou recursos pagos.

## Preparar os serviços

Requer Docker, um servidor com HTTPS para acesso externo e uma conta LiveKit Cloud para o worker configurado com LiveKit Inference. Os motores de voz podem ter cobrança por uso; este projeto não cria contas, contrata números ou compra créditos.

1. Copie `deploy/.env.example` para `deploy/.env`.
2. Gere `SERVICE_TOKEN`, `SECRET_KEY_BASE`, `POSTGRES_PASSWORD` e `REDIS_PASSWORD` exclusivos. Exemplo para gerar um valor: `openssl rand -hex 32`.
3. Inicie Postgres/Redis e prepare o Chatwoot:

```sh
docker compose -f deploy/compose.yaml --profile chatwoot up -d postgres redis
docker compose -f deploy/compose.yaml --profile chatwoot run --rm chatwoot bundle exec rails db:chatwoot_prepare
docker compose -f deploy/compose.yaml --profile chatwoot up -d chatwoot sidekiq
```

Configure uma conta Chatwoot e seus canais pelo procedimento oficial do projeto. O serviço não presume que um canal foi autenticado apenas porque uma configuração foi salva. WhatsApp/Instagram dependem do processo e das regras da Meta; as mensagens são enviadas através do Chatwoot, sujeito às permissões e janelas do canal.

## Vincular cada conta do CRM

`TENANTS_JSON` é um objeto configurado **somente no servidor**, indexado pelo ID autenticado do usuário no Site. Exemplo de formato, sem credenciais reais:

```json
{
  "ID_AUTENTICADO_DO_USUARIO": {
    "chatwoot_url": "http://chatwoot:3000",
    "chatwoot_account_id": 1,
    "chatwoot_api_token": "PREENCHER_NO_SERVIDOR",
    "webhook_secret": "SEGREDO_EXCLUSIVO_COM_32_OU_MAIS_CARACTERES",
    "allow_pstn": false,
    "sip_trunk_id": "",
    "allowed_numbers": []
  }
}
```

Cada conta Chatwoot deve pertencer a um único tenant. Um usuário não cadastrado nessa configuração recebe bloqueio; ele nunca herda a conta de outro cliente. A aplicação atual usa dados por usuário, não uma assinatura SaaS com faturamento e administração de organizações já concluídos.

No frontend local, defina em `.dev.vars`:

```text
CONTACT_CENTER_URL=http://127.0.0.1:8090
CONTACT_CENTER_TOKEN=O_MESMO_SERVICE_TOKEN
```

Na publicação do Site, configure essas duas variáveis pelo gerenciamento de ambiente do Sites. `CONTACT_CENTER_URL` precisa alcançar o serviço em HTTPS; `localhost` do computador não é acessível pelo Worker publicado. Não publique a API sem TLS e autenticação. O Compose expõe portas apenas em 127.0.0.1; use um proxy HTTPS autenticado/restrito conforme sua infraestrutura.

Depois, inicie a integração:

```sh
docker compose -f deploy/compose.yaml up -d --build contact-center
```

## IA de texto

Configure `LLM_BASE_URL`, `LLM_MODEL` e, quando necessário, `LLM_API_KEY` no servidor. O endpoint deve aceitar `/chat/completions`. É possível usar Ollama em um servidor seu; o projeto não baixa pesos de modelos nem presume capacidade de RAM/GPU.

Os botões **Sugerir resposta** e **Resumir** geram texto para revisão, sem enviar ao cliente. O chat com os agentes também depende desse motor. Sem configuração, o sistema informa indisponibilidade e não fabrica uma resposta da IA.

Para resposta automática:

- Configure um webhook `message_created` no Chatwoot apontando para `https://SEU_SERVICO/webhooks/chatwoot/ID_DO_TENANT?key=SEGREDO_DO_WEBHOOK`.
- Preserve o segredo; configure o proxy para não registrar a query string. O servidor é iniciado sem access log.
- No CRM, abra a configuração do assistente, selecione os IDs das caixas e ative atendimento automático.
- Só mensagens recebidas e públicas em caixas permitidas e conversas `pending`, sem atendente atribuído, são elegíveis. Notas e mensagens da própria IA não reativam o robô.
- Eventos são deduplicados. Falhas ficam registradas no SQLite e não são reenviadas automaticamente, para evitar duplicação após respostas de rede incertas.

## Voz e ligações

Preencha `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` e os modelos/voz no `.env`. A configuração padrão do worker usa LiveKit Inference; não é uma pilha de inferência local sem custos. Para usar o LiveKit Server auto-hospedado, é necessário substituir o bloco `inference.*` pelos plugins dos provedores escolhidos e provisionar também SIP. Essa alternativa não foi aplicada nesta entrega.

```sh
docker compose -f deploy/compose.yaml --profile voice up -d --build voice-agent
```

Use **Ligações → Testar IA pelo navegador**. O navegador pede o microfone ao conectar. O token gerado dura 15 minutos, permite apenas a sala da chamada e não concede administração do LiveKit.

Para telefonia externa, crie seu tronco SIP no LiveKit/provedor e configure `sip_trunk_id` e `allow_pstn: true` para o tenant. `allowed_numbers` limita destinos quando preenchido. O discador exige formato internacional explícito, como `+5511999991234`.

Configure o webhook assinado do LiveKit para `https://SEU_SERVICO/webhooks/livekit`; ele valida a assinatura oficial antes de atualizar status. O worker também registra transcrição e eventos. **Entrar na ligação** conecta um humano à sala; quando ele entra numa chamada telefônica assistida, o worker deixa de responder. **Solicitar humano**, pela IA, registra uma solicitação; não promete que alguém já entrou. O serviço não fornece roteamento automático de ligações telefônicas recebidas nesta versão.

Não há gravação de áudio provisionada nem discador preditivo/AMD, fila de distribuição de ramais, campanhas de ligação em massa ou tarifação por minuto. A implementação cobre chamadas individuais, áudio WebRTC, histórico e transcrição do agente.

## Verificação e limites

Foram usados provedores simulados nos testes de contrato; nenhuma mensagem real foi enviada e nenhum telefone foi chamado. Não foi validada a qualidade/latência da IA nem a operação SIP com uma conta real. Confira `COBERTURA.md` na pasta de entregáveis para distinguir telas reproduzidas de fluxos não verificados no Squad.

## Operar a caixa de conversas

Em **Meu workspace → Conversas**, use **Nova conversa** para buscar um contato no Chatwoot ou cadastrar nome e telefone internacional/e-mail. Selecione um canal compatível e abra o atendimento. Isso cria uma conversa `open`, sem mensagem inicial automática. Escreva e envie a primeira mensagem no editor.

WhatsApp, SMS, Twilio, e-mail, API e WebWidget têm suporte de início de conversa no adaptador, conforme a API fixada do Chatwoot. Canais que exigem que o cliente inicie o contato aparecem desabilitados. Regras de modelos, permissões e janelas de atendimento do provedor continuam sendo aplicadas; criar uma conversa não significa que uma mensagem foi entregue.

**Carregar mais conversas** pagina a lista conforme o filtro de status. A busca da lista filtra as conversas já carregadas. **Carregar mensagens anteriores** recupera páginas antigas e mantém o histórico durante atualizações automáticas. O modal de novo atendimento também permite buscar e paginar contatos.

O item **Ativar atendimento** no menu abre o checklist com status de conexão e links oficiais. “Configurado” indica configuração presente, não teste de operação concluído. Como o usuário ainda não possui contas de provedores, a publicação continua sem telefonia/mensagens reais.

## Ferramentas dos agentes

Abra um agente e selecione **Executar ferramenta** ou um cartão da área **Meu trabalho no seu negócio**. O endpoint `/v1/tools` usa o motor de texto configurado e exige o mesmo token/tenant do restante da central. Não há chave de IA no navegador.

- Waz: monta proposta usando os produtos escolhidos; preços vêm do catálogo, não do modelo.
- Maky: cria rascunho de post, artigo, anúncio ou análise do material fornecido.
- Fin: extrai um lançamento pendente; não marca valores como pagos/recebidos.
- Opy: prepara um turno; conflitos são rejeitados na escrita atômica do CRM.
- Juri: extrai dados do texto fornecido ou prepara e-mail de renovação; não assina ou envia.
- Pipo: organiza artigo não aprovado ou responde com as fontes aprovadas selecionadas por relevância.

O usuário revisa o resultado e clica em **Aprovar e salvar**. Um ID estável impede duplicação caso a resposta do salvamento se perca. Os textos de renovação/consulta podem ser salvos no histórico. PDF, publicação de campanhas, candidaturas públicas e chamadas automáticas de ferramentas pelo chat livre permanecem fora deste incremento.
