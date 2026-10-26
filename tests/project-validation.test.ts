import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newIntake,calculate,DEMO_RULES,validateIntake,intakeRequirements,CHECKS} from '../src/lib/intake';
import {criteria,recordValidation,validationEntries,validationState} from '../src/lib/project-validation';
import {intakeRepository,type Submission} from '../src/lib/intake-repository';
import {dbTransaction} from '../src/lib/document-db';

test('inconsistências aritméticas não são liberadas por justificativa',()=>{
 const d=newIntake();d.landArea='500';d.declaredArea='200';d.floors[0]={...d.floors[0],area:'100',base:'3',top:'2'};d.justification='Justificativa livre não pode dispensar correções.';
 const issues=validateIntake(d,[]);assert.ok(issues.some(e=>e.message.startsWith('Soma dos pavimentos:')));assert.ok(issues.some(e=>e.message.startsWith('Cotas do nível')));
 d.owners.push({...d.owners[0],id:'duplicate'});assert.ok(validateIntake(d,[]).some(e=>e.message.includes('mesmo documento')));
});
test('decisão exige checklist completo, pendências resolvidas, concorrência e reabertura',async()=>{
 const d=newIntake();d.title='Casa teste';Object.assign(d.owners[0],{name:'Teste',document:'52998224725',phone:'11999999999',email:'teste@example.com',street:'Rua',number:'1',neighborhood:'Centro',zip:'12345678',state:'MG',city:'Teste'});Object.assign(d.properties[0],{registry:'123',registration:'456',block:'1',lot:'1',street:'Rua'});Object.assign(d.technicians[0],{name:'Teste',document:'52998224725',registration:'CAU',art:'TEST',email:'teste@example.com',phone:'11999999999'});d.landArea='500';d.declaredArea='250';Object.assign(d.floors[0],{area:'250',base:'0',top:'3'});d.surfaces=[{id:'s',name:'Jardim',area:'100',factor:'1',active:true}];d.roofs=[{id:'r',name:'Cobertura',level:'3',active:true}];d.justification='Conferência manual das regras demonstrativas.';d.checks=CHECKS.map(()=>true);d.declared=true;d.finalConfirmed=true;
 const files=intakeRequirements(d).map(r=>({id:crypto.randomUUID(),processId:d.id,requirementId:r.id,number:1,name:'teste.pdf',size:100,type:'application/pdf',at:new Date().toISOString(),reviews:[]}));d.verifiedFiles=files.map(f=>f.id);
 const s:Submission={id:crypto.randomUUID(),intakeId:d.id,number:1,at:new Date().toISOString(),protocol:'TEST',data:d,files,results:calculate(d),rules:DEMO_RULES};
 await dbTransaction<void>(['submissions'],'readwrite',(tx,done)=>{tx.objectStore('submissions').add(s);done();});
 const base={submissionId:s.id,reviewer:'Analista de teste',comment:'Conferência manual da referência e página indicadas.'};
 const conclude={...base,kind:'Decisão' as const,item:'Decisão',decision:'Concluir análise local' as const};
 await assert.rejects(recordValidation(conclude,0));
 await assert.rejects(recordValidation({...base,kind:'Validação',item:criteria(s)[0].id,verdict:'Não se aplica'},0));
 let count=0;for(const c of criteria(s)){await recordValidation({...base,kind:'Validação',item:c.id,verdict:'Conforme'},count++);}
 await assert.rejects(recordValidation(conclude,count-1));
 await intakeRepository.addEvent({submissionId:s.id,item:'Recuo',comment:'Rever o recuo lateral.',kind:'Pendência'});count++;
 let events=await intakeRepository.events(s.id);assert.equal(events.length,1);
 await intakeRepository.addEvent({submissionId:s.id,item:'Recuo',comment:'Resposta ainda não resolve.',kind:'Resposta',parentId:events[0].id});count++;
 await assert.rejects(recordValidation(conclude,count));
 await intakeRepository.addEvent({submissionId:s.id,item:'Recuo',comment:'Correção verificada.',kind:'Resolvida',parentId:events[0].id});count++;
 await assert.rejects(intakeRepository.addEvent({submissionId:s.id,item:'Recuo',comment:'Repetida.',kind:'Resolvida',parentId:events[0].id}));
 await recordValidation(conclude,count++);
 assert.equal(validationState(s,await validationEntries(s.id),await intakeRepository.events(s.id)).closed,true);
 await assert.rejects(intakeRepository.addEvent({submissionId:s.id,item:'Novo',comment:'Não deve alterar análise encerrada.',kind:'Pendência'}));
 await recordValidation({...base,kind:'Decisão',item:'Decisão',decision:'Reabrir análise'},count++);
 await recordValidation({...base,kind:'Validação',item:criteria(s)[0].id,verdict:'Não conforme'},count++);
 await assert.rejects(recordValidation(conclude,count));
 await recordValidation({...base,kind:'Decisão',item:'Decisão',decision:'Solicitar correções'},count);
 assert.equal(validationState(s,await validationEntries(s.id),await intakeRepository.events(s.id)).last?.decision,'Solicitar correções');
 const other={...s,id:'other'};assert.equal(validationState(other,await validationEntries(s.id),await intakeRepository.events(s.id)).missing.length,criteria(other).length);
});
