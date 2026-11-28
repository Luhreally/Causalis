// A town entered (town mode): the mode's own chrome over the town, in place of the god game's. A bar at the top: the way
// out, the town and its date (season, day, year), its clock and its air (warmth and weather), how it is run, and a menu
// (≡: sound, the ways to run it, leaving). The paces its day is watched at (⏸, a minute, ten, an hour or a day a second)
// in a pill of their own under the bar on a phone, in the bar on a desk. An alert column at the right: what wants the
// manager's eye now, read by the place off what it has (host/placeplan.ts placeNotices), the gravest first, each a tap
// from going there and opening it. Six tabs at the foot, each opening a sheet: its people, its stocks, its work and the
// orders that move it, what it can raise, what threatens it and the orders against that, and its log. Phone first: every
// key a finger's size, nothing over anything; on a desk the sheets are docked across the screen between the inspector's
// place at the left and the alerts at the right. What it shows is told by the page that owns it (app/townplace.ts); it
// asks for nothing itself.
//
// How the town is run is chosen on entering, and again from the key on its bar (asked 2026-11-25): by hand, as above;
// watched, where no order is given: the sheets and the tabs are away, and a line at the foot says who or what the eye is
// with, with a key to stay with them and one to go on to another; or by its own head, with the sheets as by hand, its
// head's decisions in the Log, and any of them overruled by an order of your own.
import {
  PLACE_TRADES,
  type PlaceMode,
  type PlaceDangersSheet,
  type PlaceNotice,
  type PlaceOverlay,
  type PlaceOverlayKind,
  type PlacePeopleSheet,
  type PlaceStocksSheet,
  type PlaceHealerRow,
  type PlaceLogSheet,
  type PlaceWorkSheet,
  type TownOffers,
} from "../bridge/index.ts";
import { el } from "./why.ts";
import { billsEl } from "./place-bills.ts";

export type PlaceTab = "people" | "stocks" | "work" | "build" | "dangers" | "log";
const TABS: readonly (readonly [PlaceTab, string, string])[] = [
  ["people", "👥", "People"],
  ["stocks", "📦", "Stocks"],
  ["work", "⚒️", "Work"],
  ["build", "🏗️", "Build"],
  ["dangers", "🛡️", "Dangers"],
  ["log", "📜", "Log"],
];
/** The paces a town's day is watched at: the key, the clock's seconds a second, and that in words. */
export const PLACE_PACES: readonly (readonly [string, number, string])[] = [
  ["⏸", 0, "Stop the town's clock (Space)"],
  ["1m", 60, "A minute of the town's day a second (1)"],
  ["10m", 600, "Ten minutes of the town's day a second (2)"],
  ["1h", 3600, "An hour of the town's day a second (3)"],
  ["1d", 86_400, "A day of the town a second (4)"],
];
/** The ways a town entered is run: its key's sign, its name, and what it is in a line. */
const MODES: readonly (readonly [PlaceMode, string, string, string])[] = [
  ["hand", "✋", "Run it", "You give the orders"],
  ["steward", "🏛", "Its head runs it", "Its own head gives them"],
  ["watch", "👁", "Watch it", "No orders: the eye is led"],
];
/** The seasons, from midwinter on (a place's season is the share of its year gone from midwinter, its own hemisphere's). */
const SEASONS = ["Winter", "Spring", "Summer", "Autumn"];
/** A place's season (the share of its year gone from midwinter) in a word. */
export const seasonWord = (season: number): string =>
  SEASONS[Math.floor(((((season + 0.125) % 1) + 1) % 1) * 4) % 4]!;
/** How many alerts the column shows at once on a phone; the rest are counted on a key of their own. */
const ALERTS_PHONE = 5,
  ALERTS_DESK = 8;
/** What the alerts' levels are called, for their keys' words. */
const LEVEL_WORDS = ["", "Worth knowing", "To see to", "Danger"];

/** What the eye is with in a town watched: said in two lines, the page that tells more, and whether it stays with them. */
export type PlaceCaption = {
  readonly title: string;
  readonly words: string;
  readonly ref: string | null;
  /** Staying with one of its people (their name is the title); and whether there is one to stay with. */
  readonly stay: boolean;
  readonly one: boolean;
};
/** The weather over the town now, as the god game's bar tells it (null: none told). */
export type PlaceWeather = {
  readonly icon: string;
  readonly celsius: number | null;
  readonly words: string;
};
const NEEDS = ["hungry", "tired", "cold", "lonely"];
/** What one can be put to by name: the world's occupation column and its word (null: let be). */
const ORDER_TRADES: readonly (readonly [number | null, string])[] = [
  [2, "Fields"],
  [3, "Herds"],
  [4, "Crafts"],
  [5, "Hauling"],
  [null, "Let be"],
];
/** The People sheet's narrowing to those pinned (host/placeplan.ts PEOPLE_PINNED). */
const PINNED = 102;
/** The People sheet's narrowings: the world's occupation column (100 the young of no trade, 101 the grown of none). */
const TRADE_CHIPS: readonly (readonly [number | null, string])[] = [
  [null, "All"],
  [2, "Farmers"],
  [3, "Herders"],
  [4, "Crafters"],
  [5, "Traders"],
  [6, "Leaders"],
  [100, "Children"],
  [101, "Grown, no trade"],
];
/** Its overlays (N5), each with its chip's words and what it shows. */
const LENSES: readonly (readonly [PlaceOverlayKind, string, string])[] = [
  ["needs", "Needs", "How pressing the needs of those living on each lot are, on average"],
  ["mood", "Mood", "The mood of those living or working on each lot, on average"],
  ["room", "Room", "How full each home is, of the room it has"],
  [
    "comfort",
    "Comfort",
    "Each home's beds for those under it, and a fine work in sight of its door",
  ],
  ["work", "Work", "How many work at each building, and which are stopped"],
  ["age", "Age", "How long each building has stood"],
  ["danger", "Danger", "A fire burning, and the lots within a cry of it"],
  ["zones", "Zones", "Your meeting places and the lots you keep clear: tap a lot to zone it"],
];
/** A mood in a sign. */
const moodSign = (m: number) => (m >= 25 ? "😊" : m >= -15 ? "😐" : m >= -50 ? "😟" : "😠");

/** The trades the priorities grid can be narrowed to, and a trade turned to, said. */
const GRID_CHIPS: readonly (readonly [number | null, string])[] = [
  [null, "All"],
  [2, "Farmers"],
  [3, "Herders"],
  [4, "Crafters"],
  [5, "Traders"],
];
const GRID_TURNED: readonly string[] = ["", "", "the fields", "the herds", "a craft", "hauling"];

const amount = (x: number) =>
  x >= 100 ? `${Math.round(x)}` : x >= 10 ? x.toFixed(1) : x.toFixed(2);
const DAY = 86_400,
  YEAR = 365 * DAY;
const hhmm = (t: number) => {
  const s = ((t % DAY) + DAY) % DAY;
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
};
/** Whether the page is laid out as a desk's (the stylesheet's own width). */
const DESK = "(min-width: 900px)";

