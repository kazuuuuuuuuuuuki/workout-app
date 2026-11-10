import { useRef, useState } from 'react';
import { getWorkoutStore, parseBackup, summarizeRecords } from '../data/workoutData';

function downloadJson(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // モバイルでの保存開始に余裕を持たせる。
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

const fileStamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const buttonStyle = { padding: '10px 14px', cursor: 'pointer', borderRadius: '6px', border: '1px solid #aaa', background: '#fff' };

export default function BackupPanel() {
  const inputRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [replaceConflicts, setReplaceConflicts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const exportRecords = (recovery = false) => {
    try {
      setError('');
      const store = getWorkoutStore();
      const text = recovery ? store.exportRecoveryBackup() : store.exportBackup();
      const summary = summarizeRecords(parseBackup(text));
      downloadJson(text, `workout-${recovery ? 'before-restore-' : 'backup-'}${fileStamp()}.json`);
      setMessage(`${summary.days}日・${summary.exercises}種目・${summary.sets}セットを書き出しました。保存先でファイルを確認してください。`);
    } catch (e) {
      setError(`バックアップを作成できませんでした。${e.message}`);
    }
  };

  const selectFile = async event => {
    const file = event.target.files?.[0];
    setSelection(null);
    setReplaceConflicts(false);
    setError('');
    setMessage('');
    if (!file) return;
    setBusy(true);
    try {
      const data = parseBackup(await file.text());
      const summary = summarizeRecords(data);
      if (summary.days === 0) throw new Error('このファイルには取り込む記録がありません。');
      const preview = getWorkoutStore().previewRestore(data);
      setSelection({ data, summary, preview });
    } catch (e) {
      setError(e.message);
      if (inputRef.current) inputRef.current.value = '';
    } finally {
      setBusy(false);
    }
  };

  const restore = () => {
    if (!selection || busy) return;
    const conflictCount = selection.preview.conflicts.length;
    const warning = replaceConflicts && conflictCount > 0
      ? `内容の異なる${conflictCount}日分は、日付ごとバックアップの内容に置き換えます。`
      : '同じ日付で内容の異なる記録は、端末にある内容を残します。';
    if (!window.confirm(`${selection.summary.days}日分のファイルを取り込みます。${warning} 続けますか？`)) return;
    setBusy(true);
    try {
      getWorkoutStore().restore(selection.data, {
        expectedRaw: selection.preview.raw,
        replaceConflicts,
      });
      window.alert('取り込みが完了しました。記録を読み直します。');
      window.location.reload();
    } catch (e) {
      setError(`取り込みを完了できませんでした。${e.message}`);
      setSelection(null);
      if (inputRef.current) inputRef.current.value = '';
    } finally {
      setBusy(false);
    }
  };

  return (
    <details style={{ marginTop: '30px', padding: '16px', background: '#f7f8fa', border: '1px solid #ddd', borderRadius: '8px', textAlign: 'left' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>記録のバックアップ・復元</summary>
      <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>この端末の全日付の記録を1つのファイルに保存できます。書き出しても記録は消えません。記録している端末ごとに、普段と同じ開き方で保存してください。</p>
      <button type="button" style={buttonStyle} onClick={() => exportRecords()}>全記録をバックアップ保存</button>
      <p style={{ fontSize: '0.85rem', color: '#555' }}>ファイルが開いた場合は、共有メニューなどから「ファイルに保存」を選んでください。バックアップファイルはGitHubにアップロードせず、各自で保管してください。</p>
      <hr style={{ border: 0, borderTop: '1px solid #ddd', margin: '18px 0' }} />
      <label style={{ display: 'block', marginBottom: '10px' }}>
        バックアップファイルを選択
        <input ref={inputRef} type="file" accept=".json,application/json" onChange={selectFile} disabled={busy} style={{ display: 'block', marginTop: '8px', maxWidth: '100%' }} />
      </label>
      <p style={{ fontSize: '0.85rem', color: '#555' }}>選択だけでは書き込みません。ファイルにない日付の記録は残します。</p>
      {selection && (
        <div style={{ padding: '12px', background: '#fff', borderRadius: '6px', lineHeight: 1.7 }}>
          <p>ファイル内：{selection.summary.days}日・{selection.summary.exercises}種目・{selection.summary.sets}セット</p>
          <p>新規の日付：{selection.preview.addedDays}日／同一内容：{selection.preview.identicalDays}日／内容の異なる日付：{selection.preview.conflicts.length}日</p>
          {selection.preview.conflicts.length > 0 && <>
            <p style={{ overflowWrap: 'anywhere' }}>内容の異なる日付：{selection.preview.conflicts.join('、')}</p>
            <label style={{ display: 'block', marginBottom: '12px' }}>
              <input type="checkbox" checked={replaceConflicts} onChange={e => setReplaceConflicts(e.target.checked)} />
              同じ日付の記録を、日付ごとバックアップの内容に置き換える
            </label>
            <p style={{ fontSize: '0.85rem' }}>チェックしなければ、現在の端末にある記録を優先します。</p>
          </>}
          <button type="button" style={buttonStyle} onClick={restore} disabled={busy}>内容を確認して取り込む</button>
        </div>
      )}
      <button type="button" style={{ ...buttonStyle, marginTop: '16px', fontSize: '0.85rem' }} onClick={() => exportRecords(true)}>復元前に退避した記録を保存</button>
      {busy && <p role="status">読み込み中です…</p>}
      {message && <p role="status" style={{ color: '#17652d', lineHeight: 1.6 }}>{message}</p>}
      {error && <p role="alert" style={{ color: '#b00020', lineHeight: 1.6 }}>{error}</p>}
    </details>
  );
}
