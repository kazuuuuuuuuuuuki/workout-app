export const WORKOUT_KEY = 'workout_data_v2';
export const RECOVERY_KEY = 'workout_data_v2_before_restore_v1';
const BACKUP_FORMAT = 'workout-record-backup';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// 空欄・左右・既存の追加項目を保ち、記録の形だけを検査する。
export function assertWorkoutData(data) {
  if (!isObject(data)) throw new Error('日付ごとの記録が入ったJSONファイルを選択してください。');
  for (const [date, exercises] of Object.entries(data)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(exercises)) {
      throw new Error('日付または種目一覧の形式が正しくありません。');
    }
    for (const exercise of exercises) {
      if (!isObject(exercise) || typeof exercise.name !== 'string' || !Array.isArray(exercise.sets)) {
        throw new Error(`${date} の種目データの形式が正しくありません。`);
      }
      for (const set of exercise.sets) {
        if (!isObject(set) || !['string', 'number'].includes(typeof set.weight) ||
            !['string', 'number'].includes(typeof set.reps)) {
          throw new Error(`${date} のセットデータの形式が正しくありません。`);
        }
      }
    }
  }
  return data;
}

export function summarizeRecords(data) {
  assertWorkoutData(data);
  let exercises = 0;
  let sets = 0;
  for (const day of Object.values(data)) {
    exercises += day.length;
    for (const exercise of day) sets += exercise.sets.length;
  }
  return { days: Object.keys(data).length, exercises, sets };
}

export function serializeBackup(data, exportedAt = new Date().toISOString()) {
  assertWorkoutData(data);
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: 1,
    storageKey: WORKOUT_KEY,
    exportedAt,
    data,
  }, null, 2);
}

export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('JSONファイルを読み取れませんでした。元のファイルを選び直してください。');
  }
  if (isObject(parsed) && Object.hasOwn(parsed, 'format')) {
    if (parsed.format !== BACKUP_FORMAT || parsed.version !== 1 || parsed.storageKey !== WORKOUT_KEY) {
      throw new Error('この形式のバックアップには対応していません。');
    }
    return assertWorkoutData(parsed.data);
  }
  // 保存領域から直接書き出した、日付をキーとするJSONも読み込める。
  return assertWorkoutData(parsed);
}

export function planRestore(current, incoming, replaceConflicts = false) {
  assertWorkoutData(current);
  assertWorkoutData(incoming);
  const merged = { ...current };
  const conflicts = [];
  let addedDays = 0;
  let identicalDays = 0;
  for (const [date, exercises] of Object.entries(incoming)) {
    if (!Object.hasOwn(current, date)) {
      merged[date] = exercises;
      addedDays++;
    } else if (JSON.stringify(current[date]) === JSON.stringify(exercises)) {
      identicalDays++;
    } else {
      conflicts.push(date);
      if (replaceConflicts) merged[date] = exercises;
    }
  }
  return { data: merged, conflicts, addedDays, identicalDays };
}

// Adapter: getItem/setItemの文字列APIを、記録オブジェクトの読み書きへ適合する。
export class WorkoutStorageAdapter {
  constructor(storage) {
    this.storage = storage;
  }

  readRaw() {
    return this.storage.getItem(WORKOUT_KEY);
  }

  readAll() {
    const raw = this.readRaw();
    if (raw === null) return {};
    try {
      return assertWorkoutData(JSON.parse(raw));
    } catch {
      throw new Error('保存された記録を読み取れません。記録は上書きしていません。');
    }
  }

  writeAll(data) {
    assertWorkoutData(data);
    this.storage.setItem(WORKOUT_KEY, JSON.stringify(data));
  }

  saveDay(date, exercises) {
    const data = this.readAll();
    if (exercises.length === 0) delete data[date];
    else data[date] = exercises;
    this.writeAll(data);
  }

  exportBackup() {
    return serializeBackup(this.readAll());
  }

  previewRestore(incoming) {
    const raw = this.readRaw();
    const current = this.readAll();
    return { ...planRestore(current, incoming), raw };
  }

  restore(incoming, { expectedRaw, replaceConflicts = false } = {}) {
    const raw = this.readRaw();
    if (expectedRaw === undefined || raw !== expectedRaw) {
      throw new Error('確認中に記録が変更されました。ファイルを選び直して内容を確認してください。');
    }
    if (summarizeRecords(incoming).days === 0) {
      throw new Error('記録が0日分のため、取り込みは行いません。');
    }
    const plan = planRestore(this.readAll(), incoming, replaceConflicts);
    if (JSON.stringify(plan.data) === JSON.stringify(this.readAll())) return { ...plan, changed: false };
    // 退避に失敗した場合は、現行記録への書き込みに進まない。
    this.storage.setItem(RECOVERY_KEY, JSON.stringify({
      version: 1, savedAt: new Date().toISOString(), raw,
    }));
    this.writeAll(plan.data);
    return { ...plan, changed: true };
  }

  exportRecoveryBackup() {
    const raw = this.storage.getItem(RECOVERY_KEY);
    if (!raw) throw new Error('この端末には復元前の退避データがありません。');
    const recovery = JSON.parse(raw);
    return serializeBackup(recovery.raw === null ? {} : assertWorkoutData(JSON.parse(recovery.raw)));
  }
}

export function getWorkoutStore() {
  // import時にはブラウザの保存領域に触らない。
  return new WorkoutStorageAdapter(window.localStorage);
}
