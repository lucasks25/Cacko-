export const TYPES = ['lead','deal','pipeline','task','conversation','message','automation','agent','campaign','product','connection','integration','member','tag','setting','activity','field','lossReason','list','department','workHours','activityType','parameter','template','boost','knowledge','mcpServer','job','fieldGroup','call','transaction','proposal','contract','vacancy','shift','content','article','chatTurn'] as const;
export type EntityType = typeof TYPES[number];
export interface Entity { id: string; type: EntityType; data: Record<string, any>; revision: number; updatedAt: string; deleted: boolean }
export type CRMPage = 'home'|'tools'|'business'|'assistant'|'proposals'|'finance'|'contracts'|'shifts'|'recruiting'|'marketing'|'wiki'|'central'|'calls'|'ai-center'|'welcome'|'templates'|'dashboard'|'pipelines'|'leads'|'inbox'|'automations'|'agents'|'campaigns'|'tasks'|'products'|'reports'|'connections'|'integrations'|'settings'|'help';
export interface CRMContextValue {
  entities: Entity[];
  mode: 'demo'|'live';
  loading: boolean;
  page: CRMPage;
  focusId: string|null;
  save: (type: EntityType, data: Record<string, any>, id?: string, expectedRevision?:number) => Promise<Entity>;
  saveMany: (values: {type: EntityType; data: Record<string, any>; id?:string}[]) => Promise<void>;
  archive: (entity: Entity) => Promise<void>;
  restore: (entity: Entity) => Promise<void>;
  refresh: () => Promise<void>;
  notify: (text: string, kind?: 'success'|'error'|'info') => void;
  navigate: (page: CRMPage, id?: string) => void;
  startLive: () => Promise<void>;
  startDemo: () => void;
  query: string;
}
export const STAGE_COLORS = ['#4c79f7','#ab64d9','#e3a849','#48a180','#e07788','#40a7bc'];
export const currency = (value: number|undefined) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}).format(value||0);
export const dateBR = (value?: string) => value ? new Date(value.includes('T')?value:value+'T12:00:00').toLocaleDateString('pt-BR') : '—';
export const initials = (name?: string) => (name||'?').split(' ').filter(Boolean).slice(0,2).map(n=>n[0]).join('').toUpperCase();
export const today = () => new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
