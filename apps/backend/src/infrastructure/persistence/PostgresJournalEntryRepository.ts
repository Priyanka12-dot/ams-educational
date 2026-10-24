import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { JournalEntry } from "../../domain/entities/JournalEntry.js";
import { Posting } from "../../domain/entities/Posting.js";
import { Money } from "../../domain/value-objects/Money.js";
import type { IJournalEntryRepository } from "../../domain/repositories/IJournalEntryRepository.js";
import * as schema from "./schema.js";
/** Drizzle adapter that commits journal lines and their event in one transaction. */
export class PostgresJournalEntryRepository implements IJournalEntryRepository {
  public constructor(private readonly db: NodePgDatabase<typeof schema>) {}
  /** Save a draft and all of its positive lines in a transaction. */
  public async saveDraft(entry: JournalEntry): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(schema.journalEntries).values({
        id: entry.id,
        tenantId: entry.tenantId,
        entryDate: entry.entryDate,
        description: entry.description,
        status: "DRAFT",
        createdBy: entry.createdBy,
        reversalOf: entry.reversalOf,
      });
      if (entry.postings.length)
        await tx.insert(schema.postings).values(
          entry.postings.map((line) => ({
            tenantId: entry.tenantId,
            journalEntryId: entry.id,
            accountId: line.accountId,
            amount: line.amount.toDecimal(),
            direction: line.direction,
          })),
        );
    });
  }
  /** Atomically store a posted journal, its lines, and the append-only domain event. */
  public async post(
    entry: JournalEntry,
    event: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(schema.journalEntries).values({
        id: entry.id,
        tenantId: entry.tenantId,
        entryDate: entry.entryDate,
        description: entry.description,
        status: "DRAFT",
        createdBy: entry.createdBy,
        reversalOf: entry.reversalOf,
      });
      await tx.insert(schema.postings).values(
        entry.postings.map((line) => ({
          tenantId: entry.tenantId,
          journalEntryId: entry.id,
          accountId: line.accountId,
          amount: line.amount.toDecimal(),
          direction: line.direction,
        })),
      );
      await tx
        .update(schema.journalEntries)
        .set({ status: "POSTED", postedAt: new Date() })
        .where(
          and(
            eq(schema.journalEntries.tenantId, entry.tenantId),
            eq(schema.journalEntries.id, entry.id),
          ),
        );
      const e = event as {
        eventId: string;
        aggregateId: string;
        eventType: string;
        occurredAt: string;
        payload: unknown;
      };
      await tx.insert(schema.eventLog).values({
        eventId: e.eventId,
        tenantId: entry.tenantId,
        aggregateId: e.aggregateId,
        eventType: e.eventType,
        payload: e.payload,
        occurredAt: new Date(e.occurredAt),
      });
    });
  }
  /** Rehydrate one aggregate only from tenant-owned header and lines. */
  public async findById(
    tenantId: string,
    id: string,
  ): Promise<JournalEntry | null> {
    const [row] = await this.db
      .select()
      .from(schema.journalEntries)
      .where(
        and(
          eq(schema.journalEntries.tenantId, tenantId),
          eq(schema.journalEntries.id, id),
        ),
      )
      .limit(1);
    if (!row) return null;
    const lines = await this.db
      .select()
      .from(schema.postings)
      .where(
        and(
          eq(schema.postings.tenantId, tenantId),
          eq(schema.postings.journalEntryId, id),
        ),
      )
      .orderBy(schema.postings.id);
    return JournalEntry.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      entryDate: row.entryDate,
      description: row.description,
      createdBy: row.createdBy,
      status: row.status as "DRAFT" | "POSTED" | "REVERSED",
      reversalOf: row.reversalOf,
      postings: lines.map((line) =>
        Posting.create(
          line.accountId,
          Money.fromDecimal(line.amount),
          line.direction,
        ),
      ),
    });
  }
  /** List recent entry headers for the authenticated tenant. */
  public async listEntries(tenantId: string) {
    const rows = await this.db
      .select({
        id: schema.journalEntries.id,
        entryDate: schema.journalEntries.entryDate,
        description: schema.journalEntries.description,
        status: schema.journalEntries.status,
        createdAt: schema.journalEntries.createdAt,
      })
      .from(schema.journalEntries)
      .where(eq(schema.journalEntries.tenantId, tenantId))
      .orderBy(
        desc(schema.journalEntries.entryDate),
        desc(schema.journalEntries.createdAt),
      )
      .limit(100);
    return rows.map((row) => ({
      ...row,
      status: row.status as "DRAFT" | "POSTED" | "REVERSED",
      createdAt: row.createdAt.toISOString(),
    }));
  }
  /** Load one account's tenant-owned ledger lines with their parent journal metadata. */
  public async getLedger(tenantId: string, accountId: string) {
    const rows = await this.db
      .select({
        journalEntryId: schema.journalEntries.id,
        entryDate: schema.journalEntries.entryDate,
        description: schema.journalEntries.description,
        amount: schema.postings.amount,
        direction: schema.postings.direction,
      })
      .from(schema.postings)
      .innerJoin(
        schema.journalEntries,
        and(
          eq(schema.journalEntries.tenantId, schema.postings.tenantId),
          eq(schema.journalEntries.id, schema.postings.journalEntryId),
        ),
      )
      .where(
        and(
          eq(schema.postings.tenantId, tenantId),
          eq(schema.postings.accountId, accountId),
          inArray(schema.journalEntries.status, ["POSTED", "REVERSED"]),
        ),
      )
      .orderBy(
        schema.journalEntries.entryDate,
        schema.journalEntries.createdAt,
      );
    return rows.map((row) => ({ ...row, amount: row.amount.toString() }));
  } /** Load posted lines for a tenant and optional inclusive date bounds. */
  public async listPostings(
    tenantId: string,
    from?: string,
    through?: string,
  ): Promise<readonly Posting[]> {
    const filters = [
      eq(schema.postings.tenantId, tenantId),
      inArray(schema.journalEntries.status, ["POSTED", "REVERSED"]),
      ...(from ? [gte(schema.journalEntries.entryDate, from)] : []),
      ...(through ? [lte(schema.journalEntries.entryDate, through)] : []),
    ];
    const rows = await this.db
      .select({
        accountId: schema.postings.accountId,
        amount: schema.postings.amount,
        direction: schema.postings.direction,
      })
      .from(schema.postings)
      .innerJoin(
        schema.journalEntries,
        and(
          eq(schema.journalEntries.tenantId, schema.postings.tenantId),
          eq(schema.journalEntries.id, schema.postings.journalEntryId),
        ),
      )
      .where(and(...filters));
    return rows.map((row) =>
      Posting.create(
        row.accountId,
        Money.fromDecimal(row.amount),
        row.direction,
      ),
    );
  }
}
