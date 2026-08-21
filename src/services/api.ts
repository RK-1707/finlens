import { auth } from './firebase';
import { fallbackParse } from './fallbackParser';
import { applyEntry, type MutationResult } from './transactionEngine';
import { derive, inr } from '../lib/finance';
import type { FinLensData, ParsedEntry } from '../types';

export interface SmartEntryResult extends MutationResult { ok: boolean }

function workerBase(): string {
  return String(import.meta.env.VITE_AI_WORKER_URL || '').trim().replace(/\/$/, '');
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in again.');
  const token = await user.getIdToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function workerPost<T>(path: string, body: unknown): Promise<T> {
  const base = workerBase();
  if (!base) throw new Error('AI worker is not configured yet.');
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || `FinLens AI returned ${response.status}.`);
  return payload;
}

function validParsed(value: unknown): value is ParsedEntry {
  if (!value || typeof value !== 'object') return false;
  const x = value as Partial<ParsedEntry>;
  return typeof x.action === 'string' && typeof x.amount === 'number' && typeof x.category === 'string' && typeof x.name === 'string' && typeof x.note === 'string' && typeof x.essential === 'boolean';
}

export async function addSmartEntry(text: string): Promise<SmartEntryResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in again.');
  let parsed: ParsedEntry;
  let aiWarning = '';
  try {
    const result = await workerPost<{ parsed: ParsedEntry }>('/parse', { text });
    parsed = validParsed(result.parsed) ? result.parsed : fallbackParse(text);
    if (!validParsed(result.parsed)) aiWarning = 'AI response was invalid, so the deterministic parser was used.';
  } catch {
    parsed = fallbackParse(text);
    aiWarning = workerBase() ? 'AI backend was unavailable, so the deterministic parser was used.' : 'AI backend is not configured yet; the deterministic parser was used.';
  }
  const result = await applyEntry(user.uid, parsed, text);
  return { ok: true, ...result, warnings: aiWarning ? [aiWarning, ...result.warnings] : result.warnings };
}

function qnaContext(data: FinLensData) {
  const m = derive(data);
  return {
    summary: {
      cash: m.cash,
      portfolioValue: m.portfolioValue,
      totalInvested: m.totalInvested,
      investmentGain: m.investmentGain,
      debt: m.debt,
      netWorth: m.netWorth,
      monthExpenses: m.monthExpenses,
      monthIncome: m.monthIncome,
      monthInvestments: m.monthInvestments,
      monthInsurance: m.monthInsurance,
      monthLoans: m.monthLoans,
      monthlyBudget: m.monthlyBudget,
      safeToSpend: m.safeToSpend,
      monthEndProjection: m.monthEndProjection,
    },
    recentTransactions: data.transactions.slice(0, 40).map((tx) => ({ displayName: tx.displayName, type: tx.type, category: tx.category, amount: tx.amount, cashDelta: tx.cashDelta, expenseDelta: tx.expenseDelta, essential: tx.essential, occurredAt: tx.occurredAt })),
    holdings: data.holdings.map(({ id: _id, ...h }) => h),
    policies: data.policies.map(({ id: _id, policyNumber: _policyNumber, ...p }) => p),
    loans: data.loans.map(({ id: _id, ...l }) => l),
    commitments: data.commitments.filter((c) => c.active !== false).map(({ id: _id, ...c }) => c),
    budgets: data.budgets.map(({ id: _id, ...b }) => b),
    goals: data.goals.map(({ id: _id, ...g }) => g),
    targets: data.targets.map(({ id: _id, ...t }) => t),
  };
}

function deterministicAnswer(question: string, data: FinLensData): string {
  const t = question.toLowerCase();
  const m = derive(data);
  if (/net worth|worth/.test(t)) return `Your current calculated net worth is ${inr(m.netWorth)}. This is cash plus current investment value minus outstanding liabilities.`;
  if (/spend|expense|spent/.test(t)) return `General expenses this month are ${inr(m.monthExpenses)}.${m.categorySpending[0] ? ` ${m.categorySpending[0].label} is currently your largest spending category.` : ''}`;
  if (/invest|portfolio/.test(t)) return `Your portfolio value is ${inr(m.portfolioValue)}, against ${inr(m.totalInvested)} invested, for an unrealized difference of ${inr(m.investmentGain)}.`;
  if (/loan|debt|emi/.test(t)) return `Your current outstanding liabilities are ${inr(m.debt)}.`;
  if (/cash|balance/.test(t)) return `Your current cash in hand is ${inr(m.cash)}.`;
  if (/income/.test(t)) return `Income recorded this month is ${inr(m.monthIncome)}.`;
  return 'The AI backend is not configured or temporarily unavailable. I can still answer basic totals from your FinLens data; try asking about net worth, spending, investments, cash, income, or debt.';
}

export async function askFinLens(question: string, data: FinLensData): Promise<string> {
  try {
    const result = await workerPost<{ answer: string }>('/qa', { question, context: qnaContext(data) });
    return result.answer?.trim() || deterministicAnswer(question, data);
  } catch {
    return deterministicAnswer(question, data);
  }
}
