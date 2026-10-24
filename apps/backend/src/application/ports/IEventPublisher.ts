export interface IEventPublisher {
  publish(event: Readonly<Record<string, unknown>>): Promise<void>;
}
