import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localDocuments} from '../src/lib/document-repository';
import {validateDocument,requirementsFor,latestStatus,MAX_FILE_SIZE} from '../src/lib/documents';
const file=()=>new File(['%PDF-1.4\nExample'], 'projeto.pdf',{type:'application/pdf'});
test('catálogo acompanha disciplinas e arquivos inválidos são recusados',async()=>{
 assert.equal(requirementsFor({disciplines:['Arquitetônico']}).length,3);
 assert.equal(requirementsFor({disciplines:['Arquitetônico','Estrutural']}).length,4);
 await assert.rejects(validateDocument(new File(['<script>'], 'falso.pdf')));
 await assert.rejects(validateDocument(new File([], 'vazio.pdf')));
 await assert.rejects(validateDocument(new File([new Uint8Array(MAX_FILE_SIZE+1)],'grande.pdf')));
 assert.equal(await validateDocument(file()),'application/pdf');
});
test('arquivos persistem, processos se isolam e versões concorrentes não se sobrescrevem',async()=>{
 await Promise.all([localDocuments.upload('p1','architecture',file()),localDocuments.upload('p1','architecture',file())]);
 const items=await localDocuments.list('p1');assert.deepEqual(items.map(v=>v.number),[2,1]);assert.equal(await items[0].blob.text(),'%PDF-1.4\nExample');
 assert.equal((await localDocuments.list('p2')).length,0);
 await assert.rejects(localDocuments.review(items[0].id,0,'Correção necessária','  '));
 await localDocuments.review(items[0].id,0,'Correção necessária','Corrigir cotas.');
 await assert.rejects(localDocuments.review(items[0].id,0,'Conforme',''));
 await localDocuments.upload('p1','architecture',file());const revised=await localDocuments.list('p1');
 assert.equal(latestStatus(revised[0]),'A conferir');assert.equal(latestStatus(revised[1]),'Correção necessária');assert.equal(revised[1].reviews[0].comment,'Corrigir cotas.');
 await localDocuments.review(revised[1].id,1,'Conforme','Cotas conferidas.');assert.equal((await localDocuments.list('p1'))[1].reviews.length,2);
});
