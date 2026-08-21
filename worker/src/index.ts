import { createRemoteJWKSet, jwtVerify } from 'jose';

interface Env {
  GEMINI_API_KEY?: string;
  FIREBASE_PROJECT_ID: string;
  ALLOWED_ORIGINS: string;
  GEMINI_MODEL?: string;
}

type Json = Record<string, unknown>;

const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const ACTIONS = new Set(['expense','income','refund','transfer','investment_buy','investment_sell','investment_income','investment_event','investment_value_update','insurance_premium','policy_setup','loan_emi','loan_received','loan_setup','budget','recurring','goal','target_allocation']);

function allowedOrigins(env: Env) {
  return new Set((env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean));
}

function cors(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const allowed = allowedOrigins(env);
  return {
    'Access-Control-Allow-Origin': allowed.has(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(request: Request, env: Env, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(request, env) } });
}

function originAllowed(request: Request, env: Env) {
  const origin = request.headers.get('Origin');
  return !origin || allowedOrigins(env).has(origin);
}

async function verifyFirebaseUser(request: Request, env: Env): Promise<string> {
  const projectId = (env.FIREBASE_PROJECT_ID || '').trim();
  if (!projectId || projectId === 'YOUR_FIREBASE_PROJECT_ID') throw new Error('Worker Firebase project is not configured.');
  const auth = request.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('Missing authentication token.');
  const { payload } = await jwtVerify(match[1], jwks, {
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  });
  const uid = typeof payload.sub === 'string' ? payload.sub : '';
  if (!uid) throw new Error('Invalid authentication token.');
  return uid;
}

async function readBody(request: Request): Promise<Json> {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 200_000) throw new Error('Request is too large.');
  const body = await request.json() as Json;
  if (!body || typeof body !== 'object') throw new Error('Invalid request body.');
  return body;
}

function extractGeminiText(payload: unknown): string {
  const p = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return p.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || '';
}

async function callGemini(env: Env, prompt: string, jsonMode = false): Promise<string> {
  const key = (env.GEMINI_API_KEY || '').trim();
  if (!key) throw new Error('Gemini API key is not configured.');
  const model = (env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const body: Json = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: jsonMode ? 0 : 0.2,
      maxOutputTokens: jsonMode ? 2048 : 1400,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) {
    const message = (payload as { error?: { message?: string } }).error?.message || `Gemini returned ${response.status}.`;
    throw new Error(message);
  }
  const text = extractGeminiText(payload);
  if (!text) throw new Error('Gemini returned an empty response.');
  return text;
}

function safeNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function safeString(value: unknown, max = 500): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

function normalizeParsed(raw: Json, text: string) {
  const action = typeof raw.action === 'string' && ACTIONS.has(raw.action) ? raw.action : '';
  const amount = safeNumber(raw.amount);
  const category = safeString(raw.category, 100);
  const name = safeString(raw.name, 120);
  const note = safeString(raw.note, 500) || text.slice(0, 500);
  if (!action || amount === undefined || !category || !name || typeof raw.essential !== 'boolean') throw new Error('Gemini returned incomplete transaction data.');
  const result: Json = { action, amount, category, name, note, essential: raw.essential };
  for (const key of ['assetType','premiumFrequency','policyType','loanName','frequency','targetDate','budgetCategory','policyNumber','startDate','endDate','nominee','riders']) {
    const value = safeString(raw[key], 160);
    if (value !== undefined) result[key] = value;
  }
  for (const key of ['currentValue','coverAmount','annualPremium','premiumAmount','interestRate','emi','originalPrincipal','dueDay','targetAmount','currentAmount']) {
    const value = safeNumber(raw[key]);
    if (value !== undefined) result[key] = value;
  }
  return result;
}

function parsePrompt(text: string) {
  return `You are the transaction interpreter for FinLens, an Indian personal-finance app. Return one JSON object only.\n\nRequired fields: action, amount, category, name, note, essential.\nAllowed actions: expense, income, refund, transfer, investment_buy, investment_sell, investment_income, investment_event, investment_value_update, insurance_premium, policy_setup, loan_emi, loan_received, loan_setup, budget, recurring, goal, target_allocation.\nOptional fields: assetType, currentValue, coverAmount, annualPremium, premiumAmount, premiumFrequency, policyType, loanName, interestRate, emi, originalPrincipal, dueDay, frequency, targetAmount, currentAmount, targetDate, budgetCategory, policyNumber, startDate, endDate, nominee, riders.\n\nRules:\n- Treat amounts as INR unless explicitly stated otherwise.\n- Never invent market prices, NAVs, current investment values, insurance cover, loan rate, EMI, due dates, policy details, or any other number.\n- Investment purchase: amount is cash invested; currentValue is omitted unless user explicitly supplied it.\n- Loan EMI is loan_emi, not expense. Insurance premium payment is insurance_premium, not expense.\n- Internal account transfer is transfer and does not count as income/spending.\n- Refund/cashback is refund.\n- Budget setup is budget; monthly recurring subscription is recurring; future maturity/dividend/coupon is investment_event.\n- Existing loan details are loan_setup; new borrowed cash received is loan_received.\n- Insurance policy/cover setup is policy_setup; payment is insurance_premium.\n- target_allocation amount is percentage points (e.g. 50 for 50%).\n- essential=true only for clearly essential living costs, insurance premiums, or loan EMIs.\n- Preserve named investments/policies/loans where possible.\n\nUser entry: ${JSON.stringify(text)}`;
}

function qaPrompt(question: string, context: unknown) {
  return `You are FinLens Q&A. Answer only from the signed-in user's supplied FinLens data. If the data is insufficient, say what is missing instead of guessing. Never invent prices, NAVs, balances, policy values, transactions, rates, tax facts, or returns. Use concise Indian-rupee formatting. Give informational analysis, not investment, insurance, tax, or lending advice.\n\nFINLENS DATA:\n${JSON.stringify(context)}\n\nQUESTION:\n${question}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request, env) });
    if (!originAllowed(request, env)) return json(request, env, { error: 'Origin is not allowed.' }, 403);
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') return json(request, env, { ok: true, service: 'FinLens AI Worker' });
    if (request.method !== 'POST') return json(request, env, { error: 'Not found.' }, 404);

    try {
      await verifyFirebaseUser(request, env);
      const body = await readBody(request);
      if (url.pathname === '/parse') {
        const text = safeString(body.text, 1000);
        if (!text) return json(request, env, { error: 'Enter a transaction first.' }, 400);
        const rawText = await callGemini(env, parsePrompt(text), true);
        let raw: Json;
        try { raw = JSON.parse(rawText) as Json; } catch { throw new Error('Gemini did not return valid JSON.'); }
        return json(request, env, { parsed: normalizeParsed(raw, text) });
      }
      if (url.pathname === '/qa') {
        const question = safeString(body.question, 1000);
        if (!question) return json(request, env, { error: 'Enter a question first.' }, 400);
        const context = body.context && typeof body.context === 'object' ? body.context : {};
        const answer = await callGemini(env, qaPrompt(question, context), false);
        return json(request, env, { answer });
      }
      return json(request, env, { error: 'Not found.' }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed.';
      const authError = /authentication token|Firebase project/.test(message);
      return json(request, env, { error: message }, authError ? 401 : 502);
    }
  },
};
