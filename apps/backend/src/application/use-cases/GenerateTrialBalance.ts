import { TrialBalanceCalculator } from "../../domain/services/TrialBalanceCalculator.js";
import type { IAccountRepository } from "../../domain/repositories/IAccountRepository.js";
import type { IJournalEntryRepository } from "../../domain/repositories/IJournalEntryRepository.js";
export class GenerateTrialBalance {
  public constructor(
    private readonly accounts: IAccountRepository,
    private readonly journals: IJournalEntryRepository,
    private readonly calculator = new TrialBalanceCalculator(),
  ) {}
  /** Compute a tenant-scoped trial balance from posted lines for an inclusive date range. */
  public async execute(tenantId: string, from?: string, through?: string) {
    const [accounts, postings] = await Promise.all([
      this.accounts.list(tenantId),
      this.journals.listPostings(tenantId, from, through),
    ]);
    return this.calculator.calculate(
      accounts.map((a) => ({
        accountId: a.id,
        code: a.code.value,
        name: a.name,
        type: a.type,
      })),
      postings,
    );
  }
}
