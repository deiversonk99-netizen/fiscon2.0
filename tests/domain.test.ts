import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoData, createProcess, nextProcessCode, parseStoredData, validateLot } from '../src/lib/domain';

test('50 lotes únicos e processos vinculados', () => {
  const d = createDemoData();
  assert.equal(d.lots.length, 50);
  assert.equal(new Set(d.lots.map(l => `${l.block}-${l.number}`)).size, 50);
  assert.deepEqual(parseStoredData(JSON.stringify(d)), d);
});
test('novo processo sempre nasce em rascunho, sem prazo presumido', () => {
  const d = createDemoData();
  const next = createProcess(d, d.processes[0], '2026-10-20T12:00:00Z');
  assert.equal(next.processes[0].status, 'Rascunho');
  assert.equal(next.processes[0].dueAt, null);
  assert.equal(next.processes[0].code, 'PR-2026-006');
  assert.equal(d.processes.length, 5);
});
test('impede processo sem proprietário ou responsável válido', () => {
  const d = createDemoData();
  assert.throws(() => createProcess(d, {...d.processes[0], lotId: 'lot-50'}), /proprietário/);
  assert.throws(() => createProcess(d, {...d.processes[0], professional: {...d.processes[0].professional, email: 'inválido'}}), /e-mail/);
});
test('duplicidade de lote, área inválida e dados incompatíveis são rejeitados', () => {
  const d = createDemoData();
  assert.match(validateLot({...d.lots[0], id: 'novo'}, d.lots)!, /Já existe/);
  assert.match(validateLot({...d.lots[0], area: 0}, d.lots)!, /área/);
  assert.throws(() => parseStoredData('{"schemaVersion":3}'));
  assert.throws(() => parseStoredData(JSON.stringify({...d, processes:[{...d.processes[0], lotId:'ausente'}]})));
});
test('numeração não depende da ordem e reinicia por ano', () => {
  const d = createDemoData();
  assert.equal(nextProcessCode(d.processes.reverse(), 2026), 'PR-2026-006');
  assert.equal(nextProcessCode(d.processes, 2027), 'PR-2027-001');
});
