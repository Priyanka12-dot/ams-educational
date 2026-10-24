# Getting started

1. Install Docker Desktop, Node.js 22+, and pnpm 9.
2. Copy `.env.example` to `.env` and replace both signing secrets with distinct random values.
3. Run `docker compose up --build`.
4. Open http://localhost:5173 and create an organization.
5. Create ledger accounts, then post a journal with equal debit and credit amounts.

Use the trial balance screen to inspect totals. Posted entries are immutable; correct mistakes with an equal and opposite reversal.
