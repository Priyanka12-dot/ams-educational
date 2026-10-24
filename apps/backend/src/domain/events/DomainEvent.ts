/** Immutable event envelope recorded to the append-only outbox/event log. */
export interface DomainEvent {
  readonly eventId: string;
  readonly tenantId: string;
  readonly occurredAt: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly payload: Readonly<Record<string, string | number | boolean | null>>;
}
