import { FormEvent, useState } from 'react';
import { addSmartEntry } from '../services/api';

export function SmartEntry() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || busy) return;
    setBusy(true);
    setStatus('');
    try {
      const result = await addSmartEntry(clean);
      setText('');
      setStatus(result.warnings?.length ? `${result.message} ${result.warnings.join(' ')}` : result.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not add this transaction.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form className="smart-entry" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter your financial transactions here"
          aria-label="Enter your financial transactions here"
          autoComplete="off"
        />
        <button type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add'}</button>
      </form>
      <div className="smart-hint">Try: “Spent ₹850 on dinner”, “Salary received ₹1,20,000”, “Invested ₹15,000 in Nifty ETF”, or “Paid ₹20,000 student loan EMI”.</div>
      {status ? <div className="toast" role="status">{status}</div> : null}
    </div>
  );
}
