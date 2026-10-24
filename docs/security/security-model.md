# Security model

## Implemented controls

- Argon2id password hashing, 12-character minimum, 15-minute JWT access cookies, rotating refresh cookies with SHA-256 hashes in the database.
- HttpOnly, SameSite=Strict cookies; production configuration requires Secure cookies.
- Roles ADMIN, ACCOUNTANT, AUDITOR, VIEWER; write routes reject non-writers. Tenant IDs come from signed access claims, never request JSON.
- Strict Zod request schemas, parameterized PostgreSQL queries, NUMERIC(19,4), per-account tenant filters, and transaction-scoped journal posting.
- Helmet headers, explicit CORS origin, request body cap, timeout, rate limits, generic client errors, and request correlation IDs.
- Audit and event rows for registration, login, account creation, and posted journals.

## Known gaps before claiming ASVS Level 2

This educational starter has not had an independent security review. Login looks up by email globally and per-user lockout is basic; add organization-aware identity selection and distributed per-username throttling. Managed signing-key rotation is a deployment responsibility. Database integration and security test suites are not complete. The frontend CSP is present in the static meta policy and the production Nginx response header. Accounting/reporting routes use Drizzle repository adapters; authentication routes still use parameterized pg transactions inside the web adapter. Extracting those auth flows into application use cases is a remaining boundary improvement. The current suite has focused domain/application unit tests, but database integration, API 401/403/429 tests, browser E2E coverage, and the 80% coverage target remain incomplete. Interactive Swagger UI and a reversal API are also not wired yet; the OpenAPI file and reversal domain behavior are the current starting points. Do not deploy with production financial data until these gaps are addressed and reviewed.

## Threat model

Primary threats are tenant data disclosure, credential theft, replayed tokens, unbalanced writes, injection, and audit tampering. Short-lived signed claims, hashed rotating refresh tokens, strict parsing, tenant-bound SQL predicates, transactions, exact arithmetic, and append-only constraints reduce these risks. Require TLS at the deployment proxy and encrypt database storage and backups.
