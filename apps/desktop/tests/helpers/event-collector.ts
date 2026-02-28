import type { EngineEventBus, EngineEventMap } from '$lib/commentary/events';

interface CollectedEvent {
  event: string;
  data: unknown;
  timestamp: number;
}

const ALL_EVENTS: (keyof EngineEventMap)[] = [
  'engine:started', 'engine:stopped', 'engine:paused', 'engine:resumed',
  'state-change',
  'pipeline:start', 'pipeline:frame', 'pipeline:frame-error',
  'pipeline:llm-start', 'pipeline:llm-end', 'pipeline:llm-error',
  'pipeline:silence', 'pipeline:abort',
  'pipeline:tts-start', 'pipeline:tts-end', 'pipeline:tts-error',
  'pipeline:end',
  'context:start', 'context:end', 'context:error', 'context:skipped',
  'stt:start', 'stt:end',
  'chat-message', 'overlay-show', 'overlay-dismiss', 'system-message',
];

/**
 * Subscribes to all events on a bus and records them for assertion.
 */
export class EventCollector {
  private collected: CollectedEvent[] = [];
  private unsubs: (() => void)[] = [];
  private waiters: { event: string; resolve: (data: unknown) => void; timer: ReturnType<typeof setTimeout> }[] = [];

  constructor(bus: EngineEventBus) {
    for (const event of ALL_EVENTS) {
      const unsub = bus.on(event, (data) => {
        const entry: CollectedEvent = { event, data, timestamp: Date.now() };
        this.collected.push(entry);

        // Resolve any waiters for this event
        const idx = this.waiters.findIndex((w) => w.event === event);
        if (idx !== -1) {
          const waiter = this.waiters.splice(idx, 1)[0];
          clearTimeout(waiter.timer);
          waiter.resolve(data);
        }
      });
      this.unsubs.push(unsub);
    }
  }

  /** Get all collected events, optionally filtered by event type */
  getEvents(type?: string): CollectedEvent[] {
    if (!type) return [...this.collected];
    return this.collected.filter((e) => e.event === type);
  }

  /** Get just the event names in order */
  getEventNames(): string[] {
    return this.collected.map((e) => e.event);
  }

  /**
   * Wait for a specific event to be emitted.
   * @param count Wait for the Nth occurrence (1-based). Default: 1.
   */
  waitForEvent(type: string, timeoutMs = 5000, count = 1): Promise<unknown> {
    // Check if already collected enough
    const existing = this.collected.filter((e) => e.event === type);
    if (existing.length >= count) return Promise.resolve(existing[count - 1].data);

    let needed = count - existing.length;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remove all our waiters on timeout
        this.waiters = this.waiters.filter((w) => w.timer !== timer);
        reject(new Error(`Timed out waiting for event "${type}" (occurrence ${count}) after ${timeoutMs}ms`));
      }, timeoutMs);

      const handler = (data: unknown) => {
        needed--;
        if (needed <= 0) {
          clearTimeout(timer);
          resolve(data);
        } else {
          // Re-register for the next occurrence
          this.waiters.push({ event: type, resolve: handler, timer });
        }
      };

      this.waiters.push({ event: type, resolve: handler, timer });
    });
  }

  clear(): void {
    this.collected = [];
  }

  destroy(): void {
    this.unsubs.forEach((fn) => fn());
    this.unsubs = [];
    this.waiters.forEach((w) => clearTimeout(w.timer));
    this.waiters = [];
  }
}
