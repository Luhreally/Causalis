// A life lived by the god's hand, on the phone (Lives L3): the strip at the top (who, the time, the three
// needs, the purse, what they want, their rival), the tray along the bottom (what they could turn to now), the
// paces, a window for what waits on the viewer, a sheet of lives to take up, a book of their family and days.
// Everything else on the screen stays the town: the middle takes no touches, so the eye turns and people
// and buildings are tapped as ever. Every control a finger's size. Nothing here decides: it says what is told.
import type { LifeCard, LifeNow, LifeWindow } from "../bridge/index.ts";
import { el } from "./why.ts";

const put = (e: HTMLElement, text: string) => {
  if (e.textContent !== text) e.textContent = text;
};
const YEAR_DAYS = 365;
/** The year and day of the world, as the town's own bar says them. */
const dated = (t: number) => {
  const day = Math.floor(t / 86_400);
  return `Year ${Math.floor(day / YEAR_DAYS)}, day ${day % YEAR_DAYS}`;
};
const clock = (t: number) => {
  const s = ((t % 86_400) + 86_400) % 86_400;
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
};

/** A need's bar: its sign, and how full it stands. */
function need(icon: string, title: string): { box: HTMLElement; fill: HTMLElement } {
  const box = el("span", "life-need"),
    bar = el("span", "life-bar"),
    fill = el("span", "life-fill");
  box.title = title;
  bar.append(fill);
  box.append(el("span", "life-icon", icon), bar);
  return { box, fill };
}

export class LifeHud {
  readonly element = el("div", "life-hud");
  private readonly strip = el("div", "life-strip");
  private readonly who = el("strong", "life-name");
  private readonly what = el("span", "life-what");
  private readonly time = el("span", "life-time");
  private readonly fed = need("🍲", "Fed");
  private readonly rested = need("🛏️", "Rested");
  private readonly heart = need("💗", "Heart");
  private readonly purse = el("span", "life-purse");
  private readonly want = el("button", "life-want");
  private readonly rival = el("button", "life-rival");
  private readonly told = el("div", "life-told");
  private readonly tray = el("div", "life-tray");
  private readonly market = el("div", "life-market");
  private readonly win = el("div", "life-window");
  private readonly book = el("div", "life-book");
  private readonly letGo = el("button", "life-letgo", "✋ Let go");
  private readonly bookBtn = el("button", "life-bookbtn", "👪");
  private readonly slow = el("button", "life-pace", "▶");
  private readonly quick = el("button", "life-pace", "▶▶");
  private readonly stop = el("button", "life-pace", "❚❚");
  private readonly pass = el("button", "life-pace", "⏭");
  private readonly walk = el("button", "life-walk", "🕹 Walk");
  private readonly goIn = el("button", "life-pace life-goin", "🏠 Go in");
  /** 🏠 Go in: the home of the one lived, looked into (Lives L6). */
  onGoIn: () => void = () => {};
  private trayKey = "";
  private winKey = "";
  private marketKey = "";
  private last: LifeNow | null = null;
  private purseWas: number | null = null;
  onDo: (what: string, target: number) => void = () => {};
  onBuy: (good: "tool" | "cloth") => void = () => {};
  onAnswer: (key: string, choice: number) => void = () => {};
  onWant: (want: string) => void = () => {};
  onHeir: (agent: number) => void = () => {};
  onLetGo: () => void = () => {};
  onWalk: () => void = () => {};
  /** 👑 Rule: the one lived is a realm's ruler (Lives L4). */
  onRule: (realm: string) => void = () => {};
  private toldFor: ReturnType<typeof setTimeout> | null = null;
  onPage: (ref: string) => void = () => {};
  /** ❚❚, ▶, ▶▶: the clock held, or run. */
  onPace: (pace: "stop" | "slow" | "quick") => void = () => {};
  /** ⏭: time let go by on a habit, so long. */
  onPass: (habit: number, days: number) => void = () => {};

  constructor(parent: HTMLElement) {
    this.element.hidden = true;
    const top = el("div", "life-line"),
      paces = el("div", "life-paces"),
      needs = el("div", "life-needs");
    top.append(this.who, this.what, this.letGo);
    paces.append(this.time, this.stop, this.slow, this.quick, this.pass, this.bookBtn, this.goIn);
    needs.append(this.fed.box, this.rested.box, this.heart.box, this.purse);
    this.strip.append(top, paces, needs, this.want, this.rival);
    this.win.hidden = this.book.hidden = this.market.hidden = true;
    this.want.onclick = () => {
      if (this.last?.want) this.say(this.last.want.words);
    };
    this.rival.onclick = () => {
      if (this.last?.rival) this.onPage(`agent:${this.last.rival.id}`);
    };
    this.letGo.onclick = () => this.onLetGo();
    this.walk.onclick = () => this.onWalk();
    this.stop.onclick = () => this.onPace("stop");
    this.slow.onclick = () => this.onPace("slow");
    this.quick.onclick = () => this.onPace("quick");
    this.pass.onclick = () => this.showPass();
    this.bookBtn.onclick = () => this.showBook();
    this.goIn.onclick = () => this.onGoIn();
    this.element.append(this.strip, this.told, this.market, this.tray, this.win, this.book);
    parent.append(this.element);
  }

