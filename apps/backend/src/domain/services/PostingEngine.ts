import { UnbalancedEntryError } from "../errors/UnbalancedEntryError.js";
import type { JournalEntry } from "../entities/JournalEntry.js";
import type { Posting } from "../entities/Posting.js";
/** Domain service that owns the universal double-entry invariant. */
export class PostingEngine {
  /** Validate that an entry has at least two positive lines, one currency, and equal exact totals. */
  public validate(entry: JournalEntry): void {
    PostingEngine.validateLines(entry.postings);
  }
  /** Validate posting lines before an entry is assembled or persisted. */
  public static validateLines(lines: readonly Posting[]): void {
    if (lines.length < 2) throw new UnbalancedEntryError();
    const currency = lines[0]?.amount.currency;
    if (
      !currency ||
      lines.some(
        (line) =>
          line.amount.currency !== currency || line.amount.minorUnits() <= 0n,
      )
    )
      throw new UnbalancedEntryError();
    let debits = 0n;
    let credits = 0n;
    for (const line of lines)
      line.direction === "DEBIT"
        ? (debits += line.amount.minorUnits())
        : (credits += line.amount.minorUnits());
    if (debits !== credits) throw new UnbalancedEntryError();
  }
}
