import type { DomainEvent } from "./DomainEvent.js";
/** Event emitted when a tenant-owned chart account is created. */
export interface AccountCreated extends DomainEvent {
  readonly eventType: "AccountCreated";
  readonly payload: Readonly<{
    code: string;
    name: string;
    accountType: string;
  }>;
}
