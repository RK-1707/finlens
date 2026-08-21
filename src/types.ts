import type { Timestamp } from 'firebase/firestore';

export type PageKey = 'dashboard' | 'expenses' | 'investments' | 'insurance' | 'loans' | 'qa' | 'contact';

export type TransactionType =
  | 'expense'
  | 'income'
  | 'refund'
  | 'transfer'
  | 'investment_buy'
  | 'investment_sell'
  | 'investment_income'
  | 'insurance_premium'
  | 'loan_emi'
  | 'loan_received'
  | 'configuration';

export interface Profile {
  initialized: boolean;
  openingCash: number;
  monthlyBudget: number;
  currency: 'INR';
  displayName?: string;
  updatedAt?: Timestamp;
}

export interface FinTransaction {
  id: string;
  type: TransactionType;
  displayName: string;
  category: string;
  note: string;
  amount: number;
  cashDelta: number;
  expenseDelta: number;
  investmentFlowDelta: number;
  insuranceFlowDelta: number;
  loanFlowDelta: number;
  otherFlowDelta: number;
  investmentIncomeDelta: number;
  essential: boolean;
  occurredAt: Timestamp | Date | { seconds: number } | string;
  createdAt: Timestamp | Date | { seconds: number } | string;
}

export interface Holding {
  id: string;
  name: string;
  normalizedName: string;
  type: string;
  invested: number;
  current: number;
  notes?: string;
  updatedAt?: Timestamp | Date | { seconds: number } | string;
}

export interface Policy {
  id: string;
  name: string;
  normalizedName: string;
  type: string;
  cover: number;
  annualPremium: number;
  premiumAmount?: number;
  premiumFrequency?: string;
  nextDue?: string;
  status?: string;
  notes?: string;
  policyNumber?: string;
  startDate?: string;
  endDate?: string;
  nominee?: string;
  riders?: string;
}

export interface Loan {
  id: string;
  name: string;
  normalizedName: string;
  outstanding: number;
  original: number;
  emi: number;
  rate: number;
  nextDue?: string;
  status?: string;
}

export interface Commitment {
  id: string;
  name: string;
  amount: number;
  dueDay?: number;
  dueLabel?: string;
  frequency?: string;
  kind?: string;
  active?: boolean;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
}

export interface Summary {
  cashDeltaTotal: number;
  portfolioValue?: number;
  investedTotal?: number;
  debtOutstanding?: number;
  realizedInvestmentGain?: number;
  investmentIncomeTotal?: number;
}

export interface PortfolioSnapshot {
  id: string;
  portfolioValue: number;
  investedTotal: number;
  realizedGainTotal: number;
  occurredAt: Timestamp | Date | { seconds: number } | string;
}

export interface TargetAllocation {
  id: string;
  label: string;
  targetPct: number;
}

export interface FinLensData {
  profile: Profile | null;
  summary: Summary | null;
  transactions: FinTransaction[];
  monthTransactions: FinTransaction[];
  holdings: Holding[];
  policies: Policy[];
  loans: Loan[];
  commitments: Commitment[];
  budgets: Budget[];
  goals: Goal[];
  portfolioSnapshots: PortfolioSnapshot[];
  targets: TargetAllocation[];
  loading: boolean;
  error?: string;
}

export type ParsedAction =
  | 'expense'
  | 'income'
  | 'refund'
  | 'transfer'
  | 'investment_buy'
  | 'investment_sell'
  | 'investment_income'
  | 'investment_event'
  | 'investment_value_update'
  | 'insurance_premium'
  | 'policy_setup'
  | 'loan_emi'
  | 'loan_received'
  | 'loan_setup'
  | 'budget'
  | 'recurring'
  | 'goal'
  | 'target_allocation';

export interface ParsedEntry {
  action: ParsedAction;
  amount: number;
  category: string;
  name: string;
  note: string;
  essential: boolean;
  assetType?: string;
  currentValue?: number;
  coverAmount?: number;
  annualPremium?: number;
  premiumAmount?: number;
  premiumFrequency?: string;
  policyType?: string;
  loanName?: string;
  interestRate?: number;
  emi?: number;
  originalPrincipal?: number;
  dueDay?: number;
  frequency?: string;
  targetAmount?: number;
  currentAmount?: number;
  targetDate?: string;
  budgetCategory?: string;
  policyNumber?: string;
  startDate?: string;
  endDate?: string;
  nominee?: string;
  riders?: string;
}

export interface Segment {
  label: string;
  value: number;
  color?: string;
}
