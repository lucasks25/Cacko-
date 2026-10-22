import sqlite3,json,uuid,datetime,hashlib,threading
from pathlib import Path
TERMINAL={'completed','missed','failed','cancelled'}
DEFAULT_AGENT={'name':'Assistente de atendimento','instructions':'Atenda em português brasileiro, com clareza e objetividade. Entenda a necessidade, consulte a base de conhecimento e encaminhe ao time quando não souber. Não invente preços, prazos ou confirmações.','knowledge':'','greeting':'Olá! Sou o assistente virtual. Como posso ajudar?','autoReply':False,'inboxIds':[]}
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
class Store:
 def __init__(self,path):
  Path(path).parent.mkdir(parents=True,exist_ok=True);self.db=sqlite3.connect(path,check_same_thread=False);self.db.row_factory=sqlite3.Row;self.lock=threading.RLock()
  self.db.executescript('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS calls(tenant TEXT,id TEXT,request_id TEXT,fingerprint TEXT,data TEXT,PRIMARY KEY(tenant,id),UNIQUE(tenant,request_id)); CREATE TABLE IF NOT EXISTS agents(tenant TEXT PRIMARY KEY,data TEXT); CREATE TABLE IF NOT EXISTS events(tenant TEXT,id TEXT,status TEXT,created_at TEXT,PRIMARY KEY(tenant,id));')
 def create_call(self,tenant,request_id,data):
  fingerprint=hashlib.sha256(json.dumps(data,sort_keys=True).encode()).hexdigest()
  with self.lock,self.db:
   old=self.db.execute('SELECT * FROM calls WHERE tenant=? AND request_id=?',(tenant,request_id)).fetchone()
   if old:
    if old['fingerprint']!=fingerprint:raise ValueError('Identificador já utilizado para outra chamada.')
    return json.loads(old['data'])
   call_id=str(uuid.uuid4());record={**data,'id':call_id,'status':'queued','createdAt':now(),'transcript':[],'outcome':'','notes':''}
   record['room']='fluxo_'+hashlib.sha256(tenant.encode()).hexdigest()[:16]+'_'+call_id
   self.db.execute('INSERT INTO calls VALUES(?,?,?,?,?)',(tenant,call_id,request_id,fingerprint,json.dumps(record)));return record
 def claim_start(self,tenant,call_id):
  with self.lock,self.db:
   data=self.call(tenant,call_id)
   if not data or data['status']!='queued':return False
   data['status']='starting';self.db.execute('UPDATE calls SET data=? WHERE tenant=? AND id=?',(json.dumps(data),tenant,call_id));return True
 def call(self,tenant,call_id):
  with self.lock:
   row=self.db.execute('SELECT data FROM calls WHERE tenant=? AND id=?',(tenant,call_id)).fetchone();return json.loads(row['data']) if row else None
 def call_by_room(self,room):
  with self.lock:
   for row in self.db.execute('SELECT tenant,data FROM calls'):
    data=json.loads(row['data'])
    if data.get('room')==room:return row['tenant'],data
  return None
 def calls(self,tenant):
  with self.lock:return sorted([json.loads(r['data']) for r in self.db.execute('SELECT data FROM calls WHERE tenant=?',(tenant,))],key=lambda r:r['createdAt'],reverse=True)[:500]
 def update_call(self,tenant,call_id,changes):
  with self.lock,self.db:
   data=self.call(tenant,call_id)
   if not data:raise KeyError('Chamada não encontrada.')
   if (data['status'] in TERMINAL and changes.get('status') not in TERMINAL) or (data['status'] in ['active','handoff'] and changes.get('status') in ['queued','starting','ringing']):changes={k:v for k,v in changes.items() if k!='status'}
   data.update(changes);self.db.execute('UPDATE calls SET data=? WHERE tenant=? AND id=?',(json.dumps(data),tenant,call_id));return data
 def append_transcript(self,tenant,call_id,item):
  with self.lock:
   data=self.call(tenant,call_id)
   if not data:return
   items=data['transcript']
   if item.get('id') and any(i.get('id')==item['id'] for i in items):return
   self.update_call(tenant,call_id,{'transcript':(items+[item])[-2000:]})
 def agent(self,tenant):
  with self.lock:
   row=self.db.execute('SELECT data FROM agents WHERE tenant=?',(tenant,)).fetchone();return json.loads(row['data']) if row else dict(DEFAULT_AGENT)
 def save_agent(self,tenant,data):
  with self.lock,self.db:self.db.execute('INSERT INTO agents VALUES(?,?) ON CONFLICT(tenant) DO UPDATE SET data=excluded.data',(tenant,json.dumps(data)))
  return data
 def claim_event(self,tenant,event_id):
  with self.lock,self.db:
   cursor=self.db.execute('INSERT OR IGNORE INTO events VALUES(?,?,?,?)',(tenant,event_id,'processing',now()));return cursor.rowcount==1
 def finish_event(self,tenant,event_id,status):
  with self.lock,self.db:self.db.execute('UPDATE events SET status=? WHERE tenant=? AND id=?',(status,tenant,event_id))
