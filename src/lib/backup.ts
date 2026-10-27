import {dbTransaction} from './document-db';
import {validateDocument} from './documents';
import {parseStoredData,STORAGE_KEY} from './domain';
export async function restoreBackup(file:File){
 if(file.size>256*1024*1024)throw new Error('O backup excede 256 MB.');
 const data=JSON.parse(await file.text());if(data.format!=='gmbim-backup-v1')throw new Error('Formato de backup não reconhecido.');
 const names=['intakes','versions','submissions','analysis','operations'];
 for(const name of names){data[name]??=[];if(!Array.isArray(data[name])||data[name].some((r:Record<string,unknown>)=>!r||typeof r.id!=='string')||new Set(data[name].map((r:{id:string})=>r.id)).size!==data[name].length)throw new Error(`Lista inválida: ${name}.`);}
 const ids=new Set(data.intakes.map((r:{id:string})=>r.id));
 for(const d of data.intakes){if(d.schemaVersion!==1||typeof d.title!=='string'||!Number.isInteger(d.version)||['owners','properties','technicians','floors','surfaces','roofs','rooms','sheets','checks','verifiedFiles'].some(k=>!Array.isArray(d[k])))throw new Error('Cadastro inválido no backup.');}
 for(const s of data.submissions)if(!ids.has(s.intakeId)||!s.data||!Array.isArray(s.files)||!Array.isArray(s.results))throw new Error('Entrega sem projeto no backup.');
 const submissions=new Set(data.submissions.map((s:{id:string})=>s.id));
 for(const e of data.analysis)if(!submissions.has(e.submissionId)||typeof e.kind!=='string'||typeof e.comment!=='string')throw new Error('Análise inválida no backup.');
 for(const o of data.operations)if(!ids.has(o.id)||!Number.isInteger(o.version)||['visits','resolutions','documents','history'].some(k=>!Array.isArray(o[k])))throw new Error('Registro de obra inválido.');
 const portal=data.portalData?parseStoredData(data.portalData):null;
 for(const f of data.versions){if(typeof f.contentBase64!=='string'||typeof f.processId!=='string'||typeof f.requirementId!=='string'||typeof f.name!=='string')throw new Error('Anexo inválido.');const bytes=Uint8Array.from(atob(f.contentBase64),c=>c.charCodeAt(0));const blob=new File([bytes],f.name,{type:f.type});if(blob.size!==f.size||await validateDocument(blob,true)!==f.type)throw new Error('Anexo incompatível ou corrompido.');f.blob=blob;delete f.contentBase64;delete f.storagePath;}
 // Never replace an existing identifier. A failed import leaves all current records intact.
 await dbTransaction<void>(names,'readwrite',(tx,done,fail)=>{let pending=names.length;for(const name of names){const request=tx.objectStore(name).getAllKeys();request.onsuccess=()=>{if(data[name].some((r:{id:string})=>request.result.includes(r.id))){fail(new Error('Este backup contém registros que já existem neste navegador. Restaure em outro navegador para não sobrescrever dados.'));return;}if(--pending===0){for(const store of names)for(const row of data[store])tx.objectStore(store).add(row);done();}};}});
 if(portal&&!localStorage.getItem(STORAGE_KEY))localStorage.setItem(STORAGE_KEY,JSON.stringify(portal));
 return data.intakes.length;
}
