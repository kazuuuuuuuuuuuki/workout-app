// Template Method: 履歴の巡回順を固定し、セット単位の集計と結果の形を子クラスに任せる。
export class HistoryAnalyzer {
  analyze(history) {
    const accumulator = this.createAccumulator();
    for (const [date, exercises] of Object.entries(history)) {
      for (const exercise of exercises) {
        for (const set of exercise.sets) {
          this.visitSet(accumulator, { date, exercise, set });
        }
      }
    }
    return this.getResult(accumulator);
  }

  createAccumulator() {
    throw new Error('createAccumulatorを実装してください。');
  }

  visitSet() {
    throw new Error('visitSetを実装してください。');
  }

  getResult() {
    throw new Error('getResultを実装してください。');
  }
}

export class MaxWeightAnalyzer extends HistoryAnalyzer {
  constructor(exerciseName) {
    super();
    this.exerciseName = exerciseName;
  }

  createAccumulator() {
    return { max: 0 };
  }

  visitSet(accumulator, { exercise, set }) {
    if (exercise.name !== this.exerciseName) return;
    const weight = parseFloat(set.weight);
    if (!Number.isNaN(weight) && weight > accumulator.max) accumulator.max = weight;
  }

  getResult(accumulator) {
    return accumulator.max > 0 ? accumulator.max : null;
  }
}

export class EstimatedOneRmAnalyzer extends HistoryAnalyzer {
  createAccumulator() {
    return new Map();
  }

  visitSet(records, { date, exercise, set }) {
    const weight = parseFloat(set.weight);
    const reps = parseFloat(set.reps);
    if (Number.isNaN(weight) || Number.isNaN(reps)) return;
    // 既存サイトの計算式を維持する。左右別も従来どおり同一種目で比較する。
    const oneRM = weight * (1 + reps / 33.33);
    const previous = records.get(exercise.name);
    if (!previous || oneRM > previous.oneRM) {
      records.set(exercise.name, {
        name: exercise.name,
        oneRM,
        weight,
        reps,
        date,
        side: set.side,
      });
    }
  }

  getResult(records) {
    return [...records.values()].sort((a, b) => b.oneRM - a.oneRM);
  }
}
