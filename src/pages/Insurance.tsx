import type { FinLensData } from '../types';
import { ActivityList } from '../components/ActivityList';
import { Card, SectionTitle, StatCard } from '../components/Card';
import { DonutChart } from '../components/DonutChart';
import { compactInr, inr, COLORS } from '../lib/finance';

export function Insurance({ data }: { data: FinLensData }) {
  const annualPremium = data.policies.reduce((a, p) => a + p.annualPremium, 0);
  const life = data.policies.filter((p) => /life/i.test(p.type)).reduce((a, p) => a + p.cover, 0);
  const health = data.policies.filter((p) => /health/i.test(p.type)).reduce((a, p) => a + p.cover, 0);
  const categories = new Set(data.policies.map((p) => p.type)).size;
  const coverMap = new Map<string, number>();
  data.policies.forEach((p) => coverMap.set(p.type, (coverMap.get(p.type) || 0) + p.cover));
  const segments = [...coverMap.entries()].map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }));
  const next = data.policies.find((p) => p.nextDue && p.nextDue !== 'Not set');
  const insuranceActivity = data.transactions.filter((tx) => tx.type === 'insurance_premium' || tx.category === 'Insurance');

  return (
    <div className="grid">
      <StatCard label="Active Policies" value={String(data.policies.length)} sub={`Across ${categories} categories`} />
      <StatCard label="Annual Premium" value={inr(annualPremium)} sub="Current tracked commitment" />
      <StatCard label="Total Life Cover" value={compactInr(life)} sub="Not counted in net worth" />
      <StatCard label="Total Health Cover" value={compactInr(health)} sub="Across active health policies" />

      <Card className="span-4"><SectionTitle title="Next Premium Due" aside={next?.nextDue || '—'} /><div className="value">{next ? inr(next.premiumAmount || next.annualPremium) : '—'}</div><div className="sub">{next ? `${next.name} · Upcoming` : 'No premium due date tracked'}</div></Card>
      <Card className="span-8"><SectionTitle title="My Policies" aside="Compact view" />
        {data.policies.length ? <div className="table-wrap"><table><thead><tr><th>Policy</th><th>Type</th><th>Cover</th><th>Premium</th><th>Next Due</th></tr></thead><tbody>{data.policies.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.type}</td><td>{compactInr(p.cover)}</td><td>{inr(p.premiumAmount || p.annualPremium)} / {p.premiumFrequency || 'Annual'}</td><td>{p.nextDue || 'Not set'}</td></tr>)}</tbody></table></div> : <div className="empty-state compact">No policies yet. Example: “I have a ₹1 crore life policy with ₹25,000 annual premium”.</div>}
      </Card>

      <Card className="span-12"><SectionTitle title="Coverage Breakdown" aside="By insured amount" /><DonutChart segments={segments} emptyText="Add policies to see coverage breakdown." /></Card>
      <Card className="span-12"><SectionTitle title="Insurance Insights" aside="FinLens AI-ready" /><div className="insight-text">{data.policies.length ? `${data.policies.length} active policies are tracked. Insurance cover is shown separately from assets and is never included in net worth. Annual premium commitment is ${inr(annualPremium)}.` : 'Add policies to receive renewal, premium concentration and missing-detail insights.'}</div></Card>

      <Card className="span-12">
        <SectionTitle title="Policy Details" aside="Expandable" />
        {data.policies.length ? <div className="details-list">{data.policies.map((p) => <details key={p.id}><summary><span>{p.name}</span><strong>{p.status || 'Active'}</strong></summary><div className="details-grid"><div><span>Type</span><strong>{p.type}</strong></div><div><span>Coverage</span><strong>{compactInr(p.cover)}</strong></div><div><span>Premium</span><strong>{inr(p.premiumAmount || p.annualPremium)} / {p.premiumFrequency || 'Annual'}</strong></div><div><span>Next due</span><strong>{p.nextDue || 'Not set'}</strong></div><div><span>Policy number</span><strong>{p.policyNumber || 'Not provided'}</strong></div><div><span>Start date</span><strong>{p.startDate || 'Not provided'}</strong></div><div><span>Maturity / end date</span><strong>{p.endDate || 'Not provided'}</strong></div><div><span>Nominee</span><strong>{p.nominee || 'Not provided'}</strong></div><div><span>Riders / add-ons</span><strong>{p.riders || 'None recorded'}</strong></div><div className="wide"><span>Notes</span><strong>{p.notes || 'No notes'}</strong></div></div></details>)}</div> : <div className="empty-state compact">Policy details will appear here after a policy is added.</div>}
      </Card>

      <Card className="span-12"><SectionTitle title="Recent Insurance Activity" aside="Latest" /><ActivityList items={insuranceActivity} /></Card>
    </div>
  );
}