  get open(): boolean {
    return !this.element.hidden;
  }
  /** A window waits, or a sheet is up: the clock is to be held. */
  get waiting(): boolean {
    return !this.win.hidden || !this.book.hidden;
  }

  show(): void {
    this.element.hidden = false;
    document.body.classList.add("living");
  }
  hide(): void {
    this.element.hidden = true;
    this.win.hidden = this.book.hidden = this.market.hidden = true;
    this.winKey = this.trayKey = this.marketKey = "";
    this.purseWas = null;
    document.body.classList.remove("living");
  }
  toast(words: string): void {
    const t = el("div", "life-toast", words);
    this.element.parentElement?.append(t);
    setTimeout(() => t.remove(), 6000);
  }
  say(words: string): void {
    put(this.told, words);
    if (this.toldFor) clearTimeout(this.toldFor);
    this.toldFor = setTimeout(() => put(this.told, ""), 6000);
  }

  /** What is told now. */
  set(l: LifeNow, t: number): void {
    this.last = l;
    put(this.who, l.name);
    put(this.what, l.what);
    put(this.time, `${dated(t)} · ${clock(t)}`);
    for (const [n, v] of [
      [this.fed, l.fed],
      [this.rested, l.rested],
      [this.heart, l.heart],
    ] as const) {
      const w = `${Math.round(v * 100)}%`;
      if (n.fill.style.width !== w) n.fill.style.width = w;
      n.box.classList.toggle("low", v < 0.35);
    }
    put(this.purse, `💰 ${l.purse.toLocaleString("en-US")}${l.short ? " · short" : ""}`);
    if (this.purseWas !== null && l.purse > this.purseWas)
      this.float(`+${l.purse - this.purseWas}`);
    this.purseWas = l.purse;
    this.want.hidden = !l.want;
    if (l.want) {
      put(
        this.want,
        `${l.want.icon} ${l.want.label}: ${l.want.have.toLocaleString("en-US")}/${l.want.goal.toLocaleString("en-US")}`,
      );
      this.want.style.setProperty(
        "--life-have",
        `${Math.min(100, (l.want.have / Math.max(1, l.want.goal)) * 100)}%`,
      );
    }
    this.rival.hidden = !l.rival;
    if (l.rival) {
      const ahead = l.rival.purse - l.purse;
      put(
        this.rival,
        `⚔️ ${l.rival.name}: ${l.rival.purse.toLocaleString("en-US")} coin, ${ahead > 0 ? `${ahead.toLocaleString("en-US")} ahead of you` : `${(-ahead).toLocaleString("en-US")} behind you`}`,
      );
    }
    this.drawTray(l);
    this.drawMarket(l);
    this.drawWindow(l);
  }

  private float(text: string): void {
    const f = el("span", "life-float", text);
    this.strip.append(f);
    setTimeout(() => f.remove(), 900);
  }

  private drawTray(l: LifeNow): void {
    const key = `${l.rules ?? ""}${l.offers.map((o) => `${o.what}|${o.target}|${o.label}|${o.can}`).join(",")}`;
    if (key === this.trayKey) return;
    this.trayKey = key;
    const realm = l.rules,
      rule = realm ? el("button", "life-walk life-rule", "👑 Rule") : null;
    if (rule && realm) rule.onclick = () => this.onRule(realm);
    this.tray.replaceChildren(
      this.walk,
      ...(rule ? [rule] : []),
      ...l.offers.map((o) => {
        const b = el("button", "life-offer");
        b.append(el("span", "life-icon", o.icon), el("span", "life-label", o.label));
        b.dataset.what = o.what;
        b.disabled = !o.can;
        b.title = o.words;
        b.onclick = () => {
          this.say(o.words);
          this.onDo(o.what, o.target);
        };
        return b;
      }),
    );
  }

  private drawMarket(l: LifeNow): void {
    this.market.hidden = !l.market;
    if (!l.market) {
      this.marketKey = "";
      return;
    }
    const key = l.market.map((m) => `${m.good}|${m.cost}|${m.can}`).join(",");
    if (key === this.marketKey) return;
    this.marketKey = key;
    this.market.replaceChildren(
      ...l.market.map((m) => {
        const b = el("button", "life-buy", `${m.label}: ${m.cost} coin`);
        b.dataset.good = m.good;
        b.title = m.words;
        b.disabled = !m.can;
        b.onclick = () => this.onBuy(m.good);
        const box = el("div", "life-buyline");
        box.append(b, el("span", "life-buywords", m.words));
        return box;
      }),
    );
  }

