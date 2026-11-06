// A town asked, on the phone (H1): a sheet over the town, what it could put first and what it could raise, each a finger's size. Two taps from the town's bar to
// the answer, which is its own page. What it can't be asked says why. Nothing here decides.
import type { AskOffer, HostClient, TownOffers } from "../bridge/index.ts";
import { el } from "./why.ts";

export class AskSheet {
  readonly element = el("div", "panel page-panel ask-sheet");
  private readonly client: HostClient;
  private town: string | null = null;
  /** A ruler's word, where one is ruling this town's realm. */
  private by: { realm: string; ruler: string } | null = null;
  /** An ask made: its page, or the page of one of the old ones. */
  onPage: (ref: string) => void = () => {};
  /** After the asking: its town's plan is read again. */
  onAsked: (town: string) => void = () => {};

  constructor(root: HTMLElement, client: HostClient) {
    this.client = client;
    this.element.hidden = true;
    root.append(this.element);
  }

  get open(): boolean {
    return !this.element.hidden;
  }

  close(): void {
    this.element.hidden = true;
    this.town = null;
  }

  /** Open it on a town. */
  async show(town: string, by: { realm: string; ruler: string } | null = null): Promise<void> {
    this.town = town;
    this.by = by;
    const offers = await this.client.query<TownOffers | null>({
      type: "town.offers",
      args: { ref: town },
    });
    if (this.town !== town) return;
    this.fill(offers);
    this.element.hidden = false;
  }

  private row(o: AskOffer): HTMLElement {
    const b = el("button", "ask-row");
    b.dataset.ask = `${o.kind}:${o.what}`;
    b.append(
      el("span", "ask-icon", o.icon),
      el("strong", undefined, o.name),
      el("small", undefined, o.note),
    );
    b.onclick = () => void this.ask(o, b);
    return b;
  }

  private async ask(o: AskOffer, b: HTMLElement): Promise<void> {
    const town = this.town;
    if (!town) return;
    b.classList.add("asking");
    try {
      await this.client.command("town.ask", {
        village: town,
        kind: o.kind,
        what: o.what,
        ...(this.by ? { by: this.by } : {}),
      });
      const after = await this.client.query<TownOffers | null>({
        type: "town.offers",
        args: { ref: town },
      });
      this.close();
      this.onAsked(town);
      if (after?.asked[0]) this.onPage(after.asked[0].ref);
    } catch (error) {
      b.classList.remove("asking");
      const words = (error as Error).message.replace(/^town\.ask: /, "");
      this.element.prepend(el("p", "ask-no", `They can't: ${words}.`));
    }
  }

  private fill(o: TownOffers | null): void {
    const close = el("button", "close", "×");
    close.setAttribute("aria-label", "Close");
    close.onclick = () => this.close();
    const parts: HTMLElement[] = [close];
    if (!o) {
      parts.push(el("p", "ask-no", "No one is there to ask."));
      this.element.replaceChildren(...parts);
      return;
    }
    parts.push(el("h2", undefined, `🙏 Ask ${o.name}`));
    if (o.shut) {
      parts.push(el("p", "ask-no", `You can't ask them: ${o.shut}.`));
      this.element.replaceChildren(...parts);
      return;
    }
    parts.push(el("p", "ask-who", o.who));
    if (o.firstNow) parts.push(el("p", "ask-who", o.firstNow));
    if (o.raises.length) {
      parts.push(el("h3", undefined, "Raise something"));
      for (const r of o.raises) parts.push(this.row(r));
    } else parts.push(el("p", "ask-who", "There is nothing more it could raise now."));
    parts.push(el("h3", undefined, "Put something first"));
    for (const r of o.firsts) parts.push(this.row(r));
    if (o.no.length) {
      parts.push(el("h3", undefined, "Not to be asked"));
      for (const n of o.no) parts.push(el("p", "ask-no", `${n.name}: ${n.why}.`));
    }
    if (o.asked.length) {
      parts.push(el("h3", undefined, "Asked already"));
      for (const a of o.asked) {
        const b = el("button", "ask-old", a.words);
        b.onclick = () => this.onPage(a.ref);
        parts.push(b);
      }
    }
    this.element.replaceChildren(...parts);
  }
}
