import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TopPage from './TopPage';
import RecordPage from './RecordPage';
// ★追加1：新しく作ったページを読み込む
import MaxRecordsPage from './MaxRecordsPage';
import '../style.css'; 

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* URLが「/」のときは TopPage を表示 */}
        <Route path="/" element={<TopPage />} />
        
        {/* URLが「/record」のときは RecordPage を表示 */}
        <Route path="/record" element={<RecordPage />} />

        {/* ★追加2：URLが「/max」のときは MaxRecordsPage を表示 */}
        <Route path="/max" element={<MaxRecordsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;