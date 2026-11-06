// Tidings (docs/architecture §14, §31): news of what the observer follows — a land,
// a village, a realm, a person met — told as it happens, each opening its why.
// Following is observation, not an act: it is kept in the observer ledger, which
// history never reads, so following a land never changes what befalls it.
import type { HostClient } from "../bridge/index.ts";
import { WhyTree, el } from "./why.ts";

export type Tiding = {
  watch: string;
  label: string;
  ref: string;
  year: number;
  claim: string;
  /** What kind of thing happened and how much it mattered: the great are told in windows. */
  type: string;
  importance: number;
  /** Told to everyone, whoever they follow (W6). */
  world?: boolean;
};
type Followed = { ref: string; label: string };

/** What may come both as the world's news and from what is followed: told once. */
const TOLD_ONCE: ReadonlySet<string> = new Set([
  "far.fell",
  "lanes.first",
  "war.strike",
  "nation.greatest",
  "nation.first-left",
  "nation.fell",
  "nation.first-dark",
]);

/** How long a card of news stays unless it is opened, in ms; and how many are shown at once. */
const LINGER_MS = 14000,
  SHOWN = 4,
  POLL_MS = 1500;

export class Tidings {
  readonly element = el("div", "tidings");
  private readonly client: HostClient;
  private readonly why: WhyTree;
  private followed = new Map<string, string>();
  private readonly toggles = new Set<{ b: HTMLButtonElement; say: () => void }>();
  private asking = false;
  /** How far the world's own news has been read (null: from now on). */
  private since: number | null = null;
  private readonly toldOnce = new Set<string>();
  /** Told what is followed, each time it changes (the outliner lists it). */
  onFollowed: (followed: readonly { ref: string; label: string }[]) => void = () => {};
  /** Told how much news has come (the message log counts it). */
  onTold: (n: number) => void = () => {};
  /**
   * Asked of each piece of news first (Phase 11 M100): true if it was told otherwise (a great
   * happening in its window) and wants no card.
   */
  onGreat: (t: Tiding) => boolean = () => false;
  /** A battle's news, to watch it fought on its field (Phase 37 M187); null: not offered. */
  onBattle: ((event: string) => void) | null = null;
  /** A war watched unfolding, by its peace's event (Phase 38 M193). */
  onWar: ((event: string) => void) | null = null;
  /** A landing watched, by its event (Phase 64). */
  onLanding: ((event: string) => void) | null = null;
  /** A fight among the stars watched, by its event (Phase 67). */
  onStarFight: ((event: string) => void) | null = null;
  /** A strike from the air played again in its town (W2). */
  onRaid: ((event: string) => void) | null = null;
  /** A world filled seen (Worlds filled): by the event that told of it. */
  onFilled: ((ref: string) => void) | null = null;
  /** The first jump watched (Phase 68). */
  onJump: (() => void) | null = null;
  /** What fell on a world of another star (W6): its film. */
  onFar: ((event: string) => void) | null = null;
  /** Great news of a realm among the stars seen (Phase 72), by its event. */
  onNation: ((event: string) => void) | null = null;

  constructor(root: HTMLElement, client: HostClient) {
    this.client = client;
    this.why = new WhyTree(client);
    this.element.setAttribute("aria-live", "polite");
    root.append(this.element);
    void this.refresh();
    setInterval(() => void this.poll(), POLL_MS);
  }

  /** Learn afresh what is followed (after a world is loaded or begun). */
  async refresh(): Promise<void> {
    this.set(await this.client.query<Followed[]>({ type: "observe.watches" }));
  }

  /** A world taken up again in place: its past is not news. */
  fromNow(): void {
    this.since = null;
  }

  /** Stop following a thing (from the outliner). */
  async unfollow(ref: string): Promise<void> {
    this.set(
      await this.client.query<Followed[]>({ type: "observe.watch", args: { ref, on: false } }),
    );
  }

  /** A button that follows `ref`, or stops following it: "Follow this land". */
  follow(ref: string, what: string): HTMLButtonElement {
    const b = el("button", "follow"),
      say = () => {
        const on = this.followed.has(ref);
        b.textContent = on ? `Following ${what} ✓` : `Follow ${what}`;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", String(on));
      };
    b.title = "Be told when something that matters happens. Following changes nothing.";
    b.onclick = async () => {
      b.disabled = true;
      try {
        this.set(
          await this.client.query<Followed[]>({
            type: "observe.watch",
            args: { ref, on: !this.followed.has(ref) },
          }),
        );
      } finally {
        b.disabled = false;
      }
    };
    this.toggles.add({ b, say });
    say();
    return b;
  }

  private set(list: Followed[]): void {
    this.followed = new Map(list.map((w) => [w.ref, w.label]));
    this.onFollowed(list);
    for (const t of this.toggles)
      if (t.b.isConnected) t.say();
      else this.toggles.delete(t);
  }

