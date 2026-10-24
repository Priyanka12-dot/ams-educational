import { DomainError } from "../errors/DomainError.js";
/** A normalized, bounded chart-of-accounts identifier. */
export class AccountCode {
  public readonly value: string;
  private constructor(value: string) {
    this.value = value;
  }
  /** Validate and normalize a user-facing account code. */
  public static create(value: string): AccountCode {
    const normalized = value.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(normalized))
      throw new DomainError("Account code is invalid.");
    return new AccountCode(normalized);
  }
}
