// The town mode's own inspector (asked 2026-11-25: "the ui and ux could be better ... there should be more detail"), in
// place of the god game's page window while a town is entered: one of its people, or one of its lots, laid out as a
// colony sim lays one out. A person: their portrait, name, age and trade; what they are at now and why; their mood on a
// bar from -100 to 100 with the mark below which they heed no order; how they are; four need bars, each with the mark at
// which it presses past their work. Tabs for their mood's reasons (each with its size and how long it lasts), their life
// and their household, their work (skill, temper, home, what they hold, the orders a hand gives). A lot: what it is, who
// works and lives in it, how far it has got where it is going up, what it holds by unit. The long sentences behind ⓘ;
// the god game's full page a key away. On a phone it lies at the foot at three heights (a peek, half the screen, all of
// it below the bar), a tap on its handle taking it to the next; on a desk it is docked at the left. It asks for nothing
// itself: the page that owns it (app/townplace.ts) reads it and tells it.
import type {
  PlaceInspect,
  PlaceInspectBelow,
  PlaceInspectLevels,
  PlaceInspectBeasts,
  PlaceInspectBound,
  PlaceInspectFaith,
  PlaceInspectBody,
  PlaceInspectMaking,
  PlaceInspectCivic,
  PlaceInspectWhy,
  PlaceInspectHelp,
  PlaceInspectTown,
  PlaceInspectWhatNow,
  PlaceInspectCharacter,
  PlaceInspectDead,
  PlaceInspectFamily,
  PlaceInspectGate,
  PlaceInspectLegends,
  PlaceInspectWork,
  PlaceInspectFields,
  PlaceInspectInside,
  PlaceInspectItem,
  PlaceInspectLot,
  PlaceInspectPerson,
  PlaceNamed,
  PlaceNeed,
} from "../bridge/index.ts";
import { drawPortrait } from "./portrait.ts";
import { drawBody } from "./body.ts";
import { el } from "./why.ts";
import { billsEl, takesEl } from "./place-bills.ts";
import { insideEl } from "./place-inside.ts";
import { fieldsEl } from "./place-fields.ts";
import { belowEl } from "./place-below.ts";
import { levelsEl } from "./place-levels.ts";
import { captioned } from "./place-hud.ts";
import { glossaryEl, helpFootEl } from "./place-guide.ts";
import type { VillagePlan } from "../bridge/index.ts";

export type InspectHeight = "peek" | "half" | "full";
type PersonTab = "now" | "mood" | "health" | "skills" | "social" | "gear" | "life" | "work";
const PERSON_TABS: readonly (readonly [PersonTab, string])[] = [
  ["now", "Now"],
  ["mood", "Mood"],
  ["health", "Health"],
  ["skills", "Skills"],
  ["social", "Social"],
  ["gear", "Gear"],
  ["life", "Life"],
  ["work", "Work"],
];
/** The body drawn on the Health tab (CSS pixels). */
const BODY_W = 150,
  BODY_H = 190;
