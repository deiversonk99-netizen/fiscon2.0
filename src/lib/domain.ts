export type LotStatus = 'Disponível' | 'Em projeto' | 'Em obra' | 'Concluído';
export type ProcessStatus = 'Rascunho' | 'Em triagem' | 'Em análise' | 'Aguardando correções' | 'Aprovado';
export type ProcessKind = 'Construção' | 'Reforma' | 'Regularização';
export type Discipline = 'Arquitetônico' | 'Estrutural';
export interface Person { name: string; email: string; phone: string }
export interface Professional extends Person { registration: string }
export interface Lot { version?:number; id: string; block: string; number: string; area: number; status: LotStatus; owner: Person }
export interface Development { version?:number; name: string; city: string; state: string; address: string }
export interface HistoryEvent { id: string; at: string; title: string; detail: string }
export interface Process { version?:number;
  id: string; code: string; lotId: string; title: string; kind: ProcessKind;
  disciplines: Discipline[]; professional: Professional; status: ProcessStatus;
  createdAt: string; dueAt: string | null; history: HistoryEvent[];
}
export interface PortalData { schemaVersion: 1; development: Development; lots: Lot[]; processes: Process[] }
export const STORAGE_KEY = 'fiscon-2-demo-v1';
export const processStatuses: ProcessStatus[] = ['Rascunho', 'Em triagem', 'Em análise', 'Aguardando correções', 'Aprovado'];
export const lotStatuses: LotStatus[] = ['Disponível', 'Em projeto', 'Em obra', 'Concluído'];
export const emailIsValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export function validateLot(lot: Lot, lots: Lot[]) {
  if (!lot.block.trim() || !lot.number.trim()) return 'Informe a quadra e o número do lote.';
  if (!Number.isFinite(lot.area) || lot.area <= 0) return 'A área deve ser maior que zero.';
  if (lots.some(x => x.id !== lot.id && x.block.toLowerCase() === lot.block.trim().toLowerCase() && x.number.toLowerCase() === lot.number.trim().toLowerCase())) return 'Já existe um lote com essa quadra e número.';
  if (lot.owner.email && !emailIsValid(lot.owner.email)) return 'Informe um e-mail válido para o proprietário.';
  return null;
}
export function validateProcess(process: Process, lots: Lot[]) {
  const lot = lots.find(x => x.id === process.lotId);
  if (!lot) return 'Selecione um lote cadastrado.';
  if (!lot.owner.name.trim()) return 'Cadastre o proprietário na ficha do lote antes de abrir um processo.';
  if (!process.title.trim()) return 'Informe uma descrição para o processo.';
  if (!process.disciplines.length) return 'Selecione pelo menos uma disciplina.';
  if (!process.professional.name.trim() || !process.professional.registration.trim()) return 'Informe o nome e o registro do responsável técnico.';
  if (!emailIsValid(process.professional.email)) return 'Informe um e-mail válido para o responsável técnico.';
  return null;
}
export function nextProcessCode(processes: Process[], year: number) {
  const max = processes.filter(p => p.code.startsWith(`PR-${year}-`)).reduce((n, p) => Math.max(n, Number(p.code.split('-').at(-1)) || 0), 0);
  return `PR-${year}-${String(max + 1).padStart(3, '0')}`;
}
export function createProcess(data: PortalData, input: Omit<Process, 'id' | 'code' | 'status' | 'createdAt' | 'dueAt' | 'history'>, at = new Date().toISOString()): PortalData {
  const draft: Process = { ...input, id: crypto.randomUUID(), code: nextProcessCode(data.processes, Number(at.slice(0, 4))), status: 'Rascunho', createdAt: at, dueAt: null, history: [{id: crypto.randomUUID(), at, title: 'Rascunho criado', detail: 'Cadastro inicial salvo. Nenhuma análise ou notificação foi enviada.'}] };
  const error = validateProcess(draft, data.lots);
  if (error) throw new Error(error);
  return {...data, processes: [draft, ...data.processes]};
}
export function createDemoData(): PortalData {
  const lots: Lot[] = Array.from({length: 50}, (_, i) => ({
    id: `lot-${i + 1}`, block: String(Math.floor(i / 10) + 1).padStart(2, '0'), number: String(i % 10 + 1).padStart(2, '0'), area: 420 + (i % 5) * 30,
    status: i < 5 ? 'Em projeto' : i < 8 ? 'Em obra' : i === 8 ? 'Concluído' : 'Disponível',
    owner: { name: i < 9 ? ['Marina Oliveira', 'Rafael Costa', 'Ana Martins', 'Pedro Lima', 'Clara Santos', 'Lucas Almeida', 'Julia Ribeiro', 'Bruno Rocha', 'Laura Souza'][i] : '', email: i < 9 ? `proprietario${i + 1}@example.com` : '', phone: '' },
  }));
  const statuses: ProcessStatus[] = ['Em análise', 'Aguardando correções', 'Em triagem', 'Aprovado', 'Rascunho'];
  return {
    schemaVersion: 1,
    development: {name: 'Reserva das Palmeiras', city: 'Uberlândia', state: 'MG', address: 'Empreendimento fictício para demonstração'},
    lots,
    processes: statuses.map((status, i) => ({
      id: `process-${i + 1}`, code: `PR-2026-${String(i + 1).padStart(3, '0')}`, lotId: lots[i].id,
      title: ['Residência térrea · 240 m²', 'Residência com dois pavimentos', 'Residência unifamiliar', 'Residência térrea com piscina', 'Reforma de área externa'][i],
      kind: i === 4 ? 'Reforma' : 'Construção', disciplines: ['Arquitetônico', 'Estrutural'],
      professional: {name: ['Camila Duarte', 'Felipe Nunes', 'Beatriz Melo', 'André Castro', 'Camila Duarte'][i], email: `profissional${i + 1}@example.com`, phone: '', registration: 'Registro demonstrativo'},
      status, createdAt: `2026-10-${String(12 + i).padStart(2, '0')}T12:00:00.000Z`, dueAt: i < 3 ? `2026-10-${22 + i}T20:00:00.000Z` : null,
      history: [{id: `event-${i}`, at: `2026-10-${String(12 + i).padStart(2, '0')}T12:00:00.000Z`, title: 'Registro de exemplo', detail: 'Situação ilustrativa para validar a interface. Não corresponde a uma análise real.'}],
    })),
  };
}

