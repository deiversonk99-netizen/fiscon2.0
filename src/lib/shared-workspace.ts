import {createSupabaseBrowserClient} from './supabase';
type Row={id:string;blob?:Blob;storagePath?:string;type?:string;[key:string]:unknown};
type Snapshot={version:number;stores:Record<string,Row[]>};
const bucket='gmb-open-documents';
// The transport is independent of identity. RPCs enforce the workspace access policy;
// a future authenticated session uses this same transaction boundary.
function backendError(message:string){return new Error(`Não foi possível acessar o armazenamento compartilhado. Confira o SQL 03 e a conexão. ${message}`);}
export async function sharedTransaction<T>(names:string[],mode:IDBTransactionMode,action:(tx:IDBTransaction,done:(v:T)=>void,fail:(e:Error)=>void)=>void,client=createSupabaseBrowserClient()):Promise<T>{
 const response=await client.rpc('gmb_open_read',{p_stores:names});
 if(response.error)throw backendError(response.error.message);
 const snapshot=response.data as Snapshot;
 for(const name of names)for(const row of snapshot.stores[name]??[]){if(name==='versions'&&row.storagePath){const download=await client.storage.from(bucket).download(row.storagePath);if(download.error)throw backendError(download.error.message);row.blob=download.data;}}
 // Isolated temporary database supplies the same atomic IDB semantics as local mode.
 // It is never the user's persistent database, nor a fallback after a network failure.
 const name=`gmb-transaction-${crypto.randomUUID()}`;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{for(const n of names){const store=r.result.createObjectStore(n,{keyPath:'id'});if(n==='versions')store.createIndex('processId','processId');}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{
 await new Promise<void>((resolve,reject)=>{const tx=db.transaction(names,'readwrite');for(const n of names)for(const row of snapshot.stores[n]??[])tx.objectStore(n).add(row);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});
 const result=await new Promise<T>((resolve,reject)=>{const tx=db.transaction(names,mode);let value:T;let error:Error|undefined;tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(error??tx.error??new Error('Falha na transação.'));try{action(tx,v=>{value=v;},e=>{error=e;tx.abort();});}catch(e){error=e as Error;tx.abort();}});
 if(mode==='readwrite'){
 const stores=await new Promise<Record<string,Row[]>>((resolve,reject)=>{const tx=db.transaction(names,'readonly');const rows:Record<string,Row[]>={};for(const n of names){const r=tx.objectStore(n).getAll();r.onsuccess=()=>{rows[n]=r.result;};}tx.oncomplete=()=>resolve(rows);tx.onabort=()=>reject(tx.error);});
 for(const row of stores.versions??[]){if(row.blob&&!row.storagePath){const path=`files/${crypto.randomUUID()}`;const uploaded=await client.storage.from(bucket).upload(path,row.blob,{contentType:row.type,upsert:false});if(uploaded.error)throw backendError(uploaded.error.message);row.storagePath=path;}delete row.blob;}
 const saved=await client.rpc('gmb_open_write',{p_expected:snapshot.version,p_stores:stores});
 if(saved.error){if(saved.error.message.includes('conflito'))throw new Error('Os dados mudaram em outra aba ou computador. Atualize antes de continuar; suas alterações não foram sobrescritas.');throw backendError(saved.error.message);}
 }
 return result;
 }finally{db.close();indexedDB.deleteDatabase(name);}
}
