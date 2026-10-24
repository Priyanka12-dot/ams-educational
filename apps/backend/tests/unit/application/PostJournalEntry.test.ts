import { describe, it, expect, vi } from "vitest";
import { PostJournalEntry } from "../../../src/application/use-cases/PostJournalEntry.js";
import { Account } from "../../../src/domain/entities/Account.js";
import type { IAccountRepository } from "../../../src/domain/repositories/IAccountRepository.js";
import type { IJournalEntryRepository } from "../../../src/domain/repositories/IJournalEntryRepository.js";
import type { IAuditLog } from "../../../src/application/ports/IAuditLog.js";
const activeAccount = (id: string) =>
  Account.create({
    id,
    tenantId: "tenant-a",
    code: id,
    name: id,
    type: "ASSET",
  });
const input = {
  entryDate: "2026-01-01",
  description: "Opening",
  postings: [
    { accountId: "cash", amount: "10.00", direction: "DEBIT" as const },
    { accountId: "equity", amount: "10.00", direction: "CREDIT" as const },
  ],
};
describe("PostJournalEntry use case", () => {
  it("blocks cross-tenant account identifiers before persistence", async () => {
    const save = vi.fn();
    const accounts: IAccountRepository = {
      findById: async (tenant, id) =>
        tenant === "tenant-a" && id === "cash" ? activeAccount(id) : null,
      list: async () => [],
      save,
    };
    const journals = {
      saveDraft: async () => {},
      post: vi.fn(),
      findById: async () => null,
      listPostings: async () => [],
      listEntries: async () => [],
      getLedger: async () => [],
    } satisfies IJournalEntryRepository;
    const audit: IAuditLog = { write: async () => {} };
    const useCase = new PostJournalEntry(journals, accounts, audit);
    await expect(
      useCase.execute(input, {
        id: "user-a",
        tenantId: "tenant-a",
        role: "ACCOUNTANT",
      }),
    ).rejects.toThrow("Account unavailable");
    expect(journals.post).not.toHaveBeenCalled();
  });
  it("posts a balanced entry and records audit data", async () => {
    const accounts: IAccountRepository = {
      findById: async (_tenant, id) => activeAccount(id),
      list: async () => [],
      save: async () => {},
    };
    const post = vi.fn();
    const journals = {
      saveDraft: async () => {},
      post,
      findById: async () => null,
      listPostings: async () => [],
      listEntries: async () => [],
      getLedger: async () => [],
    } satisfies IJournalEntryRepository;
    const audit: IAuditLog = { write: vi.fn(async () => {}) };
    const useCase = new PostJournalEntry(journals, accounts, audit);
    const result = await useCase.execute(input, {
      id: "user-a",
      tenantId: "tenant-a",
      role: "ACCOUNTANT",
    });
    expect(result.status).toBe("POSTED");
    expect(post).toHaveBeenCalledOnce();
    expect(audit.write).toHaveBeenCalledOnce();
  });
  it("rejects non-writer roles", async () => {
    const noop: IAccountRepository = {
      findById: async () => null,
      list: async () => [],
      save: async () => {},
    };
    const journal = {
      saveDraft: async () => {},
      post: async () => {},
      findById: async () => null,
      listPostings: async () => [],
      listEntries: async () => [],
      getLedger: async () => [],
    } satisfies IJournalEntryRepository;
    await expect(
      new PostJournalEntry(journal, noop, { write: async () => {} }).execute(
        input,
        { id: "viewer", tenantId: "tenant-a", role: "VIEWER" },
      ),
    ).rejects.toThrow("not permitted");
  });
});
