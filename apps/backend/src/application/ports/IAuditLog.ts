export interface IAuditLog {
  write(input: {
    tenantId: string;
    userId: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    metadata: Readonly<Record<string, unknown>>;
  }): Promise<void>;
}
