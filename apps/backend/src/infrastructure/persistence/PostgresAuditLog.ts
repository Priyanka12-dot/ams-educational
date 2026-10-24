import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { IAuditLog } from "../../application/ports/IAuditLog.js";
import * as schema from "./schema.js";
/** Drizzle adapter that appends sensitive-action records. */
export class PostgresAuditLog implements IAuditLog {
  public constructor(private readonly db: NodePgDatabase<typeof schema>) {}
  /** Insert an audit record with tenant identity supplied by the authenticated use case. */
  public async write(input: Parameters<IAuditLog["write"]>[0]): Promise<void> {
    await this.db.insert(schema.auditLog).values({
      tenantId: input.tenantId,
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata,
    });
  }
}
