import { DomainError } from "./DomainError.js";
/** Raised when a monetary input is malformed, out of range, or incompatible. */
export class InvalidMoneyError extends DomainError {
  public constructor(
    message = "Money must be positive, precise to four decimals, and within NUMERIC(19,4).",
  ) {
    super(message);
  }
}
