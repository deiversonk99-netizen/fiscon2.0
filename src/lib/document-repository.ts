import {validateDocument,validateReview,type DocumentRepository,type DocumentVersion} from './documents';
import {dbTransaction} from './document-db';
async function transaction<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore,done:(value:T)=>void,fail:(error:Error)=>void)=>void):Promise<T>{return dbTransaction<T>(['versions'],mode,(tx,done,fail)=>action(tx.objectStore('versions'),done,fail));}
export const localDocuments:DocumentRepository={
 list(processId){return transaction('readonly',(store,done)=>{const req=store.index('processId').getAll(processId);req.onsuccess=()=>done((req.result as DocumentVersion[]).sort((a,b)=>b.number-a.number));});},
 async upload(processId,requirementId,file){const type=await validateDocument(file);const id=crypto.randomUUID();
 await transaction<void>('readwrite',(store,done)=>{const req=store.index('processId').getAll(processId);req.onsuccess=()=>{const previous=(req.result as DocumentVersion[]).filter(v=>v.requirementId===requirementId);store.add({id,processId,requirementId,number:Math.max(0,...previous.map(v=>v.number))+1,name:file.name,size:file.size,type,at:new Date().toISOString(),blob:file,reviews:[]} satisfies DocumentVersion);done();};});
 },
 async review(id,expectedReviews,status,comment){validateReview(status,comment);await transaction<void>('readwrite',(store,done,fail)=>{const req=store.get(id);req.onsuccess=()=>{const v=req.result as DocumentVersion|undefined;if(!v||v.reviews.length!==expectedReviews){fail(new Error('A conferência mudou em outra aba. Atualize os documentos antes de tentar novamente.'));return;}store.put({...v,reviews:[...v.reviews,{id:crypto.randomUUID(),at:new Date().toISOString(),status,comment:comment.trim()}]});done();};});},
};
