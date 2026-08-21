# FinLens Web

FinLens is a personal-finance web app designed for desktop and mobile. It uses a single financial ledger so a transaction added through Dashboard Smart Entry updates every linked section immediately.

## Free-first architecture

- **Frontend / hosting:** React + TypeScript + Vite on GitHub Pages
- **Authentication:** Firebase Authentication
- **Database:** Cloud Firestore
- **AI gateway:** Cloudflare Worker
- **AI:** Gemini Developer API

The Gemini API key is never stored in the browser or committed to GitHub. The browser sends a Firebase ID token to the Cloudflare Worker, the Worker verifies it, then calls Gemini using a Cloudflare secret.

## Live URL after GitHub Pages is enabled

`https://rk-1707.github.io/finlens/`

## Important files

- `src/` — FinLens website
- `firestore.rules` — isolates each user's financial records
- `worker/` — secure Gemini backend
- `.github/workflows/deploy-pages.yml` — automatic GitHub Pages deployment
- `.env.example` — local frontend environment variable template
- `QUICK_START.md` — beginner setup guide
- `DEPLOYMENT_CHECKLIST.md` — final go-live checks

## Local development

1. Install Node.js 22 or newer.
2. Copy `.env.example` to `.env`.
3. Add your Firebase web configuration and Cloudflare Worker URL.
4. Run:

```bash
npm install
npm run dev
```

Open the local URL shown by Vite, normally `http://localhost:5173/finlens/`.

## Build

```bash
npm run typecheck
npm run build
```

The static output is written to `dist/`.

## GitHub Pages

The repository is already configured with Vite base path `/finlens/` and a GitHub Actions workflow. In GitHub:

1. Repository → **Settings** → **Pages**.
2. Under **Build and deployment**, choose **GitHub Actions**.
3. Add the Firebase and Worker values as repository **Variables** under Settings → Secrets and variables → Actions → Variables.
4. Push to `main` or manually run the `Deploy FinLens to GitHub Pages` workflow.

Required repository variables:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_AI_WORKER_URL
```

These Firebase web values and the Worker URL are public configuration. **Do not add `GEMINI_API_KEY` as a frontend/GitHub Pages variable.**

## Firebase setup

Create a Firebase project and enable:

- Authentication → Google sign-in
- Cloud Firestore
- A Web App

Deploy the included Firestore rules using Firebase CLI when you are ready:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes
```

The Firestore rules let a signed-in user access only `users/{theirUid}/...` and deny cross-user access.

## Cloudflare Worker setup

```bash
cd worker
npm install
npx wrangler login
```

Edit `worker/wrangler.toml` and replace `YOUR_FIREBASE_PROJECT_ID` with the same Firebase project ID used by the website.

Store Gemini securely:

```bash
npx wrangler secret put GEMINI_API_KEY
```

Then deploy:

```bash
npm run deploy
```

Cloudflare prints a URL such as `https://finlens-ai.<subdomain>.workers.dev`. Put that URL in the GitHub repository variable `VITE_AI_WORKER_URL`.

## Smart Entry information flow

1. User enters natural-language text on Dashboard.
2. Website sends the text and signed-in Firebase ID token to the Cloudflare Worker.
3. Worker verifies the token and asks Gemini to interpret the entry.
4. Website validates the returned structure and applies the financial mutation to the signed-in user's Firestore subtree.
5. Firestore realtime listeners update Dashboard, Expenses, Investments, Insurance, Loans, commitments, goals, and Q&A data immediately.
6. If the AI backend is unavailable, FinLens falls back to a deterministic parser so basic financial logging continues.

## Investment valuation rule

FinLens follows this rule:

**Gemini interprets the asset → verified data feeds provide prices/NAVs → FinLens calculates.**

The current release does not include a live market-data provider. New manual investments therefore start with current value equal to cost unless the user explicitly supplies a current value. Gemini must never invent a market price or NAV.

## Current limitations

- No bank-account aggregation/open-banking connector.
- No automatic insurer, broker, or bank import.
- No live stock/NAV data provider yet.
- Cash in Hand means opening cash plus transactions recorded in FinLens.
- Insights are informational and are not investment, insurance, tax, or lending advice.
