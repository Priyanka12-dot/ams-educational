import { Account } from "../../domain/entities/Account.js";
import { ForbiddenError } from "../../domain/errors/ForbiddenError.js";
import type { IAccountRepository } from "../../domain/repositories/IAccountRepository.js";
import type { IAuditLog } from "../ports/IAuditLog.js";
import type { IEventPublisher } from "../ports/IEventPublisher.js";
import type { CreateAccountInput } from "@ams/shared";
export class CreateAccount {
  public constructor(
    private readonly accounts: IAccountRepository,
    private readonly audit: IAuditLog,
    private readonly events: IEventPublisher,
  ) {}
  /** Create a tenant-owned account and append its audit and domain events. */
  public async execute(
    input: CreateAccountInput,
    principal: { id: string; tenantId: string; role: string },
  ): Promise<Account> {
    if (!["ADMIN", "ACCOUNTANT"].includes(principal.role))
      throw new ForbiddenError();
    const account = Account.create({
      ...input,
      parentId: input.parentId ?? null,
      id: crypto.randomUUID(),
      tenantId: principal.tenantId,
    });
    await this.accounts.save(account);
    const occurredAt = new Date().toISOString();
    await this.audit.write({
      tenantId: principal.tenantId,
      userId: principal.id,
      action: "ACCOUNT_CREATED",
      entity: "account",
      entityId: account.id,
      metadata: { code: account.code.value, type: account.type },
    });
    await this.events.publish({
      eventId: crypto.randomUUID(),
      tenantId: principal.tenantId,
      aggregateId: account.id,
      eventType: "AccountCreated",
      occurredAt,
      payload: {
        code: account.code.value,
        name: account.name,
        accountType: account.type,
      },
    });
    return account;
  }
}
