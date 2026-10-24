import type { DomainEvent } from "./DomainEvent.js";
/** Event emitted when a tenant's first administrator registers. */
export interface UserRegistered extends DomainEvent {
  readonly eventType: "UserRegistered";
  readonly payload: Readonly<{ role: "ADMIN" }>;
}
