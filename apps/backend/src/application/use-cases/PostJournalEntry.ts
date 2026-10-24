import { JournalEntry } from "../../domain/entities/JournalEntry.js";
import { ForbiddenError } from "../../domain/errors/ForbiddenError.js";
import { Posting } from "../../domain/entities/Posting.js";
import { PostingEngine } from "../../domain/services/PostingEngine.js";
import { Money } from "../../domain/value-objects/Money.js";
import type { IJournalEntryRepository } from "../../domain/repositories/IJournalEntryRepository.js";
import type { IAccountRepository } from "../../domain/repositories/IAccountRepository.js";
import type { IAuditLog } from "../ports/IAuditLog.js";
import type { CreateJournalEntryInput } from "@ams/shared";
export class PostJournalEntry {
  public constructor(
    private readonly journals: IJournalEntryRepository,
    private readonly accounts: IAccountRepository,
    private readonly audit: IAuditLog,
    private readonly engine = new PostingEngine(),
  ) {}
  /** Validate tenant-owned accounts and balance before appending a posted journal. */
  public async execute(
    input: CreateJournalEntryInput,
    principal: { id: string; tenantId: string; role: string },
  ): Promise<JournalEntry> {
    if (!["ADMIN", "ACCOUNTANT"].includes(principal.role))
      throw new ForbiddenError();
    const postings = input.postings.map((x) =>
      Posting.create(x.accountId, Money.fromDecimal(x.amount), x.direction),
    );
    for (const line of postings)
      if (
        !(await this.accounts.findById(principal.tenantId, line.accountId))
          ?.active
      )
        throw new Error("Account unavailable");
    const draft = JournalEntry.draft({
      id: crypto.randomUUID(),
      tenantId: principal.tenantId,
      entryDate: input.entryDate,
      description: input.description,
      postings,
      createdBy: principal.id,
    });
    this.engine.validate(draft);
    const posted = draft.post();
    await this.journals.post(posted, {
      eventId: crypto.randomUUID(),
      eventType: "JournalEntryPosted",
      tenantId: principal.tenantId,
      aggregateId: posted.id,
      occurredAt: new Date().toISOString(),
      payload: {
        entryDate: posted.entryDate,
        description: posted.description,
        postingCount: posted.postings.length,
      },
    });
    await this.audit.write({
      tenantId: principal.tenantId,
      userId: principal.id,
      action: "JOURNAL_ENTRY_POSTED",
      entity: "journal_entry",
      entityId: posted.id,
      metadata: { postingCount: posted.postings.length },
    });
    return posted;
  }
}
