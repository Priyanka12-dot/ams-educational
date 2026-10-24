import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { AccountType } from "@ams/shared";
import { Account } from "../../domain/entities/Account.js";
import type { IAccountRepository } from "../../domain/repositories/IAccountRepository.js";
import * as schema from "./schema.js";
/** Drizzle adapter for tenant-scoped account storage. */
export class PostgresAccountRepository implements IAccountRepository {
  public constructor(private readonly db: NodePgDatabase<typeof schema>) {}
  /** Find an account only within the supplied tenant. */
  public async findById(tenantId: string, id: string): Promise<Account | null> {
    const [row] = await this.db
      .select()
      .from(schema.accounts)
      .where(
        and(eq(schema.accounts.tenantId, tenantId), eq(schema.accounts.id, id)),
      )
      .limit(1);
    if (!row) return null;
    const a = Account.create({
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      name: row.name,
      type: row.type as AccountType,
      parentId: row.parentId,
    });
    return row.isActive ? a : a.deactivate();
  }
  /** List active and inactive accounts for one tenant for historical reporting. */
  public async list(tenantId: string): Promise<readonly Account[]> {
    const rows = await this.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.tenantId, tenantId))
      .orderBy(schema.accounts.code);
    return rows.map((row) => {
      const a = Account.create({
        id: row.id,
        tenantId: row.tenantId,
        code: row.code,
        name: row.name,
        type: row.type as AccountType,
        parentId: row.parentId,
      });
      return row.isActive ? a : a.deactivate();
    });
  }
  /** Persist a new account; unique tenant/code constraints reject duplicates. */
  public async save(account: Account): Promise<void> {
    await this.db.insert(schema.accounts).values({
      id: account.id,
      tenantId: account.tenantId,
      code: account.code.value,
      name: account.name,
      type: account.type,
      parentId: account.parentId,
      isActive: account.active,
    });
  }
}
