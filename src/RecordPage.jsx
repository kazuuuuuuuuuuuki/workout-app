import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function RecordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const targetDate = location.state?.targetDate || new Date().toISOString().split('T')[0];

  const [exercises, setExercises] = useState([]);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newRestTime, setNewRestTime] = useState('');
  
  // 左右別種目かどうかのチェック状態
  const [isUnilateralChecked, setIsUnilateralChecked] = useState(false);

  const [pastExerciseNames, setPastExerciseNames] = useState([]);
  const [allHistory, setAllHistory] = useState({});
  const [activeTimer, setActiveTimer] = useState({ exerciseId: null, timeLeft: 0 });

  // データ読み込み
  useEffect(() => {
    const savedData = JSON.parse(localStorage.getItem('workout_data_v2')) || {};
    setAllHistory(savedData);
    if (savedData[targetDate]) {
      setExercises(savedData[targetDate]);
    }
    const namesSet = new Set();
    Object.values(savedData).forEach(dayExercises => {
      dayExercises.forEach(ex => {
        if (ex.name) namesSet.add(ex.name);
      });
    });
    setPastExerciseNames([...namesSet]);
  }, [targetDate]);

  // タイマー処理
  useEffect(() => {
    let interval = null;
    if (activeTimer.exerciseId !== null && activeTimer.timeLeft > 0) {
      interval = setInterval(() => {
        setActiveTimer(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
      }, 1000);
    } else if (activeTimer.timeLeft === 0 && activeTimer.exerciseId !== null) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  const parseTime = (timeStr) => {
    if (!timeStr) return 120;
    const normalized = timeStr.replace(/,/g, '.');
    if (normalized.includes('分') || normalized.includes('秒')) {
      let seconds = 0;
      const minMatch = normalized.match(/(\d+(\.\d+)?)分/);
      if (minMatch) seconds += parseFloat(minMatch[1]) * 60;
      const secMatch = normalized.match(/(\d+(\.\d+)?)秒/);
      if (secMatch) seconds += parseFloat(secMatch[1]);
      return Math.floor(seconds);
    }
    const val = parseFloat(normalized);
    if (!isNaN(val)) {
      return Math.floor(val * 60);
    }
    return 120;
  };

  const handleStartTimer = (exerciseId, restStr) => {
    const seconds = parseTime(restStr);
    setActiveTimer({ exerciseId, timeLeft: seconds });
  };

  const handleStopTimer = () => {
    setActiveTimer({ exerciseId: null, timeLeft: 0 });
  };

  const getMaxWeight = (name) => {
    let max = 0;
    Object.values(allHistory).forEach(dayExercises => {
      dayExercises.forEach(ex => {
        if (ex.name === name) {
          ex.sets.forEach(set => {
            const w = parseFloat(set.weight);
            if (!isNaN(w) && w > max) max = w;
          });
        }
      });
    });
    return max > 0 ? max : null;
  };

  // --- 種目の追加 ---
  const handleAddExercise = (e) => {
    e.preventDefault();
    if (!newExerciseName) return;

    let initialSets = [];
    if (isUnilateralChecked) {
      initialSets = [
        { id: Date.now() + Math.random(), weight: '', reps: '', side: '左', setNum: 1 },
        { id: Date.now() + Math.random() + 1, weight: '', reps: '', side: '右', setNum: 1 }
      ];
    } else {
      initialSets = [
        { id: Date.now() + Math.random(), weight: '', reps: '', side: null, setNum: 1 }
      ];
    }

    const newExercise = {
      id: Date.now() + Math.random(),
      name: newExerciseName,
      rest: newRestTime || '2',
      isUnilateral: isUnilateralChecked,
      sets: initialSets
    };

    setExercises([...exercises, newExercise]);
    setNewExerciseName('');
    setNewRestTime('');
    setIsUnilateralChecked(false);
  };

  const handleDeleteExercise = (exerciseId) => {
    if (window.confirm('この種目をすべて削除しますか？')) {
      setExercises(exercises.filter(ex => ex.id !== exerciseId));
    }
  };

  const handleRestChange = (exerciseId, newRest) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) return { ...ex, rest: newRest };
      return ex;
    }));
  };

  // --- セットの追加（★ここがポイント！） ---
  const handleAddSet = (exerciseId) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        // 今ある最後のセットを取得
        const lastSet = ex.sets[ex.sets.length - 1];
        
        // 次のセット番号
        const nextSetNum = lastSet ? lastSet.setNum + 1 : 1;
        
        // ★ここで重量を引き継ぐ！
        // 前のセットがあればその weight をコピー、なければ空文字
        const initialWeight = lastSet ? lastSet.weight : '';

        let newSetsToAdd = [];
        if (ex.isUnilateral) {
           newSetsToAdd = [
             { id: Date.now() + Math.random(), weight: initialWeight, reps: '', side: '左', setNum: nextSetNum },
             { id: Date.now() + Math.random() + 1, weight: initialWeight, reps: '', side: '右', setNum: nextSetNum }
           ];
        } else {
           newSetsToAdd = [
             { id: Date.now() + Math.random(), weight: initialWeight, reps: '', side: null, setNum: nextSetNum }
           ];
        }

        return {
          ...ex,
          sets: [...ex.sets, ...newSetsToAdd]
        };
      }
      return ex;
    }));
  };

  // --- セットの削除 ---
  const handleDeleteSet = (exerciseId, setId) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        if (ex.sets.length <= 1) {
          alert("最後の1セットは削除できません。種目ごと削除してください。");
          return ex;
        }

        const filteredSets = ex.sets.filter(set => set.id !== setId);
        let newSets = [];

        if (ex.isUnilateral) {
          let currentSetNum = 1;
          newSets = filteredSets.map((set, index) => {
            if (index === 0) {
              return { ...set, setNum: 1 };
            }
            const prevSet = filteredSets[index - 1];
            // 前が右で今が左、または同じサイドの連続なら番号アップ
            if ((prevSet.side === '右' && set.side === '左') || (prevSet.side === set.side)) {
               currentSetNum++; 
            } 
            return { ...set, setNum: currentSetNum };
          });
        } else {
          newSets = filteredSets.map((set, index) => ({
            ...set,
            setNum: index + 1
          }));
        }

        return { ...ex, sets: newSets };
      }
      return ex;
    }));
  };

  const handleSetChange = (exerciseId, setId, field, value) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        return {
          ...ex,
          sets: ex.sets.map(s => {
            if (s.id === setId) return { ...s, [field]: value };
            return s;
          })
        };
      }
      return ex;
    }));
  };

  const handleSaveAll = () => {
    const savedData = JSON.parse(localStorage.getItem('workout_data_v2')) || {};
    if (exercises.length === 0) {
      delete savedData[targetDate];
      alert(`${targetDate} の記録を削除（クリア）しました！`);
    } else {
      savedData[targetDate] = exercises;
      alert(`${targetDate} の記録を保存しました！`);
    }
    localStorage.setItem('workout_data_v2', JSON.stringify(savedData));
    navigate('/');
  };

  const formatTimeDisplay = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="page-container" style={{ position: 'relative', maxWidth: '600px', margin: '0 auto', padding: '20px', paddingBottom: '100px' }}>
      
      <h1>{targetDate}</h1>

      {/* 種目追加フォーム */}
      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '30px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0 }}>種目を追加</h3>
        <form onSubmit={handleAddExercise}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
            <input
              type="text"
              list="exercise-suggestions"
              placeholder="種目名 (例: ダンベルカール)"
              value={newExerciseName}
              onChange={(e) => setNewExerciseName(e.target.value)}
              style={{ padding: '10px', flex: 1, border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <datalist id="exercise-suggestions">
              {pastExerciseNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            <input
              type="text"
              placeholder="レスト"
              value={newRestTime}
              onChange={(e) => setNewRestTime(e.target.value)}
              style={{ padding: '10px', width: '60px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={isUnilateralChecked} 
                onChange={(e) => setIsUnilateralChecked(e.target.checked)}
                style={{ transform: 'scale(1.3)' }}
              />
              <span style={{ fontSize: '0.9rem' }}>左右別で記録</span>
            </label>

            <button 
              type="submit" 
              style={{ padding: '10px 30px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              追加
            </button>
          </div>
        </form>
      </div>

      {/* トレーニング一覧 */}
      <div>
        {exercises.map((exercise) => {
          const maxWeight = getMaxWeight(exercise.name);
          const isTimerActive = activeTimer.exerciseId === exercise.id;

          return (
            <div key={exercise.id} style={{ marginBottom: '40px', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem' }}>
                      {exercise.name} 
                      {exercise.isUnilateral && <span style={{ fontSize: '0.8rem', marginLeft: '5px', color: '#666', border: '1px solid #ccc', borderRadius: '4px', padding: '0 4px' }}>左右</span>}
                    </h2>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '10px' }}>
                      <span style={{ fontSize: '0.9rem', color: '#666' }}>レスト:</span>
                      <input
                        type="text"
                        value={exercise.rest}
                        onChange={(e) => handleRestChange(exercise.id, e.target.value)}
                        style={{ width: '60px', padding: '4px', fontSize: '0.9rem', border: '1px solid #ddd', borderRadius: '4px', color: '#444' }}
                      />
                      {isTimerActive ? (
                        <button 
                          onClick={handleStopTimer}
                          style={{ marginLeft: '5px', padding: '5px 10px', backgroundColor: activeTimer.timeLeft === 0 ? '#ff4d4d' : '#28a745', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', minWidth: '80px' }}
                        >
                          {activeTimer.timeLeft === 0 ? "終了！" : `⏱️ ${formatTimeDisplay(activeTimer.timeLeft)}`}
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleStartTimer(exercise.id, exercise.rest)}
                          style={{ marginLeft: '5px', padding: '5px 10px', backgroundColor: '#f0f0f0', color: '#333', border: '1px solid #ccc', borderRadius: '20px', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          ⏱️ スタート
                        </button>
                      )}
                    </div>
                  </div>
                  {maxWeight && (
                    <div style={{ fontSize: '0.9rem', color: '#d4af37', fontWeight: 'bold' }}>
                      自己ベスト: {maxWeight}kg
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => handleDeleteExercise(exercise.id)}
                  style={{ position: 'static', backgroundColor: '#fff', color: '#d32f2f', border: '1px solid #d32f2f', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                >
                  削除
                </button>
              </div>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9f9f9', color: '#555' }}>
                    <th style={{ padding: '10px', width: '15%' }}>Set</th>
                    <th style={{ padding: '10px', width: '35%' }}>kg</th>
                    <th style={{ padding: '10px', width: '35%' }}>Reps</th>
                    <th style={{ padding: '10px', width: '15%' }}>×</th>
                  </tr>
                </thead>
                <tbody>
                  {exercise.sets.map((set, index) => (
                    <tr key={set.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>
                        {set.setNum}
                        {set.side && <span style={{ fontSize: '0.8rem', display: 'block', color: '#666' }}>({set.side})</span>}
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="number"
                          placeholder="kg"
                          value={set.weight}
                          onChange={(e) => handleSetChange(exercise.id, set.id, 'weight', e.target.value)}
                          style={{ width: '90%', textAlign: 'center', padding: '8px', fontSize: '1.1rem', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="number"
                          placeholder="回"
                          value={set.reps}
                          onChange={(e) => handleSetChange(exercise.id, set.id, 'reps', e.target.value)}
                          style={{ width: '90%', textAlign: 'center', padding: '8px', fontSize: '1.1rem', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                      </td>
                      <td style={{ padding: '8px', verticalAlign: 'middle' }}>
                        <button
                          onClick={() => handleDeleteSet(exercise.id, set.id)}
                          style={{ position: 'static', backgroundColor: '#ff4d4d', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div style={{ marginTop: '15px' }}>
                <button 
                  onClick={() => handleAddSet(exercise.id)}
                  style={{ position: 'static', display: 'block', width: '100%', padding: '12px', backgroundColor: '#f8f9fa', color: '#333', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                >
                  ＋ セットを追加
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '60px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
        <button 
          onClick={handleSaveAll}
          style={{ position: 'static', display: 'block', width: '100%', maxWidth: '300px', padding: '16px', fontSize: '1.1rem', fontWeight: 'bold', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '50px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,123,255,0.3)' }}
        >
          記録を終了して保存
        </button>
        <Link to="/" style={{ color: '#666', textDecoration: 'none', borderBottom: '1px solid #666', paddingBottom: '2px' }}>
          トップに戻る
        </Link>
      </div>
    </div>
  );
}