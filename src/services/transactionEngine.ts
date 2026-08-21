import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ParsedEntry } from '../types';
import { entityId, normalizedName } from './fallbackParser';

export interface MutationResult {
  label: string;
  message: string;
  warnings: string[];
}

const financialActions = new Set([
  'expense','income','refund','transfer','investment_buy','investment_sell','investment_income','insurance_premium','loan_emi','loan_received',
]);
const configurationActions = new Set([
  'investment_value_update','investment_event','policy_setup','loan_setup','budget','recurring','goal','target_allocation',
]);

function annualizePremium(amount: number, frequency?: string): number {
  const f = (frequency || '').toLowerCase();
  if (/month/.test(f)) return amount * 12;
  if (/quarter/.test(f)) return amount * 4;
  if (/half|semi/.test(f)) return amount * 2;
  return amount;
}

function impacts(parsed: ParsedEntry) {
  const amount = Math.max(0, Number(parsed.amount) || 0);
  const zero = { expenseDelta: 0, investmentFlowDelta: 0, insuranceFlowDelta: 0, loanFlowDelta: 0, otherFlowDelta: 0, investmentIncomeDelta: 0 };
  switch (parsed.action) {
    case 'expense': return { ...zero, cashDelta: -amount, expenseDelta: amount };
    case 'income': return { ...zero, cashDelta: amount };
    case 'refund': return { ...zero, cashDelta: amount, expenseDelta: -amount };
    case 'transfer': return { ...zero, cashDelta: 0 };
    case 'investment_buy': return { ...zero, cashDelta: -amount, investmentFlowDelta: amount };
    case 'investment_sell': return { ...zero, cashDelta: amount, investmentFlowDelta: -amount };
    case 'investment_income': return { ...zero, cashDelta: amount, investmentIncomeDelta: amount };
    case 'insurance_premium': return { ...zero, cashDelta: -amount, insuranceFlowDelta: amount };
    case 'loan_emi': return { ...zero, cashDelta: -amount, loanFlowDelta: amount };
    case 'loan_received': return { ...zero, cashDelta: amount };
    default: return { ...zero, cashDelta: 0 };
  }
}

