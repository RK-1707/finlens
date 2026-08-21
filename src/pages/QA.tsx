import { FormEvent, useState } from 'react';
import { Card, SectionTitle } from '../components/Card';
import { askFinLens } from '../services/api';
import type { FinLensData } from '../types';

type Message = { role: 'user' | 'ai'; text: string };

export function QA({ data }: { data: FinLensData }) {
  const [messages, setMessages] = useState<Message[]>([{ role: 'ai', text: 'Ask me about your spending, investments, insurance, loans, budgets, goals, net worth, or upcoming payments.' }]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setQuestion('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const answer = await askFinLens(q, data);
      setMessages((m) => [...m, { role: 'ai', text: answer }]);
    } catch (error) {
      setMessages((m) => [...m, { role: 'ai', text: error instanceof Error ? error.message : 'I could not answer that right now.' }]);
    } finally {
      setBusy(false);
    }
  }

  return <Card className="qa-card"><SectionTitle title="Q&A with FinLens" aside="Uses your signed-in FinLens data" /><div className="chat">{messages.map((m, i) => <div key={i} className={`bubble ${m.role === 'user' ? 'user-bubble' : 'ai-bubble'}`}>{m.text}</div>)}</div><form className="qa-input" onSubmit={submit}><input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask anything about your finances…" autoComplete="off" /><button type="submit" disabled={busy}>{busy ? 'Thinking…' : 'Ask'}</button></form></Card>;
}
