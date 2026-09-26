// Tidings (docs/architecture §14, §31): news of what the observer follows — a land,
// a village, a realm, a person met — told as it happens, each opening its why.
// Following is observation, not an act: it is kept in the observer ledger, which
// history never reads, so following a land never changes what befalls it.
import type { HostClient } from "../bridge/index.ts";
import { WhyTree, el } from "./why.ts";

export type Tiding = { watch: string; label: string; ref: string; year: number; claim: string };
type Followed = { ref: string; label: string };

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
    for (const t of this.toggles)
      if (t.b.isConnected) t.say();
      else this.toggles.delete(t);
  }

  /** Ask what has happened to what is followed since last told. */
  private async poll(): Promise<void> {
    if (!this.followed.size || this.asking) return;
    this.asking = true;
    try {
      for (const t of await this.client.query<Tiding[]>({ type: "observe.tidings" })) this.add(t);
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
    head.append(from, close);
    card.append(head, claim, whyBox);
    this.element.prepend(card);
    while (this.element.children.length > SHOWN) this.element.lastElementChild!.remove();
    setTimeout(() => {
      if (!open) card.remove();
    }, LINGER_MS);
  }
}
