export function Logo({ large = false }: { large?: boolean }) {
  return (
    <div className={`brand ${large ? 'brand-large' : ''}`} aria-label="FinLens">
      <div className="brand-mark" aria-hidden="true">
        <span className="rupee">₹</span>
        <span className="chart-bars" />
        <span className="chart-line" />
      </div>
      <div className="brand-name"><span>Fin</span><strong>Lens</strong></div>
    </div>
  );
}
