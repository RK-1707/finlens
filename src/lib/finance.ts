import type { FinLensData, FinTransaction, Holding, Loan, Segment } from '../types';

export const COLORS = ['#ef6b62', '#35a7d9', '#e7bd55', '#27c278', '#9a7be8', '#ef9d43', '#75808a', '#63c4b1'];

export function inr(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}₹${Math.round(Math.abs(value)).toLocaleString('en-IN')}`;
}

export function compactInr(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(abs % 10_000_000 ? 2 : 0)}Cr`;
  if (abs >= 100_000) return `${sign}₹${(abs / 100_000).toFixed(abs % 100_000 ? 1 : 0)}L`;
  return inr(value);
}

export function pct(value: number, total: number): number {
  return total ? (value / total) * 100 : 0;
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') {
    const v = value as { toDate?: () => Date; seconds?: number };
    if (typeof v.toDate === 'function') return v.toDate();
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function isCurrentMonth(tx: FinTransaction, now = new Date()): boolean {
  const d = toDate(tx.occurredAt);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function assetGroup(h: Holding): string {
  const t = h.type.toLowerCase();
  if (/gold|silver|commodity|metal/.test(t)) return 'Metals & Commodities';
  if (/mutual/.test(t)) return 'Mutual Funds';
  if (/etf/.test(t)) return 'ETFs';
  if (/stock|equity/.test(t)) return 'Stocks';
  if (/debt|bond|deposit|fd/.test(t)) return 'Debt';
  if (/crypto/.test(t)) return 'Crypto';
  if (/real estate|property/.test(t)) return 'Real Estate';
  return 'Other';
}

export function payoffMonths(loan: Loan, extra = 0): { months: number; interest: number } {
  let balance = Math.max(0, loan.outstanding);
  let months = 0;
  let interest = 0;
  const payment = Math.max(0, loan.emi + extra);
  if (balance <= 0) return { months: 0, interest: 0 };
  if (payment <= 0) return { months: Number.POSITIVE_INFINITY, interest: Number.POSITIVE_INFINITY };

  while (balance > 0 && months < 1200) {
    const monthInterest = balance * (Math.max(0, loan.rate) / 100 / 12);
    if (payment <= monthInterest) return { months: Number.POSITIVE_INFINITY, interest: Number.POSITIVE_INFINITY };
    interest += monthInterest;
    const principal = Math.min(balance, payment - monthInterest);
    balance -= principal;
    months += 1;
  }
  return { months, interest };
}

function sum<T>(items: T[], getter: (item: T) => number): number {
  return items.reduce((acc, item) => acc + (Number(getter(item)) || 0), 0);
}

export function derive(data: FinLensData, now = new Date()) {
  const monthTx = data.monthTransactions.length ? data.monthTransactions : data.transactions.filter((tx) => isCurrentMonth(tx, now));
  const portfolioValue = sum(data.holdings, (h) => h.current);
  const totalInvested = sum(data.holdings, (h) => h.invested);
  const debt = sum(data.loans, (l) => l.outstanding);
  const cash = (data.profile?.openingCash || 0) + (data.summary?.cashDeltaTotal ?? sum(data.transactions, (tx) => tx.cashDelta));
  const monthExpenses = Math.max(0, sum(monthTx, (tx) => tx.expenseDelta));
  const monthIncome = Math.max(0, sum(monthTx, (tx) => (tx.type === 'income' || tx.type === 'investment_income' ? tx.amount : 0)));
  const monthInvestmentIncome = Math.max(0, sum(monthTx, (tx) => tx.investmentIncomeDelta || 0));
  const monthInvestments = Math.max(0, sum(monthTx, (tx) => tx.investmentFlowDelta));
  const monthInsurance = Math.max(0, sum(monthTx, (tx) => tx.insuranceFlowDelta));
  const monthLoans = Math.max(0, sum(monthTx, (tx) => tx.loanFlowDelta));
  const monthOther = Math.max(0, sum(monthTx, (tx) => tx.otherFlowDelta));
  const netWorth = cash + portfolioValue - debt;

  const categoryMap = new Map<string, number>();
  monthTx.forEach((tx) => {
    if (!tx.expenseDelta) return;
    categoryMap.set(tx.category || 'Others', (categoryMap.get(tx.category || 'Others') || 0) + tx.expenseDelta);
  });
  const categorySpending = [...categoryMap.entries()]
    .map(([label, value], i) => ({ label, value: Math.max(0, value), color: COLORS[i % COLORS.length] }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  const flowSegments: Segment[] = [
    { label: 'Expenses', value: monthExpenses, color: '#ef6b62' },
    { label: 'Investments', value: monthInvestments, color: '#35a7d9' },
    { label: 'Insurances', value: monthInsurance, color: '#e7bd55' },
    { label: 'EMIs & Loans', value: monthLoans, color: '#27c278' },
    { label: 'Others', value: monthOther, color: '#9a7be8' },
  ].filter((s) => s.value > 0);

  const allocationMap = new Map<string, number>();
  data.holdings.forEach((h) => allocationMap.set(assetGroup(h), (allocationMap.get(assetGroup(h)) || 0) + h.current));
  const assetAllocation: Segment[] = [...allocationMap.entries()]
    .map(([label, value], i) => ({ label, value, color: COLORS[(i + 1) % COLORS.length] }))
    .sort((a, b) => b.value - a.value);

  const dailyExpenses = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(now.getDate() - (6 - index));
    const value = data.transactions.reduce((acc, tx) => {
      const txDate = toDate(tx.occurredAt);
      txDate.setHours(0, 0, 0, 0);
      if (txDate.getTime() === day.getTime()) return acc + tx.expenseDelta;
      return acc;
    }, 0);
    return {
      label: day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      value: Math.max(0, value),
    };
  });

  const essential = Math.max(0, sum(monthTx, (tx) => (tx.essential ? tx.expenseDelta : 0)));
  const discretionary = Math.max(0, monthExpenses - essential);
  const monthlyBudget = data.profile?.monthlyBudget || 0;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - now.getDate() + 1);
  const safeToSpend = monthlyBudget > 0 ? Math.max(0, monthlyBudget - monthExpenses) / daysRemaining : null;
  const monthEndProjection = (monthExpenses / Math.max(1, now.getDate())) * daysInMonth;

  return {
    cash,
    portfolioValue,
    totalInvested,
    investmentGain: portfolioValue - totalInvested,
    investmentReturn: pct(portfolioValue - totalInvested, totalInvested),
    debt,
    netWorth,
    monthExpenses,
    monthIncome,
    monthInvestments,
    monthInvestmentIncome,
    monthInsurance,
    monthLoans,
    monthOther,
    categorySpending,
    flowSegments,
    assetAllocation,
    dailyExpenses,
    essential,
    discretionary,
    safeToSpend,
    monthEndProjection,
    monthlyBudget,
  };
}
