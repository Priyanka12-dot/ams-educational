import type { IJournalEntryRepository } from "../../domain/repositories/IJournalEntryRepository.js";
/** Read-side use case for recent journal headers in one tenant. */
export class ListJournalEntries {
  public constructor(private readonly journals: IJournalEntryRepository) {}
  /** Return the tenant's recent entries; the caller supplies tenant from verified claims. */
  public execute(tenantId: string) {
    return this.journals.listEntries(tenantId);
  }
}
