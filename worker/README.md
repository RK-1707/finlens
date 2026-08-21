# FinLens AI Worker

This Cloudflare Worker keeps the Gemini API key off the public website. It exposes two authenticated endpoints:

- `POST /parse` — converts Dashboard Smart Entry text into structured FinLens data.
- `POST /qa` — answers Q&A from the signed-in user's structured FinLens context.

The Worker verifies the Firebase ID token before calling Gemini. The Gemini key is stored as a Cloudflare secret and is never committed to GitHub.

## Deploy

1. Install dependencies: `npm install`
2. Edit `wrangler.toml` and replace `YOUR_FIREBASE_PROJECT_ID`.
3. Sign in to Cloudflare: `npx wrangler login`
4. Store the Gemini key: `npx wrangler secret put GEMINI_API_KEY`
5. Deploy: `npm run deploy`
6. Copy the Worker URL into GitHub repository variable `VITE_AI_WORKER_URL`.

The default model is `gemini-3.5-flash-lite`. Change `GEMINI_MODEL` in `wrangler.toml` later if required.
