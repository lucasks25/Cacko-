import re
from typing import Literal
from fastapi import APIRouter,Depends,Query,HTTPException
from pydantic import BaseModel,Field,ConfigDict
from .providers import Chatwoot
from .policy import dial_number

class ContactInput(BaseModel):
 model_config=ConfigDict(extra='forbid')
 name:str=Field(min_length=1,max_length=100)
 phone:str=Field(default='',max_length=40)
 email:str=Field(default='',max_length=254)
class ConversationInput(BaseModel):
 model_config=ConfigDict(extra='forbid')
 contactId:int=Field(gt=0,le=2147483647,strict=True)
 inboxId:int=Field(gt=0,le=2147483647,strict=True)

def messaging_router(settings,tenant):
 router=APIRouter(prefix='/v1')
 def provider(t):return Chatwoot(settings.tenant(t))
 @router.get('/conversations')
 async def conversations(page:int=Query(1,ge=1,le=10000),status:Literal['all','open','pending','resolved']='all',t=Depends(tenant)):
  return await provider(t).conversation_page(page,status)
 @router.get('/conversations/{conversation_id}/messages')
 async def messages(conversation_id:int,before:int|None=Query(None,ge=1,le=2147483647),after:int|None=Query(None,ge=1,le=2147483647),t=Depends(tenant)):
  if before is not None and after is not None:raise HTTPException(400,'Use apenas um cursor de histórico.')
  rows=await provider(t).messages(conversation_id,**({'after':after} if after is not None else {'before':before}))
  return {'messages':rows,'oldestId':str(min(int(m['id']) for m in rows)) if rows else None,'hasMore':len(rows)==(100 if after is not None else 20)}
 @router.get('/inboxes')
 async def inboxes(t=Depends(tenant)):return {'inboxes':await provider(t).inboxes()}
 @router.get('/contacts')
 async def contacts(q:str=Query('',max_length=100),page:int=Query(1,ge=1,le=10000),t=Depends(tenant)):
  return await provider(t).contacts(q.strip(),page)
 @router.post('/contacts')
 async def create_contact(data:ContactInput,t=Depends(tenant)):
  name=data.name.strip();email=data.email.strip()
  if not name:raise HTTPException(400,'Informe o nome do contato.')
  phone=dial_number(data.phone) if data.phone else ''
  if email and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email):raise HTTPException(400,'Informe um e-mail válido.')
  if not phone and not email:raise HTTPException(400,'Informe telefone ou e-mail.')
  body={'name':name}
  if phone:body['phone_number']=phone
  if email:body['email']=email
  return {'contact':await provider(t).create_contact(body)}
 @router.post('/conversations')
 async def create_conversation(data:ConversationInput,t=Depends(tenant)):
  return {'conversation':await provider(t).create_conversation(data.contactId,data.inboxId),'sent':False}
 return router
