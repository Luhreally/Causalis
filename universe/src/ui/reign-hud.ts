// A ruler ruled by the god's hand, on the phone (Lives L4): the bar at the top (who, the months, the realm at a glance,
// its wealth against those it meets), a tray along the bottom (decrees, war and peace, marriage, the realm, walk), a sheet
// for each of those, and a window when their rule ends. The middle takes no touches. A choice that cannot be made can
// still be pressed: the world says why in words. Every control a finger's size. Nothing here decides.
import type {
  ReignDecrees,
  ReignDrama,
  ReignFall,
  ReignMatch,
  ReignMatches,
  ReignNow,
  ReignWars,
} from "../bridge/index.ts";
import { el } from "./why.ts";

const put = (e: HTMLElement, text: string) => {
  if (e.textContent !== text) e.textContent = text;
};
const YEAR_DAYS = 365;
/** The year and month of the world, as a ruler counts time. */
const dated = (t: number) => {
  const day = Math.floor(t / 86_400);
  return `Year ${Math.floor(day / YEAR_DAYS)}, month ${Math.floor((day % YEAR_DAYS) / 30) + 1}`;
};
const many = (n: number) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(1)}M`
    : n >= 1e4
      ? `${Math.round(n / 1000)}k`
      : Math.round(n).toLocaleString("en-US");
const worth = (n: number) => (n >= 100 ? `${Math.round(n)}` : n.toFixed(1));

/** A chip of the realm at a glance: tapped, its page. */
function chip(kind: string, title: string): HTMLButtonElement {
  const b = el("button", "reign-chip");
  b.dataset.chip = kind;
  b.title = title;
  return b;
}

export class ReignHud {
  readonly element = el("div", "reign-hud");
  private readonly strip = el("div", "life-strip reign-strip");
  private readonly who = el("strong", "life-name");
  private readonly what = el("span", "life-what");
  private readonly letGo = el("button", "life-letgo reign-letgo", "✋ Let go");
  private readonly time = el("span", "life-time");
  private readonly stop = el("button", "life-pace reign-pace", "❚❚");
  private readonly slow = el("button", "life-pace reign-pace", "▶");
  private readonly quick = el("button", "life-pace reign-pace", "▶▶");
  private readonly people = chip("people", "Their people");
  private readonly host = chip("host", "Their host");
  private readonly order = chip("order", "Their standing and their lands' grievance");
  private readonly warsChip = chip("wars", "Their wars");
  private readonly heir = chip("heir", "Their court: heir and rivals");
  private readonly wealth = chip("wealth", "Worth a head, and its place");
  private readonly bars = el("button", "reign-bars");
  private readonly told = el("div", "life-told reign-told");
  private readonly tray = el("div", "life-tray reign-tray");
  private readonly sheet = el("div", "life-book reign-sheet");
  private readonly win = el("div", "life-window reign-window");
  private readonly said = el("p", "reign-said");
  private last: ReignNow | null = null;
  private fallKey = "";
  private toldPage: string | null = null;
  private toldFor: ReturnType<typeof setTimeout> | null = null;
  onPage: (ref: string) => void = () => {};
  onPace: (pace: "stop" | "slow" | "quick") => void = () => {};
  onLetGo: () => void = () => {};
  onWalk: () => void = () => {};
  onSheet: (kind: "decrees" | "wars" | "matches") => void = () => {};
  onDecree: (law: string, to: number) => void = () => {};
  onWar: (against: string, prize: number) => void = () => {};
  onPeace: (foe: string) => void = () => {};
  onWed: (m: ReignMatch) => void = () => {};
  onHeir: () => void = () => {};
  /** A plot or an heir's death answered (Lives L5): "let" sends nothing. */
  onDrama: (d: ReignDrama, choice: string) => void = () => {};

  constructor(parent: HTMLElement) {
    this.element.hidden = true;
    const top = el("div", "life-line"),
      paces = el("div", "life-paces"),
      glance = el("div", "reign-glance");
    top.append(this.who, this.what, this.letGo);
    paces.append(this.time, this.stop, this.slow, this.quick);
    glance.append(this.people, this.wealth, this.host, this.order, this.warsChip, this.heir);
    this.strip.append(top, paces, glance, this.bars);
    this.win.hidden = this.sheet.hidden = true;
    this.letGo.onclick = () => this.onLetGo();
    this.told.onclick = () => {
      if (this.toldPage) this.onPage(this.toldPage);
    };
    this.stop.onclick = () => this.onPace("stop");
    this.slow.onclick = () => this.onPace("slow");
    this.quick.onclick = () => this.onPace("quick");
    const page = (b: HTMLElement, of: (l: ReignNow) => string) => {
      b.onclick = () => {
        if (this.last) this.onPage(of(this.last));
      };
    };
    page(this.people, (l) => l.realm);
    page(this.wealth, (l) => `${l.realm}#wealth`);
    page(this.host, (l) => l.realm);
    page(this.order, (l) => l.realm);
    page(this.heir, (l) => `${l.realm}#court`);
    this.warsChip.onclick = () => this.onSheet("wars");
    this.bars.onclick = () => {
      const l = this.last,
        n = l?.neighbours[0];
      if (l && n) this.onPage(`compare:${l.realm}|${n.ref}`);
    };
    for (const [icon, label, kind] of [
      ["📜", "Decrees", "decrees"],
      ["⚔️", "War, peace", "wars"],
      ["💍", "Marriage", "matches"],
    ] as const) {
      const b = el("button", "life-offer reign-act");
      b.dataset.act = kind;
      b.append(el("span", "life-icon", icon), el("span", "life-label", label));
      b.onclick = () => this.onSheet(kind);
      this.tray.append(b);
    }
    const court = el("button", "life-offer reign-act");
    court.dataset.act = "court";
    court.append(el("span", "life-icon", "🏛️"), el("span", "life-label", "Court"));
    court.onclick = () => {
      if (this.last) this.onPage(`${this.last.realm}#court`);
    };
    this.tray.append(court);
    const realm = el("button", "life-offer reign-act");
    realm.dataset.act = "realm";
    realm.append(el("span", "life-icon", "📖"), el("span", "life-label", "The realm"));
    realm.onclick = () => {
      if (this.last) this.onPage(this.last.realm);
    };
    const walk = el("button", "life-offer reign-act");
    walk.dataset.act = "walk";
    walk.append(el("span", "life-icon", "🕹"), el("span", "life-label", "Walk"));
    walk.onclick = () => this.onWalk();
    this.tray.append(realm, walk);
    this.element.append(this.strip, this.told, this.tray, this.sheet, this.win);
    parent.append(this.element);
  }

  get open(): boolean {
    return !this.element.hidden;
  }
  /** A sheet or a window is up: a choice is open, and the clock is held. */
  get waiting(): boolean {
    return !this.win.hidden || !this.sheet.hidden;
  }

  show(): void {
    this.element.hidden = false;
    document.body.classList.add("ruling");
  }
  hide(): void {
    this.element.hidden = true;
    this.win.hidden = this.sheet.hidden = true;
    this.fallKey = "";
    document.body.classList.remove("ruling");
  }
  closeSheet(): void {
    this.sheet.hidden = true;
  }
  /** A page is being read: all but the bar stands aside for it. */
  underPage(open: boolean): void {
    this.element.classList.toggle("under-page", open);
  }
  say(words: string, page: string | null = null): void {
    this.toldPage = page;
    put(this.told, words);
    if (this.toldFor) clearTimeout(this.toldFor);
    this.toldFor = setTimeout(() => put(this.told, ""), 7000);
  }
  /** In the sheet that is up: what the world answered. */
  answer(words: string): void {
    put(this.said, words);
    this.said.scrollIntoView({ block: "nearest" });
  }

  set(l: ReignNow, t: number, pace: "stop" | "slow" | "quick"): void {
    this.last = l;
    put(this.who, `👑 ${l.ruler}`);
    put(this.what, l.fell ? "no longer rules" : `${l.title}, ${l.age}`);
    put(this.time, dated(t));
    for (const [b, p] of [
      [this.stop, "stop"],
      [this.slow, "slow"],
      [this.quick, "quick"],
    ] as const)
      b.classList.toggle("on", p === pace);
    put(this.people, `👥 ${many(l.people)} · ${l.lands} land${l.lands === 1 ? "" : "s"}`);
    put(this.wealth, `💰 ${worth(l.head)} a head · ${l.rank} of ${l.of}`);
    put(this.host, `🛡️ ${many(l.host)} in the host`);
    put(
      this.order,
      `⚖️ ${Math.round(l.legitimacy * 100)}% rightful · ${Math.round(l.unrest * 100)}% sore`,
    );
    this.order.classList.toggle("low", l.legitimacy < 0.3);
    put(
      this.warsChip,
      l.wars.length
        ? `⚔️ ${l.wars.length} war${l.wars.length === 1 ? "" : "s"}: ${l.wars[0]!.foeName}`
        : "🕊️ At peace",
    );
    this.warsChip.classList.toggle("low", l.wars.length > 0);
    put(this.heir, `👪 ${l.heir}`);
    this.drawBars(l);
    this.drawFall(l.fell);
  }

  private drawBars(l: ReignNow): void {
    const rows = [
        { short: "You", head: l.head, me: true },
        ...l.neighbours.map((n) => ({ short: n.short, head: n.head, me: false })),
      ],
      top = Math.max(1e-6, ...rows.map((r) => r.head));
    this.bars.hidden = rows.length < 2;
    const key = rows.map((r) => `${r.short}:${worth(r.head)}`).join("|");
    if (this.bars.dataset.key === key) return;
    this.bars.dataset.key = key;
    this.bars.replaceChildren(
      ...rows.map((r) => {
        const row = el("span", `reign-bar${r.me ? " me" : ""}`),
          fill = el("span", "reign-fill");
        fill.style.width = `${Math.max(3, Math.round((r.head / top) * 100))}%`;
        row.append(
          el("span", "reign-barname", r.short),
          el("span", "reign-bartrack", ""),
          el("span", "reign-barworth", worth(r.head)),
        );
        row.children[1]!.append(fill);
        return row;
      }),
    );
  }

  private open_(title: string, ...body: HTMLElement[]): void {
    const close = el("button", "life-choice reign-close", "Close");
    close.onclick = () => this.closeSheet();
    put(this.said, "");
    this.sheet.replaceChildren(el("div", "life-wintitle", title), ...body, this.said, close);
    this.sheet.hidden = false;
    this.sheet.scrollTop = 0;
  }

  decrees(d: ReignDecrees): void {
    const body: HTMLElement[] = [el("p", "life-winwords", d.words)];
    for (const law of d.laws) {
      const box = el("div", "reign-law");
      box.dataset.law = law.law;
      box.append(
        el("div", "reign-lawtitle", law.title),
        el("div", "reign-lawnow", `Now: ${law.now}`),
      );
      for (const o of law.options) {
        const b = el("button", `life-choice reign-opt${o.can ? "" : " refused"}`, o.label);
        b.dataset.law = law.law;
        b.dataset.to = `${o.to}`;
        b.dataset.can = o.can ? "1" : "0";
        b.onclick = () => this.onDecree(law.law, o.to);
        box.append(b, el("div", "reign-optwords", o.words));
      }
      body.push(box);
    }
    this.open_("📜 Decrees", ...body);
  }

  wars(d: ReignWars): void {
    const body: HTMLElement[] = [el("p", "life-winwords", d.words)];
    for (const w of d.wars) {
      const box = el("div", "reign-law reign-warline");
      box.dataset.war = w.ref;
      const page = el(
          "button",
          "life-choice reign-warpage",
          `⚔️ ${w.foeName}, since year ${w.since}`,
        ),
        last = w.last,
        peace = el(
          "button",
          `life-choice reign-peace${w.can ? "" : " refused"}`,
          "🕊️ Ask for peace",
        );
      page.onclick = () => this.onPage(w.ref);
      peace.dataset.foe = w.foe;
      peace.onclick = () => this.onPeace(w.foe);
      box.append(
        page,
        el(
          "div",
          "reign-optwords",
          `${w.words}. Fallen: ${many(w.fallen[0])} of yours, ${many(w.fallen[1])} of theirs, in ${w.battles} battle${w.battles === 1 ? "" : "s"}.`,
        ),
      );
      if (last) {
        const b = el("button", "life-choice reign-battle", `⚔️ ${last.words}`);
        b.onclick = () => this.onPage(last.ref);
        box.append(b);
      }
      box.append(peace, el("div", "reign-optwords", w.peace));
      body.push(box);
    }
    for (const w of d.lately) {
      const box = el("div", "reign-law reign-lately"),
        page = el("button", "life-choice reign-warpage", `🕊️ ${w.foeName}, since year ${w.since}`),
        last = w.last;
      box.dataset.war = w.ref;
      page.onclick = () => this.onPage(w.ref);
      box.append(
        page,
        el(
          "div",
          "reign-optwords",
          `${w.came} Fallen: ${many(w.fallen[0])} of yours, ${many(w.fallen[1])} of theirs, in ${w.battles} battle${w.battles === 1 ? "" : "s"}.`,
        ),
      );
      if (last) {
        const b = el("button", "life-choice reign-battle", `⚔️ ${last.words}`);
        b.onclick = () => this.onPage(last.ref);
        box.append(b);
      }
      body.push(box);
    }
    for (const f of d.foes) {
      const box = el("div", "reign-law reign-foe");
      box.dataset.foe = f.ref;
      const name = el("button", "life-choice reign-foename", `${f.name}: ${f.regard}`);
      name.onclick = () => this.onPage(f.ref);
      box.append(name, el("div", "reign-optwords", f.words));
      for (const aim of f.aims.length ? f.aims : []) {
        const b = el(
          "button",
          `life-choice reign-declare${f.can ? "" : " refused"}`,
          `⚔️ War for ${aim.name}`,
        );
        b.dataset.foe = f.ref;
        b.dataset.can = f.can ? "1" : "0";
        b.onclick = () => this.onWar(f.ref, aim.cell);
        box.append(b);
      }
      body.push(box);
    }
    this.open_("⚔️ War and peace", ...body);
  }

  matches(d: ReignMatches): void {
    const body: HTMLElement[] = [el("p", "life-winwords reign-matchwords", d.words)];
    for (const m of d.matches) {
      const box = el("div", "reign-law reign-match");
      const b = el(
        "button",
        `life-choice reign-wed${m.can ? "" : " refused"}`,
        `💍 ${m.who.name} to ${m.partner.name} of ${m.toName}`,
      );
      b.dataset.can = m.can ? "1" : "0";
      b.dataset.to = m.to;
      b.onclick = () => this.onWed(m);
      box.append(b, el("div", "reign-optwords", m.words));
      body.push(box);
    }
    this.open_("💍 A marriage of state", ...body);
  }

  /** What must be answered: the clock is held until it is. A choice refused says why, and stays. */
  drama(d: ReignDrama): void {
    this.sheet.hidden = true;
    const acts = el("div", "life-choices"),
      said = el("p", "reign-said");
    for (const c of d.choices) {
      const b = el("button", `life-choice reign-drama${c.can ? "" : " refused"}`, c.label);
      b.dataset.choice = c.id.split(":")[0]!;
      b.dataset.can = c.can ? "1" : "0";
      b.onclick = () => {
        if (!c.can) {
          put(said, c.words);
          return;
        }
        this.win.hidden = true;
        this.onDrama(d, c.id);
      };
      acts.append(b, el("div", "reign-optwords", c.words));
    }
    const who = d.who;
    if (who) {
      const page = el("button", "life-choice reign-dramapage", "📄 Who they are");
      page.onclick = () => this.onPage(who);
      acts.append(page);
    }
    const why = el("button", "life-choice reign-dramawhy", "📄 Why");
    why.onclick = () => this.onPage(d.event);
    acts.append(why);
    this.win.replaceChildren(
      el("div", "life-wintitle", `${d.kind === "fire" ? "☢️" : d.kind === "plot" ? "🗡️" : "🪦"} ${d.title}`),
      el("p", "life-winwords", d.words),
      said,
      acts,
    );
    this.win.hidden = false;
    this.win.scrollTop = 0;
  }

  private drawFall(f: ReignFall | null): void {
    const key = f ? `${f.how}|${f.title}` : "";
    if (key === this.fallKey) return;
    this.fallKey = key;
    this.win.hidden = !f;
    if (!f) return;
    this.sheet.hidden = true;
    const acts = el("div", "life-choices"),
      heir = f.heir;
    if (heir) {
      const b = el(
        "button",
        "life-choice reign-heir",
        `👑 Rule on as ${heir.name}, ${heir.age}, ${heir.tie}`,
      );
      b.onclick = () => this.onHeir();
      acts.append(b);
    }
    const go = el("button", "life-choice reign-end", "✋ Let go");
    go.onclick = () => this.onLetGo();
    acts.append(go);
    if (f.event) {
      const why = el("button", "life-choice", "📄 How it happened");
      const event = f.event;
      why.onclick = () => this.onPage(event);
      acts.append(why);
    }
    this.win.replaceChildren(
      el(
        "div",
        "life-wintitle",
        `${f.how === "died" ? "🪦" : f.how === "realm" ? "🏚️" : "⚔️"} ${f.title}`,
      ),
      el("p", "life-winwords", f.words),
      acts,
    );
  }
}
