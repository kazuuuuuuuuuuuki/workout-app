import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getWorkoutStore } from './data/workoutData';
import { EstimatedOneRmAnalyzer } from './analysis/HistoryAnalyzer';

export default function MaxRecordsPage() {
  const [maxRecords, setMaxRecords] = useState([]);

  const [storageError, setStorageError] = useState('');

  useEffect(() => {
    try {
      const savedData = getWorkoutStore().readAll();
      setMaxRecords(new EstimatedOneRmAnalyzer().analyze(savedData));
      setStorageError('');
    } catch (error) {
      setStorageError(error.message);
    }
  }, []);

  return (
    <div className="page-container" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      {storageError && <p role="alert" style={{ color: '#b00020' }}>{storageError}</p>}
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>🏆 自己ベスト一覧</h1>
      
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
          ※重量と回数から計算した「推定MAX（1RM）」のランキングです
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {maxRecords.length > 0 ? (
          maxRecords.map((record, index) => (
            <div key={index} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', position: 'relative' }}>
              
              {/* 金メダルアイコン */}
              <div style={{ position: 'absolute', top: '-10px', left: '-10px', fontSize: '2rem' }}>
                🏅
              </div>

              <div style={{ marginLeft: '20px' }}>
                <h2 style={{ margin: '0 0 5px 0', fontSize: '1.3rem' }}>{record.name}</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                  
                  {/* 推定MAXの表示 */}
                  <div style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '1.2rem' }}>
                    MAX: {Math.floor(record.oneRM)}kg
                  </div>
                  
                  {/* 実際の記録内容 */}
                  <div style={{ textAlign: 'right', fontSize: '0.9rem', color: '#555' }}>
                    {record.date} に記録<br/>
                    <strong>{record.weight}kg × {record.reps}回</strong>
                    {record.side && <span> ({record.side})</span>}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p style={{ textAlign: 'center' }}>記録がまだありません</p>
        )}
      </div>

      <div style={{ marginTop: '40px', textAlign: 'center' }}>
        <Link to="/" style={{ color: '#007bff', textDecoration: 'none', fontWeight: 'bold' }}>
          トップに戻る
        </Link>
      </div>
    </div>
  );
}