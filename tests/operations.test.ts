import 'fake-indexeddb/auto';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {newIntake,calculate,DEMO_RULES,intakeRequirements,CHECKS} from '../src/lib/intake';
import {criteria,type ValidationEntry} from '../src/lib/project-validation';
import type {Submission} from '../src/lib/intake-repository';
import {applyOperation,emptyOperation,operationStatus,type OperationAction,type OperationContext} from '../src/lib/operations';
test('ciclo de aprovação, alvará, vistorias, certificado e revisão',()=>{
 const d=newIntake();d.title='Casa teste';Object.assign(d.owners[0],{name:'Teste',document:'52998224725',phone:'11999999999',email:'teste@example.com',street:'Rua',number:'1',neighborhood:'Centro',zip:'12345678',state:'MG',city:'Teste'});Object.assign(d.properties[0],{registry:'123',registration:'456',block:'1',lot:'1',street:'Rua'});Object.assign(d.technicians[0],{name:'Teste',document:'52998224725',registration:'CAU',art:'TEST',email:'teste@example.com',phone:'11999999999'});d.landArea='500';d.declaredArea='250';Object.assign(d.floors[0],{area:'250',base:'0',top:'3'});d.surfaces=[{id:'s',name:'Jardim',area:'100',factor:'1',active:true}];d.roofs=[{id:'r',name:'Cobertura',level:'3',active:true}];d.justification='Conferência manual das regras demonstrativas.';d.checks=CHECKS.map(()=>true);d.declared=true;d.finalConfirmed=true;
 const files=intakeRequirements(d).map(r=>({id:crypto.randomUUID(),processId:d.id,requirementId:r.id,number:1,name:'teste.pdf',size:100,type:'application/pdf',at:new Date().toISOString(),reviews:[]}));d.verifiedFiles=files.map(f=>f.id);
 const s:Submission={id:crypto.randomUUID(),intakeId:d.id,number:1,at:new Date().toISOString(),protocol:'TEST',data:d,files,results:calculate(d),rules:DEMO_RULES};

 const c:OperationContext={draft:d,submissions:[s],analysis:[],files:[]};let o=emptyOperation(d.id);const now='2026-10-27T12:00:00.000Z';const actor='Analista CAU teste';
 const run=(a:OperationAction)=>o=applyOperation(o,a,c,now);
 assert.throws(()=>run({type:'approve',actor,reference:'Código interno'}));
 c.analysis=criteria(s).map((x,i)=>({id:String(i),submissionId:s.id,at:now,kind:'Validação',item:x.id,comment:'Conferido com referência.',reviewer:actor,verdict:'Conforme'} as ValidationEntry));
 c.analysis.push({id:'decision',submissionId:s.id,at:now,kind:'Decisão',item:'Decisão',comment:'Todos os itens conferidos.',reviewer:actor,decision:'Concluir análise local'});
 run({type:'approve',actor,reference:'Código interno'});assert.equal(operationStatus(o,c),'Aguardando alvará');
 assert.throws(()=>run({type:'authorize',actor}));
 c.files.push({id:'permit',processId:d.id,requirementId:'construction-permit',number:1,name:'alvara.pdf',type:'application/pdf',size:1,at:now,reviews:[],blob:new Blob(['x'])});
 run({type:'permit',actor,fileId:'permit',number:'123',expires:'2027-01-01'});run({type:'authorize',actor});
 assert.throws(()=>run({type:'certificate',actor,reference:'CAU'}));
 for(const visitType of ['Inicial','Final'] as const){run({type:'schedule',actor,visitType,scheduled:'2026-10-26T12:00:00.000Z'});const v=structuredClone(o.visits.at(-1)!);
 assert.throws(()=>run({type:'visit',actor,visit:v}));v.notes='Registro parcial';run({type:'visitDraft',actor,visit:v});assert.equal(o.visits.at(-1)?.notes,'Registro parcial');
 v.items.forEach((item,i)=>{item.result='Conforme';const id=v.id+i;item.photos=[id];c.files.push({id,processId:d.id,requirementId:'visit:'+v.id+':'+item.id,number:1,name:'solo.jpg',type:'image/jpeg',size:1,at:now,reviews:[],blob:new Blob(['x'])});});if(visitType==='Inicial'){v.items[0].result='Não conforme';v.items[0].note='Recuo executado precisa de correção.';}run({type:'visit',actor,visit:v});if(visitType==='Inicial'){assert.equal(operationStatus(o,c),'Obra com pendências');assert.throws(()=>run({type:'certificate',actor,reference:'CAU'}));run({type:'resolve',actor,visitId:v.id,itemId:v.items[0].id,note:'Correção verificada presencialmente.'});}}
 run({type:'certificate',actor,reference:'CAU'});assert.equal(operationStatus(o,c),'Concluído');assert.throws(()=>run({type:'schedule',actor,visitType:'Final',scheduled:now}));
 c.submissions.push({...s,id:'revision2',number:2});assert.equal(operationStatus(o,c),'Revisão exige nova aprovação');
 assert.throws(()=>run({type:'authorize',actor}));run({type:'revoke',actor,reason:'Revisão posterior'});assert.ok(o.documents.every(d=>d.voidAt));
});
