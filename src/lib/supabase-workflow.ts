import {createSupabaseBrowserClient} from './supabase';
import {intakeRequirements,validateIntake,type Intake} from './intake';
import {validateDocument,type DocumentVersion} from './documents';
import type {Submission,AnalysisEvent} from './intake-repository';
import type {ValidationEntry} from './project-validation';
const client=()=>createSupabaseBrowserClient();
export async function workflowRpc<T>(name:string,args:Record<string,unknown>):Promise<T>{const {data,error}=await client().rpc(name,args);if(error)throw new Error(error.message);return data as T;}
async function rows(table:string,column?:string,id?:string){let q=client().from(table).select('*');if(column&&id)q=q.eq(column,id);const {data,error}=await q;if(error)throw new Error(error.message);return data??[];}
export async function remoteFiles(id:string):Promise<DocumentVersion[]>{const all=await rows('gmb_files','project_id',id);return Promise.all(all.map(async f=>{const {data,error}=await client().storage.from('gmb-documents').download(f.path);if(error)throw new Error(error.message);return {id:f.id,processId:f.project_id,requirementId:f.requirement_id,number:f.number,name:f.name,size:Number(f.size),type:f.mime,at:f.created_at,blob:data!,reviews:[]};}));}
export async function remoteEvents(id:string){const all=await rows('gmb_analysis','submission_id',id);return all.sort((a,b)=>a.sequence-b.sequence).map(r=>r.payload) as (AnalysisEvent|ValidationEntry)[];}
export const supabaseIntakes={
 async list():Promise<Intake[]>{return (await rows('gmb_projects')).map(p=>p.payload).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));},
 async get(id:string):Promise<Intake|undefined>{return (await rows('gmb_projects','id',id))[0]?.payload;},
 save(d:Intake){if(!d.organizationId)throw new Error('Selecione a organização antes de salvar.');return workflowRpc<Intake>('gmb_save',{p_data:d,p_org:d.organizationId});},
 async upload(d:Intake,requirementId:string,file:File){const requirement=intakeRequirements(d).find(r=>r.id===requirementId);if(!requirement)throw new Error('Exigência inválida.');const mime=await validateDocument(file,requirement.format==='cad');const reservation=await workflowRpc<{id:string;path:string}>('gmb_reserve_file',{p_project:d.id,p_version:d.version,p_requirement:requirementId,p_name:file.name,p_mime:mime,p_size:file.size});const {error}=await client().storage.from('gmb-documents').upload(reservation.path,file,{contentType:mime,upsert:false});if(error)throw new Error(error.message);return workflowRpc<Intake>('gmb_finish_file',{p_file:reservation.id,p_version:d.version});},
 async submissions(id:string):Promise<Submission[]>{return (await rows('gmb_submissions','project_id',id)).sort((a,b)=>b.number-a.number).map(s=>s.snapshot);},
 async submit(d:Intake){const issues=validateIntake(d,await remoteFiles(d.id));if(issues.length)throw new Error(issues[0].message);return workflowRpc<Submission>('gmb_submit',{p_project:d.id,p_version:d.version});},
 async events(id:string):Promise<AnalysisEvent[]>{return (await remoteEvents(id)).filter(e=>['Pendência','Conforme','Resposta','Resolvida'].includes(e.kind)) as AnalysisEvent[];},
 addEvent(input:Omit<AnalysisEvent,'id'|'at'>){return workflowRpc<void>('gmb_record',{p_input:input,p_expected:null});},
 async snapshot():Promise<Record<string,unknown[]>>{throw new Error('O backup remoto deve ser realizado pelo administrador no Supabase. A exportação local não inclui dados remotos.');},
};
