// The page's handle on the simulation host: requests with promised replies,
// subscriptions, the latest frame of each view, and status.
import type { FrameMessage, Interest, Port, Query, Status, ToHost, ToMain } from "./protocol.ts";

export type CommandReceipt = { readonly id: string; readonly t: number };

export class HostClient {
  private readonly port: Port<ToMain, ToHost>;
  private nextId = 1;
  private readonly waiting = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private readonly subscribers = new Map<number, (value: unknown, t: number) => void>();
  private readonly frameListeners = new Set<(frame: FrameMessage) => void>();
  private readonly statusListeners = new Set<(status: Status) => void>();
  private readonly noticeListeners = new Set<(text: string, ref: string | null) => void>();
  private readonly frames = new Map<string, FrameMessage>();
  status: Status | null = null;

  constructor(port: Port<ToMain, ToHost>) {
    this.port = port;
    port.onMessage((m) => this.receive(m));
  }

  private receive(m: ToMain): void {
    switch (m.kind) {
      case "reply": {
        const w = this.waiting.get(m.id);
        if (!w) return;
        this.waiting.delete(m.id);
        if (m.ok) w.resolve(m.value);
        else w.reject(new Error(m.error));
        return;
      }
      case "update":
        this.subscribers.get(m.id)?.(m.value, m.t);
        return;
      case "frame":
        this.frames.set(m.view, m);
        for (const l of this.frameListeners) l(m);
        return;
      case "status":
        this.status = m;
        for (const l of this.statusListeners) l(m);
        return;
      case "notice":
        for (const l of this.noticeListeners) l(m.text, m.ref);
        return;
    }
  }

  private request<T>(make: (id: number) => ToHost, transfer?: Transferable[]): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.waiting.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.port.post(make(id), transfer);
    });
  }

  start(universe: string, seed: string): Promise<{ ruleset: string }> {
    return this.request((id) => ({ kind: "start", id, universe, seed }));
  }
  command(type: string, args: unknown): Promise<CommandReceipt> {
    return this.request((id) => ({ kind: "command", id, type, args }));
  }
  query<T>(query: Query): Promise<T> {
    return this.request((id) => ({ kind: "query", id, query }));
  }
  advance(to: number): Promise<{ t: number }> {
    return this.request((id) => ({ kind: "advance", id, to }));
  }
  save(name: string): Promise<{ bytes: number }> {
    return this.request((id) => ({ kind: "save", id, name }));
  }
  load(name: string): Promise<{ t: number; fellBack: boolean }> {
    return this.request((id) => ({ kind: "load", id, name }));
  }
  exportSave(): Promise<Uint8Array> {
    return this.request((id) => ({ kind: "export", id }));
  }
  importSave(bytes: Uint8Array): Promise<{ t: number }> {
    const copy = bytes.slice();
    return this.request((id) => ({ kind: "import", id, bytes: copy }), [copy.buffer]);
  }

  /** Receive a query's value now and every `everyMs` while it changes; returns the unsubscriber. */
  subscribe<T>(query: Query, everyMs: number, listener: (value: T, t: number) => void): () => void {
    const id = this.nextId++;
    this.subscribers.set(id, listener as (v: unknown, t: number) => void);
    this.port.post({ kind: "subscribe", id, query, everyMs });
    return () => {
      this.subscribers.delete(id);
      this.port.post({ kind: "unsubscribe", id });
    };
  }

  setInterest(interest: Interest): void {
    this.port.post({ kind: "interest", interest });
  }
  setSpeed(secondsPerSecond: number): void {
    this.port.post({ kind: "speed", secondsPerSecond });
  }

  latestFrame(view: string): FrameMessage | undefined {
    return this.frames.get(view);
  }
  onFrame(listener: (frame: FrameMessage) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }
  onStatus(listener: (status: Status) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }
  onNotice(listener: (text: string, ref: string | null) => void): () => void {
    this.noticeListeners.add(listener);
    return () => this.noticeListeners.delete(listener);
  }
  close(): void {
    this.port.close();
  }
}
