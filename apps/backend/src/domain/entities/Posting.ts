import type { Direction } from "@ams/shared";
import { DomainError } from "../errors/DomainError.js";
import { Money } from "../value-objects/Money.js";
/** One immutable debit or credit line in a journal entry. */
export class Posting {
  private constructor(
    public readonly accountId: string,
    public readonly amount: Money,
    public readonly direction: Direction,
  ) {}
  /** Validate a posting and retain direction separately from its strictly positive amount. */
  public static create(
    accountId: string,
    amount: Money,
    direction: Direction,
  ): Posting {
    if (!accountId || amount.minorUnits() <= 0n)
      throw new DomainError(
        "Posting account and positive amount are required.",
      );
    return new Posting(accountId, amount, direction);
  }
}
