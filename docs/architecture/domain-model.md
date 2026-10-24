# Domain model

Money parses decimal strings into scaled bigint units at four decimal places, matching NUMERIC(19,4) without floating point rounding. A Posting has a positive amount and explicit direction. JournalEntry is immutable: DRAFT can transition to POSTED once; posted entries are corrected through an inverted reversal. PostingEngine checks line count, currency, positivity, and exact equality. Trial-balance rows apply debit-normal balances to assets and expenses and credit-normal balances to liabilities, equity, and revenue.

```mermaid
classDiagram
 class Account { id; tenantId; code; type; active }
 class JournalEntry { id; tenantId; entryDate; status }
 class Posting { accountId; amount: Money; direction }
 class Money { amount: bigint; currency }
 JournalEntry "1" --> "2..*" Posting
 Posting --> Money
 Posting --> Account
```
