import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'down' }) {
  return (
    <Card className="stat-card">
      <div className="label">{label}</div>
      <div className={`value ${tone || ''}`}>{value}</div>
      {sub ? <div className={`sub ${tone || ''}`}>{sub}</div> : null}
    </Card>
  );
}

export function SectionTitle({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {aside ? <span>{aside}</span> : null}
    </div>
  );
}
