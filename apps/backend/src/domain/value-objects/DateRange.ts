import { DomainError } from "../errors/DomainError.js";
/** Inclusive date range used by ledger and reporting queries. */
export class DateRange {
  private constructor(
    public readonly from: string,
    public readonly through: string,
  ) {}
  /** Create a valid ISO calendar date range where from is no later than through. */
  public static create(from: string, through: string): DateRange {
    const valid = (date: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
    if (!valid(from) || !valid(through) || from > through)
      throw new DomainError("Date range is invalid.");
    return new DateRange(from, through);
  }
}
