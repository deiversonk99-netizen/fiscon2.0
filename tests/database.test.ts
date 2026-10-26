import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {singleChange} from '../src/lib/changes';
import {createDemoData} from '../src/lib/domain';
test('alterações isoladas preservam versão e recusam exclusões',()=>{
 const a=createDemoData();a.development.version=3;const b=structuredClone(a);b.development.name='Novo';assert.equal(singleChange(a,b).version,3);
 b.lots.pop();assert.throws(()=>singleChange(a,b));
});
test('PostgreSQL: migração, isolamento, permissões e concorrência',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 await db.exec(readFileSync('supabase/migrations/202610200001_portal_base.sql','utf8'));
 const org='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',user='00000000-0000-0000-0000-000000000003',dev='00000000-0000-0000-0000-000000000004',lot='00000000-0000-0000-0000-000000000005',process='00000000-0000-0000-0000-000000000006';
 await db.query(`insert into auth.users values ($1)`,[user]);
 await db.query(`insert into portal_organizations(id,name) values ($1,'A'),($2,'B')`,[org,other]);
 await db.query(`insert into portal_members values ($1,$2,'admin')`,[org,user]);
 await db.query(`insert into portal_developments(id,organization_id,payload) values($1,$2,$3)`,[dev,org,JSON.stringify({name:'Teste',city:'Cidade',state:'MG',address:''})]);
 await db.exec('set role authenticated');await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[user]);
 assert.equal((await db.query('select id,name from portal_organizations')).rows.length,1);
 await assert.rejects(db.query(`insert into portal_members values($1,$2,'admin')`,[other,user]),(e:any)=>e.code==='42501');
 const entity={id:lot,block:'01',number:'01',area:420,owner:{name:'Nome',email:'',phone:''}};
 const save=(kind:string,e:unknown,version:number|null=null,o=org)=>db.query('select portal_save($1,$2,$3,$4,$5)',[o,dev,kind,JSON.stringify(e),version]);
 await assert.rejects(save('lot',entity,null,other),(e:any)=>e.code==='42501');
 await save('lot',entity);await save('lot',{...entity,area:450},1);
 await assert.rejects(save('lot',entity,1),(e:any)=>e.code==='40001');
 await assert.rejects(save('lot',{...entity,id:crypto.randomUUID()}),(e:any)=>e.code==='23505');
 await assert.rejects(save('lot',{...entity,id:crypto.randomUUID(),number:'02',area:-1}),(e:any)=>e.code==='23514');
 await save('process',{id:process,lotId:lot,title:'Casa',kind:'Construção',disciplines:['Arquitetônico'],professional:{name:'Arquiteto',email:'a@example.com',phone:'',registration:'CAU'},status:'Aprovado',code:'FALSO',history:[{title:'Falso'}]});
 const rows=await db.query<{status:string;code:string}>('select status,code from portal_processes');assert.equal(rows.rows[0].status,'Rascunho');assert.equal(rows.rows[0].code,'PR-000001');
 await assert.rejects(db.exec(`update portal_processes set status='Aprovado'`),(e:any)=>e.code==='42501');
 assert.equal((await db.query('select * from portal_events where process_id is not null')).rows.length,1);
 await db.exec('reset role');await db.query(`update portal_members set role='professional' where user_id=$1`,[user]);await db.exec('set role authenticated');
 assert.equal((await db.query('select * from portal_lots')).rows.length,0);
 await assert.rejects(save('lot',entity,2),(e:any)=>e.code==='42501');
 }finally{await db.close();}
});
