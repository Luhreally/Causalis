// What has been looked at, in order (asked 2026-11-19): each page with how it stood when it was left — its tab, how far
// down it was read, what was opened on it — so that back and forward bring a page as it was, not at its first tab's top.
// What "how it stood" holds is the page window's own (ui/inspector.ts); this keeps one for each page looked at.

/** A page looked at: its ref as it was asked for, and how it stood when last left (null: never left, or not to be kept). */
export interface Visit<V> {
  readonly ref: string;
  view: V | null;
}

export class PageHistory<V> {
  private visits: Visit<V>[] = [];
  private at = -1;
  private readonly most: number;

  /** `most`: how many pages back it reaches. */
  constructor(most = 64) {
    this.most = Math.max(1, most);
  }

  /** The page open now (or last open), if any has been. */
  get current(): Visit<V> | null {
    return this.visits[this.at] ?? null;
  }

  get canBack(): boolean {
    return this.at > 0;
  }

  get canForward(): boolean {
    return this.at < this.visits.length - 1;
  }

  /** How many pages it holds, and which is open (for the page's own tests). */
  get length(): number {
    return this.visits.length;
  }
  get index(): number {
    return this.at;
  }

  /** How the open page stands, kept as it is left (null leaves what was kept). */
  keep(view: V | null): void {
    const here = this.visits[this.at];
    if (here && view) here.view = view;
  }

  /**
   * A page opened after the open one, which is left as `leaving`: what was ahead is dropped. The same page asked again
   * is the same visit (`again`), with what was kept of it.
   */
  open(
    ref: string,
    leaving: V | null = null,
  ): { readonly visit: Visit<V>; readonly again: boolean } {
    this.keep(leaving);
    const here = this.visits[this.at];
    if (here && here.ref === ref) return { visit: here, again: true };
    this.visits = this.visits.slice(0, this.at + 1);
    const visit: Visit<V> = { ref, view: null };
    this.visits.push(visit);
    if (this.visits.length > this.most) this.visits.shift();
    this.at = this.visits.length - 1;
    return { visit, again: false };
  }

  /** Back (-1) or forward (+1), the open page left as `leaving`: the page come to, or null at either end. */
  step(way: -1 | 1, leaving: V | null = null): Visit<V> | null {
    const next = this.at + way;
    if (next < 0 || next >= this.visits.length) return null;
    this.keep(leaving);
    this.at = next;
    return this.visits[next]!;
  }
}
