import type { AccountType } from "@ams/shared";
import { AccountCode } from "../value-objects/AccountCode.js";
import { DomainError } from "../errors/DomainError.js";
/** Ledger account aggregate root. Tenant identity is explicit and immutable. */
export class Account {
  private constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly code: AccountCode,
    public readonly name: string,
    public readonly type: AccountType,
    public readonly parentId: string | null,
    public readonly active: boolean,
  ) {}
  /** Build a validated account; tenant ownership comes from the authenticated application context. */
  public static create(input: {
    id: string;
    tenantId: string;
    code: string;
    name: string;
    type: AccountType;
    parentId?: string | null;
  }): Account {
    if (
      !input.id ||
      !input.tenantId ||
      input.name.trim().length === 0 ||
      input.name.length > 255
    )
      throw new DomainError("Account data is invalid.");
    if (input.parentId === input.id)
      throw new DomainError("An account cannot be its own parent.");
    return new Account(
      input.id,
      input.tenantId,
      AccountCode.create(input.code),
      input.name.trim(),
      input.type,
      input.parentId ?? null,
      true,
    );
  }
  /** Return an inactive account while preserving its historical ledger lines. */
  public deactivate(): Account {
    return new Account(
      this.id,
      this.tenantId,
      this.code,
      this.name,
      this.type,
      this.parentId,
      false,
    );
  }
}