export async function applyEntry(uid: string, parsed: ParsedEntry, rawText: string): Promise<MutationResult> {
  const userPath = ['users', uid] as const;
  const txRef = doc(collection(db, ...userPath, 'transactions'));
  const summaryRef = doc(db, ...userPath, 'summary', 'main');
  const warnings: string[] = [];
  const txImpacts = impacts(parsed);
  const amount = Math.max(0, Number(parsed.amount) || 0);
  const occurredAt = Timestamp.now();

  if (financialActions.has(parsed.action) && amount <= 0) throw new Error('A valid amount is required for this financial transaction.');
  if (parsed.action === 'target_allocation' && (amount <= 0 || amount > 100)) throw new Error('Target allocation must be a percentage between 0 and 100.');

  let label = parsed.name || parsed.category || 'Financial Activity';

  await runTransaction(db, async (tx) => {
    const summarySnap = await tx.get(summaryRef);
    const summary = summarySnap.data() as { portfolioValue?: number; investedTotal?: number; realizedInvestmentGain?: number } | undefined;

    const holdingRef = ['investment_buy','investment_sell','investment_value_update'].includes(parsed.action)
      ? doc(db, ...userPath, 'holdings', entityId(parsed.name || 'investment')) : null;
    const loanName = parsed.loanName || parsed.name || 'Loan';
    const loanRef = ['loan_emi','loan_received','loan_setup'].includes(parsed.action)
      ? doc(db, ...userPath, 'loans', entityId(loanName)) : null;
    const policyRef = ['insurance_premium','policy_setup'].includes(parsed.action)
      ? doc(db, ...userPath, 'policies', entityId(parsed.name || 'insurance-policy')) : null;

    const holdingSnap = holdingRef ? await tx.get(holdingRef) : null;
    const loanSnap = loanRef ? await tx.get(loanRef) : null;
    const policySnap = policyRef ? await tx.get(policyRef) : null;

    let portfolioDelta = 0;
    let investedDelta = 0;
    let debtDelta = 0;
    let realizedGainDelta = 0;
    const investmentIncomeDelta = txImpacts.investmentIncomeDelta || 0;
    let snapshotPortfolio = false;

    switch (parsed.action) {
      case 'investment_buy': {
        const current = holdingSnap?.data() as { invested?: number; current?: number; name?: string; type?: string } | undefined;
        const addedCurrent = parsed.currentValue ?? amount;
        tx.set(holdingRef!, {
          name: parsed.name || current?.name || 'Investment',
          normalizedName: normalizedName(parsed.name || current?.name || 'Investment'),
          type: parsed.assetType || current?.type || 'Other Investment',
          invested: (current?.invested || 0) + amount,
          current: (current?.current || 0) + addedCurrent,
          notes: parsed.note || '',
          updatedAt: serverTimestamp(),
        }, { merge: true });
        portfolioDelta = addedCurrent; investedDelta = amount; snapshotPortfolio = true;
        label = `Investment · ${parsed.name || 'Holding'}`;
        if (parsed.currentValue == null) warnings.push('Current value starts at cost until a verified market value is supplied.');
        break;
      }
      case 'investment_sell': {
        if (!holdingSnap?.exists()) {
          warnings.push('No matching holding was found, so the sale was recorded without changing a holding.');
          label = `Investment Sale · ${parsed.name || 'Holding'}`;
          break;
        }
        const h = holdingSnap.data() as { invested?: number; current?: number };
        const current = Math.max(0, Number(h.current) || 0), invested = Math.max(0, Number(h.invested) || 0);
        const valueRemoved = Math.min(amount, current), ratio = current > 0 ? Math.min(1, valueRemoved / current) : 1, costRemoved = invested * ratio;
        const nextCurrent = Math.max(0, current - valueRemoved), nextInvested = Math.max(0, invested - costRemoved);
        if (nextCurrent < 1) tx.delete(holdingRef!); else tx.set(holdingRef!, { current: nextCurrent, invested: nextInvested, updatedAt: serverTimestamp() }, { merge: true });
        portfolioDelta = -valueRemoved; investedDelta = -costRemoved; realizedGainDelta = amount - costRemoved; snapshotPortfolio = true;
        label = `Investment Sale · ${parsed.name || 'Holding'}`;
        if (amount > current) warnings.push('Sale proceeds exceed the recorded current value; the matching holding was fully removed.');
        break;
      }
      case 'investment_value_update': {
        if (!holdingSnap?.exists()) throw new Error('No matching holding was found for this valuation update.');
        const oldValue = Math.max(0, Number((holdingSnap.data() as { current?: number }).current) || 0), newValue = parsed.currentValue ?? amount;
        if (!newValue) throw new Error('A valid current value is required.');
        tx.set(holdingRef!, { current: newValue, updatedAt: serverTimestamp() }, { merge: true });
        portfolioDelta = newValue - oldValue; snapshotPortfolio = true; label = `Valuation Updated · ${parsed.name}`;
        break;
      }
      case 'investment_income': label = parsed.name || 'Investment Income'; break;
      case 'investment_event': {
        const name = parsed.name || 'Investment Event';
        tx.set(doc(db, ...userPath, 'commitments', entityId(name)), { name, amount, dueDay: parsed.dueDay || null, dueLabel: parsed.dueDay ? `Day ${parsed.dueDay}` : parsed.targetDate || '', frequency: parsed.frequency || 'One-time', kind: 'investment', active: true, updatedAt: serverTimestamp() }, { merge: true });
        label = `Investment Event · ${name}`; break;
      }
      case 'loan_received': {
        const previous = loanSnap?.data() as { outstanding?: number; original?: number; emi?: number; rate?: number; name?: string; nextDue?: string } | undefined;
        const name = parsed.loanName || previous?.name || parsed.name || 'Loan', previousOutstanding = Math.max(0, Number(previous?.outstanding) || 0);
        tx.set(loanRef!, { name, normalizedName: normalizedName(name), outstanding: previousOutstanding + amount, original: (previous?.original || 0) + amount, emi: parsed.emi ?? previous?.emi ?? 0, rate: parsed.interestRate ?? previous?.rate ?? 0, nextDue: parsed.dueDay ? `Day ${parsed.dueDay}` : previous?.nextDue || 'Not set', status: 'Active', updatedAt: serverTimestamp() }, { merge: true });
        debtDelta = amount; label = `${name} Disbursement`; break;
      }
      case 'loan_setup': {
        const previous = loanSnap?.data() as { outstanding?: number; original?: number; emi?: number; rate?: number; name?: string; nextDue?: string } | undefined;
        const name = parsed.loanName || previous?.name || parsed.name || 'Loan', previousOutstanding = Math.max(0, Number(previous?.outstanding) || 0), outstanding = amount || parsed.originalPrincipal || previousOutstanding;
        tx.set(loanRef!, { name, normalizedName: normalizedName(name), outstanding, original: parsed.originalPrincipal || previous?.original || outstanding, emi: parsed.emi ?? previous?.emi ?? 0, rate: parsed.interestRate ?? previous?.rate ?? 0, nextDue: parsed.dueDay ? `Day ${parsed.dueDay}` : previous?.nextDue || 'Not set', status: 'Active', updatedAt: serverTimestamp() }, { merge: true });
        debtDelta = outstanding - previousOutstanding; label = `Loan Setup · ${name}`; break;
      }
      case 'loan_emi': {
        if (!loanSnap?.exists()) {
          warnings.push('The EMI was recorded, but no matching loan was found to reduce outstanding debt. Add the loan details first.');
          label = `${parsed.loanName || 'Loan'} EMI`; break;
        }
        const loan = loanSnap.data() as { outstanding?: number; rate?: number; name?: string }, outstanding = Math.max(0, Number(loan.outstanding) || 0), rate = Math.max(0, Number(loan.rate) || 0), interest = outstanding * (rate / 100 / 12), principal = Math.max(0, Math.min(outstanding, amount - interest));
        tx.set(loanRef!, { outstanding: Math.max(0, outstanding - principal), updatedAt: serverTimestamp() }, { merge: true });
        debtDelta = -principal; label = `${loan.name || parsed.loanName || 'Loan'} EMI`;
        if (amount <= interest && outstanding > 0) warnings.push('This payment does not exceed the estimated monthly interest, so principal was not reduced.');
        break;
      }
      case 'policy_setup': {
        const previous = policySnap?.data() as { name?: string; type?: string; cover?: number; annualPremium?: number; premiumAmount?: number; premiumFrequency?: string; nextDue?: string } | undefined;
        const policyName = parsed.name || previous?.name || `${parsed.policyType || 'Insurance'} Policy`, frequency = parsed.premiumFrequency || previous?.premiumFrequency || 'Annual', installment = parsed.premiumAmount ?? previous?.premiumAmount ?? parsed.annualPremium ?? 0, annualPremium = parsed.annualPremium ?? (installment ? annualizePremium(installment, frequency) : previous?.annualPremium ?? 0);
        const policyData: Record<string, unknown> = { name: policyName, normalizedName: normalizedName(policyName), type: parsed.policyType || previous?.type || 'Other', cover: parsed.coverAmount ?? (amount > 0 ? amount : previous?.cover ?? 0), annualPremium, premiumAmount: installment || annualPremium, premiumFrequency: frequency, nextDue: parsed.dueDay ? `Day ${parsed.dueDay}` : previous?.nextDue || 'Not set', status: 'Active', notes: parsed.note || '', updatedAt: serverTimestamp() };
        if (parsed.policyNumber) policyData.policyNumber = parsed.policyNumber; if (parsed.startDate) policyData.startDate = parsed.startDate; if (parsed.endDate) policyData.endDate = parsed.endDate; if (parsed.nominee) policyData.nominee = parsed.nominee; if (parsed.riders) policyData.riders = parsed.riders;
        tx.set(policyRef!, policyData, { merge: true }); label = `Policy Setup · ${policyName}`; break;
      }
      case 'insurance_premium': label = parsed.name || 'Insurance Premium'; if (!policySnap?.exists()) warnings.push('Premium recorded. Add policy details separately if you want cover and renewal tracking.'); break;
      case 'budget': {
        const category = parsed.budgetCategory || parsed.category || 'Others'; if (amount <= 0) throw new Error('A valid budget limit is required.');
        tx.set(doc(db, ...userPath, 'budgets', entityId(category)), { category, limit: amount, updatedAt: serverTimestamp() }, { merge: true }); label = `Budget · ${category}`; break;
      }
      case 'recurring': {
        if (amount <= 0) throw new Error('A valid recurring amount is required.'); const name = parsed.name || 'Recurring Payment';
        tx.set(doc(db, ...userPath, 'commitments', entityId(name)), { name, amount, dueDay: parsed.dueDay || null, dueLabel: parsed.dueDay ? `Day ${parsed.dueDay}` : '', frequency: parsed.frequency || 'Monthly', kind: 'subscription', active: true, updatedAt: serverTimestamp() }, { merge: true }); label = `Recurring · ${name}`; break;
      }
      case 'goal': {
        const target = parsed.targetAmount || amount; if (target <= 0) throw new Error('A valid goal target amount is required.'); const name = parsed.name || 'Financial Goal';
        tx.set(doc(db, ...userPath, 'goals', entityId(name)), { name, targetAmount: target, currentAmount: parsed.currentAmount || 0, targetDate: parsed.targetDate || '', updatedAt: serverTimestamp() }, { merge: true }); label = `Goal · ${name}`; break;
      }
      case 'target_allocation': {
        const name = parsed.name || 'Other'; tx.set(doc(db, ...userPath, 'targets', entityId(name)), { label: name, targetPct: amount, updatedAt: serverTimestamp() }, { merge: true }); label = `Target Allocation · ${name} ${amount}%`; break;
      }
      case 'expense': label = parsed.name || parsed.category || 'Expense'; break;
      case 'income': label = parsed.name || 'Income'; break;
      case 'refund': label = parsed.name || `${parsed.category || ''} Refund`.trim(); break;
      case 'transfer': label = parsed.name || 'Internal Transfer'; break;
    }

    tx.set(summaryRef, {
      cashDeltaTotal: increment(txImpacts.cashDelta), portfolioValue: increment(portfolioDelta), investedTotal: increment(investedDelta), debtOutstanding: increment(debtDelta), realizedInvestmentGain: increment(realizedGainDelta), investmentIncomeTotal: increment(investmentIncomeDelta), updatedAt: serverTimestamp(),
    }, { merge: true });

    if (snapshotPortfolio) {
      tx.set(doc(db, ...userPath, 'portfolioSnapshots', txRef.id), {
        portfolioValue: Math.max(0, Number(summary?.portfolioValue || 0) + portfolioDelta), investedTotal: Math.max(0, Number(summary?.investedTotal || 0) + investedDelta), realizedGainTotal: Number(summary?.realizedInvestmentGain || 0) + realizedGainDelta, occurredAt, createdAt: serverTimestamp(),
      });
    }

    tx.set(txRef, {
      type: configurationActions.has(parsed.action) ? 'configuration' : parsed.action,
      displayName: label, category: parsed.category || 'Others', note: parsed.note || rawText, rawText: rawText.slice(0, 1000), amount, ...txImpacts, essential: Boolean(parsed.essential), occurredAt, createdAt: serverTimestamp(),
    });
  });

  return { label, warnings, message: `${label} added. All linked FinLens pages will refresh automatically.` };
}

export async function seedSummaryIfMissing(uid: string) {
  const ref = doc(db, 'users', uid, 'summary', 'main');
  const snap = await getDoc(ref);
  if (!snap.exists()) await setDoc(ref, { cashDeltaTotal: 0, portfolioValue: 0, investedTotal: 0, debtOutstanding: 0, realizedInvestmentGain: 0, investmentIncomeTotal: 0, updatedAt: serverTimestamp() });
}

export async function removeEmptyHolding(uid: string, name: string) {
  await deleteDoc(doc(db, 'users', uid, 'holdings', entityId(name)));
}
