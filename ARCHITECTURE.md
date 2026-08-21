# FinLens Architecture

## Components

### GitHub Pages
Hosts the compiled React/Vite website at `https://rk-1707.github.io/finlens/`.

### Firebase Authentication
Provides Google sign-in and a user ID. Each request to the AI Worker carries a short-lived Firebase ID token.

### Cloud Firestore
Stores the signed-in user's profile, transactions, holdings, policies, loans, commitments, budgets, goals, snapshots, targets, and summary values.

### Cloudflare Worker
Acts as the secure Gemini gateway. It verifies Firebase ID tokens, enforces an origin allowlist, and keeps `GEMINI_API_KEY` secret.

### Gemini Developer API
Used only for natural-language interpretation and grounded Q&A. It is not the source of deterministic financial totals or market prices.

## Smart Entry path

```text
Dashboard Smart Entry
        ↓
Firebase ID token
        ↓
Cloudflare Worker
        ↓
Gemini structured interpretation
        ↓
Frontend validation / deterministic fallback
        ↓
Firestore transaction under users/{uid}
        ↓
Realtime listeners
        ↓
All linked FinLens pages refresh
```

## Q&A path

```text
Signed-in FinLens data
        ↓
Frontend creates a limited structured context
        ↓
Cloudflare Worker verifies Firebase token
        ↓
Gemini answers only from supplied context
        ↓
FinLens Q&A
```

Policy numbers are excluded from the Q&A context sent by the frontend.

## Security boundary

- No Gemini key in browser code.
- No Gemini key in GitHub Pages repository variables.
- Worker checks Firebase token issuer, audience, signature, and subject.
- Worker accepts browser calls only from configured origins.
- Firestore rules enforce `request.auth.uid == uid` for all user financial data.
- Cross-user reads and writes are denied.
- AI output is treated as untrusted input and normalized before Firestore mutation.

## Data model

```text
users/{uid}/profile/main
users/{uid}/summary/main
users/{uid}/transactions/{id}
users/{uid}/holdings/{id}
users/{uid}/policies/{id}
users/{uid}/loans/{id}
users/{uid}/commitments/{id}
users/{uid}/budgets/{id}
users/{uid}/goals/{id}
users/{uid}/portfolioSnapshots/{id}
users/{uid}/targets/{id}
```

## Financial calculation principle

Raw ledger events and entity records are the source of truth. Dashboard and page metrics are derived deterministically in the browser from Firestore data. Gemini interprets language and explains results; it does not independently maintain balances.
