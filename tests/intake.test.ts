import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newIntake,withFloorCount,activeFloors,calculate,decimal,validDocument,intakeRequirements,CHECKS,validateIntake} from '../src/lib/intake';
import {intakeRepository} from '../src/lib/intake-repository';
import {localDocuments} from '../src/lib/document-repository';
import {validateDocument} from '../src/lib/documents';
const pdf=()=>new File(['%PDF-1.4\nFixture'], 'teste.pdf',{type:'application/pdf'});
test('decimais, documento, pavimentos preservados e altura não mascarada',()=>{
 assert.equal(decimal(''),null);assert.equal(decimal('12abc'),null);assert.equal(decimal('1,25'),1.25);assert.equal(decimal('1.234'),null);
 assert.equal(validDocument('11111111111'),false);assert.equal(validDocument('529.982.247-25'),true);
 let d=withFloorCount(newIntake(),'4');d.floors[3].area='80';d=withFloorCount(d,'2');assert.equal(activeFloors(d).length,2);d=withFloorCount(d,'4');assert.equal(d.floors[3].area,'80');assert.ok(calculate(d).some(r=>r.label==='Área do pavimento 3'&&r.status==='unconfigured'));
 d=withFloorCount(d,'1');d.floors[0].top='12';d.floors[0].base='0';d.hasTechnical=true;d.technicalBase='8';d.technicalTop='13';assert.equal(calculate(d).find(r=>r.label==='Altura sem volume técnico')?.status,'bad');assert.equal(calculate(d).find(r=>r.label==='Volume técnico')?.status,'bad');
});
test('cálculos demonstrativos, valores vazios e revisão de prancha',()=>{
 let d=withFloorCount(newIntake(),'3');d.landArea='500';d.declaredArea='500';d.floors.forEach((f,i)=>{f.area=String([250,150,100][i]);f.base=String(i*3);f.top=String((i+1)*3);});d.surfaces=[{id:'s',name:'Jardim',area:'100',factor:'1',active:true}];
 assert.equal(calculate(d).find(r=>r.label==='Soma dos pavimentos')?.status,'ok');assert.equal(calculate(d).find(r=>r.label==='Permeabilidade efetiva')?.status,'ok');d.floors[0].area='';assert.equal(calculate(d).find(r=>r.label==='Área do térreo')?.status,'missing');
 const before=intakeRequirements(d).filter(r=>r.section==='files').map(r=>r.id);d.sheets[0].revision='R01';assert.notDeepEqual(intakeRequirements(d).filter(r=>r.section==='files').map(r=>r.id),before);
});
test('banco preserva anexos legados, conflitos, declarações e submissão imutável',async()=>{
 // Exercise the actual additive v1 -> v2 upgrade, without replacing the old store.
 await new Promise<void>((resolve,reject)=>{const req=indexedDB.open('fiscon-2-demo-documents',1);req.onupgradeneeded=()=>{const store=req.result.createObjectStore('versions',{keyPath:'id'});store.createIndex('processId','processId');};req.onsuccess=()=>{req.result.close();resolve();};req.onerror=()=>reject(req.error);});
 const old='legacy-fixture';await localDocuments.upload(old,'architecture',pdf());
 let d=newIntake();d.title='Casa de teste';Object.assign(d.owners[0],{name:'Pessoa fictícia',document:'52998224725',phone:'11999999999',email:'teste@example.com',street:'Rua teste',number:'1',neighborhood:'Bairro',zip:'12345678',state:'MG',city:'Cidade'});
 Object.assign(d.properties[0],{registry:'123',registration:'456',block:'1',lot:'1',street:'Rua teste'});Object.assign(d.technicians[0],{name:'Técnico fictício',document:'52998224725',registration:'CAU-DEMO',art:'DEMO',email:'tecnico@example.com',phone:'11999999999'});
 d.landArea='500';d.declaredArea='250';d.floors[0]={...d.floors[0],area:'250',base:'0',top:'3'};d.surfaces=[{id:'s',name:'Jardim',area:'100',factor:'1',active:true}];d.roofs=[{id:'r',name:'Cobertura',level:'3',active:true}];d.justification='Regras ainda demonstrativas; encaminhar à conferência.';
 d=await intakeRepository.save(d);const stale=structuredClone(d);d.title='Casa revisada';d=await intakeRepository.save(d);await assert.rejects(intakeRepository.save(stale));
 for(const req of intakeRequirements(d))d=await intakeRepository.upload(d,req.id,pdf());
 assert.equal(d.declared,false);const files=await localDocuments.list(d.id);d.checks=CHECKS.map(()=>true);d.declared=true;d.finalConfirmed=true;d.verifiedFiles=intakeRequirements(d).map(r=>files.find(f=>f.requirementId===r.id)!.id);assert.deepEqual(validateIntake(d,files),[]);
 d.notApplicable={'0':'Não se aplica neste teste de validação.'};d.checks[0]=false;assert.deepEqual(validateIntake(d,files),[]);d.notApplicable={'0':''};assert.ok(validateIntake(d,files).some(e=>e.section==='checklist'));d.checks[0]=true;d.notApplicable={};
 d=await intakeRepository.save(d);const sub=await intakeRepository.submit(d);assert.equal((await intakeRepository.submit(d)).id,sub.id);
 d.title='Alterado depois da entrega';d=await intakeRepository.save(d);assert.equal((await intakeRepository.submissions(d.id))[0].data.title,'Casa revisada');
 await localDocuments.upload(d.id,intakeRequirements(d)[0].id,pdf());assert.ok(validateIntake(d,await localDocuments.list(d.id)).some(e=>e.message.includes('arquivos mudaram')));
 assert.equal(await (await localDocuments.list(old))[0].blob.text(),'%PDF-1.4\nFixture');
 await intakeRepository.addEvent({submissionId:sub.id,item:'Prancha 1, página 1',comment:'Conferir recuo.',kind:'Pendência'});const event=(await intakeRepository.events(sub.id))[0];await intakeRepository.addEvent({submissionId:sub.id,item:event.item,comment:'Correção informada.',kind:'Resposta',parentId:event.id});assert.equal((await intakeRepository.events(sub.id)).filter(e=>e.kind==='Resolvida').length,0);
 const backup=await intakeRepository.backup();assert.ok(backup.versions.length);assert.ok(backup.submissions.length);
});
test('CAD permitido somente por exigência e assinatura conhecida',async()=>{
 const cad=new File(['AC1032 fixture'], 'arquivo.dwg');await assert.rejects(validateDocument(cad));assert.equal(await validateDocument(cad,true),'application/acad');await assert.rejects(validateDocument(new File(['html'], 'arquivo.dwg'),true));
});
