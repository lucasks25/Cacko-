# Ativar o atendimento do Fluxo CRM

O CRM inclui os adaptadores de mensagens e o worker de voz. As contas dos provedores ainda precisam ser criadas e configuradas. Nenhuma contratação é feita automaticamente.

1. Instale o Chatwoot Community em um servidor HTTPS ou use uma conta Chatwoot existente. Conecte seus canais pelo painel dele.
2. No pacote de código do CRM, configure `deploy/.env` a partir de `deploy/.env.example`. Gere segredos exclusivos. Nunca coloque chaves no cadastro de clientes, mensagens ou base de conhecimento.
3. Em `TENANTS_JSON`, vincule o ID autenticado do usuário do CRM à conta e ao token do Chatwoot. Esse ID vem da identidade do Site; não use e-mail no lugar dele.
4. Inicie o serviço `contact-center` com a composição Docker entregue. No ambiente do Site, configure `CONTACT_CENTER_URL` com o endereço HTTPS alcançável e `CONTACT_CENTER_TOKEN` com o mesmo `SERVICE_TOKEN` do serviço.
5. Configure `LLM_BASE_URL`, `LLM_MODEL` e a chave do seu motor de texto quando necessária. Confira as sugestões antes de habilitar respostas automáticas.
6. Crie o projeto LiveKit e configure `LIVEKIT_URL`, `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` no servidor. Inicie o serviço `voice-agent` e configure o webhook assinado do LiveKit.
7. Para chamadas externas, contrate um número e um provedor SIP compatíveis com sua região. Configure o tronco no LiveKit e o `sip_trunk_id`/`allow_pstn` da sua conta.

No CRM, abra Assistente de IA → Ativar atendimento → Verificar conexões. “Configurado” não significa que uma chamada ou mensagem real já foi testada.

## Conferência antes da operação

- Cadastre um contato de teste no seu próprio canal.
- Abra uma conversa pelo CRM e envie uma mensagem manualmente.
- Confirme recebimento, resposta, histórico e finalização.
- Teste a IA no navegador, a transcrição e a entrada de um atendente.
- Faça uma chamada para um número seu e confirme que o encerramento interrompe a ligação.
- Ative respostas automáticas somente nas caixas selecionadas, após os testes.

## Documentação oficial

- Chatwoot: https://developers.chatwoot.com/self-hosted/deployment/docker
- Voz: https://docs.livekit.io/agents/start/voice-ai/
- Telefonia: https://docs.livekit.io/telephony/

O guia completo de implantação e os comandos estão em `docs/CENTRAL-DE-CONTATO.md` no pacote de código entregue. As integrações foram verificadas com provedores simulados; a operação com os provedores escolhidos precisa de validação real.
