import type { IJournalEntryRepository } from "../../domain/repositories/IJournalEntryRepository.js";
/** Read-side use case for one tenant-owned ledger account. */
export class GetAccountLedger {
  public constructor(private readonly journals: IJournalEntryRepository) {}
  /** Return only postings for the given tenant and account. */
  public execute(tenantId: string, accountId: string) {
    return this.journals.getLedger(tenantId, accountId);
  }
}
