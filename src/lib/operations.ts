import type {Intake} from './intake';
import type {Submission,AnalysisEvent} from './intake-repository';
import {validationState,type ValidationEntry} from './project-validation';
import type {DocumentVersion} from './documents';
import {dbTransaction} from './document-db';

export const VISIT_ITEMS=['Implantação e divisas','Recuos e ocupação','Áreas e volumetria','Compatibilidade com o projeto aprovado','Condições e organização da obra'];
export type VisitType='Inicial'|'Intermediária'|'Final';
export type VisitItem={id:string;title:string;result:''|'Conforme'|'Não conforme'|'Não se aplica';note:string;photos:string[]};
export type Visit={id:string;type:VisitType;scheduled:string;inspector:string;status:'Agendada'|'Realizada'|'Cancelada';items:VisitItem[];notes:string;at?:string;submissionId:string};
export type Resolution={visitId:string;itemId:string;note:string;actor:string;at:string};
export type IssuedDocument={id:string;number:string;type:string;at:string;actor:string;reference:string;submissionId:string;project:Intake;details:string[];voidReason?:string;voidAt?:string};
export type Operation={id:string;version:number;approval?:{submissionId:string;actor:string;reference:string;at:string};permit?:{fileId:string;number:string;expires:string;actor:string;at:string};authorized?:{at:string;actor:string};visits:Visit[];resolutions:Resolution[];documents:IssuedDocument[];history:{id:string;at:string;actor:string;text:string}[]};
export const emptyOperation=(id:string):Operation=>({id,version:0,visits:[],resolutions:[],documents:[],history:[]});
export type OperationContext={draft:Intake;submissions:Submission[];analysis:(AnalysisEvent|ValidationEntry)[];files:DocumentVersion[]};
export type OperationAction=
 |{type:'approve';actor:string;reference:string}
 |{type:'permit';actor:string;fileId:string;number:string;expires:string}
 |{type:'authorize';actor:string}
 |{type:'schedule';actor:string;visitType:VisitType;scheduled:string}
 |{type:'visit'|'visitDraft';actor:string;visit:Visit}
 |{type:'cancelVisit';actor:string;id:string;reason:string}
 |{type:'resolve';actor:string;visitId:string;itemId:string;note:string}
 |{type:'certificate';actor:string;reference:string}
 |{type:'revoke';actor:string;reason:string}
 |{type:'report';actor:string};
