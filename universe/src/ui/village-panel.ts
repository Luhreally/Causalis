// The microscope's panel (docs/architecture §9, §31): the village watched (its clock
// the time bar's, at the speeds a town is watched at), and an inspector for a watched
// person — who they are, what they are doing now and why, how hungry and tired, and their
// page with its whys. Under its bar, the town's stores and its work today (Phase 39 M198), a
// tap from their card: what each store holds and how long it would last, what came in and went
// out today, who is at what, and what is going up. Watching is looking: it never changes what
// happens.
import { STORE_KINDS, type HostClient } from "../bridge/index.ts";
import {
  ACTIVITY,
  ACTIVITY_WORDS,
  ROLE_WORDS,
  STORE_WORDS,
  carryWords,
  type Moment,
  type StoresNow,
} from "../view/index.ts";
import type { VillagePlan } from "../bridge/index.ts";
import { PeopleView } from "./people.ts";
import type { Tidings } from "./tidings.ts";
import { WhyTree, el } from "./why.ts";
import { folder } from "./window.ts";

const count = (n: number) => Math.round(n).toLocaleString("en-US");

/** How long a store would last, in words: "8 months", "a fortnight", "a year and more". */
function lastsWords(months: number): string {
  if (months >= 24) return "years";
  if (months >= 12) return "a year and more";
  if (months >= 1.5) return `${Math.round(months)} months`;
  if (months >= 0.75) return "a month";
  if (months >= 0.3) return "a fortnight";
  return months > 0 ? "days" : "none";
}

/** A store's months, short: "8 mo", "1 yr+", "—". */
function lastsShort(months: number): string {
  if (months >= 12) return "1 yr+";
  if (months <= 0) return "—";
  return months >= 1 ? `${Math.round(months)} mo` : `${Math.max(1, Math.round(months * 30))} d`;
}

function needWords(m: Moment): string {
  const hunger = m.hunger > 0.8 ? "hungry" : m.hunger > 0.5 ? "getting hungry" : "fed",
    tired = m.tiredness > 0.8 ? "worn out" : m.tiredness > 0.55 ? "tired" : "rested";
  return `${hunger}, ${tired}`;
}

export class VillagePanel {
  readonly element = el("div", "panel");
  readonly inspector = el("section", "inspector");
  private readonly client: HostClient;
  private readonly why: WhyTree;
  private readonly people: PeopleView;
  private readonly title = el("strong", "brand");
  /** Where the clock's bar goes in this bar. */
  readonly timeSlot = el("span", "time-slot");
  private readonly who = el("h2");
  private readonly now = el("div", "fact");
  private readonly page = el("div");
  private readonly whyBox = el("div", "why");
  private view = 0;
  private readonly hint = el("p", "hint");
  /** The town's stores and work, a line under the bar (Phase 39 M198); its card when open. */
  private readonly storesLine = el("button", "town-stores");
  private storesKey = "";
  private stores: StoresNow | null = null;
  private storesOpen = false;
  private folkOpen = false;
  private cardKey = "";
  onBack: () => void = () => {};
  onClose: () => void = () => {};
  /** The stores' card opened (what else is up is put away). */
  onStores: () => void = () => {};
  /** News of what the observer follows, and the toggles that follow things. */
  tidings: Tidings | null = null;

  constructor(root: HTMLElement, client: HostClient) {
    this.client = client;
    this.why = new WhyTree(client);
    this.people = new PeopleView(client);
    this.people.onPerson = (ref) => void this.showPerson(ref);
    this.people.onWhy = (ref) => void this.why.show(ref, this.whyBox);
    const bar = el("header", "bar"),
      back = el("button", "speed", "‹ The land");
    back.onclick = () => this.onBack();
    this.storesLine.hidden = true;
    this.storesLine.title = "The town's stores and its work today";
    this.storesLine.onclick = () => this.showStores();
    bar.append(back, this.title, this.timeSlot, this.storesLine);
    const close = el("button", "close", "×");
    close.setAttribute("aria-label", "Close");
    close.onclick = () => {
      this.inspector.hidden = true;
      this.storesOpen = this.folkOpen = false;
      this.onClose();
    };
    this.inspector.append(
      close,
      folder(this.inspector, this.who),
      this.who,
      this.now,
      this.page,
      el("h3", undefined, "Why?"),
      this.whyBox,
    );
    this.inspector.hidden = true;
    this.element.append(bar, this.inspector, this.hint);
    this.hand = false;
    root.append(this.element);
    this.visible = false;
  }

