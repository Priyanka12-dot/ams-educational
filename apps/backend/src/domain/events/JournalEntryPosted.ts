import type { DomainEvent } from "./DomainEvent.js";
/** Event emitted only after a journal has passed validation and committed. */
export interface JournalEntryPosted extends DomainEvent {
  readonly eventType: "JournalEntryPosted";
  readonly payload: Readonly<{
    entryDate: string;
    description: string;
    postingCount: number;
  }>;
}
