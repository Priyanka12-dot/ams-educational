import { describe, it, expect } from "vitest";
import { Money } from "../../../src/domain/value-objects/Money.js";
describe("Money", () => {
  it("keeps exact four-decimal arithmetic", () =>
    expect(
      Money.fromDecimal("0.1001").add(Money.fromDecimal("0.2002")).toDecimal(),
    ).toBe("0.3003"));
  it("rejects zero, excess precision, and overflow", () => {
    expect(() => Money.fromDecimal("0")).toThrow();
    expect(() => Money.fromDecimal("1.00001")).toThrow();
    expect(() => Money.fromDecimal("1000000000000000")).toThrow();
  });
});