  set visible(on: boolean) {
    this.element.hidden = !on;
  }

  /** A town watched: its name; `fresh`, a town come to (else the same read again as the years turn). */
  show(name: string, fresh = true): void {
    this.title.textContent = name;
    if (!fresh) return;
    this.inspector.hidden = true;
    this.storesOpen = this.folkOpen = false;
    this.storesKey = this.cardKey = "";
    this.storesLine.hidden = true;
  }

  /** The panel's own card (the stores', one of the many's) put away, if one is up. */
  closeCard(): void {
    if (!this.storesOpen && !this.folkOpen) return;
    this.storesOpen = this.folkOpen = false;
    this.inspector.hidden = true;
  }

  /** The words of the card up now, if it is the stores' or one of the many's (the look tools). */
  cardShown(): string | null {
    return (this.storesOpen || this.folkOpen) && !this.inspector.hidden
      ? (this.inspector.textContent ?? "")
      : null;
  }

  /**
   * The town's stores now (null: none told), on the line under the bar — each store's sign and how
   * long it would last, the yard's loads, what is going up — and on their card, if it is open.
   */
  storesNow(s: StoresNow | null): void {
    this.stores = s;
    if (!s) {
      this.storesLine.hidden = true;
      return;
    }
    const chip = (sign: string, text: string) => `${sign} ${text}`,
      parts = [
        chip(STORE_WORDS.grain.sign, lastsShort(s.lasts.grain)),
        // (Fresh food eaten as it comes, and stone where none is raised, are not kept: no chip.)
        ...(s.have.food >= 0.5 ? [chip(STORE_WORDS.food.sign, lastsShort(s.lasts.food))] : []),
        chip(STORE_WORDS.wood.sign, count(s.have.wood)),
        ...(s.have.stone >= 0.5 ? [chip(STORE_WORDS.stone.sign, count(s.have.stone))] : []),
        ...(s.have.ore > 0.5 ? [chip(STORE_WORDS.ore.sign, lastsShort(s.lasts.ore))] : []),
        ...(s.sites.length ? [chip("🏗️", `${s.sites.length} going up`)] : []),
        ...(s.lean ? ["🥣 Lean"] : []),
      ],
      key = parts.join(" · ");
    if (key !== this.storesKey) {
      this.storesKey = key;
      this.storesLine.textContent = key;
      this.storesLine.classList.toggle("lean", s.lean);
    }
    this.storesLine.hidden = false;
    if (this.storesOpen) this.fillStores(s);
  }

  /** The town's stores and its work today, in the inspector (kept up as the day goes). */
  showStores(): void {
    if (!this.stores) return;
    this.onStores();
    this.view++;
    this.storesOpen = true;
    this.folkOpen = false;
    this.cardKey = "";
    this.inspector.hidden = false;
    this.who.textContent = `${this.title.textContent ?? "The town"} at work`;
    this.whyBox.replaceChildren();
    this.fillStores(this.stores);
  }

