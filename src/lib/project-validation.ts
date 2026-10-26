import {dataMode} from './supabase';
import {remoteEvents,workflowRpc} from './supabase-workflow';
import {intakeRequirements,validateIntake} from './intake';
import type {Submission,AnalysisEvent} from './intake-repository';
import {dbTransaction} from './document-db';

export type Verdict='Conforme'|'Não conforme'|'Não se aplica';
export type Decision='Solicitar correções'|'Concluir análise local'|'Reabrir análise';
export interface ValidationEntry {id:string;submissionId:string;at:string;kind:'Validação'|'Decisão';item:string;comment:string;reviewer:string;verdict?:Verdict;decision?:Decision}
export interface Criterion {id:string;title:string;group:string;allowNA:boolean}
export function criteria(s:Submission):Criterion[]{return [
 ...intakeRequirements(s.data).map(r=>({id:`doc:${r.id}`,title:r.title,group:'Documentação: autenticidade aparente, legibilidade, titularidade e revisão',allowNA:false})),
 ...['Implantação, divisas e recuos','Plantas, cortes, fachadas e cobertura','Acessos e implantação no terreno','Compatibilidade entre disciplinas e ART/RRT','Correspondência entre pranchas, áreas e cadastro'].map((title,i)=>({id:`technical:${i}`,title,group:'Conferência técnica manual',allowNA:i===3})),
 ...s.results.map((r,i)=>({id:`calculation:${i}`,title:`${r.label} — ${r.detail}`,group:'Parâmetros: conferir no desenho e justificar com a referência aplicável',allowNA:false})),
 ];}
export function validationState(s:Submission,entries:ValidationEntry[],events:AnalysisEvent[]){
 const checks=criteria(s);const own=entries.filter(e=>e.submissionId===s.id).sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
 const latest=new Map<string,ValidationEntry>();for(const e of own)if(e.kind==='Validação')latest.set(e.item,e);
 const missing=checks.filter(c=>!latest.has(c.id));const failed=checks.filter(c=>latest.get(c.id)?.verdict==='Não conforme');
 const open=events.filter(e=>e.submissionId===s.id&&e.kind==='Pendência'&&!events.some(x=>x.submissionId===s.id&&x.kind==='Resolvida'&&x.parentId===e.id));
 const last=own.filter(e=>e.kind==='Decisão').at(-1);const closed=last?.decision==='Concluir análise local';
 const intakeIssues=validateIntake(s.data,s.files);
 return {checks,latest,missing,failed,open,closed,last,intakeIssues,canConclude:intakeIssues.length===0&&missing.length===0&&failed.length===0&&open.length===0};
}
export async function validationEntries(id:string){if(dataMode==='supabase')return (await remoteEvents(id)).filter(e=>['Validação','Decisão'].includes(e.kind)) as ValidationEntry[];return dbTransaction<ValidationEntry[]>(['analysis'],'readonly',(tx,done)=>{const r=tx.objectStore('analysis').getAll();r.onsuccess=()=>done(r.result.filter((e:ValidationEntry)=>e.submissionId===id&&(e.kind==='Validação'||e.kind==='Decisão')).sort((a:ValidationEntry,b:ValidationEntry)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id)));});}
export function recordValidation(input:Omit<ValidationEntry,'id'|'at'>,expectedCount:number){
 if(dataMode==='supabase')return workflowRpc<void>('gmb_record',{p_input:input,p_expected:expectedCount});
 return dbTransaction<void>(['analysis','submissions'],'readwrite',(tx,done,fail)=>{
 const s=tx.objectStore('submissions').get(input.submissionId);s.onsuccess=()=>{
 if(!s.result){fail(new Error('Entrega não encontrada.'));return;}
 const store=tx.objectStore('analysis');const all=store.getAll();all.onsuccess=()=>{
 const rows=all.result.filter((e:ValidationEntry)=>e.submissionId===input.submissionId);
 if(rows.length!==expectedCount){fail(new Error('A análise mudou em outra aba. Atualize a conferência antes de continuar.'));return;}
 if(!input.reviewer.trim()||input.comment.trim().length<10){fail(new Error('Informe o responsável e uma evidência ou justificativa com pelo menos 10 caracteres.'));return;}
 const state=validationState(s.result,rows,rows);
 if(input.kind==='Validação'){
 const c=state.checks.find(c=>c.id===input.item);
 if(state.closed||!c||!['Conforme','Não conforme','Não se aplica'].includes(input.verdict??'')||(input.verdict==='Não se aplica'&&!c.allowNA)){fail(new Error('Critério ou conclusão inválida. Reabra uma análise concluída para alterá-la.'));return;}
 }else if(input.kind==='Decisão'){
 if(input.decision==='Concluir análise local'&&(!state.canConclude||state.closed)){fail(new Error('Conclua todos os critérios e resolva as pendências antes de encerrar a análise.'));return;}
 if(input.decision==='Solicitar correções'&&(state.closed||(!state.failed.length&&!state.open.length))){fail(new Error('Registre uma não conformidade ou pendência antes de solicitar correções.'));return;}
 if(input.decision==='Reabrir análise'&&!state.closed){fail(new Error('A análise já está aberta.'));return;}
 if(!['Concluir análise local','Solicitar correções','Reabrir análise'].includes(input.decision??'')){fail(new Error('Decisão inválida.'));return;}
 }else{fail(new Error('Registro inválido.'));return;}
 // Monotonic timestamps preserve audit order even for actions within one millisecond.
 const at=new Date(Math.max(Date.now(),...rows.map((e:ValidationEntry)=>Date.parse(e.at)+1))).toISOString();
 store.add({...input,id:crypto.randomUUID(),at});done();
 };};});
}
