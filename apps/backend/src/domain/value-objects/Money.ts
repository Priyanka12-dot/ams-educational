import { InvalidMoneyError } from "../errors/InvalidMoneyError.js";
const SCALE = 10_000n;
const MAX_MINOR = 9_999_999_999_999_999_999n;

/** Immutable decimal money stored as scaled bigint; JavaScript floats never enter accounting arithmetic. */
export class Money {
  private constructor(
    private readonly scaled: bigint,
    public readonly currency: string,
  ) {}
  /** Parse a decimal string without rounding and validate the NUMERIC(19,4) bound. */
  public static fromDecimal(value: string, currency = "USD"): Money {
    if (!/^(0|[1-9]\d{0,14})(\.\d{1,4})?$/.test(value))
      throw new InvalidMoneyError();
    if (!/^[A-Z]{3}$/.test(currency))
      throw new InvalidMoneyError("Currency must be a three-letter ISO code.");
    const [whole = "0", fraction = ""] = value.split(".");
    const scaled = BigInt(whole) * SCALE + BigInt(fraction.padEnd(4, "0"));
    if (scaled <= 0n || scaled > MAX_MINOR) throw new InvalidMoneyError();
    return new Money(scaled, currency);
  }
  /** Construct an internal signed balance result, including zero or negative balances. */
  public static fromMinorUnits(scaled: bigint, currency = "USD"): Money {
    if (
      !/^[A-Z]{3}$/.test(currency) ||
      scaled > MAX_MINOR ||
      scaled < -MAX_MINOR
    )
      throw new InvalidMoneyError();
    return new Money(scaled, currency);
  }
  /** Add money only when currencies match. */
  public add(other: Money): Money {
    this.assertCurrency(other);
    return Money.fromMinorUnits(this.scaled + other.scaled, this.currency);
  }
  /** Subtract money only when currencies match. */
  public subtract(other: Money): Money {
    this.assertCurrency(other);
    return Money.fromMinorUnits(this.scaled - other.scaled, this.currency);
  }
  /** Return an exact signed integer representation at the four-decimal scale. */
  public minorUnits(): bigint {
    return this.scaled;
  }
  /** Return a canonical fixed-four-decimal representation for database and API use. */
  public toDecimal(): string {
    const negative = this.scaled < 0n;
    const absolute = negative ? -this.scaled : this.scaled;
    return `${negative ? "-" : ""}${absolute / SCALE}.${(absolute % SCALE).toString().padStart(4, "0")}`;
  }
  /** Compare monetary amounts after checking that both currencies are equal. */
  public equals(other: Money): boolean {
    this.assertCurrency(other);
    return this.scaled === other.scaled;
  }
  private assertCurrency(other: Money): void {
    if (this.currency !== other.currency)
      throw new InvalidMoneyError("Cannot combine different currencies.");
  }
}
