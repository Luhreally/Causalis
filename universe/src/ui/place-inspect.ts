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
  PlaceInspectLot,
  PlaceInspectPerson,
  PlaceNamed,
  PlaceNeed,
} from "../bridge/index.ts";
import { drawPortrait } from "./portrait.ts";
import { drawBody } from "./body.ts";
import { el } from "./why.ts";

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

export class PlaceInspector {
  readonly element = el("section", "place-insp");
  private readonly handle = el("button", "place-insp-handle");
  private readonly portrait = el("canvas", "place-insp-portrait");
  private readonly title = el("h2", "place-insp-name");
  private readonly sub = el("p", "place-insp-sub");
  private readonly followKey = el("button", "place-insp-key place-insp-follow", "🎯");
  private readonly proseKey = el("button", "place-insp-key place-insp-info", "ⓘ");
  private readonly pageKey = el("button", "place-insp-key place-insp-page", "📄");
  private readonly body = el("div", "place-insp-body");
  /** What is inspected now (null: nothing), and the last reading of it. */
  ref: string | null = null;
  now: PlaceInspect | null = null;
  height: InspectHeight = "peek";
  private tab: PersonTab = "now";
  private prose = false;
  private ordering = false;
  private drawn = "";
  private pictured = "";
  /** Whether orders may be given (by hand or by its head: not in a town watched). */
  orders = true;
  /** Whether the eye keeps with whom it shows. */
  following = false;
  onClose: () => void = () => {};
  onHeight: (h: InspectHeight) => void = () => {};
  /** Another inspected: one of its people or a lot (their ref). */
  onInspect: (ref: string) => void = () => {};
  /** The god game's full page of it. */
  onPage: (ref: string) => void = () => {};
  onFollow: (on: boolean) => void = () => {};
  onOrder: (type: string, args: Record<string, unknown>) => void = () => {};

  constructor(root: HTMLElement) {
    this.handle.title = "Taller or shorter";
    this.handle.setAttribute("aria-label", "Show more of it, or less");
    this.handle.onclick = () =>
      this.setHeight(HEIGHTS[(HEIGHTS.indexOf(this.height) + 1) % HEIGHTS.length]!);
    this.followKey.onclick = () => this.onFollow(!this.following);
    this.proseKey.title = "What these numbers mean, in words";
    this.proseKey.setAttribute("aria-label", this.proseKey.title);
    this.proseKey.onclick = () => {
      this.prose = !this.prose;
      this.redraw();
    };
    this.pageKey.title = "Its whole page, as the world tells it";
    this.pageKey.setAttribute("aria-label", this.pageKey.title);
    this.pageKey.onclick = () => this.now && this.onPage(this.now.ref);
    const shut = el("button", "place-insp-key place-insp-shut", "×");
    shut.setAttribute("aria-label", "Close");
    shut.onclick = () => this.onClose();
    const head = el("header", "place-insp-head"),
      names = el("div", "place-insp-names"),
      keys = el("div", "place-insp-keys");
    this.portrait.width = this.portrait.height = PORTRAIT;
    names.append(this.title, this.sub);
    keys.append(this.followKey, this.proseKey, this.pageKey, shut);
    head.append(this.portrait, names, keys);
    this.element.append(this.handle, head, this.body);
    // (A finger down on it: nothing under it is drawn anew till it is up, or the key pressed is gone when it ends.)
    this.body.addEventListener("pointerdown", () => (this.held = performance.now() + 800));
    for (const up of ["pointerup", "pointercancel"])
      this.body.addEventListener(up, () => (this.held = performance.now() + 60));
    this.element.hidden = true;
    root.append(this.element);
  }
  private held = 0;

