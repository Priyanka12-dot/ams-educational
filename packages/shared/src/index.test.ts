import { describe, it, expect } from "vitest";
import { createAccountSchema, createJournalEntrySchema } from "./index.js";
describe("shared API schemas", () => {
  it("rejects unknown account properties", () =>
    expect(
      createAccountSchema.safeParse({
        code: "1000",
        name: "Cash",
        type: "ASSET",
        tenantId: "spoof",
      }).success,
    ).toBe(false));
  it("rejects a zero amount", () =>
    expect(
      createJournalEntrySchema.safeParse({
        entryDate: "2026-01-01",
        description: "Entry",
        postings: [
          {
            accountId: "00000000-0000-4000-8000-000000000001",
            amount: "0",
            direction: "DEBIT",
          },
          {
            accountId: "00000000-0000-4000-8000-000000000002",
            amount: "1",
            direction: "CREDIT",
          },
        ],
      }).success,
    ).toBe(false));
});
