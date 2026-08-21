import type { FinTransaction } from '../types';
import { inr, toDate } from '../lib/finance';

export function ActivityList({ items, limit = 7 }: { items: FinTransaction[]; limit?: number }) {
  const rows = items.slice(0, limit);
  if (!rows.length) return <div className="empty-state compact">No transactions yet. Add one from Smart Entry.</div>;

  return (
    <div className="list">
      {rows.map((tx) => (
        <div className="list-row" key={tx.id}>
          <div>
            <div className="list-main">{tx.displayName}</div>
            <div className="list-sub">{toDate(tx.occurredAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {tx.category}</div>
          </div>
          <div className={`list-amount ${tx.cashDelta > 0 ? 'up' : tx.cashDelta < 0 ? 'down' : ''}`}>
            {tx.cashDelta === 0 ? 'No net change' : `${tx.cashDelta > 0 ? '+' : ''}${inr(tx.cashDelta)}`}
          </div>
        </div>
      ))}
    </div>
  );
}
