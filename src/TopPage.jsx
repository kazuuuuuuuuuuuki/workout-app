import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './CalendarStyle.css'; 

export default function TopPage() {
  // 日付フォーマット用の関数
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = ('0' + (date.getMonth() + 1)).slice(-2);
    const d = ('0' + date.getDate()).slice(-2);
    return `${y}-${m}-${d}`;
  };

  const today = formatDate(new Date());

  const [date, setDate] = useState(today);
  const [dateObj, setDateObj] = useState(new Date());
  
  const [dailyExercises, setDailyExercises] = useState([]);
  const [recordedDates, setRecordedDates] = useState([]);
  
  const [motivationMessage, setMotivationMessage] = useState("読み込み中...");

  // データ読み込み（カレンダー用）
  useEffect(() => {
    const allData = JSON.parse(localStorage.getItem('workout_data_v2')) || {};
    
    setRecordedDates(Object.keys(allData));

    if (allData[date]) {
      setDailyExercises(allData[date]);
    } else {
      setDailyExercises([]);
    }
  }, [date]);

  // サーバーから名言取得
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/.netlify/functions/motivation");
        const data = await response.json();
        setMotivationMessage(data.message);
      } catch (error) {
        console.error("サーバーエラー:", error);
        setMotivationMessage("筋トレ頑張ろう！");
      }
    })();
  }, []);

  const handleDateChange = (newDate) => {
    setDateObj(newDate);
    setDate(formatDate(newDate));
  };

  return (
    <div className="page-container" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1 className="app-title" style={{ textAlign: 'center', marginBottom: '30px' }}>筋トレ記録アプリ</h1>

      {/* サーバーからのメッセージ表示エリア */}
      <div style={{ textAlign: 'center', marginBottom: '20px', color: '#007bff', fontWeight: 'bold', fontSize: '1.2rem' }}>
        {motivationMessage}
      </div>

      {/* カレンダーエリア */}
      <div className="calendar-container" style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
        <Calendar
          onChange={handleDateChange}
          value={dateObj}
          locale="ja-JP"
          tileClassName={({ date, view }) => {
            if (view === 'month') {
              const dateString = formatDate(date);
              if (recordedDates.includes(dateString)) {
                return 'highlight-day';
              }
            }
          }}
        />
      </div>

      {/* ★ここに追加しました：自己ベストページへのボタン */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <Link 
          to="/max"
          style={{ 
            display: 'inline-block',
            padding: '10px 25px', 
            backgroundColor: '#d4af37', // 金色
            color: '#fff', 
            textDecoration: 'none', 
            borderRadius: '25px', 
            fontWeight: 'bold',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
        >
           種目別 自己ベストを見る
        </Link>
      </div>

      {/* 選択中の日付表示 */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{ borderBottom: '2px solid #ddd', display: 'inline-block', paddingBottom: '5px' }}>
          {date} の記録
        </h2>
      </div>

      {/* 過去の記録表示エリア */}
      <div style={{ marginBottom: '40px' }}>
        {dailyExercises.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {dailyExercises.map((ex) => (
              <div key={ex.id} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{ex.name}</span>
                  <span style={{ color: '#666' }}>全 {ex.sets.length} セット</span>
                </div>
                <div style={{ marginTop: '5px', fontSize: '0.9rem', color: '#555' }}>
                    {ex.sets.map((s, i) => (
                      <span key={s.id} style={{ marginRight: '10px' }}>
                        {i + 1}: {s.weight}kg×{s.reps}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#888', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <p>記録はありません</p>
          </div>
        )}
      </div>

      {/* スタートボタンエリア */}
      <div className="menu" style={{ textAlign: 'center' }}>
        <Link 
          to="/record" 
          state={{ targetDate: date }} 
          className="start-button"
          style={{ 
            display: 'inline-block',
            padding: '15px 60px', 
            backgroundColor: '#333', 
            color: '#fff', 
            textDecoration: 'none', 
            borderRadius: '30px', 
            fontSize: '1.2rem',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
          }}
        >
          記録をつける / 編集する
        </Link>
      </div>
    </div>
  );
}