export class PlaceHud {
  readonly element = el("div", "place-hud");
  private readonly bar = el("header", "place-bar");
  private readonly name = el("span", "place-name");
  private readonly date = el("span", "place-date");
  private readonly clock = el("span", "place-clock");
  private readonly air = el("span", "place-air");
  private readonly pill = el("div", "place-pill");
  private readonly paces: HTMLButtonElement[] = [];
  /** Its overlays (N5): the key in the pill, and the panel of them with the legend of the one shown. */
  private readonly lensKey = el("button", "place-pace place-lens-key", "🗺");
  private readonly lensBox = el("div", "place-lens");
  private readonly lensChips = el("div", "place-lens-chips");
  private readonly lensLegend = el("div", "place-lens-legend");
  /** The overlay shown (null: none). */
  lens: PlaceOverlayKind | null = null;
  /** What an alert tapped says (a phone's: its words and the key to put it away), or the alerts the column has no room for. */
  private readonly notice = el("div", "place-notice");
  private readonly noticeText = el("div", "place-notice-text");
  private readonly alertsBox = el("div", "place-alerts");
  private readonly sheet = el("section", "place-sheet");
  private readonly sheetTitle = el("h2");
  private readonly sheetBody = el("div", "place-sheet-body");
  private readonly tabs = new Map<PlaceTab, HTMLButtonElement>();
  private readonly closed = new Set<string>();
  private readonly modeKey = el("button", "place-mode");
  private readonly modes = el("div", "place-modes");
  private readonly modesWords = el("p", "place-modes-words");
  private readonly modeKeys = new Map<PlaceMode, HTMLButtonElement>();
  private readonly menuKey = el("button", "place-menu-key", "≡");
  private readonly menu = el("div", "place-menu");
  private readonly soundKey = el("button", "place-menu-item");
  private readonly watch = el("div", "place-watch");
  private readonly watchText = el("button", "place-watch-text");
  private readonly watchTitle = el("span", "place-watch-title");
  private readonly watchWords = el("span", "place-watch-words");
  private readonly stayKey = el("button", "place-watch-stay", "📌");
  private captionNow: PlaceCaption | null = null;
  /** How the town is run now, and by whom where its head runs it. */
  ran: PlaceMode = "hand";
  private headNow: { name: string; temper: string } | null = null;
  private drawn = "";
  /** Whose order is being chosen on the People sheet (their number; null: no one's). */
  private ordering: number | null = null;
  /** The shares being set on the Work sheet before they are ordered (thousandths; null: none being set). */
  private setting: number[] | null = null;
  /** Whether the Work sheet's priorities grid is open, and the trade it is narrowed to (null: all). */
  private gridOpen = false;
  gridOcc: number | null = null;
  tab: PlaceTab | null = null;
  /** The trade the People sheet is narrowed to (the world's occupation column; null: all). */
  occ: number | null = null;
  /** The pinned who are not of the town entered, or are gone: their pages, names and where they are, in words. */
  away: readonly { readonly ref: string; readonly name: string; readonly words: string }[] = [];
  /** A pin let go of: their page (the people bar's) and who they are in the place (null: not of it). */
  onUnpin: (ref: string, id: number | null) => void = () => {};
  /** A page of the god game's opened (one pinned who is elsewhere). */
  onPage: (ref: string) => void = () => {};
  onPace: (seconds: number) => void = () => {};
  onLeave: () => void = () => {};
  /** A tab opened, or the sheet closed (null). */
  onTab: (tab: PlaceTab | null) => void = () => {};
  /** A page asked for. */
  onOpen: (ref: string) => void = () => {};
  /** An alert tapped: the eye goes there, and what it is of is opened. */
  onAlert: (n: PlaceNotice) => void = () => {};
  /** An order given: the command and what it asks. */
  onOrder: (type: string, args: Record<string, unknown>) => void = () => {};
  /** Another way of running the town chosen. */
  onMode: (mode: PlaceMode) => void = () => {};
  /** In a town watched: stay with the one the eye is with, or be led again; and on to another. */
  onStay: (stay: boolean) => void = () => {};
  onNext: () => void = () => {};
  /** Esc: what is chosen let go of. */
  onEscape: () => void = () => {};
  /** F: the eye kept with the one chosen, or let go (false: no one is chosen, and the key is not the mode's). */
  onFollow: () => boolean = () => false;
  /** A sheet opened or closed, by a tab or from the page (for what lies beside it). */
  onSheet: (tab: PlaceTab | null) => void = () => {};
  /** The game's sound, from the menu (null: none to be had). */
  sound: { on(): boolean; set(on: boolean): void } | null = null;
  /** An overlay chosen (null: none shown). */
  onLens: (lens: PlaceOverlayKind | null) => void = () => {};
  private readonly deskQuery = typeof matchMedia === "function" ? matchMedia(DESK) : null;

