import type { FinLensData } from '../types';
import { BarChart } from '../components/BarChart';
import { Card, SectionTitle, StatCard } from '../components/Card';
import { DonutChart } from '../components/DonutChart';
import { SmartEntry } from '../components/SmartEntry';
import { derive, inr } from '../lib/finance';

export function Dashboard({ data }: { data: FinLensData }) {
  const m = derive(data);
  const incomeBase = Math.max(m.monthIncome, m.monthExpenses + m.monthInvestments + m.monthInsurance + m.monthLoans + m.monthOther, 1);
  const allocated = m.monthExpenses + m.monthInvestments + m.monthInsurance + m.monthLoans + m.monthOther;
  const unallocated = Math.max(0, m.monthIncome - allocated);
  const allocation = [
    ['Expenses', m.monthExpenses],
    ['Investments', m.monthInvestments],
    ['Debt & Insurance', m.monthLoans + m.monthInsurance],
    ['Unallocated', unallocated],
  ] as const;

  return (
    <>
      <SmartEntry />
      <div className="grid dashboard-grid">
        <StatCard label="Net Worth" value={inr(m.netWorth)} sub="Cash + investments − liabilities" tone={m.netWorth >= 0 ? 'up' : 'down'} />
        <StatCard label="Cash in Hand" value={inr(m.cash)} sub="Opening balance + recorded cash flows" />
        <StatCard label="Month Expenses" value={inr(m.monthExpenses)} sub="General spending this month" />
        <StatCard label="Investments" value={inr(m.portfolioValue)} sub="Current tracked portfolio value" tone={m.investmentGain >= 0 ? 'up' : 'down'} />

        <Card className="span-12">
          <SectionTitle title="Where the Money Goes" aside="This month" />
          <DonutChart segments={m.flowSegments} emptyText="No monthly money-flow data yet." />
        </Card>

        <Card className="span-12">
          <SectionTitle title="Past 7 Days Expenses" aside={`${inr(m.dailyExpenses.reduce((a, d) => a + d.value, 0))} total`} />
          <BarChart data={m.dailyExpenses} />
        </Card>

        <Card className="span-7">
          <SectionTitle title="Income Allocation" aside="Actual this month" />
          {m.monthIncome > 0 ? (
            <>
              <div className="allocation">
                {allocation.map(([label, value], i) => <span key={label} style={{ width: `${(value / incomeBase) * 100}%` }} className={`alloc-${i}`} />)}
              </div>
              <div className="allocation-labels">
                {allocation.map(([label, value]) => (
                  <span key={label}>{label}<strong>{((value / incomeBase) * 100).toFixed(1)}%</strong></span>
                ))}
              </div>
            </>
          ) : <div className="empty-state compact">Record income to see how it is allocated.</div>}
        </Card>

        <Card className="span-5">
          <SectionTitle title="Upcoming Financial Commitments" aside="Tracked" />
          {data.commitments.length ? (
            <div className="list">
              {data.commitments.filter((c) => c.active !== false).slice(0, 5).map((c) => (
                <div className="list-row" key={c.id}>
                  <div><div className="list-main">{c.name}</div><div className="list-sub">{c.dueLabel || (c.dueDay ? `Day ${c.dueDay}` : c.frequency || 'Upcoming')}</div></div>
                  <div className="list-amount">{inr(c.amount)}</div>
                </div>
              ))}
            </div>
          ) : <div className="empty-state compact">No upcoming commitments tracked yet.</div>}
        </Card>

      </div>
    </>
  );
}
