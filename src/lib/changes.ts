import type { PortalData } from './domain';

export interface Change {
  kind: 'development'|'lot'|'process';
  entity: unknown;
  version: number|null;
}
type Versioned = {version?:number};
export function singleChange(before: PortalData, after: PortalData): Change {
  const changes: Change[] = [];
  if(JSON.stringify(before.development)!==JSON.stringify(after.development))
    changes.push({kind:'development',entity:after.development,version:(before.development as Versioned).version??null});
  for(const [key,kind] of [['lots','lot'],['processes','process']] as const) {
    if(before[key].some(e=>!after[key].some(a=>a.id===e.id))) throw new Error('Exclusão não disponível.');
    for(const entity of after[key]) {
      const previous=before[key].find(e=>e.id===entity.id);
      if(JSON.stringify(previous)!==JSON.stringify(entity))
        changes.push({kind,entity,version:(previous as Versioned|undefined)?.version??null});
    }
  }
  if(changes.length!==1) throw new Error('Salve uma alteração por vez.');
  return changes[0];
}
export function readableDatabaseError(error:{code?:string;message?:string}) {
  if(error.code==='40001') return 'Outra sessão alterou este registro. Recarregue os dados antes de tentar novamente.';
  if(error.code==='23505') return 'Já existe um registro com essa identificação. Recarregue e confira os dados.';
  if(error.code==='42501') return 'Seu acesso não permite esta operação. Verifique o vínculo com o empreendimento.';
  if(error.code==='23514'||error.code==='23502') return 'O banco recusou os dados. Confira os campos obrigatórios e seus formatos.';
  return 'Não foi possível concluir a operação no Supabase. Verifique a conexão e a configuração do projeto.';
}
