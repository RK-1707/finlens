import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Budget, Commitment, FinLensData, FinTransaction, Goal, Holding, Loan, Policy, PortfolioSnapshot, Profile, Summary, TargetAllocation } from '../types';

const empty: FinLensData = {
  profile: null,
  summary: null,
  transactions: [],
  monthTransactions: [],
  holdings: [],
  policies: [],
  loans: [],
  commitments: [],
  budgets: [],
  goals: [],
  portfolioSnapshots: [],
  targets: [],
  loading: true,
};

function docsWithId<T>(snapshot: { docs: readonly { id: string; data: () => unknown }[] }): T[] {
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as T[];
}

export function useFinLensData(uid?: string): FinLensData {
  const [data, setData] = useState<FinLensData>(empty);

  useEffect(() => {
    if (!uid) {
      setData(empty);
      return;
    }

    let mounted = true;
    const loaded = new Set<string>();
    const patch = (key: string, value: Partial<FinLensData>) => {
      if (!mounted) return;
      loaded.add(key);
      setData((prev) => ({ ...prev, ...value, loading: loaded.size < 12 }));
    };
    const fail = (error: Error) => mounted && setData((prev) => ({ ...prev, error: error.message, loading: false }));

    const base = doc(db, 'users', uid);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const unsubs = [
      onSnapshot(doc(db, 'users', uid, 'profile', 'main'), (snap) => patch('profile', { profile: snap.exists() ? (snap.data() as Profile) : null }), fail),
      onSnapshot(doc(db, 'users', uid, 'summary', 'main'), (snap) => patch('summary', { summary: snap.exists() ? (snap.data() as Summary) : null }), fail),
      onSnapshot(query(collection(base, 'transactions'), orderBy('createdAt', 'desc'), limit(50)), (snap) => patch('transactions', { transactions: docsWithId<FinTransaction>(snap) }), fail),
      onSnapshot(query(collection(base, 'transactions'), where('occurredAt', '>=', Timestamp.fromDate(monthStart)), where('occurredAt', '<', Timestamp.fromDate(nextMonth)), orderBy('occurredAt', 'desc'), limit(5000)), (snap) => patch('monthTransactions', { monthTransactions: docsWithId<FinTransaction>(snap) }), fail),
      onSnapshot(collection(base, 'holdings'), (snap) => patch('holdings', { holdings: docsWithId<Holding>(snap) }), fail),
      onSnapshot(collection(base, 'policies'), (snap) => patch('policies', { policies: docsWithId<Policy>(snap) }), fail),
      onSnapshot(collection(base, 'loans'), (snap) => patch('loans', { loans: docsWithId<Loan>(snap) }), fail),
      onSnapshot(collection(base, 'commitments'), (snap) => patch('commitments', { commitments: docsWithId<Commitment>(snap) }), fail),
      onSnapshot(collection(base, 'budgets'), (snap) => patch('budgets', { budgets: docsWithId<Budget>(snap) }), fail),
      onSnapshot(collection(base, 'goals'), (snap) => patch('goals', { goals: docsWithId<Goal>(snap) }), fail),
      onSnapshot(query(collection(base, 'portfolioSnapshots'), orderBy('occurredAt', 'desc'), limit(500)), (snap) => patch('portfolioSnapshots', { portfolioSnapshots: docsWithId<PortfolioSnapshot>(snap) }), fail),
      onSnapshot(collection(base, 'targets'), (snap) => patch('targets', { targets: docsWithId<TargetAllocation>(snap) }), fail),
    ];

    return () => {
      mounted = false;
      unsubs.forEach((u) => u());
    };
  }, [uid]);

  return data;
}