  private drawWindow(l: LifeNow): void {
    const w: LifeWindow | undefined = l.windows[0],
      key = w?.key ?? "";
    if (key === this.winKey) return;
    this.winKey = key;
    this.win.hidden = !w;
    if (!w) return;
    const acts = el("div", "life-choices");
    for (const c of w.choices) {
      const b = el("button", "life-choice", c.label);
      if (c.words) b.title = c.words;
      b.onclick = () => this.onAnswer(w.key, c.choice);
      acts.append(b);
    }
    for (const h of w.kind === "died" ? l.heirs : []) {
      const b = el("button", "life-choice", `Go on as ${h.name}, ${h.age}, your ${h.is}`);
      b.dataset.heir = `${h.id}`;
      b.onclick = () => this.onHeir(h.id);
      acts.append(b);
    }
    if (w.kind === "died") {
      const b = el("button", "life-choice", "Let go");
      b.onclick = () => this.onLetGo();
      acts.append(b);
    }
    this.win.replaceChildren(
      el("div", "life-wintitle", `${w.icon} ${w.title}`),
      el("p", "life-winwords", w.words),
      acts,
    );
  }

  private showPass(): void {
    const box = el("div", "life-choices"),
      habits = [
        ["🙂 Steady", 0],
        ["🔥 Hard at it", 1],
        ["👪 Family first", 2],
        ["🗣️ Out and about", 3],
      ] as const,
      spans = [
        ["A month", 30],
        ["A season", 90],
        ["A year", 365],
      ] as const;
    let habit = this.last?.habit ?? 0;
    const hs = el("div", "life-choices");
    for (const [label, i] of habits) {
      const b = el("button", `life-choice${i === habit ? " on" : ""}`, label);
      b.dataset.habit = `${i}`;
      b.onclick = () => {
        habit = i;
        for (const c of hs.children) c.classList.toggle("on", c === b);
      };
      hs.append(b);
    }
    for (const [label, days] of spans) {
      const b = el("button", "life-choice life-span", label);
      b.dataset.days = `${days}`;
      b.onclick = () => {
        this.book.hidden = true;
        this.onPass(habit, days);
      };
      box.append(b);
    }
    const close = el("button", "life-choice", "Not now");
    close.onclick = () => (this.book.hidden = true);
    box.append(close);
    this.book.replaceChildren(el("div", "life-wintitle", "⏭ Let time go by"), hs, box);
    this.book.hidden = false;
  }

  private showBook(): void {
    const l = this.last;
    if (!l) return;
    const kin = el("div", "life-kin");
    for (const k of l.kin) {
      const b = el(
        "button",
        "life-kinline",
        `${k.name}, ${k.age}: your ${k.is}, a ${k.work} ${k.love > 0 ? "💗".repeat(Math.ceil(k.love * 3)) : ""}`,
      );
      b.onclick = () => this.onPage(k.ref);
      kin.append(b);
    }
    const page = el("button", "life-choice", "Their page");
    page.onclick = () => this.onPage(l.ref);
    const close = el("button", "life-choice", "Close");
    close.onclick = () => (this.book.hidden = true);
    const acts = el("div", "life-choices");
    acts.append(page, close);
    this.book.replaceChildren(
      el("div", "life-wintitle", `👪 ${l.name}, ${l.skill}`),
      el(
        "p",
        "life-winwords",
        `${l.owned ? "Their home is their own." : "They rent their home."} Standing ${l.standing} of 100. Life ${l.generation} of their line.`,
      ),
      kin,
      ...l.log
        .slice(-6)
        .map((x) =>
          el("div", "life-logline", `Year ${Math.floor(x.at / (365 * 86_400))}: ${x.words}`),
        ),
      acts,
    );
    this.book.hidden = false;
  }
}

/** The sheet of lives to take up in a town: each card a line of who and why, and Live as them. */
export class LifePicker {
  readonly element = el("div", "life-picker");
  private readonly list = el("div", "life-cards");
  private readonly note = el("p", "life-winwords");
  private readonly close = el("button", "life-choice", "Not now");
  onLive: (id: number) => void = () => {};
  onPage: (ref: string) => void = () => {};
  onClose: () => void = () => {};

  constructor(parent: HTMLElement) {
    this.element.hidden = true;
    this.close.onclick = () => this.onClose();
    this.element.append(
      el("div", "life-wintitle", "🏠 Whose life?"),
      this.note,
      this.list,
      this.close,
    );
    parent.append(this.element);
  }

  get open(): boolean {
    return !this.element.hidden;
  }

  show(cards: readonly LifeCard[], note: string): void {
    this.note.textContent = note;
    this.list.replaceChildren(...cards.map((c) => this.card(c)));
    this.element.hidden = false;
  }

  /** One tapped in the town: their card first. */
  top(c: LifeCard): void {
    this.list.prepend(this.card(c));
    this.list.scrollTop = 0;
  }

  hide(): void {
    this.element.hidden = true;
  }

  private card(c: LifeCard): HTMLElement {
    const box = el("div", "life-card"),
      name = el("button", "life-cardname", `${c.name}, ${c.age}`),
      live = el("button", "life-live", "Live as them");
    box.dataset.kind = c.kind;
    name.onclick = () => this.onPage(c.ref);
    live.onclick = () => this.onLive(c.id);
    box.append(name, el("div", "life-what", c.what), el("div", "life-hook", c.hook), live);
    return box;
  }
}
