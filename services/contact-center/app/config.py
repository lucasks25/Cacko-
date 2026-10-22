import json,os

class ConfigurationError(ValueError):pass

class Settings:
 def __init__(self,values=None):
  self.values=dict(os.environ if values is None else values)
  self.token=self.values.get('SERVICE_TOKEN','')
  if len(self.token)<32:raise ConfigurationError('SERVICE_TOKEN precisa ter pelo menos 32 caracteres.')
  try:self.tenants=json.loads(self.values.get('TENANTS_JSON','{}'))
  except Exception:raise ConfigurationError('TENANTS_JSON inválido.')
  if not isinstance(self.tenants,dict):raise ConfigurationError('TENANTS_JSON precisa ser um objeto.')
  accounts=set()
  for key,cfg in self.tenants.items():
   if not isinstance(cfg,dict):raise ConfigurationError('Configuração do tenant inválida.')
   if cfg.get('chatwoot_account_id'):
    account=(str(cfg.get('chatwoot_url','')).rstrip('/'),int(cfg['chatwoot_account_id']))
    if account in accounts:raise ConfigurationError('Cada conta Chatwoot precisa pertencer a um único tenant.')
    accounts.add(account)
 def tenant(self,key):
  if key not in self.tenants:raise ConfigurationError('Sua conta ainda não foi vinculada à central. Configure o tenant no servidor.')
  return dict(self.tenants[key])
 def public_status(self,key):
  cfg=self.tenant(key)
  return {'chatwootConfigured':all(cfg.get(k) for k in ['chatwoot_url','chatwoot_account_id','chatwoot_api_token']),
   'voiceConfigured':all(self.values.get(k) for k in ['LIVEKIT_URL','LIVEKIT_API_KEY','LIVEKIT_API_SECRET']),
   'pstnEnabled':bool(cfg.get('allow_pstn') and cfg.get('sip_trunk_id')),
   'textConfigured':bool(self.values.get('LLM_BASE_URL') and self.values.get('LLM_MODEL'))}