export function currentSubmission(c:OperationContext){return [...c.submissions].sort((a,b)=>b.number-a.number)[0];}
export function currentApproval(o:Operation,c:OperationContext){const s=currentSubmission(c);return Boolean(s&&o.approval?.submissionId===s.id&&validationState(s,c.analysis as ValidationEntry[],c.analysis as AnalysisEvent[]).closed);}
export function openFindings(o:Operation){return o.visits.filter(v=>v.status==='Realizada').flatMap(v=>v.items.filter(i=>i.result==='Não conforme'&&!o.resolutions.some(r=>r.visitId===v.id&&r.itemId===i.id)).map(i=>({visit:v,item:i})));}
export function operationStatus(o:Operation,c:OperationContext){if(o.documents.some(d=>d.type==='Certificado Final de Conformidade'&&!d.voidAt)&&currentApproval(o,c))return 'Concluído';if(o.approval&&!currentApproval(o,c))return 'Revisão exige nova aprovação';if(o.authorized)return openFindings(o).length?'Obra com pendências':'Em obra';if(o.approval)return o.permit?'Aguardando autorização':'Aguardando alvará';const s=currentSubmission(c);if(!s)return 'Rascunho';const a=validationState(s,c.analysis as ValidationEntry[],c.analysis as AnalysisEvent[]);return a.closed?'Análise concluída':a.open.length||a.failed.length?'Aguardando correções':'Em análise';}
function requireText(v:string,label:string){if(!v?.trim())throw new Error(`Informe ${label}.`);}
function validDate(s:string){return Number.isFinite(Date.parse(s));}
export function applyOperation(previous:Operation,a:OperationAction,c:OperationContext,now=new Date().toISOString()):Operation{
 requireText(a.actor,'o responsável pelo registro');const o=structuredClone(previous);const s=currentSubmission(c);
 if(!s)throw new Error('Registre uma entrega do projeto antes de iniciar este fluxo.');
 const issue=(type:string,reference:string,details:string[])=>{const doc:IssuedDocument={id:crypto.randomUUID(),number:`GMB-${c.draft.id.slice(0,8).toUpperCase()}-${String(o.documents.length+1).padStart(3,'0')}`,type,at:now,actor:a.actor.trim(),reference,submissionId:s.id,project:structuredClone(s.data),details};o.documents.push(doc);};
 const voidDocs=(reason:string)=>o.documents.forEach(d=>{if(!d.voidAt){d.voidAt=now;d.voidReason=reason;}});
 const ensureApproved=()=>{if(!currentApproval(o,c))throw new Error('Conclua a análise e registre a aprovação da revisão atual.');};
 const ensureWork=()=>{ensureApproved();if(!o.authorized)throw new Error('Registre a autorização para construção.');if(o.permit?.expires&&o.permit.expires<now.slice(0,10))throw new Error('Alvará vencido. Confira um documento válido.');};
 if(o.documents.some(d=>d.type==='Certificado Final de Conformidade'&&!d.voidAt)&&!['revoke','report','approve'].includes(a.type))throw new Error('Obra encerrada. Revogue o certificado antes de alterar o processo.');
 let message='';
 switch(a.type){
 case 'approve':{
 const state=validationState(s,c.analysis as ValidationEntry[],c.analysis as AnalysisEvent[]);
 if(!state.closed||!state.canConclude)throw new Error('A análise deve estar concluída, sem critérios ou pendências abertos.');
 requireText(a.reference,'a referência do Código Interno e o registro profissional');
 if(currentApproval(o,c))throw new Error('Esta revisão já tem aprovação registrada.');
 voidDocs('Substituído por aprovação de nova revisão.');o.permit=undefined;o.authorized=undefined;
 o.approval={submissionId:s.id,actor:a.actor,reference:a.reference,at:now};
 issue('Termo de Aprovação Inicial',a.reference,[`Revisão analisada: ${s.protocol}`,`Referência técnica: ${a.reference}`]);message='Aprovação interna registrada';break;}
 case 'permit':
 ensureApproved();requireText(a.number,'o número do alvará');if(!validDate(a.expires)||a.expires<now.slice(0,10))throw new Error('Informe a validade vigente do alvará.');
 if(!c.files.some(f=>f.id===a.fileId&&f.processId===o.id&&f.type==='application/pdf'&&f.requirementId==='construction-permit'))throw new Error('Anexe o alvará em PDF deste projeto.');
 o.permit={fileId:a.fileId,number:a.number,expires:a.expires,actor:a.actor,at:now};message='Alvará conferido';break;
 case 'authorize':
 ensureApproved();if(o.authorized)throw new Error('Obra já autorizada.');if(!o.permit||o.permit.expires<now.slice(0,10))throw new Error('Confira um alvará válido antes de autorizar.');
 o.authorized={at:now,actor:a.actor};issue('Termo de Autorização para Construção',o.permit.number,[`Alvará: ${o.permit.number}`,`Validade: ${o.permit.expires}`,`Aprovação: ${s.protocol}`]);message='Autorização para construção registrada';break;
 case 'schedule':
 ensureWork();if(!['Inicial','Intermediária','Final'].includes(a.visitType)||!validDate(a.scheduled))throw new Error('Tipo ou data da vistoria inválidos.');
 o.visits.push({id:crypto.randomUUID(),type:a.visitType,scheduled:a.scheduled,inspector:a.actor,status:'Agendada',items:VISIT_ITEMS.map(title=>({id:crypto.randomUUID(),title,result:'',note:'',photos:[]})),notes:'',submissionId:s.id});message=`Vistoria ${a.visitType.toLowerCase()} agendada`;break;
 case 'visitDraft':
 case 'visit':{
 ensureWork();const i=o.visits.findIndex(v=>v.id===a.visit.id);const original=o.visits[i];
 if(!original||original.status!=='Agendada'||original.submissionId!==s.id)throw new Error('Agendamento indisponível para esta revisão.');
 if(a.type==='visit'&&original.scheduled>now)throw new Error('A vistoria não pode ser concluída antes da data agendada.');
 if(a.type==='visitDraft'){
 const items=original.items.map(item=>{const changed=a.visit.items.find(v=>v.id===item.id);if(!changed)throw new Error('Checklist incompleto.');for(const photo of changed.photos)if(!c.files.some(f=>f.id===photo&&f.processId===o.id&&f.requirementId===`visit:${original.id}:${item.id}`))throw new Error('Foto não pertence ao item.');return {...item,result:changed.result,note:changed.note,photos:changed.photos};});o.visits[i]={...original,items,notes:a.visit.notes};message='Preenchimento da vistoria salvo';break;}
 if(a.visit.items.length!==original.items.length)throw new Error('Checklist incompleto.');
 for(const item of original.items){const changed=a.visit.items.find(v=>v.id===item.id);if(!changed||!['Conforme','Não conforme','Não se aplica'].includes(changed.result))throw new Error('Conclua todos os itens do checklist.');if(changed.result!=='Conforme'&&changed.note.trim().length<10)throw new Error('Justifique os itens não conformes ou não aplicáveis.');if(!changed.photos.length&&changed.result!=='Não se aplica')throw new Error('Vincule uma foto por item inspecionado.');for(const photo of changed.photos)if(!c.files.some(f=>f.id===photo&&f.processId===o.id&&f.requirementId===`visit:${original.id}:${item.id}`&&['image/png','image/jpeg'].includes(f.type)))throw new Error('Foto não pertence ao item inspecionado.');}
 if(original.type!=='Inicial'&&!o.visits.some(v=>v.type==='Inicial'&&v.status==='Realizada'&&v.submissionId===s.id))throw new Error('Conclua a vistoria inicial desta revisão primeiro.');
 if(original.type==='Final'&&openFindings(o).length)throw new Error('Resolva as não conformidades anteriores antes da vistoria final.');
 const visit:Visit={...original,items:original.items.map(item=>({...a.visit.items.find(v=>v.id===item.id)!,title:item.title})),notes:a.visit.notes,status:'Realizada',inspector:a.actor,at:now};o.visits[i]=visit;
 issue('Relatório de Vistoria',visit.id,[`Tipo: ${visit.type}`,`Agendamento: ${visit.scheduled}`,`Observações: ${visit.notes}`,...visit.items.map(item=>`${item.title}: ${item.result}. ${item.note} Fotos: ${item.photos.join(', ')}`)]);message=`Vistoria ${original.type.toLowerCase()} realizada`;break;}
 case 'cancelVisit':{const v=o.visits.find(v=>v.id===a.id);if(!v||v.status!=='Agendada')throw new Error('Somente agendamentos podem ser cancelados.');requireText(a.reason,'o motivo');v.status='Cancelada';v.notes=a.reason;message='Agendamento cancelado: '+a.reason;break;}
 case 'resolve':
 ensureWork();if(a.note.trim().length<10)throw new Error('Descreva a evidência da correção com pelo menos 10 caracteres.');if(!openFindings(o).some(f=>f.visit.id===a.visitId&&f.item.id===a.itemId))throw new Error('Não conformidade já resolvida ou inexistente.');o.resolutions.push({visitId:a.visitId,itemId:a.itemId,note:a.note,actor:a.actor,at:now});message='Correção de obra verificada: '+a.note;break;
 case 'certificate':
 ensureWork();requireText(a.reference,'a referência e o registro profissional');if(o.documents.some(d=>d.type==='Certificado Final de Conformidade'&&!d.voidAt))throw new Error('Certificado já emitido. Revogue para retificar.');
 if(openFindings(o).length||!o.visits.some(v=>v.type==='Final'&&v.status==='Realizada'&&v.submissionId===s.id)||o.visits.some(v=>v.status==='Agendada'))throw new Error('Conclua a vistoria final, resolva pendências e encerre os agendamentos.');
 issue('Certificado Final de Conformidade',a.reference,[`Projeto: ${s.protocol}`,`Alvará: ${o.permit!.number}`,`${o.visits.filter(v=>v.status==='Realizada').length} vistorias registradas`,`Referência: ${a.reference}`]);message='Certificado gerado para assinatura';break;
 case 'revoke':
 requireText(a.reason,'a justificativa de revogação');voidDocs(a.reason);o.approval=undefined;o.permit=undefined;o.authorized=undefined;message='Aprovação e documentos revogados: '+a.reason;break;
 case 'report':
 issue('Parecer Técnico',s.protocol,c.analysis.filter(e=>e.submissionId===s.id).map(e=>`${e.kind} — ${e.item}: ${e.comment}`));message='Parecer técnico gerado';break;
 }
 o.version++;o.history.push({id:crypto.randomUUID(),at:now,actor:a.actor.trim(),text:message});return o;
}
export const operationsRepository={
 list(){return dbTransaction<Operation[]>(['operations'],'readonly',(tx,done)=>{const r=tx.objectStore('operations').getAll();r.onsuccess=()=>done(r.result);});},
 async act(id:string,version:number,action:OperationAction){return dbTransaction<Operation>(['operations','intakes','submissions','analysis','versions'],'readwrite',(tx,done,fail)=>{
 const names=['operations','intakes','submissions','analysis','versions'] as const;const rows:Record<string,unknown[]>={};let count=0;
 for(const name of names){const r=tx.objectStore(name).getAll();r.onsuccess=()=>{rows[name]=r.result;if(++count!==names.length)return;try{const draft=(rows.intakes as Intake[]).find(d=>d.id===id);if(!draft)throw new Error('Projeto não encontrado.');const previous=(rows.operations as Operation[]).find(o=>o.id===id)??emptyOperation(id);if(previous.version!==version)throw new Error('A obra mudou em outra aba. Atualize antes de continuar.');const next=applyOperation(previous,action,{draft,submissions:(rows.submissions as Submission[]).filter(s=>s.intakeId===id),analysis:rows.analysis as (AnalysisEvent|ValidationEntry)[],files:(rows.versions as DocumentVersion[]).filter(f=>f.processId===id)});tx.objectStore('operations').put(next);done(next);}catch(e){fail(e as Error);}};}
 });},
};
