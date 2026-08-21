import type { ParsedEntry } from '../types';

const slug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'item';
export const entityId = (value: string) => slug(value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
export const normalizedName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function parseAmountToken(token: string): number {
  const clean = token.toLowerCase().replace(/[₹,\s]/g, '').replace(/^rs\.?/, '');
  const match = clean.match(/^([0-9]+(?:\.[0-9]+)?)(k|thousand|l|lac|lakh|cr|crore)?$/);
  if (!match) return 0;
  let value = Number(match[1]);
  const suffix = match[2];
  if (suffix === 'k' || suffix === 'thousand') value *= 1_000;
  if (suffix === 'l' || suffix === 'lac' || suffix === 'lakh') value *= 100_000;
  if (suffix === 'cr' || suffix === 'crore') value *= 10_000_000;
  return value;
}

function firstAmount(text: string): number {
  const re = /(?:₹|rs\.?\s*)?([0-9]+(?:,[0-9]{2,3})*(?:\.[0-9]+)?)(?:\s*(k|thousand|l|lac|lakh|cr|crore)\b)?/i;
  const match = text.match(re);
  return match ? parseAmountToken(`${match[1]}${match[2] || ''}`) : 0;
}

function amountAfter(text: string, keyword: string): number {
  const i = text.toLowerCase().indexOf(keyword.toLowerCase());
  return i >= 0 ? firstAmount(text.slice(i + keyword.length)) : 0;
}

function amountBefore(text: string, keyword: string): number {
  const i = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (i < 0) return 0;
  const before = text.slice(0, i);
  const matches = before.match(/(?:₹|rs\.?\s*)?[0-9]+(?:,[0-9]{2,3})*(?:\.[0-9]+)?(?:\s*(?:k|thousand|l|lac|lakh|cr|crore)\b)?/gi) || [];
  return matches.length ? firstAmount(matches[matches.length - 1]) : 0;
}

function percentFrom(text: string): number | undefined {
  const m = text.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
  return m ? Number(m[1]) : undefined;
}

function dueDayFrom(text: string): number | undefined {
  const m = text.match(/(?:due|on)\s+(?:the\s+)?([0-9]{1,2})(?:st|nd|rd|th)?/i);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= 31 ? n : undefined;
}

function categoryFromText(text: string): string {
  const t = text.toLowerCase();
  if (/swiggy|zomato|dinner|lunch|breakfast|food|cafe|restaurant|coffee|chai/.test(t)) return 'Food & Dining';
  if (/ola|uber|cab|taxi|metro|rickshaw|fuel|petrol|diesel/.test(t)) return 'Transport';
  if (/amazon|myntra|shopping|clothes|shirt|shoes|electronics/.test(t)) return 'Shopping';
  if (/electricity|internet|wifi|mobile bill|gas bill|utility/.test(t)) return 'Utilities';
  if (/movie|netflix|bowling|arcade|concert|entertainment/.test(t)) return 'Entertainment';
  if (/grocery|groceries|blinkit|zepto|vegetable|milk/.test(t)) return 'Groceries';
  if (/rent|house rent/.test(t)) return 'Housing';
  if (/doctor|medicine|pharmacy|health/.test(t)) return 'Health';
  if (/school|college|course|education|tuition/.test(t)) return 'Education';
  return 'Others';
}

function isEssentialCategory(category: string): boolean {
  return /Transport|Utilities|Groceries|Housing|Health|Education/i.test(category);
}

function investmentType(text: string): string {
  const t = text.toLowerCase();
  if (/gold|silver|metal|commodity/.test(t)) return /etf/.test(t) ? `Commodity ETF · ${/silver/.test(t) ? 'Silver' : 'Gold'}` : `Commodity · ${/silver/.test(t) ? 'Silver' : 'Gold'}`;
  if (/mutual|fund|sip/.test(t) && !/etf/.test(t)) return 'Mutual Fund';
  if (/etf/.test(t)) return 'ETF';
  if (/stock|share|equity/.test(t)) return 'Stock';
  if (/fd|fixed deposit|bond|debt/.test(t)) return 'Debt';
  if (/crypto|bitcoin|ethereum/.test(t)) return 'Crypto';
  if (/real estate|property/.test(t)) return 'Real Estate';
  return 'Other Investment';
}

function investmentName(text: string): string {
  const t = text.toLowerCase();
  if (/reliance/.test(t)) return 'Reliance Industries';
  if (/icici bank/.test(t)) return 'ICICI Bank';
  if (/nifty.*bees|bees/.test(t)) return 'Nifty BeES';
  if (/gold/.test(t) && /etf/.test(t)) return 'Gold ETF';
  if (/silver/.test(t) && /etf/.test(t)) return 'Silver ETF';
  if (/gold/.test(t)) return 'Gold';
  if (/silver/.test(t)) return 'Silver';
  if (/mutual|fund|sip/.test(t)) return 'Mutual Fund Investment';
  if (/etf/.test(t)) return 'ETF Investment';
  if (/stock|share/.test(t)) return 'Stock Investment';
  return 'Investment';
}

export function fallbackParse(text: string): ParsedEntry {
  const t = text.toLowerCase();
  const amount = firstAmount(text);
  const category = categoryFromText(text);

  if (/target allocation|allocation target/.test(t)) {
    const label = /mutual/.test(t) ? 'Mutual Funds' : /etf/.test(t) ? 'ETFs' : /stock|equity/.test(t) ? 'Stocks' : /gold|silver|metal|commodity/.test(t) ? 'Metals & Commodities' : /debt|bond|fd/.test(t) ? 'Debt' : 'Other';
    return { action: 'target_allocation', amount, category: 'Configuration', name: label, note: text, essential: false };
  }
  if (/maturity|matures|dividend due|coupon due|interest due|expected dividend/.test(t)) {
    return { action: 'investment_event', amount, category: 'Investments', name: /maturity|matures/.test(t) ? 'Investment Maturity' : 'Investment Income Event', note: text, essential: false, dueDay: dueDayFrom(text) };
  }
  if (/dividend|distribution|interest received|fd interest|bond interest/.test(t) && /received|credited|got|paid/.test(t)) {
    return { action: 'investment_income', amount, category: 'Investment Income', name: /dividend/.test(t) ? 'Dividend Income' : 'Investment Income', note: text, essential: false };
  }
  if (/set .*budget|budget.*(?:₹|rs|\d)/.test(t)) {
    return { action: 'budget', amount, category: 'Configuration', name: 'Budget', note: text, essential: false, budgetCategory: category };
  }
  if (/goal/.test(t) && /create|target|save/.test(t)) {
    return { action: 'goal', amount, category: 'Configuration', name: text.replace(/create|goal|target|save/gi, '').trim().slice(0, 80) || 'Financial Goal', note: text, essential: false, targetAmount: amount };
  }
  if (/subscription|recurring|every month|monthly.*(?:netflix|internet|rent)/.test(t)) {
    return { action: 'recurring', amount, category: 'Configuration', name: /netflix/.test(t) ? 'Netflix' : /internet|wifi/.test(t) ? 'Internet' : /rent/.test(t) ? 'Rent' : 'Recurring Payment', note: text, essential: false, frequency: 'Monthly', dueDay: dueDayFrom(text) };
  }
  if (/transfer|moved money|move money/.test(t)) return { action: 'transfer', amount, category: 'Transfer', name: 'Internal Transfer', note: text, essential: false };
  if (/refund|cashback|reversal/.test(t)) return { action: 'refund', amount, category, name: `${category} Refund`, note: text, essential: isEssentialCategory(category) };
  if (/loan/.test(t) && /received|disbursed|borrowed/.test(t)) return { action: 'loan_received', amount, category: 'Loans', name: 'Loan Disbursement', note: text, essential: false, loanName: /student/.test(t) ? 'Student Loan' : /personal/.test(t) ? 'Personal Loan' : 'Loan', interestRate: percentFrom(text), emi: amountBefore(text, 'emi') || undefined, dueDay: dueDayFrom(text) };
  if (/loan/.test(t) && /have|outstanding|balance|emi|interest/.test(t) && !/paid|payment/.test(t)) return { action: 'loan_setup', amount, category: 'Loans', name: 'Loan', note: text, essential: false, loanName: /student/.test(t) ? 'Student Loan' : /personal/.test(t) ? 'Personal Loan' : 'Loan', originalPrincipal: amount, interestRate: percentFrom(text), emi: amountBefore(text, 'emi') || undefined, dueDay: dueDayFrom(text) };
  if (/insurance|policy/.test(t) && /cover|sum assured|annual premium/.test(t)) return { action: 'policy_setup', amount, category: 'Insurance', name: /\blic\b/.test(t) ? 'LIC Policy' : 'Insurance Policy', note: text, essential: false, coverAmount: amountBefore(text, 'cover') || amountBefore(text, 'sum assured') || amount, annualPremium: amountBefore(text, 'annual premium') || amountBefore(text, 'premium') || amountAfter(text, 'premium') || undefined, policyType: /health/.test(t) ? 'Health' : /motor|car|vehicle/.test(t) ? 'Motor' : 'Life', dueDay: dueDayFrom(text) };
  if (/premium|insurance/.test(t) && (/paid|pay|payment/.test(t) || (/premium/.test(t) && !/cover|sum assured|annual premium/.test(t)))) return { action: 'insurance_premium', amount, category: 'Insurance', name: /\blic\b/.test(t) ? 'LIC Premium' : 'Insurance Premium', note: text, essential: true, policyType: /health/.test(t) ? 'Health' : /motor|car|vehicle/.test(t) ? 'Motor' : 'Life', dueDay: dueDayFrom(text) };
  if (/emi|loan repayment|paid.*loan/.test(t)) return { action: 'loan_emi', amount, category: 'Loans', name: 'Loan EMI', note: text, essential: true, loanName: /student/.test(t) ? 'Student Loan' : /personal/.test(t) ? 'Personal Loan' : 'Loan' };
  if (/salary|income|bonus|credited|received/.test(t)) return { action: 'income', amount, category: 'Income', name: /salary/.test(t) ? 'Salary' : 'Income', note: text, essential: false };
  if (/current value|market value|value of/.test(t) && /invest|mutual|stock|share|etf|fund|gold|silver|bond|crypto|property|reliance|icici/.test(t)) {
    return { action: 'investment_value_update', amount, category: 'Investments', name: investmentName(text), note: text, essential: false, assetType: investmentType(text), currentValue: amount };
  }
  if (/invest|mutual|stock|share|etf|fund|sip|gold|silver|bond|fixed deposit|crypto|bitcoin|ethereum|property/.test(t)) {
    const action = /sold|redeem|redeemed|withdrew|withdrawn/.test(t) ? 'investment_sell' : 'investment_buy';
    return { action, amount, category: 'Investments', name: investmentName(text), note: text, essential: false, assetType: investmentType(text) };
  }
  return { action: 'expense', amount, category, name: category, note: text, essential: isEssentialCategory(category) };
}
