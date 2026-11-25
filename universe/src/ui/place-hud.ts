// A town entered (town mode): the mode's own chrome over the town, in place of the god game's. One row at the top (the
// town, its clock, the paces a day is watched at, the way out); a line under it for what wants the manager's eye, that
// can be closed; six tabs at the foot, each opening a sheet: its people by who is most pressed, its stocks good by
// good, its hands by trade and the orders that move them (and what is going up), what it can raise, what threatens it
// and the orders against that, and its log day by day. Phone first: every key a finger's size,
// nothing over anything. What it shows is told by the page that owns it (app/townplace.ts); it asks for nothing itself.
import {
  PLACE_TRADES,
  type PlaceDangersSheet,
  type PlaceNotice,
  type PlacePeopleSheet,
  type PlaceStocksSheet,
  type PlaceLogSheet,
  type PlaceWorkSheet,
  type TownOffers,
} from "../bridge/index.ts";
import { el } from "./why.ts";

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
const PACES: readonly (readonly [string, number, string])[] = [
  ["⏸", 0, "Stop the town's clock"],
  ["1m", 60, "A minute of the town's day a second"],
  ["10m", 600, "Ten minutes of the town's day a second"],
  ["1h", 3600, "An hour of the town's day a second"],
];
const NEEDS = ["hungry", "tired", "cold", "lonely"];
/** What one can be put to by name: the world's occupation column and its word (null: let be). */
const ORDER_TRADES: readonly (readonly [number | null, string])[] = [
  [2, "Fields"],
  [3, "Herds"],
  [4, "Crafts"],
  [5, "Hauling"],
  [null, "Let be"],
];
const TRADE_CHIPS: readonly (readonly [number | null, string])[] = [
  [null, "All"],
  [2, "Farmers"],
  [3, "Herders"],
  [4, "Crafters"],
  [5, "Traders"],
  [6, "Leaders"],
  [0, "No trade"],
];

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

export class PlaceHud {
  readonly element = el("div", "place-hud");
  private readonly name = el("span", "place-name");
  private readonly clock = el("span", "place-clock");
  private readonly paces: HTMLButtonElement[] = [];
  private readonly notice = el("div", "place-notice");
  private readonly noticeText = el("button", "place-notice-text");
  private readonly sheet = el("section", "place-sheet");
  private readonly sheetTitle = el("h2");
  private readonly sheetBody = el("div", "place-sheet-body");
  private readonly tabs = new Map<PlaceTab, HTMLButtonElement>();
  private readonly closed = new Set<string>();
  private noticeNow: PlaceNotice | null = null;
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
  onPace: (seconds: number) => void = () => {};
  onLeave: () => void = () => {};
  /** A tab opened, or the sheet closed (null). */
  onTab: (tab: PlaceTab | null) => void = () => {};
  /** A page asked for. */
  onOpen: (ref: string) => void = () => {};
  /** An order given: the command and what it asks. */
  onOrder: (type: string, args: Record<string, unknown>) => void = () => {};

  constructor(root: HTMLElement) {
    const bar = el("header", "place-bar"),
      keys = el("span", "place-paces");
    for (const [words, seconds, say] of PACES) {
      const b = el("button", "place-pace", words);
      b.title = say;
      b.setAttribute("aria-label", say);
      b.dataset.pace = String(seconds);
      b.onclick = () => this.onPace(seconds);
      this.paces.push(b);
      keys.append(b);
    }
    const leave = el("button", "place-leave", "Leave");
    leave.title = "Leave the town to the world: it is kept as it is, and goes on from here";
    leave.onclick = () => this.onLeave();
    bar.append(this.name, this.clock, keys, leave);
    const shut = el("button", "place-notice-shut", "×");
    shut.setAttribute("aria-label", "Put this notice away");
    shut.onclick = () => {
      if (this.noticeNow) this.closed.add(this.noticeNow.key);
      this.notices(this.lastNotices);
    };
    this.noticeText.onclick = () => {
      if (this.noticeNow?.ref) this.onOpen(this.noticeNow.ref);
    };
    this.notice.append(this.noticeText, shut);
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
    this.element.append(bar, this.notice, this.sheet, foot);
    this.element.hidden = true;
    root.append(this.element);
  }

  get shown(): boolean {
    return !this.element.hidden;
  }
  show(town: string): void {
    this.name.textContent = town;
    this.element.hidden = false;
    this.closed.clear();
    document.body.classList.add("placing");
  }
  hide(): void {
    this.element.hidden = true;
    this.open(null, false);
    document.body.classList.remove("placing");
  }

