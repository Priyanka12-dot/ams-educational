import { DomainError } from "./DomainError.js";
/** Raised when the debit and credit totals of a journal do not agree. */
export class UnbalancedEntryError extends DomainError {
  public constructor() {
    super("Journal entry debits must equal credits.");
  }
}