  constructor(root: HTMLElement) {
    const back = el("button", "place-leave", "◂");
    back.title = "Leave the town to the world: it is kept as it is, and goes on from here";
    back.setAttribute("aria-label", back.title);
    back.onclick = () => this.onLeave();
    const id = el("span", "place-id"),
      sky = el("span", "place-sky");
    id.append(this.name, this.date);
    sky.append(this.clock, this.air);
    for (const [words, seconds, say] of PLACE_PACES) {
      const b = el("button", "place-pace", words);
      b.title = say;
      b.setAttribute("aria-label", say);
      b.dataset.pace = String(seconds);
      b.onclick = () => this.onPace(seconds);
      this.paces.push(b);
      this.pill.append(b);
    }
    this.lensKey.title = "Overlays on its lots: needs, mood, room, work, age, danger (O)";
    this.lensKey.setAttribute("aria-label", this.lensKey.title);
    this.lensKey.onclick = () => this.setLens(this.lens ? null : "needs");
    this.pill.append(this.lensKey);
    for (const [kind, words, say] of LENSES) {
      const b = el("button", "place-chip place-lens-chip", words);
      b.dataset.lens = kind;
      b.title = say;
      b.onclick = () => this.setLens(kind);
      this.lensChips.append(b);
    }
    const off = el("button", "place-chip place-lens-off", "×");
    off.title = "No overlay";
    off.setAttribute("aria-label", off.title);
    off.onclick = () => this.setLens(null);
    this.lensChips.append(off);
    this.lensBox.append(this.lensChips, this.lensLegend);
    this.lensBox.hidden = true;
    this.modeKey.onclick = () => this.choosing(this.modes.hidden !== false);
    this.menuKey.title = "Menu: sound, how the town is run, leaving it";
    this.menuKey.setAttribute("aria-label", this.menuKey.title);
    this.menuKey.onclick = () => this.menuOpen(this.menu.hidden !== false);
    this.bar.append(back, id, sky, this.modeKey, this.menuKey);
    // (The pill in the bar on a desk, under it on a phone: placed once the chrome is put together, below.)
    this.deskQuery?.addEventListener?.("change", () => this.placePill());
    this.modes.append(this.modesWords);
    for (const [mode, sign, words, does] of MODES) {
      const b = el("button", "place-mode-choice");
      b.append(
        el("span", "place-mode-name", `${sign} ${words}`),
        el("span", "place-mode-does", does),
      );
      b.dataset.mode = mode;
      b.onclick = () => {
        this.choosing(false);
        if (mode !== this.ran) this.onMode(mode);
      };
      this.modeKeys.set(mode, b);
      this.modes.append(b);
    }
    this.modes.hidden = true;
    // The menu: sound, the ways to run it, leaving.
    this.soundKey.onclick = () => {
      if (!this.sound) return;
      this.sound.set(!this.sound.on());
      this.soundWords();
    };
    const ways = el("button", "place-menu-item", "✋ 🏛 👁  How it is run…"),
      leave = el("button", "place-menu-item", "◂  Leave the town");
    ways.onclick = () => {
      this.menuOpen(false);
      this.choosing(true);
    };
    leave.onclick = () => {
      this.menuOpen(false);
      this.onLeave();
    };
    this.menu.append(this.soundKey, ways, leave);
    this.menu.hidden = true;
    this.watchText.append(this.watchTitle, this.watchWords);
    this.watchText.onclick = () => {
      if (this.captionNow?.ref) this.onOpen(this.captionNow.ref);
    };
    this.stayKey.onclick = () => this.onStay(!this.captionNow?.stay);
    const next = el("button", "place-watch-next", "⏭");
    next.title = "On to another of the town";
    next.setAttribute("aria-label", next.title);
    next.onclick = () => this.onNext();
    this.watch.append(this.watchText, this.stayKey, next);
    this.watch.hidden = true;
    this.mode("hand");
    this.notice.append(this.noticeText);
    this.notice.hidden = true;
    const head = el("header", "place-sheet-head"),
      close = el("button", "place-sheet-shut", "×");
    close.setAttribute("aria-label", "Close");
    close.onclick = () => this.open(null);
    head.append(this.sheetTitle, close);
    this.sheet.append(head, this.sheetBody);
    this.sheetBody.addEventListener("pointerdown", () => (this.held = performance.now() + 800));
    for (const up of ["pointerup", "pointercancel"])
      this.sheetBody.addEventListener(up, () => (this.held = performance.now() + 60));
    this.sheet.hidden = true;
    const foot = el("nav", "place-foot");
    for (const [tab, icon, words] of TABS) {
      const b = el("button", "place-tab");
      b.append(el("span", "place-tab-icon", icon), el("span", "place-tab-name", words));
      b.dataset.tab = tab;
      b.onclick = () => this.open(this.tab === tab ? null : tab);
      this.tabs.set(tab, b);
      foot.append(b);
    }
    this.alertsBox.hidden = true;
    this.element.append(
      this.bar,
      this.pill,
      this.modes,
      this.menu,
      this.alertsBox,
      this.lensBox,
      this.notice,
      this.sheet,
      foot,
      this.watch,
    );
    this.placePill();
    this.element.hidden = true;
    root.append(this.element);
    // Keys, on a desk: Space stops or starts its clock, 1 to 4 its paces, Esc lets go of what is chosen. Taken before the
    // god game's own (ui/keys.ts), whose paces are another scale's, and only while a town is entered.
    addEventListener(
      "keydown",
      (e) => {
        if (!this.shown || e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        const digit = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
        if (e.code === "Space") {
          if (!e.repeat) this.onPace(this.pace > 0 ? 0 : this.lastPace);
        } else if (digit) this.onPace(PLACE_PACES[Number(digit[1])]![1]);
        else if (e.code === "KeyO") this.setLens(this.lens ? null : "needs");
        else if (e.code === "KeyF") {
          // (F is the god game's tilt too: taken only where someone is chosen to follow.)
          if (!this.onFollow()) return;
        } else if (e.code === "Escape") {
          if (!this.modes.hidden) this.choosing(false);
          else if (!this.menu.hidden) this.menuOpen(false);
          else this.onEscape();
        } else return;
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      { capture: true },
    );
    addEventListener(
      "keyup",
      (e) => {
        if (this.shown && e.code === "Space") e.stopImmediatePropagation();
      },
      { capture: true },
    );
  }

  /** An overlay shown on its lots, or none: its chip lit, its panel shown, and told. */
  setLens(lens: PlaceOverlayKind | null): void {
    this.lens = lens;
    this.lensBox.hidden = lens === null;
    this.lensKey.classList.toggle("on", lens !== null);
    this.element.classList.toggle("lens-on", lens !== null);
    for (const b of this.lensChips.querySelectorAll<HTMLElement>(".place-lens-chip"))
      b.classList.toggle("on", b.dataset.lens === lens);
    if (lens === null) this.lensLegend.replaceChildren();
    this.onLens(lens);
  }
  /** The legend of the overlay shown: its ramp from its low end to its high, and how many lots it reads. */
  legend(o: PlaceOverlay | null, colour: (v: number) => string): void {
    if (!o || o.of !== this.lens) return;
    const ramp = el("span", "place-lens-ramp");
    ramp.style.background = `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map(colour).join(", ")})`;
    const words =
      o.of === "danger"
        ? o.fire
          ? `A fire burning, and the lots within a cry of it (${Math.round(o.fire.reach)} m now): those living there hear it and turn out.`
          : "Nothing burns in the town now."
        : `${o.lots.length} ${o.lots.length === 1 ? "lot" : "lots"} read. Tap one for what it is${this.desk ? ", or hover over it" : ""}.`;
    this.lensLegend.replaceChildren(
      el("span", "place-lens-end", o.low),
      ramp,
      el("span", "place-lens-end", o.high),
      el("span", "place-lens-note", words),
    );
  }

  /** The paces' pill: in the bar on a desk (before how it is run), under it on a phone. */
  private placePill(): void {
    const desk = !!this.deskQuery?.matches;
    if (desk && this.pill.parentElement !== this.bar)
      this.bar.insertBefore(this.pill, this.modeKey);
    else if (!desk && this.pill.parentElement === this.bar) this.bar.after(this.pill);
  }

  get shown(): boolean {
    return !this.element.hidden;
  }
  /** Whether it is laid out as a desk's. */
  get desk(): boolean {
    return !!this.deskQuery?.matches;
  }
  show(town: string): void {
    this.name.textContent = town;
    this.name.title = town;
    this.element.hidden = false;
    this.closed.clear();
    this.lastAlerts = [];
    this.alertsKey = "";
    this.alertsBox.replaceChildren();
    this.alertsBox.hidden = true;
    this.tell(null);
    document.body.classList.add("placing");
    document.body.classList.toggle("place-watching", this.ran === "watch");
    this.soundWords();
  }
  hide(): void {
    this.element.hidden = true;
    this.open(null, false);
    this.choosing(false);
    this.menuOpen(false);
    document.body.classList.remove("placing", "place-watching");
  }

  /** The ways it can be run shown for choosing, or put away; `entering`: asked as the town is entered. */
  choosing(on: boolean, entering = false): void {
    this.modes.hidden = !on;
    if (on) this.menuOpen(false);
    this.modesWords.textContent = entering
      ? "How is this town to be run? You can change it from ✋ on the bar."
      : "How is this town to be run?";
    this.modeKey.setAttribute("aria-expanded", String(on));
    this.element.classList.toggle("choosing", on);
  }
  private menuOpen(on: boolean): void {
    this.menu.hidden = !on;
    if (on) {
      this.choosing(false);
      this.soundWords();
    }
    this.menuKey.setAttribute("aria-expanded", String(on));
    this.element.classList.toggle("menu-open", on);
  }
  private soundWords(): void {
    const on = !!this.sound?.on(),
      words = this.sound ? (on ? "🔊  Sound: on" : "🔈  Sound: off") : "🔇  No sound here";
    if (this.soundKey.textContent !== words) this.soundKey.textContent = words;
    this.soundKey.disabled = !this.sound;
    this.soundKey.classList.toggle("on", on);
  }
  /** Who runs the town where its own head does (null: no one yet, or not run so). */
  head(h: { name: string; temper: string } | null): void {
    if (h?.name === this.headNow?.name && h?.temper === this.headNow?.temper) return;
    this.headNow = h ? { name: h.name, temper: h.temper } : null;
    if (this.ran === "steward") this.mode("steward");
  }
  /** How the town is run, as it is now: its key says it, and a town watched has none of the manager's chrome. */
  mode(mode: PlaceMode): void {
    const [, sign] = MODES.find((m) => m[0] === mode) ?? MODES[0]!,
      by =
        mode === "steward"
          ? this.headNow
            ? `by its head, ${this.headNow.name} (${this.headNow.temper}): an order of yours overrules theirs`
            : "by its head"
          : mode === "watch"
            ? "by no one: it is watched"
            : "by your hand",
      say = `The town is run ${by}. Tap to choose another way`;
    this.ran = mode;
    this.modeKey.textContent = sign;
    this.modeKey.title = say;
    this.modeKey.setAttribute("aria-label", say);
    for (const [m, b] of this.modeKeys) b.classList.toggle("on", m === mode);
    const watching = mode === "watch";
    if (watching && this.tab) this.open(null);
    this.watch.hidden = !watching;
    if (this.shown) document.body.classList.toggle("place-watching", watching);
    if (!watching) this.caption(null);
  }
  /** What the eye is with in a town watched (null: nothing yet). */
  caption(c: PlaceCaption | null): void {
    this.captionNow = c;
    const title = c?.title ?? "Watching the town",
      words = c?.words ?? "The eye goes to what happens here.";
    if (this.watchTitle.textContent !== title) this.watchTitle.textContent = title;
    if (this.watchWords.textContent !== words) this.watchWords.textContent = words;
    const say = c?.stay
      ? `Staying with ${c.title}. Tap to be led to what happens again`
      : c?.one
        ? `Stay with ${c.title}, whatever else happens`
        : "Stay with one of the town: there is no one the eye is with now";
    this.stayKey.classList.toggle("on", !!c?.stay);
    this.stayKey.disabled = !c?.stay && !c?.one;
    if (this.stayKey.title !== say) {
      this.stayKey.title = say;
      this.stayKey.setAttribute("aria-label", say);
    }
  }
  /** What its watching line says now (the look tools; null: it is not watched). */
  get captioned(): { title: string; words: string; stay: boolean } | null {
    return this.watch.hidden
      ? null
      : {
          title: this.watchTitle.textContent ?? "",
          words: this.watchWords.textContent ?? "",
          stay: !!this.captionNow?.stay,
        };
  }

  /** A sheet opened (null: closed). */
  open(tab: PlaceTab | null, tell = true): void {
    this.tab = tab;
    this.setting = null;
    this.ordering = null;
    this.drawn = "";
    this.sheet.hidden = tab === null;
    this.element.classList.toggle("sheet-open", tab !== null);
    for (const [k, b] of this.tabs) b.classList.toggle("on", k === tab);
    if (tab) {
      this.sheetTitle.textContent = TABS.find((x) => x[0] === tab)![2];
      this.sheetBody.replaceChildren(el("p", "place-wait", "…"));
    }
    this.onSheet(tab);
    if (tell) this.onTab(tab);
  }

  /** The pace its clock runs at, and the last it ran at (Space starts it again at that). */
  private pace = 0;
  private lastPace = 600;
  /** Its clock, the pace it runs at, and its date: the season by its own hemisphere, the day of the year, the year. */
  time(t: number, pace: number, season?: number): void {
    const words = hhmm(t);
    if (this.clock.textContent !== words) this.clock.textContent = words;
    this.pace = pace;
    if (pace > 0) this.lastPace = pace;
    for (const b of this.paces) b.classList.toggle("on", Number(b.dataset.pace) === pace);
    if (season !== undefined) {
      const name = SEASONS[Math.floor(((((season + 0.125) % 1) + 1) % 1) * 4) % 4]!,
        date = `${name} · day ${Math.floor((((t % YEAR) + YEAR) % YEAR) / DAY) + 1} · year ${Math.floor(t / YEAR)}`;
      if (this.date.textContent !== date) this.date.textContent = date;
    }
  }
  /** Its air: the weather the god game's bar tells, and its warmth (that, or the place's own where it tells none). */
  sky(w: PlaceWeather | null, warmth: number | null): void {
    const c = w?.celsius ?? warmth,
      text = `${c === null ? "" : `${Math.round(c)}°`}${w?.icon ? ` ${w.icon}` : ""}`.trim(),
      words = `${w?.words ? `${w.words.charAt(0).toUpperCase()}${w.words.slice(1)}` : "The air"}${c === null ? "" : `, ${Math.round(c)} °C`}`;
    if (this.air.textContent !== text) this.air.textContent = text;
    if (this.air.title !== words) {
      this.air.title = words;
      this.air.setAttribute("aria-label", words);
    }
  }

  private lastAlerts: readonly PlaceNotice[] = [];
  private alertsKey = "";
  /** The alert whose words are told now (a phone's notice line), and until when (the page's clock, ms). */
  private telling: PlaceNotice | null = null;
  private tellUntil = 0;
  /** What wants the manager's eye: the alerts not put away, the gravest first, in the column at the right. */
  alerts(list: readonly PlaceNotice[]): void {
    const was = new Set(this.lastAlerts.map((n) => n.key));
    this.lastAlerts = list;
    const shown = list.filter((n) => !this.closed.has(n.key)),
      desk = !!this.deskQuery?.matches,
      most = desk ? ALERTS_DESK : ALERTS_PHONE,
      key = JSON.stringify([desk, shown.map((n) => [n.key, n.icon, n.level, n.n, n.words])]);
    // (A danger new since the last telling is told in words at once on a phone, as its notice line was.)
    const fresh = shown.find((n) => n.level >= 3 && !was.has(n.key));
    if (fresh && !desk) this.tell(fresh);
    if (this.telling && !list.some((n) => n.key === this.telling!.key)) this.tell(null);
    else if (this.telling && performance.now() > this.tellUntil) this.tell(null);
    if (key === this.alertsKey) return;
    this.alertsKey = key;
    const keys: HTMLElement[] = [];
    const room = shown.length > most ? most - 1 : most;
    for (const n of shown.slice(0, room)) keys.push(this.alertKey(n));
    if (shown.length > room) {
      const rest = shown.slice(room),
        more = el("button", "place-alert place-alert-more", `+${rest.length}`),
        say = `${rest.length} more: ${rest.map((n) => n.words).join("; ")}`;
      more.title = say;
      more.setAttribute("aria-label", say);
      more.onclick = () => this.tellMany(rest);
      keys.push(more);
    }
    this.alertsBox.replaceChildren(...keys);
    this.alertsBox.hidden = keys.length === 0;
  }
  private alertKey(n: PlaceNotice): HTMLElement {
    const row = el("div", `place-alert-row level${n.level}`),
      b = el("button", `place-alert level${n.level}`),
      say = `${LEVEL_WORDS[n.level] ?? ""}: ${n.words}. Tap to go there`;
    b.append(el("span", "place-alert-icon", n.icon));
    if (n.n > 0) b.append(el("span", "place-alert-n", n.n > 99 ? "99+" : String(n.n)));
    b.append(el("span", "place-alert-words", n.words));
    b.title = say;
    b.setAttribute("aria-label", say);
    b.dataset.key = n.key;
    b.onclick = () => {
      if (!this.deskQuery?.matches) this.tell(n);
      this.onAlert(n);
    };
    const shut = el("button", "place-alert-shut", "×");
    shut.title = "Put this alert away until it comes again";
    shut.setAttribute("aria-label", `Put away: ${n.words}`);
    shut.onclick = () => this.dismiss(n.key);
    row.append(b, shut);
    return row;
  }
  /** An alert put away: it comes back only as another (its key is its own: a fire is another fire). */
  private dismiss(key: string): void {
    this.closed.add(key);
    if (this.telling?.key === key) this.tell(null);
    this.alerts(this.lastAlerts);
  }
  /** The notice line under the paces (a phone's): what an alert tapped says, with its key to put it away (null: none). */
  private tell(n: PlaceNotice | null): void {
    this.telling = n;
    this.tellUntil = performance.now() + 8000;
    if (!n) {
      this.notice.hidden = true;
      return;
    }
    const words = el("button", "place-notice-words", `${n.icon} ${n.words}`),
      shut = el("button", "place-notice-shut", "×");
    words.onclick = () => this.onAlert(n);
    shut.setAttribute("aria-label", `Put away: ${n.words}`);
    shut.onclick = () => this.dismiss(n.key);
    this.noticeText.replaceChildren(words);
    this.notice.replaceChildren(this.noticeText, shut);
    this.notice.hidden = false;
  }
  /** The alerts the column has no room for, told in the notice line, each a tap from going there. */
  private tellMany(list: readonly PlaceNotice[]): void {
    this.telling = list[0] ?? null;
    this.tellUntil = performance.now() + 12_000;
    const keys = list.map((n) => {
      const b = el("button", `place-notice-words level${n.level}`, `${n.icon} ${n.words}`);
      b.onclick = () => this.onAlert(n);
      return b;
    });
    const shut = el("button", "place-notice-shut", "×");
    shut.setAttribute("aria-label", "Close");
    shut.onclick = () => this.tell(null);
    this.noticeText.replaceChildren(...keys);
    this.notice.replaceChildren(this.noticeText, shut);
    this.notice.hidden = false;
  }
  /** What wants the manager's eye most now, as the column has it (the look tools; null: nothing). */
  get noticed(): string | null {
    return this.lastAlerts.find((n) => !this.closed.has(n.key))?.words ?? null;
  }
  /** Put the gravest alert away (the look tools). */
  dismissFirst(): void {
    const n = this.lastAlerts.find((x) => !this.closed.has(x.key));
    if (n) this.dismiss(n.key);
  }

  /** Whether what would be drawn is what is drawn already (a sheet read again every second is not built again for nothing). */
  /** Until when (the page's clock, ms) a finger is taken to be down on the sheet: nothing under it is drawn anew. */
  private held = 0;
  private owed = false;
  private same(what: unknown): boolean {
    // (A sheet drawn anew between a finger's coming down and going up loses the tap: the key pressed is gone when the
    // press ends. Seen in WebKit at a phone's size, where a person's order key did nothing while the clock ran.)
    if (performance.now() < this.held) {
      // (What came meanwhile is asked for again once the finger is up.)
      if (!this.owed) {
        this.owed = true;
        const again = (): void => {
          if (performance.now() < this.held) return void setTimeout(again, 80);
          this.owed = false;
          if (this.tab) this.onTab(this.tab);
        };
        setTimeout(again, 80);
      }
      return true;
    }
    const key = JSON.stringify(what);
    if (key === this.drawn) return true;
    this.drawn = key;
    return false;
  }

  /**
   * Its people, the most pressed first. `own`: drawn again by a key of the sheet itself, from the very rows it shows.
   * While someone's order keys are open the list holds still: who is most pressed changes by the second while the clock
   * runs, and a list read again moved the row and its keys from under the finger, or took them off the sheet with
   * the one they were for (in WebKit at a phone's size an order key pressed did nothing six times in fourteen).
   */
  people(s: PlacePeopleSheet, own = false): void {
    if (this.tab !== "people") return;
    if (own) this.drawn = JSON.stringify([s, this.occ]);
    else if ((this.ordering !== null && this.drawn !== "") || this.same([s, this.occ])) return;
    let open: HTMLElement | null = null;
    const chips = el("div", "place-chips");
    // (Those pinned first: the people bar's 📌 and those followed by your word, here and, greyed, elsewhere.)
    const pins = s.pinned + this.away.length;
    if (pins > 0 || this.occ === PINNED) {
      const b = el("button", "place-chip place-chip-pinned", `📌 Pinned ${pins}`);
      b.classList.toggle("on", this.occ === PINNED);
      b.title = "Those you pinned: on the people bar, or followed by your word";
      b.onclick = () => {
        this.occ = PINNED;
        this.ordering = null;
        this.drawn = "";
        this.onTab("people");
      };
      chips.append(b);
    }
    for (const [occ, words] of TRADE_CHIPS) {
      const n =
        occ === null
          ? s.trades.reduce((a, b) => a + b, 0)
          : occ === 100
            ? s.children
            : occ === 101
              ? (s.trades[0] ?? 0) - s.children
              : (s.trades[occ] ?? 0);
      if (occ !== null && n <= 0) continue;
      const b = el("button", "place-chip", `${words} ${n}`);
      b.classList.toggle("on", this.occ === occ);
      b.onclick = () => {
        this.occ = occ;
        this.ordering = null;
        this.drawn = "";
        this.onTab("people");
      };
      chips.append(b);
    }
    const list = el("div", "place-rows");
    for (const r of s.rows) {
      const row = el("button", `place-row place-person-row level${r.level}`),
        mood = el(
          "span",
          "place-mood-chip",
          `${moodSign(r.mood)} ${r.mood > 0 ? "+" : ""}${r.mood}`,
        );
      mood.title = `Mood ${r.mood} of -100 to 100; below -50 they heed no order`;
      row.append(
        el("span", "place-row-name", r.name),
        el("span", `place-attention level${r.level}`, r.attention),
        el(
          "span",
          "place-row-what",
          `${r.trade}${r.bound ? ` (by order: ${r.bound})` : ""} · ${r.doing}`,
        ),
        mood,
      );
      row.title = `${r.name}: ${NEEDS.map((w, q) => `${w} ${Math.round((r.needs[q] ?? 0) * 100)}%`).join(", ")}`;
      row.onclick = () => this.onOpen(r.ref);
      if (r.pinned) {
        row.classList.add("pinned");
        row.querySelector(".place-row-name")!.prepend("📌 ");
      }
      // (An order for them by name: the trade they are put to, or let be.)
      const one = el("div", "place-person"),
        key = el("button", "place-row-order", "Orders"),
        words = `Give ${r.name} an order`;
      key.title = words;
      key.setAttribute("aria-label", words);
      key.classList.toggle("on", this.ordering === r.id);
      key.onclick = () => {
        this.ordering = this.ordering === r.id ? null : r.id;
        this.people(s, true);
      };
      one.dataset.ref = r.ref;
      one.append(row, key);
      // (A pinned one let go of: off the people bar and no longer followed by word.)
      if (r.pinned) {
        const off = el("button", "place-row-order place-row-unpin", "📌✕"),
          said = `Unpin ${r.name}`;
        off.title = said;
        off.setAttribute("aria-label", said);
        off.onclick = () => this.onUnpin(r.ref, r.id);
        one.append(off);
      }
      if (this.ordering === r.id) {
        open = one;
        const keys = el("div", "place-person-orders");
        ORDER_TRADES.forEach(([occ, name]) => {
          const b = el("button", "place-chip", name);
          b.classList.toggle("on", occ !== null && r.bound !== null && r.occ === occ);
          b.onclick = () => {
            this.ordering = null;
            this.people(s, true);
            this.onOrder("place.assign", { person: r.id, trade: occ, post: null });
          };
          keys.append(b);
        });
        one.append(keys);
        // (Put at a building, by name; and a home for their household, of those with most room.)
        if (s.posts.length && r.occ !== 0) {
          const at = el("div", "place-person-orders place-person-posts");
          at.append(el("span", "place-order-label", "Put at:"));
          for (const o of s.posts.slice(0, 8)) {
            const b = el("button", "place-chip", o.name);
            b.classList.toggle("on", r.post === o.lot);
            b.setAttribute("aria-label", `Put ${r.name} at the ${o.name}`);
            b.onclick = () => {
              this.ordering = null;
              this.people(s, true);
              this.onOrder("place.assign", { person: r.id, trade: null, post: o.lot });
            };
            at.append(b);
          }
          one.append(at);
        }
        // (Not the home they live in already.)
        const homes = s.homes.filter((o) => o.lot !== r.homeLot).slice(0, 4);
        if (homes.length) {
          const home = el("div", "place-person-orders place-person-homes");
          home.append(el("span", "place-order-label", "A home for their household:"));
          for (const o of homes) {
            const b = el("button", "place-chip", `Lot ${o.lot} · room for ${o.room}`);
            b.setAttribute(
              "aria-label",
              `Give ${r.name}'s household the home on lot ${o.lot}, with room for ${o.room}`,
            );
            b.onclick = () => {
              this.ordering = null;
              this.people(s, true);
              this.onOrder("place.house", { house: r.house, lot: o.lot });
            };
            home.append(b);
          }
          one.append(home);
        }
      }
      list.append(one);
    }
    const more =
      s.all > s.rows.length
        ? [el("p", "place-more", `and ${s.all - s.rows.length} more, who want the eye less`)]
        : [];
    // (One whose keys are open and no longer among the rows read: no keys are open.)
    if (!open) this.ordering = null;
    // (Under the chip, the pinned who are elsewhere or gone: greyed, with where they are.)
    const away: HTMLElement[] = [];
    if (this.occ === PINNED && this.away.length) {
      const box = el("div", "place-rows place-away");
      box.append(el("p", "place-more", "Pinned, and not here:"));
      for (const x of this.away) {
        const one = el("div", "place-person"),
          b = el("button", "place-row place-person-row place-away-row");
        one.dataset.ref = x.ref;
        b.append(
          el("span", "place-row-name", `📌 ${x.name}`),
          el("span", "place-row-what", x.words),
        );
        b.title = `${x.name}: ${x.words}`;
        b.onclick = () => this.onPage(x.ref);
        const off = el("button", "place-row-order place-row-unpin", "📌✕");
        off.title = `Unpin ${x.name}`;
        off.setAttribute("aria-label", off.title);
        off.onclick = () => this.onUnpin(x.ref, null);
        one.append(b, off);
        box.append(one);
      }
      away.push(box);
    }
    this.sheetBody.replaceChildren(chips, list, ...more, ...away);
    // (The keys just opened brought onto the sheet, where their row stood near its foot.)
    if (own && open) (open as HTMLElement).scrollIntoView({ block: "nearest" });
  }

  /**
   * Who works at what, and in what order: its grown at the trades an order can move, a row each, a kind of work a column.
   * A key says 1, 2 or 3 (first, second, third) or – (never); a tap takes it on to the next. The names stay at the left
   * and the kinds at the top while the rest scrolls under a finger.
   */
  private grid(s: PlaceWorkSheet): HTMLElement[] {
    const head = el("div", "place-line"),
      open = el(
        "button",
        "place-order place-grid-open",
        this.gridOpen ? "Hide priorities" : "Priorities by name",
      );
    open.setAttribute("aria-expanded", String(this.gridOpen));
    open.onclick = () => {
      this.gridOpen = !this.gridOpen;
      this.drawn = "";
      this.work(s);
    };
    head.append(
      el(
        "span",
        "place-line-words",
        "Who works at what, and what each turns to when their own work has nothing for them.",
      ),
      open,
    );
    if (!this.gridOpen) return [el("h3", "place-sub", "Priorities"), head];
    const chips = el("div", "place-chips");
    for (const [occ, words] of GRID_CHIPS) {
      const b = el("button", "place-chip", words);
      b.classList.toggle("on", this.gridOcc === occ);
      b.onclick = () => {
        this.gridOcc = occ;
        this.drawn = "";
        this.onTab("work");
      };
      chips.append(b);
    }
    const box = el("div", "place-grid"),
      table = el("div", "place-grid-rows"),
      top = el("div", "place-grid-row place-grid-head");
    top.append(el("span", "place-grid-name", "Name · trade's skill"));
    for (const kind of s.grid.skills) top.append(el("span", "place-grid-kind", kind));
    // (Over the keys that let one be.)
    top.append(el("span", "place-grid-kind"));
    table.append(top);
    for (const r of s.grid.rows) {
      const row = el("div", "place-grid-row"),
        name = el("button", "place-grid-name");
      name.append(
        el("span", "place-grid-who", r.name),
        el(
          "span",
          "place-grid-skill",
          `${r.skill}${r.turned ? ` · now at ${GRID_TURNED[r.turned] ?? "other work"}` : ""}`,
        ),
      );
      name.onclick = () => this.onOpen(r.ref);
      row.append(name);
      // (Each kind's skill under its key: the level its hours make, 0 new to it … 4 a master, ★ where their household taught
      // them it, ! where a wound takes from what it is done with.)
      const skillOf = (k: number, key: HTMLElement): string => {
        const c = r.skills[k];
        if (!c) return "";
        const words = `${c.words}, ${c.hours.toLocaleString("en-US")} h${c.passion ? ", taught it at home" : ""}${c.fit < 0.99 ? `, ${Math.round(c.fit * 100)}% fit for it` : ""}`;
        key.append(
          el(
            "span",
            `place-grid-lv${c.level >= 3 ? " high" : ""}${c.fit < 0.99 ? " unfit" : ""}`,
            `${c.level}${c.passion ? "★" : ""}${c.fit < 0.99 ? "!" : ""}`,
          ),
        );
        return words;
      };
      r.kinds.forEach((x, k) => {
        const key = el("button", "place-grid-key"),
          // (A tap takes it on: never, first, second, third, never. One's last trade is not set to never.)
          trades = r.kinds.slice(0, 4),
          only = k < 4 && trades.filter((y) => y > 0).length === 1 && x > 0,
          next = x === 0 ? 3 : x === 1 ? (only ? 3 : 0) : x - 1,
          skill =
            (key.append(el("span", "place-grid-num", x > 0 ? String(4 - x) : "–")),
            skillOf(k, key)),
          words = `${r.name}, ${s.grid.kinds[k]}: ${x > 0 ? ["", "third", "second", "first"][x] : "never"}; ${skill}. Tap for ${next > 0 ? ["", "third", "second", "first"][next] : "never"}`;
        key.classList.toggle("on", x > 0);
        key.classList.toggle("first", x === 3);
        key.classList.toggle("own", !r.set);
        key.title = words;
        key.setAttribute("aria-label", words);
        key.onclick = () => {
          const kinds = [...r.kinds];
          kinds[k] = next;
          this.onOrder("place.prio", { person: r.id, kinds });
        };
        row.append(key);
      });
      // (The kinds one's hours are counted at that take no priority: their skill alone.)
      for (let k = r.kinds.length; k < s.grid.skills.length; k++) {
        const cell = el("span", "place-grid-key place-grid-only");
        cell.title = `${r.name}, ${s.grid.skills[k]}: ${skillOf(k, cell)}`;
        row.append(cell);
      }
      if (r.set) {
        const free = el("button", "place-grid-key place-grid-free", "↺"),
          words = `Let ${r.name} work as they would of themselves`;
        free.title = words;
        free.setAttribute("aria-label", words);
        free.onclick = () => this.onOrder("place.prio", { person: r.id, kinds: null });
        row.append(free);
      } else row.append(el("span", "place-grid-free"));
      table.append(row);
    }
    box.append(table);
    const more =
      s.grid.all > s.grid.rows.length
        ? `${s.grid.rows.length} of ${s.grid.all} shown: narrow them by trade above. `
        : "";
    return [
      el("h3", "place-sub", "Priorities"),
      head,
      chips,
      box,
      el(
        "p",
        "place-more",
        `${more}1 is first. The trade set highest is the one they keep, and its land is told when it changes; a lower one is what they turn to, at the skill their hours at it make, when their own has nothing for them. Building is who a site's crew is made up of first; fire watch, who of those near a fire go to it (– never) and who keep a watch where one is ordered. The small number is their skill (0 new to it … 4 a master), from the hours they have given it; ★ the work their household taught them; ! a wound takes from what it is done with. Healing, cooking and hunting are counted as they are done: who tends one of their own abed, who cooks at their hearth, a forager's work. Faint keys are as they are of themselves.`,
      ),
    ];
  }

  /**
   * Its stocks as a table: each good, how much it holds and of what unit, how many days that lasts at today's use, what
   * came in and went out today, its last thirty days in a line, and whether its market may buy it. Where it lies under
   * its name. Food held back from its households by the granary, a month at a time.
   */
  stocks(s: PlaceStocksSheet): void {
    if (this.tab !== "stocks" || this.same(s)) return;
    const hold = el("div", "place-line place-hold"),
      less = el("button", "place-step", "−"),
      more = el("button", "place-step", "+");
    less.setAttribute("aria-label", "Hold back a month less");
    more.setAttribute("aria-label", "Hold back a month more");
    less.disabled = s.hold <= 0;
    more.disabled = s.hold >= 24;
    less.onclick = () => this.onOrder("place.hold", { months: Math.max(0, s.hold - 1) });
    more.onclick = () => this.onOrder("place.hold", { months: Math.min(24, s.hold + 1) });
    hold.append(
      el(
        "span",
        "place-line-words",
        `Food for ${Math.round(s.foodDays)} days in all. The granary holds back from households:`,
      ),
      less,
      el("span", "place-hold-n", `${s.hold} ${s.hold === 1 ? "month" : "months"}`),
      more,
    );
    const table = el("div", "place-table place-stock-table"),
      head = el("div", "place-tr place-th");
    for (const [words, say] of [
      ["Good", ""],
      ["Held", "How much it holds: food in months' food for one, the rest in units"],
      ["Lasts", "How many days it lasts at today's use"],
      ["Today", "Made and brought in today, and used"],
      ["30 days", "What it held at each day's turn while you looked"],
      ["Market may buy", "Whether its market may buy it from the town"],
    ] as const) {
      const c = el("span", "", words);
      if (say) c.title = say;
      head.append(c);
    }
    table.append(head);
    for (const r of s.rows) {
      // (The good's name leads to where most of it lies, where that is a building of the town.)
      const lies = r.where.find((w) => w.ref)?.ref ?? null,
        row = el("div", "place-tr"),
        good = el(lies ? "button" : "span", "place-td-good"),
        sell = el("button", "place-switch", r.forbidden ? "No ○" : "Yes ●");
      sell.classList.toggle("on", !r.forbidden);
      sell.title = r.forbidden
        ? "Held from the market: it will not buy this from the town. Tap to let it."
        : "The market may buy this from the town. Tap to hold it back.";
      sell.setAttribute("aria-label", `${r.name}: ${sell.title}`);
      sell.onclick = () => this.onOrder("place.forbid", { good: r.good, on: !r.forbidden });
      if (lies) good.onclick = () => this.onOpen(lies);
      good.append(
        el("span", "place-row-name", `${r.name.charAt(0).toUpperCase()}${r.name.slice(1)}`),
        el(
          "span",
          "place-td-where",
          [
            r.stuff,
            ...r.where.slice(0, 3).map((w) => `${w.name} ${amount(w.n)}`),
            r.came > 0 ? `${amount(r.came)} in from its land today` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        ),
      );
      const held = el("span", "place-num");
      held.append(el("span", "", amount(r.held)), el("span", "place-unit", r.food ? " mo" : " u"));
      held.title = `${amount(r.held)} ${r.unit}`;
      const into = r.made + r.came,
        today = el("span", "place-num place-today");
      // (What rounds to nothing, said as such: not "0.00", which reads as none at all.)
      const small = (x: number) => (x > 0 && x < 0.005 ? "<0.01" : amount(x));
      today.append(
        el("span", into > 0 ? "up" : "", `+${small(into)}`),
        el("span", r.used > 0 ? "down" : "", `−${small(r.used)}`),
      );
      row.append(
        good,
        held,
        el(
          "span",
          `place-num${r.days !== null && r.days < 30 ? " short" : ""}`,
          r.days === null ? "—" : r.days >= 999 ? "999+ d" : `${Math.round(r.days)} d`,
        ),
        today,
        spark(r.trend),
        sell,
      );
      table.append(row);
    }
    this.sheetBody.replaceChildren(
      hold,
      table,
      ...(s.remedies ? [this.healerLine(s.remedies, true)] : []),
      el(
        "p",
        "place-more",
        "A month's food is what one person eats in a month. Held: the market will not buy it from the town; its own people still use it.",
      ),
    );
  }

  /** Its healer in a line (N9): who, what they are at, their remedies and the hurt; a tap opens them. */
  private healerLine(h: PlaceHealerRow, stocks: boolean): HTMLElement {
    const row = el("button", "place-row place-healer");
    row.onclick = () => this.onOpen(h.ref);
    row.append(
      el(
        "span",
        "place-row-name",
        stocks
          ? `Remedies: ${h.doses} of the ${h.wanted} doses its healer keeps`
          : `Healer: ${h.name}`,
      ),
      el(
        "span",
        `place-row-what${h.doses === 0 && h.festering > 0 ? " bad" : ""}`,
        stocks
          ? `Gathered about its fields by ${h.name}; a dose a day for each wound that festers (${h.festering} now)`
          : `${h.doing.charAt(0).toUpperCase()}${h.doing.slice(1)} · ${h.abed} hurt abed, ${h.festering} festering · ${h.doses} of ${h.wanted} doses`,
      ),
    );
    return row;
  }

  /** Its hands by trade and the share of them wanted at each, its priorities by name, its sites and its buildings' work. */
  work(s: PlaceWorkSheet): void {
    if (this.tab !== "work" || this.same([s, this.setting, this.gridOpen, this.gridOcc])) return;
    const all = s.hands.reduce((a, b) => a + b, 0),
      now = s.hands.map((n) => (all > 0 ? Math.round((1000 * n) / all) : 0)),
      shares = this.setting ?? (s.shares ? [...s.shares] : now),
      sum = shares.reduce((a, b) => a + b, 0),
      facts = el("div", "place-facts"),
      fact = (n: number, words: string, bad = false) => {
        const f = el("span", `place-fact${bad && n > 0 ? " bad" : ""}`);
        f.append(el("strong", "", String(n)), el("span", "", ` ${words}`));
        facts.append(f);
      };
    fact(all, "hands at trades");
    fact(s.leaders, "lead");
    fact(s.dependents, "keep no trade");
    fact(s.waiting, "waiting for stuff", true);
    fact(s.inWant, "in want", true);
    fact(s.abed, "abed", true);
    fact(s.unheeding, "too low to heed", true);
    const body: HTMLElement[] = [facts];
    if (s.healer) body.push(this.healerLine(s.healer, false));
    const table = el("div", "place-table place-share-table"),
      head = el("div", "place-tr place-th");
    for (const words of ["Trade", "Now", "Share wanted", ""]) head.append(el("span", "", words));
    table.append(head);
    PLACE_TRADES.forEach((words, k) => {
      const row = el("div", "place-tr"),
        less = el("button", "place-step", "−"),
        more = el("button", "place-step", "+"),
        step = (by: number) => {
          const next = [...shares];
          next[k] = Math.max(0, Math.min(1000, next[k]! + by));
          this.setting = next;
          this.drawn = "";
          this.work(s);
        },
        keys = el("span", "place-td-keys");
      less.setAttribute("aria-label", `A smaller share of hands to ${words.toLowerCase()}`);
      more.setAttribute("aria-label", `A larger share of hands to ${words.toLowerCase()}`);
      less.onclick = () => step(-50);
      more.onclick = () => step(50);
      keys.append(less, more);
      const share = sum > 0 ? Math.round((shares[k]! * 100) / sum) : 0;
      row.append(
        el("span", "place-row-name", words),
        el("span", "place-num", String(s.hands[k] ?? 0)),
        el("span", `place-num${this.setting ? " setting" : ""}`, `${share}%`),
        keys,
      );
      table.append(row);
    });
    body.push(table);
    // (A town no farmer lives in: its fields are its land's, worked from outside it.)
    if ((s.hands[0] ?? 0) === 0)
      body.push(
        el(
          "p",
          "place-more",
          "No farmer lives in the town: the fields about it are worked from its land's farms outside, and what they reap comes in on the Stocks sheet as brought in from its land. Shares moved to the fields put the town's own hands there.",
        ),
      );
    const keys = el("div", "place-line"),
      order = el("button", "place-order", "Apply"),
      free = el("button", "place-order", "Reset to the land's split");
    order.title = "Move hands between trades to the shares wanted: its land is told";
    free.title = "Let its hands be as its land would have them, with no order";
    order.disabled = !this.setting || sum <= 0;
    order.onclick = () => {
      // (The shares as thousandths, the largest taking what rounding leaves.)
      const out = shares.map((x) => Math.floor((1000 * x) / sum));
      out[out.indexOf(Math.max(...out))]! += 1000 - out.reduce((a, b) => a + b, 0);
      this.setting = null;
      this.onOrder("place.work", { shares: out });
    };
    free.disabled = !s.shares && !this.setting;
    free.onclick = () => {
      this.setting = null;
      this.onOrder("place.work", { shares: null });
    };
    keys.append(order, free);
    body.push(
      keys,
      el(
        "p",
        "place-more",
        this.setting
          ? "Not yet applied: Apply moves real hands from one trade to another, and its land is told."
          : s.shares
            ? `Applied. ${s.unsettled ? `${s.unsettled} changes are told to its land at the month's turn, or on leaving.` : "Its land has been told."} Those moved make what their new trade makes, by its land's own reckoning.`
            : "No order given: its hands are as its land has them.",
      ),
    );
    body.push(...this.grid(s));
    if (s.bills.length)
      body.push(
        el("h3", "place-sub", "Bills: how much of what it makes the town keeps"),
        billsEl(s.bills, this.onOrder, this.onOpen, true),
        el(
          "p",
          "place-more",
          "A maker whose good the town holds as much of as its bill asks turns to the first good billed that it holds less of, as one new to it; with none, they wait at home, or go to what their priorities name next.",
        ),
      );
    if (s.sites.length) {
      body.push(el("h3", "place-sub", "Going up"));
      const tonnes = (x: number) => (x >= 10 ? `${Math.round(x)}` : x.toFixed(1)),
        left = (m: number) =>
          m < 1.5
            ? "about a month more"
            : m < 18
              ? `about ${Math.round(m)} months more`
              : `about ${Math.round(m / 12)} years more`;
      for (const x of s.sites) {
        const name = el("button", "place-row place-site"),
          row = el("div", "place-line place-site-keys"),
          give = (hands: number | null) => this.onOrder("place.site", { ask: x.ask, hands }),
          bar = el("span", "place-site-bar"),
          fill = el("span", "place-site-fill");
        fill.style.width = `${Math.round(x.share * 100)}%`;
        bar.append(fill);
        name.append(
          el(
            "span",
            "place-row-name",
            `${x.name.charAt(0).toUpperCase()}${x.name.slice(1)}: ${Math.round(x.share * 100)}% · ${x.stage}`,
          ),
          el(
            "span",
            "place-row-what",
            x.raised
              ? "All it wants is done: it stands once its land is told."
              : x.stopped
                ? "Stopped, as its land's month stops it."
                : x.inHand
                  ? `${x.hands} hands by your order, ${x.busy} at it now · ${tonnes(x.lying)} t of ${x.stuff} on the site, ${tonnes(x.wants)} t still wanted · ${left(x.months)}`
                  : `By the town's month, ${x.hands} hands · ${tonnes(x.wants)} t of ${x.stuff} still wanted · ${left(x.months)}`,
          ),
          bar,
        );
        name.onclick = () => this.onOpen(x.ref);
        if (x.inHand) {
          const less = el("button", "place-step", "−"),
            more = el("button", "place-step", "+"),
            back = el("button", "place-order", "Give back");
          less.setAttribute("aria-label", `A hand fewer to the ${x.name}`);
          more.setAttribute("aria-label", `A hand more to the ${x.name}`);
          back.setAttribute(
            "aria-label",
            `Give the ${x.name} back to the town's month: its crew go back to their own work`,
          );
          less.disabled = x.hands <= 1;
          more.disabled = x.hands >= x.most;
          less.onclick = () => give(Math.max(1, x.hands - 1));
          more.onclick = () => give(Math.min(x.most, x.hands + 1));
          back.onclick = () => give(null);
          row.append(
            el("span", "place-line-words", `Hands: ${x.hands} of ${x.most} at most (${x.spares})`),
            less,
            more,
            back,
          );
        } else {
          const take = el("button", "place-order", "Take in hand");
          take.setAttribute(
            "aria-label",
            `Take the ${x.name} in hand: a crew of the town's own people carries to it and builds it`,
          );
          take.onclick = () => give(Math.min(x.most, Math.max(1, x.hands)));
          row.append(
            el("span", "place-line-words", "Left to the town's month, as in the world."),
            take,
          );
        }
        body.push(name, row);
      }
    }
    if (s.buildings.length) {
      body.push(el("h3", "place-sub", "Its buildings' work"));
      for (const b of s.buildings) {
        const row = el("div", "place-line"),
          name = el("button", "place-link", `${b.name}: ${b.working} work there`),
          key = el("button", "place-switch", b.shut ? "Stopped ○" : "Working ●");
        name.onclick = () => this.onOpen(b.ref);
        key.classList.toggle("on", !b.shut);
        key.setAttribute(
          "aria-label",
          `${b.name}: its work is ${b.shut ? "stopped. Tap to let it go on" : "going. Tap to stop it"}`,
        );
        key.onclick = () => this.onOrder("place.shut", { lot: b.lot, on: !b.shut });
        row.append(name, key);
        body.push(row);
      }
    }
    this.sheetBody.replaceChildren(...body);
  }

  /** Which of the Dangers sheet's orders have their words open (ⓘ). */
  private told = new Set<string>();
  /** What threatens the town, whom it has touched, and the orders against it: each a switch with what it gains and takes. */
  dangers(s: PlaceDangersSheet): void {
    if (this.tab !== "dangers" || this.same([s, [...this.told]])) return;
    const body: HTMLElement[] = [];
    if (!s.now.length) body.push(el("p", "place-more", "Nothing threatens the town now."));
    for (const x of s.now) {
      const words = `${x.icon} ${x.words}`;
      if (x.ref) {
        const b = el("button", "place-row place-danger", words),
          ref = x.ref;
        b.onclick = () => this.onOpen(ref);
        body.push(b);
      } else body.push(el("p", "place-line-words place-danger", words));
    }
    body.push(el("h3", "place-sub", "Your orders against them"));
    for (const r of s.responses) {
      const row = el("div", "place-line place-response-row"),
        key = el("button", "place-switch", r.on ? "On ●" : "Off ○"),
        info = el("button", "place-info", "ⓘ"),
        chips = el("span", "place-response-chips");
      key.classList.toggle("on", r.on);
      key.setAttribute(
        "aria-label",
        `${r.name}: ${r.on ? "kept. Tap to let it go" : "not kept. Tap to order it"}`,
      );
      key.onclick = () => this.onOrder("place.respond", { what: r.what, on: !r.on });
      info.setAttribute("aria-label", `${r.name}: what it does, in words`);
      info.classList.toggle("on", this.told.has(r.what));
      info.onclick = () => {
        if (this.told.has(r.what)) this.told.delete(r.what);
        else this.told.add(r.what);
        this.dangers(s);
      };
      chips.append(el("span", "place-gain", r.gain), el("span", "place-price", r.price));
      const name = el("span", "place-line-words");
      name.append(el("span", "place-row-name", r.name), chips);
      row.append(name, info, key);
      body.push(row);
      if (this.told.has(r.what))
        body.push(el("p", "place-more place-response", `${r.does} ${r.who} ${r.cost}`));
    }
    if (s.homeless.households > 0 || s.shelter.lot !== null) {
      body.push(el("h3", "place-sub", "Without a home"));
      const h = s.homeless,
        open = s.shelter.options.find((o) => o.lot === s.shelter.lot);
      body.push(
        el(
          "p",
          "place-line-words",
          h.households > 0
            ? `${h.households} ${h.households === 1 ? "household" : "households"} (${h.people} people) lost ${h.households === 1 ? "its home" : "their homes"} these two months. ${h.sheltered} of them shelter in a building; ${h.roofless > 0 ? `${h.roofless} have no roof and live in the square${h.cold >= 0.5 ? ", in bitter cold" : h.cold > 0 ? ", in the cold" : ", in mild air"}; ` : ""}the rest are taken in by others, where a home has room.`
            : "No household is without a home now.",
        ),
        el(
          "p",
          "place-more",
          open
            ? `The ${open.name} is opened to those who lose their homes. They go to a home again once one has room.`
            : "No building is opened to them. Open one:",
        ),
      );
      const chips = el("div", "place-chips");
      for (const o of s.shelter.options.slice(0, 8)) {
        const b = el("button", "place-chip", o.name);
        b.classList.toggle("on", o.lot === s.shelter.lot);
        b.setAttribute("aria-label", `Open the ${o.name} to those without a home`);
        b.onclick = () => this.onOrder("place.shelter", { lot: o.lot });
        chips.append(b);
      }
      if (s.shelter.lot !== null) {
        const none = el("button", "place-chip", "None");
        none.onclick = () => this.onOrder("place.shelter", { lot: null });
        chips.append(none);
      }
      body.push(chips);
    }
    if (s.hurt.length) {
      body.push(el("h3", "place-sub", "Lying hurt"));
      const list = el("div", "place-rows");
      for (const x of s.hurt) {
        const row = el("button", "place-row place-log-row");
        row.append(el("span", "place-row-name", x.name), el("span", "place-log-words", x.words));
        row.onclick = () => this.onOpen(x.ref);
        list.append(row);
      }
      body.push(list, el("p", "place-more", s.care));
    }
    body.push(
      el(
        "p",
        "place-more",
        "An order adds no rule: the town leans on an answer its world's peoples come to by loss, and the world's own reckoning of a fire, a sickness, a lean year or a battle reads it. With none, what comes is exactly what would have come.",
      ),
    );
    this.sheetBody.replaceChildren(...body);
  }

  /** Its log, day by day: what befell many at one hour of one kind is one line, each of them named and a tap away. */
  log(s: PlaceLogSheet): void {
    if (this.tab !== "log" || this.same(s)) return;
    const body: HTMLElement[] = [];
    if (s.unsettled > 0)
      body.push(
        el(
          "p",
          "place-more place-bookkeeping",
          `${s.unsettled} of its doings by its orders ${s.unsettled === 1 ? "is" : "are"} told to its land at the month's turn, or on leaving.`,
        ),
      );
    if (!s.rows.length) {
      body.push(
        el(
          "p",
          "place-more",
          "Nothing yet. What befalls its people is told here as it happens: births, deaths, comings and goings, sickness and hurt, and what your orders did.",
        ),
      );
      return void this.sheetBody.replaceChildren(...body);
    }
    let list: HTMLElement | null = null,
      day = "";
    const rows = s.rows;
    for (let k = 0; k < rows.length;) {
      const r = rows[k]!;
      if (r.day !== day || !list) {
        day = r.day;
        list = el("div", "place-rows");
        body.push(el("h3", "place-sub", day), list);
      }
      if (!r.ref) {
        // (A count of the many of a kind: no page of its own.)
        list.append(el("p", "place-more place-log-more", r.words));
        k++;
        continue;
      }
      // (Those of one kind at one hour of one day: one line.)
      const hour = Math.floor((((r.t % 86_400) + 86_400) % 86_400) / 3600);
      let j = k + 1;
      while (
        j < rows.length &&
        rows[j]!.ref &&
        rows[j]!.day === r.day &&
        rows[j]!.what === r.what &&
        Math.floor((((rows[j]!.t % 86_400) + 86_400) % 86_400) / 3600) === hour
      )
        j++;
      const group = rows.slice(k, j),
        entry = el("div", "place-log-entry"),
        top = el("div", "place-log-top");
      top.append(
        el("span", "place-log-hour", `${String(hour).padStart(2, "0")}:00`),
        el("span", "place-log-icon", HAP_ICONS[r.what] ?? "•"),
        el("span", "place-log-words", group.length > 1 ? `${group.length} ${r.many}` : ""),
      );
      entry.append(top);
      const names = el("div", "place-log-names");
      for (const x of group) {
        const b = el("button", "place-link", x.name),
          ref = x.ref!;
        b.dataset.ref = ref;
        b.onclick = () => this.onOpen(ref);
        names.append(b);
        if (group.length === 1) names.append(el("span", "place-log-told", ` ${x.told}`));
      }
      entry.append(names);
      list.append(entry);
      k = j;
    }
    this.sheetBody.replaceChildren(...body);
  }

  /** What it could raise now and what it would take; what it cannot, each with why; what is going up already. */
  build(o: TownOffers | null): void {
    if (this.tab !== "build" || this.same(o)) return;
    if (!o)
      return void this.sheetBody.replaceChildren(
        el("p", "place-more", "Nothing can be raised here."),
      );
    const body: HTMLElement[] = [];
    if (o.shut) body.push(el("p", "place-line-words place-danger", o.shut));
    if (o.asked.length) {
      body.push(el("h3", "place-sub", "Asked already"));
      for (const a of o.asked) {
        const b = el("button", "place-row place-log-row");
        b.append(el("span", "place-log-words", a.words));
        b.onclick = () => this.onOpen(a.ref);
        body.push(b);
      }
    }
    body.push(el("h3", "place-sub", `Can be raised now (${o.raises.length})`));
    if (!o.raises.length)
      body.push(el("p", "place-more", "Nothing, now: see below for why each is not."));
    for (const r of o.raises) {
      const row = el("div", "place-line place-build-row"),
        go = el("button", "place-order", "Raise"),
        words = el("span", "place-line-words");
      go.setAttribute("aria-label", `Raise ${r.name}`);
      go.onclick = () => this.onOrder("town.ask", { kind: "raise", what: r.what });
      words.append(
        el("span", "place-row-name", `${r.icon} ${r.name}`),
        el("span", "place-row-what", r.note),
      );
      row.append(words, go);
      body.push(row);
    }
    if (o.no.length) {
      body.push(el("h3", "place-sub", `Not now (${o.no.length})`));
      const list = el("div", "place-table place-not-table");
      for (const n of o.no) {
        const row = el("div", "place-tr");
        row.append(el("span", "place-row-name", n.name), el("span", "place-row-what", n.why));
        list.append(row);
      }
      body.push(list);
    }
    body.push(
      el(
        "p",
        "place-more",
        `${o.who} What is raised goes up by the town's own month, fed and tooled from its land's stores; take it in hand on the Work sheet to put a crew of its people to it yourself.`,
      ),
    );
    this.sheetBody.replaceChildren(...body);
  }
}

/** A good's last thirty days of stock as a line (an empty cell where fewer than two are known). */
function spark(values: readonly number[]): HTMLElement {
  const box = el("span", "place-spark");
  if (values.length < 2) {
    box.textContent = "·";
    box.title = "Not yet: a point a day while you look";
    return box;
  }
  // (A line that moves by less than a fiftieth of what is held is drawn flat: not its noise blown up to the box.)
  const W = 44,
    H = 18,
    top = Math.max(...values.map(Math.abs), 1e-9),
    flat = Math.max(...values) - Math.min(...values) < top / 50,
    lo = flat ? Math.min(...values) - top : Math.min(...values),
    hi = flat ? Math.max(...values) + top : Math.max(...values, lo + 1e-9),
    pts = values
      .map(
        (v, k) =>
          `${((k / (values.length - 1)) * W).toFixed(1)},${(H - 1 - ((v - lo) / (hi - lo)) * (H - 2)).toFixed(1)}`,
      )
      .join(" "),
    NS = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(NS, "svg"),
    line = document.createElementNS(NS, "polyline");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", String(W));
  svg.setAttribute("height", String(H));
  line.setAttribute("points", pts);
  line.setAttribute("fill", "none");
  line.setAttribute(
    "stroke",
    flat ? "#c8d4ff" : values.at(-1)! >= values[0]! ? "#8ff0b0" : "#ffa08a",
  );
  line.setAttribute("stroke-width", "1.5");
  svg.append(line);
  box.append(svg);
  box.title = `${values.length} days: from ${amount(values[0]!)} to ${amount(values.at(-1)!)}`;
  return box;
}

/** A happening's sign in the log (host/place.ts HAP's order). */
const HAP_ICONS: readonly string[] = [
  "👶",
  "⚰️",
  "🚶",
  "👋",
  "⚒️",
  "💀",
  "📋",
  "🤒",
  "🤕",
  "💚",
  "📋",
  "🏠",
  "😠",
  "🫙",
  "🏗️",
  "🏗️",
  "🏚️",
  "💀",
  "🤕",
  "⚔️",
  "🩸",
  "🌾",
  "☠️",
  "🛡️",
  "🛡️",
  "🏠",
  "⛺",
  "🩹",
  "💞",
  "⚱️",
  "🎉",
  "🏛️",
];
