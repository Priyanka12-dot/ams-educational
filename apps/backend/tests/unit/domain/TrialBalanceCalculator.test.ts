import { describe, it, expect } from "vitest";
import { TrialBalanceCalculator } from "../../../src/domain/services/TrialBalanceCalculator.js";
import { Posting } from "../../../src/domain/entities/Posting.js";
import { Money } from "../../../src/domain/value-objects/Money.js";
describe("TrialBalanceCalculator", () => {
  it("uses debit normal for assets and credit normal for liabilities", () => {
    const rows = new TrialBalanceCalculator().calculate(
      [
        { accountId: "a", code: "1000", name: "Cash", type: "ASSET" },
        { accountId: "l", code: "2000", name: "Debt", type: "LIABILITY" },
      ],
      [
        Posting.create("a", Money.fromDecimal("12.50"), "DEBIT"),
        Posting.create("l", Money.fromDecimal("12.50"), "CREDIT"),
      ],
    );
    expect(rows[0]?.net.toDecimal()).toBe("12.5000");
    expect(rows[1]?.net.toDecimal()).toBe("12.5000");
  });
});
