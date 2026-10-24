import type { JournalEntry } from "../entities/JournalEntry.js";
import type { Posting } from "../entities/Posting.js";
export interface JournalEntrySummary {
  readonly id: string;
  readonly entryDate: string;
  readonly description: string;
  readonly status: "DRAFT" | "POSTED" | "REVERSED";
  readonly createdAt: string;
}
export interface LedgerPosting {
  readonly journalEntryId: string;
  readonly entryDate: string;
  readonly description: string;
  readonly amount: string;
  readonly direction: "DEBIT" | "CREDIT";
}
/** Tenant-scoped ledger port; posted entries and events must commit atomically. */
export interface IJournalEntryRepository {
  saveDraft(entry: JournalEntry): Promise<void>;
  post(
    entry: JournalEntry,
    event: Readonly<Record<string, unknown>>,
  ): Promise<void>;
  findById(tenantId: string, id: string): Promise<JournalEntry | null>;
  listPostings(
    tenantId: string,
    from?: string,
    through?: string,
  ): Promise<readonly Posting[]>;
  listEntries(tenantId: string): Promise<readonly JournalEntrySummary[]>;
  getLedger(
    tenantId: string,
    accountId: string,
  ): Promise<readonly LedgerPosting[]>;
}
