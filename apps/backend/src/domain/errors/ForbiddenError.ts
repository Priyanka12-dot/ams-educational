import { DomainError } from "./DomainError.js";
/** Raised when a principal lacks permission for a business action. */
export class ForbiddenError extends DomainError {
  public constructor() {
    super("This action is not permitted.");
  }
}