/** The hours of each level (rules/life.ts SKILL_LEVELS: a hand at 200, able at 800, skilled at 2,000, a master at 8,000). */
const LEVEL_HOURS = [0, 200, 800, 2000, 8000];
/** What one can be put to by name: the world's occupation column and its word (null: let be). */
const ORDER_TRADES: readonly (readonly [number | null, string])[] = [
  [2, "Fields"],
  [3, "Herds"],
  [4, "Crafts"],
  [5, "Hauling"],
  [null, "Let be"],
];
const PORTRAIT = 64;
const HEIGHTS: readonly InspectHeight[] = ["peek", "half", "full"];
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const signed = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(Math.round(x))}`;
const amount = (x: number) =>
  x >= 100 ? `${Math.round(x)}` : x >= 10 ? x.toFixed(1) : x.toFixed(2);
/** How closely the town works out one's day, in plain words (U4: "Followed in full, while looked at" said nothing). */
const tierWords = (x: PlaceInspectPerson): string =>
  x.tier.pinned && !x.tier.soft
    ? "Their day is worked out in full detail: you follow them (🎯)."
    : x.tier.pinned
      ? "Their day is worked out in full detail while you look at them."
      : x.tier.tier === 0
        ? "Their day is worked out in full detail: they matter to the town's story now."
        : x.tier.tier === 1
          ? "Their day is worked out hour by hour."
          : "Their day is worked out every three hours, as for most of the town.";
/** Mood's scale and the mark on its bar, said beside it (U4). */
const MOOD_KEY = (at: number) =>
  `Mood runs from −100 to +100. Below the red tick (${signed(at)}) they stop heeding orders.`;
/** How long a reading of a tab's section is kept before it is asked again (ms): their family, character, body. */
const SECTION_EVERY = 3000;

export class PlaceInspector {
  readonly element = el("section", "place-insp");
  private readonly handle = el("button", "place-insp-handle");
  private readonly portrait = el("canvas", "place-insp-portrait");
  private readonly title = el("h2", "place-insp-name");
  private readonly sub = el("p", "place-insp-sub");
  // (Each key's sign given its word under it, U3: a phone shows no title. One row on every page, each key in its place:
  // ‹ › … ? 🎯 ⓘ 📖 ×, one that does not serve the page shown greyed, never gone.)
  private readonly followKey = captioned(
    el("button", "place-insp-key place-insp-follow"),
    "🎯",
    "Follow",
  );
  /** Back to whom or what was inspected before, the eye where it was (from the first: closed); and forward again. */
  private readonly backKey = captioned(el("button", "place-insp-key place-insp-back"), "‹", "Back");
  private readonly aheadKey = captioned(
    el("button", "place-insp-key place-insp-ahead"),
    "›",
    "Forward",
  );
  private readonly proseKey = captioned(
    el("button", "place-insp-key place-insp-info"),
    "ⓘ",
    "Words",
  );
  private readonly pageKey = captioned(
    el("button", "place-insp-key place-insp-page"),
    "📖",
    "Page",
  );
  /** What this page or tab is, in plain words (G2). */
  private readonly helpKey = captioned(
    el("button", "place-insp-key place-insp-helpkey"),
    "?",
    "Help",
  );
  private readonly body = el("div", "place-insp-body");
  /** What is inspected now (null: nothing), and the last reading of it. */
  ref: string | null = null;
  now: PlaceInspect | null = null;
  height: InspectHeight = "peek";
  private tab: PersonTab = "now";
  private prose = false;
  private ordering = false;
  /** A raise asked on a lot's page that clears homes, waiting on its Raise or Cancel (`ref|what|at`; null: none). U2. */
  private raising: string | null = null;
  private drawn = "";
  private pictured = "";
  /** Whether orders may be given (by hand or by its head: not in a town watched). */
  orders = true;
  /** Whether the eye keeps with whom it shows. */
  following = false;
  onClose: () => void = () => {};
  onBack: () => void = () => {};
  onAhead: () => void = () => {};
  onHeight: (h: InspectHeight) => void = () => {};
  /** Another inspected: one of its people or a lot (their ref). */
  onInspect: (ref: string) => void = () => {};
  /** The town's plan, as its view holds it: its fields' page is laid off it (O6). */
  plan: () => VillagePlan | null = () => null;
  /** Where a lot of the town stands (metres from its square; R8's levels draw off it). */
  lotAt: (lot: number) => { x: number; z: number } | null = () => null;
  /** The level of the town's ground shown (R8), and of which page. */
  private level = 0;
  private levelOf = "";
  /** The god game's full page of it. */
  onPage: (ref: string) => void = () => {};
  onFollow: (on: boolean) => void = () => {};
  /** The eye sent to one of its people or a lot (R7). */
  onGo: (g: { id: number | null; lot: number | null; at?: { x: number; z: number } }) => void =
    () => {};
  /** What a page or tab is, asked (G2): its topic. */
  onHelp: (topic: string) => void = () => {};
  /** The eye sent to one of the town or a lot (G3's Go to). */
  onGoFor: (g: { id: number | null; lot: number | null }) => void = () => {};
  /** One of the town's sheets opened (G3). */
  onSheet: (tab: string) => void = () => {};
  /** One of a person's tabs opened (G1's lessons). */
  onTabbed: (tab: string) => void = () => {};
  onOrder: (type: string, args: Record<string, unknown>) => void = () => {};
  /** One of its people followed in full by word, or let go of (tiers). */
  onPin: (id: number, on: boolean) => void = () => {};
  /**
   * A page of theirs read for a section of a tab (U4: their family on Social, their character on Skills, their body on
   * Health), asked only while that tab is open: the person's own reading, asked twice a second, carries none of it.
   */
  read: (ref: string) => Promise<PlaceInspect | null> = () => Promise.resolve(null);
  private readonly sections = new Map<
    string,
    { x: PlaceInspect | null; at: number; asking: boolean }
  >();

  constructor(root: HTMLElement) {
    this.handle.title = "Taller or shorter";
    this.handleWords();
    this.handle.onclick = () =>
      this.setHeight(HEIGHTS[(HEIGHTS.indexOf(this.height) + 1) % HEIGHTS.length]!);
    // (One key that follows, U4: the eye kept with them, and their day lived out in full by your word, as "Follow
    // closely" had it; again, both let go. Kept by your word with the eye gone elsewhere, a tap keeps the eye too.)
    this.followKey.onclick = () => {
      const x = this.now,
        on = !this.following;
      this.onFollow(on);
      if (x?.kind === "person" && on !== (x.tier.pinned && !x.tier.soft)) this.onPin(x.id, on);
    };
    this.backKey.onclick = () => this.onBack();
    // (A tap on the web: the one nearest it, within a finger's breadth.)
    this.web.onclick = (e) => {
      const r = this.web.getBoundingClientRect(),
        sx = 340 / Math.max(1, r.width),
        x = (e.clientX - r.left) * sx,
        y = (e.clientY - r.top) * sx;
      let best: string | null = null,
        near = 22 * sx;
      for (const n of this.webAt) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < near) {
          near = d;
          best = n.ref;
        }
      }
      if (best) this.onInspect(best);
    };
    this.aheadKey.onclick = () => this.onAhead();
    this.setBack(null, false, false);
    this.proseKey.title = "What these numbers mean, in words";
    this.proseKey.setAttribute("aria-label", this.proseKey.title);
    this.proseKey.onclick = () => {
      this.prose = !this.prose;
      this.redraw();
    };
    this.pageKey.title = "Its whole page, as the world tells it";
    this.pageKey.setAttribute("aria-label", this.pageKey.title);
    this.pageKey.onclick = () => this.now && this.onPage(this.now.ref);
    this.helpKey.title = "What is this? In plain words";
    this.helpKey.setAttribute("aria-label", this.helpKey.title);
    this.helpKey.onclick = () => {
      const x = this.now;
      if (x) this.onHelp(x.kind === "person" ? `tab:${this.tab}` : `page:${x.kind}`);
    };
    const shut = captioned(el("button", "place-insp-key place-insp-shut"), "×", "Close");
    shut.setAttribute("aria-label", "Close");
    shut.onclick = () => this.onClose();
    const head = el("header", "place-insp-head"),
      names = el("div", "place-insp-names"),
      keys = el("div", "place-insp-keys");
    this.portrait.width = this.portrait.height = PORTRAIT;
    names.append(this.title, this.sub);
    // (The one row of keys every page has, U3: 🎯 ⓘ 📖 ×. What this is, G2, at the end of the name's row: among the keys
    // above, each with its word under it, it squeezed the grip beside them to 2 px on a phone.)
    keys.append(this.followKey, this.proseKey, this.pageKey, shut);
    head.append(this.portrait, names, this.helpKey);
    // (Its keys in a row of their own above the name: back and forward, the handle between, the rest.)
    const top = el("div", "place-insp-top");
    top.append(this.backKey, this.aheadKey, this.handle, keys);
    this.element.append(top, head, this.body);
    // (A finger down on it: nothing under it is drawn anew till it is up, or the key pressed is gone when it ends.)
    this.body.addEventListener("pointerdown", () => (this.held = performance.now() + 800));
    for (const up of ["pointerup", "pointercancel"])
      this.body.addEventListener(up, () => (this.held = performance.now() + 60));
    this.element.hidden = true;
    root.append(this.element);
  }
  private held = 0;
  private heldDraw: ReturnType<typeof setTimeout> | undefined;

  /**
   * Its Back key told whom it goes back to (null: one not named), or that it closes, the first opened; its Forward key
   * whom it goes on to again (false: none, greyed).
   */
  setBack(name: string | null, steps: boolean, ahead: string | null | false): void {
    const words = steps
      ? `Back to ${name ?? "the one before"}`
      : "Back: close it, the eye where it was";
    this.backKey.title = words;
    this.backKey.setAttribute("aria-label", words);
    const on = ahead !== false;
    this.aheadKey.disabled = !on;
    const forward = on ? `Forward to ${ahead ?? "the one after"}` : "Forward: nothing to go on to";
    this.aheadKey.title = forward;
    this.aheadKey.setAttribute("aria-label", forward);
  }
  get shown(): boolean {
    return !this.element.hidden;
  }
  /** Opened on what a ref names (null: closed); what it shows comes when it is read. */
  open(ref: string | null): void {
    if (ref !== this.ref) {
      this.tab = "now";
      this.ordering = false;
      this.prose = false;
      this.raising = null;
      this.drawn = "";
      this.now = null;
      this.sections.clear();
    }
    this.ref = ref;
    this.element.hidden = ref === null;
    if (ref && !this.now) {
      this.title.textContent = "…";
      this.sub.textContent = "";
      this.body.replaceChildren();
    }
    this.element.dataset.height = this.height;
  }
  setHeight(h: InspectHeight): void {
    this.height = h;
    this.element.dataset.height = h;
    this.handleWords();
    this.onHeight(h);
  }
  /** The handle's words (U3): what a tap on it does, in a word, not a bare bar whose meaning was only in a title. */
  private handleWords(): void {
    const more = this.height !== "full",
      words = more ? "▲ More" : "▼ Less";
    if (this.handle.textContent !== words) this.handle.textContent = words;
    this.handle.setAttribute(
      "aria-label",
      more ? "Show more of it: taller" : "Show less of it: down to a peek",
    );
  }
  /** What it shows, read again. */
  show(x: PlaceInspect | null): void {
    if (!x || (x.ref !== this.ref && (x.kind !== "person" || x.page !== this.ref))) {
      if (x === null && this.ref) {
        this.title.textContent = "Gone from the town";
        this.sub.textContent = "Dead, or left: their page tells what befell them.";
        this.body.replaceChildren();
      }
      return;
    }
    this.now = x;
    // (Under a finger: drawn once it is lifted, not let go of. The host tells only what has changed, so an answer let go
    // of here was never told again: a key pressed on a lot's page showed nothing of what it did. O2.)
    const wait = this.held - performance.now();
    if (wait > 0) {
      clearTimeout(this.heldDraw);
      this.heldDraw = setTimeout(() => this.redraw(), wait + 1);
      return;
    }
    this.redraw();
  }
  private redraw(): void {
    const x = this.now;
    if (!x) return;
    const key = JSON.stringify([
      x,
      this.tab,
      this.prose,
      this.ordering,
      this.orders,
      this.following,
      this.raising,
    ]);
    if (key === this.drawn) return;
    this.drawn = key;
    this.element.dataset.kind = x.kind;
    // (Greyed where it does not serve, never gone: each key in the same place on every page, U3.)
    this.followKey.disabled = x.kind !== "person";
    this.proseKey.disabled = x.kind !== "person";
    this.helpKey.disabled = x.kind === "help";
    // (Its state on the key, U4: lit and "Following" while the eye is kept with them; ringed where your word still has
    // their day lived out in full, the eye gone elsewhere.)
    const kept = x.kind === "person" && x.tier.pinned && !x.tier.soft;
    this.followKey.classList.toggle("on", this.following);
    this.followKey.classList.toggle("kept", !this.following && kept);
    this.followKey.setAttribute("aria-pressed", String(this.following));
    captioned(this.followKey, "🎯", this.following ? "Following" : "Follow");
    const fw = this.following
      ? "Following: tap to let them go, the eye where it is"
      : kept
        ? "Their day is lived out in full by your word: tap to keep the eye with them too"
        : "Follow: keep the eye with them, and have their day lived out in full";
    this.followKey.title = fw;
    this.followKey.setAttribute("aria-label", fw);
    this.proseKey.classList.toggle("on", this.prose);
    if (x.kind === "person") this.person(x);
    else if (x.kind === "inside") this.inside(x);
    else if (x.kind === "item") this.item(x);
    else if (x.kind === "fields") this.fields(x);
    else if (x.kind === "below") this.below(x);
    else if (x.kind === "work") this.work(x);
    else if (x.kind === "legends") this.legends(x);
    else if (x.kind === "gate") this.gate(x);
    else if (x.kind === "family") this.family(x);
    else if (x.kind === "bound") this.bound(x);
    else if (x.kind === "faith") this.faith(x);
    else if (x.kind === "dead") this.dead(x);
    else if (x.kind === "character") this.character(x);
    else if (x.kind === "body") this.bodyPage(x);
    else if (x.kind === "making") this.making(x);
    else if (x.kind === "civic") this.civic(x);
    else if (x.kind === "why") this.whyPage(x);
    else if (x.kind === "levels") this.levels(x);
    else if (x.kind === "beasts") this.beasts(x);
    else if (x.kind === "help") this.help(x);
    else if (x.kind === "whatnow") this.whatNow(x);
    else if (x.kind === "townpages") this.townPages(x);
    else this.lot(x);
  }

  private picture(x: PlaceInspect): void {
    const key = x.kind === "person" ? JSON.stringify(x.portrait) : "lot";
    if (key === this.pictured) return;
    this.pictured = key;
    const ctx = this.portrait.getContext("2d");
    if (x.kind === "person" && x.portrait)
      drawPortrait(this.portrait, x.portrait, PORTRAIT, PORTRAIT, 0);
    else if (ctx) ctx.clearRect(0, 0, this.portrait.width, this.portrait.height);
    this.portrait.hidden = x.kind !== "person";
  }

  private person(x: PlaceInspectPerson): void {
    this.picture(x);
    if (this.title.textContent !== x.name) this.title.textContent = x.name;
    this.sub.textContent = `${cap(x.trade)}, ${x.age}${x.bound ? ` · by order: ${x.bound}` : ""}`;
    const body: HTMLElement[] = [];
    // What they are at; then their tabs in one row (U3: every tab in reach at half the screen on a phone, where a second
    // row of them lay under the fold, four taps from entering); then the tab open, right under them.
    const now = el("p", "place-insp-now", x.now);
    body.push(now, this.tabRow());
    const first = this.tab === "now";
    // Why, the first thing on their first tab (U4): their reason, and every step behind it a key away. (Their bars, their
    // table and how closely they are followed are this tab's alone: above every tab they took 430 px of a phone. U4.)
    if (first) {
      const why = el("div", "place-insp-whyline"),
        key = el("button", "place-insp-whykey", "Why? ▸");
      key.setAttribute("aria-label", `Why ${x.name} does what they do, step by step`);
      key.onclick = () => this.onInspect(x.whyRef);
      why.append(el("p", "place-insp-why place-insp-reason", x.why), key);
      body.push(why);
    }
    if (first || this.tab === "mood")
      body.push(
        this.moodBar(x),
        el("p", "place-insp-key-line place-insp-mood-key", MOOD_KEY(x.breakAt)),
      );
    // The first tab: how they are, their needs, their table, how closely they are followed, their orders, where.
    if (first) {
      if (x.healthWords || x.lack > 0) {
        const h = el(
          "p",
          `place-insp-health${x.health === 1 || x.health === 2 || x.lack > 0 ? " bad" : ""}`,
          [x.healthWords, x.lack > 0 ? `${x.lack} ${x.lack === 1 ? "day" : "days"} in want` : null]
            .filter(Boolean)
            .join(" · "),
        );
        body.push(h);
      }
      // (Which way is worse, said once over the bars, U4: each bar is how much they want of it.)
      const needs = el("div", "place-insp-needs");
      for (const n of x.needs) needs.append(this.needBar(n, x.serves));
      body.push(
        el(
          "p",
          "place-insp-key-line place-insp-needs-key",
          "Needs: 0% wants nothing, 100% can bear no more. Past the white tick it comes before their work.",
        ),
        needs,
      );
      // (Their table, and what they take and need: P4.)
      body.push(el("p", "place-insp-why place-insp-table", x.table));
      if (x.takes) body.push(el("p", "place-insp-why place-insp-takes", x.takes));
      // (Held in bondage, and your word to free them: P6.)
      if (x.bond) {
        body.push(el("p", "place-insp-why place-insp-bond", `⛓️ ${x.bond}`));
        if (x.freeable && this.orders) {
          const free = el("button", "place-insp-free", "Free them");
          free.setAttribute("aria-label", `Free ${x.name} from bondage by your word`);
          free.onclick = () => this.onOrder("place.free", { person: x.id });
          body.push(free);
        }
      }
      // (How closely the town works out their day, in plain words: tiers. Followed by your word from 🎯 Follow, U4: the
      // drill keys that stood here, Family, Character, Body, Why and Gear, are each in a tab now, one way to each.)
      const tier = el("p", "place-insp-why place-insp-tier", tierWords(x));
      tier.title =
        "How closely the town works out their day: in full, ten minutes at a time; hour by hour; or every three hours with most of its people";
      body.push(tier);
      // (A hand's orders, by name: a trade, or let be.)
      if (this.orders && x.trade !== "child") {
        const row = el("div", "place-insp-orders"),
          key = el("button", "place-insp-order", this.ordering ? "Orders ▴" : "Orders ▾");
        key.setAttribute("aria-expanded", String(this.ordering));
        key.onclick = () => {
          this.ordering = !this.ordering;
          this.redraw();
        };
        row.append(key);
        if (this.ordering)
          for (const [occ, words] of ORDER_TRADES) {
            const b = el("button", "place-chip", words);
            b.setAttribute(
              "aria-label",
              `Put ${x.name} to ${words === "Let be" ? "their own choosing" : words.toLowerCase()}`,
            );
            b.onclick = () => {
              this.ordering = false;
              this.onOrder("place.assign", { person: x.id, trade: occ, post: null });
            };
            row.append(b);
          }
        body.push(row);
        // (Drafted by name, R9: under arms whatever the muster, standing where told: with the rest, at their home or their
        // work; or stood down.)
        if (this.ordering && x.age >= 0) {
          const draft = el("div", "place-insp-orders place-insp-draft"),
            at: [number, string][] = [
              [-9, "⚔️ Draft"],
              [x.home.lot, "⚔️ At their home"],
              ...(x.work && x.work.lot >= 0
                ? ([[x.work.lot, "⚔️ At their work"]] as [number, string][])
                : []),
            ];
          for (const [lot, words] of at) {
            const b = el("button", `place-chip${x.drafted === lot ? " on" : ""}`, words);
            b.setAttribute(
              "aria-label",
              lot === -9
                ? `Draft ${x.name}, to stand with those under arms`
                : `Draft ${x.name}, to stand ${words.slice(3).toLowerCase()}`,
            );
            b.onclick = () => {
              this.ordering = false;
              this.onOrder("place.draft", { person: x.id, at: lot });
            };
            draft.append(b);
          }
          if (x.drafted !== null) {
            const b = el("button", "place-chip place-insp-undraft", "Stand down");
            b.setAttribute("aria-label", `Stand ${x.name} down`);
            b.onclick = () => {
              this.ordering = false;
              this.onOrder("place.draft", { person: x.id, at: null });
            };
            draft.append(b);
          }
          body.push(draft);
        }
      }
    }
    if (this.tab === "now") {
      body.push(
        this.facts([
          ["Home", x.home.words, x.home.ref],
          ...(x.work ? [["Work", x.work.words, x.work.ref] as const] : []),
          ["In hand", x.holds ?? "Nothing", null],
          ["Pantry", x.pantry, null],
        ]),
      );
    } else if (this.tab === "mood") {
      const list = el("div", "place-insp-thoughts");
      for (const t of x.thoughts) {
        // (Each with whom or what it came of under it; one of the town's people or its lots a tap away.)
        const go = !!t.from?.ref,
          row = el(
            go ? "button" : "div",
            `place-insp-thought ${t.size >= 0 ? "up" : "down"}${go ? " go" : ""}`,
          ),
          words = el("span", "place-insp-thought-words", t.words);
        if (t.from) words.append(el("span", "place-insp-thought-from", t.from.name));
        if (go) row.onclick = () => this.onInspect(t.from!.ref!);
        row.append(
          el("span", "place-insp-thought-icon", t.icon),
          words,
          el("span", "place-insp-thought-size", signed(t.size)),
          el(
            "span",
            "place-insp-thought-days",
            t.days === null ? "while it lasts" : `${t.days} ${t.days === 1 ? "day" : "days"} more`,
          ),
        );
        list.append(row);
      }
      body.push(
        list,
        el("p", "place-insp-why", `Temper: ${x.temper}. Nature: ${x.nature}.`),
        el("p", "place-insp-why", `${x.values}.`),
      );
    } else if (this.tab === "skills") {
      if (!x.skills.length) body.push(el("p", "place-insp-why", "A child: they keep no work yet."));
      else {
        // (Its scale said over it, U4: the hours, and the levels the bar fills by.)
        body.push(
          el(
            "p",
            "place-insp-key-line place-insp-skills-key",
            "Hours given to each kind of work. The bar fills level by level: a hand at 200 h, able at 800, skilled at 2,000, a master at 8,000. ★ taught at home; % fit: what a wound leaves of their hand.",
          ),
        );
        const list = el("div", "place-insp-skills");
        for (const k of [...x.skills].sort(
          (a, b) => Number(b.own) - Number(a.own) || b.hours - a.hours,
        )) {
          const row = el("div", `place-insp-skill${k.own ? " own" : ""}`),
            bar = el("span", "place-insp-skill-bar"),
            fill = el("span", "place-insp-skill-fill"),
            // (Along the bar by level, each level a fifth, the hours past it toward the next.)
            lo = LEVEL_HOURS[k.level] ?? 0,
            hi = LEVEL_HOURS[k.level + 1],
            along = hi === undefined ? 1 : (k.level + (k.hours - lo) / (hi - lo)) / 4;
          fill.style.width = `${Math.round(Math.min(1, along) * 100)}%`;
          bar.append(fill);
          row.append(
            el("span", "place-insp-skill-name", `${k.name}${k.passion ? " ★" : ""}`),
            bar,
            el(
              "span",
              "place-insp-skill-level",
              `${cap(k.words)} · ${k.hours.toLocaleString("en-US")} h${k.fit < 0.99 ? ` · ${Math.round(k.fit * 100)}% fit` : ""}`,
            ),
          );
          row.title = `${k.name}: ${k.words}, ${k.hours.toLocaleString("en-US")} hours given to it${k.own ? " (their own trade)" : ""}${k.passion ? "; their household taught them it" : ""}${k.fit < 0.99 ? `; a wound takes ${100 - Math.round(k.fit * 100)}% of what it is done with` : ""}`;
          list.append(row);
        }
        body.push(list);
        body.push(
          el(
            "p",
            "place-insp-why",
            `${x.taught ? `★ ${x.taught}. ` : ""}Each hour at a kind of work is an hour of skill at it, kept when they turn to another.`,
          ),
        );
      }
      // (Their character and mind, U4: what Character ▸ opened, here under their skills.)
      body.push(el("h3", "place-insp-sub place-insp-section", "Character"));
      const c = this.section(x.characterRef, "character");
      if (c) body.push(...this.characterEls(c, true));
      else body.push(el("p", "place-insp-why", "…"));
    } else if (this.tab === "health") {
      // (Their figure, each member not whole marked on it and named; then how they are, line by line.)
      const row = el("div", "place-insp-health-box"),
        canvas = el("canvas", "place-insp-figure");
      canvas.width = BODY_W;
      canvas.height = BODY_H;
      if (x.portrait?.kind === "person")
        drawBody(canvas, { type: "body", person: x.portrait, members: x.body }, BODY_W, BODY_H, {
          gore: "less",
          labels: false,
        });
      const marks = el("ul", "place-insp-marks");
      for (const m of x.body) marks.append(el("li", `mark-${m.state}`, `${m.words}: ${m.state}`));
      if (!x.body.length) marks.append(el("li", "", "Whole: no member hurt or marked"));
      row.append(canvas, marks);
      body.push(row, this.facts(x.healthRows.map(([a, b]) => [a, b, null] as const)));
      // (Their body, what it is made of and written in, U4: what Body ▸ opened, here under their health.)
      body.push(el("h3", "place-insp-sub place-insp-section", "Body"));
      const b = this.section(x.bodyRef, "body");
      if (b) body.push(...this.bodyEls(b));
      else body.push(el("p", "place-insp-why", "…"));
    } else if (this.tab === "social") {
      // (Their family, U4: what Family ▸ opened, here: each of their kin a tap away, their household, then the web of
      // whom they know. Till their family is read, their nearest kin and household as their own reading has them.)
      body.push(el("h3", "place-insp-sub place-insp-section", "Family"));
      const f = this.section(x.familyRef, "family");
      if (f) body.push(...this.familyEls(f));
      else {
        const named: PlaceNamed[] = [
          ...(x.mate ? [x.mate] : []),
          ...x.household.filter((h) => h.id !== x.mate?.id),
        ];
        if (x.kin.length) body.push(this.kinRows(x.kin));
        if (named.length) body.push(this.people(named));
        if (!x.kin.length && !named.length)
          body.push(
            el("p", "place-insp-why", "No kin of theirs in the town, and no one lives with them."),
          );
      }
      body.push(el("h3", "place-insp-sub place-insp-section", "Whom they know"));
      if (x.friend) body.push(this.people([x.friend]));
      body.push(el("p", "place-insp-why", x.tiesWords), el("p", "place-insp-why", x.repute));
      if (x.ties.length) body.push(this.webOf(x));
      if (x.ties.length) {
        const list = this.people(
          x.ties.map((t) => ({ ...t, words: t.why ? `${t.words}: ${t.why}` : t.words })),
        );
        // (Each marked by what they think of them: warm to cold.)
        x.ties.forEach((t, k) =>
          list.children[k]?.classList.add(
            t.regard >= 25 ? "tie-friend" : t.regard <= -30 ? "tie-rival" : "tie-known",
          ),
        );
        body.push(list);
      }
    } else if (this.tab === "gear") {
      // (Each thing in its slot, how worn and whether it still serves; then all they hold by its stuff: R3.)
      const inv = x.inventory;
      if (inv.slots.length) {
        const slots = el("div", "place-insp-slots");
        for (const t of inv.slots) {
          const row = el(
              t.ref ? "button" : "div",
              `place-insp-slot place-slot-${t.state.replace(" ", "-")}`,
            ),
            bar = el("span", "place-insp-wear"),
            fill = el("span", "place-insp-wear-fill");
          fill.style.width = `${t.wear}%`;
          bar.append(fill);
          row.append(
            el("span", "place-insp-slot-name", `${t.icon} ${t.slot}`),
            el("span", "place-insp-slot-what", `${cap(t.name)} · ${t.state}, ${t.wear}% worn`),
            bar,
          );
          if (t.ref) (row as HTMLButtonElement).onclick = () => this.onInspect(t.ref!);
          slots.append(row);
        }
        body.push(
          el("h3", "place-insp-sub", "In their slots"),
          el(
            "p",
            "place-insp-key-line place-insp-wear-key",
            "Worn: 0% new, 100% worn out and of no more use.",
          ),
          slots,
        );
      }
      if (inv.materials.length) {
        const list = el("div", "place-insp-stuffs");
        for (const m of inv.materials) {
          const sw = el("span", "place-insp-stuff-swatch");
          sw.style.background = m.colour;
          list.append(
            sw,
            el("span", "place-insp-stuff-name", cap(m.name)),
            el(
              "span",
              "place-insp-stuff-kg",
              `${m.kg < 10 ? m.kg.toFixed(2) : Math.round(m.kg)} kg`,
            ),
          );
        }
        body.push(
          el(
            "h3",
            "place-insp-sub",
            `By what it is made of: ${inv.kg < 10 ? inv.kg.toFixed(1) : Math.round(inv.kg)} kg in all`,
          ),
          list,
        );
      }
      body.push(this.facts(x.gear));
    } else if (this.tab === "life") {
      // (Their kin are on Social with the rest of their family, U4.)
      if (!x.life.length)
        body.push(
          el("p", "place-insp-why", "Nothing has befallen them since the town was entered."),
        );
      if (x.life.length) {
        const list = el("ul", "place-insp-life");
        for (const line of x.life) list.append(el("li", "", line));
        body.push(el("h3", "place-insp-sub", "Since the town was entered"), list);
      }
    } else {
      body.push(
        this.facts([
          ["Trade", `${cap(x.trade)}${x.bound ? `; held by order: ${x.bound}` : ""}`, null],
          ...(x.skill ? [["Skill", x.skill, null] as const] : []),
          ...(x.mark ? [["Bears", x.mark, null] as const] : []),
        ]),
      );
      if (x.skillWords) body.push(el("p", "place-insp-why", x.skillWords));
      // Their day: each hour of today, at work, at play or at home, and the hours marked under it.
      const strip = el("div", "place-insp-day");
      x.day.forEach((d, h) => {
        const cell = el("span", `pday-${d}`);
        cell.title = `${h}:00 ${d === "work" ? "at work" : d === "play" ? "at play" : "at home"}`;
        strip.append(cell);
      });
      const marks = el("div", "place-insp-day-marks");
      for (const h of [0, 6, 12, 18, 24]) marks.append(el("span", "", `${h}`));
      const key = el("div", "place-insp-day-key");
      for (const [k, w] of [
        ["work", "Work"],
        ["play", "Play"],
        ["home", "Home, asleep or at rest"],
      ] as const)
        key.append(el("span", `pday-${k}`, ""), el("span", "", w));
      body.push(el("h3", "place-insp-sub", "Their day"), strip, marks, key);
      body.push(this.facts(x.dayRows.map(([a, b]) => [a, b, null] as const)));
    }
    if (this.prose) {
      const box = el("div", "place-insp-prose");
      for (const line of [...x.prose, x.temperWords]) box.append(el("p", "", line));
      body.push(box);
    }
    this.body.replaceChildren(...body);
  }

  /** A person's tabs, one row (U3): a tap opens one, the inspector raised from a peek to half the screen. */
  private tabRow(): HTMLElement {
    const tabs = el("div", "place-insp-tabs");
    for (const [t, words] of PERSON_TABS) {
      const b = el("button", "place-insp-tab", words);
      b.dataset.tab = t;
      b.classList.toggle("on", this.tab === t);
      b.setAttribute("aria-pressed", String(this.tab === t));
      b.onclick = () => this.toTab(t);
      tabs.append(b);
    }
    return tabs;
  }
  private toTab(t: PersonTab): void {
    this.tab = t;
    this.onTabbed(t);
    if (this.height === "peek") this.setHeight("half");
    this.redraw();
    this.body.scrollTop = 0;
  }

  /** The town's own pages listed (U3): each a row, a tap away; Back comes here again. */
  private townPages(x: PlaceInspectTown): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    if (this.sub.textContent !== x.sub) this.sub.textContent = x.sub;
    const box = el("div", "place-insp-people place-town-pages");
    for (const p of x.pages) {
      const b = el("button", "place-insp-person place-town-row");
      b.dataset.ref = p.ref;
      b.append(
        el("span", "place-row-name", `${p.icon} ${p.name} ▸`),
        el("span", "place-row-what", p.words),
      );
      b.onclick = () => this.onInspect(p.ref);
      box.append(b);
    }
    this.body.replaceChildren(box);
  }

  /** Inside a lot (O3): its plan on its tiles, who is here and what stands here. Back goes to the lot's page. */
  private inside(x: PlaceInspectInside): void {
    this.picture(x);
    const title = `${x.icon} Inside ${x.name.replace(/^The /, "the ")}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    this.sub.textContent = `${x.rooms.length} ${x.rooms.length === 1 ? "room" : "rooms"} · ${x.people.length} here now`;
    this.body.replaceChildren(...insideEl(x, (ref) => this.onInspect(ref)));
  }

  /** A work of the town on its own page (O9): what, how fine, kept where, by whom, what it shows, who sees it. */
  private work(x: PlaceInspectWork): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    this.sub.textContent = `${x.quality.charAt(0).toUpperCase()}${x.quality.slice(1)} · kept at ${x.kept.replace(/^The /, "the ")}`;
    this.body.replaceChildren(
      this.facts([
        ["Shows", x.shows, x.whom?.ref ?? null],
        ["Made by", x.maker.name, x.maker.ref],
        ["Made", x.made, null],
        ["Kept at", x.kept, x.lotRef],
        [
          "Seen by",
          x.seenBy
            ? `${x.seenBy} ${x.seenBy === 1 ? "household" : "households"}`
            : "None as their finest",
          null,
        ],
      ]),
      el("p", "place-insp-why", x.words),
    );
  }
  /** A town's faith and rank (P7): its faith and ways; its shrines and hall, each a key; those of rank, each a key. */
  private faith(x: PlaceInspectFaith): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    this.sub.textContent = `${x.shrines.length} ${x.shrines.length === 1 ? "shrine" : "shrines"} · ${x.hall ? "a hall" : "no hall"} · ${x.ranked.length} of rank`;
    const body: HTMLElement[] = [
      el("p", "place-insp-why", x.faith),
      el("p", "place-insp-why", x.ways),
      el("p", "place-insp-why place-insp-rite", x.riteWords),
    ];
    const keys = (
      rows: readonly { name: string; ref: string; words?: string }[],
      label: string,
    ) => {
      if (!rows.length) return;
      const box = el("div", "place-insp-people");
      for (const r of rows) {
        const b = el("button", "place-insp-person place-faith-row");
        b.append(el("span", "place-row-name", r.name));
        if (r.words) b.append(el("span", "place-row-what", r.words));
        b.onclick = () => this.onInspect(r.ref);
        box.append(b);
      }
      body.push(el("p", "place-insp-label", label), box);
    };
    keys(x.shrines, "Its shrines and temples");
    body.push(el("p", "place-insp-why place-insp-rank", x.rankWords));
    if (x.hall) keys([x.hall], "Its hall");
    keys(x.ranked, "Of rank");
    body.push(el("p", "place-insp-why", x.words));
    this.body.replaceChildren(...body);
  }
  /** The bound of a town (P6): its land's bondage by kind, captives, those its justice holds, each of its bound a key. */
  private bound(x: PlaceInspectBound): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    this.sub.textContent = `${x.people.length} bound named · ${x.held} held by its justice${x.freed ? ` · ${x.freed} freed` : ""}`;
    const body: HTMLElement[] = [el("p", "place-insp-why", x.words)];
    if (x.kinds.length)
      body.push(
        el("p", "place-insp-label", "Its land's bondage"),
        this.facts(
          x.kinds.map(
            (k) => [k.name, `${k.here} here · ${k.words}`, null] as [string, string, null],
          ),
        ),
      );
    if (x.captives) body.push(el("p", "place-insp-why", x.captives));
    if (x.people.length) {
      const box = el("div", "place-insp-people");
      for (const r of x.people) {
        const b = el("button", "place-insp-person place-bound-row");
        b.append(el("span", "place-row-name", r.name), el("span", "place-row-what", r.words));
        b.onclick = () => this.onInspect(r.ref);
        box.append(b);
      }
      body.push(el("p", "place-insp-label", "Its bound"), box);
    }
    this.body.replaceChildren(...body);
  }
  /** One's family in the town (P3): each of their kin a key while of the town; a pairing to come said. */
  private family(x: PlaceInspectFamily): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    // (Its kin in the town counted by the host's one reader of kinship, the Social tab's rows' too: U2.)
    this.sub.textContent = `${x.children.length} ${x.children.length === 1 ? "child" : "children"} · ${x.inTown} kin in the town · ${x.household.length} in their home`;
    this.body.replaceChildren(...this.familyEls(x));
  }
  /** One's family, row by row (P3): on its own page, and on their Social tab (U4). */
  private familyEls(x: PlaceInspectFamily): HTMLElement[] {
    const body: HTMLElement[] = [el("p", "place-insp-why", x.words)],
      rows = (
        label: string,
        list: readonly { name: string; ref: string | null; words: string }[],
      ) => {
        if (!list.length) return;
        const box = el("div", "place-insp-people place-insp-kinship");
        for (const r of list) {
          const b = el(r.ref ? "button" : "div", "place-insp-person place-family-row");
          b.append(el("span", "place-row-name", r.name), el("span", "place-row-what", r.words));
          if (r.ref) (b as HTMLButtonElement).onclick = () => this.onInspect(r.ref!);
          box.append(b);
        }
        body.push(el("p", "place-insp-label", label), box);
      };
    rows("Parents", x.parents);
    rows("Grandparents", x.grandparents);
    if (x.mate) rows(x.promised ? "Promised to (courting)" : "Paired with", [x.mate]);
    rows("Brothers and sisters", x.siblings);
    rows("Children", x.children);
    rows("Grandchildren", x.grandchildren);
    rows("Their household", x.household);
    return body;
  }
  /** Kin or those known, each a key to their page where they have one (the living's, or one of the dead kept so). */
  private kinRows(
    list: readonly { name: string; ref: string | null; words: string }[],
  ): HTMLElement {
    const box = el("div", "place-insp-people place-insp-kin");
    for (const r of list) {
      const b = el(r.ref ? "button" : "div", "place-insp-person place-family-row");
      b.append(el("span", "place-row-name", r.name), el("span", "place-row-what", r.words));
      if (r.ref) (b as HTMLButtonElement).onclick = () => this.onInspect(r.ref!);
      box.append(b);
    }
    return box;
  }
  /** One's character and mind (R2): traits as tags with what each does, best skills, wants; drive, leanings, learning, senses. */
  private character(x: PlaceInspectCharacter): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    const sub = `${x.traits.length} ${x.traits.length === 1 ? "trait" : "traits"} · ${x.skills.length ? x.skills[0]!.name.toLowerCase() : "no skill yet"}`;
    if (this.sub.textContent !== sub) this.sub.textContent = sub;
    this.body.replaceChildren(
      el("h3", "place-insp-sub", "Character"),
      ...this.characterEls(x, false),
    );
  }
  /**
   * One's character and mind (R2), on its own page and under their Skills tab (U4: there their skills are listed just
   * above, so not again as "Best at").
   */
  private characterEls(x: PlaceInspectCharacter, inTab: boolean): HTMLElement[] {
    const body: HTMLElement[] = [];
    if (x.traits.length) {
      const tags = el("div", "place-insp-traits");
      for (const t of x.traits) {
        const tag = el("span", `place-insp-trait place-trait-${t.of}`, t.tag);
        tag.title = t.meaning;
        tags.append(tag);
      }
      body.push(tags);
      const list = el("ul", "place-insp-life place-insp-trait-means");
      for (const t of x.traits) list.append(el("li", "", `${cap(t.tag)}: ${t.meaning}.`));
      body.push(list);
    } else body.push(el("p", "place-insp-why", "Much as most of their people, in every way."));
    body.push(
      this.facts([
        ...(inTab
          ? []
          : [
              [
                "Best at",
                x.skills.length
                  ? x.skills
                      .map((s) => `${s.name} (${s.words}${s.passion ? ", a passion" : ""})`)
                      .join("; ")
                  : "Nothing yet",
                null,
              ] as const,
            ]),
        ["Wants", x.want, null],
        ...(x.since ? [["In want", x.since, null] as const] : []),
      ]),
    );
    if (x.fulfilled.length) {
      body.push(el("p", "place-insp-label", "What they have come to"));
      const list = el("ul", "place-insp-life");
      for (const line of x.fulfilled) list.append(el("li", "", line));
      body.push(list);
    }
    body.push(
      el("h3", "place-insp-sub", "Mind"),
      el("p", "place-insp-why", `Driven by ${x.drive}.`),
      // (Their leanings' scale, U4: each against most of their people.)
      el(
        "p",
        "place-insp-key-line place-insp-leanings-key",
        "Leanings, each against most of their people: 100 is as most are, more is stronger.",
      ),
    );
    const bars = el("div", "place-insp-leanings");
    for (const l of x.leanings) {
      const row = el("div", "place-insp-leaning"),
        bar = el("span", "place-insp-leaning-bar"),
        fill = el("span", "place-insp-leaning-fill");
      fill.style.width = `${Math.max(0, Math.min(100, l.value / 1.5))}%`;
      bar.append(fill);
      row.append(
        el("span", "place-insp-leaning-name", l.name),
        bar,
        el("span", "place-insp-leaning-words", `${l.words} (${l.value})`),
      );
      bars.append(row);
    }
    body.push(bars);
    if (x.learning.length) {
      body.push(el("p", "place-insp-label", "How they learn"));
      const list = el("ul", "place-insp-life");
      for (const line of x.learning) list.append(el("li", "", line));
      body.push(list);
    }
    body.push(
      el("p", "place-insp-label", "Their senses"),
      this.facts(x.senses.map((s) => [s.name, s.words, null] as const)),
    );
    return body;
  }
  /** What now? (G3): each thing worth doing, what to do, and its Go to, its page, its sheet. */
  private whatNow(x: PlaceInspectWhatNow): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    if (this.sub.textContent !== x.sub) this.sub.textContent = x.sub;
    const list = el("div", "place-tips");
    for (const t of x.tips) {
      const row = el("div", "place-tip"),
        keys = el("div", "place-tip-keys");
      row.append(
        el("p", "place-tip-words", `${t.icon} ${t.words}`),
        el("p", "place-insp-why", t.how),
      );
      if (t.go) {
        const go = t.go,
          b = el("button", "place-tip-go", "🎯 Go to");
        b.setAttribute("aria-label", `Go to it: ${t.words}`);
        b.onclick = () => this.onGoFor(go);
        keys.append(b);
      }
      if (t.ref) {
        const ref = t.ref,
          b = el("button", "place-tip-open", "Open ▸");
        b.setAttribute("aria-label", `Open its page: ${t.words}`);
        b.onclick = () => this.onInspect(ref);
        keys.append(b);
      }
      if (t.sheet) {
        const sheet = t.sheet,
          b = el(
            "button",
            "place-tip-sheet",
            `${sheet.charAt(0).toUpperCase()}${sheet.slice(1)} ▸`,
          );
        b.setAttribute("aria-label", `Open the ${sheet} sheet`);
        b.onclick = () => this.onSheet(sheet);
        keys.append(b);
      }
      row.append(keys);
      list.append(row);
    }
    this.body.replaceChildren(list);
  }
  /**
   * What a sheet, a tab or a page is, in plain words (G2). The glossary (U6): the game's words, the one it was opened at
   * brought into view. At the foot of every help page but the glossary, the few words it uses and the glossary a tap
   * away, opened as a page of the inspector's, so Back comes here again.
   */
  private help(x: PlaceInspectHelp): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    if (this.sub.textContent !== x.sub) this.sub.textContent = x.sub;
    const body: HTMLElement[] = [el("p", "place-insp-why place-help-what", x.what)];
    if (x.words) {
      const words = glossaryEl(x.words, x.lit ?? null);
      body.push(words);
      if (x.can.length) body.push(el("p", "place-insp-why", x.can.join(" ")));
      this.body.replaceChildren(...body);
      const lit = words.querySelector<HTMLElement>(".place-glossary-word.lit");
      if (lit) requestAnimationFrame(() => lit.scrollIntoView({ block: "start" }));
      return;
    }
    if (x.numbers.length) {
      body.push(el("h3", "place-insp-sub", "What the numbers mean"));
      body.push(this.facts(x.numbers.map(([a, b]) => [a, b, null] as const)));
    }
    if (x.can.length) {
      body.push(el("h3", "place-insp-sub", "What you can do here"));
      const list = el("ul", "place-insp-life");
      for (const c of x.can) list.append(el("li", "", c));
      body.push(list);
    }
    body.push(helpFootEl(x.glossed ?? [], (topic) => this.onHelp(topic)));
    this.body.replaceChildren(...body);
  }
  /** A town's beasts and power (R9): its flock and the wild of its land off its plan; its keepers; what drives its works. */
  private beasts(x: PlaceInspectBeasts): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    if (this.sub.textContent !== x.sub) this.sub.textContent = x.sub;
    const fauna = this.plan()?.fauna,
      body: HTMLElement[] = [el("h3", "place-insp-sub", "Its flock")];
    body.push(
      el(
        "p",
        "place-insp-why",
        fauna?.flock
          ? `${fauna.flock.size} head of ${fauna.flock.name}${fauna.flock.wool ? ", kept for their wool and their meat" : ""}, kept by ${fauna.flock.herders} of it${fauna.raided ? "; its land's hunters raid them" : ""}.`
          : "It keeps no flock.",
      ),
    );
    if (fauna?.wild.length) {
      body.push(el("p", "place-insp-label", "Wild in its land, that could be kept"));
      body.push(
        this.facts(
          fauna.wild
            .slice(0, 6)
            .map(
              (w) =>
                [
                  w.name,
                  `${w.niche}; ${Math.round(w.stock * 100)}% of what its land first held`,
                  w.ref,
                ] as const,
            ),
        ),
      );
    }
    body.push(el("h3", "place-insp-sub", "Its keepers, by how well trained"));
    if (x.keepers.length)
      body.push(
        this.facts(
          x.keepers.map(
            (k) =>
              [
                k.name,
                `${k.words} · ${k.hours.toLocaleString("en-US")} h at the herds`,
                k.ref,
              ] as const,
          ),
        ),
      );
    else body.push(el("p", "place-insp-why", "None of it keeps beasts."));
    if (x.more) body.push(el("p", "place-insp-why", `And ${x.more} more.`));
    if (x.carry.length) body.push(el("p", "place-insp-why", `${x.carry.join("; ")}.`));
    body.push(el("h3", "place-insp-sub", "What drives its works"));
    const list = el("div", "place-insp-power");
    for (const r of x.power) {
      const row = el("div", `place-insp-rung${r.on ? " on" : ""}`);
      row.append(
        el("span", "place-insp-label", `${r.on ? "●" : "○"} ${r.rung}`),
        el("span", "place-insp-fact", r.words),
      );
      list.append(row);
    }
    body.push(list);
    this.body.replaceChildren(...body);
  }
  /** The town's ground, level by level (R8): stepped up and down, each drawn from above and told. */
  private levels(x: PlaceInspectLevels): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    if (this.sub.textContent !== x.sub) this.sub.textContent = x.sub;
    if (this.levelOf !== x.ref) {
      this.levelOf = x.ref;
      this.level = 0;
    }
    this.body.replaceChildren(
      ...levelsEl(
        x,
        this.level,
        this.plan(),
        (lot) => this.lotAt(lot),
        (k) => {
          this.level = Math.max(0, Math.min(x.levels.length - 1, k));
          this.levels(x);
        },
        (g) => this.onGo(g),
      ),
    );
  }
  /** Why one does what they do (R7): each step, the page it opens, and where the eye can go for it. */
  private whyPage(x: PlaceInspectWhy): void {
    this.picture(x);
    const title = `${x.icon} Why: ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    if (this.sub.textContent !== x.sub) this.sub.textContent = x.sub;
    const list = el("div", "place-insp-whys");
    for (const s of x.steps) {
      const row = el("div", "place-insp-whystep");
      row.append(el("span", "place-insp-label", s.label));
      const words = el(
        s.ref ? "button" : "span",
        s.ref ? "place-link place-insp-whywords" : "place-insp-fact place-insp-whywords",
        s.words,
      );
      if (s.ref) {
        const ref = s.ref;
        words.dataset.ref = ref;
        words.onclick = () => this.onInspect(ref);
      }
      row.append(words);
      if (s.go) {
        const go = s.go,
          k = captioned(el("button", "place-insp-go"), go.lot !== null ? "📍" : "🎯", "Go to");
        k.title = go.lot !== null ? "Go there" : `Go to ${x.name}`;
        k.setAttribute("aria-label", k.title);
        k.onclick = () => this.onGo(go);
        row.append(k);
      }
      list.append(row);
    }
    const back = el("button", "place-insp-order place-insp-whyback", `${x.name}'s page ▸`);
    back.onclick = () => this.onInspect(x.personRef);
    this.body.replaceChildren(list, back);
  }
  /** A town's works and orders (R6): what is going up, what its land may find next, its standing orders. */
  private civic(x: PlaceInspectCivic): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    if (this.sub.textContent !== x.sub) this.sub.textContent = x.sub;
    const body: HTMLElement[] = [el("h3", "place-insp-sub", "Going up")];
    if (x.sites.length) {
      const list = el("div", "place-insp-slots");
      for (const s of x.sites) {
        const row = el("button", "place-insp-slot place-insp-site"),
          bar = el("span", "place-insp-wear"),
          fill = el("span", "place-insp-wear-fill");
        fill.style.width = `${s.share}%`;
        bar.append(fill);
        row.append(
          el("span", "place-insp-slot-name", s.name),
          el("span", "place-insp-slot-what", `${s.share}% · ${s.words}`),
          bar,
        );
        row.onclick = () => this.onInspect(s.ref);
        list.append(row);
      }
      body.push(list);
    } else
      body.push(
        el("p", "place-insp-why", "Nothing is going up: Build lists what could be raised."),
      );
    body.push(el("h3", "place-insp-sub", "What its land may find next"));
    if (x.findable.length)
      body.push(this.facts(x.findable.map((f) => [f.name, f.words, null] as const)));
    else body.push(el("p", "place-insp-why", "Nothing, as its land's lore stands now."));
    if (x.known.length) {
      body.push(el("p", "place-insp-label", "Came to know last"));
      const list = el("ul", "place-insp-life");
      for (const k of x.known) list.append(el("li", "", k));
      body.push(list);
    }
    body.push(el("p", "place-insp-why", x.learned));
    body.push(el("h3", "place-insp-sub", "Its standing orders"));
    if (x.orders.length) body.push(this.facts(x.orders.map(([a, b]) => [a, b, null] as const)));
    else body.push(el("p", "place-insp-why", "None given: it runs as its land runs it."));
    this.body.replaceChildren(...body);
  }
  /** What the town lives on (R5): its stuffs, its making today, water, fuel, poisons, what it is short of, how steady. */
  private making(x: PlaceInspectMaking): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    if (this.sub.textContent !== x.sub) this.sub.textContent = x.sub;
    const body: HTMLElement[] = [];
    if (x.vulnerable.length) {
      body.push(el("h3", "place-insp-sub", "What it is short of, or what bears on it"));
      body.push(this.facts(x.vulnerable.map((v) => [v.name, v.words, v.ref] as const)));
    } else
      body.push(
        el("p", "place-insp-why", "Nothing it is short of, and nothing bearing on it now."),
      );
    body.push(
      el("h3", "place-insp-sub", `How steady: ${x.steady}`),
      this.facts(x.stability.map(([a, b]) => [a, b, null] as const)),
    );
    const list = el("div", "place-insp-stuffs");
    for (const m of x.stuffs) {
      const sw = el("span", "place-insp-stuff-swatch");
      sw.style.background = m.colour;
      list.append(
        sw,
        el("span", "place-insp-stuff-name", m.name),
        el("span", "place-insp-stuff-kg", `${m.kg.toLocaleString("en-US")} kg`),
      );
    }
    if (x.rest > 0)
      list.append(
        el("span", ""),
        el("span", "place-insp-stuff-name", "The rest"),
        el("span", "place-insp-stuff-kg", `${x.rest.toLocaleString("en-US")} kg`),
      );
    body.push(el("h3", "place-insp-sub", "All it holds, by its stuff"), list);
    if (x.making.length) {
      body.push(el("h3", "place-insp-sub", "Made and used today"));
      body.push(
        this.facts(
          x.making.map(
            (m) =>
              [
                m.name,
                `made ${m.made}, used ${m.used}${m.came ? `, ${m.came} brought in` : ""}`,
                null,
              ] as const,
          ),
        ),
      );
    }
    body.push(
      el("h3", "place-insp-sub", "Water, fuel and poisons"),
      this.facts([
        ["Water", x.water, null],
        ...x.fuel.map((f) => ["Fuel", f, null] as const),
        ["Poisons", x.poisons, null],
      ]),
    );
    this.body.replaceChildren(...body);
  }
  /** One's body (R4): what it is made of, how it lives, and what it is written in. */
  private bodyPage(x: PlaceInspectBody): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    if (this.sub.textContent !== x.sub) this.sub.textContent = x.sub;
    this.body.replaceChildren(...this.bodyEls(x));
  }
  /** One's body (R4): on its own page, and under their Health tab (U4). */
  private bodyEls(x: PlaceInspectBody): HTMLElement[] {
    const made = el("div", "place-insp-stuffs place-insp-madeof");
    for (const m of x.madeOf) {
      const share = el("span", "place-insp-stuff-kg", `${m.share}%`);
      const what = el("span", "place-insp-stuff-name", `${m.what} · ${m.kg} kg`);
      what.title = m.words;
      made.append(share, what);
    }
    return [
      el("p", "place-insp-why", `${x.body}.`),
      el("p", "place-insp-label", "What their body is made of (est.): share of their weight"),
      made,
      el("p", "place-insp-label", "How it lives"),
      this.facts(x.metabolism.map(([a, b]) => [a, b, null] as const)),
      el("p", "place-insp-label", "What it is written in"),
      this.facts(x.genome.map(([a, b]) => [a, b, null] as const)),
    ];
  }
  /**
   * A page of theirs for a tab's section (U4), as last read: asked when the tab first shows it and again when it is
   * older than SECTION_EVERY, the tab drawn anew when it comes back changed. Null till it is read.
   */
  private section<K extends PlaceInspect["kind"]>(
    ref: string,
    kind: K,
  ): Extract<PlaceInspect, { kind: K }> | null {
    let s = this.sections.get(ref);
    if (!s) {
      s = { x: null, at: -Infinity, asking: false };
      this.sections.set(ref, s);
    }
    const e = s;
    if (!e.asking && performance.now() - e.at > SECTION_EVERY) {
      e.asking = true;
      this.read(ref).then(
        (x) => {
          e.asking = false;
          e.at = performance.now();
          const next = x && !("error" in x) ? x : null,
            changed = JSON.stringify(next) !== JSON.stringify(e.x);
          e.x = next;
          // (Drawn anew only while it is theirs still: another opened since has cleared it.)
          if (changed && this.sections.get(ref) === e && this.now) {
            this.drawn = "";
            this.show(this.now);
          }
        },
        () => {
          e.asking = false;
          e.at = performance.now();
        },
      );
    }
    return e.x?.kind === kind ? (e.x as Extract<PlaceInspect, { kind: K }>) : null;
  }
  /** One of the town's dead (R1): what took them, their life in short, their kin and those they knew, their last memories. */
  private dead(x: PlaceInspectDead): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    if (this.sub.textContent !== x.sub) this.sub.textContent = x.sub;
    const body: HTMLElement[] = [el("p", "place-insp-why place-insp-death", x.death)],
      life = el("ul", "place-insp-life");
    for (const line of x.life) life.append(el("li", "", line));
    body.push(life);
    if (x.kin.length) body.push(el("p", "place-insp-label", "Their kin"), this.kinRows(x.kin));
    if (x.knew.length)
      body.push(el("p", "place-insp-label", "Those they knew"), this.kinRows(x.knew));
    if (x.memories.length) {
      body.push(el("p", "place-insp-label", "What they carried in mind at the end"));
      const list = el("ul", "place-insp-life place-insp-memories");
      for (const m of x.memories)
        list.append(el("li", "", `${m.icon} ${m.words} (${m.size > 0 ? "+" : ""}${m.size})`));
      body.push(list);
    } else body.push(el("p", "place-insp-why", "No memory weighed on them at the end."));
    this.body.replaceChildren(...body);
  }
  /** A town's gate (P2): who came and who comes, each a key to what sent them; its order, shut to newcomers or open. */
  private gate(x: PlaceInspectGate): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    const came = x.arrivals.filter((a) => a.past).length;
    this.sub.textContent = `${came} come lately · ${x.arrivals.length - came} to come · ${x.shut ? "shut to newcomers" : "open"}`;
    const body: HTMLElement[] = [el("p", "place-insp-why", x.words)];
    if (this.orders) {
      const key = el(
        "button",
        "place-insp-order place-insp-gate-key",
        x.shut ? "Open the gate to newcomers" : "Shut the gate to newcomers",
      );
      key.setAttribute("aria-pressed", String(x.shut));
      key.onclick = () => this.onOrder("place.gate", { shut: x.shut ? null : true });
      body.push(key);
    }
    body.push(el("p", "place-insp-why", x.orderWords));
    for (const [label, rows] of [
      ["Come lately", x.arrivals.filter((a) => a.past)],
      ["To come", x.arrivals.filter((a) => !a.past)],
    ] as const) {
      if (!rows.length) continue;
      const box = el("div", "place-insp-people");
      for (const r of rows) {
        const b = el(r.ref ? "button" : "div", "place-insp-person place-gate-row");
        b.append(
          el("span", "place-row-name", `${r.icon} ${r.who}`),
          el("span", "place-row-what", `${r.when}: ${r.words}`),
        );
        if (r.ref) (b as HTMLButtonElement).onclick = () => this.onInspect(r.ref!);
        box.append(b);
      }
      body.push(el("p", "place-insp-label", label), box);
    }
    this.body.replaceChildren(...body);
  }
  /** A town's legends (O9): its works, its battles, the seldomest of what it keeps; each a key. */
  private legends(x: PlaceInspectLegends): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    this.sub.textContent = `${x.works.length} ${x.works.length === 1 ? "work" : "works"} · ${x.battles.length} ${x.battles.length === 1 ? "battle" : "battles"} · ${x.lines.length} told`;
    const body: HTMLElement[] = [el("p", "place-insp-why", x.words)],
      keys = (
        rows: readonly { name: string; words: string; ref: string | null }[],
        label: string,
        cls: string,
      ) => {
        if (!rows.length) return;
        const box = el("div", "place-insp-people");
        for (const r of rows) {
          const b = el(r.ref ? "button" : "div", `place-insp-person ${cls}`);
          b.append(el("span", "place-row-name", r.name), el("span", "place-row-what", r.words));
          if (r.ref) (b as HTMLButtonElement).onclick = () => this.onInspect(r.ref!);
          box.append(b);
        }
        body.push(el("p", "place-insp-label", label), box);
      };
    keys(
      x.lines.map((l) => ({ name: l.when, words: l.words, ref: l.ref })),
      "Told of it",
      "place-legend-line",
    );
    keys(x.works, "Its works", "place-legend-work");
    keys(
      x.battles.map((b) => ({ name: b.name, words: "Its men were there", ref: b.ref || null })),
      "Its battles",
      "place-legend-battle",
    );
    this.body.replaceChildren(...body);
  }
  /** What lies below the town and the water it draws (O8). */
  private below(x: PlaceInspectBelow): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    this.sub.textContent = [
      x.water
        ? `water at hand: ${x.water}`
        : x.wells
          ? `${x.wells} ${x.wells === 1 ? "well" : "wells"}`
          : "no water at hand",
      `${x.lodes.length} ${x.lodes.length === 1 ? "lode" : "lodes"} dug`,
    ].join(" · ");
    // (Its ground level by level, R8.)
    const levels = el(
      "button",
      "place-insp-order place-insp-levels",
      "Its ground, level by level ▸",
    );
    levels.setAttribute(
      "aria-label",
      "The town's ground one level at a time, and what is dug at each",
    );
    levels.onclick = () => this.onInspect(x.ref.replace(/^plcb:/, "plcz:"));
    this.body.replaceChildren(...belowEl(x), levels);
  }
  /** The town's fields and its flock (O6): laid off its plan, who is out in them now. */
  private fields(x: PlaceInspectFields): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    this.sub.textContent = `${x.fields} ${x.fields === 1 ? "field" : "fields"} · ${x.people.length + x.more} out in them now`;
    this.body.replaceChildren(...fieldsEl(x, this.plan(), (ref) => this.onInspect(ref)));
  }
  /** A thing one holds, on its own page (O5): of what, how fine, by whom, held by whom, how worn, what it is to them. */
  private item(x: PlaceInspectItem): void {
    this.picture(x);
    const title = `${x.icon} ${x.name}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    this.sub.textContent = `${x.grade.charAt(0).toUpperCase()}${x.grade.slice(1)} · ${x.stuff}`;
    // (Its wear, as a bar: what of its life is used; amber past three quarters, red worn out.)
    const wear = el("div", "place-insp-need place-insp-wear"),
      bar = el("div", "place-meter"),
      fill = el("span", "place-meter-fill");
    fill.style.width = `${Math.min(100, x.wear / 10)}%`;
    wear.classList.toggle("pressing", x.wear >= 750);
    bar.append(fill);
    wear.append(
      el("span", "place-insp-label", "Worn"),
      bar,
      el(
        "span",
        "place-insp-value",
        x.wear >= 1000 ? "Worn out" : `${Math.round(x.wear / 10)}%, ${x.daysLeft} days' use left`,
      ),
    );
    const vs = x.q - x.mid;
    this.body.replaceChildren(
      wear,
      this.facts([
        ["Of", x.stuff, null],
        [
          "Quality",
          `${x.q} of 100: ${vs >= 5 ? "finer than" : vs <= -5 ? "poorer than" : "as fine as"} the town's middling hands make (${x.mid})`,
          null,
        ],
        ["Made by", x.maker ? x.maker.name : "Bought in, from the market", x.maker?.ref ?? null],
        ["Made", x.made, null],
        ["Held by", x.holder.name, x.holder.ref],
        ["Where", x.where, null],
        ["For", x.use, null],
        [
          "To them",
          x.mood
            ? `${signed(x.mood)} to their mood while they hold it (${x.mood > 0 ? "a fine thing" : x.wear >= 1000 ? "worn out" : "a poor thing"})`
            : "Nothing to their mood: a thing like any other",
          null,
        ],
      ]),
    );
  }

  private lot(x: PlaceInspectLot): void {
    this.picture(x);
    const name = x.name.replace(/^The /, ""),
      title = `${x.icon} ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    if (this.title.textContent !== title) this.title.textContent = title;
    this.sub.textContent = [
      x.working ? `${x.working} work here` : null,
      x.living ? `${x.living} live here` : null,
      `${x.here} here now`,
      x.years !== null ? `${x.years} ${x.years === 1 ? "year" : "years"} standing` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const body: HTMLElement[] = [];
    if (x.words) body.push(el("p", "place-insp-now", x.words));
    // (Inside it, O3: its rooms on its tiles, who is here, what stands here.)
    // (Its fields, O6: laid off its plan, who is out in them.)
    const fields = x.lot === -2;
    if ((x.lot >= 0 || fields) && x.ref.startsWith("plcl:")) {
      const go = el(
        "button",
        "place-insp-order place-insp-inside",
        fields ? "Out in the fields ▸" : "Inside ▸",
      );
      go.setAttribute(
        "aria-label",
        fields ? "Look over the fields and the flock" : `Look inside ${x.name}`,
      );
      go.onclick = () => this.onInspect(x.ref.replace(/^plcl:/, "plci:"));
      body.push(go);
    }
    if (x.site) {
      const bar = el("div", "place-insp-site"),
        fill = el("span", "place-insp-site-fill");
      fill.style.width = `${Math.round(x.site.share * 100)}%`;
      bar.append(fill);
      body.push(
        el(
          "p",
          "place-insp-why",
          `Going up: ${Math.round(x.site.share * 100)}%, ${x.site.stage}; ${x.site.hands} hands`,
        ),
        bar,
      );
    }
    if (x.shut !== null && this.orders) {
      const key = el(
        "button",
        "place-insp-order",
        x.shut ? "Stopped ○  tap to start" : "Working ●  tap to stop",
      );
      key.classList.toggle("on", !x.shut);
      key.setAttribute(
        "aria-label",
        `${x.name}: its work is ${x.shut ? "stopped. Tap to let it go on" : "going. Tap to stop it"}`,
      );
      key.onclick = () => this.onOrder("place.shut", { lot: x.lot, on: !x.shut });
      body.push(key);
    }
    // (Its zone by your order, O2: a meeting place, kept clear, or neither.)
    if (x.lot >= 0 && this.orders) {
      const row = el("div", "place-insp-orders place-insp-zones");
      for (const [zone, words, says] of [
        [null, "No zone", "no zone"],
        [
          "meet",
          "Meeting place",
          "a meeting place, where those near it come for company and games",
        ],
        ["clear", "Keep clear", "kept clear, gone to by no one but to a fire"],
      ] as const) {
        if (zone === "clear" && !x.clearable) continue;
        const b = el("button", "place-chip", words);
        b.classList.toggle("on", x.zone === zone);
        b.setAttribute("aria-pressed", String(x.zone === zone));
        b.setAttribute("aria-label", `Make ${x.name} ${says}`);
        b.onclick = () => this.onOrder("place.zone", { lot: x.lot, zone });
        row.append(b);
      }
      body.push(row);
    }
    // (Below the town and its water, O8: from its square's page.)
    if (x.lot === -3 && x.ref.startsWith("plcl:")) {
      const down = el("button", "place-insp-order place-insp-below", "Below ground ▸");
      down.setAttribute("aria-label", "What lies below the town, and the water it draws");
      down.onclick = () => this.onInspect(x.ref.replace(/^plcl:(.*):\d+$/, "plcb:$1"));
      body.push(down);
      // (Its legends, O9.)
      const told = el("button", "place-insp-order place-insp-legends", "Its legends ▸");
      told.setAttribute(
        "aria-label",
        "The town's legends: its works, its battles, the seldomest of what befell it",
      );
      told.onclick = () => this.onInspect(x.ref.replace(/^plcl:(.*):\d+$/, "plcy:$1"));
      body.push(told);
      // (Its gate, P2.)
      const gate = el("button", "place-insp-order place-insp-gate", "At the gate ▸");
      gate.setAttribute("aria-label", "Who has come to the town's gate, and who comes");
      gate.onclick = () => this.onInspect(x.ref.replace(/^plcl:(.*):\d+$/, "plca:$1"));
      body.push(gate);
      // (Its bound, P6.)
      const bound = el("button", "place-insp-order place-insp-bound", "The bound ▸");
      bound.setAttribute(
        "aria-label",
        "The town's bound, its captives and those its justice holds",
      );
      bound.onclick = () => this.onInspect(x.ref.replace(/^plcl:(.*):\d+$/, "plcd:$1"));
      body.push(bound);
      // (Its faith and rank, P7.)
      const faith = el("button", "place-insp-order place-insp-faith", "Faith and rank ▸");
      faith.setAttribute("aria-label", "The town's faith, its shrines, and those of rank");
      faith.onclick = () => this.onInspect(x.ref.replace(/^plcl:(.*):\d+$/, "plcr:$1"));
      body.push(faith);
      // (What it lives on, R5.)
      const making = el("button", "place-insp-order place-insp-making", "What it lives on ▸");
      making.setAttribute(
        "aria-label",
        "What the town holds by its stuff, makes, drinks and burns, and what it is short of",
      );
      making.onclick = () => this.onInspect(x.ref.replace(/^plcl:(.*):\d+$/, "plcs:$1"));
      body.push(making);
      // (Its works and orders, R6.)
      const civic = el("button", "place-insp-order place-insp-civic", "Its works and orders ▸");
      civic.setAttribute(
        "aria-label",
        "What the town is raising, what its land may find next, and its standing orders",
      );
      civic.onclick = () => this.onInspect(x.ref.replace(/^plcl:(.*):\d+$/, "plcv:$1"));
      body.push(civic);
      // (Its beasts and power, R9.)
      const beasts = el("button", "place-insp-order place-insp-beasts", "Beasts and power ▸");
      beasts.setAttribute(
        "aria-label",
        "Who keeps the town's flock, what pulls for it, and what drives its works",
      );
      beasts.onclick = () => this.onInspect(x.ref.replace(/^plcl:(.*):\d+$/, "plcx:$1"));
      body.push(beasts);
    }
    if (x.zoneWords) body.push(el("p", "place-insp-why", x.zoneWords));
    // (The guard's post by your order, O7: those standing to arms keep it, watching the homes within a cry of it.)
    if (x.postable && this.orders) {
      const b = el(
        "button",
        "place-chip place-insp-post",
        x.post ? "🛡️ Move the guard back to the square" : "🛡️ Post the guard here",
      );
      b.classList.toggle("on", x.post);
      b.setAttribute("aria-pressed", String(x.post));
      b.setAttribute(
        "aria-label",
        x.post
          ? "Those standing to arms stand in the square again"
          : `Those standing to arms stand at ${x.name}`,
      );
      b.onclick = () => this.onOrder("place.post", { lot: x.post ? null : x.lot });
      const row = el("div", "place-insp-orders");
      row.append(b);
      body.push(row);
    }
    if (x.postWords) body.push(el("p", "place-insp-why", x.postWords));
    if (x.warmth) body.push(el("p", "place-insp-why place-insp-warmth", `🔥 ${x.warmth}`));
    // (What the town could be asked to raise here, P1: on the lots this one is of; the homes it would clear said.)
    if (x.raiseHere.length && this.orders) {
      const box = el("div", "place-insp-people place-insp-raise");
      for (const r of x.raiseHere) {
        const row = el("div", "place-line place-build-row"),
          words = el("span", "place-line-words"),
          go = el("button", "place-order place-insp-raise-key", "Raise here");
        words.append(
          el("span", "place-row-name", `${r.icon} ${r.name}`),
          el(
            "span",
            "place-row-what",
            `${r.note}${r.lots > 1 ? ` · on ${r.lots} lots from this one's block` : ""}${r.clears ? ` · clears the ${r.clears === 1 ? "home of 1 household" : `homes of ${r.clears} households`} on them` : ""}`,
          ),
        );
        go.setAttribute("aria-label", `Ask the town to raise ${r.name} here`);
        const ask = () => this.onOrder("town.ask", { kind: "raise", what: r.what, at: r.at }),
          which = `${x.ref}|${r.what}|${r.at}`;
        // (One that clears homes asks first, saying what it clears; nothing is asked of the town till Raise. U2.)
        go.onclick = () => {
          if (!r.clears) return ask();
          this.raising = which;
          this.drawn = "";
          this.redraw();
        };
        const asking = this.raising === which && r.clears > 0;
        // (While it asks, its question and keys in the key's place: U2.)
        row.append(words);
        if (!asking) row.append(go);
        box.append(row);
        if (asking) {
          const clears = r.clears === 1 ? "1 household's home" : `${r.clears} households' homes`,
            sure = el("div", "place-insp-raise-sure"),
            raise = el("button", "place-order place-insp-raise-yes", "Raise"),
            cancel = el("button", "place-order place-insp-raise-no", "Cancel");
          sure.setAttribute("role", "group");
          sure.append(
            el("span", "place-insp-raise-ask", `Clears ${clears}: raise ${r.name} here?`),
            raise,
            cancel,
          );
          raise.setAttribute("aria-label", `Raise ${r.name} here, clearing ${clears}`);
          raise.onclick = () => {
            this.raising = null;
            ask();
            this.drawn = "";
            this.redraw();
          };
          cancel.setAttribute("aria-label", "Cancel: clear nothing");
          cancel.onclick = () => {
            this.raising = null;
            this.drawn = "";
            this.redraw();
          };
          box.append(sure);
        }
      }
      body.push(el("p", "place-insp-label", "Raise here"), box);
    }
    if (x.ground) body.push(el("p", "place-insp-why", `Ground: ${x.ground}`));
    if (x.stock.length) {
      const table = el("table", "place-insp-stock"),
        head = el("tr");
      head.append(el("th", "", "Holds"), el("th", "", "Amount"), el("th", "", ""));
      table.append(head);
      for (const s of x.stock) {
        const row = el("tr");
        row.append(
          el("td", "", s.name),
          el("td", "place-num", amount(s.n)),
          el("td", "place-unit", s.unit),
        );
        table.append(row);
      }
      body.push(table);
    } else body.push(el("p", "place-insp-why", "It holds nothing now."));
    if (x.works.length) {
      const box = el("div", "place-insp-people");
      for (const w of x.works) {
        const b = el(w.ref ? "button" : "div", "place-insp-person");
        b.append(el("span", "place-row-name", w.name), el("span", "place-row-what", w.words));
        if (w.ref) (b as HTMLButtonElement).onclick = () => this.onInspect(w.ref);
        box.append(b);
      }
      body.push(el("p", "place-insp-label", "Its works"), box);
    }
    if (x.bills.length)
      body.push(
        el("p", "place-insp-label", "Made here, and its bills"),
        billsEl(x.bills, this.onOrder, null, this.orders),
      );
    if (x.takes)
      body.push(
        el(
          "p",
          "place-insp-label",
          x.takes.store === 0 ? "What its market takes" : "What its granary takes",
        ),
        takesEl(x.takes, this.onOrder, this.orders),
      );
    if (x.people.length) body.push(this.people(x.people));
    this.body.replaceChildren(...body);
  }

  private moodBar(x: PlaceInspectPerson): HTMLElement {
    const box = el("div", "place-insp-mood"),
      bar = el("div", "place-meter place-mood-meter"),
      fill = el("span", "place-meter-fill"),
      mark = el("span", "place-meter-mark"),
      at = (v: number) => `${Math.round(((v + 100) / 200) * 100)}%`;
    // (From the middle, out to where it stands; red below the mark, amber below even, green above.)
    const m = Math.max(-100, Math.min(100, x.mood));
    fill.style.left = m >= 0 ? "50%" : at(m);
    fill.style.width = `${(Math.abs(m) / 200) * 100}%`;
    box.classList.add(m < x.breakAt ? "bad" : m < -15 ? "low" : "good");
    mark.style.left = at(x.breakAt);
    mark.title = `The red tick: below ${signed(x.breakAt)} they stop heeding orders`;
    bar.append(fill, mark);
    box.append(
      el("span", "place-insp-label", "Mood"),
      bar,
      el("span", "place-insp-value", `${x.moodWord} ${signed(x.mood)}`),
    );
    return box;
  }
  private needBar(n: PlaceNeed, serves: number): HTMLElement {
    const row = el("div", "place-insp-need"),
      bar = el("div", "place-meter"),
      fill = el("span", "place-meter-fill"),
      mark = el("span", "place-meter-mark");
    fill.style.width = `${Math.round(n.level * 100)}%`;
    mark.style.left = `${Math.round(Math.min(1, serves) * 100)}%`;
    row.classList.toggle("pressing", n.level >= serves);
    row.classList.toggle("high", n.level >= 0.9);
    bar.append(fill, mark);
    row.title = `${n.name}: ${Math.round(n.level * 100)}% (higher is worse: 100% can bear no more), pressing ${Math.round(n.press * 100)}%. Past the white tick it is seen to before work.`;
    // (A need met by the day, by their home and what is in sight of it: told what meets it; nothing is sought for it.)
    if (n.words) {
      row.classList.remove("pressing");
      row.classList.add("daily");
      mark.hidden = true;
      row.title = `${n.name}: ${n.words}`;
    }
    row.append(
      el("span", "place-insp-label", n.name),
      bar,
      el("span", "place-insp-value", `${Math.round(n.level * 100)}%`),
    );
    return row;
  }
  private facts(rows: readonly (readonly [string, string, string | null])[]): HTMLElement {
    const box = el("div", "place-insp-facts");
    for (const [label, words, ref] of rows) {
      box.append(el("span", "place-insp-label", label));
      // (A home lost is said in words, the lot they shelter at its own short key: a sentence as one key stood three lines
      // tall, over the key under it on a phone. U2.)
      const lost = /^None of their own/.test(words)
        ? /^(.*?)(?:: they shelter at (.+))?$/.exec(words)
        : null;
      if (lost && ref) {
        const cell = el(
          "span",
          "place-insp-fact",
          lost[2] ? `${lost[1]}: they shelter at ` : words,
        );
        if (lost[2]) {
          const b = el("button", "place-link", lost[2]);
          b.dataset.ref = ref;
          b.onclick = () => this.onInspect(ref);
          cell.append(b);
        }
        box.append(cell);
      } else if (ref) {
        const b = el("button", "place-link", words);
        b.dataset.ref = ref;
        b.onclick = () => this.onInspect(ref);
        box.append(b);
      } else box.append(el("span", "place-insp-fact", words));
    }
    return box;
  }
  /** The web of whom one knows (Q2): them at its heart, those they know about them, joined by what each thinks. */
  private readonly web = el("canvas", "place-insp-web");
  private webbed = "";
  private webAt: { x: number; y: number; ref: string }[] = [];
  private webOf(x: PlaceInspectPerson): HTMLElement {
    const W = 340,
      H = 230,
      dpr = Math.min(2, globalThis.devicePixelRatio || 1),
      key = JSON.stringify([x.ref, x.ties.map((t) => [t.ref, t.regard]), x.web]);
    this.web.title =
      "Whom they know: green the warmer, red the colder, the thicker the more; tap one to see them";
    this.web.setAttribute("aria-label", this.web.title);
    if (key === this.webbed) return this.web;
    this.webbed = key;
    this.web.width = W * dpr;
    this.web.height = H * dpr;
    const g = this.web.getContext("2d");
    if (!g) return this.web;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const n = x.ties.length,
      cx = W / 2,
      cy = H / 2,
      at = x.ties.map((_, k) => {
        const a = -Math.PI / 2 + (2 * Math.PI * k) / n;
        return { x: cx + (W / 2 - 26) * Math.cos(a), y: cy + (H / 2 - 24) * Math.sin(a) };
      }),
      hue = (r: number, alpha: number) =>
        r >= 0 ? `rgba(79, 195, 161, ${alpha})` : `rgba(232, 96, 76, ${alpha})`;
    // (What those they know think of each other: faint.)
    for (const e of x.web) {
      const a = at[e.a]!,
        b = at[e.b]!;
      g.strokeStyle = hue(e.regard, 0.3);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
    // (What they think of each: the warmer the greener, the colder the redder, the thicker the more.)
    x.ties.forEach((t, k) => {
      g.strokeStyle = hue(t.regard, 0.9);
      g.lineWidth = 1 + Math.abs(t.regard) / 20;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(at[k]!.x, at[k]!.y);
      g.stroke();
    });
    const face = (
      p: PlaceInspectPerson["portrait"],
      px: number,
      py: number,
      size: number,
      ring: string,
    ) => {
      g.fillStyle = "rgba(14, 22, 48, 0.95)";
      g.strokeStyle = ring;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(px, py, size / 2 + 2, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      if (p?.kind !== "person") return;
      const c = document.createElement("canvas");
      c.width = c.height = size * dpr;
      drawPortrait(c, p, size * dpr, size * dpr, 0);
      g.drawImage(c, px - size / 2, py - size / 2, size, size);
    };
    x.ties.forEach((t, k) => face(t.portrait, at[k]!.x, at[k]!.y, 30, hue(t.regard, 1)));
    face(x.portrait, cx, cy, 40, "rgba(240, 214, 140, 1)");
    this.webAt = x.ties.map((t, k) => ({ ...at[k]!, ref: t.ref }));
    return this.web;
  }
  private people(list: readonly PlaceNamed[]): HTMLElement {
    const box = el("div", "place-insp-people");
    for (const n of list) {
      const b = el("button", "place-insp-person");
      b.append(el("span", "place-row-name", n.name), el("span", "place-row-what", n.words));
      b.onclick = () => this.onInspect(n.ref);
      box.append(b);
    }
    return box;
  }
}
