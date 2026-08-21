import { inr } from '../lib/finance';

export function BarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars" aria-label="Past seven days expenses">
      {data.map((d) => (
        <div className="bar-col" key={d.label} title={`${d.label}: ${inr(d.value)}`}>
          <div className="bar-value">{d.value > 0 ? inr(d.value) : ''}</div>
          <div className="bar" style={{ height: `${Math.max(5, (d.value / max) * 100)}%` }} />
          <div className="bar-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}
