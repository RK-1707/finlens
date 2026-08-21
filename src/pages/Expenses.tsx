import type { FinLensData } from '../types';
import { ActivityList } from '../components/ActivityList';
import { Card, SectionTitle, StatCard } from '../components/Card';
import { DonutChart } from '../components/DonutChart';
import { derive, inr, pct, clamp } from '../lib/finance';

export function Expenses({ data }: { data: FinLensData }) {
  const m = derive(data);
  const categoryMap = Object.fromEntries(m.categorySpending.map((x) => [x.label, x.value]));
  const essentialTotal = m.essential + m.discretionary || 1;
  const essentialPct = pct(m.essential, essentialTotal);
  const top = m.categorySpending.slice(0, 2).map((s) => s.label).join(' and ');
  const nearestBudget = data.budgets
    .map((b) => ({ ...b, used: pct(categoryMap[b.category] || 0, b.limit) }))
    .sort((a, b) => b.used - a.used)[0];

  return (
    <div className="grid">
      <StatCard label="Expenses This Month" value={inr(m.monthExpenses)} sub="General spending recorded this month" />
      <StatCard label="Cash Remaining" value={inr(m.cash)} sub="Current available cash" />
      <StatCard label="Monthly Budget" value={m.monthlyBudget ? inr(m.monthlyBudget) : 'Not set'} sub="Used for safe-to-spend calculation" />

      <Card className="span-6">
        <SectionTitle title="Budgets" aside="Monthly limits" />
        {data.budgets.length ? data.budgets.map((b) => {
          const spent = categoryMap[b.category] || 0;
          const used = pct(spent, b.limit);
          return (
            <div className="budget" key={b.id}>
              <div className="budget-head"><span>{b.category}</span><span>{inr(spent)} / {inr(b.limit)} · {Math.round(used)}%</span></div>
              <div className="track"><div className="fill" style={{ width: `${clamp(used)}%` }} /></div>
            </div>
          );
        }) : <div className="empty-state compact">No category budgets yet. Add one with Smart Entry, for example: “Set Food & Dining budget ₹10,000”.</div>}
      </Card>

      <Card className="span-6">
        <SectionTitle title="Recurring Payments & Subscriptions" aside="Upcoming" />
        {data.commitments.length ? (
          <div className="list">
            {data.commitments.filter((c) => c.active !== false).map((c) => (
              <div className="list-row" key={c.id}>
                <div><div className="list-main">{c.name}</div><div className="list-sub">{c.frequency || 'Recurring'}{c.dueDay ? ` · day ${c.dueDay}` : ''}</div></div>
                <div className="list-amount">{inr(c.amount)}</div>
              </div>
            ))}
          </div>
        ) : <div className="empty-state compact">No recurring payments tracked yet.</div>}
      </Card>

      <Card className="span-12">
        <SectionTitle title="Where the Money Is Getting Spent" aside="Category view" />
        <DonutChart segments={m.categorySpending} emptyText="Add expenses to build your spending breakdown." />
      </Card>

      <Card className="span-12">
        <SectionTitle title="Recent Activity" aside="Latest 7" />
        <ActivityList items={data.transactions} />
      </Card>

      <StatCard label="Safe-to-Spend / Remaining Day" value={m.safeToSpend == null ? 'Set a budget' : inr(m.safeToSpend)} sub="Based on monthly budget and remaining days" />
      <Card className="insight-card"><div className="label">Detailed Spending Insights</div><div className="insight-text">{m.monthExpenses ? `${top || 'Your recorded categories'} are currently the largest spending areas.${nearestBudget ? ` ${nearestBudget.category} is closest to its limit at ${Math.round(nearestBudget.used)}%.` : ''}` : 'Add expenses to generate spending insights.'}</div></Card>
      <StatCard label="Month-end Spending Projection" value={inr(m.monthEndProjection)} sub="Projected at the current recorded pace" />
      <Card className="insight-card"><div className="label">Essential vs Discretionary</div><div className="allocation two"><span style={{ width: `${essentialPct}%` }} /><span style={{ width: `${100 - essentialPct}%` }} /></div><div className="sub">Essential {Math.round(essentialPct)}% · Discretionary {Math.round(100 - essentialPct)}%</div></Card>
    </div>
  );
}
