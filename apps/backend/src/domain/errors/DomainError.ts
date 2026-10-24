/** Base class for expected business-rule violations. */
export class DomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
