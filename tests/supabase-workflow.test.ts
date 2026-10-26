import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {newIntake,intakeRequirements,CHECKS} from '../src/lib/intake';
import {criteria} from '../src/lib/project-validation';
import type {Submission} from '../src/lib/intake-repository';
test('Supabase workflow: SQL, isolamento, arquivos, entrega e permissões técnicas',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
 await db.exec(readFileSync('supabase/migrations/202610200001_portal_base.sql','utf8'));const migration=readFileSync('supabase/migrations/202610260001_project_workflow.sql','utf8');try{await db.exec(migration);}catch(e:any){throw new Error(e.message+' near '+migration.slice(Number(e.position)-160,Number(e.position)+160));}
 const org=crypto.randomUUID(),otherOrg=crypto.randomUUID(),pro=crypto.randomUUID(),admin=crypto.randomUUID(),other=crypto.randomUUID();
 await db.query('insert into auth.users values($1),($2),($3)',[pro,admin,other]);await db.query("insert into portal_organizations(id,name) values($1,'A'),($2,'B')",[org,otherOrg]);await db.query("insert into portal_members values($1,$2,'professional'),($1,$3,'admin'),($4,$5,'professional')",[org,pro,admin,otherOrg,other]);
 const login=async(id:string)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};await login(pro);
  let d=newIntake();d.title='Casa teste';Object.assign(d.owners[0],{name:'Teste',document:'52998224725',phone:'11999999999',email:'teste@example.com',street:'Rua',number:'1',neighborhood:'Centro',zip:'12345678',state:'MG',city:'Teste'});Object.assign(d.properties[0],{registry:'123',registration:'456',block:'1',lot:'1',street:'Rua'});Object.assign(d.technicians[0],{name:'Teste',document:'52998224725',registration:'CAU',art:'TEST',email:'teste@example.com',phone:'11999999999'});d.landArea='500';d.declaredArea='250';Object.assign(d.floors[0],{area:'250',base:'0',top:'3'});d.surfaces=[{id:'s',name:'Jardim',area:'100',factor:'1',active:true}];d.roofs=[{id:'r',name:'Cobertura',level:'3',active:true}];d.justification='Conferência manual das regras demonstrativas.';d.checks=CHECKS.map(()=>true);d.declared=true;d.finalConfirmed=true;
 const files=intakeRequirements(d).map(r=>({id:crypto.randomUUID(),processId:d.id,requirementId:r.id,number:1,name:'teste.pdf',size:100,type:'application/pdf',at:new Date().toISOString(),reviews:[]}));d.verifiedFiles=files.map(f=>f.id);

 const save=async()=>{const r=await db.query<{result:typeof d}>('select gmb_save($1,$2) result',[JSON.stringify(d),org]);d=r.rows[0].result;};await save();
 await assert.rejects(db.query('select gmb_save($1,$2)',[JSON.stringify({...d,version:null}),org]));
 await assert.rejects(db.query('select gmb_save($1,$2)',[JSON.stringify({...d,id:crypto.randomUUID(),version:0}),otherOrg]));
 await assert.rejects(db.query('update gmb_projects set version=9'));
 const uploaded:string[]=[];
 for(const req of intakeRequirements(d)){
 const reserve=await db.query<{f:{id:string;path:string}}>('select gmb_reserve_file($1,$2,$3,$4,$5,$6) f',[d.id,d.version,req.id,'teste.pdf','application/pdf',100]);const f=reserve.rows[0].f;
 await db.query("insert into storage.objects(bucket_id,name,metadata) values('gmb-documents',$1,$2)",[f.path,JSON.stringify({size:100,mimetype:'application/pdf'})]);
 const finish=await db.query<{d:typeof d}>('select gmb_finish_file($1,$2) d',[f.id,d.version]);d=finish.rows[0].d;uploaded.push(f.id);
 }
 await assert.rejects(db.exec("insert into storage.objects(bucket_id,name,metadata) values('gmb-documents','unauthorized','{}')"));
 d.checks=CHECKS.map(()=>true);d.declared=true;d.finalConfirmed=true;d.verifiedFiles=uploaded;await save();
 const result=await db.query<{s:Submission}>('select gmb_submit($1,$2) s',[d.id,d.version]);const sub=result.rows[0].s;
 assert.equal((await db.query<{s:Submission}>('select gmb_submit($1,$2) s',[d.id,d.version])).rows[0].s.id,sub.id);
 const action=(input:object,count:number)=>db.query('select gmb_record($1,$2)',[JSON.stringify({submissionId:sub.id,comment:'Conferido na referência técnica aplicável.',...input}),count]);
 await assert.rejects(action({kind:'Validação',item:criteria(sub)[0].id,verdict:'Conforme'},0));
 await login(other);assert.equal((await db.query('select * from gmb_projects')).rows.length,0);assert.equal((await db.query('select * from storage.objects')).rows.length,0);await assert.rejects(db.query('select gmb_submit($1,$2)',[d.id,d.version]));
 await login(admin);await assert.rejects(action({kind:'Decisão',item:'Decisão',decision:'Concluir análise local'},0));let count=0;
 for(const c of criteria(sub))await action({kind:'Validação',item:c.id,verdict:'Conforme'},count++);
 await assert.rejects(action({kind:'Decisão',item:'Decisão',decision:'Concluir análise local'},count-1));
 await action({kind:'Decisão',item:'Decisão',decision:'Concluir análise local'},count++);
 await assert.rejects(action({kind:'Pendência',item:'Novo item'},count));
 await action({kind:'Decisão',item:'Decisão',decision:'Reabrir análise'},count++);
 await action({kind:'Pendência',item:'Recuo lateral'},count++);
 await assert.rejects(action({kind:'Decisão',item:'Decisão',decision:'Concluir análise local'},count));
 assert.equal((await db.query<{n:number}>('select count(*)::int n from gmb_analysis')).rows[0].n,count);
 }finally{await db.close();}
});
