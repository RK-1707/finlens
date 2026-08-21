import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth';
import { Logo } from './components/Logo';
import { Dashboard } from './pages/Dashboard';
import { Expenses } from './pages/Expenses';
import { Investments } from './pages/Investments';
import { Insurance } from './pages/Insurance';
import { Loans } from './pages/Loans';
import { QA } from './pages/QA';
import { Contact } from './pages/Contact';
import { auth, googleProvider } from './services/firebase';
import { saveInitialProfile } from './services/profile';
import { useFinLensData } from './hooks/useFinLensData';
import type { PageKey } from './types';

const NAV: Array<{ key: PageKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'expenses', label: 'Expense Tracker' },
  { key: 'investments', label: 'Investments' },
  { key: 'insurance', label: 'Insurances' },
  { key: 'loans', label: 'Loans & Liabilities' },
  { key: 'qa', label: 'Q&A with FinLens' },
  { key: 'contact', label: 'Contact Us' },
];

function LoadingScreen() {
  return <div className="center-screen"><Logo large /><p>Preparing your financial dashboard…</p></div>;
}

function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function loginWithEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Email sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function loginWithGoogle() {
    setBusy(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card onboarding" onSubmit={loginWithEmail}>
        <Logo large />
        <h1>Your complete financial view, in one place.</h1>
        <p>Sign in with your Google account or use an email-and-password account. Each Firebase account keeps its own separate FinLens data.</p>

        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
          />
        </label>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in with Email'}</button>

        <small>or</small>
        <button className="ghost-button" type="button" onClick={loginWithGoogle} disabled={busy} style={{ width: '100%', height: 48, marginTop: 12 }}>
          Continue with Google
        </button>

        {error ? <div className="error-box" style={{ marginTop: 16 }}>{error}</div> : null}
        <small>Your financial data is stored under your signed-in Firebase account and is separated by account.</small>
      </form>
    </div>
  );
}

function Onboarding({ user }: { user: User }) {
  const [openingCash, setOpeningCash] = useState(0);
  const [budget, setBudget] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await saveInitialProfile(user.uid, openingCash, budget, user.displayName || undefined); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save setup.'); }
    finally { setBusy(false); }
  }
  return <div className="auth-shell"><form className="auth-card onboarding" onSubmit={submit}><Logo /><h1>Set up FinLens</h1><p>These two values make your cash and safe-to-spend calculations accurate. You can enter 0 and add data later.</p><label>Current available cash<input type="number" min="0" step="1" value={openingCash} onChange={(e) => setOpeningCash(Number(e.target.value))} /></label><label>Monthly spending budget<input type="number" min="0" step="1" value={budget} onChange={(e) => setBudget(Number(e.target.value))} /></label><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Open FinLens'}</button>{error ? <div className="error-box">{error}</div> : null}</form></div>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [page, setPage] = useState<PageKey>('dashboard');

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); }), []);
  const data = useFinLensData(user?.uid);
  const currentTitle = useMemo(() => NAV.find((n) => n.key === page)?.label || 'Dashboard', [page]);

  if (!authReady) return <LoadingScreen />;
  if (!user) return <SignInScreen />;
  if (data.loading && !data.profile) return <LoadingScreen />;
  if (!data.profile?.initialized) return <Onboarding user={user} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <Logo />
        <div className="topbar-actions"><div className="user-chip"><span>{user.displayName || user.email || 'FinLens user'}</span></div><button className="ghost-button" onClick={() => signOut(auth)}>Sign out</button></div>
      </header>

      <div className="content-shell">
        <div className="navigation-row">
          <label className="nav-label">Navigate FinLens<select value={page} onChange={(e) => setPage(e.target.value as PageKey)}>{NAV.map((n) => <option key={n.key} value={n.key}>{n.label}</option>)}</select></label>
          <div className="page-heading"><span>FinLens</span><h1>{currentTitle}</h1></div>
        </div>

        {data.error ? <div className="error-box">{data.error}</div> : null}

        <main>
          {page === 'dashboard' ? <Dashboard data={data} /> : null}
          {page === 'expenses' ? <Expenses data={data} /> : null}
          {page === 'investments' ? <Investments data={data} /> : null}
          {page === 'insurance' ? <Insurance data={data} /> : null}
          {page === 'loans' ? <Loans data={data} /> : null}
          {page === 'qa' ? <QA data={data} /> : null}
          {page === 'contact' ? <Contact /> : null}
        </main>
      </div>
    </div>
  );
}