  private fillStores(s: StoresNow): void {
    const rows = STORE_KINDS.filter(
        (k) => k !== "ore" || s.have.ore > 0.5 || s.brought.ore > 0 || s.taken.ore > 0,
      ).map((k) => {
        const w = STORE_WORDS[k],
          yard = k === "wood" || k === "stone",
          moving = s.brought[k] > 0.5 || s.taken[k] > 0.5,
          // (What is eaten as it comes keeps none: fresh meat, milk, the wild's.)
          held = yard
            ? `${count(s.have[k])} loads`
            : s.have[k] < 0.5
              ? moving
                ? "none kept, used as it comes"
                : "none"
              : `${count(s.have[k])} (lasts ${lastsWords(s.lasts[k])})`,
          today = moving ? ` · today +${count(s.brought[k])} / −${count(s.taken[k])}` : "";
        return `${w.sign} ${w.name}: ${held}${today}`;
      }),
      doing = s.doing
        .filter((d) => d.n > 0)
        .map((d) => `${d.n} ${ROLE_WORDS[d.kind]}`)
        .join(" · "),
      // (Alike going up told together: "7 × a house rising — 3 at work".)
      alike = new Map<string, { n: number; hands: number }>(),
      sites: string[] = [];
    for (const x of s.sites) {
      const a = alike.get(x.words) ?? { n: 0, hands: 0 };
      a.n++;
      a.hands += x.hands;
      alike.set(x.words, a);
    }
    for (const [words, a] of alike)
      sites.push(`${a.n > 1 ? `${a.n} × ` : ""}${words}${a.hands ? ` — ${a.hands} at work` : ""}`);
    const key = [rows.join("|"), doing, sites.join("|"), s.lean].join("#");
    if (key === this.cardKey) return;
    this.cardKey = key;
    this.now.textContent = `Food for ${lastsWords(s.months)}${s.lean ? " — a lean time" : ""}`;
    const list = (lines: readonly string[]) => {
      const ul = el("ul", "stores-list");
      for (const line of lines) ul.append(el("li", undefined, line));
      return ul;
    };
    this.page.replaceChildren(
      el("h3", undefined, "Its stores"),
      list(rows),
      el("h3", undefined, "Today, of those drawn"),
      el("p", "stores-doing", doing || "A day of rest: none at work."),
      ...(sites.length ? [el("h3", undefined, `Going up (${s.sites.length})`), list(sites)] : []),
      ...(s.lean
        ? [
            el(
              "p",
              "muted",
              "A lean time: the granary has little to give, and those idle go out to the wild for what it gives.",
            ),
          ]
        : []),
      el(
        "p",
        "muted",
        "As history keeps them: what the town holds, made and used over its year, shared among those drawn as they bring and take it.",
      ),
    );
  }

  /**
   * One of the town's many drawn for its crowd (Phase 39 M198): not one history follows, but
   * living the town's day as its own people do — their work today.
   */
  showFolk(name: string, today: string | null): void {
    this.view++;
    this.storesOpen = false;
    this.folkOpen = true;
    this.inspector.hidden = false;
    this.who.textContent = name;
    this.page.replaceChildren(
      ...(today ? [el("div", "fact", `Today: ${today}`)] : []),
      el(
        "p",
        "muted",
        "One of the town's many, drawn for its crowd: history counts them among its people but does not follow them by name. They live its day as its own people do.",
      ),
    );
    this.whyBox.replaceChildren();
  }

  /** The village's age and what its mine digs, for the words of what they carry. */
  works: {
    era: VillagePlan["era"];
    what: "coal" | "ore" | "stone" | null;
    metal?: VillagePlan["metal"];
  } = {
    era: undefined,
    what: null,
  };

  /** What the person looked at is doing now, and what they carry (and what it is made of). */
  moment(m: Moment | null, tool?: string): void {
    if (!m || this.storesOpen) return;
    this.now.textContent = this.nowWords(m, tool);
  }

  /**
   * What someone is doing now and why, in words: "Now at work: felling timber for the builders;
   * fed and rested; carrying an axe" — their own tool where it is known (Phase 15 M125: "a flint
   * hoe, made in year 254").
   */
  nowWords(m: Moment, tool?: string): string {
    const carrying =
        m.carry === "tool" && tool
          ? tool
          : m.carry
            ? carryWords(m.carry, this.works.era, this.works.what, this.works.metal)
            : "",
      why =
        m.why && m.activity !== ACTIVITY.sheltering
          ? `: ${m.why[0]!.toLowerCase()}${m.why.slice(1)}`
          : "";
    return `Now ${ACTIVITY_WORDS[m.activity]}${why}; ${needWords(m)}${carrying ? `; carrying ${carrying}` : ""}`;
  }

