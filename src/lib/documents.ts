import type {Process} from './domain';
export type ReviewStatus='A conferir'|'Conforme'|'Correção necessária';
export interface DocumentVersion {id:string;processId:string;requirementId:string;number:number;name:string;size:number;type:string;at:string;blob:Blob;reviews:DocumentReview[]}
export interface DocumentReview {id:string;at:string;status:ReviewStatus;comment:string}
export interface Requirement {id:string;title:string;description:string}
export const MAX_FILE_SIZE=20*1024*1024;
export function requirementsFor(process:Pick<Process,'disciplines'>):Requirement[]{return [
 {id:'ownership',title:'Identificação e vínculo com o lote',description:'Documentação do proprietário e comprovação do vínculo.'},
 ...process.disciplines.includes('Arquitetônico')?[{id:'architecture',title:'Projeto arquitetônico',description:'Pranchas em PDF para conferência.'}]:[],
 {id:'responsibility',title:'Responsabilidade técnica',description:'ART ou RRT, conforme exigência a validar.'},
 ...process.disciplines.includes('Estrutural')?[{id:'structure',title:'Projeto estrutural',description:'Projeto da disciplina estrutural em PDF.'}]:[],
 ];}
export async function validateDocument(file:File,allowCad=false){
 if(!file.size)throw new Error('O arquivo está vazio.');
 if(file.size>MAX_FILE_SIZE)throw new Error('O limite é de 20 MB por arquivo.');
 const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
 const head=new TextDecoder().decode(await file.slice(0,2048).arrayBuffer());
 const extension=file.name.split('.').pop()?.toLowerCase();
 if(allowCad&&extension==='dwg'&&/^AC10\d{2}/.test(head))return 'application/acad';
 if(allowCad&&extension==='dxf'&&(/AutoCAD Binary DXF/.test(head)||/\bSECTION\b/.test(head)))return 'image/vnd.dxf';
 const pdf=bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70&&bytes[4]===45;
 const png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const ext=file.name.split('.').pop()?.toLowerCase();
 if(!((pdf&&ext==='pdf')||(png&&ext==='png')||(jpg&&['jpg','jpeg'].includes(ext??''))))throw new Error('Selecione um PDF, PNG ou JPEG válido.');
 return pdf?'application/pdf':png?'image/png':'image/jpeg';
}
export function validateReview(status:ReviewStatus,comment:string){
 if(!['A conferir','Conforme','Correção necessária'].includes(status))throw new Error('Situação inválida.');
 if(status==='Correção necessária'&&!comment.trim())throw new Error('Descreva o que precisa ser corrigido.');
 if(comment.length>4000)throw new Error('Use até 4.000 caracteres na observação.');
}
export function latestStatus(version?:DocumentVersion):ReviewStatus| 'Não enviado'{return version?version.reviews.at(-1)?.status??'A conferir':'Não enviado';}
export interface DocumentRepository {
 list(processId:string):Promise<DocumentVersion[]>;
 upload(processId:string,requirementId:string,file:File):Promise<void>;
 review(id:string,expectedReviews:number,status:ReviewStatus,comment:string):Promise<void>;
}
