import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKOUT_KEY, RECOVERY_KEY, WorkoutStorageAdapter,
  parseBackup, serializeBackup, summarizeRecords, planRestore,
} from '../src/data/workoutData.js';
import { HistoryAnalyzer, MaxWeightAnalyzer, EstimatedOneRmAnalyzer } from '../src/analysis/HistoryAnalyzer.js';

const sample = {
  '2026-11-09': [{ id: 1.123, name: 'ダンベルカール', rest: '2分30秒', isUnilateral: true,
    sets: [
      { id: 2.234, weight: '12.5', reps: '10', side: '左', setNum: 1, extra: { note: '元の追加情報' } },
      { id: 3.345, weight: '12.5', reps: '8', side: '右', setNum: 1 },
      { id: 4.456, weight: '', reps: '', side: '左', setNum: 2 },
    ] }],
  '2026-11-10': [{ id: 5, name: 'ベンチプレス', rest: '2', isUnilateral: false,
    sets: [
      { id: 6, weight: '60', reps: '10', side: null, setNum: 1 },
      { id: 7, weight: '65', reps: '5', side: null, setNum: 2 },
    ] }],
};
class FakeStorage {
  constructor(data = sample) {
    this.map = new Map([['unrelated', 'keep']]);
    if (data !== null) this.map.set(WORKOUT_KEY, JSON.stringify(data));
    this.writes = [];
    this.failKey = null;
  }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) {
    if (key === this.failKey) throw new Error('QuotaExceededError');
    this.map.set(key, value); this.writes.push(key);
  }
}
const setup = data => {
  const storage = new FakeStorage(data);
  return { storage, store: new WorkoutStorageAdapter(storage) };
};
const extra = { '2026-11-11': [{ name: 'ロー', sets: [{ weight: '20', reps: '8' }] }] };

test('export preserves every value and never writes to browser storage', () => {
  const { storage, store } = setup();
  const raw = store.readRaw();
  assert.deepEqual(parseBackup(store.exportBackup()), sample);
  assert.equal(store.readRaw(), raw);
  assert.deepEqual(storage.writes, []);
  assert.deepEqual(summarizeRecords(sample), { days: 2, exercises: 2, sets: 5 });
});

test('empty storage stays uninitialized when exporting', () => {
  const { store, storage } = setup(null);
  assert.deepEqual(parseBackup(store.exportBackup()), {});
  assert.equal(store.readRaw(), null);
  assert.deepEqual(storage.writes, []);
});

test('serialized and raw JSON can be read including BOM', () => {
  assert.deepEqual(parseBackup('\uFEFF' + serializeBackup(sample)), sample);
  assert.deepEqual(parseBackup(JSON.stringify(sample)), sample);
});

test('preview does not change any data', () => {
  const { store, storage } = setup();
  const preview = store.previewRestore(extra);
  assert.equal(preview.addedDays, 1);
  assert.deepEqual(storage.writes, []);
});

test('restore into an empty browser reproduces all source fields', () => {
  const { store } = setup(null);
  store.restore(sample, { expectedRaw: null });
  assert.deepEqual(store.readAll(), sample);
});

test('restore retains dates missing from the backup and unrelated storage', () => {
  const { store, storage } = setup();
  const raw = store.readRaw();
  store.restore(extra, { expectedRaw: raw });
  assert.deepEqual(store.readAll(), { ...sample, ...extra });
  assert.equal(storage.getItem('unrelated'), 'keep');
  assert.deepEqual(parseBackup(store.exportRecoveryBackup()), sample);
});

test('conflicting dates stay local by default; explicit replacement is per day', () => {
  const incoming = { '2026-11-09': [], ...extra };
  const { store } = setup();
  const raw = store.readRaw();
  const preview = store.previewRestore(incoming);
  assert.deepEqual(preview.conflicts, ['2026-11-09']);
  store.restore(incoming, { expectedRaw: raw });
  assert.deepEqual(store.readAll()['2026-11-09'], sample['2026-11-09']);
  store.restore(incoming, { expectedRaw: store.readRaw(), replaceConflicts: true });
  assert.deepEqual(store.readAll()['2026-11-09'], []);
  assert.deepEqual(store.readAll()['2026-11-10'], sample['2026-11-10']);
});

test('importing identical records is a no-op', () => {
  const { store, storage } = setup();
  const result = store.restore(sample, { expectedRaw: store.readRaw() });
  assert.equal(result.changed, false);
  assert.deepEqual(storage.writes, []);
});

test('changed records after preview abort the import', () => {
  const { store, storage } = setup();
  const preview = store.previewRestore(extra);
  store.saveDay('2026-11-12', extra['2026-11-11']);
  const current = store.readRaw();
  storage.writes = [];
  assert.throws(() => store.restore(extra, { expectedRaw: preview.raw }), /変更/);
  assert.equal(store.readRaw(), current);
  assert.deepEqual(storage.writes, []);
});

