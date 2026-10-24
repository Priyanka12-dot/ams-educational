import type { Pool } from "pg";
import { CreateAccount } from "./application/use-cases/CreateAccount.js";
import { GenerateTrialBalance } from "./application/use-cases/GenerateTrialBalance.js";
import { GetAccountLedger } from "./application/use-cases/GetAccountLedger.js";
import { ListJournalEntries } from "./application/use-cases/ListJournalEntries.js";
import { PostJournalEntry } from "./application/use-cases/PostJournalEntry.js";
import { PostgresAccountRepository } from "./infrastructure/persistence/PostgresAccountRepository.js";
import { PostgresAuditLog } from "./infrastructure/persistence/PostgresAuditLog.js";
import { PostgresJournalEntryRepository } from "./infrastructure/persistence/PostgresJournalEntryRepository.js";
import { PostgresEventPublisher } from "./infrastructure/persistence/PostgresEventPublisher.js";
import { createDatabase } from "./infrastructure/persistence/database.js";
/** Compose application use cases from Drizzle adapters at the outer boundary. */
export function createContainer(pool: Pool) {
  const db = createDatabase(pool);
  const accounts = new PostgresAccountRepository(db);
  const journals = new PostgresJournalEntryRepository(db);
  const audit = new PostgresAuditLog(db);
  const events = new PostgresEventPublisher(db);
  return {
    accounts,
    createAccount: new CreateAccount(accounts, audit, events),
    postJournalEntry: new PostJournalEntry(journals, accounts, audit),
    generateTrialBalance: new GenerateTrialBalance(accounts, journals),
    getAccountLedger: new GetAccountLedger(journals),
    listJournalEntries: new ListJournalEntries(journals),
  };
}
