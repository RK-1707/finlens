import { FormEvent, useEffect, useState } from 'react';
import type { FinLensData } from '../types';
import { ActivityList } from '../components/ActivityList';
import { Card, SectionTitle, StatCard } from '../components/Card';
import { DonutChart } from '../components/DonutChart';
import { clamp, COLORS, derive, inr, payoffMonths, pct } from '../lib/finance';

export function Loans({ data }: { data: FinLensData }) {
  const m = derive(data);
  const [loanId, setLoanId] = useState(data.loans[0]?.id || '');
  const [extra, setExtra] = useState(5000);
  const [result, setResult] = useState('Add an extra monthly payment to estimate potential interest and tenure savings.');
  const monthlyEmi = data.loans.reduce((a, l) => a + l.emi, 0);
  const payoff = data.loans.map((l) => payoffMonths(l).months).filter(Number.isFinite);
  const estimatedInterest = data.loans.reduce((a, l) => {
    const p = payoffMonths(l);
    return a + (Number.isFinite(p.interest) ? p.interest : 0);
  }, 0);
  const debtFreeYear = payoff.length ? new Date().getFullYear() + Math.ceil(Math.max(...payoff) / 12) : null;
  const next = data.loans.find((l) => l.nextDue && l.nextDue !== 'Not set') || data.loans[0];
  const debtSegments = data.loans.filter((l) => l.outstanding > 0).map((l, i) => ({ label: l.name, value: l.outstanding, color: COLORS[i % COLORS.length] }));
  const loanActivity = data.transactions.filter((tx) => tx.type === 'loan_emi' || tx.type === 'loan_received' || tx.category === 'Loans');
  const paymentHistory = loanActivity.filter((tx) => tx.type === 'loan_emi');

  useEffect(() => {
    if (!loanId || !data.loans.some((l) => l.id === loanId)) setLoanId(data.loans[0]?.id || '');
  }, [data.loans, loanId]);

  function simulate(e: FormEvent) {
    e.preventDefault();
    const loan = data.loans.find((l) => l.id === loanId) || data.loans[0];
    if (!loan) { setResult('Add a loan first.'); return; }
    const base = payoffMonths(loan);
    const faster = payoffMonths(loan, extra);
    if (!Number.isFinite(base.months) || !Number.isFinite(faster.months)) { setResult('A payoff estimate is unavailable because the EMI or rate information is incomplete.'); return; }
    setResult(`Paying ${inr(extra)} extra per month could shorten repayment by about ${Math.max(0, base.months - faster.months)} months and reduce estimated remaining interest by about ${inr(Math.max(0, base.interest - faster.interest))}.`);
  }

  return (
    <div className="grid">
      <StatCard label="Total Outstanding Debt" value={inr(m.debt)} sub="Across active liabilities" />
      <StatCard label="Monthly EMI Commitment" value={inr(monthlyEmi)} sub="Across active loans" />
      <StatCard label="Next EMI Due" value={next ? inr(next.emi) : '—'} sub={next ? `${next.name} · ${next.nextDue || 'date not set'}` : 'No EMI due'} />
      <StatCard label="Projected Debt-Free" value={debtFreeYear ? String(debtFreeYear) : '—'} sub="At current repayment pace" />

      <Card className="span-7"><SectionTitle title="Your Loans" aside="Repayment progress" />
        {data.loans.length ? data.loans.map((l) => {
          const progress = l.original > 0 ? clamp(pct(l.original - l.outstanding, l.original)) : 0;
          return <div className="loan" key={l.id}><div className="loan-head"><div><div className="loan-name">{l.name}</div><div className="loan-info">{inr(l.outstanding)} remaining<br />{inr(l.emi)} EMI<br />{l.rate.toFixed(2)}% interest</div></div><div className="loan-progress"><strong>{Math.round(progress)}%</strong><span>repaid</span></div></div><div className="track"><div className="fill" style={{ width: `${progress}%` }} /></div></div>;
        }) : <div className="empty-state compact">No loans yet. Example: “I have a student loan of ₹12 lakh at 6.95%, EMI ₹20,000”.</div>}
      </Card>

      <Card className="span-5"><SectionTitle title="Prepayment Simulator" aside="Estimate" /><form className="form-grid" onSubmit={simulate}><input type="number" min="0" step="500" value={extra} onChange={(e) => setExtra(Number(e.target.value))} aria-label="Extra monthly payment" /><select value={loanId} onChange={(e) => setLoanId(e.target.value)} aria-label="Loan"><option value="">Select loan</option>{data.loans.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select><button type="submit">Calculate impact</button></form><div className="insight-text small">{result}</div></Card>

      <Card className="span-4 stat-card"><div className="label">Estimated Remaining Interest</div><div className="value">{inr(estimatedInterest)}</div><div className="sub">Approximation at current EMI/rates</div></Card>
      <Card className="span-8"><SectionTitle title="Debt Breakdown" aside="By outstanding balance" /><DonutChart segments={debtSegments} emptyText="Add loans to see debt allocation." /></Card>

      <Card className="span-6"><SectionTitle title="Upcoming EMIs" aside="Tracked" />{data.loans.length ? <div className="list">{data.loans.map((l) => <div className="list-row" key={l.id}><div><div className="list-main">{l.name} EMI</div><div className="list-sub">{l.nextDue || 'Due date not set'}</div></div><div className="list-amount">{inr(l.emi)}</div></div>)}</div> : <div className="empty-state compact">No active EMIs.</div>}</Card>
      <Card className="span-6"><SectionTitle title="Debt Insights" aside="FinLens AI-ready" /><div className="insight-text">{data.loans.length ? `Your total outstanding debt is ${inr(m.debt)}. ${[...data.loans].sort((a, b) => b.rate - a.rate)[0]?.name || 'Your highest-rate loan'} carries the highest tracked interest rate. Extra-payment estimates use amortization math and are informational, not financial advice.` : 'Add loans to calculate debt-free projections and prepayment scenarios.'}</div></Card>

      <Card className="span-6"><SectionTitle title="Payment History" aside="Recent EMIs" /><ActivityList items={paymentHistory} /></Card>
      <Card className="span-6"><SectionTitle title="Recent Loan Activity" aside="Latest" /><ActivityList items={loanActivity} /></Card>
    </div>
  );
}
