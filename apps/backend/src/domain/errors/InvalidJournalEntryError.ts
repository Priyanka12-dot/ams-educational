import { DomainError } from "./DomainError.js";
/** Raised when a journal entry violates its lifecycle or structural rules. */
export class InvalidJournalEntryError extends DomainError {
  public constructor(message: string) {
    super(message);
  }
}
