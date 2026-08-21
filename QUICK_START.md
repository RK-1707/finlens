# FinLens Beginner Quick Start

Use this order. Do not skip ahead.

## Step 1 — GitHub repository

Repository: `RK-1707/finlens`

The code is already configured for:

`https://rk-1707.github.io/finlens/`

## Step 2 — Enable GitHub Pages

In GitHub open:

**finlens → Settings → Pages**

Under **Build and deployment**, set **Source** to **GitHub Actions**.

Do not worry if the first deployment is not usable yet; Firebase still needs to be connected.

## Step 3 — Create Firebase

1. Go to Firebase Console.
2. Create a project called FinLens.
3. Open **Authentication** → Get started → enable **Google**.
4. Open **Firestore Database** → Create database.
5. Add a **Web App** to the Firebase project.
6. Firebase will show a config containing `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, and `appId`.

Keep that screen open.

## Step 4 — Add GitHub repository variables

In GitHub:

**finlens → Settings → Secrets and variables → Actions → Variables → New repository variable**

Create these one by one using the values from Firebase:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Do not put a Gemini key here.

## Step 5 — Authorize your GitHub Pages domain in Firebase

In Firebase Authentication settings, add this authorized domain:

`rk-1707.github.io`

This allows Google sign-in from your GitHub Pages website.

## Step 6 — Deploy Firestore rules

Install Node.js first if you do not have it. Then open a terminal in the FinLens project folder and run:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes
```

When Firebase asks which project to use, select the FinLens Firebase project you created.

## Step 7 — Create Gemini API key

Create a Gemini Developer API key in Google AI Studio.

Do not paste it into the website code, GitHub repository, `.env`, or GitHub Pages variables.

## Step 8 — Deploy the Cloudflare Worker

Open a terminal in the FinLens project:

```bash
cd worker
npm install
npx wrangler login
```

Open `worker/wrangler.toml` and replace:

`YOUR_FIREBASE_PROJECT_ID`

with your Firebase project ID.

Then store the Gemini key securely:

```bash
npx wrangler secret put GEMINI_API_KEY
```

Paste the Gemini API key only when Wrangler asks for it.

Deploy:

```bash
npm run deploy
```

Copy the `workers.dev` URL Cloudflare gives you.

## Step 9 — Add Worker URL to GitHub

Create one more GitHub repository variable:

```text
VITE_AI_WORKER_URL=https://your-worker-url.workers.dev
```

## Step 10 — Run the GitHub Pages workflow

Open:

**GitHub → finlens → Actions → Deploy FinLens to GitHub Pages → Run workflow**

When the workflow is green, open:

`https://rk-1707.github.io/finlens/`

## Step 11 — Test

Sign in with Google, complete onboarding, then try:

```text
Spent ₹500 on dinner
Salary received ₹1,00,000
Invested ₹10,000 in Nifty ETF
Paid ₹20,000 student loan EMI
Paid ₹12,500 LIC premium
```

Check that Dashboard and the linked pages update immediately.
