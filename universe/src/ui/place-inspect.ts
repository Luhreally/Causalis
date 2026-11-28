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
  PlaceInspectBound,
  PlaceInspectFaith,
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

export class PlaceInspector {
  readonly element = el("section", "place-insp");
  private readonly handle = el("button", "place-insp-handle");
  private readonly portrait = el("canvas", "place-insp-portrait");
  private readonly title = el("h2", "place-insp-name");
  private readonly sub = el("p", "place-insp-sub");
  private readonly followKey = el("button", "place-insp-key place-insp-follow", "🎯");
  /** Back to whom or what was inspected before, the eye where it was (from the first: closed); and forward again. */
  private readonly backKey = el("button", "place-insp-key place-insp-back", "‹");
  private readonly aheadKey = el("button", "place-insp-key place-insp-ahead", "›");
  private readonly proseKey = el("button", "place-insp-key place-insp-info", "ⓘ");
  private readonly pageKey = el("button", "place-insp-key place-insp-page", "📖");
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
  onBack: () => void = () => {};
  onAhead: () => void = () => {};
  onHeight: (h: InspectHeight) => void = () => {};
  /** Another inspected: one of its people or a lot (their ref). */
  onInspect: (ref: string) => void = () => {};
  /** The town's plan, as its view holds it: its fields' page is laid off it (O6). */
  plan: () => VillagePlan | null = () => null;
  /** The god game's full page of it. */
  onPage: (ref: string) => void = () => {};
  onFollow: (on: boolean) => void = () => {};
  onOrder: (type: string, args: Record<string, unknown>) => void = () => {};
  /** One of its people followed in full by word, or let go of (tiers). */
  onPin: (id: number, on: boolean) => void = () => {};

  constructor(root: HTMLElement) {
    this.handle.title = "Taller or shorter";
    this.handle.setAttribute("aria-label", "Show more of it, or less");
    this.handle.onclick = () =>
      this.setHeight(HEIGHTS[(HEIGHTS.indexOf(this.height) + 1) % HEIGHTS.length]!);
    this.followKey.onclick = () => this.onFollow(!this.following);
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
    const shut = el("button", "place-insp-key place-insp-shut", "×");
    shut.setAttribute("aria-label", "Close");
    shut.onclick = () => this.onClose();
    const head = el("header", "place-insp-head"),
      names = el("div", "place-insp-names"),
      keys = el("div", "place-insp-keys");
    this.portrait.width = this.portrait.height = PORTRAIT;
    names.append(this.title, this.sub);
    keys.append(this.followKey, this.proseKey, this.pageKey, shut);
    head.append(this.portrait, names);
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
    // (How closely they are followed, and a key to follow them in full for good, or let them be. Tiers.)
    const tier = el("div", "place-insp-tier"),
      fixed = x.tier.pinned && !x.tier.soft,
      pin = el(
        "button",
        `place-insp-pin${fixed ? " on" : ""}`,
        fixed ? "★ Followed" : "☆ Follow closely",
      );
    tier.append(
      el(
        "span",
        "place-insp-tier-words",
        `${cap(x.tier.words)}${x.tier.pinned ? (fixed ? ", by your word" : ", while looked at") : ""}`,
      ),
      pin,
    );
    pin.setAttribute("aria-pressed", String(fixed));
    pin.title = fixed
      ? `Let ${x.name} be followed as the town's story has them`
      : `Follow ${x.name} in full, ten minutes at a time, whatever befalls them`;
    pin.setAttribute("aria-label", pin.title);
    pin.onclick = () => this.onPin(x.id, !fixed);
    body.push(tier);
    // (Their family, P3.)
    const family = el("button", "place-insp-family", "Family ▸");
    family.setAttribute(
      "aria-label",
      `${x.name}'s family: parents, brothers and sisters, children`,
    );
    family.onclick = () => this.onInspect(x.familyRef);
    body.push(family);
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
      body.push(
        el("h3", "place-insp-sub", "Whom they know"),
        el("p", "place-insp-why", x.tiesWords),
        el("p", "place-insp-why", x.repute),
      );
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
      body.push(this.facts(x.gear));
    } else if (this.tab === "life") {
      // (Their nearest kin a tap away, living or of the town's dead kept so: R1.)
      if (x.kin.length) {
        body.push(el("h3", "place-insp-sub", "Their nearest kin"));
        body.push(this.kinRows(x.kin));
      }
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
          ["Nature", x.nature, null],
          ["Values", x.values, null],
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
    const kinN = x.siblings.length + x.children.length + x.grandchildren.length;
    this.sub.textContent = `${x.children.length} ${x.children.length === 1 ? "child" : "children"} · ${kinN + x.grandparents.length + (x.mate ? 1 : 0)} kin in the town`;
    const body: HTMLElement[] = [el("p", "place-insp-why", x.words)],
      rows = (
        label: string,
        list: readonly { name: string; ref: string | null; words: string }[],
      ) => {
        if (!list.length) return;
        const box = el("div", "place-insp-people");
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
    this.body.replaceChildren(...body);
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
    this.body.replaceChildren(...belowEl(x));
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
    const wear = el("div", "place-insp-need"),
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
    }
    if (x.zoneWords) body.push(el("p", "place-insp-why", x.zoneWords));
    // (The guard's post by your order, O7: those standing to arms keep it, watching the homes within a cry of it.)
    if (x.postable && this.orders) {
      const b = el(
        "button",
        "place-chip place-insp-post",
        x.post ? "🛡️ The guard's post: back to the square" : "🛡️ Post the guard here",
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
        go.onclick = () => this.onOrder("town.ask", { kind: "raise", what: r.what, at: r.at });
        row.append(words, go);
        box.append(row);
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
      if (ref) {
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
