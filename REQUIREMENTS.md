# FinLens Requirements

## Product

FinLens is a personal-finance web app with a single Dashboard Smart Entry and linked pages for Expenses, Investments, Insurance, Loans & Liabilities, Q&A, and Contact Us.

## Navigation

A global navigation control provides direct access to:

- Dashboard
- Expense Tracker
- Investments
- Insurances
- Loans & Liabilities
- Q&A with FinLens
- Contact Us

Smart Entry appears only on Dashboard and uses the placeholder:

`Enter your financial transactions here`

## Core data flow

Every successful Smart Entry is written to the signed-in user's Firestore data. All pages subscribe to the same records through realtime listeners. No page keeps an independent financial balance.

## Dashboard

- Net Worth = cash + investments − liabilities
- Cash in Hand
- Month Expenses
- Investments / portfolio value
- Where the Money Goes
- Past 7 Days Expenses
- Actual Income Allocation
- Upcoming Financial Commitments

Insurance cover is excluded from net worth.

## Expense Tracker

- Expenses This Month
- Cash Remaining
- Budgets
- Recurring Payments & Subscriptions
- Where the Money Is Getting Spent
- Recent Activity
- Safe-to-Spend / Remaining Day
- Detailed Spending Insights
- Month-end Spending Projection
- Essential vs Discretionary

## Investments

- Total Portfolio Value
- Total Invested
- Gain / loss
- Asset allocation
- Holdings including stocks, mutual funds, ETFs and commodities/metals
- Portfolio performance
- Goals
- Target allocation drift
- Upcoming investment events
- Informational insights

Gemini is never the source of live market prices or NAVs.

## Insurance

- Active policy count
- Annual premium commitment
- Life / health cover
- Next premium due
- My Policies
- Full-width Coverage Breakdown
- Insurance Insights below Coverage Breakdown
- Recent insurance activity where available

Cover amounts are protection amounts, not assets.

## Loans & Liabilities

- Total outstanding debt
- Monthly EMI commitment
- Next EMI
- Debt-free estimate
- Loan cards
- Repayment progress
- Upcoming EMIs
- Prepayment simulator
- Informational debt insights

## Q&A

Q&A receives a limited structured snapshot of the signed-in user's FinLens data. It must not invent balances, prices, policy values, rates or transactions.

## Smart Entry classifications

Supported intent types include:

- Expense
- Income
- Refund/cashback
- Internal transfer
- Investment buy/sell/income/value update/event
- Insurance premium / policy setup
- Loan EMI / loan received / loan setup
- Budget
- Recurring payment
- Goal
- Target allocation

## Hosting and security

- GitHub Pages for the static frontend
- Firebase Authentication and Firestore for user data
- Cloudflare Worker for Gemini access
- Gemini key stored only as Cloudflare secret
- Firebase ID token verified by Worker
- Firestore rules deny cross-user access
- GitHub repository contains no private API secret

## Responsive UX

Desktop is the primary web layout with wide cards, readable tables, efficient use of horizontal space and clear financial hierarchy. Tablet/mobile breakpoints stack cards, preserve scrollable tables and keep Smart Entry usable without overflow.
