# FinLens Deployment Checklist

Before sharing the public website, confirm all items below.

- [ ] GitHub Pages source is set to GitHub Actions.
- [ ] Firebase project created.
- [ ] Google sign-in enabled in Firebase Authentication.
- [ ] `rk-1707.github.io` added to Firebase authorized domains.
- [ ] Firestore database created.
- [ ] `firestore.rules` deployed.
- [ ] All six `VITE_FIREBASE_*` GitHub repository variables added.
- [ ] Gemini Developer API key created.
- [ ] Gemini key stored only as Cloudflare secret `GEMINI_API_KEY`.
- [ ] Worker `FIREBASE_PROJECT_ID` matches the Firebase project.
- [ ] Worker `ALLOWED_ORIGINS` includes `https://rk-1707.github.io`.
- [ ] Worker deployed successfully.
- [ ] `VITE_AI_WORKER_URL` GitHub repository variable added.
- [ ] GitHub Pages deployment workflow is green.
- [ ] Google sign-in works on the live site.
- [ ] First-time onboarding saves opening cash and monthly budget.
- [ ] Smart Entry expense updates cash, expenses, categories and dashboard.
- [ ] Investment entry updates cash, holdings and portfolio totals.
- [ ] Insurance premium updates monthly insurance flow.
- [ ] Loan EMI reduces debt using estimated interest/principal split.
- [ ] Refund and internal transfer do not incorrectly inflate income/spending.
- [ ] Q&A answers from current signed-in FinLens data.
- [ ] Sign out and sign back in; saved data remains.
- [ ] Mobile and desktop layouts checked.
- [ ] No `.env`, Gemini key, service account JSON, password, or private export exists in the public repository.
