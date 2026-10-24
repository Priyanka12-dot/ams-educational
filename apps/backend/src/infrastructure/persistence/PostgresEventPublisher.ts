import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { IEventPublisher } from "../../application/ports/IEventPublisher.js";
import * as schema from "./schema.js";
/** Drizzle adapter for append-only domain event persistence. */
export class PostgresEventPublisher implements IEventPublisher {
  public constructor(private readonly db: NodePgDatabase<typeof schema>) {}
  /** Append one domain event to the durable event log. */
  public async publish(
    event: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    const e = event as {
      eventId: string;
      tenantId: string;
      aggregateId: string;
      eventType: string;
      payload: unknown;
      occurredAt: string;
    };
    await this.db.insert(schema.eventLog).values({
      eventId: e.eventId,
      tenantId: e.tenantId,
      aggregateId: e.aggregateId,
      eventType: e.eventType,
      payload: e.payload,
      occurredAt: new Date(e.occurredAt),
    });
  }
}