  get shown(): boolean {
    return !this.element.hidden;
  }
  /** Opened on what a ref names (null: closed); what it shows comes when it is read. */
  open(ref: string | null): void {
    if (ref !== this.ref) {
      this.tab = "now";
      this.ordering = false;
      this.prose = false;
      this.drawn = "";
      this.now = null;
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
    this.onHeight(h);
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
    if (performance.now() < this.held) return;
    this.now = x;
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
    ]);
    if (key === this.drawn) return;
    this.drawn = key;
    this.element.dataset.kind = x.kind;
    this.followKey.hidden = x.kind !== "person";
    this.followKey.classList.toggle("on", this.following);
    const fw = this.following ? "Let them go: the eye stays" : "Keep the eye with them";
    this.followKey.title = fw;
    this.followKey.setAttribute("aria-label", fw);
    this.proseKey.classList.toggle("on", this.prose);
    if (x.kind === "person") this.person(x);
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
    // The first screen: what they are at, their mood, how they are, their needs.
    const now = el("p", "place-insp-now", x.now);
    body.push(now, this.moodBar(x));
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
    const needs = el("div", "place-insp-needs");
    for (const n of x.needs) needs.append(this.needBar(n, x.serves));
    body.push(needs);
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
    }
    // The tabs, and the one open.
    const tabs = el("div", "place-insp-tabs");
    for (const [t, words] of PERSON_TABS) {
      const b = el("button", "place-insp-tab", words);
      b.dataset.tab = t;
      b.classList.toggle("on", this.tab === t);
      b.onclick = () => {
        this.tab = t;
        if (this.height === "peek") this.setHeight("half");
        this.redraw();
      };
      tabs.append(b);
    }
    body.push(tabs);
    if (this.tab === "now") {
      body.push(el("p", "place-insp-why", x.why));
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
        const row = el("div", `place-insp-thought ${t.size >= 0 ? "up" : "down"}`);
        row.append(
          el("span", "place-insp-thought-icon", t.icon),
          el("span", "place-insp-thought-words", t.words),
          el("span", "place-insp-thought-size", signed(t.size)),
          el(
            "span",
            "place-insp-thought-days",
            t.days === null ? "while it lasts" : `${t.days} ${t.days === 1 ? "day" : "days"} more`,
          ),
        );
        list.append(row);
      }
      body.push(list, el("p", "place-insp-why", `Temper: ${x.temper}.`));
    } else if (this.tab === "skills") {
      if (!x.skills.length) body.push(el("p", "place-insp-why", "A child: they keep no work yet."));
      else {
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
            `${x.taught ? `★ ${x.taught}. ` : ""}Each hour at a kind of work is an hour of skill at it, kept when they turn to another (a master has given 8,000).`,
          ),
        );
      }
    } else if (this.tab === "health") {
      // (Their figure, each member not whole marked on it and named; then how they are, line by line.)
      const row = el("div", "place-insp-health-box"),
        canvas = el("canvas", "place-insp-body");
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
    } else if (this.tab === "social") {
      const named: PlaceNamed[] = [
        ...(x.mate ? [x.mate] : []),
        ...(x.friend ? [x.friend] : []),
        ...x.household.filter((h) => h.id !== x.mate?.id),
      ];
      if (named.length) body.push(this.people(named));
      else
        body.push(
          el("p", "place-insp-why", "No one lives with them, and they have no friend yet."),
        );
    } else if (this.tab === "gear") {
      body.push(this.facts(x.gear.map(([a, b]) => [a, b, null] as const)));
    } else if (this.tab === "life") {
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
          ["Temper", x.temper, null],
          ...(x.mark ? [["Bears", x.mark, null] as const] : []),
        ]),
      );
      if (x.skillWords) body.push(el("p", "place-insp-why", x.skillWords));
    }
    if (this.prose) {
      const box = el("div", "place-insp-prose");
      for (const line of [...x.prose, x.temperWords]) box.append(el("p", "", line));
      body.push(box);
    }
    this.body.replaceChildren(...body);
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
    mark.title = `Below ${x.breakAt} they heed no order`;
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
    row.title = `${n.name}: ${Math.round(n.level * 100)}% full, pressing ${Math.round(n.press * 100)}%. Past the mark it is seen to before work.`;
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
      if (ref) {
        const b = el("button", "place-link", words);
        b.onclick = () => this.onInspect(ref);
        box.append(b);
      } else box.append(el("span", "place-insp-fact", words));
    }
    return box;
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
