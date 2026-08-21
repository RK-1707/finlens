import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function saveInitialProfile(uid: string, openingCash: number, monthlyBudget: number, displayName?: string) {
  await setDoc(
    doc(db, 'users', uid, 'profile', 'main'),
    {
      initialized: true,
      openingCash: Math.max(0, Number(openingCash) || 0),
      monthlyBudget: Math.max(0, Number(monthlyBudget) || 0),
      currency: 'INR',
      displayName: displayName || '',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
