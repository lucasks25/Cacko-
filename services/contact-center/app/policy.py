import re,datetime

def dial_number(value):
 if not isinstance(value,str) or not re.fullmatch(r'[+\d\s().-]+',value):raise ValueError('Telefone inválido.')
 number=re.sub(r'[\s().-]','',value)
 if not re.fullmatch(r'\+[1-9]\d{7,14}',number):raise ValueError('Informe o telefone com código internacional.')
 return number

def public_message(m):
 kind=m.get('message_type')
 return {'id':str(m['id']),'text':m.get('content') or '', 'direction':'in' if kind in [0,'incoming'] else 'out',
  'status':'note' if m.get('private') else m.get('status','received' if kind in [0,'incoming'] else 'sent'),
  'createdAt':datetime.datetime.fromtimestamp(m.get('created_at',0),datetime.timezone.utc).isoformat() if isinstance(m.get('created_at'),(int,float)) else m.get('created_at',''),
  'sender':(m.get('sender') or {}).get('name',''),
  'attachments':[{'type':a.get('file_type','file'),'name':a.get('meta',{}).get('original_filename','Anexo')} for a in m.get('attachments',[])]}

def is_auto_reply_eligible(payload,config):
 c=payload.get('conversation') or {}
 return bool(config.get('autoReply') and payload.get('event')=='message_created' and payload.get('message_type') in ['incoming',0]
  and not payload.get('private') and str(payload.get('content') or '').strip() and payload.get('inbox',{}).get('id') in config.get('inboxIds',[])
  and c.get('status')=='pending' and not c.get('meta',{}).get('assignee') and not c.get('assignee_id'))