  /** Ask what has happened to what is followed since last told. */
  private async poll(): Promise<void> {
    if (this.asking) return;
    this.asking = true;
    try {
      const all = await this.client.query<{ now: number; told: Tiding[] }>({
          type: "observe.world",
          args: { since: this.since },
        }),
        followed = this.followed.size
          ? await this.client.query<Tiding[]>({ type: "observe.tidings" })
          : [],
        once = (t: Tiding) => {
          if (!TOLD_ONCE.has(t.type)) return true;
          if (this.toldOnce.has(t.ref)) return false;
          this.toldOnce.add(t.ref);
          return true;
        },
        told = [...all.told, ...followed].filter(once);
      // (The clock put back, a checkpoint taken up: read on from there.)
      this.since = all.now;
      for (const t of told) if (!this.onGreat(t)) this.add(t);
      if (told.length) this.onTold(told.length);
    } catch {
      // No world yet, or one being loaded: ask again next time.
    } finally {
      this.asking = false;
    }
  }

  private add(t: Tiding): void {
    const card = el("div", "tiding"),
      head = el("div", "tiding-head"),
      from = el("span", "tiding-from", `${t.label} · year ${t.year}`),
      close = el("button", "tiding-close", "×"),
      claim = el("button", "tiding-claim", t.claim),
      whyBox = el("div", "why");
    close.setAttribute("aria-label", "Dismiss");
    close.onclick = () => card.remove();
    let open = false;
    claim.onclick = () => {
      open = !open;
      card.classList.toggle("open", open);
      if (open) void this.why.show(t.ref, whyBox);
      else whyBox.replaceChildren();
    };
    // (A battle's news: watched fought, Phase 37 M187.)
    if (t.type === "war.battle" && this.onBattle) {
      const watch = el("button", "tiding-watch", "⚔️ Watch");
      watch.title = "Down to the field it was fought on, to watch it fought";
      watch.onclick = () => {
        card.remove();
        this.onBattle?.(t.ref);
      };
      head.append(from, watch, close);
    } else if (t.type === "war.peace" && this.onWar) {
      // (A war's end: watched unfolding again, from its declaring, Phase 38 M193.)
      const watch = el("button", "tiding-watch", "▶ Watch");
      watch.title =
        "The whole war played again on the globe: its host's march, its battles, its fallen";
      watch.onclick = () => {
        card.remove();
        this.onWar?.(t.ref);
      };
      head.append(from, watch, close);
    } else if ((t.type === "space.colony" || t.type === "space.arrival") && this.onLanding) {
      // (A landing: played again, from its crossing to the town it grew into, Phase 64.)
      const watch = el("button", "tiding-watch", "🚀 Watch");
      watch.title = "Its ship's crossing, its landing on that ground, and its halls growing";
      watch.onclick = () => {
        card.remove();
        this.onLanding?.(t.ref);
      };
      head.append(from, watch, close);
    } else if (t.type === "filled.world" && this.onFilled) {
      // (A world filled: out to it, lit across its face.)
      const see = el("button", "tiding-watch", "🌆 See it");
      see.title = "That world seen whole, its settled ground lit";
      see.onclick = () => {
        card.remove();
        this.onFilled?.(t.ref);
      };
      head.append(from, see, close);
    } else if (t.type.startsWith("nation.") && t.world && this.onNation) {
      const watch = el("button", "tiding-watch", "👑 See it");
      watch.title = "Who holds the stars, and that realm or world";
      watch.onclick = () => {
        card.remove();
        this.onNation?.(t.ref);
      };
      head.append(from, watch, close);
    } else if (t.type === "far.fell" && this.onFar) {
      const watch = el("button", "tiding-watch far-watch", "🌑 Watch");
      watch.title = "That world, whole, and what fell on it";
      watch.onclick = () => {
        card.remove();
        this.onFar?.(t.ref);
      };
      head.append(from, watch, close);
    } else if (t.type === "lanes.first" && this.onJump) {
      const watch = el("button", "tiding-watch", "🌀 Watch");
      watch.title = "The ship leaving for the lane, the jump, and where it came out";
      watch.onclick = () => {
        card.remove();
        this.onJump?.();
      };
      head.append(from, watch, close);
    } else if (t.type === "war.strike" && this.onRaid) {
      const watch = el("button", "tiding-watch", "▶ Watch");
      watch.title = "Down to the town it fell on, that day: what came, what it hit, its fires";
      watch.onclick = () => {
        card.remove();
        this.onRaid?.(t.ref);
      };
      head.append(from, watch, close);
    } else if ((t.type === "starwar.battle" || t.type === "peoples.raid") && this.onStarFight) {
      const watch = el("button", "tiding-watch", "🌌 Watch");
      watch.title = "The fleets over that world, and what the record carries to the ground";
      watch.onclick = () => {
        card.remove();
        this.onStarFight?.(t.ref);
      };
      head.append(from, watch, close);
    } else head.append(from, close);
    card.append(head, claim, whyBox);
    this.element.prepend(card);
    // (What a run came to stays at the head of them.)
    const note = this.element.querySelector(".ran-note");
    if (note) this.element.prepend(note);
    while (this.element.children.length > SHOWN) this.element.lastElementChild!.remove();
    setTimeout(() => {
      if (!open) card.remove();
    }, LINGER_MS);
  }
}
