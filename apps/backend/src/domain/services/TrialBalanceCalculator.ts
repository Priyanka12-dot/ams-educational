import type { AccountType } from "@ams/shared";
import type { Posting } from "../entities/Posting.js";
import { Money } from "../value-objects/Money.js";
export interface TrialBalanceAccount {
  readonly accountId: string;
  readonly code: string;
  readonly name: string;
  readonly type: AccountType;
}
export interface TrialBalanceRow extends TrialBalanceAccount {
  readonly debit: Money;
  readonly credit: Money;
  readonly net: Money;
}
/** Pure read-side calculator for account-normalized trial balance rows. */
export class TrialBalanceCalculator {
  /** Aggregate postings by account, split debit and credit columns, and calculate normal balances. */
  public calculate(
    accounts: readonly TrialBalanceAccount[],
    postings: readonly Posting[],
  ): readonly TrialBalanceRow[] {
    return accounts.map((account) => {
      const lines = postings.filter(
        (posting) => posting.accountId === account.accountId,
      );
      const currency =
        lines[0]?.amount.currency ?? postings[0]?.amount.currency ?? "USD";
      let debit = 0n;
      let credit = 0n;
      for (const line of lines)
        line.direction === "DEBIT"
          ? (debit += line.amount.minorUnits())
          : (credit += line.amount.minorUnits());
      const debitNormal =
        account.type === "ASSET" || account.type === "EXPENSE";
      return {
        ...account,
        debit: Money.fromMinorUnits(debit, currency),
        credit: Money.fromMinorUnits(credit, currency),
        net: Money.fromMinorUnits(
          debitNormal ? debit - credit : credit - debit,
          currency,
        ),
      };
    });
  }
}
