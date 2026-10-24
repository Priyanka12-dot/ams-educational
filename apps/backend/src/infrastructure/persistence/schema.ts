import {
  pgTable,
  pgEnum,
  uuid,
  bigint,
  integer,
  varchar,
  text,
  boolean,
  date,
  timestamp,
  numeric,
  jsonb,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
export const accountType = pgEnum("account_type", [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
]);
export const direction = pgEnum("posting_direction", ["DEBIT", "CREDIT"]);
export const role = pgEnum("user_role", [
  "ADMIN",
  "ACCOUNTANT",
  "AUDITOR",
  "VIEWER",
]);
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: role("role").notNull().default("ADMIN"),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_tenant_email").on(t.tenantId, t.email)],
);
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    type: accountType("type").notNull(),
    parentId: uuid("parent_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("accounts_tenant_code").on(t.tenantId, t.code),
    index("accounts_tenant_idx").on(t.tenantId),
  ],
);
export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    entryDate: date("entry_date").notNull(),
    description: text("description").notNull(),
    status: varchar("status", { length: 12 }).notNull().default("DRAFT"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    reversalOf: uuid("reversal_of"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "journal_status_check",
      sql`${t.status} in ('DRAFT','POSTED','REVERSED')`,
    ),
    index("journal_tenant_date_idx").on(t.tenantId, t.entryDate),
  ],
);
export const postings = pgTable(
  "postings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    journalEntryId: uuid("journal_entry_id").notNull(),
    accountId: uuid("account_id").notNull(),
    amount: numeric("amount", { precision: 19, scale: 4 }).notNull(),
    direction: direction("direction").notNull(),
  },
  (t) => [
    check("posting_positive_amount", sql`${t.amount} > 0`),
    index("postings_entry_idx").on(t.tenantId, t.journalEntryId),
    index("postings_account_idx").on(t.tenantId, t.accountId),
  ],
);
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: uuid("user_id"),
    action: varchar("action", { length: 80 }).notNull(),
    entity: varchar("entity", { length: 80 }).notNull(),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("audit_tenant_time_idx").on(t.tenantId, t.createdAt)],
);
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  replacedBy: uuid("replaced_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const eventLog = pgTable(
  "event_log",
  {
    sequence: bigint("sequence", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    eventId: uuid("event_id").notNull().unique(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    aggregateId: uuid("aggregate_id").notNull(),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    payload: jsonb("payload").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("event_tenant_sequence_idx").on(t.tenantId, t.sequence)],
);
