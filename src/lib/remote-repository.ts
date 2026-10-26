import type { SupabaseClient } from '@supabase/supabase-js';
import { parseStoredData, type PortalData } from './domain';
import { readableDatabaseError, singleChange } from './changes';

export interface Workspace {id:string;organizationId:string;name:string;version:number}
export async function listWorkspaces(client:SupabaseClient):Promise<Workspace[]> {
  const {data,error}=await client.from('portal_developments').select('id,organization_id,payload,version').order('id');
  if(error) throw new Error(readableDatabaseError(error));
  return (data??[]).map(r=>({id:r.id,organizationId:r.organization_id,name:r.payload.name,version:r.version}));
}
export async function loadRemote(client:SupabaseClient,workspace:Workspace):Promise<PortalData> {
  const [development,lots,processes,events]=await Promise.all([
    client.from('portal_developments').select('*').eq('id',workspace.id).single(),
    client.from('portal_lots').select('*').eq('development_id',workspace.id).order('id'),
    client.from('portal_processes').select('*').eq('organization_id',workspace.organizationId).order('created_at',{ascending:false}),
    client.from('portal_events').select('*').eq('organization_id',workspace.organizationId).order('at'),
  ]);
  for(const result of [development,lots,processes,events]) if(result.error) throw new Error(readableDatabaseError(result.error));
  const lotIds=new Set(lots.data!.map(l=>l.id));
  const result:PortalData={
    schemaVersion:1,
    development:{...development.data.payload,version:development.data.version},
    lots:lots.data!.map(l=>({...l.payload,id:l.id,version:l.version})),
    processes:processes.data!.filter(p=>lotIds.has(p.lot_id)).map(p=>({
      ...p.payload,id:p.id,code:p.code,lotId:p.lot_id,status:p.status,createdAt:p.created_at,dueAt:null,version:p.version,
      history:events.data!.filter(e=>e.process_id===p.id).map(e=>({id:e.id,at:e.at,title:e.title,detail:e.detail})),
    })),
  };
  return parseStoredData(JSON.stringify(result));
}
export async function saveRemote(client:SupabaseClient,workspace:Workspace,before:PortalData,after:PortalData):Promise<PortalData> {
  const change=singleChange(before,after);
  const {error}=await client.rpc('portal_save',{p_org:workspace.organizationId,p_development:workspace.id,p_kind:change.kind,p_entity:change.entity,p_version:change.version});
  if(error) throw new Error(readableDatabaseError(error));
  try{return await loadRemote(client,workspace);}
  catch {throw new Error('A gravação foi concluída, mas a atualização da tela falhou. Recarregue os dados antes de salvar novamente.');}
}
