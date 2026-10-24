import type { Account } from "../entities/Account.js";
/** Tenant-scoped persistence port for chart-of-accounts commands and queries. */
export interface IAccountRepository {
  findById(tenantId: string, id: string): Promise<Account | null>;
  list(tenantId: string): Promise<readonly Account[]>;
  save(account: Account): Promise<void>;
}