  /** A sheet opened (null: closed). */
  open(tab: PlaceTab | null, tell = true): void {
    this.tab = tab;
    this.setting = null;
    this.drawn = "";
    this.sheet.hidden = tab === null;
    for (const [k, b] of this.tabs) b.classList.toggle("on", k === tab);
    if (tab) {
      this.sheetTitle.textContent = TABS.find((x) => x[0] === tab)![2];
      this.sheetBody.replaceChildren(el("p", "place-wait", "…"));
    }
    if (tell) this.onTab(tab);
  }

  /** Its clock and the pace it runs at. */
  time(t: number, pace: number): void {
    const hour = Math.floor((((t % 86_400) + 86_400) % 86_400) / 3600),
      minute = Math.floor((((t % 3600) + 3600) % 3600) / 60),
      words = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    if (this.clock.textContent !== words) this.clock.textContent = words;
    for (const b of this.paces) b.classList.toggle("on", Number(b.dataset.pace) === pace);
  }

  private lastNotices: readonly PlaceNotice[] = [];
  /** What wants the manager's eye: the first not put away. */
  notices(list: readonly PlaceNotice[]): void {
    this.lastNotices = list;
    const now = list.find((n) => !this.closed.has(n.key)) ?? null;
    this.noticeNow = now;
    if (this.notice.hidden !== !now) this.notice.hidden = !now;
    if (now && this.noticeText.textContent !== now.words) this.noticeText.textContent = now.words;
  }
  /** What the notice line tells now (the look tools; null: nothing). */
  get noticed(): string | null {
    return this.notice.hidden ? null : (this.noticeText.textContent ?? "");
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

  people(s: PlacePeopleSheet): void {
    if (this.tab !== "people" || this.same([s, this.occ])) return;
    const chips = el("div", "place-chips");
    for (const [occ, words] of TRADE_CHIPS) {
      const n = occ === null ? s.trades.reduce((a, b) => a + b, 0) : (s.trades[occ] ?? 0);
      if (occ !== null && n <= 0) continue;
      const b = el("button", "place-chip", `${words} ${n}`);
      b.classList.toggle("on", this.occ === occ);
      b.onclick = () => {
        this.occ = occ;
        this.drawn = "";
        this.onTab("people");
      };
      chips.append(b);
    }
    const list = el("div", "place-rows");
    for (const r of s.rows) {
      const row = el("button", "place-row"),
        worst = r.needs[r.worst] ?? 0,
        bar = el("span", "place-need");
      bar.style.setProperty("--full", `${Math.round(worst * 100)}%`);
      bar.classList.toggle("high", worst >= 0.9);
      bar.title = `${NEEDS[r.worst]} ${Math.round(worst * 100)}%`;
      row.append(
        el("span", "place-row-name", r.name),
        el(
          "span",
          "place-row-what",
          `${r.trade}${r.bound ? " (by order)" : ""} · ${r.doing}${r.lack > 0 ? ` · ${r.lack} d in want` : ""}${r.health === 1 ? " · hurt" : r.health === 2 ? " · sick" : r.health === 3 ? " · mending" : ""} · mood ${r.mood > 0 ? "+" : ""}${r.mood}`,
        ),
        el("span", "place-need-word", `${NEEDS[r.worst]} ${Math.round(worst * 100)}%`),
        bar,
      );
      row.onclick = () => this.onOpen(r.ref);
      // (An order for them by name: the trade they are put to, or let be.)
      const one = el("div", "place-person"),
        key = el("button", "place-row-order", "⚒"),
        words = `Give ${r.name} an order`;
      key.title = words;
      key.setAttribute("aria-label", words);
      key.classList.toggle("on", this.ordering === r.id);
      key.onclick = () => {
        this.ordering = this.ordering === r.id ? null : r.id;
        this.drawn = "";
        this.people(s);
      };
      one.append(row, key);
      if (this.ordering === r.id) {
        const keys = el("div", "place-person-orders");
        ORDER_TRADES.forEach(([occ, name]) => {
          const b = el("button", "place-chip", name);
          b.classList.toggle("on", occ !== null && r.bound !== null && r.occ === occ);
          b.onclick = () => {
            this.ordering = null;
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
        ? [el("p", "place-more", `and ${s.all - s.rows.length} more, less pressed`)]
        : [];
    this.sheetBody.replaceChildren(chips, list, ...more);
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
    top.append(el("span", "place-grid-name", "Name · skill"));
    for (const kind of s.grid.kinds) top.append(el("span", "place-grid-kind", kind));
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
      r.kinds.forEach((x, k) => {
        const key = el("button", "place-grid-key", x > 0 ? String(4 - x) : "–"),
          // (A tap takes it on: never, first, second, third, never. One's last trade is not set to never.)
          trades = r.kinds.slice(0, 4),
          only = k < 4 && trades.filter((y) => y > 0).length === 1 && x > 0,
          next = x === 0 ? 3 : x === 1 ? (only ? 3 : 0) : x - 1,
          words = `${r.name}, ${s.grid.kinds[k]}: ${x > 0 ? ["", "third", "second", "first"][x] : "never"}. Tap for ${next > 0 ? ["", "third", "second", "first"][next] : "never"}`;
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
        `${more}1 is first. The trade set highest is the one they keep, and its land is told when it changes; a lower one is what they turn to, as one new to it, when their own has nothing for them. Building is who a site's crew is made up of first. Faint keys are as they are of themselves.`,
      ),
    ];
  }

  stocks(s: PlaceStocksSheet): void {
    if (this.tab !== "stocks" || this.same(s)) return;
    const hold = el("div", "place-line"),
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
        `Food for ${Math.round(s.foodDays)} days. The granary holds back ${s.hold} ${s.hold === 1 ? "month" : "months"} of it from households.`,
      ),
      less,
      more,
    );
    const list = el("div", "place-rows");
    for (const r of s.rows) {
      const row = el("div", "place-stock"),
        head = el("div", "place-stock-head"),
        sell = el("button", "place-sell", r.forbidden ? "Held" : "Sold");
      sell.classList.toggle("on", r.forbidden);
      sell.title = r.forbidden
        ? "The market will not let this go. Tap to allow it."
        : "The market lets this go. Tap to forbid it.";
      sell.setAttribute("aria-label", `${r.name}: ${sell.title}`);
      sell.onclick = () => this.onOrder("place.forbid", { good: r.good, on: !r.forbidden });
      head.append(
        el("span", "place-row-name", `${r.name.charAt(0).toUpperCase()}${r.name.slice(1)}`),
        el("span", "place-stock-held", `${amount(r.held)}${r.food ? " mo" : ""}`),
        el("span", "place-stock-day", `today +${amount(r.made + r.came)} −${amount(r.used)}`),
        sell,
      );
      const where = el("div", "place-stock-where");
      if (r.stuff) where.append(el("span", "place-stuff", `${r.stuff} · `));
      // (What its land brings in: the town's share of what is won outside it.)
      if (r.came > 0)
        where.append(el("span", "place-stuff", `${amount(r.came)} brought in from its land · `));
      r.where.slice(0, 4).forEach((w, k) => {
        if (k) where.append(", ");
        const words = `${w.name} ${amount(w.n)}`;
        if (w.ref) {
          const a = el("button", "place-link", words),
            ref = w.ref;
          a.onclick = () => this.onOpen(ref);
          where.append(a);
        } else where.append(words);
      });
      row.append(head, where);
      list.append(row);
    }
    this.sheetBody.replaceChildren(hold, list);
  }

  work(s: PlaceWorkSheet): void {
    if (this.tab !== "work" || this.same([s, this.setting, this.gridOpen, this.gridOcc])) return;
    const all = s.hands.reduce((a, b) => a + b, 0),
      now = s.hands.map((n) => (all > 0 ? Math.round((1000 * n) / all) : 0)),
      shares = this.setting ?? (s.shares ? [...s.shares] : now),
      body: HTMLElement[] = [
        el(
          "p",
          "place-line-words",
          `${all} grown hands at trades an order can move; ${s.leaders} lead, ${s.dependents} keep no trade. ${s.waiting} wait at their work; ${s.inWant} have gone a day or more in want; ${s.abed} lie abed, hurt or sick; ${s.unheeding} are too low in mood to heed an order.`,
        ),
      ];
    PLACE_TRADES.forEach((words, k) => {
      const row = el("div", "place-line"),
        less = el("button", "place-step", "−"),
        more = el("button", "place-step", "+"),
        step = (by: number) => {
          const next = [...shares];
          next[k] = Math.max(0, Math.min(1000, next[k]! + by));
          this.setting = next;
          this.drawn = "";
          this.work(s);
        };
      less.setAttribute("aria-label", `Fewer hands to ${words}`);
      more.setAttribute("aria-label", `More hands to ${words}`);
      less.onclick = () => step(-50);
      more.onclick = () => step(50);
      row.append(
        el(
          "span",
          "place-line-words",
          `${words}: ${s.hands[k]} now · ${Math.round(shares[k]! / 10)} parts`,
        ),
        less,
        more,
      );
      body.push(row);
    });
    const sum = shares.reduce((a, b) => a + b, 0),
      keys = el("div", "place-line"),
      order = el("button", "place-order", "Give the order"),
      free = el("button", "place-order", "As the land has them");
    order.disabled = !this.setting || sum <= 0;
    order.onclick = () => {
      // (The parts as shares of a thousand, the last taking what rounding leaves.)
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
        s.shares
          ? `Ordered. ${s.unsettled ? `${s.unsettled} changes are told to its land at the month's turn, or on leaving.` : "Its land has been told."} Those moved make what their new trade makes, by its land's own reckoning.`
          : "No order given: its hands are as its land has them. An order moves real hands from one trade to another, and its land is told.",
      ),
    );
    body.push(...this.grid(s));
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
          give = (hands: number | null) => this.onOrder("place.site", { ask: x.ask, hands });
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
          key = el("button", "place-sell", b.shut ? "Stopped" : "Going");
        name.onclick = () => this.onOpen(b.ref);
        key.classList.toggle("on", b.shut);
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

  /** What threatens the town, whom it has touched, and the orders against it. */
  dangers(s: PlaceDangersSheet): void {
    if (this.tab !== "dangers" || this.same(s)) return;
    const body: HTMLElement[] = [];
    for (const x of s.now) {
      const words = `${x.icon} ${x.words}`;
      if (x.ref) {
        const b = el("button", "place-row place-danger", words),
          ref = x.ref;
        b.onclick = () => this.onOpen(ref);
        body.push(b);
      } else body.push(el("p", "place-line-words place-danger", words));
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
            : "No building is opened to them: those who lose their homes go in with others where a home has room, and into the square where none has. Open one:",
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
    body.push(el("h3", "place-sub", "Your orders against them"));
    for (const r of s.responses) {
      const row = el("div", "place-line"),
        key = el("button", "place-sell", r.on ? "Kept" : "Not kept");
      key.classList.toggle("on", r.on);
      key.setAttribute(
        "aria-label",
        `${r.name}: ${r.on ? "kept. Tap to let it go" : "not kept. Tap to order it"}`,
      );
      key.onclick = () => this.onOrder("place.respond", { what: r.what, on: !r.on });
      row.append(el("span", "place-line-words place-row-name", r.name), key);
      body.push(row, el("p", "place-more place-response", `${r.does} ${r.who} ${r.cost}`));
    }
    body.push(
      el(
        "p",
        "place-more",
        "An order adds no rule: the town leans wholly on an answer its world's peoples come to by loss, and the world's own reckoning of a fire, a sickness, a lean year or a battle reads it. With no order, what comes is exactly what would have come.",
      ),
    );
    this.sheetBody.replaceChildren(...body);
  }

  log(s: PlaceLogSheet): void {
    if (this.tab !== "log" || this.same(s)) return;
    if (!s.rows.length)
      return void this.sheetBody.replaceChildren(
        el(
          "p",
          "place-more",
          "Nothing yet. What befalls its people is told here as it happens: births, deaths, comings and goings, sickness and hurt, and what your orders did.",
        ),
      );
    // Day by day, the latest first: each day under its own head, a line to a happening.
    const body: HTMLElement[] = [];
    let list: HTMLElement | null = null,
      day = "";
    for (const r of s.rows) {
      if (r.day !== day || !list) {
        day = r.day;
        list = el("div", "place-rows");
        body.push(el("h3", "place-sub", day), list);
      }
      const hour = Math.floor((((r.t % 86_400) + 86_400) % 86_400) / 3600),
        ref = r.ref;
      if (!ref) {
        // (A count of the many of a kind: no page of its own.)
        list.append(el("p", "place-more place-log-more", r.words));
        continue;
      }
      const row = el("button", "place-row place-log-row");
      row.append(
        el("span", "place-row-what", `${String(hour).padStart(2, "0")}:00`),
        el("span", "place-log-words", r.words),
      );
      row.onclick = () => this.onOpen(ref);
      list.append(row);
    }
    this.sheetBody.replaceChildren(...body);
  }

  build(o: TownOffers | null): void {
    if (this.tab !== "build" || this.same(o)) return;
    if (!o)
      return void this.sheetBody.replaceChildren(
        el("p", "place-more", "Nothing can be raised here."),
      );
    const body: HTMLElement[] = [];
    if (o.shut) body.push(el("p", "place-more", o.shut));
    for (const a of o.asked) {
      const b = el("button", "place-row");
      b.append(el("span", "place-row-name", "Under way"), el("span", "place-row-what", a.words));
      b.onclick = () => this.onOpen(a.ref);
      body.push(b);
    }
    for (const r of o.raises) {
      const row = el("div", "place-line"),
        go = el("button", "place-order", "Raise");
      go.setAttribute("aria-label", `Raise ${r.name}`);
      go.onclick = () => this.onOrder("town.ask", { kind: "raise", what: r.what });
      row.append(el("span", "place-line-words", `${r.icon} ${r.name}: ${r.note}`), go);
      body.push(row);
    }
    if (o.no.length) {
      body.push(el("h3", "place-sub", "Not now"));
      for (const n of o.no) body.push(el("p", "place-more", `${n.name}: ${n.why}`));
    }
    body.push(
      el(
        "p",
        "place-more",
        `${o.who} What is raised goes up by the town's own month, fed and tooled from its land's stores. Take it in hand on the Work sheet to put a crew of its people to it yourself.`,
      ),
    );
    this.sheetBody.replaceChildren(...body);
  }
}