for (const bad of ['not json', '{}', '[]', '{"hello": []}', '{"2026-11-01":[{"name":"x","sets":[{}]}]}']) {
  test(`invalid/empty import cannot overwrite records: ${bad}`, () => {
    const { store, storage } = setup();
    const original = store.readRaw();
    assert.throws(() => store.restore(parseBackup(bad), { expectedRaw: original }));
    assert.equal(store.readRaw(), original);
    assert.deepEqual(storage.writes, []);
  });
}

test('unsupported backup versions are rejected', () => {
  const parsed = JSON.parse(serializeBackup(sample)); parsed.version = 99;
  assert.throws(() => parseBackup(JSON.stringify(parsed)), /対応/);
});

test('broken current JSON is not silently replaced by an empty history', () => {
  const { store, storage } = setup();
  storage.map.set(WORKOUT_KEY, '{broken');
  assert.throws(() => store.saveDay('2026-11-11', extra['2026-11-11']));
  assert.equal(store.readRaw(), '{broken');
  assert.deepEqual(storage.writes, []);
});

for (const failKey of [RECOVERY_KEY, WORKOUT_KEY]) {
  test(`write failure at ${failKey} preserves original records`, () => {
    const { store, storage } = setup();
    const raw = store.readRaw(); storage.failKey = failKey;
    assert.throws(() => store.restore(extra, { expectedRaw: raw }), /QuotaExceeded/);
    assert.equal(store.readRaw(), raw);
  });
}

test('saving one edited day keeps every other date and existing format', () => {
  const { store } = setup();
  store.saveDay('2026-11-09', extra['2026-11-11']);
  assert.deepEqual(store.readAll()['2026-11-10'], sample['2026-11-10']);
  assert.equal(typeof store.readAll()['2026-11-10'][0].sets[0].weight, 'string');
  store.saveDay('2026-11-09', []);
  assert.deepEqual(Object.keys(store.readAll()), ['2026-11-10']);
});

// Original formulas/selection rules, isolated from the supplied React components.
function legacyMaxWeight(history, name) {
  let max = 0;
  Object.values(history).forEach(day => day.forEach(ex => {
    if (ex.name === name) ex.sets.forEach(set => {
      const w = parseFloat(set.weight);
      if (!isNaN(w) && w > max) max = w;
    });
  }));
  return max > 0 ? max : null;
}
function legacyOneRm(history) {
  const records = {};
  Object.keys(history).forEach(date => history[date].forEach(ex => ex.sets.forEach(set => {
    const weight = parseFloat(set.weight); const reps = parseFloat(set.reps);
    if (!isNaN(weight) && !isNaN(reps)) {
      const oneRM = weight * (1 + reps / 33.33);
      if (!records[ex.name] || oneRM > records[ex.name].oneRM)
        records[ex.name] = { name: ex.name, oneRM, weight, reps, date, side: set.side };
    }
  })));
  return Object.values(records).sort((a, b) => b.oneRM - a.oneRM);
}

test('both existing analyses match the pre-refactor results without mutating data', () => {
  const before = JSON.stringify(sample);
  for (const name of ['ダンベルカール', 'ベンチプレス', '未登録'])
    assert.equal(new MaxWeightAnalyzer(name).analyze(sample), legacyMaxWeight(sample, name));
  assert.deepEqual(new EstimatedOneRmAnalyzer().analyze(sample), legacyOneRm(sample));
  assert.equal(JSON.stringify(sample), before);
});

test('analysis preserves 1-rep formula, ties, blanks, zero, and left/right rules', () => {
  const data = {
    '2026-01-01': [{ name: 'テスト', sets: [
      { weight: '10', reps: '1', side: '左' }, { weight: '10', reps: '1', side: '右' },
      { weight: '100', reps: '', side: null }, { weight: '', reps: '10' },
    ] }, { name: 'ゼロ', sets: [{ weight: '0', reps: '1' }] }],
    '2026-01-02': [{ name: 'テスト', sets: [{ weight: '10', reps: '1', side: '右' }] }],
  };
  assert.deepEqual(new EstimatedOneRmAnalyzer().analyze(data), legacyOneRm(data));
  assert.equal(new EstimatedOneRmAnalyzer().analyze(data)[0].side, '左');
  assert.equal(new MaxWeightAnalyzer('テスト').analyze(data), 100);
  assert.equal(new MaxWeightAnalyzer('ゼロ').analyze(data), null);
});

test('analyzers can be reused and return correct empty results', () => {
  const analyzer = new EstimatedOneRmAnalyzer();
  analyzer.analyze(sample);
  assert.deepEqual(analyzer.analyze({}), []);
  assert.equal(new MaxWeightAnalyzer('ベンチプレス').analyze({}), null);
});

test('a new analysis can use the common traversal without changing the template', () => {
  class CountAnalyzer extends HistoryAnalyzer {
    createAccumulator() { return { count: 0 }; }
    visitSet(a) { a.count++; }
    getResult(a) { return a.count; }
  }
  assert.equal(new CountAnalyzer().analyze(sample), 5);
});
