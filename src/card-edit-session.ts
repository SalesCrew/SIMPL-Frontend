import type { Action } from "./domain";

export type EditEvent = {
  field: string;
  before: unknown;
  after: unknown;
  at: string;
};
export type EditReceipt = {
  id: string;
  card_id: string;
  title: string;
  opened_at: string;
  closed_at?: string;
  expires_at?: string;
  events: EditEvent[];
};
export type EditOperation =
  | "begin"
  | "mutate"
  | "touch"
  | "close"
  | "offer"
  | "hold"
  | "discard"
  | "undo";
export type EditTransport = (
  id: string,
  operation: EditOperation,
  cardId: string,
  action?: Action,
) => Promise<EditReceipt>;

// A dialog is only a view of this controller. Saves and uploads survive its unmount.
export class CardEditSession {
  readonly id = crypto.randomUUID();
  private started: Promise<EditReceipt>;
  private queue: Promise<unknown> = Promise.resolve();
  private uploads = new Set<Promise<unknown>>();
  private closed: Promise<void> | undefined;
  private heartbeat: ReturnType<typeof setInterval>;

  constructor(
    readonly cardId: string,
    private transport: EditTransport,
    private onClosed: (receipt: EditReceipt) => void,
    readonly report: (message: string) => void,
  ) {
    this.started = transport(this.id, "begin", cardId);
    // Opening never produces an unhandled rejection; attempts to edit still fail safely.
    void this.started.catch((error) => report(errorMessage(error)));
    this.heartbeat = setInterval(() => {
      void this.started
        .then(() => transport(this.id, "touch", cardId))
        .catch(() => {});
    }, 30000);
  }

  mutate = (action: Action): Promise<boolean> => {
    const operation = this.queue
      .then(async () => {
        await this.started;
        await this.transport(this.id, "mutate", this.cardId, action);
        return true;
      })
      .catch((error) => {
        this.report(errorMessage(error));
        return false;
      });
    this.queue = operation;
    return operation;
  };

  upload = <T>(work: (sessionId: string) => Promise<T>): Promise<T> => {
    if (this.closed)
      return Promise.reject(new Error("Diese Kartenansicht ist geschlossen."));
    const operation = this.started.then(() => work(this.id));
    this.uploads.add(operation);
    void operation
      .finally(() => this.uploads.delete(operation))
      .catch(() => {});
    return operation;
  };

  close = (): void => {
    if (this.closed) return;
    this.closed = (async () => {
      try {
        await this.started;
        // Upload completion can enqueue a final metadata refresh, hence this order.
        await Promise.allSettled([...this.uploads]);
        await this.queue;
        const receipt = await this.transport(this.id, "close", this.cardId);
        if (receipt.events.length) this.onClosed(receipt);
      } catch (error) {
        this.report(errorMessage(error));
      } finally {
        clearInterval(this.heartbeat);
      }
    })();
  };
}

export function errorMessage(error: unknown) {
  return (
    (error as { message?: string })?.message ||
    "Die Änderung konnte nicht gespeichert werden."
  );
}
