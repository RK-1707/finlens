import { useMemo, useState } from 'react';
import type { FinLensData } from '../types';
import { ActivityList } from '../components/ActivityList';
import { Card, SectionTitle, StatCard } from '../components/Card';
import { DonutChart } from '../components/DonutChart';
import { LineChart } from '../components/LineChart';
import { derive, inr, pct, toDate } from '../lib/finance';

type RangeKey = '1M' | '3M' | '1Y' | 'ALL';

export function Investments({ data }: { data: FinLensData }) {
  const m = derive(data);
  const [range, setRange] = useState<RangeKey>('1Y');
  const ranked = [...data.holdings].sort((a, b) => pct(b.current - b.invested, b.invested) - pct(a.current - a.invested, a.invested));
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const topThreeValue = [...data.holdings].sort((a, b) => b.current - a.current).slice(0, 3).reduce((a, h) => a + h.current, 0);
  const concentration = pct(topThreeValue, m.portfolioValue);
  const realized = data.summary?.realizedInvestmentGain || 0;
  const investmentIncome = data.summary?.investmentIncomeTotal || 0;

  const performanceData = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(0);
    if (range === '1M') cutoff.setTime(now.getTime() - 31 * 86400000);
    if (range === '3M') cutoff.setTime(now.getTime() - 93 * 86400000);
    if (range === '1Y') cutoff.setTime(now.getTime() - 366 * 86400000);
    return [...data.portfolioSnapshots]
      .filter((s) => range === 'ALL' || toDate(s.occurredAt) >= cutoff)
      .sort((a, b) => toDate(a.occurredAt).getTime() - toDate(b.occurredAt).getTime())
      .map((s) => ({ label: toDate(s.occurredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }), value: s.portfolioValue }));
  }, [data.portfolioSnapshots, range]);

  const investmentActivity = data.transactions.filter((tx) => ['investment_buy', 'investment_sell', 'investment_income'].includes(tx.type) || tx.category === 'Investments' || tx.category === 'Investment Income');
  const buys = data.monthTransactions.filter((tx) => tx.type === 'investment_buy').reduce((a, tx) => a + tx.amount, 0);
  const sells = data.monthTransactions.filter((tx) => tx.type === 'investment_sell').reduce((a, tx) => a + tx.amount, 0);
  const incomeThisMonth = data.monthTransactions.reduce((a, tx) => a + (tx.investmentIncomeDelta || 0), 0);
  const investmentEvents = data.commitments.filter((c) => c.active !== false && c.kind === 'investment');

  const driftRows = data.targets.map((target) => {
    const actual = m.assetAllocation.find((a) => a.label.toLowerCase() === target.label.toLowerCase());
    const actualPct = pct(actual?.value || 0, m.portfolioValue);
    return { ...target, actualPct, drift: actualPct - target.targetPct };
  });

  return (
    <div className="grid">
      <StatCard label="Total Portfolio Value" value={inr(m.portfolioValue)} sub={`${m.investmentReturn >= 0 ? '+' : ''}${m.investmentReturn.toFixed(1)}% vs cost basis`} tone={m.investmentGain >= 0 ? 'up' : 'down'} />
      <StatCard label="Total Invested" value={inr(m.totalInvested)} sub="Cost basis" />
      <StatCard label="Total Gain / Loss" value={inr(m.investmentGain)} sub={`${m.investmentReturn >= 0 ? '+' : ''}${m.investmentReturn.toFixed(1)}%`} tone={m.investmentGain >= 0 ? 'up' : 'down'} />
      <StatCard label="Tracked Holdings" value={String(data.holdings.length)} sub="Stocks, funds, ETFs, metals and more" />

      <Card className="span-5">
        <SectionTitle title="Asset Allocation" aside="Diversification" />
        <DonutChart segments={m.assetAllocation} emptyText="Add investments to see allocation." />
        <div className="sub">Sector, geography and market-level diversification can be added when a verified market-data source or manual metadata is configured.</div>
      </Card>

      <Card className="span-7">
        <SectionTitle title="Holdings" aside="All holdings · Performance" />
        {data.holdings.length ? (
          <div className="table-wrap"><table><thead><tr><th>Investment</th><th>Type</th><th>Invested</th><th>Current</th><th>Return</th></tr></thead><tbody>
            {data.holdings.map((h) => {
              const r = pct(h.current - h.invested, h.invested);
              return <tr key={h.id}><td>{h.name}</td><td>{h.type}</td><td>{inr(h.invested)}</td><td>{inr(h.current)}</td><td className={r >= 0 ? 'up' : 'down'}>{r >= 0 ? '+' : ''}{r.toFixed(1)}%</td></tr>;
            })}
          </tbody></table></div>
        ) : <div className="empty-state compact">No holdings yet. Example: “Invested ₹15,000 in Nifty ETF”.</div>}
      </Card>

      <Card className="span-8">
        <div className="section-title"><h2>Portfolio Performance</h2><div className="range-tabs">{(['1M','3M','1Y','ALL'] as RangeKey[]).map((r) => <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r === 'ALL' ? 'All' : r}</button>)}</div></div>
        <LineChart data={performanceData} />
        <div className="sub">This chart uses FinLens valuation snapshots. It never substitutes Gemini-generated prices for market data.</div>
      </Card>

      <Card className="span-4">
        <SectionTitle title="Benchmark Comparison" aside="Optional" />
        <div className="empty-state compact">No verified benchmark price feed is configured. Once a market-data provider is connected, FinLens can compare the same time range against a selected benchmark such as Nifty 50.</div>
      </Card>

      <StatCard label="Realized Gain / Loss" value={inr(realized)} sub="From tracked investment sales" tone={realized >= 0 ? 'up' : 'down'} />
      <StatCard label="Unrealized Gain / Loss" value={inr(m.investmentGain)} sub="Current value − remaining cost basis" tone={m.investmentGain >= 0 ? 'up' : 'down'} />
      <StatCard label="Dividend / Interest Income" value={inr(investmentIncome)} sub="Tracked investment income" tone="up" />
      <StatCard label="Top-3 Concentration" value={`${concentration.toFixed(1)}%`} sub="Share of portfolio in three largest holdings" />

      <Card className="span-6">
        <SectionTitle title="Investment Cash Flows" aside="This month" />
        <div className="metric-list"><div><span>Purchases / contributions</span><strong>{inr(buys)}</strong></div><div><span>Sales / withdrawals</span><strong>{inr(sells)}</strong></div><div><span>Dividends / interest</span><strong>{inr(incomeThisMonth)}</strong></div><div><span>Net invested cash flow</span><strong>{inr(buys - sells)}</strong></div></div>
      </Card>

      <Card className="span-6">
        <SectionTitle title="Best / Worst & Concentration" aside="Current holdings" />
        {data.holdings.length ? <div className="metric-list"><div><span>Best performer</span><strong className="up">{best.name} · {pct(best.current - best.invested, best.invested).toFixed(1)}%</strong></div><div><span>Weakest performer</span><strong className={worst.current >= worst.invested ? 'up' : 'down'}>{worst.name} · {pct(worst.current - worst.invested, worst.invested).toFixed(1)}%</strong></div><div><span>Top 3 holdings</span><strong>{concentration.toFixed(1)}% of portfolio</strong></div></div> : <div className="empty-state compact">Add holdings to calculate concentration and performance rankings.</div>}
      </Card>

      <Card className="span-7">
        <SectionTitle title="Financial Goals" aside="Linked savings & investments" />
        {data.goals.length ? data.goals.map((g) => {
          const progress = pct(g.currentAmount, g.targetAmount);
          return <div className="goal" key={g.id}><div className="goal-top"><span>{g.name}</span><strong>{Math.min(100, progress).toFixed(0)}%</strong></div><div className="track"><div className="fill" style={{ width: `${Math.min(100, progress)}%` }} /></div><div className="goal-meta">{inr(g.currentAmount)} / {inr(g.targetAmount)}{g.targetDate ? ` · target ${g.targetDate}` : ''}</div></div>;
        }) : <div className="empty-state compact">No financial goals yet. Example: “Create a Europe Trip goal of ₹1,20,000 by Dec 2027”.</div>}
      </Card>

      <Card className="span-5">
        <SectionTitle title="Investment Insights" aside="FinLens AI-ready" />
        <div className="insight-text">{data.holdings.length ? `${m.assetAllocation[0]?.label || 'Your largest asset group'} is your largest allocation at ${pct(m.assetAllocation[0]?.value || 0, m.portfolioValue).toFixed(1)}%. Your three largest holdings represent ${concentration.toFixed(1)}% of the portfolio. Current values remain manual until a verified market-data provider is configured.` : 'Add holdings to generate portfolio concentration, gain/loss and diversification insights.'}</div>
      </Card>

      <Card className="span-6">
        <SectionTitle title="Rebalancing / Allocation Drift" aside="Optional targets" />
        {driftRows.length ? <div className="metric-list">{driftRows.map((r) => <div key={r.id}><span>{r.label}</span><strong className={Math.abs(r.drift) <= 3 ? 'up' : ''}>{r.actualPct.toFixed(1)}% actual · {r.targetPct.toFixed(1)}% target · {r.drift >= 0 ? '+' : ''}{r.drift.toFixed(1)} pp</strong></div>)}</div> : <div className="empty-state compact">No target allocation is set. Example: “Set target allocation Stocks 50%”.</div>}
      </Card>

      <Card className="span-6">
        <SectionTitle title="Upcoming Investment Income & Events" aside="Tracked" />
        {investmentEvents.length ? <div className="list">{investmentEvents.map((e) => <div className="list-row" key={e.id}><div><div className="list-main">{e.name}</div><div className="list-sub">{e.dueLabel || e.frequency || 'Upcoming'}</div></div><div className="list-amount">{e.amount ? inr(e.amount) : '—'}</div></div>)}</div> : <div className="empty-state compact">No upcoming dividend, interest, coupon or maturity events are tracked.</div>}
      </Card>

      <Card className="span-12">
        <SectionTitle title="Recent Investment Activity" aside="Latest" />
        <ActivityList items={investmentActivity} />
      </Card>
    </div>
  );
}
