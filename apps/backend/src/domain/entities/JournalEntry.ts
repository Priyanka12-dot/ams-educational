import { InvalidJournalEntryError } from "../errors/InvalidJournalEntryError.js";
import { Posting } from "./Posting.js";

/** Immutable journal aggregate. Posted books are corrected by reversal entries. */
export class JournalEntry {
  private constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly entryDate: string,
    public readonly description: string,
    public readonly postings: readonly Posting[],
    public readonly createdBy: string,
    public readonly status: "DRAFT" | "POSTED" | "REVERSED",
    public readonly reversalOf: string | null = null,
  ) {}
  /** Create a draft entry after checking required fields and same-currency lines. */
  public static draft(input: {
    id: string;
    tenantId: string;
    entryDate: string;
    description: string;
    postings: readonly Posting[];
    createdBy: string;
  }): JournalEntry {
    if (
      !input.id ||
      !input.tenantId ||
      !input.createdBy ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.entryDate) ||
      input.description.trim().length === 0 ||
      input.postings.length < 2
    )
      throw new InvalidJournalEntryError("Journal entry data is invalid.");
    const currency = input.postings[0]?.amount.currency;
    if (
      !currency ||
      input.postings.some((line) => line.amount.currency !== currency)
    )
      throw new InvalidJournalEntryError(
        "A journal entry must use one currency.",
      );
    return new JournalEntry(
      input.id,
      input.tenantId,
      input.entryDate,
      input.description.trim(),
      [...input.postings],
      input.createdBy,
      "DRAFT",
    );
  }
  /** Rebuild a trusted persisted aggregate while preserving its immutable stored state. */
  public static reconstitute(input: {
    id: string;
    tenantId: string;
    entryDate: string;
    description: string;
    postings: readonly Posting[];
    createdBy: string;
    status: "DRAFT" | "POSTED" | "REVERSED";
    reversalOf: string | null;
  }): JournalEntry {
    const checked = JournalEntry.draft(input);
    return new JournalEntry(
      checked.id,
      checked.tenantId,
      checked.entryDate,
      checked.description,
      checked.postings,
      checked.createdBy,
      input.status,
      input.reversalOf,
    );
  } /** Transition a balanced draft to POSTED; the source aggregate remains unchanged. */
  public post(): JournalEntry {
    if (this.status !== "DRAFT")
      throw new InvalidJournalEntryError(
        "Only draft journal entries can be posted.",
      );
    return new JournalEntry(
      this.id,
      this.tenantId,
      this.entryDate,
      this.description,
      this.postings,
      this.createdBy,
      "POSTED",
      this.reversalOf,
    );
  }
  /** Build a balanced reversal draft with each line's direction inverted. */
  public reverse(input: {
    id: string;
    createdBy: string;
    entryDate: string;
  }): JournalEntry {
    if (this.status !== "POSTED")
      throw new InvalidJournalEntryError(
        "Only posted entries can be reversed.",
      );
    const postings = this.postings.map((line) =>
      Posting.create(
        line.accountId,
        line.amount,
        line.direction === "DEBIT" ? "CREDIT" : "DEBIT",
      ),
    );
    const reversal = JournalEntry.draft({
      id: input.id,
      tenantId: this.tenantId,
      entryDate: input.entryDate,
      description: `Reversal of ${this.id}`,
      postings,
      createdBy: input.createdBy,
    });
    return new JournalEntry(
      reversal.id,
      reversal.tenantId,
      reversal.entryDate,
      reversal.description,
      reversal.postings,
      reversal.createdBy,
      "DRAFT",
      this.id,
    );
  }
  /** Return this posted entry marked reversed after a separate reversal commits. */
  public markReversed(): JournalEntry {
    if (this.status !== "POSTED")
      throw new InvalidJournalEntryError(
        "Only posted entries can be reversed.",
      );
    return new JournalEntry(
      this.id,
      this.tenantId,
      this.entryDate,
      this.description,
      this.postings,
      this.createdBy,
      "REVERSED",
      this.reversalOf,
    );
  }
}