  /** Whether the hand rests on the village watched: then its people are the hand's. */
  set hand(on: boolean) {
    this.hint.textContent = on
      ? "Your hand rests here: these people live as themselves, and what befalls them is history."
      : "You are watching: nothing here changes what happens. Tap someone to look closer.";
  }

  /** One of the hand's people: who they are, what they are remembered for, and what the god may do for them. */
  async showAgent(id: number, name: string, age: number, work: string): Promise<void> {
    const view = ++this.view;
    this.storesOpen = this.folkOpen = false;
    this.inspector.hidden = false;
    this.who.textContent = name;
    const about = el(
      "p",
      "muted",
      "One of the people your hand rests on: they live and die as themselves while it rests here.",
    );
    this.page.replaceChildren(el("div", "fact", `${age}, ${work}`), about);
    this.whyBox.replaceChildren();
    const a = await this.client.query<{
      blessedUntil: number | null;
      deeds: { event: string; claim: string }[];
    } | null>({ type: "agent", args: { id } });
    if (this.view !== view) return;
    if (!a) {
      this.page.replaceChildren(el("div", "fact muted", "They are no longer among the living."));
      return;
    }
    const tools = el("div", "tools"),
      note = el("p", "note"),
      parts: HTMLElement[] = [];
    note.hidden = true;
    for (const d of a.deeds) {
      const b = el("button", "line act-line", d.claim);
      b.onclick = () => void this.why.show(d.event, this.whyBox);
      parts.push(b);
    }
    const tool = (label: string, type: string, effect: string) => {
      const b = el("button", "tool", label);
      b.onclick = async () => {
        if (b.dataset.sure !== "yes") {
          for (const o of tools.children) {
            const other = o as HTMLButtonElement;
            other.dataset.sure = "";
            other.textContent = other.dataset.label!;
          }
          b.dataset.sure = "yes";
          b.textContent = `${label} — confirm`;
          note.hidden = false;
          note.textContent = `${effect} History will remember it was your hand.`;
          return;
        }
        b.disabled = true;
        try {
          await this.client.command(type, { agent: id });
          void this.showAgent(id, name, age, work);
        } catch (error) {
          note.textContent = (error as Error).message;
          b.disabled = false;
        }
      };
      b.dataset.label = label;
      tools.append(b);
    };
    tool(
      "Inspire them",
      "act.inspire-one",
      `${name.split(" ")[0]} will come upon the next thing their land could know, and be remembered for it.`,
    );
    if (a.blessedUntil === null)
      tool(
        "Bless them",
        "act.bless-one",
        `${name.split(" ")[0]} will be spared death for twenty years, while your hand rests here.`,
      );
    else
      parts.push(el("div", "fact act-line", `Blessed: spared death until year ${a.blessedUntil}`));
    this.page.replaceChildren(
      el("div", "fact", `${age}, ${work}`),
      about,
      ...parts,
      el("h3", undefined, "Your hand on them"),
      tools,
      note,
    );
  }

  /** A beast looked at: its lineage, what it is doing now, and its lineage's why. */
  showBeast(b: { ref: string; name: string; doing: string; flock: boolean }): void {
    this.view++;
    this.storesOpen = this.folkOpen = false;
    this.inspector.hidden = false;
    this.who.textContent = `The ${b.name}`;
    this.now.textContent = `Now ${b.doing}`;
    this.page.replaceChildren(
      el(
        "p",
        "fact",
        b.flock
          ? "Of the village's flocks: tamed from the wild, and kept for their meat, milk and hides."
          : "Wild: its lineage lives on this land, as the world's deep past spread it.",
      ),
    );
    void this.why.show(b.ref, this.whyBox);
  }

  async showPerson(ref: string): Promise<void> {
    const view = ++this.view;
    this.storesOpen = this.folkOpen = false;
    this.inspector.hidden = false;
    this.who.textContent = "…";
    const p = await this.people.person(this.page, ref);
    if (this.view !== view) return;
    if (this.tidings) this.page.prepend(this.tidings.follow(ref, "their life"));
    this.who.textContent = p.name;
    void this.why.show(ref, this.whyBox);
  }
}