// Reject invalid or incompatible local data rather than silently replacing it.
export function parseStoredData(raw: string): PortalData {
  const d = JSON.parse(raw);
  const person = (p: Person) => p && ['name','email','phone'].every(k => typeof p[k as keyof Person] === 'string');
  if (d?.schemaVersion !== 1 || !d.development || !['name','city','state','address'].every(k => typeof d.development[k] === 'string') || !Array.isArray(d.lots) || !Array.isArray(d.processes)) throw new Error('Formato de dados incompatível.');
  if (!d.lots.every((l: Lot) => l && typeof l.id === 'string' && typeof l.block === 'string' && typeof l.number === 'string' && Number.isFinite(l.area) && l.area > 0 && lotStatuses.includes(l.status) && person(l.owner))) throw new Error('Cadastro de lotes inválido.');
  if (new Set(d.lots.map((l: Lot) => l.id)).size !== d.lots.length) throw new Error('Identificadores de lote duplicados.');
  if (!d.processes.every((p: Process) => p && ['id','code','lotId','title','createdAt'].every(k => typeof p[k as keyof Process] === 'string') && d.lots.some((l: Lot) => l.id === p.lotId) && processStatuses.includes(p.status) && ['Construção','Reforma','Regularização'].includes(p.kind) && Array.isArray(p.disciplines) && p.disciplines.every(x => ['Arquitetônico','Estrutural'].includes(x)) && person(p.professional) && typeof p.professional.registration === 'string' && Array.isArray(p.history) && p.history.every(e => e && ['id','at','title','detail'].every(k => typeof e[k as keyof HistoryEvent] === 'string')) && (p.dueAt === null || typeof p.dueAt === 'string'))) throw new Error('Cadastro de processos inválido.');
  return d as PortalData;
}
