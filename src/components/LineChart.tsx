import { inr } from '../lib/finance';

export function LineChart({ data }: { data: Array<{ label: string; value: number }> }) {
  if (data.length < 2) return <div className="empty-state compact">Performance history will appear after at least two portfolio valuation points are recorded.</div>;
  const width = 760, height = 220, pad = 18;
  const values = data.map((d) => d.value);
  const min = Math.min(...values), max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = data.map((d, i) => {
    const x = pad + (i / Math.max(1, data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((d.value - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <div className="line-chart-wrap">
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Portfolio performance history">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="line-chart-meta"><span>{data[0].label} · {inr(data[0].value)}</span><span>{data[data.length - 1].label} · {inr(data[data.length - 1].value)}</span></div>
    </div>
  );
}
