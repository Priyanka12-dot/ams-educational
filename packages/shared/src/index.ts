import { z } from "zod";

/** Shared strict wire schema: tenant identity always comes from the session. */
export const accountTypeSchema = z.enum([
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
]);
export const directionSchema = z.enum(["DEBIT", "CREDIT"]);
export const createAccountSchema = z
  .object({
    code: z.string().trim().min(1).max(20),
    name: z.string().trim().min(1).max(255),
    type: accountTypeSchema,
    parentId: z.string().uuid().nullable().optional(),
  })
  .strict();
export const postingInputSchema = z
  .object({
    accountId: z.string().uuid(),
    amount: z.string().regex(/^(?=.*[1-9])\d{1,15}(\.\d{1,4})?$/),
    direction: directionSchema,
  })
  .strict();
export const createJournalEntrySchema = z
  .object({
    entryDate: z.string().date(),
    description: z.string().trim().min(1).max(2000),
    postings: z.array(postingInputSchema).min(2).max(500),
  })
  .strict();
export const registerSchema = z
  .object({
    email: z.string().email().max(320),
    password: z.string().min(12).max(128),
    tenantName: z.string().trim().min(2).max(120),
  })
  .strict();

export type AccountType = z.infer<typeof accountTypeSchema>;
export type Direction = z.infer<typeof directionSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;

