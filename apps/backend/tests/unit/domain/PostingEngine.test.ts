import { describe, it, expect } from "vitest";
import { PostingEngine } from "../../../src/domain/services/PostingEngine.js";
import { Posting } from "../../../src/domain/entities/Posting.js";
import { Money } from "../../../src/domain/value-objects/Money.js";
import { JournalEntry } from "../../../src/domain/entities/JournalEntry.js";
const line = (
  accountId: string,
  amount: string,
  direction: "DEBIT" | "CREDIT",
) => Posting.create(accountId, Money.fromDecimal(amount), direction);
describe("PostingEngine", () => {
  it("accepts exact balanced decimals", () => {
    const e = JournalEntry.draft({
      id: "j",
      tenantId: "t",
      entryDate: "2026-01-01",
      description: "Opening",
      createdBy: "u",
      postings: [
        line("a", "100.1001", "DEBIT"),
        line("b", "100.1001", "CREDIT"),
      ],
    });
    expect(() => new PostingEngine().validate(e)).not.toThrow();
  });
  it("rejects unbalanced entries", () => {
    const e = JournalEntry.draft({
      id: "j",
      tenantId: "t",
      entryDate: "2026-01-01",
      description: "Bad",
      createdBy: "u",
      postings: [line("a", "100", "DEBIT"), line("b", "99.9999", "CREDIT")],
    });
    expect(() => new PostingEngine().validate(e)).toThrow(
      "debits must equal credits",
    );
  });
  it("rejects one-line entries", () =>
    expect(() =>
      PostingEngine.validateLines([line("a", "1", "DEBIT")]),
    ).toThrow());
});
