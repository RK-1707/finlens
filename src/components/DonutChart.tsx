import type { Segment } from '../types';
import { pct } from '../lib/finance';

export function DonutChart({ segments, emptyText = 'No data yet' }: { segments: Segment[]; emptyText?: string }) {
  const clean = segments.filter((s) => Number.isFinite(s.value) && s.value > 0);
  const total = clean.reduce((a, s) => a + s.value, 0);
  if (!total) return <div className="empty-state compact">{emptyText}</div>;

  let cursor = 0;
  const gradient = clean
    .map((s) => {
      const start = cursor;
      cursor += pct(s.value, total);
      return `${s.color || '#35a7d9'} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    })
    .join(',');

  return (
    <div className="donut-layout">
      <div className="donut" style={{ background: `conic-gradient(${gradient})` }} aria-label="Distribution chart" />
      <div className="legend">
        {clean.map((s) => (
          <div className="legend-row" key={s.label}>
            <span className="dot" style={{ background: s.color || '#35a7d9' }} />
            <span>{s.label}</span>
            <strong>{pct(s.value, total).toFixed(1)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
